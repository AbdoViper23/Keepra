// Endpoint configuration for Keepra services. Env-driven with testnet defaults.
// Runtime-agnostic (no Node/browser-specific APIs) so it's safe to import from
// the CLI, the API, and the frontend alike.

export interface WalrusConfig {
  /** Publisher used for uploads (PUT /v1/blobs). */
  publisherUrl: string;
  /** Aggregators tried in order for downloads (GET /v1/blobs/{id}). */
  aggregatorUrls: string[];
  /** Storage duration in Walrus epochs (~1 day each on testnet). */
  epochs: number;
}

// Verified live on testnet 2026-06 (probed via /v1/api → 200).
const DEFAULT_PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
const DEFAULT_AGGREGATORS = [
  'https://aggregator.walrus-testnet.walrus.space',
  'https://wal-aggregator-testnet.staketab.org',
  'https://walrus-testnet-aggregator.nodes.guru',
  'https://aggregator.testnet.walrus.atalma.io',
];

type Env = Record<string, string | undefined>;

const pick = (env: Env, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = env[k];
    if (v) return v;
  }
  return undefined;
};

export function getWalrusConfig(env: Env = process.env): WalrusConfig {
  const publisherUrl =
    pick(env, 'WALRUS_PUBLISHER_URL', 'NEXT_PUBLIC_WALRUS_PUBLISHER_URL') ?? DEFAULT_PUBLISHER;

  const raw = pick(env, 'WALRUS_AGGREGATORS', 'NEXT_PUBLIC_WALRUS_AGGREGATORS') ?? '';
  const aggregatorUrls = raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '')) // trim + strip trailing slashes
    .filter(Boolean);

  return {
    publisherUrl: publisherUrl.replace(/\/+$/, ''),
    aggregatorUrls: aggregatorUrls.length > 0 ? aggregatorUrls : DEFAULT_AGGREGATORS,
    epochs: Number(pick(env, 'WALRUS_EPOCHS') ?? '5'),
  };
}
