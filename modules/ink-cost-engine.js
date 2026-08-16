/* StudioFlow 3.9.0 · Ink Cost Engine -- Phase D1: Printer Profiles & Cartridges
   =========================================================================
   PURPOSE: foundational data for ink cost tracking. This phase only covers
   defining what printers you have and what cartridges are in them right
   now -- it does NOT yet calculate ink cost per print (that's D3), record
   usage snapshots (D2), or connect to recipes/Production Workspace (D4).
   Purely additive: nothing else in the app reads this data yet, so there
   is no regression risk from building it.
   ========================================================================= */
window.SFInkCostEngine = {
  tab: 'printers',
  money(n){ return new Intl.NumberFormat('en-CA',{style:'currency',currency:window.SF.state.business.currency||'CAD'}).format(Number(n||0)) },
  ensure(){
    const s = window.SF.state;
    s.printerProfiles = Array.isArray(s.printerProfiles) ? s.printerProfiles : [];
    s.inkCartridges = Array.isArray(s.inkCartridges) ? s.inkCartridges : [];
    s.inkLevelSnapshots = Array.isArray(s.inkLevelSnapshots) ? s.inkLevelSnapshots : [];
    s.printJobs = Array.isArray(s.printJobs) ? s.printJobs : [];
    s.inkCostEstimates = Array.isArray(s.inkCostEstimates) ? s.inkCostEstimates : [];
    s.inkCoverageFactors = s.inkCoverageFactors && typeof s.inkCoverageFactors === 'object' ? s.inkCoverageFactors : { Light: 0.75, Typical: 1.00, Dark: 1.25 };
  },
  cartridgesFor(printerId){
    return window.SF.state.inkCartridges.filter(c => String(c.printerProfileId) === String(printerId) && c.status !== 'Replaced');
  },
  render(root){
    this.ensure();
    const sf = window.SF, s = sf.state;
    // Always re-query fresh rather than trust the passed-in root -- if the outer page re-rendered
    // between clicks, a captured reference could point at a detached element, making a sub-tab
    // click appear to do nothing even though it technically ran.
    root = sf.$('materialsBody') || root;
    this.subTab = this.subTab || 'printers';
    const printers = s.printerProfiles;
    root.innerHTML = `<div class="ink-subtabs"><button data-inktab="printers" class="${this.subTab==='printers'?'active':''}">Printer Profiles</button><button data-inktab="jobs" class="${this.subTab==='jobs'?'active':''}">Print Jobs</button><button data-inktab="calibration" class="${this.subTab==='calibration'?'active':''}">Calibration</button></div><div id="inkSubBody"></div>`;
    document.querySelectorAll('[data-inktab]').forEach(b => b.onclick = () => { this.subTab = b.dataset.inktab; this.render(root); });
    const body = sf.$('inkSubBody');
    if (this.subTab === 'jobs') return this.renderJobs(body);
    if (this.subTab === 'calibration') return this.renderCalibration(body);
    body.innerHTML = `<section class="card"><div class="toolbar"><div><h3>Printers &amp; Ink</h3><p class="muted">Define your printers and what's currently loaded in them. This is the foundation for ink cost tracking -- calculating actual cost per print comes from the Calibration tab, once print jobs and ink snapshots exist to build on.</p></div><button class="button primary" id="addPrinter">＋ Add Printer</button></div>
      ${printers.length ? printers.map(p => this.printerCard(p)).join('') : '<div class="empty-state roomy">No printers set up yet. Add one to start tracking ink cartridges.</div>'}
    </section>`;
    sf.$('addPrinter').onclick = () => this.openPrinter();
    document.querySelectorAll('[data-edit-printer]').forEach(b => b.onclick = () => this.openPrinter(b.dataset.editPrinter));
    document.querySelectorAll('[data-del-printer]').forEach(b => b.onclick = () => this.deletePrinter(b.dataset.delPrinter));
    document.querySelectorAll('[data-add-cartridge]').forEach(b => b.onclick = () => this.openCartridge(b.dataset.addCartridge));
    document.querySelectorAll('[data-edit-cartridge]').forEach(b => b.onclick = () => this.openCartridge(null, b.dataset.editCartridge));
    document.querySelectorAll('[data-del-cartridge]').forEach(b => b.onclick = () => this.deleteCartridge(b.dataset.delCartridge));
    document.querySelectorAll('[data-snapshot]').forEach(b => b.onclick = () => this.openSnapshot(b.dataset.snapshot));
    document.querySelectorAll('[data-replace-cartridge]').forEach(b => b.onclick = () => this.openReplace(b.dataset.replaceCartridge));
    document.querySelectorAll('[data-undo-replace]').forEach(b => b.onclick = () => this.undoReplace(b.dataset.undoReplace));
    document.querySelectorAll('[data-poll-ink]').forEach(b => b.onclick = () => this.pollInkNow(b.dataset.pollInk));
    document.querySelectorAll('[data-check-jobs]').forEach(b => b.onclick = () => this.checkRecentJobsNow(b.dataset.checkJobs));
  },
  renderJobs(root){
    const sf = window.SF, s = sf.state;
    const catalog = sf.artworkCatalog ? sf.artworkCatalog() : [];
    const jobs = [...s.printJobs].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    root.innerHTML = `<section class="card"><div class="toolbar"><div><h3>Print Jobs</h3><p class="muted">A record of what actually got printed on each printer. Calibration uses these -- alongside two ink snapshots -- to work out real cost. For now this is logged manually; a later phase connects it directly to Production Workspace so it happens automatically.</p></div><button class="button primary" id="addJob">＋ Log Print Job</button></div>
      <div class="commerce-table"><div class="commerce-row header"><span>Date</span><span>Printer</span><span>Artwork</span><span>Size / Qty</span><span>Cost</span><span></span></div>
      ${jobs.length ? jobs.map(j => {
        const printer = s.printerProfiles.find(p => p.id === j.printerProfileId);
        return `<div class="commerce-row"><span>${new Date(j.createdAt).toLocaleDateString()}</span><span>${sf.esc(printer?.name || 'Unknown')}</span><span>${sf.esc(j.artworkTitle || 'Not specified')}${j.jobType==='test'?' <small>(test)</small>':j.jobType==='waste'?' <small class="danger-text">(waste/reprint)</small>':''}${j.productionBatchId?' <small>(from batch)</small>':''}</span><span>${j.width}×${j.height}, qty ${j.quantity}</span><span>${j.calibratedInkCost != null ? `<b>${this.money(j.calibratedInkCost)}</b> <small>calibrated</small>` : j.estimatedInkCost != null ? `${this.money(j.estimatedInkCost)} <small>estimated</small>` : '<small class="muted">not yet costed</small>'}</span><span><button class="mini-edit danger" data-del-job="${j.id}">Delete</button></span></div>`;
      }).join('') : '<div class="empty-state roomy">No print jobs logged yet.</div>'}</div>
    </section>`;
    sf.$('addJob').onclick = () => this.openJob();
    document.querySelectorAll('[data-del-job]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this print job record? This cannot be undone.')) return;
      s.printJobs = s.printJobs.filter(x => x.id !== b.dataset.delJob);
      await sf.persist(); this.renderJobs(root);
    });
  },
  openJob(){
    const sf = window.SF, s = sf.state;
    const catalog = sf.artworkCatalog ? sf.artworkCatalog() : [];
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><form class="modal-card wide" id="jobForm"><h2>Log Print Job</h2><div class="form-grid">
      <label>Printer<select id="jobPrinter">${s.printerProfiles.map(p => `<option value="${p.id}">${sf.esc(p.name)}</option>`).join('') || '<option value="">No printers set up</option>'}</select></label>
      <label>Artwork (optional)<select id="jobArtwork"><option value="">-- Not specified --</option>${catalog.map(a => `<option value="${sf.esc(a.id||a.artworkId)}">${sf.esc(a.title||'Untitled')}</option>`).join('')}</select></label>
      <label>Job Type<select id="jobType"><option value="production">Normal Production</option><option value="test">Test Print</option><option value="waste">Waste / Reprint (error, damage, etc.)</option></select></label>
      <label>Width (in)<input id="jobWidth" type="number" min=".1" step=".1" value="8"></label>
      <label>Height (in)<input id="jobHeight" type="number" min=".1" step=".1" value="10"></label>
      <label>Quantity<input id="jobQty" type="number" min="1" value="1"></label>
      <label>Media type<select id="jobMedia"><option>Luster Paper</option><option>Metallic Luster Paper</option><option>Card Stock</option><option>Canvas</option><option>Other</option></select></label>
      <label>Quality<select id="jobQuality"><option>Standard</option><option>High</option><option>Draft</option></select></label>
      <label>Coverage<select id="jobCoverage"><option value="Typical">Typical Photo</option><option value="Light">Light Coverage</option><option value="Dark">Dark / High Coverage</option></select></label>
      </div><div class="row-actions"><button type="button" class="button secondary" id="jobCancel">Cancel</button><button class="button primary">Save Print Job</button></div></form></div>`;
    sf.$('jobCancel').onclick = () => sf.closeModal();
    sf.$('jobForm').onsubmit = async e => {
      e.preventDefault();
      if (!sf.$('jobPrinter').value) return alert('Add a printer first (Printer Profiles tab).');
      const art = catalog.find(a => String(a.id||a.artworkId) === sf.$('jobArtwork').value);
      const width = Number(sf.$('jobWidth').value) || 0, height = Number(sf.$('jobHeight').value) || 0;
      const rec = { id: sf.makeId('PJOB'), printerProfileId: sf.$('jobPrinter').value, jobType: sf.$('jobType').value, artworkId: sf.$('jobArtwork').value || '', artworkTitle: art?.title || '', width, height, printedArea: width * height, quantity: Math.max(1, Number(sf.$('jobQty').value) || 1), mediaType: sf.$('jobMedia').value, quality: sf.$('jobQuality').value, coverageClass: sf.$('jobCoverage').value, createdAt: new Date().toISOString() };
      // Give it an immediate estimated cost using the configured cost-per-square-inch, if one
      // exists for this printer/media/quality -- calibration will overwrite this later with a
      // real measured cost once a snapshot pair covers it.
      rec.estimatedInkCost = this.estimateJobCost(rec);
      s.printJobs.push(rec);
      sf.logActivity(`Logged print job: ${rec.quantity} × ${width}×${height} (${rec.mediaType})`);
      await sf.persist(); sf.closeModal(); this.render(sf.$('materialsBody'));
    };
  },
  estimateJobCost(job){
    const sf = window.SF;
    const est = sf.state.inkCostEstimates.find(x => String(x.printerProfileId) === String(job.printerProfileId) && x.mediaType === job.mediaType && x.quality === job.quality);
    if (!est) return null;
    return job.printedArea * job.quantity * Number(est.estimatedCostPerSquareInch || 0);
  },
  // ---- Calibration: the core math ----------------------------------------------------------
  // Confidence is deliberately conservative -- this labels the numbers honestly rather than
  // implying precision the data can't support (per the original design principle: estimate
  // honestly at first, measure over time, never overstate certainty).
  confidenceFor(jobCount, snapshotCount){
    if (snapshotCount < 2) return 'Uncalibrated';
    if (jobCount < 5) return 'Early Estimate';
    if (jobCount < 20) return 'Moderate Confidence';
    if (jobCount < 50) return 'Calibrated';
    return 'High Confidence';
  },
  runCalibration(printerId, startSnapId, endSnapId){
    const sf = window.SF, s = sf.state;
    const start = s.inkLevelSnapshots.find(x => x.id === startSnapId);
    const end = s.inkLevelSnapshots.find(x => x.id === endSnapId);
    if (!start || !end) return null;
    const jobs = s.printJobs.filter(j => String(j.printerProfileId) === String(printerId) && j.createdAt >= start.recordedAt && j.createdAt <= end.recordedAt);
    // Cost consumed per cartridge = cartridge cost x percentage used between the two snapshots.
    // Doesn't assume all colours deplete equally -- each cartridge is calculated separately.
    // The maintenance/waste box is excluded here (tracked below instead) -- it collects waste ink
    // from cleaning cycles rather than contributing to what's actually printed, so folding it into
    // per-print cost would overstate every job's real ink cost.
    const cartridgeCosts = start.levels.map(startLevel => {
      const endLevel = end.levels.find(l => l.cartridgeId === startLevel.cartridgeId);
      if (!endLevel) return null;
      const cart = s.inkCartridges.find(c => c.id === startLevel.cartridgeId);
      if (cart?.isMaintenanceBox) return null;
      const percentUsed = Math.max(0, startLevel.percentRemaining - endLevel.percentRemaining);
      const cost = (Number(cart?.purchaseCost || 0)) * (percentUsed / 100);
      return { cartridgeId: startLevel.cartridgeId, colourName: cart?.colourName || 'Unknown', percentUsed, cost };
    }).filter(Boolean);
    // Maintenance box change tracked separately -- reported for awareness (a full box stops the
    // printer), never included in totalCost or distributed across print jobs.
    const maintenanceChange = start.levels.map(startLevel => {
      const cart = s.inkCartridges.find(c => c.id === startLevel.cartridgeId);
      if (!cart?.isMaintenanceBox) return null;
      const endLevel = end.levels.find(l => l.cartridgeId === startLevel.cartridgeId);
      if (!endLevel) return null;
      return { colourName: cart.colourName, from: startLevel.percentRemaining, to: endLevel.percentRemaining };
    }).filter(Boolean)[0] || null;
    const totalCost = cartridgeCosts.reduce((n, c) => n + c.cost, 0);
    // Distribute the measured total across the jobs in this window using weighted printed area --
    // coverage factor is configurable (below); media/quality factors are not yet independently
    // configurable in this phase (flat 1.0), a known simplification worth flagging honestly
    // rather than pretending they're accounted for.
    const weight = j => j.printedArea * j.quantity * Number(s.inkCoverageFactors[j.coverageClass] ?? 1);
    const totalWeight = jobs.reduce((n, j) => n + weight(j), 0);
    jobs.forEach(j => {
      j.calibratedInkCost = totalWeight > 0 ? totalCost * (weight(j) / totalWeight) : 0;
    });
    const confidence = this.confidenceFor(jobs.length, s.inkLevelSnapshots.filter(x => String(x.printerProfileId) === String(printerId)).length);
    return { jobs, cartridgeCosts, totalCost, confidence, start, end, maintenanceChange };
  },
  renderCalibration(root){
    const sf = window.SF, s = sf.state;
    const printers = s.printerProfiles;
    root.innerHTML = `<section class="card"><div class="toolbar"><div><h3>Calibration</h3><p class="muted">Pick a printer and two ink snapshots -- StudioFlow works out how much ink was actually used between them, and distributes that real cost across the print jobs in that window.</p></div></div>
      <div class="form-grid"><label>Printer<select id="calPrinter">${printers.map(p => `<option value="${p.id}">${sf.esc(p.name)}</option>`).join('') || '<option value="">No printers set up</option>'}</select></label></div>
      <div id="calSnapshots"></div>
      <h3>Coverage Factors</h3><p class="muted">Configurable weighting used when distributing measured ink cost across print jobs of different coverage.</p>
      <div class="form-grid">${Object.keys(s.inkCoverageFactors).map(k => `<label>${sf.esc(k)}<input class="calFactor" data-factor="${sf.esc(k)}" type="number" min="0" step=".01" value="${s.inkCoverageFactors[k]}"></label>`).join('')}</div>
      <button class="button secondary" id="saveFactors">Save Coverage Factors</button>
      <div id="calResult"></div>
    </section>`;
    const renderSnapshotPicker = () => {
      const printerId = sf.$('calPrinter').value;
      const snaps = s.inkLevelSnapshots.filter(x => String(x.printerProfileId) === String(printerId)).sort((a,b) => new Date(a.recordedAt) - new Date(b.recordedAt));
      sf.$('calSnapshots').innerHTML = snaps.length >= 2 ? `<div class="form-grid"><label>Starting snapshot<select id="calStart">${snaps.map(x => `<option value="${x.id}">${new Date(x.recordedAt).toLocaleString()} (${x.kind})</option>`).join('')}</select></label><label>Ending snapshot<select id="calEnd">${snaps.map((x,i) => `<option value="${x.id}" ${i===snaps.length-1?'selected':''}>${new Date(x.recordedAt).toLocaleString()} (${x.kind})</option>`).join('')}</select></label></div><button class="button primary" id="runCal">Run Calibration</button>` : `<p class="muted">This printer needs at least 2 ink snapshots to calibrate. Record levels from the Printer Profiles tab first.</p>`;
      if (snaps.length >= 2) sf.$('runCal').onclick = () => {
        const result = this.runCalibration(printerId, sf.$('calStart').value, sf.$('calEnd').value);
        this.renderCalibrationResult(result);
      };
    };
    if (printers.length) { sf.$('calPrinter').onchange = renderSnapshotPicker; renderSnapshotPicker(); }
    sf.$('saveFactors').onclick = async () => {
      document.querySelectorAll('.calFactor').forEach(i => { s.inkCoverageFactors[i.dataset.factor] = Number(i.value) || 1; });
      await sf.persist();
      sf.logActivity('Updated ink coverage factors');
      alert('Coverage factors saved.');
    };
  },
  renderCalibrationResult(result){
    const sf = window.SF;
    const box = sf.$('calResult');
    if (!result) { box.innerHTML = ''; return; }
    if (!result.jobs.length) {
      box.innerHTML = `<div class="notice"><p class="muted">No print jobs were logged for this printer between those two snapshots -- nothing to distribute cost across. Total ink cost measured (${this.money(result.totalCost)}) has no jobs to apply to for this window.</p></div>`;
      return;
    }
    box.innerHTML = `<div class="notice">
      <p><b>Ink Cost Confidence: ${sf.esc(result.confidence)}</b><br><small class="muted">Based on ${result.jobs.length} print job${result.jobs.length===1?'':'s'} and ${sf.state.inkLevelSnapshots.filter(x=>String(x.printerProfileId)===String(sf.$('calPrinter').value)).length} ink snapshot${sf.state.inkLevelSnapshots.filter(x=>String(x.printerProfileId)===String(sf.$('calPrinter').value)).length===1?'':'s'} for this printer.</small></p>
      ${result.maintenanceChange?`<h4>Maintenance Box</h4><p class="${result.maintenanceChange.to>=80?'danger-text':'muted'}">${sf.esc(result.maintenanceChange.colourName)}: ${result.maintenanceChange.from}% → ${result.maintenanceChange.to}%${result.maintenanceChange.to>=80?' -- getting full, a full maintenance box stops the printer. Have a replacement ready.':''} <small>(not included in ink cost -- doesn't contribute to what's printed. Assumes higher % means more full/used, not remaining capacity -- let me know if your readings suggest otherwise.)</small></p>`:''}
      <h4>Cartridge usage this period</h4>
      <ul class="pw-materials">${result.cartridgeCosts.map(c => `<li class="pw-ok">${sf.esc(c.colourName)}: ${Math.round(c.percentUsed*10)/10}% used, ${this.money(c.cost)}</li>`).join('')}</ul>
      <p><b>Total ink cost this period: ${this.money(result.totalCost)}</b></p>
      <h4>Distributed across print jobs</h4>
      <ul class="pw-materials">${result.jobs.map(j => `<li class="pw-ok">${j.width}×${j.height} × ${j.quantity} (${sf.esc(j.mediaType)}, ${sf.esc(j.coverageClass)}): <b>${this.money(j.calibratedInkCost)}</b></li>`).join('')}</ul>
      <div class="row-actions"><button class="button primary" id="saveCalibration">Save These Results to Print Jobs</button></div>
    </div>`;
    sf.$('saveCalibration').onclick = async () => {
      await sf.persist();
      sf.logActivity(`Ran ink calibration: ${this.money(result.totalCost)} across ${result.jobs.length} print jobs`);
      alert('Calibration saved. Print job costs are updated.');
    };
  },
  // ---- Called from Production Workspace (D4): estimate ink cost for a recipe + size ----------
  // Prefers real calibrated data (average cost-per-square-inch from recent calibrated print jobs
  // on the same printer/media) over the manually configured estimate, since it's more accurate
  // once it exists. Falls back honestly to "no data" rather than guessing at a number.
  estimateForRecipe(recipe, sizeStr){
    this.ensure();
    const sf = window.SF, s = sf.state;
    if (!recipe?.printerProfileId) return null;
    const m = String(sizeStr || '').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    if (!m) return null;
    const area = Number(m[1]) * Number(m[2]);
    const printerId = recipe.printerProfileId, media = recipe.inkMediaType;
    const calibratedJobs = s.printJobs.filter(j => String(j.printerProfileId) === String(printerId) && (!media || j.mediaType === media) && j.calibratedInkCost != null && j.printedArea > 0);
    const snapshotCount = s.inkLevelSnapshots.filter(x => String(x.printerProfileId) === String(printerId)).length;
    const confidence = this.confidenceFor(calibratedJobs.length, snapshotCount);
    if (calibratedJobs.length) {
      const avgCostPerSqIn = calibratedJobs.reduce((n, j) => n + (j.calibratedInkCost / (j.printedArea * j.quantity)), 0) / calibratedJobs.length;
      return { cost: avgCostPerSqIn * area, confidence, label: 'Calibrated Ink Cost' };
    }
    const est = s.inkCostEstimates.find(x => String(x.printerProfileId) === String(printerId) && x.mediaType === media);
    if (est) return { cost: area * Number(est.estimatedCostPerSquareInch || 0), confidence: 'Uncalibrated', label: 'Estimated Ink Cost' };
    return null;
  },
  printerCard(p){
    const sf = window.SF;
    const cartridges = this.cartridgesFor(p.id);
    const replaced = sf.state.inkCartridges.filter(c => String(c.printerProfileId) === String(p.id) && c.status === 'Replaced');
    const snapshots = sf.state.inkLevelSnapshots.filter(x => String(x.printerProfileId) === String(p.id)).sort((a,b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    const last = snapshots[0];
    return `<div class="ink-printer-card">
      <div class="commerce-toolbar"><div><b>${sf.esc(p.name)}</b><small>${sf.esc([p.manufacturer, p.model].filter(Boolean).join(' · ') || 'No manufacturer/model set')}</small></div><div class="row-actions"><button class="mini-edit" data-edit-printer="${p.id}">Edit</button><button class="mini-edit danger" data-del-printer="${p.id}">Delete</button></div></div>
      <div class="ink-cartridge-list">${cartridges.length ? cartridges.map(c => `<div class="ink-cartridge-row"><span><b>${sf.esc(c.colourName)}</b>${c.isMaintenanceBox?' <small>(Maintenance)</small>':''}<small>${sf.esc(c.cartridgeCode || 'No code on file')}</small></span><span>${Number(c.currentPercent ?? 100)}%${c.isMaintenanceBox?' used':' remaining'}</span><span>${sf.esc(c.installedAt ? new Date(c.installedAt).toLocaleDateString() : 'No install date')}</span><span class="row-actions"><button class="mini-edit" data-edit-cartridge="${c.id}">Edit</button><button class="mini-edit" data-replace-cartridge="${c.id}">Replace</button><button class="mini-edit danger" data-del-cartridge="${c.id}">Remove</button></span></div>`).join('') : '<div class="empty-state">No cartridges recorded for this printer yet.</div>'}</div>
      <div class="row-actions"><button class="button secondary" data-add-cartridge="${p.id}">＋ Add Cartridge</button>${cartridges.length ? `<button class="button primary" data-snapshot="${p.id}">Record Ink Levels</button>` : ''}${p.ipAddress ? `<button class="button secondary" data-poll-ink="${p.id}">Poll Ink Levels Now (experimental)</button>` : ''}${p.windowsPrinterName ? `<button class="button secondary" data-check-jobs="${p.id}">Check for Recent Print Jobs</button>` : ''}</div>
      <p class="muted ink-snapshot-status">${last ? `Last recorded: ${new Date(last.recordedAt).toLocaleString()} (${last.kind || 'periodic'})` : 'No ink level snapshot recorded yet -- record a baseline once cartridges are set up.'}</p>
      ${replaced.length ? `<details class="ink-replaced-history"><summary>Replaced cartridges (${replaced.length}) -- if one was replaced by mistake, undo or delete it here</summary><div class="ink-cartridge-list">${replaced.map(c => `<div class="ink-cartridge-row"><span><b>${sf.esc(c.colourName)}</b><small>${sf.esc(c.cartridgeCode || 'No code on file')}</small></span><span>Final: ${Number(c.finalPercent ?? c.currentPercent ?? 0)}%</span><span>Replaced ${c.replacedAt ? new Date(c.replacedAt).toLocaleDateString() : ''}</span><span class="row-actions"><button class="mini-edit" data-undo-replace="${c.id}">Undo Replace</button><button class="mini-edit danger" data-del-cartridge="${c.id}">Delete</button></span></div>`).join('')}</div></details>` : ''}
    </div>`;
  },
  openPrinter(id=''){
    const sf = window.SF;
    const p = sf.state.printerProfiles.find(x => x.id === id) || {};
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><form class="modal-card" id="printerForm"><h2>${id ? 'Edit Printer' : 'Add Printer'}</h2><label>Name<input id="prName" required value="${sf.esc(p.name || '')}" placeholder="Studio Epson, Front Desk Canon..."></label><label>Manufacturer<input id="prMake" value="${sf.esc(p.manufacturer || '')}"></label><label>Model<input id="prModel" value="${sf.esc(p.model || '')}"></label>
      <h3>Direct Connection (optional, experimental)</h3><p class="muted">If your printer is on Wi-Fi/Ethernet (not just USB), this lets StudioFlow read ink levels and notice recent print jobs directly, instead of relying only on manual entry. This is genuinely experimental -- support varies by printer, and it needs testing against your real device.</p>
      <label>Printer IP address<input id="prIp" value="${sf.esc(p.ipAddress || '')}" placeholder="e.g. 192.168.1.50"></label>
      <label>Windows printer queue name (for print job detection)<input id="prWinName" value="${sf.esc(p.windowsPrinterName || '')}" placeholder="Exact name as shown in Windows Printers & Scanners"></label>
      <label>Notes<textarea id="prNotes">${sf.esc(p.notes || '')}</textarea></label><div class="row-actions"><button type="button" class="button secondary" id="prCancel">Cancel</button><button class="button primary">${id ? 'Save Printer' : 'Add Printer'}</button></div></form></div>`;
    sf.$('prCancel').onclick = () => sf.closeModal();
    sf.$('printerForm').onsubmit = async e => {
      e.preventDefault();
      const rec = { ...p, id: p.id || sf.makeId('PRINTER'), name: sf.$('prName').value.trim(), manufacturer: sf.$('prMake').value.trim(), model: sf.$('prModel').value.trim(), ipAddress: sf.$('prIp').value.trim(), windowsPrinterName: sf.$('prWinName').value.trim(), notes: sf.$('prNotes').value.trim(), createdAt: p.createdAt || new Date().toISOString() };
      const i = sf.state.printerProfiles.findIndex(x => x.id === rec.id);
      if (i >= 0) sf.state.printerProfiles[i] = rec; else sf.state.printerProfiles.push(rec);
      sf.logActivity(`${id ? 'Updated' : 'Added'} printer: ${rec.name}`);
      await sf.persist(); sf.closeModal(); this.render(sf.$('materialsBody'));
    };
  },
  deletePrinter(id){
    const sf = window.SF;
    const p = sf.state.printerProfiles.find(x => x.id === id);
    if (!p) return;
    const cartridgeCount = this.cartridgesFor(id).length;
    if (!confirm(`Delete "${p.name}"?${cartridgeCount ? ` This also removes ${cartridgeCount} cartridge record(s) for it.` : ''} This cannot be undone.`)) return;
    sf.state.printerProfiles = sf.state.printerProfiles.filter(x => x.id !== id);
    sf.state.inkCartridges = sf.state.inkCartridges.filter(c => String(c.printerProfileId) !== String(id));
    sf.logActivity(`Deleted printer: ${p.name}`);
    sf.persist(); this.render(sf.$('materialsBody'));
  },
  openCartridge(printerId, cartridgeId=''){
    const sf = window.SF;
    const c = cartridgeId ? sf.state.inkCartridges.find(x => x.id === cartridgeId) : {};
    const pid = printerId || c?.printerProfileId;
    const printer = sf.state.printerProfiles.find(x => x.id === pid);
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><form class="modal-card" id="cartridgeForm"><h2>${cartridgeId ? 'Edit Cartridge' : 'Add Cartridge'}</h2><p class="muted">${sf.esc(printer?.name || '')}</p><label>Colour / Name<input id="crColour" required value="${sf.esc(c.colourName || '')}" placeholder="Cyan, Magenta, Yellow, Black, Photo Black, Light Cyan, Maintenance Box..."></label><label class="checkline"><input id="crIsMaintenance" type="checkbox" ${c.isMaintenanceBox?'checked':''}> This is the maintenance/waste ink box, not a colour cartridge</label><p class="muted">The maintenance box collects waste ink from cleaning cycles -- it's tracked (and warned about, since a full box stops the printer) but excluded from per-print ink cost, since it doesn't contribute ink to what's actually on the page.</p><label>Cartridge code (optional)<input id="crCode" value="${sf.esc(c.cartridgeCode || '')}"></label><label>Purchase cost<input id="crCost" type="number" min="0" step=".01" value="${Number(c.purchaseCost || 0)}"></label><label>Rated page yield <small class="muted">\u2014 from the box</small><input id="crYield" type="number" min="0" step="1" value="${Number(c.ratedYield || 0)}" placeholder="e.g. 1400"></label><label>Rated at coverage <input id="crCoverage" type="number" min="1" max="100" step="1" value="${Number(c.ratedCoverage || 5)}">%<span class="help">Manufacturers rate toner at 5% coverage (ISO/IEC 19798) \u2014 ordinary text. Leave it at 5 unless the box says otherwise.</span></label><label>Current level (%)<input id="crPercent" type="number" min="0" max="100" step="1" value="${Number(c.currentPercent ?? 100)}"></label><label>Installed date<input id="crInstalled" type="date" value="${(c.installedAt || new Date().toISOString()).slice(0,10)}"></label><div class="row-actions"><button type="button" class="button secondary" id="crCancel">Cancel</button><button class="button primary">${cartridgeId ? 'Save Cartridge' : 'Add Cartridge'}</button></div></form></div>`;
    sf.$('crCancel').onclick = () => sf.closeModal();
    sf.$('cartridgeForm').onsubmit = async e => {
      e.preventDefault();
      const rec = { ...c, id: c.id || sf.makeId('CART'), printerProfileId: pid, colourName: sf.$('crColour').value.trim(), isMaintenanceBox: sf.$('crIsMaintenance').checked, cartridgeCode: sf.$('crCode').value.trim(), purchaseCost: Number(sf.$('crCost').value) || 0, ratedYield: Number(sf.$('crYield')?.value) || 0, ratedCoverage: Math.max(1, Math.min(100, Number(sf.$('crCoverage')?.value) || 5)), currentPercent: Math.max(0, Math.min(100, Number(sf.$('crPercent').value) || 0)), installedAt: sf.$('crInstalled').value, status: 'Active', createdAt: c.createdAt || new Date().toISOString() };
      const i = sf.state.inkCartridges.findIndex(x => x.id === rec.id);
      if (i >= 0) sf.state.inkCartridges[i] = rec; else sf.state.inkCartridges.push(rec);
      sf.logActivity(`${cartridgeId ? 'Updated' : 'Added'} cartridge: ${rec.colourName} (${printer?.name || 'printer'})`);
      await sf.persist(); sf.closeModal(); this.render(sf.$('materialsBody'));
    };
  },
  deleteCartridge(id){
    const sf = window.SF;
    const c = sf.state.inkCartridges.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`Remove this cartridge (${c.colourName})? This cannot be undone.`)) return;
    sf.state.inkCartridges = sf.state.inkCartridges.filter(x => x.id !== id);
    sf.logActivity(`Removed cartridge: ${c.colourName}`);
    sf.persist(); this.render(sf.$('materialsBody'));
  },

  openSnapshot(printerId){
    const sf = window.SF;
    const printer = sf.state.printerProfiles.find(x => x.id === printerId);
    const cartridges = this.cartridgesFor(printerId);
    const hasBaseline = sf.state.inkLevelSnapshots.some(x => String(x.printerProfileId) === String(printerId));
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><form class="modal-card wide" id="snapForm"><h2>Record Ink Levels</h2><p class="muted">${sf.esc(printer?.name || '')}</p><label>Snapshot type<select id="snapKind"><option value="periodic">Periodic reading</option>${!hasBaseline ? '<option value="baseline" selected>Initial baseline</option>' : ''}<option value="correction">Manual correction</option></select></label><div class="ink-cartridge-list">${cartridges.map(c => `<div class="ink-cartridge-row"><span><b>${sf.esc(c.colourName)}</b></span><span></span><span><input type="number" min="0" max="100" step="1" class="snapPercent" data-cart="${c.id}" value="${Number(c.currentPercent ?? 100)}"> %</span><span></span></div>`).join('')}</div><div class="row-actions"><button type="button" class="button secondary" id="snapCancel">Cancel</button><button class="button primary">Save Snapshot</button></div></form></div>`;
    sf.$('snapCancel').onclick = () => sf.closeModal();
    sf.$('snapForm').onsubmit = async e => {
      e.preventDefault();
      const now = new Date().toISOString();
      const levels = [...document.querySelectorAll('.snapPercent')].map(i => ({ cartridgeId: i.dataset.cart, percentRemaining: Math.max(0, Math.min(100, Number(i.value) || 0)) }));
      sf.state.inkLevelSnapshots.push({ id: sf.makeId('SNAP'), printerProfileId: printerId, recordedAt: now, kind: sf.$('snapKind').value, levels });
      levels.forEach(l => {
        const c = sf.state.inkCartridges.find(x => x.id === l.cartridgeId);
        if (c) c.currentPercent = l.percentRemaining;
      });
      sf.logActivity(`Recorded ink levels for ${printer?.name || 'printer'}`);
      await sf.persist(); sf.closeModal(); this.render(sf.$('materialsBody'));
    };
  },
  openReplace(cartridgeId){
    const sf = window.SF;
    const c = sf.state.inkCartridges.find(x => x.id === cartridgeId);
    if (!c) return;
    const printer = sf.state.printerProfiles.find(x => x.id === c.printerProfileId);
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><form class="modal-card" id="replaceForm"><h2>Replace Cartridge</h2><p class="muted">${sf.esc(printer?.name || '')} · ${sf.esc(c.colourName)}</p><label>Previous level when replaced (%)<input id="repPrevPercent" type="number" min="0" max="100" step="1" value="${Number(c.currentPercent ?? 100)}"></label><label class="checkline"><input id="repWasEmpty" type="checkbox"> This cartridge was empty (treat as fully consumed, regardless of the number above)</label><label>Replacement date<input id="repDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>New cartridge cost<input id="repCost" type="number" min="0" step=".01" value="${Number(c.purchaseCost || 0)}"></label><label>New cartridge code (optional)<input id="repCode"></label><label>Supplier<input id="repSupplier" value="${sf.esc(c.supplier || '')}"></label><div class="row-actions"><button type="button" class="button secondary" id="repCancel">Cancel</button><button class="button primary">Replace Cartridge</button></div></form></div>`;
    sf.$('repCancel').onclick = () => sf.closeModal();
    sf.$('replaceForm').onsubmit = async e => {
      e.preventDefault();
      const now = new Date().toISOString();
      const wasEmpty = sf.$('repWasEmpty').checked;
      c.status = 'Replaced';
      c.replacedAt = now;
      c.finalPercent = wasEmpty ? 0 : Math.max(0, Math.min(100, Number(sf.$('repPrevPercent').value) || 0));
      const fresh = { id: sf.makeId('CART'), printerProfileId: c.printerProfileId, colourName: c.colourName, cartridgeCode: sf.$('repCode').value.trim(), purchaseCost: Number(sf.$('repCost').value) || 0, currentPercent: 100, installedAt: sf.$('repDate').value, supplier: sf.$('repSupplier').value.trim(), status: 'Active', replacedFromId: c.id, createdAt: now };
      sf.state.inkCartridges.push(fresh);
      sf.logActivity(`Replaced cartridge: ${c.colourName} (${printer?.name || 'printer'})`);
      await sf.persist(); sf.closeModal(); this.render(sf.$('materialsBody'));
    };
  },

  async pollInkNow(printerId){
    const sf = window.SF;
    const p = sf.state.printerProfiles.find(x => x.id === printerId);
    if (!p) return;
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal-card"><h2>Polling ${sf.esc(p.name)}...</h2><p class="muted">Querying ${sf.esc(p.ipAddress)} via SNMP. This can take a few seconds.</p></div></div>`;
    const result = await sf.api.printerPollInkLevels({ ipAddress: p.ipAddress });
    if (!result?.ok) {
      sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal-card"><h2>Couldn't read ink levels</h2><p class="danger-text">${sf.esc(result?.error || 'Unknown error')}</p><p class="muted">This is expected if the printer doesn't support the standard SNMP status this checks for, or if it's not reachable on the network right now. Manual entry (Record Ink Levels) still works regardless.</p><div class="row-actions"><button class="button primary" id="pollClose">Close</button></div></div></div>`;
      sf.$('pollClose').onclick = () => sf.closeModal();
      return;
    }
    const cartridges = this.cartridgesFor(printerId);
    // Show what was read, but don't auto-save -- this is the first real test against actual
    // hardware, and automatic name-matching between SNMP's supply descriptions and your own
    // cartridge names could easily be wrong. You confirm/map before anything is saved.
    /* g157 — WHY KIRK ONLY SAW "Don't save this one". That dropdown lists the cartridges DEFINED ON
       THIS PRINTER PROFILE, and he had none, so the placeholder was the only option and the poll
       was a dead end with nothing explaining it. Now: when a profile has no cartridges, each
       reading offers CREATE instead of a match, so the first poll is what sets the printer up.
       The wording follows the hardware too — a laser has TONER, and calling it ink on a page about
       cost tracking is the kind of small wrongness that makes someone doubt the numbers. */
    const noCarts = !cartridges.length;
    const isToner = result.supplies.some(x => /toner|drum|waste/i.test(String(x.colourName || ''))) || !!p.isLaser;
    const word = isToner ? 'Toner' : 'Ink';
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal-card wide"><h2>${word} Levels Read From ${sf.esc(p.name)}</h2>
      <p class="muted">${noCarts
        ? `This printer has no ${word.toLowerCase()} cartridges set up yet. Tick the ones you want to create from these readings \u2014 that is what the cost tracking counts down.`
        : 'Review before saving -- match each reading to the right cartridge. Nothing is saved yet.'}</p>
      <div class="ink-cartridge-list">${result.supplies.map((s,i) => `<div class="ink-cartridge-row"><span><b>${sf.esc(s.colourName)}</b>${s.supplyClass === 'filled' ? '<br><small class="muted">a waste container, not a colour</small>' : ''}</span><span>${s.percent != null ? s.percent + '%' : '<span class="muted">not reported</span>'}${s.note ? `<br><small class="muted">${sf.esc(s.note)}</small>` : ''}</span><span>${noCarts
        ? `<label class="checkline"><input type="checkbox" class="pollCreate" data-idx="${i}" ${s.supplyClass === 'filled' ? '' : 'checked'}> Create this cartridge</label>`
        : `<select class="pollMatch" data-idx="${i}"><option value="">Don't save this one</option>${cartridges.map(c => `<option value="${c.id}">${sf.esc(c.colourName)}</option>`).join('')}</select>`}</span><span></span></div>`).join('') || '<div class="empty-state">Printer responded but reported no supplies.</div>'}</div>
      ${result.supplies.every(x => x.percent === 100) ? `<p class="help"><b>Every supply reads 100%.</b> Many laser printers report full until a low-toner sensor trips, so this is usually the printer being coarse rather than a fault \u2014 and it means polled levels cannot measure real usage on this machine. Cost per page from the cartridge's rated yield, or the calibration below, will be more honest than these readings.</p>` : ''}<div class="row-actions"><button class="button secondary" id="pollCancel">Cancel</button><button class="button primary" id="pollSave">Save as Snapshot</button></div></div></div>`;
    sf.$('pollCancel').onclick = () => sf.closeModal();
    sf.$('pollSave').onclick = async () => {
      const levels = [];
      /* First poll on a bare profile: create the cartridges from what the printer named, so the
         reading has somewhere to go. Yield and price are left for him — the printer does not know
         what he paid, and a made-up figure would quietly become his cost per page. */
      document.querySelectorAll('.pollCreate').forEach(box => {
        if (!box.checked) return;
        const idx = Number(box.dataset.idx), sup = result.supplies[idx];
        if (!sup) return;
        const cart = { id: sf.makeId('CART'), printerProfileId: printerId,
          colourName: sup.colourName || `Supply ${idx + 1}`,
          currentPercent: sup.percent != null ? sup.percent : 100,
          pageYield: 0, price: 0, installedAt: new Date().toISOString(), createdFrom: 'snmp-poll' };
        sf.state.inkCartridges.push(cart);
        if (sup.percent != null) levels.push({ cartridgeId: cart.id, percentRemaining: sup.percent });
      });
      document.querySelectorAll('.pollMatch').forEach(sel => {
        if (!sel.value) return;
        const idx = Number(sel.dataset.idx);
        const percent = result.supplies[idx]?.percent;
        if (percent != null) levels.push({ cartridgeId: sel.value, percentRemaining: percent });
      });
      if (!levels.length) {
        alert(document.querySelectorAll('.pollCreate').length
          ? 'Nothing was ticked, or the printer gave no percentages to record.'
          : 'Nothing matched to save.');
        return;
      }
      const now = new Date().toISOString();
      sf.state.inkLevelSnapshots.push({ id: sf.makeId('SNAP'), printerProfileId: printerId, recordedAt: now, kind: 'auto-polled', levels });
      levels.forEach(l => { const c = sf.state.inkCartridges.find(x => x.id === l.cartridgeId); if (c) c.currentPercent = l.percentRemaining; });
      sf.logActivity(`Recorded ink levels for ${p.name} (auto-polled via SNMP)`);
      await sf.persist(); sf.closeModal(); this.render(sf.$('materialsBody'));
    };
  },
  async checkRecentJobsNow(printerId){
    const sf = window.SF;
    const p = sf.state.printerProfiles.find(x => x.id === printerId);
    if (!p) return;
    const result = await sf.api.printerCheckRecentJobs({ windowsPrinterName: p.windowsPrinterName, sinceIso: p.lastJobCheckAt });
    if (!result?.ok) {
      alert(`Couldn't check recent print jobs: ${result?.error || 'Unknown error'}`);
      return;
    }
    p.lastJobCheckAt = new Date().toISOString();
    sf.persist();
    if (!result.jobs.length) { alert('No recent print jobs found for this printer since the last check.'); return; }
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal-card wide"><h2>Recent Print Jobs Detected</h2><p class="muted">Found in the Windows print queue -- this is a safety net to notice printing happened, not a full replacement for logging details. If any of these weren't already logged in Print Jobs, add them manually with real size/media info for accurate ink tracking.</p><div class="commerce-table">${result.jobs.map(j => `<div class="commerce-row"><span>${sf.esc(j.documentName || 'Unknown document')}</span><span>${j.submittedTime ? new Date(j.submittedTime).toLocaleString() : ''}</span><span>${j.pages || '?'} page(s)</span></div>`).join('')}</div><div class="row-actions"><button class="button primary" id="jobsClose">Close</button></div></div></div>`;
    sf.$('jobsClose').onclick = () => sf.closeModal();
  },
  undoReplace(oldCartridgeId){
    const sf = window.SF;
    const old = sf.state.inkCartridges.find(x => x.id === oldCartridgeId);
    if (!old) return;
    const replacement = sf.state.inkCartridges.find(x => x.replacedFromId === oldCartridgeId);
    if (!confirm(`Undo replacing "${old.colourName}"?${replacement ? ' This also removes the cartridge that was created to replace it.' : ''}`)) return;
    old.status = 'Active';
    delete old.replacedAt;
    delete old.finalPercent;
    if (replacement) sf.state.inkCartridges = sf.state.inkCartridges.filter(x => x.id !== replacement.id);
    sf.logActivity(`Undid cartridge replacement: ${old.colourName}`);
    sf.persist(); this.render(sf.$('materialsBody'));
  },
};
