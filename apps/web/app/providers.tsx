'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Toaster } from 'sonner';

import '@mysten/dapp-kit/dist/index.css';
import { SUI_NETWORK, rpcUrl } from '@/lib/sui';

const { networkConfig } = createNetworkConfig({
  testnet: { network: 'testnet', url: 'https://fullnode.testnet.sui.io:443' },
  mainnet: { network: 'mainnet', url: 'https://fullnode.mainnet.sui.io:443' },
  devnet: { network: 'devnet', url: 'https://fullnode.devnet.sui.io:443' },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networkConfig}
        defaultNetwork={SUI_NETWORK}
        createClient={() =>
          new SuiJsonRpcClient({
            network: SUI_NETWORK,
            transport: new JsonRpcHTTPTransport({ url: rpcUrl() }),
          })
        }
      >
        <WalletProvider autoConnect>
          {children}
          <Toaster theme="light" position="bottom-right" richColors closeButton />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
