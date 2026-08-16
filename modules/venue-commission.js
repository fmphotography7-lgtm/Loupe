/* StudioFlow g170 · VENUE COMMISSION
   =========================================================================================
   Kirk's hotel offer: a venue gets 20% of retail on any piece sold off its walls, on top of the
   bulk discount it already had. That only works if, when an order arrives, he can tell WHICH
   hotel earned it — and then total what he owes without reading through orders by hand.

   TWO ROUTES IN, because he will be on two websites at once for a while:

   1. SQUARESPACE — by DISCOUNT CODE, and it is the only thing that works there. Squarespace's
      own documentation states that checkout pages do not support code injection, so nothing can
      quietly attach a venue code as the guest pays. A per-venue discount code ("OAKBAY5") is the
      one mechanism that reliably lands on the order record, and it gives the guest a reason to
      type it, which a hidden field never can. g170 also had to start KEEPING discountLines in the
      order sync — Squarespace always returned them and the upsert threw them away.

   2. THE NEW SITE — by the venue code itself, carried from the QR scan through checkout onto the
      order (`venueCode`). No discount needed, so no margin given away. Nothing writes that field
      yet; it is read here so the day the new site sends it, this page already understands it.

   WHAT THIS FILE WILL NOT DO:
     - It never GUESSES a venue. An order matches by an exact code or it is unattributed, and the
       unattributed ones are shown, counted and explained rather than quietly dropped. Paying the
       wrong hotel is worse than paying none.
     - It never marks anything paid by itself. Money moving is a decision.
     - It computes commission on the RETAIL LINE VALUE, not on the grand total: shipping and tax
       are not Kirk's revenue and a hotel has no claim on them. His stated rule is a flat 20% of
       retail regardless of size, with the guest paying shipping at checkout — so freight must
       never enter this number.
   ========================================================================================= */
