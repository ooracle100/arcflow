import { apiFetch, formatToken } from '../app.js';

export async function render() {
  try {
    const stats = await apiFetch('/api/stats');
    const totalVolume = parseFloat(stats.totalVolume || '0');
    
    // Tier Logic based on USDC volume
    let currentTier = 'Free';
    let nextThreshold = 1000;
    let progress = 0;
    let feeRate = '0%';

    if (totalVolume < 1000) {
      currentTier = 'Free';
      nextThreshold = 1000;
      progress = (totalVolume / 1000) * 100;
      feeRate = '0%';
    } else if (totalVolume < 10000) {
      currentTier = 'Growth';
      nextThreshold = 10000;
      progress = (totalVolume / 10000) * 100;
      feeRate = '1%';
    } else {
      currentTier = 'Scale';
      nextThreshold = totalVolume; // Max tier
      progress = 100;
      feeRate = '0.5%';
    }

    return `
      <div class="screen-header">
        <h1>Billing & Tiers</h1>
        <p>Your current ArcFlow pricing tier based on total processed volume.</p>
      </div>

      <div class="grid-2" style="margin-bottom: 24px;">
        <div class="card" style="margin-bottom: 0;">
          <h2>Current Status</h2>
          <div style="font-size: 32px; font-weight: 500; margin-bottom: 8px;">
            <span style="color: var(--accent-main)">${currentTier} Tier</span>
          </div>
          <p style="color: var(--text-muted); margin-bottom: 24px;">Current Fee Rate: <span style="color:var(--text-main)">${feeRate}</span></p>

          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span>${formatToken(totalVolume)} USDC processed</span>
            <span style="color: var(--text-muted)">${currentTier === 'Scale' ? 'Max Tier' : `Next tier at ${nextThreshold} USDC`}</span>
          </div>
          
          <div class="progress-container">
            <div class="progress-bar" style="width: ${progress}%"></div>
          </div>
        </div>

        <div class="stat-card" style="display: flex; flex-direction: column; justify-content: center;">
          <div class="stat-label">Total ArcFlow Fees Deducted</div>
          <div class="stat-value" style="color: var(--accent-warning); font-size: 48px;">
            ${formatToken(stats.feesEarned)} <span style="font-size: 16px; color: var(--text-muted);">USDC</span>
          </div>
          <p style="color: var(--text-muted); font-size: 13px; margin-top: 8px;">
            Fees are deducted automatically on settlement.
          </p>
        </div>
      </div>

      <div class="card table-container">
        <h2>Tier Structure</h2>
        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Volume Requirement</th>
              <th>Fee Rate</th>
              <th>Features</th>
            </tr>
          </thead>
          <tbody>
            <tr style="${currentTier === 'Free' ? 'background: rgba(0,255,136,0.05)' : ''}">
              <td><span class="badge ${currentTier === 'Free' ? 'success' : 'info'}">Free</span></td>
              <td>0 - 1,000 USDC</td>
              <td>0%</td>
              <td>Core API, Dashboard</td>
            </tr>
            <tr style="${currentTier === 'Growth' ? 'background: rgba(0,255,136,0.05)' : ''}">
              <td><span class="badge ${currentTier === 'Growth' ? 'success' : 'info'}">Growth</span></td>
              <td>1,000 - 10,000 USDC</td>
              <td>1%</td>
              <td>+ Priority Support</td>
            </tr>
            <tr style="${currentTier === 'Scale' ? 'background: rgba(0,255,136,0.05)' : ''}">
              <td><span class="badge ${currentTier === 'Scale' ? 'success' : 'info'}">Scale</span></td>
              <td>10,000+ USDC</td>
              <td>0.5%</td>
              <td>+ Dedicated Node</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    return `<div class="card"><p style="color:var(--accent-warning)">Failed to load data: ${String(err)}</p></div>`;
  }
}
