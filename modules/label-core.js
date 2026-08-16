/* ==========================================================================
   StudioFlow — Artwork Labels & QR Codes
   Generates gallery-style labels with a tracked QR code for artwork installed
   at hotels, resorts, show suites and other venues.

   Runs in two places from the SAME file:
     - inside StudioFlow  (window.SFLabelQR.render(container))
     - as a standalone page (label-studio.html)

   No build step, no network, no dependencies. Requires qr.js loaded first.
   ========================================================================== */
(function (root) {
  'use strict';

  var DPI = 300;
  var LABEL_W_IN = 3.5;
  var LABEL_H_IN = 1.95;
  var W = Math.round(LABEL_W_IN * DPI);   // 1050
  var H = Math.round(LABEL_H_IN * DPI);   // 585

  var STYLES = {
    card: {
      id: 'card', name: 'Printed card, standoff',
      bg: '#fcfbf9', ink: '#1f2328', soft: '#6e767f', rule: '#ced3d8',
      plate: false
    },
    black: {
      id: 'black', name: 'Matte black acrylic',
      bg: '#1a1c1f', ink: '#eeece9', soft: '#969ea6', rule: '#4a5057',
      plate: true
    },
    /* g195 — THE THREE FINISHES COME FROM HIS OWN TRADE LINE SHEET, not from my invention.
       Kirk: "you will find the 3rd option for the art labels in the trade line sheet examples."
       v6 of that document promises a hotel exactly three: **Brushed aluminium**, **Matte black
       acrylic**, **Printed card, standoff**. So the app now offers those three under those names.
       That matters more than the colours: the line sheet is a commitment to a client, and a
       dropdown that offers something else invites him to pick a finish he has not promised — or
       to hunt for one he has.
       Aluminium is a cool light grey with a darker rule, which is how a brushed plate reads once
       printed; the metallic sheen belongs to the substrate, not the artwork. */
    aluminium: {
      id: 'aluminium', name: 'Brushed aluminium',
      bg: '#e8eaec', ink: '#20242a', soft: '#5b626b', rule: '#a7aeb6',
      plate: true
    }
  };

  var DEFAULTS = {
    artist: 'KIRK BUCKLAND',
    studio: 'Frozen Moments Photography',
    baseUrl: 'https://fmphotography.ca/art',
    cta: 'Own this piece',
    style: 'card',
    logo: true,          // camera mark in the middle of the QR code
    logoScale: 0.26      // mark width as a fraction of the QR width; 0.30 is the tested ceiling
  };

  // ---------------------------------------------------------------- data ---

  var data = {
    settings: Object.assign({}, DEFAULTS),
    properties: [],     // {id, name, code}
    labels: []          // {id, propertyId, artworkId, title, location, medium, size, edition}
  };
  var ui = { propertyId: null, selectedId: null, dirty: false };

  function uid(prefix) {
    return (prefix || 'lq') + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 7);
  }

  function slug(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  function inStudioFlow() {
    return !!(root.sf && root.sf.state) || !!(root.SF && root.SF.state);
  }
  function sfState() {
    if (root.sf && root.sf.state) return root.sf.state;
    if (root.SF && root.SF.state) return root.SF.state;
    return null;
  }

  /* Persistence.
     Inside StudioFlow the whole payload lives on state.labelQR and is written
     through the app's own save call. Standalone, it stays in memory and the
     user exports/imports a JSON file. */
  function load() {
    var st = sfState();
    if (st && st.labelQR && typeof st.labelQR === 'object') {
      data.settings = Object.assign({}, DEFAULTS, st.labelQR.settings || {});
      data.properties = Array.isArray(st.labelQR.properties) ? st.labelQR.properties : [];
      data.labels = Array.isArray(st.labelQR.labels) ? st.labelQR.labels : [];
    }
  }
  function save() {
    var st = sfState();
    if (!st) { ui.dirty = true; return false; }
    st.labelQR = { settings: data.settings, properties: data.properties, labels: data.labels };
    /* g168 — VERIFIED AGAINST THE REAL APP, not left to the fallback chain.
       INTEGRATION.md flagged this as verify-don't-assume, and it was right to.
       Checked in StudioFlow's core.js: there is NO `sf.save` and NO `sf.saveState` —
       the only persist function is `SF.persist`, an ASYNC method, called as
       `await sf.persist()` in 252 places across the modules. There is also no
       lowercase `window.sf`; the global is `window.SF`.

       The chain WOULD have landed on persist by elimination. It is made explicit
       anyway, because a chain that happens to be right is one `SF.save` away from
       silently switching to something that means something else — which is exactly
       how g84's nonexistent collection went unnoticed: a fallback kept the page
       rendering while the real work never happened.

       persist() is async and this function is not, so the write is fire-and-forget,
       matching how the rest of this module is written. The promise is returned to
       the caller that wants it. */
    var fns = [
      root.SF && root.SF.persist,
      root.sf && root.sf.persist,
      root.sf && root.sf.save, root.SF && root.SF.save,
      root.sf && root.sf.saveState, root.SF && root.SF.saveState
    ];
    for (var i = 0; i < fns.length; i++) {
      if (typeof fns[i] !== 'function') continue;
      try {
        var r = fns[i].call(root.sf || root.SF);
        /* g169 — A FAILED SAVE MUST NOT BE SILENT.
           Kirk asked whether a save button was needed. It is not — every path that changes a
           label, a venue or a setting already calls save(). But checking that turned up the real
           risk: persist() is ASYNC, and this loop swallowed everything in `catch (e) {}` and
           returned true regardless. A disk error, a locked database or a rejected promise would
           have reported success, and he would have found out at the print lab.
           Now a rejection is surfaced ONCE, through the app's own reporter if there is one. */
        if (r && typeof r.then === 'function') {
          r.then(function (res) {
            if (res && res.ok === false) reportSaveFailure(res.error);
          }, function (err) { reportSaveFailure(err && err.message); });
        }
        return true;
      } catch (e) { reportSaveFailure(e && e.message); }
    }
    ui.dirty = true;
    return false;
  }

  /* Said once, not on every keystroke: a database problem affects everything, and repeating it
     per field would bury the message it is trying to deliver. */
  var saveFailureShown = false;
  function reportSaveFailure(detail) {
    ui.dirty = true;
    if (saveFailureShown) return;
    saveFailureShown = true;
    var msg = 'Your labels could not be saved to StudioFlow' + (detail ? ' (' + detail + ')' : '') +
      '.\n\nWhat you can see on screen is still correct, but it will be lost when StudioFlow ' +
      'closes. Use Export to save a copy before you go any further.';
    if (root.SF && typeof root.SF.toast === 'function') root.SF.toast(msg);
    else if (typeof root.alert === 'function') root.alert(msg);
    if (root.console && root.console.error) root.console.error('[labels] save failed:', detail);
  }

  /* Artwork catalogue — StudioFlow only, and defensively.
     Returns [] if the app does not expose what we expect, so the page still works. */
  function catalogue() {
    try {
      if (root.sf && typeof root.sf.artworkCatalog === 'function') {
        var list = root.sf.artworkCatalog();
        if (Array.isArray(list)) return list;
      }
      var st = sfState();
      if (st && Array.isArray(st.artworks)) return st.artworks;
    } catch (e) {}
    return [];
  }

  function mediumSizeOptions() {
    var out = [];
    try {
      var st = sfState();
      var tpls = st && st.productTemplates;
      if (Array.isArray(tpls)) {
        tpls.forEach(function (t) {
          (t.sizes || []).forEach(function (s) {
              /* g196 — CARRY THE TEMPLATE ID. The label shows the medium's NAME ("Gallery Wrapped
               Canvas") but the website switches on its ID ("canvas"), and the two are not the
               same string. Keeping the id here means the link is built from the catalogue's own
               vocabulary rather than by matching display text — which would fail the moment Kirk
               renames a medium, and fail silently. */
            out.push({ medium: t.name || t.id, mediumId: t.id,
              size: (typeof s === 'string' ? s : s.size) });
          });
        });
      }
    } catch (e) {}
    return out;
  }

  // ------------------------------------------------------------- helpers ---

  function property(id) {
    for (var i = 0; i < data.properties.length; i++) if (data.properties[i].id === id) return data.properties[i];
    return null;
  }
  function label(id) {
    for (var i = 0; i < data.labels.length; i++) if (data.labels[i].id === id) return data.labels[i];
    return null;
  }
  function labelsFor(propId) {
    return data.labels.filter(function (l) { return l.propertyId === propId; });
  }

  /* ==========================================================================================
     g172 — THE UPPERCASE OPTION, OFF UNTIL THE SERVER IS PROVEN.
     ==========================================================================================
     A QR code encodes 0-9 A-Z and a few punctuation marks in ALPHANUMERIC mode, roughly 40%
     denser than byte mode — and ONE lowercase character forces byte mode for the entire payload.
     With Kirk's camera logo covering the middle of the code, that density is the difference
     between scanning first time in a dim hotel corridor and not.

     WHY IT IS NOT SIMPLY ON. Uppercasing the link crosses three layers, and template v24 failed
     all three: the parameter NAMES (`?H=` vs `?h=`), the PATH (`/ART` does not serve art.html on
     a Linux server), and the id comparison. v25 fixed the two the template owns — `param()` now
     matches keys case-insensitively and `sameId()` compares trimmed and lowercased, both verified
     by running them here against `H=…&ID=…`.

     THE PATH IS NOT THE TEMPLATE'S TO FIX. It is web-server configuration, and nobody can test it
     from inside StudioFlow. So this stays OFF by default and the page says what to check first.
     A label is screwed to a wall; being right afterwards is worth nothing.
     ========================================================================================== */
  /* g173 — WHAT THIS LABEL WILL ACTUALLY SCAN LIKE, in the units the question is asked in.
     Computed from the SAME encoder and the SAME box maths the drawing uses, so the advice on
     screen can never disagree with the code on the paper. 0.40mm per module is the figure most
     phone cameras need at close range; the ten-times-width rule gives the working distance. */
  function scanReport(lbl) {
    var withLogo = !!data.settings.logo;
    var qrIn = Number(data.settings.qrSizeIn);
    if (!(qrIn > 0)) qrIn = withLogo ? 1.2 : 1.0;
    /* g175 — THE SAME FLOOR AND CEILING THE DRAWING APPLIES. Reporting a size the drawing would
       refuse is worse than not reporting: the readout said 0.056mm while the label printed 0.6in.
       Both numbers now come from one rule. */
    qrIn = Math.max(0.6, Math.min(1.2, qrIn));
    var url = urlFor(lbl || (data.labels || [])[0] || { propertyId: '', artworkId: 'FMP-0000' });
    var out = { url: url, sizeIn: qrIn, withLogo: withLogo, ok: false };
    try {
      var qr = root.SFQR.encode(url, withLogo ? 'H' : 'M');
      out.version = qr.version;
      out.modules = qr.size;
      out.moduleMm = (qrIn * 25.4) / (qr.size + 8);        // 4-module quiet zone each side
      out.readFromMm = Math.round(qrIn * 25.4 * 10);
      out.ok = out.moduleMm >= 0.4;
      out.comfortable = out.moduleMm >= 0.5;
      /* g174 — WHAT THE CAMERA MARK COSTS, so the choice can be made with a number.
         Kirk asked whether SHRINKING the mark would help. It would not, and the reason is worth
         stating: the mark does not make the code denser by covering modules — it makes it denser
         because its presence forces error-correction level H (30% recovery), and H needs more
         modules to carry the same link. Shrink the mark from 0.30 to 0.20 of the width and the
         code is bit-for-bit identical.
         What the mark covers is only 9% of the code area at 0.30, comfortably inside H's 30%
         budget, so it is not the obstruction that costs anything either.
         The real trade is H versus M — and it does NOT have to be taken, because growing the box
         recovers the same margin while keeping the branding. This figure exists so the comparison
         is visible rather than argued about. */
      var bare = root.SFQR.encode(url, 'M');
      out.withoutMarkMm = (qrIn * 25.4) / (bare.size + 8);
      out.markCostsMm = out.withoutMarkMm - out.moduleMm;
      /* The size this label would need WITH the mark to match a plain code at the current size. */
      out.sizeToMatchIn = qrIn * ((qr.size + 8) / (bare.size + 8));
    } catch (e) { out.error = 'This link is too long to encode.'; }
    return out;
  }

  /* g196 — THE FINISH A GUEST IS LOOKING AT, resolved to the catalogue's own ids.
     Kirk: "is it possible the client lands on the finish they are scanning for… say there is a
     canvas with a white floating frame… just so they can just land on the exact piece and options
     they see in their room." Template v32 reads `m` (mediumId) and `s` (size) and preselects them,
     dropping anything the catalogue does not recognise.
     A label stores the medium as the words printed on it. This resolves those words back to the
     template id EXACTLY — no fuzzy matching, because a near-match that picks the wrong finish is
     worse than no match at all, and the site drops an unknown id harmlessly anyway. */
  /* g197 — HIS DECISION, WHICH SETTLES THE OPEN QUESTION: "i wanted the floating frame as a add
     on. That way a regular customer can see the canvas and price they want to order and simply add
     a floating frame and see the difference in cost."
     So the finish is medium + ADD-ONS, and the label needs to carry them. `f=` takes a
     comma-separated list, each optionally `id:colour` — `f=floating-frame:white`. Ids are what the
     website export emits, `slug(name)`, so "Floating Frame" is `floating-frame`; the website chat
     flagged that their own example (`frame`) was wrong, and they were right to.
     The colour matters as much as the frame: "a canvas with a WHITE floating frame" is what is on
     the wall, and landing on a black one is landing on the wrong thing. */
  function addOnOptions() {
    var out = [];
    try {
      var st = sfState();
      ((st && st.pricing && st.pricing.addOns) || []).forEach(function (a) {
        if (a.websiteEnabled === false) return;
        out.push({ id: slug(a.name) || a.id, name: a.name,
          colours: (a.colors || []).slice(), mediumId: a.mediumId || '' });
      });
    } catch (e) {}
    return out;
  }

  function finishFor(lbl) {
    var out = { m: '', s: '', f: '' };
    if (!lbl) return out;
    if (lbl.mediumId) out.m = String(lbl.mediumId);
    var want = String(lbl.medium || '').trim().toLowerCase();
    if (!out.m && want) {
      var hit = mediumSizeOptions().filter(function (o) {
        return String(o.medium || '').trim().toLowerCase() === want && o.mediumId;
      })[0];
      if (hit) out.m = String(hit.mediumId);
    }
    if (lbl.size) out.s = String(lbl.size).trim();
    /* Stored on the label as `addOns:[{id,colour}]`. Resolved against the real add-on list so a
       renamed or retired one is DROPPED rather than sent — the site ignores an unknown id, but a
       link that promises a finish it cannot select is a link that quietly disappoints. */
    var known = addOnOptions();
    var parts = (lbl.addOns || []).map(function (a) {
      var hit = known.filter(function (k) {
        return String(k.id).toLowerCase() === String(a.id || '').toLowerCase();
      })[0];
      if (!hit) return '';
      var col = String(a.colour || '').trim();
      /* Only a colour the add-on actually offers; never invent one. */
      if (col && !(hit.colours || []).some(function (c) {
        return String(c).toLowerCase() === col.toLowerCase();
      })) col = '';
      return hit.id + (col ? ':' + col.toLowerCase().replace(/\s+/g, '-') : '');
    }).filter(Boolean);
    if (parts.length) out.f = parts.join(',');
    return out;
  }

  function urlFor(lbl) {
    var p = property(lbl.propertyId);
    var base = (data.settings.baseUrl || DEFAULTS.baseUrl).replace(/\/+$/, '');
    var q = [];
    if (p && p.code) q.push('h=' + encodeURIComponent(p.code));
    if (lbl.artworkId) q.push('id=' + encodeURIComponent(lbl.artworkId));
    /* OFF unless he asks for it, because it COSTS SCANNING MARGIN and nothing else does:
       measured on his 1.2in label, `?h=&id=` gives 0.622mm modules, adding m and s gives 0.535mm.
       Both are comfortable, but a longer link is the one change here that a phone can feel, so it
       is his decision rather than a default I chose for him. The readout beside the control shows
       the real figure either way, because scanReport() encodes THIS url. */
    if (data.settings.linkFinish) {
      var fin = finishFor(lbl);
      if (fin.m) q.push('m=' + encodeURIComponent(fin.m));
      if (fin.s) q.push('s=' + encodeURIComponent(fin.s));
      if (fin.f) q.push('f=' + encodeURIComponent(fin.f));
    }
    var url = base + (q.length ? '?' + q.join('&') : '');
    return data.settings.upperCaseUrl ? upperUrl(url) : url;
  }

  /* Uppercase everything the QR standard can carry in alphanumeric mode, and nothing else.
     `%xx` escapes from encodeURIComponent are LEFT ALONE — a percent escape is case-insensitive
     to a browser, but uppercasing it changes nothing useful and makes the intent harder to read.
     A code or an id containing a character outside the alphanumeric set means the whole payload
     falls back to byte mode anyway; the caller is told rather than the fact being hidden. */
  var QR_ALNUM = /^[0-9A-Z $%*+\-.\/:]*$/;
  function upperUrl(url) { return String(url).toUpperCase(); }
  function urlIsDense(url) { return QR_ALNUM.test(String(url).toUpperCase()); }

  // ------------------------------------------------------------ renderer ---

  function fitText(ctx, text, maxWidth, family, startPx, minPx, weight) {
    var px = startPx;
    while (px > minPx) {
      ctx.font = (weight ? weight + ' ' : '') + px + 'px ' + family;
      if (ctx.measureText(text).width <= maxWidth) break;
      px -= 2;
    }
    ctx.font = (weight ? weight + ' ' : '') + px + 'px ' + family;
    return px;
  }

  var SERIF = 'Georgia, "Times New Roman", serif';
  var SANS = '"Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';

  /* Draws one label onto a canvas at 300 dpi. This is the single source of
     truth for layout — the preview, the print sheet and the PNG export all
     use it, so spacing and type can never drift apart. */
  /* ==========================================================================================
     g189 — A BIGGER LABEL, WITHOUT RETUNING TWENTY NUMBERS.
     ==========================================================================================
     Kirk: "I think the labels should print 4.5 x 2.5 in size as the smaller print does not look
     as clean."

     drawLabel carries about two dozen pinned pixel measurements — PAD 62, y += 84, '25px', the
     rule positions — all tuned against the original 1050x585 canvas. Changing the label size by
     editing each of them is twenty chances to get one wrong, and the failure would be a label
     that looks nearly right.

     So the drawing keeps working in its ORIGINAL DESIGN UNITS and the CANVAS IS SCALED instead:
     one transform, every existing measurement still valid, and a new size is now a two-number
     change rather than a re-tune. 4.5x2.5 against 3.5x1.95 is 1.2857 across and 1.2821 down —
     a 0.3% difference in aspect, which is invisible in type and not worth a letterbox.

     THE QR CODE IS THE ONE EXCEPTION and it matters: its size is in REAL INCHES (g175 measured
     the module size a phone needs). Under a scaled context a box of B units prints B x scale, so
     the box is divided by the scale to land at exactly the inches asked for. Without that, a
     1.2in code on the larger label would print at 1.54in — bigger is harmless here, but the
     readout would then be lying about the module size, and that readout is what g175 exists for.
     ========================================================================================== */
  function labelSize() {
    var choice = (data.settings && data.settings.labelSize) || 'large';
    return choice === 'small' ? { w: 3.5, h: 1.95 } : { w: 4.5, h: 2.5 };
  }

  function drawLabel(canvas, lbl, styleId) {
    var s = STYLES[styleId] || STYLES.card;
    var size = labelSize();
    var outW = Math.round(size.w * DPI), outH = Math.round(size.h * DPI);
    canvas.width = outW; canvas.height = outH;
    var ctx = canvas.getContext('2d');
    var sx = outW / W, sy = outH / H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);

    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, W, H);

    if (s.plate) {
      ctx.strokeStyle = s.rule; ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    }

    var PAD = 62;
    var inner = W - PAD * 2;
    var withLogo = !!data.settings.logo;
    // A logo forces error-correction level H, which makes the code denser, so the
    // box grows to keep each module physically big enough for a phone to read.
    /* ==========================================================================================
       g173 — THE CODE SIZE IS THE BIGGEST LEVER ON SCANNING, so it stopped being hard-coded.
       ==========================================================================================
       Kirk: "My main concern is scanning accuracy and reliability. I want the scan to work right
       away." MEASURED on this label at 300dpi, with the camera mark (which forces error-correction
       level H, the densest):

         box 240px (0.80in) -> module 0.415mm   barely over the 0.40mm most phones need
         box 300px (1.00in) -> module 0.518mm
         box 360px (1.20in) -> module 0.677mm

       So the default was sitting 4% above the threshold — fine on a desk, marginal on a wall in a
       corridor at arm's length. A rough rule is that a code reads from about ten times its own
       width, so 20mm of code wants the phone within 200mm of the label.

       FOR COMPARISON, the whole uppercase-and-shorten-the-URL argument moves the same number from
       0.415 to 0.452mm. Real, and roughly a TENTH of what simply printing the code bigger does.
       Worth doing both; worth knowing which one matters.

       The size is now a setting in TENTHS OF AN INCH, because that is how it will be judged — held
       at arm's length against a wall, not counted in pixels. */
    var qrIn = Number(data.settings.qrSizeIn);
    if (!(qrIn > 0)) qrIn = withLogo ? 1.2 : 1.0;
    /* g175 — THE CEILING IS 1.2in, AND IT WAS FOUND BY TESTING RATHER THAN CHOSEN.
       At 1.4in the code's top edge rises to y=73, which is level with the title, and a long title
       cannot be shrunk out of the way: fitText stops at 34px and "Botanical Sky Over the Sooke
       Hills at First Light" is still wider than the column that remains. The title would print
       behind the code. 1.2in leaves the title clear with the code top at y=133 against a title
       ending at y=132.
       Nothing is lost by the cap: 1.2in gives a 0.62mm module, which a phone resolves from about
       half a metre — further than anyone stands to scan a picture label. */
    var maxIn = Math.min(1.2, LABEL_H_IN - 0.35, (inner - 140) / DPI);
    qrIn = Math.max(0.6, Math.min(maxIn, qrIn));
    /* Divided by the horizontal scale so the printed code is exactly qrIn INCHES — see the note
       at the head of drawLabel. The readout in scanReport() reports the same real inches. */
    var qrBox = Math.round(qrIn * DPI / sx), qrGap = 40;
    var textW = inner - qrBox - qrGap;

    var y = PAD;

    /* g175 — THE TEXT MUST KNOW WHERE THE CODE IS.
       The old comment said title and location "sit above the QR code, so they get the full
       width". That was true while the code was a fixed 0.80in tall: its top sat at y=253, below
       both lines. Making the size adjustable broke the assumption without breaking the code — at
       1.2in the top rises to y=133, ABOVE the title's own baseline, and a long title fitted to
       the full width would run straight under the code.

       Nothing would look obviously wrong on screen either: the title would simply be printed
       behind a QR code, and the first person to notice would be the print lab or a guest.

       So the width each line may use is decided from the code's ACTUAL position, not from an
       assumption about it. `qTop` is computed before any text is drawn and every line above it
       keeps the full width, every line level with it is fitted to the text column. */
    var qTopReserve = H - PAD - qrBox - 30;
    var widthAt = function (lineTop, lineHeight) {
      return (lineTop + lineHeight > qTopReserve - 8) ? textW : inner;
    };

    ctx.fillStyle = s.ink;
    ctx.textBaseline = 'top';
    fitText(ctx, lbl.title || 'Untitled', widthAt(y, 70), SERIF, 62, 34);
    ctx.fillText(lbl.title || 'Untitled', PAD, y);
    y += 84;

    if (lbl.location) {
      ctx.fillStyle = s.soft;
      fitText(ctx, lbl.location, widthAt(y, 30), SANS, 26, 17);
      ctx.fillText(lbl.location, PAD, y);
      y += 52;
    } else {
      y += 18;
    }

    // Rule
    ctx.strokeStyle = s.rule; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD, y + 0.5); ctx.lineTo(W - PAD, y + 0.5); ctx.stroke();
    y += 34;

    // Artist / studio / spec
    ctx.fillStyle = s.ink;
    ctx.font = '600 25px ' + SANS;
    ctx.fillText(data.settings.artist || DEFAULTS.artist, PAD, y);
    y += 40;

    ctx.fillStyle = s.soft;
    ctx.font = '300 24px ' + SANS;
    ctx.fillText(data.settings.studio || DEFAULTS.studio, PAD, y);
    y += 44;

    var spec = [lbl.medium, lbl.size].filter(Boolean).join('  \u00b7  ');
    if (lbl.edition) spec = spec ? spec + '  \u00b7  ' + lbl.edition : lbl.edition;
    if (spec) {
      fitText(ctx, spec, textW, SANS, 23, 15, '300');
      ctx.fillText(spec, PAD, y);
    }

    // QR — always dark on light with a real quiet zone, on every style.
    // An inverted code fails on a lot of phone cameras.
    var qx = W - PAD - qrBox;
    var qy = qTopReserve;   /* g175: the same figure the text measured itself against */
    drawQR(ctx, urlFor(lbl), qx, qy, qrBox, withLogo);

    /* ==========================================================================================
       g192 — "OWN THIS PIECE" WAS TOO SMALL TO DO ITS JOB.
       ==========================================================================================
       Kirk: "the line 'own this piece' should be larger on the label as it is so small it could
       easily be missed."

       It was 19px in the label's design units and drawn in `s.soft`, the muted colour used for
       captions — so the ONE line on the label whose job is to make a guest scan the code was the
       quietest thing on it. Everything else can be missed without cost; that line cannot.

       THREE CHANGES, and the size is the least of them:
         - it scales with the QR code (11% of the code's width) rather than sitting at a fixed 19px,
           so it stays in proportion at every label and code size he can choose;
         - it is drawn in `s.ink`, the full-strength colour, not the muted one;
         - the baseline moves down by the text's own height, because a larger font drawn from the
           old baseline would have climbed INTO the bottom of the QR code — and modules covered by
           text are modules the error correction has to spend.
       fitText keeps a longer phrase inside the code's width rather than letting it run under the
       text column, so he can change the wording without it colliding with anything. */
    var cta = data.settings.cta || DEFAULTS.cta;
    var ctaPx = Math.max(19, Math.round(qrBox * 0.11));
    ctx.fillStyle = s.ink;
    fitText(ctx, cta, qrBox + qrGap * 0.6, SANS, ctaPx, 17, '700');
    var cw = ctx.measureText(cta).width;
    /* A canvas font string is '700 31px Sans' — parseInt() reads the WEIGHT, 700, not the size.
       That put the baseline 700px below the code, i.e. clean off a 585px label. The existing
       bounds check caught it; my own layout tool hit the identical trap earlier the same day, so
       the size is now matched explicitly. */
    var drawnPx = (/(\d+(?:\.\d+)?)px/.exec(ctx.font) || [0, ctaPx])[1];
    drawnPx = Number(drawnPx) || ctaPx;
    /* g193 — Kirk: "can you not just lower the own this font to space it away from the qr?" That is
       exactly the right instinct and it is what the baseline move already does — but only by the
       text's own height, which leaves it sitting tight against the code. A real gap is added on
       top, scaled to the code so it holds at every size. Checked against the label's bottom edge:
       at the largest combination this still leaves room to spare. */
    var ctaGap = Math.round(qrBox * 0.055);
    ctx.fillText(cta, qx + (qrBox - cw) / 2, qy + qrBox + drawnPx + ctaGap);

    return canvas;
  }

  function drawQR(ctx, text, x, y, box, withLogo) {
    var qr;
    try { qr = root.SFQR.encode(text, withLogo ? 'H' : 'M'); }
    catch (e) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, box, box);
      ctx.fillStyle = '#c00'; ctx.font = '16px ' + SANS;
      ctx.fillText('QR too long', x + 8, y + box / 2);
      return;
    }
    var quiet = 4;                                  // spec minimum, keeps scanners happy
    var total = qr.size + quiet * 2;
    var px = box / total;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, box, box);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (!qr.modules[r][c]) continue;
        ctx.fillRect(
          Math.floor(x + (c + quiet) * px),
          Math.floor(y + (r + quiet) * px),
          Math.ceil(px), Math.ceil(px)
        );
      }
    }
    if (withLogo) drawCameraMark(ctx, x, y, box);
  }


  /* The Frozen Moments camera mark, as a 1-bit bitmap so the module needs no
     image file and no asynchronous loading. Rows are packed most-significant-bit
     first; a set bit is ink, a clear bit is transparent. */
  var LOGO = {
    w: 234, h: 176,
    b64: 'AAAAAAAAAAAAAAH/////////4AAAAAAAAAAAAAAAAAAAAAAAAAAAA//////////+AAAAAAAAAAAAAAAAAAAAAAAAAAAD///////////gAAAAAAAAAAAAAAAAAAAAAAAAAAH///////////wAAAAAAAAAAAAAAAAAAAAAAAAAAP///////////4AAAAAAAAAAAAAAAAAAAAAAAAAAf///////////8AAAAAAAAAAAAAAAAAAAAAAAAAAf///////////+AAAAAAAAAAAAAAAAAAAAAAAAAA////////////+AAAAAAAAAAAAAAAAAAAAAAAAAB/////////////AAAAAAAAAAAAAAAAAAAAAAAAAD/////////////gAAAAAAAAAAAAAAAAAAAAAAAAD/////////////gAAAAAAAAAAAAAAAAAAAAAAAAH/////////////wAAAAAAAAAAAAAAAAAAAAAAAAP/////////////4AAAAAAAAAAAAAAAAAAAAAAAAP/////////////4AAAAAAAAAAAAAAAAAAAAAAAAf/////////////8AAAAAAAAAAAAAAAAAAAAAAAA//////////////+AAAAAAAAAAAAAAAAAAAAAAAA//////////////+AAAAAAAAAAAAAAAAAAAAAAAB///////////////AAAAAAAAAAAAAAAAAAAAAAAD///////////////gAAAAAAAAAAAAAAAAAAAAAAH///////////////gAAAAAAAAAAAAAAAAAAAAAAH///////////////wAAAAAAAAAAAAAAAAAAAAAAP///////////////4AAAAAAAAAAAAAAAAAAAAAAf///////////////8AAAAAAAAAAAAAAAAAAAAAAf///////////////8AAAAAAAAAAAAAAAAAAAAAA////////////////+AAAAAAAAAAAAAAAAAAAAAB/////////////////AAAAAAAAAAAAAAAAAAAAAB/////////////////AAAAAAAAAAAAAAAAAAAAAD/////////////////gAAAAAAAAAAAAAAAAAAAAP/////////////////4AAAAAAAAAAAAD/////////////////////////////////wAAAA///////////////////////////////////AAAD///////////////8AAAH///////////////wAAP//////////////+AAAAAP//////////////8AAf//////////////gAAAAAB//////////////+AA//////////////8AAAAAAAH//////////////AB//////////////gAAAAAAAB//////////////gD/////////////+AAAf/+AAAP/////////////wH/////////////4AAf///+AAD/////////////4H/////////////gAH/////4AA/////////////4P////////////+AA///////AAf////////////8P////////////4AH///////4AH////////////8f////////////gAf///////+AB////////////+f////////////AD/////////wA////////////+////////////8AP///gAB///8AP///////////+////////////4Af//gAAAB//+AH////////////////////////gB//4AAAAAP//gD////////////////////////AH//AAAAAAB//4A///////////////////////+AP/8AAAAAAAP/8Af//////////////////////8A//wAAAAAAAD//AP//////////////////////4B/+AAAAAAAAA//gH//////////////////////wD/8AAAAAAAAAP/wD//////////////////////gP/wAAAAAAAAAD/4B//////////////////////Af/AAAAAAAAAAB/+A/////////////////////+A/+AAAAAAAAAAAf/Af////////////////////8B/4AAAAAAAAAAAP/gP////////////////////4D/wAAAAAAAAAAAH/wH////////////////////wH/gAAAAAAAAAAAB/4D////////////////////gP/AAAAAAAAAAAAA/8B////////////////////Af+AAAAAAAAAAAAAf+B////////////////////A/4AAAAAAAAAAAAAP+A///////////////////+B/wAAAAAAAAAAAAAH/Af//////////////////8D/gAAAAAAAAAAAAAD/gP//////////////////4D/gAAAAAAAAAAAAAB/wP//////////////////4H/AAAAAAAAAAAAAAA/4H//////////////////wP+AAAAAAAAAAAAAAAf4H//////////////////gf8AAAAAAAAAAAAAAAP8D//////////////////gf4AAAAAAAAAAAAAAAP+B//////////////////A/wAAAAAAAAABAAAAAH+B//////////////////A/wAAAAAAAAAfAAAAAD/A/////////////////+B/gAAAAAAAAP+AAAAAB/g/////////////////+D/AAAAAAAAH/+AAAAAB/gf////////////////8D/AAAAAAAD//8AAAD/8/wf////////////////8H+AAAAAAB///4AAAD/4/wP////////////////4H+AAAAAAf///4AAAH/4f4P////////////////4P8AAAAAP////wAAAH/4f4H////////////////4P4AAAAH/////gAAAP/4P8H////////////////wP4AAAB//////hAAAf/4H8H////////////////wfwAAA///////DAAAf/4H8D////////////////gfwAAf//////wHAAA//4H+D////////////////g/wAH//////8A/AAA//4D+D////////////////g/gD//////+AP/gAB//4D+B////////////////A/gD//////gD//gAB//wB/B////////////////B/AH/////4AH//gAD//wB/B////////////////B/AH////+AAH//gAH//wB/B////////////////B/AH////gAAP//gAH//wA/g///////////////+D+AH///8AAAP//gAP//wA/g///////////////+D+AH///8AAAP//wAP//wA/g///////////////+D+AP///4AAAP//wAf//wA/g///////////////+D+AP/j/4AAAf//wAf//wAfwf//////////////+D+AP4D/wAAAf//wA///gAfwf//////////////+H8AOAD/wAAAf//wB///gAfwf//////////////8H8AAAH/gAAIf//wB///gAfwf//////////////8H8AAAH/gADw///4D///gAfwf//////////////8H8AAAP/gA/g///4D///gAPwf//////////////8H8AAAP/AP/A/+/4H///gAPwf//////////////8H8AAAP/D/+B/+/4H///gAP4f//////////////8H4AAAf///8B/+/4P/f/gAP4f//////////////8H4AAAf///4B/+f8P+//gAP4f//////////////8H4AAA////wB/8f8f+//AAP4f//////////////8H4AAA////wD/8f8/8//AAP4f//////////////8H4AAH////gD/8f8/8//AAP4f//////////////8H4AB/////AD/8f9/5//AAP4f//////////////8H4AB////8AD/4f//x//AAP4f//////////////8H4AD////AAH/4f//x//AAP4f//////////////8H4AD///wAAH/4f//h//AAPwf//////////////8H8AD//8AAAH/4P//h//AAPwf//////////////8H8AH//wAAAH/wP//D/+AAfwf//////////////8H8AH//gAAAP/wP//D/+AAfwf//////////////8H8AH//gAAAP/wP/+D/+AAfwf//////////////8H8APP/gAAAP/wP/8D/+AAfwf//////////////+H8AAP/AAAAf/wP/8H/+AAfwf//////////////+D+AAf/AAAAf/gP/4H/+AAfw///////////////+D+AAf+AAAAf/gP/4H/+AA/g///////////////+D+AAf+AAAAf/gH/wH/+AA/g///////////////+D+AA/8AAAA//gH/gP/8AA/g////////////////D/AA/8AAAA//AH/gP/8AA/g////////////////B/AB/8AAAA//AAAAP/8AB/B////////////////B/AB/4AAAA//AAAAP/8AB/B////////////////B/gB/4AAAB//AAAAP/8AB/B////////////////g/gD/wAAAB/+AAAAf/8AD+D////////////////g/gD/wAAAB/+AAAAf/8AD+D////////////////g/wD/wAAAB/+AAAAf/8AH+D////////////////wfwH/gAAAD/+AAAAf/8AH8H////////////////wf4H/gAAAD/8AAAA//4AP8H////////////////wP4P/AAAAAAAAAAA//4AP4H////////////////4P8P/AAAAAAAAAAA//4Af4P////////////////4P8H/AAAAAAAAAAA//4Af4P////////////////8H+B+AAAAAAAAAAA//4A/wf////////////////8H+A+AAAAAAAAAAB//4A/wf////////////////+D/AcAAAAAAAAAAB//wB/g/////////////////+B/gMAAAAAAAAAAAAAAD/A//////////////////B/gAAAAAAAAAAAAAAAD/B//////////////////A/wAAAAAAAAAAAAAAAH+B//////////////////g/4AAAAAAAAAAAAAAAP+D//////////////////gf8AAAAAAAAAAAAAAAf8D//////////////////wP+AAAAAAAAAAAAAAAf4H//////////////////4H+AAAAAAAAAAAAAAA/wP//////////////////4H/AAAAAAAAAAAAAAB/wP//////////////////8D/gAAAAAAAAAAAAAD/gf//////////////////+B/wAAAAAAAAAAAAAH/A///////////////////+A/4AAAAAAAAAAAAAP+A////////////////////Af8AAAAAAAAAAAAAf8B////////////////////gP/AAAAAAAAAAAAB/4D////////////////////wH/gAAAAAAAAAAAD/wH////////////////////4D/wAAAAAAAAAAAH/gP////////////////////8B/8AAAAAAAAAAAf/Af////////////////////+A/+AAAAAAAAAAA/+A//////////+f//////////Af/gAAAAAAAAAD/8B//////////+f//////////gP/wAAAAAAAAAH/4D//////////+f//////////wH/8AAAAAAAAAf/wH//////////8P//////////4B//AAAAAAAAB//AP//////////8P//////////8A//wAAAAAAAH/+Af//////////4H//////////+Af/8AAAAAAA//8A///////////wD///////////AH//gAAAAAD//wB///////////gB///////////gB//+AAAAA///AH///////////AA///////////4A///4AAAP//+AP//////////+AAf//////////8AP///+A////4Af//////////8AAH///////////AD/////////AB///////////wAAA////////Af/gAf///////8AD/+A///////+AAAAAAAAAAAAAP/4AH///////wAP/8AAAAAAAAAAAAAAAAAAAAAAH/+AA//////+AA//wAAAAAAAAAAAAAAAAAAAAAAB//gAD/////gAD//gAAAAAAAAAAAAAAAAAAAAAAA//4AAP///4AAP/+AAAAAAAAAAAAAAAAAAAAAAAAP/+AAAD/gAAA//8AAAAAAAAAAAAAAAAAAAAAAAAH//gAAAAAAAH//wAAAAAAAAAAAAAAAAAAAAAAAAB//8AAAAAAA///AAAAAAAAAAAAAAAAAAAAAAAAAAf//wAAAAAH//+AAAAAAAAAAAAAAAAAAAAAAAAAAH///AAAAB///4AAAAAAAAAAAAAAAAAAAAAAAAAAB////AAB////gAAAAAAAAAAAAAAAAAAAAAAAAAAAf/////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAH/////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////////+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH///////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/////+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB///AAAAAAAAAAAAAAAAAA'
  };
  var _logoCanvas = null;

  function logoCanvas() {
    if (_logoCanvas) return _logoCanvas;
    if (typeof atob !== 'function' || typeof document === 'undefined') return null;
    var raw;
    try { raw = atob(LOGO.b64); } catch (e) { return null; }
    var cv = document.createElement('canvas');
    cv.width = LOGO.w; cv.height = LOGO.h;
    var c = cv.getContext('2d');
    if (!c || typeof c.createImageData !== 'function') return null;
    var id = c.createImageData(LOGO.w, LOGO.h);
    var n = LOGO.w * LOGO.h;
    for (var i = 0; i < n; i++) {
      var on = (raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
      var p = i * 4;
      id.data[p] = 0; id.data[p + 1] = 0; id.data[p + 2] = 0;
      id.data[p + 3] = on ? 255 : 0;
    }
    c.putImageData(id, 0, 0);
    _logoCanvas = cv;
    return cv;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* Knocks a white plate out of the middle of the code and places the camera
     mark on it. Level H recovers roughly 30% of a damaged code, which is what
     makes this safe; the size cap below is where it was measured to stop being
     safe, not a guess. */
  function drawCameraMark(ctx, x, y, box) {
    var frac = Math.min(0.30, Math.max(0.12, +data.settings.logoScale || 0.26));
    var lw = Math.round(box * frac);
    var lh = Math.round(lw * LOGO.h / LOGO.w);
    var cx = x + box / 2, cy = y + box / 2;
    var lx = cx - lw / 2, ly = cy - lh / 2;

    var padX = Math.round(lw * 0.12), padY = Math.round(lh * 0.16);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, lx - padX, ly - padY, lw + padX * 2, lh + padY * 2, lh * 0.22);
    ctx.fill();

    var mark = logoCanvas();
    if (!mark || typeof ctx.drawImage !== 'function') return;
    if ('imageSmoothingEnabled' in ctx) {
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(mark, lx, ly, lw, lh);
  }

  root.SFLabelQRCore = {
    W: W, H: H, LABEL_W_IN: LABEL_W_IN, LABEL_H_IN: LABEL_H_IN,
    STYLES: STYLES, DEFAULTS: DEFAULTS,
    data: data, ui: ui,
    uid: uid, slug: slug, load: load, save: save, labelSize: labelSize, finishFor: finishFor, addOnOptions: addOnOptions,
    upperUrl: upperUrl, urlIsDense: urlIsDense, scanReport: scanReport,
    inStudioFlow: inStudioFlow, catalogue: catalogue, mediumSizeOptions: mediumSizeOptions,
    property: property, label: label, labelsFor: labelsFor, urlFor: urlFor,
    drawLabel: drawLabel, drawCameraMark: drawCameraMark
  };
})(typeof window !== 'undefined' ? window : globalThis);