window.SFVenueCommission = {

  DEFAULT_RATE: 0.20,

  /* ---- settings live beside the venues they describe -------------------------------------- */

  /* ==========================================================================================
     g182 — ONE WRITER FOR THE VENUE LIST.
     ==========================================================================================
     Kirk: "when i save the venue at the artwork labels, nothing happens." Two pages were keeping
     their own handle on the same list, and label-core's save() writes the WHOLE branch back:
         st.labelQR = { settings: data.settings, properties: data.properties, labels: data.labels }
     Its `data` is filled by load(), which runs when the Artwork Labels page renders. So a venue
     added on Venue Commission AFTER that page was last drawn sat in state but not in `data` — and
     the next save from the labels page (adding a piece, changing a setting) overwrote state with
     its stale copy and the venue was GONE. No error, nothing to see: exactly "nothing happens".

     The fix is not to synchronise two copies, which only moves the race. Venue Commission now
     writes THROUGH label-core when it is loaded — same array, same save — so there is one owner
     and one path. It keeps its own direct path only for the case where the labels module is not
     present at all, which cannot happen in the app but keeps this file testable on its own.
     ========================================================================================== */
  core(){ return window.SFLabelQRCore || null; },
  store(){
    const s = window.SF.state, C = this.core();
    /* Ask label-core to re-read first: if the labels page was drawn before a venue was added
       elsewhere, its copy is behind, and a later save there would erase the newer venue. */
    if (C && typeof C.load === 'function') C.load();
    if (!s.labelQR || typeof s.labelQR !== 'object') s.labelQR = { settings: {}, properties: [], labels: [] };
    if (!Array.isArray(s.labelQR.properties)) s.labelQR.properties = [];
    /* Hand back label-core's OWN array when it has one, so both pages mutate the same object
       rather than two that happen to look alike. */
    if (C && C.data && Array.isArray(C.data.properties)) {
      if (C.data.properties !== s.labelQR.properties) s.labelQR.properties = C.data.properties;
      return C.data.properties;
    }
    if (!s.venueCommission || typeof s.venueCommission !== 'object') s.venueCommission = { payouts: [] };
    if (!Array.isArray(s.venueCommission.payouts)) s.venueCommission.payouts = [];
    return s.labelQR.properties;
  },
  venues(){ return this.store(); },
  rateFor(v){
    const r = Number(v && v.commissionRate);
    return isFinite(r) && r > 0 ? r : this.DEFAULT_RATE;
  },
  /* A venue may carry more than one discount code — he may run a seasonal one alongside the
     standing one, and last year's code still has to attribute last year's orders. */
  codesFor(v){
    const raw = (v && v.discountCodes) || (v && v.discountCode) || '';
    return String(raw).split(/[,\s]+/).map(c => c.trim().toUpperCase()).filter(Boolean);
  },

  /* ---- attribution ------------------------------------------------------------------------ */

  /* Every discount code on an order, however Squarespace happens to have shaped the line. The
     field name has moved around between API versions, so several are read rather than one being
     assumed — an order whose code sits under a name we did not check would look unattributed and
     the hotel would go unpaid. */
  codesOn(order){
    const out = [];
    (order && order.discountLines || []).forEach(d => {
      [d && d.promoCode, d && d.code, d && d.name, d && d.description].forEach(v => {
        if (v) out.push(String(v).trim().toUpperCase());
      });
    });
    return out;
  },
  /* Which venue an order belongs to, or null. The explicit code wins: it is unambiguous, whereas
     a discount code is a string a customer typed. */
  venueFor(order){
    if (!order) return null;
    const vs = this.venues();
    const direct = String(order.venueCode || '').trim().toLowerCase();
    if (direct) {
      const hit = vs.find(v => String(v.code || '').trim().toLowerCase() === direct);
      if (hit) return { venue: hit, how: 'code', matched: order.venueCode };
    }
    const codes = this.codesOn(order);
    if (codes.length) {
      for (const v of vs) {
        const mine = this.codesFor(v);
        const found = codes.find(c => mine.indexOf(c) > -1);
        if (found) return { venue: v, how: 'discount', matched: found };
      }
    }
    return null;
  },

  /* ---- the money -------------------------------------------------------------------------- */

  /* RETAIL LINE VALUE — what the artwork sold for, before shipping and tax. Taken from the order's
     own subtotal where there is one, because that is Squarespace's own figure and will not drift
     from what the customer was charged. Falls back to grand total minus shipping and tax rather
     than to grand total, which would hand the hotel a slice of the freight. */
  retailOf(order){
    const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };
    if (order && isFinite(Number(order.subtotal)) && Number(order.subtotal) > 0) return n(order.subtotal);
    return Math.max(0, n(order && order.total) - n(order && order.shippingTotal) - n(order && order.taxTotal));
  },
  /* A REFUNDED or CANCELLED order earns nobody anything. Checked explicitly, because a refund that
     silently kept its commission would be found only when a hotel was overpaid. */
  countable(order){
    if (!order) return false;
    if (order.testMode) return false;
    if (String(order.status || '').toLowerCase() === 'cancelled') return false;
    const pay = String(order.paymentState || '').toUpperCase();
    if (pay === 'REFUNDED' || pay === 'CANCELED' || pay === 'CANCELLED') return false;
    return true;
  },
  money(v){ return (Number(v) || 0).toFixed(2); },

  /* ---- the report ------------------------------------------------------------------------- */

  report(year){
    const sf = window.SF;
    const orders = (sf.state.websiteOrders || []).slice();
    const rows = {}, unattributed = [], skipped = [];
    this.venues().forEach(v => {
      rows[v.id] = { venue: v, rate: this.rateFor(v), orders: [], retail: 0, commission: 0 };
    });
    orders.forEach(o => {
      const when = String(o.orderDate || o.createdAt || '');
      if (year && when.slice(0, 4) !== String(year)) return;
      const hit = this.venueFor(o);
      if (!hit) { if (this.countable(o)) unattributed.push(o); return; }
      if (!this.countable(o)) { skipped.push({ order: o, venue: hit.venue }); return; }
      const row = rows[hit.venue.id];
      if (!row) return;
      const retail = this.retailOf(o);
      row.orders.push({ order: o, retail: retail, how: hit.how, matched: hit.matched,
        commission: Math.round(retail * row.rate * 100) / 100 });
      row.retail += retail;
      row.commission += Math.round(retail * row.rate * 100) / 100;
    });
    const list = Object.keys(rows).map(k => rows[k])
      .sort((a, b) => b.commission - a.commission);
    list.forEach(r => { r.paid = this.paidFor(r.venue.id, year); r.owing = Math.round((r.commission - r.paid) * 100) / 100; });
    return { rows: list, unattributed: unattributed, skipped: skipped,
      totalCommission: Math.round(list.reduce((n, r) => n + r.commission, 0) * 100) / 100,
      totalOwing: Math.round(list.reduce((n, r) => n + r.owing, 0) * 100) / 100 };
  },

  payouts(){ this.store(); return window.SF.state.venueCommission.payouts; },
  paidFor(venueId, year){
    return this.payouts()
      .filter(p => String(p.venueId) === String(venueId) && (!year || String(p.year) === String(year)))
      .reduce((n, p) => n + (Number(p.amount) || 0), 0);
  },

  /* ---- page ------------------------------------------------------------------------------- */

  render(){
    const sf = window.SF;
    const year = this._year || new Date().getFullYear();
    const rep = this.report(year);
    const venues = this.venues();

    sf.$('workspace').innerHTML = `<div class="page-stack">
      <section class="card">
        <div class="toolbar"><div><h2 style="margin:0">Venue Commission</h2>
          <p class="muted">What each hotel has earned from art sold off its walls.</p></div>
          <div class="row-actions">
            <label>Year&nbsp;<select id="vcYear">${Array.from({length:6},(_,i)=>new Date().getFullYear()-i)
              .map(y=>`<option ${y===year?'selected':''}>${y}</option>`).join('')}</select></label>
            <button class="button secondary" id="vcSetup">Venue setup</button>
          </div></div>
        ${!venues.length ? `<div class="empty-state roomy">No venues yet.
          Press <b>Venue setup</b> above to add your first hotel or designer.</div>` : `
        <div class="commerce-table"><table>
          <thead><tr><th>Venue</th><th>Orders</th><th>Retail</th><th>Rate</th><th>Commission</th><th>Paid</th><th>Owing</th><th></th></tr></thead>
          <tbody>${rep.rows.map(r => `<tr>
            <td><b>${sf.esc(r.venue.name)}</b><br><span class="muted">${sf.esc(r.venue.code || '\u2014')}</span></td>
            <td>${r.orders.length}</td>
            <td>$${this.money(r.retail)}</td>
            <td>${Math.round(r.rate*100)}%</td>
            <td><b>$${this.money(r.commission)}</b></td>
            <td>$${this.money(r.paid)}</td>
            <td>${r.owing > 0.005 ? `<b class="danger-text">$${this.money(r.owing)}</b>` : '\u2014'}</td>
            <td class="row-actions">
              <button class="button secondary compact" data-vc-open="${r.venue.id}">Detail</button>
              ${r.owing > 0.005 ? `<button class="button primary compact" data-vc-pay="${r.venue.id}">Record payment</button>` : ''}
            </td></tr>`).join('')}</tbody>
          <tfoot><tr><td><b>Total</b></td><td></td><td></td><td></td>
            <td><b>$${this.money(rep.totalCommission)}</b></td><td></td>
            <td><b>$${this.money(rep.totalOwing)}</b></td><td></td></tr></tfoot>
        </table></div>`}
      </section>

      ${rep.unattributed.length ? `<section class="card">
        <h3>${rep.unattributed.length} order(s) with no venue</h3>
        <p class="muted">These carried no venue code and no venue discount code, so nothing is owed
        on them. That is usually right \u2014 most orders come from people who found the site on their
        own. Worth a look only if you expected a hotel sale that is not in the table above.</p>
        <div class="commerce-table"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Codes used</th></tr></thead>
          <tbody>${rep.unattributed.slice(0, 40).map(o => `<tr>
            <td>#${sf.esc(o.orderNumber || '\u2014')}</td>
            <td>${sf.esc(String(o.orderDate || '').slice(0,10))}</td>
            <td>${sf.esc(o.customerName || '\u2014')}</td>
            <td>$${this.money(o.total)}</td>
            <td class="muted">${sf.esc(this.codesOn(o).join(', ') || 'none')}</td>
          </tr>`).join('')}</tbody></table></div>
      </section>` : ''}

      ${rep.skipped.length ? `<section class="card">
        <h3>${rep.skipped.length} refunded or cancelled order(s), not counted</h3>
        <p class="muted">These matched a venue but earn nothing, because the sale did not stand.</p>
      </section>` : ''}
    </div>`;

    sf.$('vcYear').onchange = e => { this._year = Number(e.target.value); this.render(); };
    sf.$('vcSetup').onclick = () => this.openSetup();
    document.querySelectorAll('[data-vc-open]').forEach(b => b.onclick = () => this.openDetail(b.dataset.vcOpen, year));
    document.querySelectorAll('[data-vc-pay]').forEach(b => b.onclick = () => this.openPayment(b.dataset.vcPay, year));
  },

  openSetup(){
    const sf = window.SF, venues = this.venues();
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal-card wide">
      <h2>Venue setup</h2>
      <p class="muted">The rate each venue earns, and the discount code that identifies its orders.
      Venues themselves are added on the Artwork Labels page.</p>
      <p class="help"><b>Why a discount code.</b> Squarespace checkout pages cannot run custom code,
      so nothing can attach a venue code to an order as the guest pays. A code the guest types is
      the only thing that reliably reaches the order \u2014 and it gives them a reason to type it.
      On your own site the venue code travels with the order and no discount is needed.</p>
      <div class="row-actions" style="margin-bottom:10px">
        <button class="button primary" id="vcAddVenue">\u002b Add a venue</button>
        <span class="help">A venue is a hotel or a designer's client whose walls carry your work.
        The same list drives the QR labels, so adding one here adds it there too.</span>
      </div>
      ${!venues.length ? `<div class="empty-state">No venues yet \u2014 add the first one above.</div>` : `
      <div class="commerce-table"><table>
        <thead><tr><th>Venue</th><th>Commission rate</th><th>Discount code(s)</th></tr></thead>
        <tbody>${venues.map((v,i) => `<tr>
          <td><b>${sf.esc(v.name)}</b><br><span class="muted">${sf.esc(v.code || '')}</span></td>
          <td><input data-vc="${i}" data-vc-field="commissionRate" type="number" min="0" max="100" step="1"
               value="${Math.round(this.rateFor(v)*100)}" style="width:80px">%</td>
          <td><input data-vc="${i}" data-vc-field="discountCodes" value="${sf.esc(v.discountCodes || v.discountCode || '')}"
               placeholder="OAKBAY5" style="min-width:200px"></td>
        </tr>`).join('')}</tbody></table></div>
      <p class="help">More than one code is fine \u2014 separate them with commas. Keep old codes here,
      or last season's orders stop being attributed.</p>`}
      <div class="row-actions"><button class="button secondary" id="vcSetupCancel">Cancel</button>
        <button class="button primary" id="vcSetupSave">Save</button></div></div></div>`;
    sf.$('vcSetupCancel').onclick = () => sf.closeModal();
    /* g180 — A VENUE COULD NOT BE CREATED FROM HERE, WHICH MADE THE WHOLE PAGE A DEAD END.
       Kirk: "i cannot create a venue it only shows me the reason for commissions with no way of
       adding anything." Exactly right. Venues live in state.labelQR.properties, and the ONLY
       place that could add one was a modal on the Artwork Labels page — a page he had not found
       yet, in a different nav group. So Venue Commission explained a scheme he had no way to
       start using. It now adds them itself, into the SAME list, because a second list would drift
       from the labels within a week. */
    sf.$('vcAddVenue').onclick = async () => {
      const got = await sf.askFields({
        title: 'Add a venue',
        note: 'The code is what identifies this venue\u2019s orders. Short, lowercase, no spaces.',
        /* g182 — THE FIELD PROPERTY IS `key`, NOT `id`. I wrote `id`, so every input rendered as
           data-af="undefined", read() collected one key called "undefined", and `got.name` came
           back empty — which is why Kirk typed a venue name and was told a venue needs a name.
           The form LOOKED right, which is what made it convincing. Checked against askFields in
           core.js rather than remembered: it reads f.key and f.label only. */
        fields: [
          { key: 'name', label: 'Venue name', placeholder: 'Oak Bay Beach Hotel' },
          { key: 'code', label: 'Venue code', placeholder: 'oak-bay-beach' },
          { key: 'discountCodes', label: 'Discount code at checkout (optional)', placeholder: 'OAKBAY5' },
          { key: 'rate', label: 'Commission %', value: '20' }
        ],
        okLabel: 'Add venue'
      });
      if (!got) return;
      const name = String(got.name || '').trim();
      if (!name) return alert('A venue needs a name.');
      /* The code is slugged rather than rejected: he should not have to know what a slug is, and
         a code with a capital or a space in it would never match an order. */
      let code = String(got.code || name).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const vs = this.venues();
      if (vs.some(v => String(v.code || '').toLowerCase() === code)) {
        return alert('There is already a venue with the code \u201c' + code + '\u201d.');
      }
      const pct = Math.max(0, Math.min(100, Number(got.rate) || 20));
      vs.push({ id: sf.makeId('VEN'), name: name, code: code,
        discountCodes: String(got.discountCodes || '').trim().toUpperCase(),
        commissionRate: pct / 100, createdAt: new Date().toISOString() });
      /* Through label-core when it is there, so its in-memory copy and the database agree. */
      const C = this.core();
      if (C && typeof C.save === 'function') C.save();
      await sf.persist();
      this.openSetup();
    };
    sf.$('vcSetupSave').onclick = async () => {
      const vs = this.venues();
      document.querySelectorAll('[data-vc]').forEach(el => {
        const v = vs[Number(el.dataset.vc)], f = el.dataset.vcField;
        if (!v || !f) return;
        if (f === 'commissionRate') {
          const pct = Math.max(0, Math.min(100, Number(el.value) || 0));
          v.commissionRate = pct / 100;
        } else v[f] = el.value.trim().toUpperCase();
      });
      const C2 = this.core();
      if (C2 && typeof C2.save === 'function') C2.save();
      await sf.persist();
      sf.closeModal();
      this.render();
    };
  },

  openDetail(venueId, year){
    const sf = window.SF, rep = this.report(year);
    const row = rep.rows.find(r => String(r.venue.id) === String(venueId));
    if (!row) return;
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal-card wide">
      <h2>${sf.esc(row.venue.name)} \u2014 ${year}</h2>
      ${!row.orders.length ? '<div class="empty-state">No orders attributed to this venue yet.</div>' : `
      <div class="commerce-table"><table>
        <thead><tr><th>Order</th><th>Date</th><th>Retail</th><th>Commission</th><th>Matched by</th></tr></thead>
        <tbody>${row.orders.map(x => `<tr>
          <td>#${sf.esc(x.order.orderNumber || '\u2014')}</td>
          <td>${sf.esc(String(x.order.orderDate || '').slice(0,10))}</td>
          <td>$${this.money(x.retail)}</td>
          <td><b>$${this.money(x.commission)}</b></td>
          <td class="muted">${x.how === 'code' ? 'venue code on the order' : 'discount code'} \u00b7 ${sf.esc(x.matched)}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr><td><b>Total</b></td><td></td><td><b>$${this.money(row.retail)}</b></td>
          <td><b>$${this.money(row.commission)}</b></td><td></td></tr></tfoot>
      </table></div>
      <p class="help">Commission is worked out on the retail value of the artwork \u2014 shipping and
      tax are excluded, since the guest pays those and they are not your revenue.</p>`}
      <div class="row-actions"><button class="button secondary" id="vcDetailClose">Close</button></div>
    </div></div>`;
    sf.$('vcDetailClose').onclick = () => sf.closeModal();
  },

  openPayment(venueId, year){
    const sf = window.SF, rep = this.report(year);
    const row = rep.rows.find(r => String(r.venue.id) === String(venueId));
    if (!row) return;
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><form class="modal-card" id="vcPayForm">
      <h2>Record a payment to ${sf.esc(row.venue.name)}</h2>
      <p class="muted">Owing for ${year}: <b>$${this.money(row.owing)}</b></p>
      <div class="form-grid">
        <label>Amount<input id="vcPayAmount" type="number" step=".01" min="0" value="${this.money(row.owing)}"></label>
        <label>Date<input id="vcPayDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
      </div>
      <label>Note<input id="vcPayNote" placeholder="cheque, e-transfer, credited against next order"></label>
      <label class="checkline"><input type="checkbox" id="vcPayExpense" checked>
        Also record it as a business expense</label>
      <p class="help">Recording the expense keeps it in your year-end figures. Untick only if you
      have already entered it under Expenses, or it will be counted twice.</p>
      <div class="row-actions"><button type="button" class="button secondary" id="vcPayCancel">Cancel</button>
        <button class="button primary">Record</button></div></form></div>`;
    sf.$('vcPayCancel').onclick = () => sf.closeModal();
    sf.$('vcPayForm').onsubmit = async e => {
      e.preventDefault();
      const amount = Number(sf.$('vcPayAmount').value) || 0;
      if (amount <= 0) return;
      const date = sf.$('vcPayDate').value, note = sf.$('vcPayNote').value.trim();
      this.payouts().push({ id: sf.makeId('VCP'), venueId: row.venue.id, venueName: row.venue.name,
        year: year, amount: amount, date: date, note: note, createdAt: new Date().toISOString() });
      /* One entry, in the place his accountant reads, using the SAME shape the Expenses tab
         writes — a second private ledger would drift from the first. */
      if (sf.$('vcPayExpense').checked) {
        if (!Array.isArray(sf.state.businessTransactions)) sf.state.businessTransactions = [];
        sf.state.businessTransactions.push({
          id: sf.makeId('BTX'), type: 'Commission', direction: 'out', amount: amount, date: date,
          payee: row.venue.name, projectType: 'Venue Commission',
          notes: `Art commission \u2014 ${row.venue.name} \u2014 ${year}${note ? ' \u2014 ' + note : ''}`,
          createdAt: new Date().toISOString()
        });
      }
      await sf.persist();
      sf.closeModal();
      this.render();
    };
  }
};
