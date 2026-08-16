/* StudioFlow g148 · PRICE WATCH
   =========================================================================================
   Kirk: "add that into business intelligence as a warning message or something on the main
   dashboard. Have something like cost of inventory has risen, it is time to raise cost of
   canvas prints."

   THE THING THAT MAKES THIS WORTH BUILDING, and which he could not have known:
   `SFMaterialsCutting.unitCost()` is a LIFETIME AVERAGE — lifetimeCost / lifetimeQty across every
   purchase ever recorded for that material. So a recipe cost, and therefore every margin figure in
   the app, is priced against what he has paid ON AVERAGE SINCE HE STARTED. When a supplier puts
   canvas up 20%, that rise is diluted by years of cheaper purchases and barely moves the number.
   The average is the right basis for valuing what is on the shelf. It is the WRONG basis for
   deciding what to charge tomorrow, and nothing in StudioFlow has ever shown the difference.

   So this compares two costs for the same product:
     average  — what recipeCost() reports today (lifetime average purchase prices)
     latest   — the same recipe costed at the MOST RECENT purchase price of every material
   and reports the gap, the margin each implies against the price he actually charges, and the
   price that would restore his target margin.

   HOW THE SECOND FIGURE IS COMPUTED, and why it is done this way: recipeCost() already knows the
   sheet-yield maths, packaging, manual yields and rotation rules. Writing a second copy of that
   walk with a different cost lookup would give two answers to one question and they would drift —
   the exact fault g145 was. Instead `unitCost` is TEMPORARILY swapped for a latest-price version,
   recipeCost() is called, and the original is restored in a finally block. One implementation, two
   inputs.

   NOTHING HERE CHANGES A PRICE. It says what it thinks and why, with both numbers on show, and
   leaves the decision where it belongs.
   ========================================================================================= */
