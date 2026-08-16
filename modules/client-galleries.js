/* StudioFlow g176 · CLIENT GALLERIES
   =========================================================================================
   Template v26 ships the reading half — client.html takes a passphrase, decrypts a manifest and
   shows the pictures. Nothing could WRITE one, so the feature existed and could not be used.
   This is the other half: define a gallery here, and the export seals it.

   THE THINGS THAT MATTER, in the order they can hurt him:

   1. THE PASSPHRASE CANNOT BE RECOVERED. It is not stored in the exported site — only the
      client's copy and the record kept here. If it is lost the gallery must be re-sealed from
      scratch. So it is kept ON the gallery record rather than being something he has to
      remember, and the page says plainly that it is the only copy.

   2. THE GATE TEXT IS PUBLIC. `title` and `hint` sit unencrypted beside the sealed blob so the
      passphrase screen can say who the gallery is for before anyone types anything. That is
      their purpose and also the trap: a hint reading "your wedding date" is fine, one reading
      "14061998" is the passphrase written on the door.

   3. THE PASSPHRASE IS TYPED BY SOMEONE ON A PHONE, probably reading it off a text message. So
      the suggestion is three ordinary words and a number — wild-heron-42 — not a random string.
      A passphrase that is hard to type gets pasted into a group chat.
   ========================================================================================= */
