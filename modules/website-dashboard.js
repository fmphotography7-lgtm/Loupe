/* StudioFlow 3.9.0 · Website Dashboard (native) -- replaces the old iframe page, which computed
   its metrics from a separate, stale sales database that had nothing to do with real StudioFlow
   data. This reads the real thing: pending Website Updates, Product Health, and the few things
   that actually belong to "website decisions" now that Sales & Orders and Products & Inventory
   own their own pieces. */
window.SFWebsiteDashboard = {
  // Which update actions can actually be applied automatically via API right now. g70 built the
  // product-create surface, so ADD_PRODUCT is no longer the odd one out -- new pieces are created
  // (hidden) through the API like everything else.
  automatable: ['UPDATE_PRICE', 'REMOVE_VARIANT', 'RESTORE_VARIANT', 'UPDATE_INVENTORY', 'ADD_VARIANT', 'ADD_PRODUCT'],

  render(){
    const sf = window.SF;
    window.SFWebsiteUpdates?.ensure?.();
    const pending = (sf.state.websiteUpdates || []).filter(u => u.status === 'Pending');
    const autoReady = pending.filter(u => this.automatable.includes(u.action));
    const manualNeeded = pending.filter(u => !this.automatable.includes(u.action));
    const health = window.SFProductHealth ? window.SFProductHealth.findings() : { total: 0 };
    const sq = sf.state.squarespace || {};

    const updateRow = u => `<div class="commerce-row"><span><input type="checkbox" class="wu-check" data-wu-id="${u.id}" checked></span><span><b>${sf.esc(u.productName || 'Website item')}</b><small>${sf.esc(u.action.replace('_', ' '))}</small></span><span>${sf.esc(u.previousValue ?? '')} → ${sf.esc(u.requestedValue ?? '')}</span></div>`;

    sf.$('workspace').innerHTML = `<div class="page-stack">
      <section class="dashboard-hero"><div><div class="section-kicker">WEBSITE</div><h2>Website Dashboard</h2><p class="muted">Squarespace ${sq.connectionStatus === 'Connected' ? '✓ Connected' : '-- not connected'}${sq.lastProductSync ? ` · Products last synced ${new Date(sq.lastProductSync).toLocaleString()}` : ''}</p></div></section>

      <div class="commerce-kpis"><div><b>${pending.length}</b><span>Pending updates</span></div><div><b>${health.total}</b><span>Product Health findings</span></div><div><b>${autoReady.length}</b><span>Ready to auto-apply</span></div></div>

      <section class="card">
        <div class="commerce-toolbar"><div><h3>Approve Updates</h3><p class="muted">Ticked items apply directly to your live Squarespace store when you confirm below -- no CSV, no manual export.</p></div>${autoReady.length ? `<button class="button primary" id="applyChecked">Apply Checked (${autoReady.length})</button>` : ''}</div>
        ${autoReady.length ? `<div class="commerce-table">${autoReady.map(updateRow).join('')}</div>` : '<div class="empty-state roomy">Nothing waiting for approval.</div>'}
        ${manualNeeded.length ? `<div class="notice"><b>${manualNeeded.length}</b> item(s) need a manual step on Squarespace's side first (new product creation isn't automated yet) -- ${manualNeeded.map(u => sf.esc(u.productName || 'item')).join(', ')}.</div>` : ''}
      </section>

      <section class="card">
        <div class="commerce-toolbar"><div><h3>Product Health</h3><p class="muted">${health.total ? `${health.total} finding(s) -- open Product Health to review and fix.` : 'No issues found.'}</p></div><button class="button secondary" id="openHealth">Open Product Health</button></div>
      </section>

      <section class="card">
        <h3>Quick Actions</h3>
        <div class="row-actions"><button class="button secondary" id="createProduct">＋ Create New Product</button><button class="button secondary" id="openGalleries">Open Galleries</button><button class="button secondary" id="openPricing">Open Pricing</button></div>
      </section>
    </div>`;

    sf.$('applyChecked') && (sf.$('applyChecked').onclick = () => this.applyChecked(autoReady));
    sf.$('openHealth').onclick = () => sf.goTo('Product Health');
    sf.$('createProduct').onclick = () => { sf.goTo('Galleries'); setTimeout(() => window.SFGalleries?.openNewArtwork(), 50); };
    sf.$('openGalleries').onclick = () => sf.goTo('Galleries');
    sf.$('openPricing').onclick = () => sf.goTo('Pricing');
  },

  async applyChecked(autoReady){
    const sf = window.SF;
    const checked = [...document.querySelectorAll('.wu-check:checked')].map(c => c.dataset.wuId);
    const items = autoReady.filter(u => checked.includes(u.id));
    if (!items.length) return alert('Nothing is checked.');
    if (!confirm(`Apply ${items.length} update(s) to your live Squarespace store now?\n\n${items.map(u => `${u.productName}: ${u.previousValue} → ${u.requestedValue}`).join('\n')}\n\nThis makes live changes to the connected store.`)) return;
    let ok = 0, failed = 0;
    for (const u of items) {
      await window.SFWebsiteUpdates.applyUpdate(u.id, true); // skipConfirm -- already confirmed once, above, for the whole batch
      if (u.status === 'Applied') ok++; else if (u.status === 'Failed') failed++;
    }
    sf.logActivity(`Bulk-applied ${ok} website update(s) from Website Dashboard${failed ? `, ${failed} failed` : ''}`);
    alert(`${ok} applied.${failed ? ` ${failed} failed -- check Website Updates for details.` : ''}`);
    this.render();
  },
};

