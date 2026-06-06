import { apiFetch, formatToken, formatDate } from '../app.js';

export async function render() {
  try {
    const data = await apiFetch('/api/reconcile');
    const { unmatched, total, matched, matchRate } = data;

    // Attach global form handler if not already present
    if (!(window as any)._reconcileAttached) {
      (window as any).submitReconcile = async (event: Event) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        const btn = form.querySelector('button');
        const af_ref = (form.querySelector('[name=af_ref]') as HTMLInputElement).value;
        const invoice_ref = (form.querySelector('[name=invoice_ref]') as HTMLInputElement).value;

        if (btn) btn.disabled = true;
        try {
          await apiFetch('/api/reconcile/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ af_ref, invoice_ref })
          });
          // Trigger refresh
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (err) {
          alert('Failed to match: ' + String(err));
          if (btn) btn.disabled = false;
        }
      };
      (window as any)._reconcileAttached = true;
    }

    return `
      <div class="screen-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h1>Reconciliation</h1>
          <p>Match on-chain ArcFlow settlements with your internal billing invoices.</p>
        </div>
        <a href="http://localhost:3000/api/export/csv" target="_blank" class="btn primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export CSV
        </a>
      </div>

      <div class="grid-3" style="margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-label">Match Rate</div>
          <div class="stat-value" style="color: ${matchRate === 100 ? 'var(--accent-main)' : 'var(--accent-warning)'}">${matchRate}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Unmatched Payments</div>
          <div class="stat-value">${unmatched.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Processed</div>
          <div class="stat-value">${total}</div>
        </div>
      </div>

      <div class="grid-3">
        <!-- Unmatched Table -->
        <div class="card table-container" style="grid-column: span 2;">
          <h2>Requires Attention (${unmatched.length})</h2>
          ${unmatched.length === 0 ? '<p style="color:var(--text-muted)">All payments are reconciled!</p>' : `
          <table>
            <thead>
              <tr>
                <th>ArcFlow Ref</th>
                <th>Amount</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${unmatched.map((p: any) => `
                <tr>
                  <td><span class="code-string" style="cursor:pointer" onclick="document.getElementById('af_ref_input').value='${p.af_ref}'">${p.af_ref}</span></td>
                  <td>${formatToken(p.amount)} ARC</td>
                  <td>${formatDate(p.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          `}
        </div>

        <!-- Manual Match Form -->
        <div class="card">
          <h2>Manual Match</h2>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
            Link an ArcFlow payment reference to your internal invoice ID.
          </p>
          <form onsubmit="submitReconcile(event)">
            <div style="margin-bottom: 16px;">
              <label style="display:block; margin-bottom:8px; font-size:13px; color:var(--text-muted)">ArcFlow Ref</label>
              <input type="text" id="af_ref_input" name="af_ref" placeholder="AF-..." required>
            </div>
            <div style="margin-bottom: 24px;">
              <label style="display:block; margin-bottom:8px; font-size:13px; color:var(--text-muted)">Invoice Ref</label>
              <input type="text" name="invoice_ref" placeholder="INV-..." required>
            </div>
            <button type="submit" class="btn primary" style="width:100%">Confirm Match</button>
          </form>
        </div>
      </div>
    `;
  } catch (err) {
    return `<div class="card"><p style="color:var(--accent-warning)">Failed to load data: ${String(err)}</p></div>`;
  }
}
