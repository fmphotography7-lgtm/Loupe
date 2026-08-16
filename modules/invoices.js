/* StudioFlow g161 · INVOICES
   =========================================================================================
   Kirk sent two of his own invoices (0304 Wanna Dance / Whistler, 0310 DanceBUG / E26-386-03)
   and asked for the same thing inside StudioFlow: tied to a service job's revenue, client
   picked from a list, and a PDF ready to email.

   THE LAYOUT IS COPIED FROM HIS, not designed. Same blocks in the same order: sender block left
   with INVOICE and the number/date right; TO block with a LABELLED REFERENCE BOX beside it; the
   seven-column meta strip (Salesperson / Job / Shipping method / Shipping terms / Delivery date /
   Payment terms / Due date); the six-column line table (Qty / Item # / Description / Unit price /
   Discount / Line total); then Total discount / Subtotal / Sales tax / Total.

   THINGS READ OFF HIS TWO EXAMPLES RATHER THAN ASSUMED:
     - THE REFERENCE BOX IS A LABEL PLUS A VALUE, and the label CHANGES: "Event / Whistler, BC"
       on one, "E- code / E26-386-03" on the other. So both are fields, not one hard-coded word.
     - THE JOB COLUMN REPEATS THAT VALUE ("Whistler", "E26-386-03"), so it defaults to it.
     - HEADING ROWS EXIST INSIDE THE TABLE. Invoice 0310 has "May 21", "May 22" … with no qty and
       no price, grouping the lines under each day. A line with no quantity AND no price is
       therefore treated as a heading, which is exactly how his own sheet reads.
     - QUANTITIES ARE NOT WHOLE. "1.33 × 28.68 = 38.14" — an hour and twenty minutes of overtime.
       So qty is a decimal field and the line total is rounded to the cent, not the dollar.
     - SALES TAX IS BLANK on both. It stays optional and prints only when he sets it.

   ONE THING HIS TEMPLATE GETS WRONG, WORTH KNOWING: on invoice 0304 the 3244.68 sits on the
   TOTAL DISCOUNT row and SUBTOTAL is empty. The arithmetic is right (175 + 4×650 + 469.68) but
   the number is on the wrong line. Here the subtotal is the subtotal and the discount row shows
   discounts, so the same figures land where their labels say.
   ========================================================================================= */
