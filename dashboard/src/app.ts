// app.ts — Application Shell and Router
import { render as renderMonitor } from './screens/monitor.js';
import { render as renderReconcile } from './screens/reconcile.js';
import { render as renderAgents } from './screens/agents.js';
import { render as renderBilling } from './screens/billing.js';
import { render as renderSetup } from './screens/setup.js';

// Global state
let currentRefreshInterval: number | null = null;

// Helper: Format amounts to 6 decimals
export const formatToken = (amount: string | number) => {
  return Number(amount).toFixed(6);
};

// Helper: Format dates
export const formatDate = (isoStr: string) => {
  return new Date(isoStr).toLocaleString();
};

// Helper: API Fetch with unified error handling
export async function apiFetch(path: string, options?: RequestInit) {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    const res = await fetch(`${backendUrl}${path}`, options);
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'API Error');
    }
    return json.data;
  } catch (err) {
    console.error(`API Error for ${path}:`, err);
    throw err;
  }
}

// Router
async function navigate() {
  const hash = window.location.hash || '#monitor';
  const appEl = document.getElementById('app');
  if (!appEl) return;

  // Clear previous auto-refresh
  if (currentRefreshInterval) {
    clearInterval(currentRefreshInterval);
  }

  // Update sidebar active state
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.remove('active');
    if (a.getAttribute('href') === hash) {
      a.classList.add('active');
    }
  });

  // Render logic
  try {
    const renderScreen = async () => {
      let html = '';
      switch (hash) {
        case '#setup': html = await renderSetup(); break;
        case '#reconcile': html = await renderReconcile(); break;
        case '#agents': html = await renderAgents(); break;
        case '#billing': html = await renderBilling(); break;
        case '#monitor':
        default:
          html = await renderMonitor(); break;
      }
      appEl.innerHTML = html;
    };

    // Initial render
    await renderScreen();

    // Setup auto-refresh for live data (every 10s)
    if (['#monitor', '#agents'].includes(hash)) {
      currentRefreshInterval = setInterval(renderScreen, 10000) as any;
    }

  } catch (err) {
    appEl.innerHTML = `
      <div class="screen-header">
        <h1>Connection Error</h1>
        <p>Failed to load dashboard data. Is the backend running on port 3000?</p>
      </div>
      <pre>${String(err)}</pre>
    `;
  }
}

// Boot
window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);

// Background health check polling for the sidebar dot
setInterval(async () => {
  const dot = document.querySelector('.status-indicator .dot');
  const text = document.getElementById('backend-status');
  try {
    const health = await apiFetch('/health');
    if (dot && text) {
      dot.className = 'dot online pulse';
      text.textContent = `Block ${health.arc.latestBlock} (${health.clock.offsetMs}ms sync)`;
    }
  } catch (e) {
    if (dot && text) {
      dot.className = 'dot offline pulse';
      text.textContent = 'Disconnected';
    }
  }
}, 5000);
