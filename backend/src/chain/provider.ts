// provider.ts — Arc RPC connection with 3-endpoint failover
// Uses viem's createPublicClient with fallback transport.

import { createPublicClient, http, fallback, type PublicClient, defineChain } from 'viem';

// Define Arc testnet chain (matches viem/chains/definitions/arcTestnet)
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

const ARC_RPC_ENDPOINTS = [
  'https://rpc.testnet.arc.network',
  'https://rpc.quicknode.testnet.arc.network',
  'https://rpc.blockdaemon.testnet.arc.network',
];

export const arcClient: PublicClient = createPublicClient({
  chain: arcTestnet,
  transport: fallback(
    ARC_RPC_ENDPOINTS.map((url) => http(url, { timeout: 10_000 })),
    { rank: true }
  ),
}) as any;

export async function getLatestBlock() {
  const block = await arcClient.getBlock({ blockTag: 'latest' });
  return {
    number: Number(block.number),
    timestamp: Number(block.timestamp),
    hash: block.hash,
  };
}
