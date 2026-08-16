/* ==========================================================================
   StudioFlow — Artwork Labels & QR Codes : user interface
   Depends on qr.js and label-core.js.
   Exposes window.SFLabelQR = { render(container) }
   ========================================================================== */
(function (root) {
  'use strict';

  var C = root.SFLabelQRCore;
  var D = C.data, U = C.ui;
  var host = null;

  // ------------------------------------------------------------- styling ---

  var CSS = [
    '.lq-wrap{font:14px/1.5 "Segoe UI",system-ui,-apple-system,Helvetica,Arial,sans-serif;color:#1f2328;padding:4px 2px 40px}',
    '.lq-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 4px}',
    '.lq-h h2{font:600 22px/1.2 "Segoe UI",system-ui,sans-serif;margin:0}',
    '.lq-sub{color:#6e767f;font-size:13px;margin:0 0 18px}',
    '.lq-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;padding:14px;background:#f4f6f8;border:1px solid #e0e5ea;border-radius:8px;margin-bottom:16px}',
    '.lq-f{display:flex;flex-direction:column;gap:4px}',
    '.lq-f label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6e767f;font-weight:600}',
    '.lq-f input,.lq-f select{padding:7px 9px;border:1px solid #c9cfd6;border-radius:5px;font:inherit;background:#fff;min-width:150px}',
    '.lq-f input:focus,.lq-f select:focus{outline:2px solid #2f6f8f;outline-offset:-1px}',
    '.lq-btn{padding:8px 14px;border:1px solid #c9cfd6;border-radius:5px;background:#fff;font:inherit;cursor:pointer}',
    '.lq-btn:hover{background:#eef2f6}',
    '.lq-btn.primary{background:#2f6f8f;border-color:#2f6f8f;color:#fff}',
    '.lq-btn.primary:hover{background:#28607c}',
    '.lq-btn.danger{color:#9b2226;border-color:#e0b4b5}',
    '.lq-btn:disabled{opacity:.45;cursor:not-allowed}',
    '.lq-cols{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:22px;align-items:start}',
    '@media (max-width:980px){.lq-cols{grid-template-columns:1fr}}',
    '.lq-card{border:1px solid #e0e5ea;border-radius:8px;overflow:hidden}',
    '.lq-card h3{margin:0;padding:11px 14px;font:600 13px/1 "Segoe UI",sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#5a6470;background:#f4f6f8;border-bottom:1px solid #e0e5ea}',
    '.lq-card .lq-body{padding:14px}',
    'table.lq-t{width:100%;border-collapse:collapse;font-size:13px}',
    'table.lq-t th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#6e767f;padding:8px 10px;border-bottom:1px solid #e0e5ea;background:#fafbfc}',
    'table.lq-t td{padding:8px 10px;border-bottom:1px solid #eef1f4;vertical-align:top}',
    'table.lq-t tr{cursor:pointer}',
    'table.lq-t tr.sel td{background:#eaf2f7}',
    'table.lq-t tr:hover td{background:#f4f8fb}',
    '.lq-empty{padding:26px 14px;text-align:center;color:#8b949e}',
    '.lq-prev{display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px;background:#eceff2;border-radius:6px}',
    '.lq-prev canvas{width:100%;max-width:430px;height:auto;box-shadow:0 2px 10px rgba(0,0,0,.16);border-radius:2px;display:block}',
    '.lq-note{font-size:12px;color:#6e767f;margin:10px 0 0}',
    '.lq-url{font:12px/1.4 ui-monospace,Consolas,monospace;color:#2f6f8f;word-break:break-all;background:#f4f6f8;padding:8px 10px;border-radius:5px;margin-top:10px}',
    '.lq-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}',
    '.lq-mod{position:fixed;inset:0;background:rgba(15,20,26,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px}',
    '.lq-mod .box{background:#fff;border-radius:10px;max-width:560px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.3)}',
    '.lq-mod h3{margin:0;padding:16px 20px;font:600 16px/1 "Segoe UI",sans-serif;border-bottom:1px solid #e0e5ea}',
    '.lq-mod .content{padding:20px;display:flex;flex-direction:column;gap:14px}',
    '.lq-mod .foot{padding:14px 20px;border-top:1px solid #e0e5ea;display:flex;gap:10px;justify-content:flex-end}',
    '.lq-mod textarea{width:100%;min-height:150px;font:12px/1.5 ui-monospace,Consolas,monospace;padding:10px;border:1px solid #c9cfd6;border-radius:5px;resize:vertical}',
    '.lq-warn{background:#fff6e5;border:1px solid #f0d9a8;color:#7a5a1a;padding:10px 12px;border-radius:6px;font-size:13px}',
    // print sheet
    '.lq-sheet{display:none}',
    /* g189 — the label SIZE is now a setting, so it cannot be pinned here. Each label carries its
       own inline width and height instead; these rules only handle the page. The old
       `body>.lq-sheet` selector went with g188, which moved the sheet into #modalRoot so the app's
       global print rule stops hiding it. */
    '@media print{',
    '@page{size:letter portrait;margin:0.4in}',
    '.lq-sheet .pg{display:flex;flex-wrap:wrap;gap:0.25in;align-content:flex-start;page-break-after:always}',
    '.lq-sheet .pg:last-child{page-break-after:auto}',
    '.lq-sheet .lb{outline:1px dashed #bbb;outline-offset:0}',
    '.lq-sheet .lb img{display:block}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('lq-styles')) return;
    var st = document.createElement('style');
    st.id = 'lq-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------ plumbing ---

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e[k] = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (k) { if (k) e.appendChild(k); });
    return e;
  }
  function field(labelText, input) {
    return el('div', { class: 'lq-f' }, [el('label', { text: labelText }), input]);
  }
  function input(attrs) { return el('input', attrs); }

  function modal(title, contentNodes, onOk, okText) {
    var box = el('div', { class: 'box' }, [
      el('h3', { text: title }),
      el('div', { class: 'content' }, contentNodes)
    ]);
    var wrap = el('div', { class: 'lq-mod' }, [box]);
    var close = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
    box.appendChild(el('div', { class: 'foot' }, [
      el('button', { class: 'lq-btn', text: 'Cancel', onclick: close }),
      el('button', {
        class: 'lq-btn primary', text: okText || 'Save',
        onclick: function () { if (onOk() !== false) close(); }
      })
    ]));
    wrap.onclick = function (e) { if (e.target === wrap) close(); };
    document.body.appendChild(wrap);
    var first = box.querySelector('input,select,textarea');
    if (first) first.focus();
    return close;
  }

  function currentStyle() { return D.settings.style || 'card'; }

  // -------------------------------------------------------------- render ---

  function render(container) {
    host = container || host || defaultHost();
    if (!host) return;
    injectCSS();
    C.load();
    if (!U.propertyId && D.properties.length) U.propertyId = D.properties[0].id;
    draw();
  }

  /* StudioFlow calls page modules as render() with no argument, so fall back to
     the app's own workspace element. If StudioFlow's container has a different
     id, pass it explicitly: SFLabelQR.render(document.getElementById('...')). */
  /* g168 — CONFIRMED: StudioFlow's page container is `#workspace`. Checked against the
     real app, not assumed — 40 modules render with `sf.$('workspace').innerHTML`, and
     index.html carries `id="workspace"`. It was already first in this list, so the
     fallback would have found it; the check is recorded so a future reader knows it was
     verified rather than lucky. */
  function defaultHost() {
    var ids = ['workspace', 'pageContent', 'content', 'main', 'app'];
    for (var i = 0; i < ids.length; i++) {
      var n = document.getElementById(ids[i]);
      if (n) return n;
    }
    var sel = ['.workspace', '#workspace', 'main', '.page-content'];
    for (var j = 0; j < sel.length; j++) {
      var q = document.querySelector && document.querySelector(sel[j]);
      if (q) return q;
    }
    return null;
  }

  function draw() {
    host.innerHTML = '';
    var wrap = el('div', { class: 'lq-wrap' });

    wrap.appendChild(el('div', { class: 'lq-h' }, [el('h2', { text: 'Artwork Labels & QR Codes' })]));
    wrap.appendChild(el('p', {
      class: 'lq-sub',
      text: 'Gallery-style labels with a tracked QR code, one per piece per venue. Every label uses the same type and spacing, so a wall of them stays consistent.'
    }));

    wrap.appendChild(toolbar());

    if (!D.properties.length) {
      wrap.appendChild(el('div', { class: 'lq-card' }, [
        el('div', { class: 'lq-empty', html: 'Add a venue to begin — a hotel, resort, show suite or gallery.<br>Each venue gets its own tracking code so commission is attributed automatically.' })
      ]));
      host.appendChild(wrap);
      return;
    }

    var cols = el('div', { class: 'lq-cols' }, [listCard(), previewCard()]);
    wrap.appendChild(cols);
    host.appendChild(wrap);
  }

  function toolbar() {
    var propSel = el('select', {
      onchange: function () { U.propertyId = this.value; U.selectedId = null; draw(); }
    });
    D.properties.forEach(function (p) {
      propSel.appendChild(el('option', { value: p.id, text: p.name, selected: p.id === U.propertyId ? 'selected' : null }));
    });

    var styleSel = el('select', {
      onchange: function () { D.settings.style = this.value; C.save(); draw(); }
    });
    Object.keys(C.STYLES).forEach(function (k) {
      styleSel.appendChild(el('option', { value: k, text: C.STYLES[k].name, selected: k === currentStyle() ? 'selected' : null }));
    });

    var baseInput = input({
      type: 'text', value: D.settings.baseUrl || C.DEFAULTS.baseUrl, size: 34,
      onchange: function () { D.settings.baseUrl = this.value.trim(); C.save(); draw(); }
    });

    var bar = el('div', { class: 'lq-bar' }, [
      field('Venue', propSel),
      field('Label style', styleSel),
      field('Link base', baseInput),
      el('button', { class: 'lq-btn', text: '+ Venue', onclick: propertyModal }),
      el('button', { class: 'lq-btn', text: 'Edit venue', onclick: function () { propertyModal(C.property(U.propertyId)); } }),
      field('Camera mark', logoToggle()),
      field('Label size', labelSizeControl()),
      field('Code size', sizeControl()),
      field('Link case', caseToggle()),
      field('Link finish', finishToggle()),
      el('button', { class: 'lq-btn', text: 'Settings', onclick: settingsModal })
    ]);
    return bar;
  }

  /* g173 — CODE SIZE, AND AN HONEST READOUT OF WHAT IT BUYS.
     Kirk's concern is that a scan works first time. MEASURED on his own label, the size of the
     code is by far the biggest lever: 0.8in gives a 0.415mm module, barely over the 0.40mm most
     phones need, while 1.2in gives 0.677mm. Shortening and uppercasing the link — the thing two
     chats spent a day on — moves the same number from 0.415 to 0.452.
     The readout comes from scanReport(), which uses the SAME encoder and box maths as the
     drawing, so what it promises and what prints cannot drift apart. */
  /* g189 — Kirk: "the labels should print 4.5 x 2.5 in size as the smaller print does not look as
     clean." Both are kept — he also said "I like having all of the options" — with the larger one
     as the default, since that is the one he asked for. */
  function labelSizeControl() {
    var sel = el('select', {
      onchange: function () { D.settings.labelSize = this.value; C.save(); draw(); }
    });
    /* g191 — Kirk: "leave the original size as an option for the hotel label." It already was, but
       the list gave two measurements and no clue which belonged where — so the choice is now named
       by its JOB. The larger one is what he asked for on gallery pieces going to the print lab;
       the original stays for hotel walls, where a smaller plate is less obtrusive beside the work.
       Naming the use, not just the inches, is what stops him having to remember. */
    [['large', '4.5 \u00d7 2.5 in \u2014 gallery pieces'],
     ['small', '3.5 \u00d7 1.95 in \u2014 hotel walls']].forEach(function (o) {
      sel.appendChild(el('option', { value: o[0], text: o[1],
        selected: (D.settings.labelSize || 'large') === o[0] ? 'selected' : null }));
    });
    return sel;
  }

  function sizeControl() {
    var wrap = el('span', { class: 'lq-size' });
    var sel = el('select', {
      onchange: function () {
        D.settings.qrSizeIn = Number(this.value);
        C.save(); draw();
      }
    });
    /* 1.4in is NOT offered: tested, and at that size the code's top edge reaches the title, which
       fitText cannot shrink far enough to clear. 1.2in is the largest that always lays out. */
    [[0.8, '0.8 in \u2014 small'], [1.0, '1.0 in \u2014 good'],
     [1.2, '1.2 in \u2014 best (default)']].forEach(function (o) {
      var cur = Number(D.settings.qrSizeIn) || (D.settings.logo ? 1.2 : 1.0);
      sel.appendChild(el('option', { value: o[0], text: o[1],
        selected: Math.abs(cur - o[0]) < 0.01 ? 'selected' : null }));
    });
    wrap.appendChild(sel);
    var r = C.scanReport();
    var note = el('span', { class: 'lq-scan-note' });
    if (r.error) { note.textContent = ' ' + r.error; note.style.color = '#c33'; }
    else {
      note.textContent = ' module ' + r.moduleMm.toFixed(2) + 'mm \u00b7 reads from about ' +
        Math.round(r.readFromMm / 25.4 * 10) / 10 + ' in';
      note.style.color = r.comfortable ? '#2c7' : (r.ok ? '#c90' : '#c33');
      if (!r.ok) note.textContent += ' \u2014 too small, most phones need 0.40mm';
      else if (!r.comfortable) note.textContent += ' \u2014 workable, but tight on a wall';
      /* g174 — the mark's real cost, stated once, where the decision is made. Shrinking the mark
         does NOT help: its SIZE covers only 9% of the code, well inside the error-correction
         budget. What costs is that having a mark at all forces the densest correction level. */
      if (r.withoutMarkMm && r.markCostsMm > 0.01) {
        note.textContent += ' \u00b7 the camera mark costs ' + r.markCostsMm.toFixed(2) +
          'mm \u2014 ' + r.sizeToMatchIn.toFixed(1) + ' in would match a plain code';
      }
    }
    wrap.appendChild(note);
    return wrap;
  }

  /* g172 — UPPERCASE LINKS, OFF UNTIL HIS SERVER IS PROVEN.
     A QR code carries A-Z and digits in ALPHANUMERIC mode, about 40% denser than byte mode, and a
     single lowercase character forces byte mode for the whole payload. With the camera mark
     covering the centre that density decides whether a label scans first time in a dim corridor.
     It is NOT on by default because the link crosses a layer StudioFlow cannot test: whether the
     web server serves /ART as well as /art. The template's own two faults are fixed in v25 and
     verified; the path is server configuration. A label is screwed to a wall — being right
     afterwards is worth nothing. */
  /* g196 — CARRY THE FINISH IN THE LINK, or not. It is his call because it is the one change here
     that costs scanning margin: on the 1.2in label, `?h=&id=` gives 0.622mm modules and adding the
     finish gives 0.535mm. Both are comfortable, neither is free. The readout under Code size shows
     the real figure for whichever he picks, because it encodes the actual url. */
  function finishToggle() {
    var sel = el('select', {
      onchange: function () { D.settings.linkFinish = this.value === 'on'; C.save(); draw(); }
    });
    sel.appendChild(el('option', { value: 'off', text: 'Piece only',
      selected: D.settings.linkFinish ? null : 'selected' }));
    sel.appendChild(el('option', { value: 'on', text: 'Piece, medium, size and frame',
      selected: D.settings.linkFinish ? 'selected' : null }));
    return sel;
  }

  function caseToggle() {
    var sel = el('select', {
      onchange: function () {
        var on = this.value === 'upper';
        if (on) {
          /* g172 — TELL HIM THE TRUTH ABOUT WHAT THIS BUYS, which is nothing at present.
             A QR code's ALPHANUMERIC mode carries 0-9 A-Z space $ % * + - . / : and NOTHING ELSE.
             It has no ? no = and no &. So a link with a query string is encoded in BYTE mode
             whatever its case, and uppercasing it saves not one bit. The density argument is real
             but it belongs to a PATH-shaped link (/A/OAKBAY/FMP-0076), which needs a rewrite rule
             on the server — see SERVER-NOTES.txt.
             Checked with the app's own urlIsDense(), so this notice cannot drift from the rule. */
          var sample = C.urlFor(D.labels[0] || { propertyId: U.propertyId, artworkId: 'FMP-0000' });
          var gain = C.urlIsDense(C.upperUrl(sample));
          var msg = gain
            ? 'Uppercase lets this link use the QR code\u2019s dense alphanumeric mode \u2014 noticeably ' +
              'easier to scan at label size.\n\n'
            : 'Worth knowing first: this will NOT make the code any denser.\n\nA QR code\u2019s dense ' +
              'mode cannot carry ? = or &, so a link with a query string is encoded the slower way ' +
              'whatever its case. The real gain needs a link shaped like /A/OAKBAY/FMP-0076, which ' +
              'means a rewrite rule on your web server.\n\n';
          msg += 'Either way, uppercase only works if your server serves /ART as well as /art.\n\n' +
            'Test it first: open your site with an uppercase link and check the piece loads with ' +
            'the "credited to" bar showing.\n\nTwo test scans cost nothing. Two hundred wrong ' +
            'labels cannot be recalled.\n\nTurn it on?';
          if (!window.confirm(msg)) { this.value = 'mixed'; return; }
        }
        D.settings.upperCaseUrl = on;
        C.save(); draw();
      }
    });
    sel.appendChild(el('option', { value: 'mixed', text: 'As typed (safe)',
      selected: D.settings.upperCaseUrl ? null : 'selected' }));
    sel.appendChild(el('option', { value: 'upper', text: 'UPPERCASE (scans better)',
      selected: D.settings.upperCaseUrl ? 'selected' : null }));
    return sel;
  }

  function logoToggle() {
    var sel = el('select', {
      onchange: function () { D.settings.logo = this.value === 'on'; C.save(); draw(); }
    });
    sel.appendChild(el('option', { value: 'on', text: 'FM camera in the middle', selected: D.settings.logo ? 'selected' : null }));
    sel.appendChild(el('option', { value: 'off', text: 'Plain code', selected: D.settings.logo ? null : 'selected' }));
    return sel;
  }

  function listCard() {
    var rows = C.labelsFor(U.propertyId);
    var card = el('div', { class: 'lq-card' }, [el('h3', { text: 'Pieces installed here (' + rows.length + ')' })]);

    if (!rows.length) {
      card.appendChild(el('div', { class: 'lq-empty', text: 'No pieces yet. Add one, or import a list.' }));
    } else {
      var tb = el('tbody');
      rows.forEach(function (l) {
        var tr = el('tr', {
          class: l.id === U.selectedId ? 'sel' : '',
          onclick: function () { U.selectedId = l.id; draw(); }
        }, [
          el('td', {}, [
            el('div', { text: l.title || 'Untitled', style: 'font-weight:600' }),
            el('div', { text: l.location || '', style: 'color:#6e767f;font-size:12px' })
          ]),
          el('td', { text: [l.medium, l.size].filter(Boolean).join(' · ') }),
          el('td', { text: l.artworkId || '—', style: 'font-family:ui-monospace,Consolas,monospace;font-size:12px' }),
          el('td', { style: 'text-align:right;white-space:nowrap' }, [
            /* g194 — HOW MANY OF EACH, set on the row it belongs to rather than in a separate dialog he
         would have to remember to open. Kirk: "we should be able to also select how many of these
         individual artwork labels need to be printed at one time" — he hangs one piece in three
         hotels, or wants a spare because the first goes on crooked. */
      /* g195 — THE SPINNER RAN AWAY. Kirk: "the up arrow stuck and ran all the way to 88 and
         pressing the down arrow twice did the same and it ran all the way to 12."
         A <label> forwards a click on ANY of its contents to the control inside it. Clicking the
         number input's own spinner arrow therefore fired twice — once for the arrow, once for the
         label's forwarded click — and holding it compounded. A <span> carries the styling just as
         well and forwards nothing. The two explicit buttons are the real fix: a step he presses
         once moves by one, whatever the browser's own spinner decides to do. */
      /* g202 — WHY HE COULD NOT TYPE A NUMBER. Kirk: "i still cannot select the number and input a
         different value with the number keys. (useful if i have 40 to print)".
         The ROW carries `onclick -> selectedId = l.id; draw()`. A click on the field bubbles up to
         it, the table is rebuilt, and the input he just focused no longer exists — so the caret
         goes, and every keystroke after lands nowhere. The − and + worked only because they finish
         their job before the redraw takes the element away.
         The quantity control now stops the click travelling. It is the only thing in the row that
         is an INPUT rather than a target, so it is the only place this applies. */
      el('span', { class: 'lq-copies', title: 'How many of this label to print',
        onclick: function (e) { e.stopPropagation(); } }, [
        el('span', { text: '\u00d7' }),
        (function () {
          /* g197 — Kirk: "allow me to select the number of and change with number buttons and the
             arrows." The g195 fix removed the browser's own spinner to stop it double-firing; the
             double-fire came from the <label> wrapper, which is gone, so the spinner can come
             back. Both work now: the arrows on the field, and the explicit − and + either side. */
          /* g199 — Kirk: "remove the up and down arrows and leave the plus and minus." He is right
             that it was redundant: a `type=number` field draws its OWN spinner, so beside the − and
             + buttons it read as two sets of controls for one number. Back to a text field — no
             spinner — with the two buttons doing the stepping and typing still allowed. */
          var inp = input({ type: 'text', value: Math.max(1, Number(l.copies) || 1),
            onchange: function () {
              l.copies = Math.max(1, Math.min(99, Number(this.value) || 1));
              this.value = l.copies; C.save();
            } });
          /* Typing 40 means passing through "4", which must not be clamped to itself and then
             fought over on the next keystroke — so `input` records what is there and only the
             final value is tidied on blur. */
          inp.addEventListener('mousedown', function (e) { e.stopPropagation(); });
          inp.addEventListener('click', function (e) { e.stopPropagation(); this.select(); });
          inp.addEventListener('keydown', function (e) { e.stopPropagation(); });
          inp.className = 'lq-copies-n';
          inp.setAttribute('inputmode', 'numeric');
          /* `input` fires on every arrow press; `change` only on blur. Both are wired so a value
             typed and a value stepped are saved the same way. */
          inp.addEventListener('input', function () {
            /* Records digits as typed WITHOUT rewriting the field — clamping mid-entry is what
               makes a number box impossible to type into. The clamp happens on change (blur). */
            var raw = String(this.value).replace(/[^0-9]/g, '');
            if (raw !== this.value) this.value = raw;
            if (raw) { l.copies = Math.max(1, Math.min(99, Number(raw))); C.save(); }
          });
          /* Typed rather than spun: a plain text box has no spinner to double-fire, and the
             value is clamped on the way in either way. */
          var step = function (d) {
            return el('button', { class: 'lq-step', text: d > 0 ? '\u002b' : '\u2212',
              onclick: function (e) {
                e.preventDefault();
                l.copies = Math.max(1, Math.min(99, (Number(l.copies) || 1) + d));
                inp.value = l.copies;
                C.save();
              } });
          };
          var box = el('span', { class: 'lq-copies-box' }, [step(-1), inp, step(1)]);
          return box;
        })()
      ]),
      el('button', {
              class: 'lq-btn', text: 'Edit', style: 'padding:4px 9px;font-size:12px',
              onclick: function (e) { e.stopPropagation(); labelModal(l); }
            })
          ])
        ]);
        tb.appendChild(tr);
      });
      var t = el('table', { class: 'lq-t' }, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Piece' }), el('th', { text: 'Format' }),
          el('th', { text: 'File ID' }), el('th', {})
        ])]),
        tb
      ]);
      card.appendChild(t);
    }

    card.appendChild(el('div', { class: 'lq-body' }, [
      el('div', { class: 'lq-acts' }, [
        el('button', { class: 'lq-btn primary', text: '+ Add piece', onclick: function () { labelModal(null); } }),
        el('button', { class: 'lq-btn', text: 'Import list', onclick: importModal }),
        el('button', {
          class: 'lq-btn', text: 'Print all labels',
          onclick: function () { printSheet(C.labelsFor(U.propertyId)); },
          disabled: rows.length ? null : 'disabled'
        }),
        el('button', { class: 'lq-btn', text: 'Back up data', onclick: exportJSON })
      ])
    ]));
    return card;
  }

  /* A QR code is only as readable as its smallest square. Below about 0.4 mm per
     module a phone struggles at arm's length, and the fix is a shorter link, not
     a bigger label. */
  function moduleSizeWarning(lbl) {
    var url = C.urlFor(lbl);
    var withLogo = !!D.settings.logo;
    var enc;
    try { enc = root.SFQR.encode(url, withLogo ? 'H' : 'M'); } catch (e) { return 'This link is too long to fit in a QR code: ' + e.message; }
    var boxPx = withLogo ? 240 : 210;
    var mm = (boxPx / 300) * 25.4 / (enc.size + 8);
    if (mm >= 0.40) return null;
    return 'Each square in this code prints at ' + mm.toFixed(2) + ' mm, below the 0.40 mm that phones read reliably at arm\'s length. '
      + 'The link is ' + url.length + ' characters — shortening it is the fix. A path like /a/oakbay/0076 instead of the long query would drop it several sizes.'
      + (withLogo ? ' Turning the camera mark off also helps, since a plain code can use a lighter correction level.' : '');
  }

  function previewCard() {
    var sel = U.selectedId ? C.label(U.selectedId) : C.labelsFor(U.propertyId)[0];
    var card = el('div', { class: 'lq-card' }, [el('h3', { text: 'Preview' })]);
    var body = el('div', { class: 'lq-body' });

    if (!sel) {
      body.appendChild(el('div', { class: 'lq-empty', text: 'Select a piece to preview its label.' }));
      card.appendChild(body);
      return card;
    }

    var cv = document.createElement('canvas');
    try { C.drawLabel(cv, sel, currentStyle()); }
    catch (e) { body.appendChild(el('div', { class: 'lq-warn', text: 'Could not draw this label: ' + e.message })); }

    body.appendChild(el('div', { class: 'lq-prev' }, [cv]));
    body.appendChild(el('div', { class: 'lq-url', text: C.urlFor(sel) }));
    body.appendChild(el('p', {
      class: 'lq-note',
      text: 'Actual size ' + C.labelSize().w + ' × ' + C.labelSize().h + ' in at 300 dpi. Mount aligned to the right edge of the piece, four inches below.'
    }));

    var warn = moduleSizeWarning(sel);
    if (warn) body.appendChild(el('div', { class: 'lq-warn', text: warn, style: 'margin-top:10px' }));
    body.appendChild(el('div', { class: 'lq-acts' }, [
      el('button', { class: 'lq-btn', text: 'Download PNG', onclick: function () { downloadPNG(sel); } }),
      el('button', { class: 'lq-btn', text: 'Print this label', onclick: function () { printSheet([sel]); } }),
      el('button', { class: 'lq-btn danger', text: 'Remove', onclick: function () { removeLabel(sel); } })
    ]));
    card.appendChild(body);
    return card;
  }

  // -------------------------------------------------------------- modals ---

  function propertyModal(existing) {
    var name = input({ type: 'text', value: existing ? existing.name : '', placeholder: 'Oak Bay Beach Hotel' });
    var code = input({ type: 'text', value: existing ? existing.code : '', placeholder: 'oak-bay-beach' });
    name.oninput = function () { if (!code.dataset.touched) code.value = C.slug(name.value); };
    code.oninput = function () { code.dataset.touched = '1'; };

    var nodes = [
      field('Venue name', name),
      field('Tracking code (appears in the link)', code),
      el('p', { class: 'lq-note', text: 'The tracking code is what ties a sale back to this venue for the commission. Keep it short, lowercase and permanent — changing it later breaks labels already on the wall.' })
    ];
    if (existing) {
      nodes.push(el('button', {
        class: 'lq-btn danger', text: 'Delete this venue and its labels',
        onclick: function () {
          if (!confirm('Delete "' + existing.name + '" and its ' + C.labelsFor(existing.id).length + ' label(s)?')) return;
          D.labels = D.labels.filter(function (l) { return l.propertyId !== existing.id; });
          D.properties = D.properties.filter(function (p) { return p.id !== existing.id; });
          U.propertyId = D.properties.length ? D.properties[0].id : null;
          U.selectedId = null;
          C.save();
          document.querySelectorAll('.lq-mod').forEach(function (m) { m.remove(); });
          draw();
        }
      }));
    }

    modal(existing ? 'Edit venue' : 'New venue', nodes, function () {
      var n = name.value.trim();
      if (!n) { name.focus(); return false; }
      var c = C.slug(code.value || n);
      if (existing) { existing.name = n; existing.code = c; }
      else {
        var p = { id: C.uid('venue'), name: n, code: c };
        D.properties.push(p);
        U.propertyId = p.id;
      }
      C.save(); draw();
    });
  }

  function labelModal(existing) {
    var cat = C.catalogue();
    var pick = null;

    var title = input({ type: 'text', value: existing ? existing.title : '', placeholder: 'Botanical Sky' });
    var loc = input({ type: 'text', value: existing ? existing.location : '', placeholder: 'Botanical Beach, Port Renfrew' });
    var med = input({ type: 'text', value: existing ? existing.medium : '', placeholder: 'Gallery-wrapped canvas' });
    var size = input({ type: 'text', value: existing ? existing.size : '', placeholder: '24 × 36 in' });
    var aid = input({ type: 'text', value: existing ? existing.artworkId : '', placeholder: 'FMP-0076' });
    /* g197 — the finish that is actually on the wall. One dropdown rather than an add-on list and
       a colour list, because a label carries one frame or none, and two controls to express one
       fact is two chances to leave it half-set. */
    var fin = el('select', {});
    fin.appendChild(el('option', { value: '', text: 'No frame or mat' }));
    (C.addOnOptions() || []).forEach(function (a) {
      var cur = ((existing && existing.addOns) || [])[0] || {};
      if (!(a.colours || []).length) {
        fin.appendChild(el('option', { value: a.id, text: a.name,
          selected: cur.id === a.id ? 'selected' : null }));
        return;
      }
      a.colours.forEach(function (c) {
        var v = a.id + ':' + c;
        fin.appendChild(el('option', { value: v, text: c + ' ' + a.name.toLowerCase(),
          selected: (cur.id === a.id && String(cur.colour).toLowerCase() === String(c).toLowerCase())
            ? 'selected' : null }));
      });
    });
    var edn = input({ type: 'text', value: existing ? existing.edition : '', placeholder: 'Limited edition 3 of 25' });

    var nodes = [];

    if (cat.length) {
      pick = el('select', {
        onchange: function () {
          var a = cat[this.value];
          if (!a) return;
          title.value = a.title || a.name || '';
          aid.value = a.artworkId || a.id || '';
          if (a.location) loc.value = a.location;
        }
      });
      pick.appendChild(el('option', { value: '', text: '— choose a piece from your catalogue —' }));
      cat.forEach(function (a, i) {
        pick.appendChild(el('option', { value: i, text: (a.title || a.name || 'Untitled') + (a.artworkId ? '  (' + a.artworkId + ')' : '') }));
      });
      nodes.push(field('From your catalogue', pick));
    }

    nodes.push(field('Title', title));
    nodes.push(field('Location shown on the label', loc));
    nodes.push(field('Medium', med));
    nodes.push(field('Size', size));
    nodes.push(field('Frame or mat on this piece', fin));
    nodes.push(field('File ID (goes in the link)', aid));
    nodes.push(field('Edition line (optional)', edn));

    modal(existing ? 'Edit label' : 'Add piece', nodes, function () {
      if (!title.value.trim()) { title.focus(); return false; }
      var rec = existing || { id: C.uid('lbl'), propertyId: U.propertyId };
      rec.title = title.value.trim();
      rec.location = loc.value.trim();
      rec.medium = med.value.trim();
      /* g196 — REMEMBER THE TEMPLATE ID at the moment he chooses, not by matching words later.
         The label prints the medium's NAME; the website switches on its ID. Resolving here means
         a medium renamed afterwards does not silently break the link on labels already made. */
      (function () {
        var want = rec.medium.toLowerCase();
        var hit = (C.mediumSizeOptions() || []).filter(function (o) {
          return String(o.medium || '').trim().toLowerCase() === want && o.mediumId;
        })[0];
        rec.mediumId = hit ? String(hit.mediumId) : '';
      })();
      rec.size = size.value.trim();
      rec.artworkId = aid.value.trim();
      /* g197 — WHAT IS ACTUALLY ON THE WALL. Kirk prices the floating frame as an ADD-ON, so the
         finish is medium + add-on + colour, and the label has to carry all three or a guest
         scanning a white-floated canvas lands on a bare one. Empty means none, which is the
         common case and stays one keystroke away. */
      rec.addOns = [];
      if (fin && fin.value) {
        var chosen = fin.value.split(':');
        rec.addOns.push({ id: chosen[0], colour: chosen[1] || '' });
      }
      rec.edition = edn.value.trim();
      if (!existing) { D.labels.push(rec); U.selectedId = rec.id; }
      C.save(); draw();
    });
  }

  function settingsModal() {
    var artist = input({ type: 'text', value: D.settings.artist || '' });
    var studio = input({ type: 'text', value: D.settings.studio || '' });
    var cta = input({ type: 'text', value: D.settings.cta || '' });
    var lscale = el('select', {});
    [['0.18', 'Small'], ['0.22', 'Medium'], ['0.26', 'Standard'], ['0.30', 'Large (tested limit)']].forEach(function (o) {
      lscale.appendChild(el('option', {
        value: o[0], text: o[1],
        selected: Math.abs((+D.settings.logoScale || 0.26) - parseFloat(o[0])) < 0.005 ? 'selected' : null
      }));
    });
    modal('Label settings', [
      field('Artist name', artist),
      field('Studio name', studio),
      field('Call to action under the QR code', cta),
      field('Camera mark size', lscale),
      el('p', { class: 'lq-note', text: 'Anything larger than the tested limit was found to stop some codes scanning, so the size is capped there.' }),
      el('p', { class: 'lq-note', text: 'These appear on every label. Changing them here changes all of them at once.' })
    ], function () {
      D.settings.artist = artist.value.trim();
      D.settings.studio = studio.value.trim();
      D.settings.cta = cta.value.trim();
      D.settings.logoScale = parseFloat(lscale.value) || 0.26;
      C.save(); draw();
    });
  }

  function importModal() {
    var ta = el('textarea', {
      placeholder: 'Title, Location, Medium, Size, File ID\nBotanical Sky, "Botanical Beach, Port Renfrew", Gallery-wrapped canvas, 24 × 36 in, FMP-0076'
    });
    var restore = el('input', { type: 'file', accept: '.json', style: 'font-size:13px' });
    restore.onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var j = JSON.parse(rd.result);
          if (j.properties && j.labels) {
            D.properties = j.properties; D.labels = j.labels;
            if (j.settings) D.settings = Object.assign({}, C.DEFAULTS, j.settings);
            U.propertyId = D.properties.length ? D.properties[0].id : null;
            U.selectedId = null;
            C.save();
            document.querySelectorAll('.lq-mod').forEach(function (m) { m.remove(); });
            draw();
          } else alert('That file does not look like a label backup.');
        } catch (e) { alert('Could not read that file: ' + e.message); }
      };
      rd.readAsText(f);
    };

    modal('Import a list of pieces', [
      el('p', { class: 'lq-note', text: 'One piece per line, comma separated: Title, Location, Medium, Size, File ID. Wrap any value containing a comma in double quotes. A header row is skipped automatically.' }),
      ta,
      el('div', { style: 'border-top:1px solid #e0e5ea;padding-top:14px' }, [
        el('label', { text: 'Or restore a full backup', style: 'font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6e767f;font-weight:600;display:block;margin-bottom:6px' }),
        restore
      ])
    ], function () {
      var text = ta.value.trim();
      if (!text) return;
      var added = parseCSV(text);
      if (!added) { alert('Nothing readable in that list.'); return false; }
      C.save(); draw();
    }, 'Import');
  }

  function splitCSVLine(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var n = 0;
    lines.forEach(function (line, i) {
      var f = splitCSVLine(line);
      if (i === 0 && /^title$/i.test(f[0] || '')) return;      // header
      if (!f[0]) return;
      D.labels.push({
        id: C.uid('lbl'), propertyId: U.propertyId,
        title: f[0] || '', location: f[1] || '', medium: f[2] || '',
        size: f[3] || '', artworkId: f[4] || '', edition: f[5] || ''
      });
      n++;
    });
    return n;
  }

  // ------------------------------------------------------------- outputs ---

  function safeName(s) {
    return String(s || 'label').replace(/[^A-Za-z0-9-_ ]+/g, '').replace(/\s+/g, '-').slice(0, 60);
  }

  function downloadPNG(lbl) {
    var cv = document.createElement('canvas');
    C.drawLabel(cv, lbl, currentStyle());
    var p = C.property(lbl.propertyId);
    var a = document.createElement('a');
    a.download = safeName((p ? p.code + '-' : '') + (lbl.artworkId || lbl.title)) + '.png';
    a.href = cv.toDataURL('image/png');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify({
      settings: D.settings, properties: D.properties, labels: D.labels,
      exportedAt: new Date().toISOString()
    }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.download = 'artwork-labels-backup.json';
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* Print sheet: 2 across, 4 down on Letter. Renders each label to a PNG at
     300 dpi and places it at exact physical size, so what prints is exactly
     what the preview showed. */
  function printSheet(labels) {
    if (!labels || !labels.length) return;
    document.querySelectorAll('.lq-sheet').forEach(function (n) { n.remove(); });

    var sheet = el('div', { class: 'lq-sheet' });
    /* g189 — HOW MANY FIT, worked out rather than assumed. Letter portrait with 0.4in margins
       leaves 7.7 x 10.2in. Two 4.5in labels side by side need 9.25in with the gap, so the larger
       size fits ONE across and four down; the smaller still fits two across and four down. A
       hard-coded 8 would have printed the big labels one per row anyway, but with four ghost
       slots per page and a blank second column — and page counts that made no sense. */
    var sz = C.labelSize();
    var usableW = 8.5 - 0.8, usableH = 11 - 0.8, gap = 0.25;
    var across = Math.max(1, Math.floor((usableW + gap) / (sz.w + gap)));
    var down = Math.max(1, Math.floor((usableH + gap) / (sz.h + gap)));
    var perPage = across * down, page = null;

    /* g194 — THE QUANTITY IS HONOURED HERE, once, so every path that prints a sheet gets it:
       one label, a venue, or everything. Repeating the entry rather than filtering means a run of
       mixed quantities fills every slot on the page instead of leaving gaps between titles. */
    var expanded = [];
    labels.forEach(function (l) {
      var n = Math.max(1, Math.min(99, Number(l.copies) || 1));
      for (var c = 0; c < n; c++) expanded.push(l);
    });
    labels = expanded;

    labels.forEach(function (l, i) {
      if (i % perPage === 0) { page = el('div', { class: 'pg' }); sheet.appendChild(page); }
      var cv = document.createElement('canvas');
      C.drawLabel(cv, l, currentStyle());
      var img = el('img', { src: cv.toDataURL('image/png') });
      img.style.width = sz.w + 'in'; img.style.height = sz.h + 'in';
      var box = el('div', { class: 'lb' }, [img]);
      box.style.width = sz.w + 'in'; box.style.height = sz.h + 'in';
      page.appendChild(box);
    });

    /* ==========================================================================================
       g188 — THE BLANK PAGE. Kirk: "When i send the label to print it just spits out a blank page
       and nothing prints."
       ==========================================================================================
       Nothing was wrong with the labels. styles.css carries ONE global print rule:

           @media print{ body > *:not(#modalRoot){ display:none !important } }

       — every top-level element except #modalRoot is hidden when printing. This sheet was
       appended to <body>, so it was hidden along with the rest of the app and the printer was
       handed an empty page. The Year-End Report, the Pack List and the price cards all print
       correctly because they render INTO #modalRoot; this module came from a standalone page
       where no such rule existed, and kept its own habit.

       Fixed by putting the sheet where the rule expects it. `#modalRoot` is emptied first — a
       modal left open behind the sheet would print too, which is how a stray "Edit venue" box
       ends up on a page of labels. */
    var host = document.getElementById('modalRoot');
    if (host) { host.innerHTML = ''; host.appendChild(sheet); }
    else document.body.appendChild(sheet);
    var cleanup = function () {
      setTimeout(function () {
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        /* Leave #modalRoot as it was found: empty. A leftover sheet would sit invisibly over the
           page and swallow every click. */
        var h = document.getElementById('modalRoot');
        if (h && !h.children.length) h.innerHTML = '';
      }, 300);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(function () { window.print(); }, 120);
  }

  function removeLabel(lbl) {
    if (!confirm('Remove the label for "' + lbl.title + '"?')) return;
    D.labels = D.labels.filter(function (l) { return l.id !== lbl.id; });
    if (U.selectedId === lbl.id) U.selectedId = null;
    C.save(); draw();
  }

  root.SFLabelQR = { render: render, printSheet: printSheet, exportJSON: exportJSON };
})(typeof window !== 'undefined' ? window : globalThis);