window.SFClientGalleries = {

  store(){
    const s = window.SF.state;
    if (!Array.isArray(s.clientGalleries)) s.clientGalleries = [];
    return s.clientGalleries;
  },
  gallery(id){ return this.store().find(g => String(g.id) === String(id)) || null; },

  /* ---- passphrases ----------------------------------------------------------------------- */

  /* Ordinary, readable words. No l/1/O/0 confusions, nothing that reads oddly in a message to a
     client, and short enough to type on a phone without a second attempt. */
  WORDS: ['amber','anchor','autumn','birch','bramble','breeze','cedar','copper','coral','cove',
    'dawn','delta','driftwood','ember','fern','forest','garnet','granite','harbour','haven',
    'heron','hollow','indigo','island','juniper','kelp','lantern','laurel','maple','marble',
    'meadow','mist','moss','otter','pebble','pine','quartz','raven','ridge','river','saffron',
    'salt','sandpiper','shore','slate','sparrow','spruce','summit','thistle','tide','timber',
    'umber','valley','wander','wild','willow','winter'],
  suggest(){
    const pick = () => this.WORDS[Math.floor(Math.random() * this.WORDS.length)];
    let a = pick(), b = pick();
    while (b === a) b = pick();
    /* Two words plus two digits: about 56 x 56 x 90 combinations before anyone starts guessing,
       against a gallery nobody knows the address of. The limit here is not the arithmetic, it is
       that the client may forward it — which no passphrase length fixes. */
    return `${a}-${b}-${10 + Math.floor(Math.random() * 90)}`;
  },

  blank(){
    return { id: window.SF.makeId('CG'), name: '', clientName: '', gateTitle: '', hint: '',
      kicker: '', intro: '', shotOn: '', expires: '', note: '',
      passphrase: this.suggest(), images: [], token: '', dirName: '', builtAt: '', count: 0 };
  },

  /* ---- page ------------------------------------------------------------------------------- */

  render(){
    const sf = window.SF, list = this.store();
    sf.$('workspace').innerHTML = `<div class="page-stack">
      <section class="card">
        <div class="toolbar"><div><h2 style="margin:0">Client Galleries</h2>
          <p class="muted">Private galleries your clients open with a passphrase, and download from.
          They are written into the site when you run Website Export.</p></div>
          <button class="button primary" id="cgNew">New gallery</button></div>
        ${!list.length ? `<div class="empty-state roomy">No galleries yet. Make one for a wedding or
          a portrait session, choose the finished images, and it goes out with the next export.</div>` : `
        <div class="commerce-table"><table>
          <thead><tr><th>Gallery</th><th>Client</th><th>Pictures</th><th>Passphrase</th><th>Link</th><th></th></tr></thead>
          <tbody>${list.map(g => `<tr>
            <td><b>${sf.esc(g.name || 'Untitled')}</b>${g.expires ? `<br><span class="muted">shown as available until ${sf.esc(g.expires)}</span>` : ''}</td>
            <td>${sf.esc(g.clientName || '\u2014')}</td>
            <td>${g.images.length}${g.builtAt ? `<br><span class="muted">${g.count} written</span>` : ''}</td>
            <td><code>${sf.esc(g.passphrase)}</code>
              <button class="button secondary compact" data-cg-copy="${g.id}" data-what="pass">Copy</button></td>
            <td>${g.token ? `<code>client.html?g=${sf.esc(g.token)}</code>
              <button class="button secondary compact" data-cg-copy="${g.id}" data-what="link">Copy</button>`
              : '<span class="muted">after the next export</span>'}</td>
            <td class="row-actions">
              <button class="button secondary compact" data-cg-open="${g.id}">Open</button>
              ${g.token ? `<button class="button secondary compact" data-cg-msg="${g.id}">Message</button>` : ''}
              <button class="button danger compact" data-cg-del="${g.id}">Delete</button>
            </td></tr>`).join('')}</tbody>
        </table></div>`}
        <p class="help"><b>The passphrase cannot be recovered.</b> It is not stored in the website \u2014
        this list is the only copy. If it is lost the gallery has to be sealed again with a new one.</p>
      </section>
          ${window.SFPrepareUpload ? window.SFPrepareUpload.card() : ''}
    </div>`;

    /* g184 — the prepare-for-upload card, guarded so a missing module can never take this page
       down (the wrapper rule used everywhere else in the app). */
    try { if (window.SFPrepareUpload) window.SFPrepareUpload.bind(); }
    catch (e) { console.error('[prepare-upload]', e); }

    sf.$('cgNew').onclick = async () => {
      const g = this.blank();
      this.store().push(g);
      await sf.persist();
      this.open(g.id);
    };
    document.querySelectorAll('[data-cg-open]').forEach(b => b.onclick = () => this.open(b.dataset.cgOpen));
    document.querySelectorAll('[data-cg-msg]').forEach(b => b.onclick = () => this.openMessage(b.dataset.cgMsg));
    document.querySelectorAll('[data-cg-copy]').forEach(b => b.onclick = () => {
      const g = this.gallery(b.dataset.cgCopy);
      if (!g) return;
      const text = b.dataset.what === 'pass' ? g.passphrase : `client.html?g=${g.token}`;
      navigator.clipboard?.writeText(text);
      b.textContent = 'Copied';
      setTimeout(() => { b.textContent = 'Copy'; }, 1200);
    });
    document.querySelectorAll('[data-cg-del]').forEach(b => b.onclick = async () => {
      const g = this.gallery(b.dataset.cgDel);
      if (!g) return;
      if (!confirm(`Delete "${g.name || 'Untitled'}"?\n\nThe passphrase goes with it and cannot be got back.\nAnything already exported stays on the website until you remove it there.`)) return;
      sf.state.clientGalleries = this.store().filter(x => x.id !== g.id);
      await sf.persist();
      this.render();
    });
  },

  open(id){
    const sf = window.SF, g = this.gallery(id);
    if (!g) return;
    sf.$('workspace').innerHTML = `<div class="page-stack">
      <section class="card">
        <div class="toolbar"><div><h2 style="margin:0">${sf.esc(g.name || 'New gallery')}</h2>
          <p class="muted">Sealed when you next run Website Export.</p></div>
          <button class="button secondary" id="cgBack">\u2190 All galleries</button></div>

        <div class="form-grid">
          <label>Gallery name <small class="muted">\u2014 for your list only</small>
            <input id="cgName" value="${sf.esc(g.name)}" placeholder="Sarah &amp; Tom \u2014 wedding"></label>
          <label>Client<input id="cgClient" value="${sf.esc(g.clientName)}"></label>
          <label>Available until <small class="muted">\u2014 shown, not enforced</small>
            <input id="cgExpires" type="date" value="${sf.esc(g.expires)}"></label>
          <label>Photographed on<input id="cgShotOn" value="${sf.esc(g.shotOn)}" placeholder="14 June 2026"></label>
        </div>

        <h3>What they see before unlocking</h3>
        <p class="help"><b>These two are public.</b> They sit outside the encryption so the passphrase
        screen can say who the gallery is for. Put nothing private in either \u2014 a hint of
        \u201cyour wedding date\u201d is fine, the date itself is the passphrase written on the door.</p>
        <div class="form-grid">
          <label>Heading<input id="cgGateTitle" value="${sf.esc(g.gateTitle)}" placeholder="Sarah &amp; Tom"><span class="help">Leave it blank and the screen just says \u201cYour gallery\u201d \u2014 it never borrows the private title below.</span></label>
          <label>Hint<input id="cgHint" value="${sf.esc(g.hint)}" placeholder="the passphrase I texted you"></label>
        </div>

        <h3>Inside the gallery</h3>
        <div class="form-grid">
          <label>Title<input id="cgTitle" value="${sf.esc(g.title || g.gateTitle)}" placeholder="Sarah &amp; Tom"></label>
          <label>Kicker<input id="cgKicker" value="${sf.esc(g.kicker)}" placeholder="Wedding \u00b7 14 June 2026"></label>
        </div>
        <label>Introduction<textarea id="cgIntro" rows="2">${sf.esc(g.intro)}</textarea></label>
        <label>Note at the foot<textarea id="cgNote" rows="2" placeholder="Download everything before the date above \u2014 after that I archive it.">${sf.esc(g.note)}</textarea></label>

        <h3>Passphrase</h3>
        <div class="row-actions">
          <input id="cgPass" value="${sf.esc(g.passphrase)}" style="min-width:240px">
          <button class="button secondary" id="cgSuggest">Suggest another</button>
        </div>
        <p class="help">Three parts, easy to read down a phone. Your client will be typing this from
        a message, so a random string costs you a support call.</p>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3 style="margin:0">Pictures</h3>
          <p class="muted">${g.images.length} chosen. The originals go out at full size \u2014 these are
          what the client downloads \u2014 plus smaller copies for the page itself.</p></div>
          <div class="row-actions">
            <button class="button secondary" id="cgAdd">Choose pictures\u2026</button>
            ${g.images.length ? '<button class="button secondary" id="cgClear">Remove all</button>' : ''}
          </div></div>
        ${g.images.length ? `<div class="commerce-table"><table>
          <thead><tr><th>File</th><th>Shown as</th><th></th></tr></thead>
          <tbody>${g.images.map((im, i) => `<tr>
            <td>${sf.esc(im.name)}</td>
            <td><input data-cg-img="${i}" value="${sf.esc(im.label || im.name.replace(/\.[^.]+$/, ''))}"></td>
            <td><button class="button danger compact" data-cg-rm="${i}">\u2715</button></td>
          </tr>`).join('')}</tbody></table></div>` : ''}
        <div class="row-actions" style="margin-top:12px">
          <button class="button secondary" id="cgSave">Save</button>
          <button class="button primary" id="cgBuildOne">Create the gallery now</button>
          <span id="cgSavedNote" class="help" style="opacity:0;transition:opacity .3s"></span>
          ${g.token ? `<span class="help">Already sealed once. Exporting again re-seals it with the
            current passphrase and a NEW link \u2014 the old link stops working.</span>` : ''}
        </div>
      </section>
    </div>`;

    const read = () => {
      g.name = sf.$('cgName').value.trim();
      g.clientName = sf.$('cgClient').value.trim();
      g.expires = sf.$('cgExpires').value;
      g.shotOn = sf.$('cgShotOn').value.trim();
      g.gateTitle = sf.$('cgGateTitle').value.trim();
      g.hint = sf.$('cgHint').value.trim();
      g.title = sf.$('cgTitle').value.trim();
      g.kicker = sf.$('cgKicker').value.trim();
      g.intro = sf.$('cgIntro').value;
      g.note = sf.$('cgNote').value;
      g.passphrase = sf.$('cgPass').value.trim();
      document.querySelectorAll('[data-cg-img]').forEach(el => {
        const im = g.images[Number(el.dataset.cgImg)];
        if (im) im.label = el.value.trim();
      });
    };
    sf.$('cgBack').onclick = async () => { read(); await sf.persist(); this.render(); };
    /* g180 — SAVE SAID NOTHING, SO IT LOOKED BROKEN.
       Kirk: "I tried to save a custom gallery and nothing happened and no website update was
       triggered." Both halves were true from where he sat. Save DID write \u2014 it re-rendered an
       identical page, which is indistinguishable from a dead button. And nothing was sealed,
       because sealing only ever happened inside a full Website Export; there was no way to make
       ONE gallery, which is exactly what delivering a wedding needs. */
    sf.$('cgSave').onclick = async () => {
      read(); await sf.persist(); this.open(g.id);
      const note = sf.$('cgSavedNote');
      if (note) { note.textContent = 'Saved \u00b7 ' + new Date().toLocaleTimeString(); note.style.opacity = '1'; }
    };
    sf.$('cgBuildOne').onclick = async () => {
      read(); await sf.persist();
      if (!g.images.length) return alert('Add some images first.');
      if (!String(g.passphrase || '').trim()) return alert('Set a passphrase first \u2014 press Suggest if you want one.');
      /* siteChooseFolder is the real bridge name — siteChooseExportFolder does not exist, and an
         optional-chained call to a missing function returns undefined silently, which is precisely
         the dead-button failure this build is fixing. */
      /* g197 — DEFAULT TO THE SHOOT FOLDER, beside the Lightroom edits. Kirk: "I need the client
         images and anything else all to be loaded into folders next to the lightroom alterations
         in the main yes shoot folder. this way i know where all the files are to export to
         squarespace or my site."
         That is the right instinct: a wedding's deliverables belong with the wedding, not in a
         website folder he has to remember. The sealer writes `client-galleries/` and
         `client-images/` under whatever folder it is given, so pointing it at the shoot puts both
         beside the edits — and the pair can then be copied to the site as one unit, because the
         structure is what the gallery page expects. */
      const from = (g.images[0] && (g.images[0].path || g.images[0])) || '';
      const shoot = String(from).split(/[\\/]/).slice(0, -1).join('/');
      let target = shoot;
      if (!target) {
        const picked = await sf.api.siteChooseFolder?.();
        target = picked && (picked.folder || picked);
      }
      if (!target) return;
      if (!confirm('Write the gallery into:\n\n' + target +
        '\n\nIt makes client-galleries/ and client-images/ there, beside your edits.' +
        '\n\nCancel to choose a different folder.')) {
        const picked = await sf.api.siteChooseFolder?.();
        target = picked && (picked.folder || picked);
        if (!target) return;
      }
      const btn = sf.$('cgBuildOne');
      btn.disabled = true; btn.textContent = 'Sealing\u2026';
      try {
        const results = await this.buildAll(target, [g.id]);
        const r = (results || [])[0];
        if (r && r.ok) { this.open(g.id); if (this.showLink) this.showLink(g, r); }
        else alert('That gallery could not be sealed: ' + ((r && r.error) || 'unknown reason'));
      } catch (e) { alert('That gallery could not be sealed: ' + e.message); }
      finally { btn.disabled = false; btn.textContent = 'Create the gallery now'; }
    };
    sf.$('cgSuggest').onclick = () => { sf.$('cgPass').value = this.suggest(); };
    sf.$('cgAdd').onclick = async () => {
      read();
      const picked = await sf.api.siteChoosePictures?.({ title: 'Choose the finished images' });
      if (!picked || !picked.length) return;
      const have = new Set(g.images.map(x => x.path));
      picked.forEach(p => { if (!have.has(p.path)) g.images.push({ name: p.name, path: p.path }); });
      await sf.persist();
      this.open(g.id);
    };
    if (sf.$('cgClear')) sf.$('cgClear').onclick = async () => {
      read(); g.images = []; await sf.persist(); this.open(g.id);
    };
    document.querySelectorAll('[data-cg-rm]').forEach(b => b.onclick = async () => {
      read(); g.images.splice(Number(b.dataset.cgRm), 1); await sf.persist(); this.open(g.id);
    });
  },

  /* ---- called by the export --------------------------------------------------------------- */

  /* Returns a line per gallery for the export summary. Every gallery is attempted; one that fails
     does not stop the others, because a wedding gallery failing should not cost him the whole
     site export. */
  /* g180 — `only` seals ONE gallery without exporting the whole site. A wedding is delivered when
     it is delivered, not when the site is next exported. */
  async buildAll(folder, only){
    const sf = window.SF, out = [];
    const wanted = Array.isArray(only) && only.length ? new Set(only.map(String)) : null;
    for (const g of this.store()) {
      if (wanted && !wanted.has(String(g.id))) continue;
      if (!g.images.length || !g.passphrase) {
        out.push({ name: g.name || 'Untitled', ok: false,
          error: !g.images.length ? 'no pictures chosen' : 'no passphrase' });
        continue;
      }
      const r = await sf.api.siteBuildClientGallery?.({
        folder: folder,
        images: g.images.map(im => ({ path: im.path, name: im.label || im.name })),
        passphrase: g.passphrase,
        title: g.title || g.gateTitle || g.name,
        gateTitle: g.gateTitle || g.name,
        hint: g.hint,
        kicker: g.kicker, intro: g.intro, shotOn: g.shotOn,
        expires: g.expires, note: g.note
      });
      if (r && r.ok) {
        g.token = r.token; g.dirName = r.dirName; g.count = r.count;
        g.builtAt = new Date().toISOString();
        out.push({ name: g.name || 'Untitled', ok: true, count: r.count,
          link: r.link, skipped: r.skipped || [] });
      } else {
        out.push({ name: g.name || 'Untitled', ok: false, error: (r && r.error) || 'could not be built' });
      }
    }
    if (out.length) await sf.persist();
    return out;
  },

  openMessage(id){
    const sf = window.SF, g = this.gallery(id);
    if (!g || !g.token) return;
    const site = (sf.state.websiteExport && sf.state.websiteExport.siteUrl) || 'https://fmphotography.ca';
    const link = `${String(site).replace(/\/+$/, '')}/client.html?g=${g.token}`;
    const msg = `Hi ${g.clientName || 'there'},\n\nYour photographs are ready.\n\n${link}\n\nPassphrase: ${g.passphrase}\n\n` +
      `Everything is there to download at full size \u2014 there is a "Download all" button, or you can take them one at a time.` +
      `${g.expires ? `\n\nThe gallery is up until ${g.expires}, so please save them before then.` : ''}\n\nKirk`;
    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal-card">
      <h2>Send this to ${sf.esc(g.clientName || 'your client')}</h2>
      <textarea id="cgMsgText" rows="12" style="width:100%">${sf.esc(msg)}</textarea>
      <p class="help">Send the link and the passphrase together \u2014 splitting them across two messages
      protects nothing and doubles the chance of a confused client.</p>
      <div class="row-actions"><button class="button secondary" id="cgMsgClose">Close</button>
        <button class="button primary" id="cgMsgCopy">Copy</button></div></div></div>`;
    sf.$('cgMsgClose').onclick = () => sf.closeModal();
    sf.$('cgMsgCopy').onclick = () => {
      navigator.clipboard?.writeText(sf.$('cgMsgText').value);
      sf.$('cgMsgCopy').textContent = 'Copied';
    };
  }
};
