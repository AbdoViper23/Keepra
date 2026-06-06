// Sui client wiring. Kept free of `@mysten/dapp-kit` imports so it is safe to
// import from both server and client modules; dapp-kit's network config lives
// in app/providers.tsx. All RPC is routed through the same-origin `/api/rpc`
// proxy (which forwards to Tatum's Sui gateway server-side), so the Tatum API
// key never reaches the browser. See app/api/rpc/route.ts.

import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';

export type SuiNetwork = 'testnet' | 'mainnet' | 'devnet';

export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as SuiNetwork;

/** The shared system Clock object — argument to every time-gated Move call. */
export const CLOCK_ID = '0x6';

/** Keepra Move package id (testnet). Set via NEXT_PUBLIC_KEEPRA_PACKAGE_ID. */
export const KEEPRA_PKG = process.env.NEXT_PUBLIC_KEEPRA_PACKAGE_ID ?? '';

/** Direct public-fullnode fallback (used during SSR / if the proxy is bypassed). */
const PUBLIC_FULLNODE =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443';

/**
 * Browser → same-origin Tatum proxy; server → public fullnode (a relative URL
 * cannot be fetched outside the browser).
 */
export function rpcUrl(): string {
  return typeof window !== 'undefined' ? '/api/rpc' : PUBLIC_FULLNODE;
}

export function makeSuiClient(): SuiJsonRpcClient {
  return new SuiJsonRpcClient({
    network: SUI_NETWORK,
    transport: new JsonRpcHTTPTransport({ url: rpcUrl() }),
  });
}

/** Singleton for non-React contexts (lib/seal, lib/ptb build steps). */
export const suiClient: SuiJsonRpcClient = makeSuiClient();

export function isPackageConfigured(): boolean {
  return /^0x[0-9a-fA-F]{2,}$/.test(KEEPRA_PKG);
}