/* StudioFlow g138 — THE FREE TOOL COUNT, WHERE HE LOOKS FOR NUMBERS.
   ==================================================================
   Kirk asked whether Loupe downloads would appear in his StudioFlow analytics. They cannot: those
   are Google Analytics, which only sees what happens ON his pages — the moment someone clicks a
   button pointing at github.com they have left, and the download happens on GitHub's servers.

   But he thinks of analytics as one screen, and he is right to. So the GitHub count is shown here
   beside the visitor figures rather than buried on the export page. It is a DIFFERENT number from a
   DIFFERENT source, and the card says so instead of letting the two blur together. */
(function(){
  const D = window.SFWebsiteDashboard;
  if (!D || !D.render) return;

  D.toolCounts = async function(){
    const sf = window.SF;
    const gh = (sf.state.websiteExport || {}).github || {};
    if (!gh.owner || !gh.repo) return null;
    try {
      return await window.studioflow.githubReleaseStats({ owner: gh.owner, repo: gh.repo });
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const origRender = D.render;
  D.render = function(){
    const out = origRender.apply(this, arguments);
    try {
      const sf = window.SF;
      const gh = (sf.state.websiteExport || {}).github || {};
      const stack = document.querySelector('.page-stack');
      if (!stack || document.getElementById('wdTools')) return out;

      const card = document.createElement('section');
      card.className = 'card';
      card.id = 'wdTools';
      card.innerHTML = `<div class="toolbar"><div><h3 style="margin:0">Free tool downloads</h3>
        <p class="muted">Counted by GitHub, so this covers your Squarespace site and the new one
        together. It is a separate figure from the visitor numbers above, which come from Google
        Analytics and cannot see a download that happens on GitHub's servers.</p></div>
        ${gh.owner && gh.repo ? '<button class="button secondary" id="wdToolsCheck">Check now</button>' : ''}</div>
        <div id="wdToolsBody" class="help">${gh.owner && gh.repo
          ? `Reading ${sf.esc(gh.owner)}/${sf.esc(gh.repo)}\u2026`
          : 'Set the GitHub owner and repository on the Website Export page, under Free tools, and the count appears here.'}</div>`;
      stack.appendChild(card);

      const paint = async () => {
        const body = document.getElementById('wdToolsBody');
        if (!body) return;
        const r = await D.toolCounts();
        if (!r) return;
        if (!r.ok) { body.innerHTML = `<b>Couldn't check:</b> ${sf.esc(r.error || 'no answer')}`; return; }
        if (!r.assets.length) { body.textContent = 'No downloadable files attached to a release yet.'; return; }
        body.innerHTML = `<div class="stat-row"><b style="font-size:1.6rem">${r.total}</b>
          <span class="muted">download(s) in total</span></div>
          <ul style="margin:6px 0 0">${r.assets.map(a =>
            `<li>${sf.esc(a.name)} \u2014 <b>${a.count}</b></li>`).join('')}</ul>`;
      };
      if (gh.owner && gh.repo) {
        paint();
        const btn = document.getElementById('wdToolsCheck');
        if (btn) btn.onclick = paint;
      }
    } catch (error) {
      /* A count is a nicety; it must never cost him the dashboard. */
      console.warn('Free tool downloads card could not be added:', error);
    }
    return out;
  };
})();
