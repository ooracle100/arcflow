// engine.ts — 3-tier fee engine for ArcFlow platform volume
// Dynamically adjusts platform fees based on cumulative volume processed.

import { getDb } from '../db/schema.js';

export const TIERS = {
  FREE:   { limit: 10000,   rate: 0 },       // $0 - $10,000 -> 0%
  GROWTH: { limit: 500000,  rate: 0.005 },   // $10,000 - $500,000 -> 0.5%
  SCALE:  { limit: Infinity, rate: 0.0025 },  // Over $500,000 -> 0.25%
} as const;

/**
 * Calculates the total historical volume processed on the platform in USDC.
 * Utilizes safe CAST in SQLite.
 *
 * @returns Total volume as a number
 */
export function getTotalVolumeProcessed(): number {
  const db = getDb();
  try {
    const row = db.prepare('SELECT SUM(CAST(amount AS REAL)) as total FROM payments').get() as { total: number | null };
    return row.total ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Calculates the platform fee for a specific transaction amount.
 * Applies 3-tier progressive fee rates based on cumulative platform volume.
 *
 * @param amountDecimal - USDC payment amount as decimal string (e.g. "0.05")
 * @returns Platform fee as decimal string rounded to 6 decimal places (USDC atomic unit precision)
 */
export function calculateArcFlowFee(amountDecimal: string): string {
  const totalVolume = getTotalVolumeProcessed();
  const amount = parseFloat(amountDecimal);
  
  let rate = 0;
  if (totalVolume >= TIERS.FREE.limit && totalVolume < TIERS.GROWTH.limit) {
    rate = TIERS.GROWTH.rate;
  } else if (totalVolume >= TIERS.GROWTH.limit) {
    rate = TIERS.SCALE.rate;
  } else {
    rate = TIERS.FREE.rate;
  }

  const fee = amount * rate;
  return fee.toFixed(6);
}
