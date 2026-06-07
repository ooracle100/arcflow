import { apiFetch, formatToken, formatDate } from '../app.js';

export async function render() {
  try {
    const [stats, paymentsRes] = await Promise.all([
      apiFetch('/api/stats'),
      apiFetch('/api/payments?limit=20')
    ]);

    const payments = paymentsRes.payments || [];

    // Render SVG Bar Chart
    const maxVol = Math.max(...stats.dailyVolume.map((d: any) => parseFloat(d.volume)), 0.01);
    const chartHtml = stats.dailyVolume.slice(0, 30).reverse().map((d: any, i: number) => {
      const height = (parseFloat(d.volume) / maxVol) * 100;
      return `<rect x="${i * (100 / 30)}%" y="${100 - height}%" width="2%" height="${height}%" fill="var(--accent-main)" opacity="0.8">
        <title>${d.date}: ${formatToken(d.volume)} USDC</title>
      </rect>`;
    }).join('');

    return `
      <div class="screen-header">
        <h1>Live Feed</h1>
        <p>Real-time ArcFlow settlement monitoring.</p>
      </div>

      <!-- Stat Cards -->
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-label">Total Volume</div>
          <div class="stat-value">${formatToken(stats.totalVolume)} <span style="font-size:14px;color:var(--text-muted)">USDC</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Transactions</div>
          <div class="stat-value">${stats.txCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Fees Earned</div>
          <div class="stat-value" style="color: var(--accent-main)">${formatToken(stats.feesEarned)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Agents</div>
          <div class="stat-value">${stats.topAgents.length}</div>
        </div>
      </div>

      <div class="grid-3">
        <!-- Main Feed Column -->
        <div style="grid-column: span 2;">
          <div class="card" style="margin-bottom: 24px;">
            <h2>30-Day Volume</h2>
            <svg class="chart-container" width="100%" height="200" style="overflow:visible">
              ${chartHtml || '<text x="50%" y="50%" fill="var(--text-muted)" text-anchor="middle">No data yet</text>'}
            </svg>
          </div>

          <div class="card table-container">
            <h2>Recent Settlements</h2>
            ${payments.length === 0 ? '<p style="color:var(--text-muted)">No payments yet.</p>' : `
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Amount (USDC)</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map((p: any) => `
                  <tr>
                    <td><span class="code-string">${p.agent_wallet.slice(0, 8)}...</span></td>
                    <td style="color:var(--accent-main)">${formatToken(p.amount)}</td>
                    <td>${p.method} ${p.endpoint}</td>
                    <td>
                      <span class="badge ${p.status === 'SETTLED' ? 'success' : 'warning'}">
                        ${p.status}
                      </span>
                    </td>
                    <td>${formatDate(p.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>
        </div>

        <!-- Sidebar Column -->
        <div>
          <div class="card table-container">
            <h2>Top Agents</h2>
            ${stats.topAgents.length === 0 ? '<p style="color:var(--text-muted)">No data</p>' : `
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Vol</th>
                </tr>
              </thead>
              <tbody>
                ${stats.topAgents.map((a: any) => `
                  <tr>
                    <td><span class="code-string" title="${a.wallet}">${a.wallet.slice(0, 8)}...</span></td>
                    <td>${formatToken(a.total_spent)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    return `<div class="card"><p style="color:var(--accent-warning)">Failed to load data: ${String(err)}</p></div>`;
  }
}
