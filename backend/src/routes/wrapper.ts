// wrapper.ts — Standard ArcFlow API response wrapper
// Every endpoint uses these helpers for consistent JSON output.

import { Response } from 'express';

/**
 * Sends a successful API response with the standard meta block.
 */
export function apiResponse(res: Response, data: any, block?: number): void {
  res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      block: block ?? 0,
      cached: false,
      version: '1.0',
    },
  });
}

/**
 * Sends a structured error response.
 */
export function apiError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, any>
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}