window.SFPriceWatch = {

  DEFAULTS: { targetMargin: 0.50, riseAlert: 0.08 },

  settings(){
    const s = window.SF.state;
    if (!s.priceWatch || typeof s.priceWatch !== 'object') s.priceWatch = {};
    const p = s.priceWatch;
    if (typeof p.targetMargin !== 'number') p.targetMargin = this.DEFAULTS.targetMargin;
    if (typeof p.riseAlert !== 'number') p.riseAlert = this.DEFAULTS.riseAlert;
    return p;
  },
  money(v){ const n = Number(v) || 0; return '$' + n.toFixed(2); },
  pct(v){ return Math.round((Number(v) || 0) * 100) + '%'; },

  /* The most recent purchase price per unit for one material, or null when there is nothing to
     compare against. A single purchase means the average IS the latest — no rise to report. */
  latestUnitCost(materialId){
    const list = (window.SF.state.materialPurchases || [])
      .filter(x => String(x.materialId) === String(materialId) && Number(x.quantity) > 0)
      .sort((a, b) => String(a.date || a.createdAt || '').localeCompare(String(b.date || b.createdAt || '')));
    if (list.length < 2) return null;
    const last = list[list.length - 1];
    return Number(last.totalCost || 0) / Number(last.quantity || 1);
  },

  /* Cost this product at TODAY'S prices, reusing the one real implementation. */
  latestCost(templateId){
    const MC = window.SFMaterialsCutting;
    if (!MC || !MC.unitCost) return null;
    const original = MC.unitCost;
    let used = false;
    try {
      MC.unitCost = id => {
        const latest = this.latestUnitCost(id);
        if (latest == null) return original.call(MC, id);
        used = true;
        return latest;
      };
      const cost = MC.recipeCost(templateId);
      return used ? cost : null;          // null = no material has a newer price to compare
    } catch (e) {
      return null;
    } finally {
      MC.unitCost = original;             // ALWAYS restored, even if recipeCost throws
    }
  },

  /* One row per product that has a recipe AND a price. `concern` is what earns a warning. */
  rows(){
    const sf = window.SF, M = window.MaterialsService, cfg = this.settings();
    if (!M) return [];
    const out = [];
    (sf.state.inventoryProductTemplates || []).forEach(t => {
      if (!t || t.active === false) return;
      const price = Number(t.price) || 0;
      if (!price || !M.hasRecipe(t.id)) return;
      const average = Number(M.recipeCost(t.id)) || 0;
      if (!average) return;
      const latest = this.latestCost(t.id);
      const now = latest == null ? average : latest;
      const rise = average ? (now - average) / average : 0;
      const margin = (price - now) / price;
      const suggested = cfg.targetMargin < 1 ? now / (1 - cfg.targetMargin) : price;
      out.push({
        id: t.id, name: t.name || '(unnamed)', price, average, latest, now,
        rise, margin, marginAverage: (price - average) / price,
        suggested: Math.ceil(suggested),
        /* Two separate reasons, and the row says which applies — "your costs went up" and "this
           was never priced well enough" call for different conversations. */
        risen: latest != null && rise >= cfg.riseAlert,
        thin: margin < cfg.targetMargin,
        losing: now >= price
      });
    });
    out.sort((a, b) => (a.margin - b.margin));
    return out;
  },
  warnings(){ return this.rows().filter(r => r.risen || r.thin); },

  /* ---- the card on Business Intelligence ------------------------------------------------- */

  card(){
    const sf = window.SF, cfg = this.settings();
    const rows = this.rows(), warn = rows.filter(r => r.risen || r.thin);
    if (!rows.length) {
      return `<div class="card" id="pwCard"><h3>Prices against costs</h3>
        <p class="muted">Nothing to check yet. This compares what each product COSTS to make against
        what you charge for it, so it needs a recipe under Materials &amp; Sheet Cutting and a market
        price under Inventory &rarr; Market Pricing &amp; Deals.</p></div>`;
    }
    const row = r => `<tr class="${r.losing ? 'pw-bad' : r.thin ? 'pw-warn' : ''}">
      <td>${sf.esc(r.name)}</td>
      <td>${this.money(r.price)}</td>
      <td>${this.money(r.average)}</td>
      <td>${r.latest == null ? '<span class="muted">\u2014</span>'
        : `${this.money(r.latest)}${r.risen ? ` <b class="danger-text">+${this.pct(r.rise)}</b>` : ''}`}</td>
      <td>${this.pct(r.margin)}</td>
      <td>${r.thin ? `<b>${this.money(r.suggested)}</b>` : '<span class="muted">\u2014</span>'}</td>
    </tr>`;
    return `<div class="card" id="pwCard">
      <div class="toolbar"><div><h3 style="margin:0">Prices against costs</h3>
        <p class="muted">${warn.length
          ? `<b class="danger-text">${warn.length} product(s) need a look.</b> `
          : 'Every product is above your target margin. '}
        Materials are costed two ways: the LIFETIME AVERAGE of everything you have paid, which is what
        the rest of StudioFlow uses, and the price on your MOST RECENT purchase. When the second is
        well above the first, your prices are set against costs you no longer pay.</p></div>
        <div class="row-actions">
          <label style="display:flex;align-items:center;gap:6px">Target margin
            <input id="pwTarget" type="number" min="0" max="95" step="1" value="${Math.round(cfg.targetMargin * 100)}" style="width:68px"> %</label>
          <label style="display:flex;align-items:center;gap:6px">Warn on a rise of
            <input id="pwRise" type="number" min="1" max="100" step="1" value="${Math.round(cfg.riseAlert * 100)}" style="width:68px"> %</label>
        </div></div>
      <div class="commerce-table"><table>
        <thead><tr><th>Product</th><th>You charge</th><th>Cost (average)</th><th>Cost (latest)</th><th>Margin now</th><th>To hit target</th></tr></thead>
        <tbody>${rows.map(row).join('')}</tbody></table></div>
      <p class="help">\u201cTo hit target\u201d is the latest cost divided by your target margin, rounded up.
      It is arithmetic, not advice \u2014 what the market will pay is your call, and nothing here changes a price.</p>
    </div>`;
  },

  /* ---- the one-line warning on the Home Dashboard ---------------------------------------- */

  banner(){
    const sf = window.SF, warn = this.warnings();
    if (!warn.length) return '';
    const risen = warn.filter(r => r.risen);
    const worst = warn[0];
    /* Deliberately ONE sentence with a real number in it. g127 took the recommendations card off
       this page because the reasoning belongs where it can be read properly; the same applies
       here — this says enough to know whether to click, and no more. */
    const lead = risen.length
      ? `Materials have gone up on ${risen.length} product(s) since you set your prices.`
      : `${warn.length} product(s) are below your ${this.pct(this.settings().targetMargin)} target margin.`;
    return `<div class="card pw-banner">
      <div><b>${sf.esc(lead)}</b>
      <p class="muted" style="margin:4px 0 0">Worst is <b>${sf.esc(worst.name)}</b> at
      ${this.money(worst.price)} against ${this.money(worst.now)} of materials \u2014
      ${this.pct(worst.margin)} margin${worst.thin ? `, where ${this.money(worst.suggested)} would hit your target` : ''}.</p></div>
      <button class="button secondary" id="pwGo">Look at prices</button>
    </div>`;
  },

  bind(){
    const sf = window.SF, cfg = this.settings();
    const save = async () => { await sf.persist(); if (window.SFBusinessIntelligence) window.SFBusinessIntelligence.render(); };
    if (sf.$('pwTarget')) sf.$('pwTarget').onchange = async e => {
      cfg.targetMargin = Math.min(0.95, Math.max(0, (Number(e.target.value) || 0) / 100)); await save();
    };
    if (sf.$('pwRise')) sf.$('pwRise').onchange = async e => {
      cfg.riseAlert = Math.max(0.01, (Number(e.target.value) || 8) / 100); await save();
    };
    if (sf.$('pwGo')) sf.$('pwGo').onclick = () => sf.goTo('Business Intelligence');
  }
};

/* Attached by WRAPPING the existing renders — the same pattern intelligence.js uses — so nothing
   is cut into another module's template and removing this file restores the app exactly. Both
   wrappers are guarded: a fault in the price check must never cost him the page it sits on. */
(function(){
  const BI = window.SFBusinessIntelligence;
  if (BI) {
    const orig = BI.render;
    BI.render = function(){
      orig.call(this);
      try {
        const sf = window.SF, shell = sf.$('workspace');
        if (!shell || document.getElementById('pwCard')) return;
        const host = document.createElement('div');
        host.innerHTML = window.SFPriceWatch.card();
        (shell.firstElementChild || shell).appendChild(host.firstElementChild);
        window.SFPriceWatch.bind();
      } catch (e) { console.warn('Price watch could not be added:', e); }
    };
  }
  const D = window.SFDashboard;
  if (D) {
    const orig = D.render;
    D.render = function(){
      orig.call(this);
      try {
        const sf = window.SF, shell = sf.$('workspace');
        if (!shell || document.getElementById('pwBannerHost')) return;
        const html = window.SFPriceWatch.banner();
        if (!html) return;                       // silent when there is nothing wrong
        const host = document.createElement('div');
        host.id = 'pwBannerHost';
        host.innerHTML = html;
        const kpis = shell.querySelector('.command-kpis');
        if (kpis && kpis.parentNode) kpis.parentNode.insertBefore(host, kpis.nextSibling);
        else (shell.firstElementChild || shell).appendChild(host);
        window.SFPriceWatch.bind();
      } catch (e) { console.warn('Price warning could not be added:', e); }
    };
  }
})();