window.SFInvoices = {

  /* ---- data ------------------------------------------------------------------------------ */

  store(){
    const s = window.SF.state;
    if (!Array.isArray(s.invoices)) s.invoices = [];
    if (!s.invoiceSettings || typeof s.invoiceSettings !== 'object') s.invoiceSettings = {};
    const cfg = s.invoiceSettings;
    /* Seeded from his own invoices so the first one he makes already reads correctly. */
    if (cfg.fromName == null) cfg.fromName = 'Kirk Buckland';
    if (cfg.fromAddress == null) cfg.fromAddress = '4286 Panorama Place, Victoria BC, V8X 5A9\nPhone 250-888-4146\nfrozen_moments@telus.net';
    if (cfg.salesperson == null) cfg.salesperson = 'Kirk Buckland';
    if (cfg.paymentTerms == null) cfg.paymentTerms = '';
    if (cfg.dueDate == null) cfg.dueDate = 'Due on receipt';
    if (cfg.shippingMethod == null) cfg.shippingMethod = 'None';
    if (cfg.shippingTerms == null) cfg.shippingTerms = 'none';
    if (cfg.taxLabel == null) cfg.taxLabel = 'SALES TAX';
    return s.invoices;
  },
  settings(){ this.store(); return window.SF.state.invoiceSettings; },
  clients(){ return (window.SF.state.customers || []).slice(); },
  jobs(){ return (window.SF.state.serviceJobs || []).slice().reverse(); },
  invoice(id){ return this.store().find(x => String(x.id) === String(id)) || null; },

  /* ==========================================================================================
     g162 — NUMBERING RESTARTS EACH YEAR, FROM A BLOCK HE SETS.
     ==========================================================================================
     Kirk: "2026 starts with invoice 300, 301… 2027 will start with 400, 401."

     So the sequence is PER YEAR, not one running list, and each year has a STARTING BLOCK he
     chooses. g161 took the global maximum and added one, which would have carried 2026's numbers
     straight into 2027 and never restarted.

     THE YEAR COMES FROM THE INVOICE'S OWN DATE, not from today. An invoice dated 28 December and
     written in January belongs to the December sequence — dating it by the clock would put a
     stray number in the wrong year's run, which is exactly the kind of gap an accountant asks
     about.

     A YEAR WITH NO BLOCK SET gets the previous block plus 100, because that is the step he
     described — but that is an INFERENCE from two examples, so the page SHOWS the guessed figure
     and says it guessed. It is never silently adopted: he can change it before it is used.
     ========================================================================================== */
  STEP: 100,
  yearStarts(){
    const cfg = this.settings();
    if (!cfg.yearStarts || typeof cfg.yearStarts !== 'object') cfg.yearStarts = {};
    /* His own year, from his own invoices. Seeded once so the first one he makes is right. */
    if (cfg.yearStarts['2026'] == null) cfg.yearStarts['2026'] = 300;
    return cfg.yearStarts;
  },
  yearOf(inv){
    const d = String((inv && inv.date) || '');
    const y = parseInt(d.slice(0, 4), 10);
    return isFinite(y) && y > 1990 ? y : new Date().getFullYear();
  },
  /* The block a year starts at: his if he has set one, otherwise the nearest EARLIER year he has
     set plus one step per year between. Returns whether it was a guess, so the page can say. */
  startFor(year){
    const starts = this.yearStarts(), y = Number(year);
    if (starts[y] != null) return { start: Number(starts[y]) || 0, guessed: false };
    const known = Object.keys(starts).map(Number).filter(k => isFinite(k)).sort((a, b) => a - b);
    if (!known.length) return { start: 100, guessed: true };
    const earlier = known.filter(k => k < y);
    if (earlier.length) {
      const from = earlier[earlier.length - 1];
      return { start: Number(starts[from]) + this.STEP * (y - from), guessed: true };
    }
    /* Only LATER years are known — step backwards from the earliest rather than inventing 100. */
    const from = known[0];
    return { start: Math.max(0, Number(starts[from]) - this.STEP * (from - y)), guessed: true };
  },
  /* Every number already used in that year, so a gap left by a deleted invoice is not reissued —
     reusing a number is worse than leaving a gap, because two documents would share one. */
  nextNumber(year){
    const y = Number(year) || new Date().getFullYear();
    const { start, guessed } = this.startFor(y);
    const used = this.store()
      .filter(i => this.yearOf(i) === y)
      .map(i => parseInt(String(i.number).replace(/\D+/g, ''), 10))
      .filter(n => isFinite(n));
    const next = used.length ? Math.max(Math.max.apply(null, used) + 1, start) : start;
    return { number: String(next).padStart(4, '0'), year: y, start, guessed, used: used.length };
  },

  blank(){
    const cfg = this.settings(), today = new Date().toISOString().slice(0, 10);
    return {
      id: window.SF.makeId('INV'), number: this.nextNumber(new Date().getFullYear()).number, date: today,
      clientId: '', clientName: '', clientAddress: '', clientEmail: '',
      refLabel: 'Event', refValue: '',
      salesperson: cfg.salesperson, job: '', shippingMethod: cfg.shippingMethod,
      shippingTerms: cfg.shippingTerms, deliveryDate: today,
      paymentTerms: cfg.paymentTerms, dueDate: cfg.dueDate,
      serviceJobId: '', taxAmount: 0, notes: '',
      lines: [{ qty: 1, itemNo: '', description: '', unitPrice: 0, discount: 0 }],
      status: 'Draft', createdAt: new Date().toISOString()
    };
  },

  /* ---- the maths ------------------------------------------------------------------------- */

  /* A HEADING ROW is a line with words but no quantity and no price — his "May 21". It prints in
     the description column and contributes nothing, which is what makes the day groupings work
     without a second concept. */
  isHeading(l){
    return !!String(l.description || '').trim() && !(Number(l.qty) > 0) && !(Number(l.unitPrice) > 0);
  },
  isBlank(l){
    return !String(l.description || '').trim() && !(Number(l.qty) > 0) && !(Number(l.unitPrice) > 0);
  },
  lineTotal(l){
    if (this.isHeading(l) || this.isBlank(l)) return 0;
    const gross = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
    /* Rounded to the CENT, at the line, exactly as his sheet does: 1.33 × 28.68 prints 38.14,
       and a total built from unrounded lines would disagree with the column by a penny or two. */
    return Math.round((gross - (Number(l.discount) || 0)) * 100) / 100;
  },
  totals(inv){
    const lines = (inv && inv.lines) || [];
    const subtotal = lines.reduce((n, l) => n + this.lineTotal(l), 0);
    const discount = lines.reduce((n, l) =>
      n + (this.isHeading(l) || this.isBlank(l) ? 0 : (Number(l.discount) || 0)), 0);
    const tax = Number(inv && inv.taxAmount) || 0;
    const r = v => Math.round(v * 100) / 100;
    return { subtotal: r(subtotal), discount: r(discount), tax: r(tax), total: r(subtotal + tax) };
  },
  money(v){ return (Number(v) || 0).toFixed(2); },
  longDate(v){
    if (!v) return '';
    const d = new Date(String(v).length <= 10 ? v + 'T12:00:00' : v);
    if (isNaN(d)) return String(v);
    return d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
  },

  /* ---- filling from a service job -------------------------------------------------------- */

  /* Kirk: "It could populate information from the services like date, client … then it could read
     the id of the event". Everything below is a PREFILL of an empty field — a value he has already
     typed is never overwritten, because the job is a summary and the invoice is the document. */
  applyJob(inv, jobId){
    const job = (window.SF.state.serviceJobs || []).find(j => String(j.id) === String(jobId));
    if (!job) return inv;
    inv.serviceJobId = job.id;
    /* applyClient() OVERWRITES the three client fields — that is right when he picks a client
       himself, and wrong here: choosing a job must not wipe a name he has already typed. So the
       whole client block is only pulled across when it is still empty. Caught by a test asserting
       a typed name survives; the guard on `clientId` alone was not enough, because a blank
       clientId with a typed NAME is the normal case for a one-off client. */
    if (!inv.clientId && !String(inv.clientName || '').trim() && job.customerId) {
      this.applyClient(inv, job.customerId);
    }
    if (!String(inv.clientName || '').trim()) inv.clientName = job.customerName || job.company || '';
    if (!inv.date && job.date) inv.date = String(job.date).slice(0, 10);
    if (!inv.deliveryDate && job.date) inv.deliveryDate = String(job.date).slice(0, 10);
    if (!String(inv.refValue || '').trim()) inv.refValue = job.type || '';
    if (!String(inv.job || '').trim()) inv.job = inv.refValue;
    return inv;
  },
  applyClient(inv, clientId){
    const c = this.clients().find(x => String(x.id) === String(clientId));
    inv.clientId = clientId || '';
    if (!c) return inv;
    inv.clientName = c.company || c.name || '';
    inv.clientAddress = c.address || '';
    inv.clientEmail = c.email || '';
    return inv;
  },

  /* ---- the page -------------------------------------------------------------------------- */

  render(){
    const sf = window.SF, list = this.store().slice().sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')));
    sf.$('workspace').innerHTML = `<div class="page-stack">
      <section class="card">
        <div class="toolbar"><div><h2 style="margin:0">Invoices</h2>
          <p class="muted">Your own invoice layout, filled from a service job and printed to PDF.
          ${list.length} invoice(s). ${(() => {
            const n = this.nextNumber(new Date().getFullYear());
            return `The next ${n.year} invoice will be <b>${sf.esc(n.number)}</b>${n.guessed
              ? ` \u2014 <b class="danger-text">guessed</b>, because you have not set where ${n.year} starts.`
              : '.'}`;
          })()}</p></div>
          <div class="row-actions">
            <button class="button secondary" id="invYears">Numbering</button>
            <button class="button secondary" id="invSettings">Your details</button>
            <button class="button primary" id="invNew">New invoice</button>
          </div></div>
        ${list.length ? `<div class="commerce-table"><table>
          <thead><tr><th>Number</th><th>Date</th><th>Client</th><th>Reference</th><th>Total</th><th>Job</th><th></th></tr></thead>
          <tbody>${list.map(i => {
            const t = this.totals(i);
            const job = (sf.state.serviceJobs || []).find(j => String(j.id) === String(i.serviceJobId));
            return `<tr><td><b>${sf.esc(i.number)}</b></td>
              <td>${sf.esc(this.longDate(i.date))}</td>
              <td>${sf.esc(i.clientName || '\u2014')}</td>
              <td>${sf.esc(i.refValue || '\u2014')}</td>
              <td><b>$${this.money(t.total)}</b></td>
              <td class="muted">${job ? sf.esc(`${job.customerName || 'Job'} \u2014 ${job.type || ''}`) : '\u2014'}</td>
              <td class="row-actions">
                <button class="button secondary" data-inv-edit="${i.id}">Open</button>
                <button class="button secondary" data-inv-print="${i.id}">PDF</button>
                <button class="button danger" data-inv-del="${i.id}">Delete</button>
              </td></tr>`;
          }).join('')}</tbody></table></div>`
          : '<div class="empty-state roomy">No invoices yet. Press <b>New invoice</b> to make the first one.</div>'}
      </section>
    </div>`;
    sf.$('invNew').onclick = async () => {
      const inv = this.blank();
      this.store().push(inv);
      await sf.persist();
      this.open(inv.id);
    };
    sf.$('invSettings').onclick = () => this.openSettings();
    sf.$('invYears').onclick = () => this.openYears();
    document.querySelectorAll('[data-inv-edit]').forEach(b => b.onclick = () => this.open(b.dataset.invEdit));
    document.querySelectorAll('[data-inv-print]').forEach(b => b.onclick = () => this.printInvoice(b.dataset.invPrint));
    document.querySelectorAll('[data-inv-del]').forEach(b => b.onclick = async () => {
      const inv = this.invoice(b.dataset.invDel);
      if (!inv) return;
      if (!confirm(`Delete invoice ${inv.number}?\n\nThis cannot be undone. Nothing else changes \u2014 any service job keeps its own revenue figure.`)) return;
      sf.state.invoices = this.store().filter(x => x.id !== inv.id);
      await sf.persist();
      this.render();
    });
  },

  /* Each year and the number it starts at. Shown as a table rather than one "starting number"
     box, because the whole point is that the years differ and he can see the run at a glance. */
  openYears(){
    const sf = window.SF, starts = this.yearStarts();
    const thisYear = new Date().getFullYear();
    const years = [...new Set(Object.keys(starts).map(Number)
      .concat(this.store().map(i => this.yearOf(i)))
      .concat([thisYear, thisYear + 1]))].filter(y => isFinite(y)).sort((a, b) => a - b);
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><form class="modal-card" id="invYearForm">
      <h2>Invoice numbering</h2>
      <p class="muted">Each year runs its own sequence from the number you set here \u2014 2026 from 300,
      2027 from 400, and so on. Numbering follows the INVOICE'S DATE, so one dated in December keeps
      that year's run even if you write it in January.</p>
      <div class="commerce-table"><table>
        <thead><tr><th>Year</th><th>Starts at</th><th>Used so far</th><th>Next</th></tr></thead>
        <tbody>${years.map(y => {
          const n = this.nextNumber(y);
          const set = starts[y] != null;
          return `<tr><td><b>${y}</b>${y === thisYear ? ' <span class="muted">(this year)</span>' : ''}</td>
            <td><input data-yr="${y}" type="number" min="0" step="1" value="${set ? Number(starts[y]) : n.start}" style="width:110px"></td>
            <td>${n.used || '\u2014'}</td>
            <td><b>${sf.esc(n.number)}</b>${!set ? ' <small class="danger-text">guessed</small>' : ''}</td></tr>`;
        }).join('')}</tbody></table></div>
      <p class="help">A year marked <b>guessed</b> has no block of its own \u2014 the figure shown is the
      previous year's plus ${this.STEP}, which is the step your own numbering uses. Saving accepts it.
      A number already used in a year is never reissued, so deleting an invoice leaves a gap rather
      than handing the same number to two documents.</p>
      <div class="row-actions"><button type="button" class="button secondary" id="iyCancel">Cancel</button>
        <button class="button primary">Save</button></div></form></div>`;
    sf.$('iyCancel').onclick = () => sf.closeModal();
    sf.$('invYearForm').onsubmit = async e => {
      e.preventDefault();
      document.querySelectorAll('[data-yr]').forEach(el => {
        const y = el.dataset.yr, v = Number(el.value);
        if (isFinite(v) && v >= 0) starts[y] = v;
      });
      await sf.persist();
      sf.closeModal();
      this.render();
    };
  },

  openSettings(){
    const sf = window.SF, cfg = this.settings();
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><form class="modal-card" id="invSetForm">
      <h2>Your details</h2>
      <p class="muted">These appear at the top of every invoice and as the defaults on a new one.</p>
      <div class="form-grid">
        <label>Name<input id="isName" value="${sf.esc(cfg.fromName)}"></label>
        <label>Salesperson<input id="isSales" value="${sf.esc(cfg.salesperson)}"></label>
      </div>
      <label>Address block <small class="muted">\u2014 one line each, exactly as it should print</small>
        <textarea id="isAddress" rows="4">${sf.esc(cfg.fromAddress)}</textarea></label>
      <div class="form-grid">
        <label>Shipping method<input id="isShipMethod" value="${sf.esc(cfg.shippingMethod)}"></label>
        <label>Shipping terms<input id="isShipTerms" value="${sf.esc(cfg.shippingTerms)}"></label>
        <label>Payment terms<input id="isPayTerms" value="${sf.esc(cfg.paymentTerms)}"></label>
        <label>Due date wording<input id="isDue" value="${sf.esc(cfg.dueDate)}"></label>
      </div>
      <div class="row-actions"><button type="button" class="button secondary" id="isCancel">Cancel</button>
        <button class="button primary">Save</button></div></form></div>`;
    sf.$('isCancel').onclick = () => sf.closeModal();
    sf.$('invSetForm').onsubmit = async e => {
      e.preventDefault();
      cfg.fromName = sf.$('isName').value.trim();
      cfg.salesperson = sf.$('isSales').value.trim();
      cfg.fromAddress = sf.$('isAddress').value;
      cfg.shippingMethod = sf.$('isShipMethod').value.trim();
      cfg.shippingTerms = sf.$('isShipTerms').value.trim();
      cfg.paymentTerms = sf.$('isPayTerms').value.trim();
      cfg.dueDate = sf.$('isDue').value.trim();
      await sf.persist();
      sf.closeModal();
      this.render();
    };
  },

  /* ---- the editor ------------------------------------------------------------------------ */

  open(id){
    const sf = window.SF, inv = this.invoice(id);
    if (!inv) return;
    const t = this.totals(inv);
    const job = (sf.state.serviceJobs || []).find(j => String(j.id) === String(inv.serviceJobId));

    sf.$('workspace').innerHTML = `<div class="page-stack">
      <section class="card">
        <div class="toolbar"><div><h2 style="margin:0">Invoice ${sf.esc(inv.number)}</h2>
          <p class="muted">Everything here prints exactly as you see it.</p>
          ${(() => {
            /* g162: he can change the date after the number was issued. A number is never
               renumbered on its own — reissuing one silently would change a document he may
               already have sent — so this only OFFERS it, and only when the two disagree. */
            const y = this.yearOf(inv), n = this.nextNumber(y);
            const num = parseInt(String(inv.number).replace(/\D+/g, ''), 10);
            const inRange = isFinite(num) && num >= n.start && num < n.start + this.STEP;
            return inRange ? '' : `<p class="help danger-text">This invoice is dated ${y}, whose numbers
              start at ${n.start}, but it is numbered ${sf.esc(inv.number)}.
              <button type="button" class="button secondary" id="ivRenumber">Renumber it ${sf.esc(n.number)}</button></p>`;
          })()}</div>
          <div class="row-actions">
            <button class="button secondary" id="ivBack">\u2190 All invoices</button>
            <button class="button primary" id="ivPrint">Print / Save PDF</button>
          </div></div>

        <div class="form-grid">
          <label>Invoice number<input id="ivNumber" value="${sf.esc(inv.number)}"></label>
          <label>Invoice date<input id="ivDate" type="date" value="${sf.esc(inv.date || '')}"></label>
          <label>From a service job<select id="ivJob">
            <option value="">\u2014 not tied to a job \u2014</option>
            ${this.jobs().map(j => `<option value="${sf.esc(j.id)}" ${String(j.id) === String(inv.serviceJobId) ? 'selected' : ''}>${sf.esc(`${j.customerName || 'Client'} \u2014 ${j.type || 'Job'}${j.date ? ` (${String(j.date).slice(0, 10)})` : ''}`)}</option>`).join('')}
          </select></label>
          <label>Client<select id="ivClient">
            <option value="">\u2014 type it below \u2014</option>
            ${this.clients().map(c => `<option value="${sf.esc(c.id)}" ${String(c.id) === String(inv.clientId) ? 'selected' : ''}>${sf.esc(c.company || c.name)}</option>`).join('')}
          </select></label>
        </div>
        <div class="form-grid">
          <label>Bill to<input id="ivClientName" value="${sf.esc(inv.clientName || '')}"></label>
          <label>Their email<input id="ivClientEmail" value="${sf.esc(inv.clientEmail || '')}"></label>
        </div>
        <label>Their address<textarea id="ivClientAddress" rows="3">${sf.esc(inv.clientAddress || '')}</textarea></label>
        <p class="help">Choosing a client fills these in from Sales &amp; Orders \u2192 Customers. Editing them
        here changes this invoice only. If a client has no address, add it once on their customer record.</p>

        <div class="form-grid">
          <label>Reference label<input id="ivRefLabel" value="${sf.esc(inv.refLabel || '')}" placeholder="Event, or E- code"></label>
          <label>Reference<input id="ivRefValue" value="${sf.esc(inv.refValue || '')}" placeholder="Whistler, BC or E26-386-03"></label>
          <label>Job<input id="ivJobRef" value="${sf.esc(inv.job || '')}" placeholder="follows the reference"></label>
          <label>Delivery date<input id="ivDelivery" type="date" value="${sf.esc(inv.deliveryDate || '')}"></label>
        </div>
        <div class="form-grid">
          <label>Salesperson<input id="ivSales" value="${sf.esc(inv.salesperson || '')}"></label>
          <label>Shipping method<input id="ivShipMethod" value="${sf.esc(inv.shippingMethod || '')}"></label>
          <label>Shipping terms<input id="ivShipTerms" value="${sf.esc(inv.shippingTerms || '')}"></label>
          <label>Payment terms<input id="ivPayTerms" value="${sf.esc(inv.paymentTerms || '')}"></label>
          <label>Due date<input id="ivDue" value="${sf.esc(inv.dueDate || '')}"></label>
        </div>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3 style="margin:0">Lines</h3>
          <p class="muted">Leave the quantity and price empty to make a heading row, like your
          \u201cMay 21\u201d day headings. Quantities can be decimal \u2014 1.33 for an hour and twenty minutes.</p></div>
          <div class="row-actions">
            <button class="button secondary" id="ivAddLine">Add a line</button>
            <button class="button secondary" id="ivAddHeading">Add a heading</button>
          </div></div>
        <div class="commerce-table"><table class="inv-lines">
          <thead><tr><th style="width:80px">Qty</th><th style="width:90px">Item #</th><th>Description</th>
            <th style="width:110px">Unit price</th><th style="width:100px">Discount</th>
            <th style="width:110px">Line total</th><th style="width:120px"></th></tr></thead>
          <tbody>${inv.lines.map((l, i) => `<tr class="${this.isHeading(l) ? 'inv-heading-row' : ''}">
            <td><input data-iv="${i}" data-iv-field="qty" type="number" step="0.01" min="0" value="${l.qty === '' || l.qty == null ? '' : Number(l.qty)}"></td>
            <td><input data-iv="${i}" data-iv-field="itemNo" value="${sf.esc(l.itemNo || '')}"></td>
            <td><input data-iv="${i}" data-iv-field="description" value="${sf.esc(l.description || '')}" style="min-width:260px"></td>
            <td><input data-iv="${i}" data-iv-field="unitPrice" type="number" step="0.01" min="0" value="${l.unitPrice === '' || l.unitPrice == null ? '' : Number(l.unitPrice)}"></td>
            <td><input data-iv="${i}" data-iv-field="discount" type="number" step="0.01" min="0" value="${Number(l.discount) || ''}"></td>
            <td class="inv-line-total">${this.isHeading(l) ? '' : '$' + this.money(this.lineTotal(l))}</td>
            <td class="row-actions">
              <button class="button secondary" data-iv-up="${i}">\u2191</button>
              <button class="button secondary" data-iv-down="${i}">\u2193</button>
              <button class="button danger" data-iv-del="${i}">\u2715</button>
            </td></tr>`).join('')}</tbody>
        </table></div>
        <div class="form-grid" style="margin-top:12px">
          <label>Sales tax <small class="muted">\u2014 leave at 0 if you do not charge it</small>
            <input id="ivTax" type="number" step="0.01" min="0" value="${Number(inv.taxAmount) || 0}"></label>
        </div>
        <div class="row-actions" style="margin-top:10px">
          <button class="button secondary" id="ivSave">Save</button>
          <span class="help">Subtotal <b>$${this.money(t.subtotal)}</b>${t.discount ? ` \u00b7 discounts $${this.money(t.discount)}` : ''}${t.tax ? ` \u00b7 tax $${this.money(t.tax)}` : ''} \u00b7 <b>Total $${this.money(t.total)}</b></span>
        </div>
      </section>

      ${job ? `<section class="card">
        <h3>The job this belongs to</h3>
        <p class="muted"><b>${sf.esc(job.customerName || 'Client')} \u2014 ${sf.esc(job.type || 'Job')}</b>
        currently shows revenue of <b>$${this.money(job.revenue)}</b>; this invoice totals
        <b>$${this.money(t.total)}</b>.</p>
        ${Math.abs((Number(job.revenue) || 0) - t.total) > 0.005
          ? `<div class="row-actions"><button class="button primary" id="ivSyncJob">Set the job's revenue to $${this.money(t.total)}</button>
             <span class="help">Nothing is changed on the job until you press this. If you invoice
             the same job more than once, add the totals yourself rather than pressing it twice.</span></div>`
          : '<p class="help">The job and this invoice agree.</p>'}
      </section>` : ''}
    </div>`;

    const read = () => {
      inv.number = sf.$('ivNumber').value.trim();
      inv.date = sf.$('ivDate').value;
      inv.clientName = sf.$('ivClientName').value.trim();
      inv.clientEmail = sf.$('ivClientEmail').value.trim();
      inv.clientAddress = sf.$('ivClientAddress').value;
      inv.refLabel = sf.$('ivRefLabel').value.trim();
      inv.refValue = sf.$('ivRefValue').value.trim();
      inv.job = sf.$('ivJobRef').value.trim();
      inv.deliveryDate = sf.$('ivDelivery').value;
      inv.salesperson = sf.$('ivSales').value.trim();
      inv.shippingMethod = sf.$('ivShipMethod').value.trim();
      inv.shippingTerms = sf.$('ivShipTerms').value.trim();
      inv.paymentTerms = sf.$('ivPayTerms').value.trim();
      inv.dueDate = sf.$('ivDue').value.trim();
      inv.taxAmount = Number(sf.$('ivTax').value) || 0;
      document.querySelectorAll('[data-iv]').forEach(el => {
        const l = inv.lines[Number(el.dataset.iv)], f = el.dataset.ivField;
        if (!l || !f) return;
        l[f] = (el.type === 'number') ? (el.value === '' ? '' : Number(el.value) || 0) : el.value;
      });
    };
    const commit = async () => { await sf.persist(); this.open(inv.id); };

    if (sf.$('ivRenumber')) sf.$('ivRenumber').onclick = async () => {
      read();
      inv.number = this.nextNumber(this.yearOf(inv)).number;
      await commit();
    };
    sf.$('ivBack').onclick = async () => { read(); await sf.persist(); this.render(); };
    sf.$('ivSave').onclick = async () => { read(); await commit(); };
    sf.$('ivPrint').onclick = async () => { read(); await sf.persist(); this.printInvoice(inv.id); };
    sf.$('ivAddLine').onclick = async () => {
      read(); inv.lines.push({ qty: 1, itemNo: '', description: '', unitPrice: 0, discount: 0 }); await commit();
    };
    sf.$('ivAddHeading').onclick = async () => {
      read(); inv.lines.push({ qty: '', itemNo: '', description: '', unitPrice: '', discount: 0 }); await commit();
    };
    sf.$('ivJob').onchange = async e => { read(); this.applyJob(inv, e.target.value); await commit(); };
    sf.$('ivClient').onchange = async e => { read(); this.applyClient(inv, e.target.value); await commit(); };
    document.querySelectorAll('[data-iv-del]').forEach(b => b.onclick = async () => {
      read(); inv.lines.splice(Number(b.dataset.ivDel), 1);
      if (!inv.lines.length) inv.lines.push({ qty: 1, itemNo: '', description: '', unitPrice: 0, discount: 0 });
      await commit();
    });
    const move = (i, to) => {
      if (to < 0 || to >= inv.lines.length) return;
      const [row] = inv.lines.splice(i, 1);
      inv.lines.splice(to, 0, row);
    };
    document.querySelectorAll('[data-iv-up]').forEach(b => b.onclick = async () => {
      read(); move(Number(b.dataset.ivUp), Number(b.dataset.ivUp) - 1); await commit();
    });
    document.querySelectorAll('[data-iv-down]').forEach(b => b.onclick = async () => {
      read(); move(Number(b.dataset.ivDown), Number(b.dataset.ivDown) + 1); await commit();
    });
    if (sf.$('ivSyncJob')) sf.$('ivSyncJob').onclick = async () => {
      read();
      const j = (sf.state.serviceJobs || []).find(x => String(x.id) === String(inv.serviceJobId));
      if (!j) return;
      j.revenue = this.totals(inv).total;
      j.updatedAt = new Date().toISOString();
      await commit();
    };
  },

  /* ---- the document ---------------------------------------------------------------------- */

  /* His sheet always shows a fixed grid of rows, most of them empty. That is a spreadsheet
     artefact rather than a design choice, so blank rows are padded only up to a minimum — the
     document keeps his shape without printing thirty empty boxes on a two-line invoice. */
  MIN_ROWS: 12,
  sheetHtml(inv){
    const sf = window.SF, cfg = this.settings(), t = this.totals(inv);
    const rows = inv.lines.slice();
    while (rows.length < this.MIN_ROWS) rows.push({ qty: '', itemNo: '', description: '', unitPrice: '', discount: 0 });
    const cell = (l, key) => {
      if (this.isHeading(l) || this.isBlank(l)) return '';
      const v = l[key];
      return (v === '' || v == null) ? '' : this.money(v);
    };
    return `<div class="inv-sheet">
      <table class="inv-head">
        <tr><td class="inv-from"><b>${sf.esc(cfg.fromName)}</b></td>
            <td class="inv-title"><span>INVOICE</span></td></tr>
        <tr><td class="inv-from-address">${sf.esc(cfg.fromAddress).replace(/\n/g, '<br>')}</td>
            <td class="inv-num">INVOICE # ${sf.esc(inv.number)}<br>DATE: ${sf.esc(this.longDate(inv.date)).toUpperCase()}</td></tr>
      </table>
      <table class="inv-to">
        <tr><td class="inv-to-label">TO</td>
            <td class="inv-to-body"><b>${sf.esc(inv.clientName || '')}</b>${inv.clientAddress ? '<br>' + sf.esc(inv.clientAddress).replace(/\n/g, '<br>') : ''}${inv.clientEmail ? '<br>' + sf.esc(inv.clientEmail) : ''}</td>
            <td class="inv-gap"></td>
            <td class="inv-ref"><span class="inv-ref-label">${sf.esc(inv.refLabel || '')}</span><br><b>${sf.esc(inv.refValue || '')}</b></td></tr>
      </table>
      <table class="inv-meta">
        <thead><tr><th>SALESPERSON</th><th>JOB</th><th>SHIPPING METHOD</th><th>SHIPPING TERMS</th>
          <th>DELIVERY DATE</th><th>PAYMENT TERMS</th><th>DUE DATE</th></tr></thead>
        <tbody><tr><td>${sf.esc(inv.salesperson || '')}</td><td>${sf.esc(inv.job || '')}</td>
          <td>${sf.esc(inv.shippingMethod || '')}</td><td>${sf.esc(inv.shippingTerms || '')}</td>
          <td>${sf.esc(this.longDate(inv.deliveryDate))}</td><td>${sf.esc(inv.paymentTerms || '')}</td>
          <td>${sf.esc(inv.dueDate || '')}</td></tr></tbody>
      </table>
      <table class="inv-items">
        <thead><tr><th>QTY</th><th>ITEM #</th><th>DESCRIPTION</th><th>UNIT PRICE</th><th>DISCOUNT</th><th>LINE TOTAL</th></tr></thead>
        <tbody>${rows.map((l, i) => `${
          /* g180 — SPACE BETWEEN EACH DAY'S GROUP.
             Kirk: "they want 1 invoice for the entire multi day event and need all items listed
             per day... I just need a space between each grouping of dates."
             The heading rows already existed (his own 0310 uses them); what was missing was any
             air around them, so four days ran together as one wall of lines. A blank row is
             inserted BEFORE each heading except the first \u2014 leading with a gap would push the
             whole table down and look like a mistake. He can still add his own blank rows; this
             only guarantees the minimum. */
          (this.isHeading(l) && rows.slice(0, i).some(p => !this.isBlank(p)))
            ? '<tr class="inv-daygap"><td colspan="6">&nbsp;</td></tr>' : ''
        }<tr>
          <td class="c">${this.isHeading(l) || this.isBlank(l) ? '' : (Number(l.qty) || '')}</td>
          <td class="c">${sf.esc(l.itemNo || '')}</td>
          <td class="${this.isHeading(l) ? 'inv-day' : ''}">${sf.esc(l.description || '')}</td>
          <td class="r">${cell(l, 'unitPrice')}</td>
          <td class="r">${Number(l.discount) ? this.money(l.discount) : ''}</td>
          <td class="r">${this.isHeading(l) || this.isBlank(l) ? '' : this.money(this.lineTotal(l))}</td>
        </tr>`).join('')}</tbody>
      </table>
      <table class="inv-totals">
        <tr><td class="inv-tot-label">TOTAL DISCOUNT</td><td class="r">${t.discount ? this.money(t.discount) : ''}</td></tr>
        <tr><td class="inv-tot-label">SUBTOTAL</td><td class="r">${this.money(t.subtotal)}</td></tr>
        <tr><td class="inv-tot-label">${sf.esc(cfg.taxLabel)}</td><td class="r">${t.tax ? this.money(t.tax) : ''}</td></tr>
        <tr class="inv-grand"><td class="inv-tot-label">TOTAL</td><td class="r"><b>${this.money(t.total)}</b></td></tr>
      </table>
      ${inv.notes ? `<p class="inv-notes">${sf.esc(inv.notes)}</p>` : ''}
    </div>`;
  },

  /* Printed through the route the Year-End Report and Pack List already use: render into
     #modalRoot, let the existing @media print rule hide everything else, call window.print().
     "Save as PDF" in the printer list is what makes it emailable — no PDF library needed. */
  printInvoice(id){
    const sf = window.SF, inv = this.invoice(id);
    if (!inv) return;
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop inv-modal"><div class="inv-page">
      <div class="no-print row-actions" style="justify-content:flex-end;margin-bottom:10px">
        <span class="help" style="margin-right:auto">In the print dialog choose <b>Save as PDF</b> \u2014 that file is what you email.</span>
        <button class="button secondary" id="invClose">Close</button>
        <button class="button primary" id="invGo">Print / Save PDF</button>
      </div>
      ${this.sheetHtml(inv)}
    </div></div>`;
    sf.$('invClose').onclick = () => sf.closeModal();
    sf.$('invGo').onclick = () => window.print();
  }
};
