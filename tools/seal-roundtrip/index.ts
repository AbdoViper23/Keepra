/**
 * Phase 4 — Seal roundtrip CLI.
 *
 * Proves the core cryptographic primitive end-to-end on Sui testnet:
 *   encrypt (Seal IBE) -> seal on-chain (create_and_seal, frozen Vault)
 *   -> satisfy a release condition (guardian attest) -> decrypt -> byte-match.
 *
 * Ciphertext stays in memory (Walrus upload arrives in Phase 5).
 */
import 'dotenv/config';
import { SuiJsonRpcClient, type SuiObjectChange } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { toHex } from '@mysten/sui/utils';
import { SealClient, SessionKey } from '@mysten/seal';
import { DemType } from '@mysten/seal';
import { webcrypto } from 'node:crypto';

type CreatedChange = Extract<SuiObjectChange, { type: 'created' }>;
const isCreated =
  (suffix: string) =>
  (c: SuiObjectChange): c is CreatedChange =>
    c.type === 'created' && c.objectType.endsWith(suffix);

const CLOCK_OBJECT_ID = '0x6';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function log(step: string) {
  console.log(`✓ ${step}`);
}

async function main() {
  const rpcUrl = process.env.SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443';
  const packageId = requireEnv('KEEPRA_PACKAGE_ID');
  const committeeServerId = requireEnv('SEAL_COMMITTEE_SERVER_ID');
  const committeeAggregatorUrl = requireEnv('SEAL_COMMITTEE_AGGREGATOR_URL');
  const privateKey = requireEnv('CLI_WALLET_PRIVATE_KEY');

  const suiClient = new SuiJsonRpcClient({ url: rpcUrl, network: 'testnet' });

  const { secretKey } = decodeSuiPrivateKey(privateKey);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const address = keypair.toSuiAddress();
  console.log(`Signer address: ${address}`);

  // ─── 1. Encrypt ───
  const seal_id = new Uint8Array(32);
  webcrypto.getRandomValues(seal_id);
  const sealIdHex = toHex(seal_id);

  const plaintext = `Keepra roundtrip @ ${new Date().toISOString()} — only on-chain policy can release this.`;
  const data = new TextEncoder().encode(plaintext);

  const sealClient = new SealClient({
    suiClient,
    serverConfigs: [
      {
        objectId: committeeServerId,
        aggregatorUrl: committeeAggregatorUrl,
        weight: 1,
      },
    ],
    verifyKeyServers: true,
  });

  const { encryptedObject } = await sealClient.encrypt({
    packageId,
    threshold: 1,
    id: sealIdHex,
    data,
    demType: DemType.AesGcm256,
  });
  log('Encrypted');

  // ─── 2. Seal on-chain: create_and_seal (frozen Vault + shared HeartbeatLog + GuardianCap) ───
  const createTx = new Transaction();
  createTx.moveCall({
    target: `${packageId}::vault::create_and_seal`,
    arguments: [
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode('in-memory-no-walrus-yet'))),
      createTx.pure.vector('u8', Array.from(seal_id)),
      createTx.pure.u8(1), // threshold
      createTx.pure.vector('id', []), // key_server_ids (empty in Phase 4)
      createTx.pure.u64(1), // inactivity_seconds (short; we release via quorum anyway)
      createTx.pure.vector('address', [address]), // guardian_set: CLI is the sole guardian
      createTx.pure.u8(1), // guardian_quorum
      createTx.pure.option('id', null), // dao_id
      createTx.pure.option('u64', null), // dao_threshold
      createTx.pure.vector('u8', Array.from(new TextEncoder().encode('email-hash-placeholder'))),
      createTx.pure.option('string', null), // beneficiary_zk_sub
      createTx.object(CLOCK_OBJECT_ID),
    ],
  });

  const createRes = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: createTx,
    options: { showObjectChanges: true, showEffects: true },
  });
  await suiClient.waitForTransaction({ digest: createRes.digest });

  if (createRes.effects?.status.status !== 'success') {
    throw new Error(`create_and_seal failed: ${createRes.effects?.status.error}`);
  }

  const changes = createRes.objectChanges ?? [];
  const vaultChange = changes.find(isCreated('::vault::Vault'));
  const logChange = changes.find(isCreated('::heartbeat::HeartbeatLog'));
  const capChange = changes.find(isCreated('::guardian::GuardianCap'));
  if (!vaultChange || !logChange || !capChange) {
    throw new Error('Could not locate created Vault / HeartbeatLog / GuardianCap in objectChanges');
  }
  const vaultId = vaultChange.objectId;
  const logId = logChange.objectId;
  const capId = capChange.objectId;
  log(`Sealed on-chain (vault ${vaultId.slice(0, 10)}…)`);

  // ─── 3. Satisfy a release condition: guardian attest (instant, no wall-clock dependence) ───
  const attestTx = new Transaction();
  attestTx.moveCall({
    target: `${packageId}::guardian::attest`,
    arguments: [attestTx.object(capId), attestTx.object(logId), attestTx.object(CLOCK_OBJECT_ID)],
  });
  const attestRes = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: attestTx,
    options: { showEffects: true },
  });
  await suiClient.waitForTransaction({ digest: attestRes.digest });
  if (attestRes.effects?.status.status !== 'success') {
    throw new Error(`attest failed: ${attestRes.effects?.status.error}`);
  }
  log('Attested (quorum 1/1 reached)');

  // ─── 4. SessionKey (signed by the raw keypair) ───
  const sessionKey = await SessionKey.create({
    address,
    packageId,
    ttlMin: 10,
    signer: keypair,
    suiClient,
  });

  // ─── 5. Approval PTB (serialized only — key servers dry-run it) ───
  const approveTx = new Transaction();
  approveTx.setSender(address);
  approveTx.moveCall({
    target: `${packageId}::policy::seal_approve_release`,
    arguments: [
      approveTx.pure.vector('u8', Array.from(seal_id)),
      approveTx.object(vaultId),
      approveTx.object(logId),
      approveTx.object(CLOCK_OBJECT_ID),
    ],
  });
  const txBytes = await approveTx.build({ client: suiClient, onlyTransactionKind: true });

  // ─── 6. Decrypt ───
  const decrypted = await sealClient.decrypt({
    data: encryptedObject,
    sessionKey,
    txBytes,
  });
  log('Decrypted');

  // ─── 7. Byte-for-byte match ───
  const recovered = new TextDecoder().decode(decrypted);
  if (recovered !== plaintext) {
    throw new Error(`Plaintext mismatch!\n  expected: ${plaintext}\n  got:      ${recovered}`);
  }
  log('Plaintext matches');

  console.log(
    '\n✓ Encrypted → ✓ Sealed on-chain → ✓ Attested (quorum) → ✓ Decrypted → ✓ Plaintext matches',
  );
}

main().catch((err) => {
  console.error('✗ Roundtrip failed:', err);
  process.exit(1);
});
