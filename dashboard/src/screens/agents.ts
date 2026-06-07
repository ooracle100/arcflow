import { apiFetch, formatToken, formatDate } from '../app.js';

export async function render() {
  try {
    const data = await apiFetch('/api/agents');
    const agents = data.agents || [];

    // Attach global click handler for agent rows
    if (!(window as any)._agentsAttached) {
      (window as any).loadAgentDetails = async (wallet: string) => {
        const row = document.getElementById(`agent-details-${wallet}`);
        if (!row) return;

        // Toggle visibility if already loaded
        if (row.style.display === 'table-row') {
          row.style.display = 'none';
          return;
        }

        row.style.display = 'table-row';
        const container = document.getElementById(`details-content-${wallet}`);
        if (container) container.innerHTML = '<p style="color:var(--text-muted)">Loading...</p>';

        try {
          const details = await apiFetch(`/api/agents/${wallet}`);
          const payments = details.payments || [];
          
          // Calculate average to find anomalies
          const avg = parseFloat(details.agent.total_spent) / details.agent.tx_count;

          if (container) {
            container.innerHTML = `
              <div style="padding: 16px; background: #000; border-radius: 4px; margin: 8px 0;">
                <h4 style="margin-bottom: 12px; color: var(--text-muted)">Recent Payments</h4>
                ${payments.length === 0 ? '<p>No payments</p>' : `
                  <table style="background: transparent;">
                    <thead>
                      <tr>
                        <th>Ref</th>
                        <th>Amount</th>
                        <th>Endpoint</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${payments.map((p: any) => {
                        const amt = parseFloat(p.amount);
                        const isAnomaly = amt > (avg * 2) && amt > 0.1;
                        return `
                          <tr>
                            <td><span class="code-string">${p.af_ref}</span></td>
                            <td>
                              ${formatToken(p.amount)} 
                              ${isAnomaly ? '<span class="badge warning" style="margin-left:8px">High Value</span>' : ''}
                            </td>
                            <td>${p.method} ${p.endpoint}</td>
                            <td>${formatDate(p.created_at)}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                `}
              </div>
            `;
          }
        } catch (err) {
          if (container) container.innerHTML = `<p style="color:var(--accent-warning)">Error loading details</p>`;
        }
      };
      (window as any)._agentsAttached = true;
    }

    return `
      <div class="screen-header">
        <h1>Agents</h1>
        <p>Monitor autonomous agents spending USDC on your APIs.</p>
      </div>

      <div class="card table-container">
        <h2>Active Agents</h2>
        ${agents.length === 0 ? '<p style="color:var(--text-muted)">No agents have interacted yet.</p>' : `
        <table>
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Total Spent (USDC)</th>
              <th>Tx Count</th>
              <th>First Seen</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            ${agents.map((a: any) => `
              <tr style="cursor: pointer;" onclick="loadAgentDetails('${a.wallet}')">
                <td><span class="code-string">${a.wallet}</span></td>
                <td>${formatToken(a.total_spent)}</td>
                <td>${a.tx_count}</td>
                <td>${formatDate(a.first_seen)}</td>
                <td>${formatDate(a.last_seen)}</td>
              </tr>
              <tr id="agent-details-${a.wallet}" style="display: none; background: transparent;">
                <td colspan="5" style="padding: 0 16px 16px 16px; border: none;">
                  <div id="details-content-${a.wallet}"></div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    `;
  } catch (err) {
    return `<div class="card"><p style="color:var(--accent-warning)">Failed to load data: ${String(err)}</p></div>`;
  }
}
