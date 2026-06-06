// Same-origin JSON-RPC proxy → Tatum's Sui gateway (hackathon requirement).
// The Tatum API key stays server-side. If no key is configured we transparently
// fall back to the public fullnode so the app still works in local dev.

import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TATUM_KEY = process.env.TATUM_API_KEY ?? '';
const TATUM_URL = process.env.TATUM_SUI_RPC_URL ?? 'https://sui-testnet.gateway.tatum.io';
const FALLBACK_URL = process.env.SUI_RPC_FALLBACK_URL ?? 'https://fullnode.testnet.sui.io:443';

async function forward(url: string, body: string, withKey: boolean): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (withKey && TATUM_KEY) headers['x-api-key'] = TATUM_KEY;
  return fetch(url, { method: 'POST', headers, body });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const useTatum = TATUM_KEY.length > 0;

  try {
    const upstream = await forward(useTatum ? TATUM_URL : FALLBACK_URL, body, useTatum);
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    // Tatum hiccup on demo day → degrade gracefully to the public fullnode.
    try {
      const fallback = await forward(FALLBACK_URL, body, false);
      const text = await fallback.text();
      return new Response(text, {
        status: fallback.status,
        headers: { 'content-type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'rpc_proxy_unreachable', detail: String(e) }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }
  }
}
