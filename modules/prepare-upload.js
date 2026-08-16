/* StudioFlow g184 · PREPARE PICTURES FOR UPLOAD
   =========================================================================================
   Kirk found Squarespace's own private-gallery route — an unlinked page with a password — and
   asked whether StudioFlow can still do the work: resize a whole gallery for upload, and put a
   watermark on at the same time.

   Both, and they belong together: a watermark applied at full size and then scaled down looks
   different from one applied after scaling, and it is the SCALED picture he is uploading. So the
   order is fixed — resize first, then mark — and the mark is sized as a PERCENTAGE OF THE FINAL
   PICTURE, so every file in a batch carries a mark that looks the same size regardless of whether
   the original was portrait, landscape or a panorama.

   WHERE THE WORK HAPPENS, and why it is split:
     - main.js reads the file and resizes it (nativeImage), because only main can touch the disk;
     - THE COMPOSITING HAPPENS HERE, because nativeImage cannot draw one image onto another and a
       canvas can;
     - main.js writes the result back.
   Everything crosses the boundary as a data URL at the size he asked for, never the 60-megapixel
   original — that would be several hundred megabytes of base64 for a picture about to become 2000
   pixels wide.

   THE ORIGINALS ARE NEVER TOUCHED. Every file is written into a folder he chooses, and the tool
   refuses to write into the folder it is reading from. That refusal is not politeness: a mistake
   there overwrites the only copy of a wedding.
   ========================================================================================= */
