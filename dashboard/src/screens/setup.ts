export async function render() {
  return `
    <div class="screen-header">
      <h1>Dashboard Setup</h1>
      <p>Configure your agents to route payments through ArcFlow.</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>1. Install SDK</h2>
        <p style="margin-bottom: 16px; color: var(--text-muted);">Install the ArcFlow client library in your agent project.</p>
        <pre><code>npm install @getarcflow/client</code></pre>
      </div>

      <div class="card">
        <h2>2. Configure Middleware</h2>
        <p style="margin-bottom: 16px; color: var(--text-muted);">Wrap your API endpoints to enforce cryptographic payment verification.</p>
        <pre><span class="code-highlight">import</span> { withArcFlow } <span class="code-highlight">from</span> <span class="code-string">'@getarcflow/middleware'</span>;

app.post(<span class="code-string">'/api/generate'</span>, <span class="code-highlight">withArcFlow</span>(0.5), async (req, res) => {
  <span class="code-muted">// This code only runs if payment is verified</span>
  res.json({ result: 'Success' });
});</pre>
      </div>
    </div>

    <div class="card">
      <h2>EIP-712 Verification Example</h2>
      <p style="margin-bottom: 16px; color: var(--text-muted);">This is how the middleware validates the payment signature against the blockchain configuration.</p>
      <pre>{
  <span class="code-string">"domain"</span>: {
    <span class="code-string">"name"</span>: "ArcFlow",
    <span class="code-string">"version"</span>: "1",
    <span class="code-string">"chainId"</span>: 5042002,
    <span class="code-string">"verifyingContract"</span>: "0x..."
  },
  <span class="code-string">"message"</span>: {
    <span class="code-string">"agent"</span>: "0x...",
    <span class="code-string">"amount"</span>: "0.5",
    <span class="code-string">"endpoint"</span>: "/api/generate",
    <span class="code-string">"nonce"</span>: 1718223400000
  }
}</pre>
    </div>
  `;
}
