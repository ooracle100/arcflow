// config.ts — Configuration schema and validation for ArcFlow middleware
// Ensures all developer-supplied parameters are valid before handling traffic.

export interface ArcFlowMiddlewareConfig {
  /**
   * Price in USDC per API call (e.g. '0.05' or '1.00').
   * Must be a string to avoid IEEE 754 precision issues.
   */
  price: string;

  /**
   * The seller's Arc wallet address to receive payments (hex string).
   */
  wallet: string;

  /**
   * The seller's ArcFlow API key (obtained from the dashboard).
   * Used to authenticate logs and webhooks with the SaaS backend.
   */
  apiKey: string;

  /**
   * Optional URL of the ArcFlow SaaS backend.
   * Defaults to http://localhost:3000 or process.env.ARCFLOW_BACKEND_URL.
   */
  backendUrl?: string;

  /**
   * The EVM Chain ID. Use 5042002 for Arc Testnet, or the appropriate ID for Arc Mainnet.
   * Defaults to 5042002 (Testnet) if omitted to prevent accidental live spending.
   */
  chainId?: number;

  /**
   * Optional custom description of the resource shown in the 402 challenge.
   */
  description?: string;
}

/**
 * Validate middleware configuration at setup time.
 * Throws a detailed error if any parameters are incorrect.
 */
export function validateConfig(config: ArcFlowMiddlewareConfig): void {
  if (!config) {
    throw new Error('[ArcFlow] Configuration object is missing');
  }

  // 1. Validate price
  if (typeof config.price !== 'string') {
    throw new Error('[ArcFlow] price must be a string (e.g., "0.05")');
  }
  const parsedPrice = parseFloat(config.price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    throw new Error(`[ArcFlow] invalid price value: "${config.price}". Must be a positive decimal string.`);
  }

  // 2. Validate wallet address
  if (typeof config.wallet !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(config.wallet)) {
    throw new Error(`[ArcFlow] invalid wallet address: "${config.wallet}". Must be a valid 40-character hex string starting with 0x.`);
  }

  // 3. Validate apiKey
  if (typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
    throw new Error('[ArcFlow] apiKey is missing or empty');
  }

  // 4. Validate backendUrl if provided
  if (config.backendUrl) {
    try {
      new URL(config.backendUrl);
    } catch {
      throw new Error(`[ArcFlow] invalid backendUrl format: "${config.backendUrl}"`);
    }
  }
}
