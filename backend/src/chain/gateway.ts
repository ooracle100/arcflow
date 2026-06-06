// gateway.ts — Circle Gateway client constants
// All addresses verified from @circle-fin/x402-batching SDK
// See DECISION_LOG.md entry 001 for verification sources.

export const ARC_CONSTANTS = {
  TESTNET: {
    CHAIN_ID: 5042002,
    NETWORK: 'eip155:5042002',
    RPC: {
      PRIMARY: 'https://rpc.testnet.arc.network',
      FALLBACK_1: 'https://rpc.quicknode.testnet.arc.network',
      FALLBACK_2: 'https://rpc.blockdaemon.testnet.arc.network',
    },
    EXPLORER: 'https://testnet.arcscan.app',
    USDC: '0x3600000000000000000000000000000000000000' as const,
    GATEWAY_WALLET: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as const,
    GATEWAY_MINTER: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B' as const,
    GATEWAY_API: 'https://gateway-api-testnet.circle.com/v1',
    GATEWAY_DOMAIN: 26,
  },
  MAINNET: {
    // TODO: Arc mainnet not yet launched. Update when Circle publishes addresses.
    // See DECISION_LOG.md entry 003.
    CHAIN_ID: null as unknown as number,
    NETWORK: null as unknown as string,
    RPC: {
      PRIMARY: null as unknown as string,
      FALLBACK_1: null as unknown as string,
      FALLBACK_2: null as unknown as string,
    },
    EXPLORER: 'https://arcscan.app',
    USDC: null as unknown as string,
    GATEWAY_WALLET: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE' as const,
    GATEWAY_MINTER: '0x2222222d7164433c4C09B0b0D809a9b52C04C205' as const,
    GATEWAY_API: 'https://gateway-api.circle.com/v1',
    GATEWAY_DOMAIN: null as unknown as number,
  },
} as const;

export type NetworkEnv = 'TESTNET' | 'MAINNET';

export function getConfig(env: NetworkEnv = 'TESTNET') {
  return ARC_CONSTANTS[env];
}
