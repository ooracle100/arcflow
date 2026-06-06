// gateway.ts — Circle Gateway deposit abstraction (simplified funding flow)
// Handles balance checks, USDC approvals, and Gateway Wallet deposits on Arc testnet.

import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  parseUnits,
  getAddress,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

// Arc testnet chain definition matching the master brief
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

export const ARC_CONSTANTS = {
  USDC: '0x3600000000000000000000000000000000000000' as `0x${string}`,
  GATEWAY_WALLET: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`,
};

const GATEWAY_WALLET_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export class ArcFlowGateway {
  private account: Account;
  publicClient: PublicClient;
  walletClient: WalletClient;

  constructor(privateKey: Hex, rpcUrl = 'https://rpc.testnet.arc.network') {
    this.account = privateKeyToAccount(privateKey);
    const transport = http(rpcUrl);
    
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport,
    });
    
    this.walletClient = createWalletClient({
      account: this.account,
      chain: arcTestnet,
      transport,
    });
  }

  get address(): `0x${string}` {
    return this.account.address;
  }

  /**
   * Get USDC balance of the account (on-chain balance, not gateway).
   */
  async getUsdcBalance(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: ARC_CONSTANTS.USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [this.account.address],
    });
  }

  /**
   * Approves the Gateway Wallet to spend USDC.
   */
  async approveGateway(amountUsdc: string): Promise<Hex> {
    const atomicAmount = parseUnits(amountUsdc, 6);
    
    const hash = await this.walletClient.writeContract({
      chain: arcTestnet,
      account: this.walletClient.account!,
      address: ARC_CONSTANTS.USDC,
      abi: erc20Abi,
      functionName: 'approve',
      args: [ARC_CONSTANTS.GATEWAY_WALLET, atomicAmount],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  /**
   * Deposits USDC into the Gateway Wallet.
   * If current allowance is less than amount, performs approval first.
   */
  async deposit(amountUsdc: string): Promise<Hex> {
    const atomicAmount = parseUnits(amountUsdc, 6);

    // 1. Approve if allowance is insufficient
    const allowance = await this.publicClient.readContract({
      address: ARC_CONSTANTS.USDC,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [this.account.address, ARC_CONSTANTS.GATEWAY_WALLET],
    });

    if (allowance < atomicAmount) {
      await this.approveGateway(amountUsdc);
    }

    // 2. Call deposit on Gateway Wallet
    const hash = await this.walletClient.writeContract({
      chain: arcTestnet,
      account: this.walletClient.account!,
      address: ARC_CONSTANTS.GATEWAY_WALLET,
      abi: GATEWAY_WALLET_ABI,
      functionName: 'deposit',
      args: [ARC_CONSTANTS.USDC, atomicAmount],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
}
