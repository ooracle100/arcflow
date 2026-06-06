// export.ts — CSV export API route
// GET /api/export/csv

import { Router, Request, Response } from 'express';
import { getPaymentsByDateRange } from '../db/queries.js';
import { apiError } from './wrapper.js';

export const exportRouter = Router();

const CSV_COLUMNS = [
  'af_ref', 'e2e_id', 'tx_hash', 'onchain_memo', 'agent_wallet',
  'service_wallet', 'amount', 'token', 'endpoint', 'method',
  'status', 'reconciled', 'invoice_ref', 'arcflow_fee',
  'created_at', 'block_number', 'clock_offset_ms',
];

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── GET /api/export/csv — date-filtered CSV download ────────────────────
exportRouter.get('/api/export/csv', (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const payments = getPaymentsByDateRange(
      startDate as string | undefined,
      endDate as string | undefined
    );

    // Build CSV string
    const headerRow = CSV_COLUMNS.join(',');
    const dataRows = payments.map(p =>
      CSV_COLUMNS.map(col => escapeCSV((p as any)[col])).join(',')
    );
    const csv = [headerRow, ...dataRows].join('\n');

    // Send as downloadable file
    const filename = `arcflow-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiError(res, 500, 'EXPORT_FAILED', 'Failed to generate CSV export.', { error: msg });
  }
});