window.SFPrepareUpload = {

  /* ==========================================================================================
     g199 — WHY HIS SETTINGS NEVER CHANGED, AND WHY TWO REPORTS HAD ONE CAUSE.
     ==========================================================================================
     Kirk: "the watermark is way too small and cannot be read at all" and "i want them placed in
     their own folder named 'resized for web' that way they are not placed in with all of the cr3
     files." I built BOTH of those — the mark default went to 26% at g194, the folder at g195 —
     and he got NEITHER, because this function only ever filled the object IN FULL WHEN IT WAS
     ABSENT. His settings were created back at g184 with markPct 3 and no destMode at all, so every
     default I "changed" afterwards was written for a user who did not exist. He had the old
     values and no way to know a new one had ever been chosen.

     THAT IS A CLASS OF BUG, NOT AN INCIDENT: any settings object in this app that grows a key
     later has the same hole. Defaults are now applied PER KEY, so a new one reaches an existing
     user the first time the page renders, while anything he has deliberately set is left alone.

     THE ONE EXCEPTION IS `markPct`, and it needs saying out loud: 3% was never a considered
     choice, it was the placeholder in the first build, and at 3% of a 2000px picture the mark is
     60px wide — invisible, which is exactly what his screenshot shows. It is raised ONCE, guarded
     by a flag so it can never fight him again if he genuinely wants a small mark.
     ========================================================================================== */
  DEFAULTS: {
    maxPx: 2000, quality: 0.86,
    mark: 'none', markFile: '', markText: '\u00a9 Frozen Moments Photography',
    corner: 'br', markPct: 26, opacity: 0.9, marginPct: 3, markColour: 'white',
    /* g194 — ON THE PICTURE, not beneath it. I first read "not over the image" as wanting a
       signature strip below; the example he then sent (IMG_1398-2wm.jpg) is a mark laid ON the
       photograph, bottom right. The strip is still offered; this is the default because it is what
       he actually does. markPct 26 and opacity 0.9 are measured off that same file. */
    place: 'on', bandPct: 5, bandColour: 'dark',
    destMode: 'beside', number: false, numberFrom: 1
  },

  defaults(){
    const s = window.SF.state;
    if (!s.prepareUpload || typeof s.prepareUpload !== 'object') s.prepareUpload = {};
    const o = s.prepareUpload;
    Object.keys(this.DEFAULTS).forEach(k => {
      if (o[k] === undefined || o[k] === null) o[k] = this.DEFAULTS[k];
    });
    /* The one correction to a value he already has. A 3% mark is not a preference anyone stated —
       it is the placeholder from the first build, and it prints at 60px on a 2000px picture. */
    if (!o._markPctFixed && Number(o.markPct) > 0 && Number(o.markPct) < 8) {
      o.markPct = this.DEFAULTS.markPct;
      o._markPctFixed = true;
    }
    return o;
  },


  CORNERS: [['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']],
  SIZES: [[1200, '1200 px \u2014 small'], [1600, '1600 px \u2014 web'],
          [2000, '2000 px \u2014 recommended'], [2600, '2600 px \u2014 large']],

  /* ---- the work ------------------------------------------------------------------------- */

  loadImage(dataUrl){
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('That image could not be decoded.'));
      im.src = dataUrl;
    });
  },

  /* One picture: already resized by main, marked here, returned as a JPEG data URL. */
  async compose(dataUrl, markImg, opts){
    const base = await this.loadImage(dataUrl);

    /* ==========================================================================================
       g187 — THE SIGNATURE STRIP, which is what he actually asked for.
       ==========================================================================================
       Kirk: "i just want this watermark in the bottom righthand corner after the images are
       resized. then it is not over the image and just a signature in the bottom right corner."

       The corner overlay was already there — but "not over the image" is the point. A mark laid on
       a photograph is a WATERMARK, meant to be awkward to remove; a mark on a strip beneath it is
       a SIGNATURE, and it does not cost him a single pixel of the picture. For work he is showing
       to sell, the second is almost always what he wants: nothing sits on the photograph at all.

       The picture is drawn at its own size and the canvas is made TALLER by the strip, so the
       photograph is never scaled, cropped or covered. Everything about it above the strip is
       byte-for-byte what the resize produced.
       ========================================================================================== */
    const bandMode = opts.mark !== 'none' && opts.place === 'below';
    const bw = base.naturalWidth, bh = base.naturalHeight;
    /* The strip is sized from the picture's WIDTH — a signature line reads across the bottom, so
       its height should follow how wide the picture is, not how tall. */
    const bandH = bandMode ? Math.max(24, Math.round(bw * (opts.bandPct / 100))) : 0;

    const cv = document.createElement('canvas');
    cv.width = bw; cv.height = bh + bandH;
    const ctx = cv.getContext('2d');
    ctx.drawImage(base, 0, 0);

    if (bandMode) {
      ctx.fillStyle = opts.bandColour === 'white' ? '#ffffff'
        : opts.bandColour === 'grey' ? '#f0eeea' : '#111111';
      ctx.fillRect(0, bh, bw, bandH);
      const mark = markImg ? this.tintMark(this.trimMark(markImg), opts.markColour) : null;
      if (mark) {
        const mw0 = mark.naturalWidth || mark.width, mh0 = mark.naturalHeight || mark.height;
        /* Fits INSIDE the strip with a margin, by height as well as width — a 7.5:1 mark asked to
           be 40% of the picture width would otherwise be taller than the strip it sits in. */
        const pad = Math.round(bandH * 0.28);
        let w = Math.round(bw * (opts.markPct / 100));
        let h = Math.round(w * (mh0 / mw0));
        const maxH = bandH - pad * 2;
        if (h > maxH) { h = maxH; w = Math.round(h * (mw0 / mh0)); }
        ctx.globalAlpha = Math.max(0.05, Math.min(1, opts.opacity));
        ctx.drawImage(mark, bw - w - pad, bh + Math.round((bandH - h) / 2), w, h);
        ctx.globalAlpha = 1;
      } else if (opts.mark === 'text') {
        const px = Math.max(10, Math.round(bandH * 0.42));
        ctx.font = `600 ${px}px "Segoe UI", system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = opts.bandColour === 'dark' ? '#ffffff' : '#14171a';
        const m = ctx.measureText(opts.markText || '');
        ctx.globalAlpha = Math.max(0.05, Math.min(1, opts.opacity));
        ctx.fillText(opts.markText || '', bw - m.width - Math.round(bandH * 0.28), bh + bandH / 2);
        ctx.globalAlpha = 1;
      }
      return cv.toDataURL('image/jpeg', Math.max(0.5, Math.min(0.95, opts.quality)));
    }

    if (opts.mark !== 'none') {
      /* The mark is a percentage of the picture's LONGEST side, so a panorama and a portrait get
         marks that read as the same size rather than one being swallowed. */
      const span = Math.max(cv.width, cv.height);
      const w = Math.round(span * (opts.markPct / 100));
      const pad = Math.round(span * (opts.marginPct / 100));
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(1, opts.opacity));

      if (opts.mark === 'image' && markImg) {
        /* Trimmed FIRST, so both the aspect ratio and the size he asked for describe the mark
           itself rather than the canvas it was exported on. */
        const trimmed = this.trimMark(markImg);
        const mw = trimmed.naturalWidth || trimmed.width;
        const mh = trimmed.naturalHeight || trimmed.height;
        const h = Math.round(w * (mh / mw));
        const x = /l$/.test(opts.corner) ? pad : cv.width - w - pad;
        const y = /^t/.test(opts.corner) ? pad : cv.height - h - pad;
        /* g185 — A SINGLE-COLOUR MARK CANNOT WORK ON EVERY PHOTOGRAPH.
           Kirk's camera mark is a BLACK silhouette. On a bright sky it reads perfectly and on a
           dark forest it vanishes completely — and half his catalogue is each. The text mark
           already solved this with a shadow; the image mark did not, which would have shown up
           only after a batch was already uploaded.
           Two answers, both here: RECOLOUR the mark (its shape is kept, its colour replaced by
           filling through `source-in` on an offscreen canvas — which works on any silhouette
           whatever colour it was supplied in), and a soft shadow behind it so it separates from
           whatever it lands on. */
        ctx.shadowColor = 'rgba(0,0,0,.45)';
        ctx.shadowBlur = Math.max(2, Math.round(w * 0.05));
        ctx.drawImage(this.tintMark(trimmed, opts.markColour), x, y, w, h);
      } else if (opts.mark === 'text') {
        const px = Math.max(10, Math.round(span * (opts.markPct / 100) * 0.34));
        ctx.font = `600 ${px}px "Segoe UI", system-ui, sans-serif`;
        ctx.textBaseline = /^t/.test(opts.corner) ? 'top' : 'alphabetic';
        const m = ctx.measureText(opts.markText || '');
        const x = /l$/.test(opts.corner) ? pad : cv.width - m.width - pad;
        const y = /^t/.test(opts.corner) ? pad : cv.height - pad;
        /* A dark shadow behind pale text is what keeps a mark legible over a bright sky AND over
           a dark forest — without it the mark disappears on half his catalogue. */
        ctx.shadowColor = 'rgba(0,0,0,.55)';
        ctx.shadowBlur = Math.max(2, Math.round(px * 0.12));
        ctx.fillStyle = '#ffffff';
        ctx.fillText(opts.markText || '', x, y);
      }
      ctx.restore();
    }
    return cv.toDataURL('image/jpeg', Math.max(0.5, Math.min(0.95, opts.quality)));
  },

  /* Repaint a mark in one colour, keeping its shape. `source-in` fills only where the mark already
     has pixels, so a black silhouette becomes a white one with its transparency intact. Cached,
     because a batch of 300 pictures would otherwise redo this 300 times. */
  /* g186 — TRIM THE EMPTY SPACE AROUND A MARK BEFORE USING IT.
     Kirk's watermark arrived as an 800x600 file whose visible mark is 366x49 sitting in the
     middle — 99.4% of it transparent. The mark is sized as a percentage of the picture, so
     WITHOUT TRIMMING that percentage would be spent mostly on nothing: the visible mark would
     come out under half the size he asked for and float well away from the corner he chose,
     with no clue why. Exported artwork routinely carries a canvas larger than its content, so
     this is the normal case rather than a quirk of one file. */
  trimMark(img){
    if (this._trimSrc === img.src && this._trimmed) return this._trimmed;
    /* Same reason: trimMark may be handed a canvas on a later call. */
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return img;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    let data;
    try { data = c.getImageData(0, 0, w, h).data; }
    catch (e) { return img; }               /* a tainted canvas: use it as it came */
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    /* No transparency at all, or nothing visible: hand it back untouched rather than cropping to
       nothing. A mark on a solid white background is a different problem, and the page says so. */
    if (x1 < x0 || y1 < y0 || (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1)) {
      this._trimSrc = img.src; this._trimmed = img;
      return img;
    }
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    this._trimSrc = img.src; this._trimmed = out;
    return out;
  },

  tintMark(img, colour){
    if (!colour || colour === 'as-is') return img;
    const key = colour + ':' + (img.src || '').length + ':' + img.width + 'x' + img.height;
    if (this._tintKey === key && this._tinted) return this._tinted;
    const cv = document.createElement('canvas');
    /* g197 — THE CRASH: "The image argument is a canvas element with a width or height of 0."
       g186's trimMark() hands back a CANVAS, and a canvas has no `naturalWidth` — that belongs to
       an <img>. So this read undefined, built a 0x0 canvas, and drawImage threw on every picture
       in the batch. Kirk saw "0 picture(s) written · 3 failed".
       Both are read now, in that order, because this function is handed an <img> the first time
       and a canvas every time after. The same pair is already used at the two call sites; this was
       the one place that assumed. */
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return img;            /* nothing to tint rather than a zero-size canvas */
    cv.width = iw; cv.height = ih;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = colour === 'white' ? '#ffffff' : '#000000';
    c.fillRect(0, 0, cv.width, cv.height);
    this._tintKey = key; this._tinted = cv;
    return cv;
  },

  /* g198 — SAY IT IN HIS WORDS, NOT THE BROWSER'S.
     Kirk, reading a failure from this tool: "why is it calling it a canvas element for the gallery
     upload… this is just an image not a product". Fair — in a browser a <canvas> is an invisible
     drawing surface, but in HIS vocabulary a canvas is a PRINT MEDIUM, and "canvas element" landing
     in a photo-export failure reads as though the tool had confused his products with his pictures.
     He lost time on that, and the message was mine to write.
     So browser wording is translated at the point it becomes visible. Anything unrecognised is
     passed through UNCHANGED rather than flattened into "something went wrong" — an error I have
     not seen before is exactly the one worth reading verbatim. */
  plainError(e){
    const raw = String((e && e.message) || e || 'unknown reason');
    if (/canvas element with a width or height of 0/i.test(raw)) {
      return 'the watermark could not be prepared for this picture (this is a StudioFlow fault, not your file)';
    }
    if (/tainted|cross-origin|SecurityError/i.test(raw)) {
      return 'this picture could not be read for editing \u2014 try copying it to a local folder first';
    }
    if (/could not be decoded|decode/i.test(raw)) {
      return 'this file is in a format StudioFlow cannot open \u2014 JPEG and PNG work';
    }
    if (/ENOSPC|no space/i.test(raw)) return 'the disk is full';
    if (/EACCES|EPERM|permission/i.test(raw)) return 'StudioFlow was not allowed to write there';
    if (/ENOENT|not exist/i.test(raw)) return 'that file is no longer where it was';
    return raw;
  },

  outName(path, suffix){
    const base = String(path).split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    return base + (suffix || '') + '.jpg';
  },

  async run(){
    const sf = window.SF, o = this.defaults(), out = sf.$('puLog');
    const files = this._files || [];
    if (!files.length) return alert('Choose some pictures first.');
    /* g195 — Kirk: "can we have the option to save the files in the same directory as the
       originals by default but in a 'resized for web' folder?" That is the right default: he
       already navigated to the shoot to pick the pictures, and asking him to navigate there again
       to choose a destination is the same journey twice. The subfolder is what keeps it safe —
       writing INTO the source folder is the one thing this tool refuses (a wedding exists once),
       and a folder beside the originals is not the source folder. */
    const sourceDir = String(files[0] || '').split(/[\\/]/).slice(0, -1).join('/');
    const dest = (o.destMode === 'beside' && sourceDir)
      ? sourceDir + '/resized for web'
      : this._dest;
    if (!dest) return alert('Choose where to put them first.');

    /* THE REFUSAL THAT MATTERS. Writing beside the originals with the same names would overwrite
       the only copy of a job. Compared case-insensitively and with separators normalised, because
       Windows will hand back either. */
    const norm = p => String(p).replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
    const clash = files.some(f => norm(String(f).split(/[\\/]/).slice(0, -1).join('/')) === norm(dest));
    if (clash) return alert('That is the folder the pictures came from.\n\nChoose a different one \u2014 writing there could overwrite your originals.');

    let markImg = null;
    if (o.mark === 'image') {
      if (!o.markFile) return alert('Choose a watermark picture, or switch the watermark off.');
      const r = await sf.api.imageReadAsDataUrl?.({ source: o.markFile, maxPx: 1200 });
      if (!r || !r.ok) return alert('That watermark file could not be read: ' + ((r && r.error) || 'unknown reason'));
      /* g186 — a PSD or TIFF comes back as raw bytes the browser cannot decode, and the failure
         would otherwise read as "could not be decoded" with no hint of the cause. */
      if (/\.(psd|tif|tiff|heic|webp)$/i.test(String(o.markFile))) {
        return alert('A ' + String(o.markFile).split('.').pop().toUpperCase() +
          ' cannot be used as a watermark here.\n\nSave it as a PNG with a transparent background and choose that instead.');
      }
      try { markImg = await this.loadImage(r.dataUrl); }
      catch (e) { return alert('That watermark file could not be decoded. A PNG with a transparent background works best.'); }
    }

    const btn = sf.$('puRun');
    btn.disabled = true;
    let done = 0, failed = 0;
    const problems = [];
    for (let i = 0; i < files.length; i++) {
      const src = files[i];
      btn.textContent = `Working\u2026 ${i + 1} of ${files.length}`;
      try {
        const r = await sf.api.imageReadAsDataUrl?.({ source: src, maxPx: o.maxPx });
        if (!r || !r.ok) throw new Error((r && r.error) || 'could not be read');
        const jpeg = await this.compose(r.dataUrl, markImg, o);
        /* Numbered so a bulk drop into a gallery lands in the order he culled them — Squarespace
           and most galleries keep upload order, and a folder sorted by camera filename is not the
           order anyone chose. Padded to three digits so 10 does not sort before 2. */
        const outName = o.number
          ? String(Number(o.numberFrom || 1) + i).padStart(3, '0') + '_' + this.outName(src, '')
          : this.outName(src, '');
        const w = await sf.api.imageWriteFile?.({ folder: dest, name: outName, dataUrl: jpeg });
        if (!w || !w.ok) throw new Error((w && w.error) || 'could not be written');
        done++;
        if (r.resized === false) problems.push(this.outName(src) + ' \u2014 copied at its original size (format could not be resized)');
      } catch (e) {
        failed++;
        problems.push(String(src).split(/[\\/]/).pop() + ' \u2014 ' + this.plainError(e));
      }
      if (out) out.textContent = `${done} done${failed ? ', ' + failed + ' failed' : ''}\u2026`;
    }
    btn.disabled = false; btn.textContent = 'Prepare the pictures';
    if (out) {
      out.innerHTML = `<b>${done} picture(s) written</b> to ${sf.esc(dest)}${failed ? ` \u00b7 <span class="danger-text">${failed} failed</span>` : ''}
        ${problems.length ? `<div class="help">${problems.slice(0, 12).map(p => sf.esc(p)).join('<br>')}</div>` : ''}`;
    }
    await sf.persist();
  },

  /* ---- the card ------------------------------------------------------------------------- */

  card(){
    const sf = window.SF, o = this.defaults();
    const n = (this._files || []).length;
    return `<section class="card">
      <h3>Prepare pictures for upload</h3>
      <p class="muted">Resize a folder of finished pictures for uploading anywhere \u2014 a Squarespace
      gallery, an email, a client. Your originals are never changed.</p>

      <div class="row-actions">
        <button class="button secondary" id="puPick">${n ? `Change pictures (${n} chosen)` : 'Choose pictures\u2026'}</button>
        ${o.destMode === 'beside' ? '' : `<button class="button secondary" id="puDest">${this._dest ? 'Change where they go' : 'Choose where they go\u2026'}</button>`}
      </div>
      <div class="form-grid" style="margin-top:8px">
        <label>Where they go<select id="puDestMode">
          <option value="beside" ${(o.destMode||'beside')==='beside'?'selected':''}>Beside the originals, in \u201cresized for web\u201d</option>
          <option value="choose" ${o.destMode==='choose'?'selected':''}>A folder I choose</option>
        </select></label>
        <label>Numbering<select id="puNumber">
          <option value="no" ${o.number?'':'selected'}>Keep the original names</option>
          <option value="yes" ${o.number?'selected':''}>Number them 001, 002, 003\u2026</option>
        </select></label>
      </div>
      ${o.destMode === 'beside'
        ? `<div class="help">${n ? sf.esc(String((this._files||[])[0]||'').split(/[\\/]/).slice(0,-1).join('/') + '/resized for web') : 'A \u201cresized for web\u201d folder is made beside the pictures you choose.'}</div>`
        : (this._dest ? `<div class="help">Writing to ${sf.esc(this._dest)}</div>` : '')}

      <div class="form-grid" style="margin-top:10px">
        <label>Longest side<select id="puSize">${this.SIZES.map(([v, t]) =>
          `<option value="${v}" ${Number(o.maxPx) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Watermark<select id="puMark">
          <option value="none" ${o.mark === 'none' ? 'selected' : ''}>None</option>
          <option value="image" ${o.mark === 'image' ? 'selected' : ''}>A picture I choose</option>
          <option value="text" ${o.mark === 'text' ? 'selected' : ''}>Words</option>
        </select></label>
      </div>

      ${o.mark === 'none' ? '' : `
        <div class="form-grid">
          ${o.mark === 'image'
            ? `<label>Watermark file<span class="row-actions"><button class="button secondary compact" id="puMarkPick">${o.markFile ? 'Change\u2026' : 'Choose\u2026'}</button>
                 <span class="help">${o.markFile ? sf.esc(String(o.markFile).split(/[\\\\/]/).pop()) : 'a PNG with a transparent background \u2014 empty space around it is trimmed automatically'}</span></span></label>`
            : `<label>Words<input id="puMarkText" value="${sf.esc(o.markText)}"></label>`}
          <label>Mark colour<select id="puMarkColour">
            ${[['white','White \u2014 works on most photographs'],['black','Black'],['as-is','As the file was supplied']]
              .map(([v,t]) => `<option value="${v}" ${(o.markColour||'white')===v?'selected':''}>${t}</option>`).join('')}
          </select></label>
          <label>Where<select id="puPlace">
            <option value="below" ${(o.place||'below')==='below'?'selected':''}>Below the picture \u2014 a signature strip</option>
            <option value="on" ${o.place==='on'?'selected':''}>On the picture \u2014 a watermark</option>
          </select></label>
          ${(o.place||'below')==='below' ? `
            <label>Strip depth <small class="muted">\u2014 % of the width</small>
              <input id="puBandPct" type="number" min="2" max="15" step="0.5" value="${Number(o.bandPct)}"></label>
            <label>Strip colour<select id="puBandColour">
              ${[['dark','Dark'],['white','White'],['grey','Soft grey']].map(([v,t]) =>
                `<option value="${v}" ${(o.bandColour||'dark')===v?'selected':''}>${t}</option>`).join('')}
            </select></label>` : `
            <label>Corner<select id="puCorner">${this.CORNERS.map(([v, t]) =>
            `<option value="${v}" ${o.corner === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`}
          <label>Size <small class="muted">\u2014 % of the picture</small>
            <input id="puPct" type="number" min="3" max="40" step="1" value="${Number(o.markPct)}"></label>
          <label>Opacity <small class="muted">\u2014 0.05 to 1</small>
            <input id="puOpacity" type="number" min="0.05" max="1" step="0.05" value="${Number(o.opacity)}"></label>
        </div>
        <div class="help">${(o.place||'below')==='below'
          ? 'Nothing is drawn on the photograph \u2014 the strip is added beneath it, so the picture itself is untouched. The file comes out slightly taller.'
          : 'The mark is drawn over the picture.'} 
        batch gets a mark that looks the same size whether it is a portrait or a panorama.${
          o.mark === 'image' ? ' A black mark disappears on a dark photograph, so it is recoloured white by default and carries a soft shadow \u2014 use \u201cas supplied\u201d only if your file is already the colour you want.' : ''}</div>`}

      <div class="row-actions" style="margin-top:12px">
        <button class="button primary" id="puRun">Prepare the pictures</button>
        <span id="puLog" class="help"></span>
      </div>
    </section>`;
  },

  bind(){
    const sf = window.SF, o = this.defaults();
    const rerender = () => { if (window.SFClientGalleries) window.SFClientGalleries.render(); };

    if (sf.$('puPick')) sf.$('puPick').onclick = async () => {
      const picked = await sf.api.siteChoosePictures?.({ title: 'Choose the pictures to prepare' });
      if (!picked || !picked.length) return;
      this._files = picked.map(p => p.path || p);
      rerender();
    };
    if (sf.$('puDest')) sf.$('puDest').onclick = async () => {
      const picked = await sf.api.siteChooseFolder?.();
      const dest = picked && (picked.folder || picked);
      if (!dest) return;
      this._dest = dest;
      rerender();
    };
    if (sf.$('puMarkPick')) sf.$('puMarkPick').onclick = async () => {
      const picked = await sf.api.siteChoosePictures?.({ title: 'Choose the watermark picture' });
      if (!picked || !picked.length) return;
      o.markFile = picked[0].path || picked[0];
      await sf.persist();
      rerender();
    };
    /* Every control writes and persists on change. A settings panel that only saves when something
       else happens is the fault that lost his GitHub boxes (g137). */
    const on = (id, fn) => { if (sf.$(id)) sf.$(id).onchange = async e => { fn(e.target.value); await sf.persist(); rerender(); }; };
    on('puSize', v => { o.maxPx = Number(v) || 2000; });
    on('puMark', v => { o.mark = v; });
    on('puCorner', v => { o.corner = v; });
    on('puDestMode', v => { o.destMode = v; });
    on('puNumber', v => { o.number = v === 'yes'; });
    on('puPlace', v => { o.place = v; });
    on('puBandPct', v => { o.bandPct = Math.max(2, Math.min(15, Number(v) || 5)); });
    on('puBandColour', v => {
      o.bandColour = v;
      /* g187 — a white mark on a white strip is invisible, and he would see a blank strip with no
         idea why. The two are kept apart rather than left to collide. */
      if (v === 'white' || v === 'grey') { if (o.markColour === 'white') o.markColour = 'black'; }
      else if (o.markColour === 'black') o.markColour = 'white';
      this._tinted = null; this._tintKey = '';
    });
    on('puMarkColour', v => { o.markColour = v; this._tinted = null; this._tintKey = ''; });
    on('puPct', v => { o.markPct = Math.max(3, Math.min(40, Number(v) || 14)); });
    on('puOpacity', v => { o.opacity = Math.max(0.05, Math.min(1, Number(v) || 0.55)); });
    if (sf.$('puMarkText')) sf.$('puMarkText').onchange = async e => { o.markText = e.target.value; await sf.persist(); };
    if (sf.$('puRun')) sf.$('puRun').onclick = () => this.run();
  }
};
