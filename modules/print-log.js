/* StudioFlow g130 — ONE PLACE THAT RECORDS PAPER AND INK.
   =======================================================
   Kirk wants the print tracking to be as accurate as possible. The honest obstacle: a browser never
   tells an application whether the person pressed Print or Cancel, and never how many copies they
   asked for. onafterprint fires either way. So a run logged automatically is a guess, and a guess
   in a cost record is worse than no record — it quietly drifts and he would have no way to know.

   So this asks. After the print dialog closes, a small panel appears with the sheet count already
   filled in and the paper he used last time already selected. Confirm and it is recorded; dismiss
   and nothing is. One key press either way, and what lands in the ledger is what actually came out
   of the printer — including the times he printed two copies, or the paper jammed and he ran it
   again.

   Everything is written to state.printJobs, the record production-workspace.js already writes and
   Print Production and the ink cost engine already read. No second ledger. */
window.SFPrintLog = {
  MEDIA: ['Plain paper', 'Cardstock', 'Matte photo paper', 'Luster photo paper', 'Label stock'],

  prefs(){
    const s = window.SF.state;
    if (!s.printLogPrefs || typeof s.printLogPrefs !== 'object') s.printLogPrefs = {};
    return s.printLogPrefs;
  },

  /* opts: { label, sheets, areaPerSheet, coverage, source, media }
     areaPerSheet is the INKED square inches on one sheet — not the sheet size. The ink engine costs
     by area, and a sheet of price cards inks about 40% of itself; charging it for the whole page
     would overstate the ink by more than half. */
  ask(opts){
    const sf = window.SF, p = this.prefs();
    const label = opts.label || 'Print run';
    const sheets = Math.max(1, Number(opts.sheets) || 1);
    const media = opts.media || p.lastMedia || 'Plain paper';
    const profiles = sf.state.printerProfiles || [];

    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal">
      <h3>Record this print run?</h3>
      <p class="muted">${sf.esc(label)}. StudioFlow cannot tell whether the print actually went
      through, so nothing is recorded unless you say so \u2014 and you can correct the numbers if
      you printed more than one copy, or had to run it again.</p>
      <div class="form-grid">
        <label>Sheets printed<input id="plSheets" type="number" min="0" step="1" value="${sheets}"></label>
        <label>Paper<select id="plMedia">${this.MEDIA.map(m =>
          `<option ${m === media ? 'selected' : ''}>${sf.esc(m)}</option>`).join('')}</select></label>
        ${profiles.length > 1 ? `<label>Printer<select id="plProfile">${profiles.map(pr =>
          `<option value="${sf.esc(pr.id)}" ${pr.id === p.lastProfile ? 'selected' : ''}>${sf.esc(pr.name || 'Printer')}</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="modal-footer">
        <button class="button secondary" id="plSkip">Don't record</button>
        <button class="button primary" id="plSave">Record it</button>
      </div></div></div>`;

    return new Promise(resolve => {
      const done = v => { sf.closeModal(); resolve(v); };
      sf.$('plSkip').onclick = () => done(null);
      sf.$('plSave').onclick = async () => {
        const n = Math.max(0, Number(sf.$('plSheets').value) || 0);
        if (!n) return done(null);                       // zero sheets is a decision not to record
        const chosenMedia = sf.$('plMedia').value;
        const chosenProfile = sf.$('plProfile') ? sf.$('plProfile').value
          : ((sf.state.printerProfiles || [])[0] || {}).id || '';
        p.lastMedia = chosenMedia;
        if (chosenProfile) p.lastProfile = chosenProfile;
        const job = this.record(Object.assign({}, opts, {
          sheets: n, media: chosenMedia, profileId: chosenProfile
        }));
        await sf.persist();
        sf.logActivity?.(`${label}: ${n} sheet(s) recorded`);
        done(job);
      };
      sf.$('plSheets').focus(); sf.$('plSheets').select();
    });
  },

  record(opts){
    const sf = window.SF;
    if (!Array.isArray(sf.state.printJobs)) sf.state.printJobs = [];
    const sheets = Math.max(1, Number(opts.sheets) || 1);
    const area = Math.max(0, Number(opts.areaPerSheet) || 0) * sheets;
    const job = {
      id: sf.makeId('PJOB'),
      printerProfileId: opts.profileId || '',
      /* Blank on purpose: these are not a photograph, and an artwork id here would corrupt the
         per-piece print history the Production Plan and Intelligence tab read. */
      artworkId: '',
      artworkTitle: opts.label || 'Print run',
      width: 8.5, height: 11,
      printedArea: Number(area.toFixed(2)),
      quantity: sheets,
      mediaType: opts.media || 'Plain paper',
      quality: 'Standard',
      coverageClass: opts.coverage || 'Typical',
      orderId: '',
      source: opts.source || 'print-log',
      createdAt: new Date().toISOString()
    };
    sf.state.printJobs.push(job);
    return job;
  },

  /* Print, then ask — wired in one call so every caller behaves the same. */
  async printAndLog(opts){
    window.print();
    await new Promise(r => setTimeout(r, 350));          // let the dialog finish closing
    return this.ask(opts);
  }
};
