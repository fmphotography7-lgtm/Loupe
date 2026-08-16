/* StudioFlow g140 — PRICE CARDS: TWO COMPLETELY SEPARATE SETS.
   ============================================================
   WHAT CHANGED AND WHY (Kirk, 2026-08-09): "the price cards are not looking right and there is only
   one copy. I need two completely separate sets."

   He was right, and the fault was structural rather than cosmetic. g128-g135 stored ONE list of
   cards and a `design` switch, so choosing Canada Day did not give him a Canada Day SET — it
   repainted the only set he had. Two sets could not both exist, could not hold different prices,
   and could not be printed one after the other.

   Now `state.priceCards.sets` holds two independent records, each with its own cards, its own
   prices, its own copy counts and its own font:
       canada    — the flag: red / white / red, the wording crossing the joins.
       everyday  — white centre, an elliptical gradient out through medium blue to black.
   Nothing is shared between them. Editing one cannot touch the other. Each prints on its own, and
   there is a Print Both button that lays the Canada Day sheets first and the Everyday sheets after.

   THE FONT IS NOW BUNDLED, not borrowed. g133 made the font a setting off the faces that ship with
   Windows, which meant the card looked like whatever that machine happened to have installed and
   silently fell back to Arial Black when it did not. Five heavy display faces now ship INSIDE the
   app under assets/fonts (SIL Open Font Licence, licences alongside them), so the card looks the
   same on every machine and on the printer. The Windows faces are still in the list, and the
   type-any-name box still works.

   THE FLAG TRICK is unchanged because it works: three overlapping layers, each clipped to one
   panel, each holding an identical copy of the same words at identical coordinates and differing
   only in colour. Where a letter straddles a join, one layer paints its left half and the next
   paints its right half, so the flip lands exactly on the boundary at any font size, for any
   wording, with no manual kerning.

   Printing reuses the route the Year-End Report and Pack List already use: render into #modalRoot,
   let the existing @media print rule hide everything else, call window.print(). */
window.SFPriceCards = {

  /* Kirk's own list, as dictated. Each set starts from this and then goes its own way. */
  DEFAULTS: [
    { title: 'Art Cards',            each: 7,  bundleQty: 3, bundlePrice: 20, note: '', copies: 2 },
    { title: '8 x 10 Prints',        each: 30, bundleQty: 0, bundlePrice: 0,  note: '', copies: 2 },
    { title: 'Stone Coasters',       each: 9,  bundleQty: 4, bundlePrice: 35, note: '', copies: 1 },
    { title: '5 x 7 Clip Frames',    each: 10, bundleQty: 0, bundlePrice: 0,  note: 'Discontinued sale', copies: 1 },
    { title: '8 x 10 Clip Frames',   each: 20, bundleQty: 0, bundlePrice: 0,  note: 'Discontinued sale', copies: 1 },
    { title: '11 x 14 Prints',       each: 45, bundleQty: 0, bundlePrice: 0,  note: '', copies: 1 },
    { title: '13 x 19 Prints',       each: 65, bundleQty: 0, bundlePrice: 0,  note: '', copies: 1 },
    { title: '13 x 19 Print with Mat', each: 95, bundleQty: 0, bundlePrice: 0, note: '', copies: 1 }
  ],

  /* The two sets. `design` is the look; `id` is where the cards live. They are separate records,
     not two views of one. */
  SETS: [
    { id: 'canada',   design: 'canada',  label: 'Canada Day', blurb: 'Red, white and red, with the wording running straight across the joins.' },
    { id: 'everyday', design: 'classic', label: 'Everyday',   blurb: 'White centre, graduating out through medium blue to black.' }
  ],
  setById(id){ return this.SETS.find(s => s.id === id) || this.SETS[0]; },

  /* BUNDLED FIRST. Anything marked `bundled` ships inside the app and cannot be missing; the rest
     depend on the machine and are kept because he may already have the face his PSD used. */
  FONTS: [
    /* g146 — KIRK'S OWN LICENSED FACE. Black Crush (Figuree Studio, all rights reserved) is NOT
       open licence, so it is filed under assets/fonts/personal/ and is the one thing in this app
       that must never reach anyone else. He said so himself: "i only want the price list for me
       and not for distribution if we do market this product."
       Marked `personal` so the list can say so, and its stack falls through to the BUNDLED Archivo
       Black — so if the folder is removed for a distribution build the cards keep working and
       simply look like they did in g143 rather than breaking. */
    { id: 'blackcrush', label: 'Black Crush \u2014 yours, not distributed', personal: true, stack: '"SF Black Crush","SF Archivo Black","Arial Black",sans-serif' },
    { id: 'archivo', label: 'Archivo Black (included)', bundled: true, stack: '"SF Archivo Black","Arial Black",sans-serif' },
    { id: 'anton',   label: 'Anton - tall block (included)', bundled: true, stack: '"SF Anton","Arial Narrow Bold","Arial Black",sans-serif' },
    { id: 'bowlby',  label: 'Bowlby One - poster (included)', bundled: true, stack: '"SF Bowlby One","Cooper Black","Arial Black",sans-serif' },
    { id: 'ultra',   label: 'Ultra - heavy slab (included)', bundled: true, stack: '"SF Ultra","Cooper Black",serif' },
    { id: 'alfa',    label: 'Alfa Slab One (included)', bundled: true, stack: '"SF Alfa Slab One","Cooper Black",serif' },
    { id: 'poster',  label: 'Showcard Gothic - your PSD face', stack: '"Showcard Gothic","SF Bowlby One","Cooper Black",sans-serif' },
    { id: 'impact',  label: 'Impact (this PC)', stack: 'Impact,"Haettenschweiler","Arial Narrow Bold",sans-serif' },
    { id: 'black',   label: 'Arial Black (this PC)', stack: '"Arial Black","Arial Bold",Gadget,sans-serif' },
    { id: 'cooper',  label: 'Cooper Black (this PC)', stack: '"Cooper Black","Bookman Old Style",serif' },
    { id: 'bauhaus', label: 'Bauhaus 93 (this PC)', stack: '"Bauhaus 93","Arial Black",sans-serif' },
    { id: 'berlin',  label: 'Berlin Sans FB Demi (this PC)', stack: '"Berlin Sans FB Demi","Arial Black",sans-serif' }
  ],
  /* g141: measured off Kirk_Canada_day_price_sheet.psd — the face is SHOWCARD GOTHIC. It ships
     with Microsoft Office rather than Windows itself, so it is not something I can bundle; the
     stack therefore falls through to the included Bowlby One, which is the nearest poster face in
     assets/fonts, instead of the Arial Black that made every earlier build look wrong. */
  DEFAULT_FONT: 'poster',
  /* g143: Kirk on the flag cards — "the font looks too thin… I would like a very thick and blocky
     font". Showcard Gothic is a poster face but its strokes are comparatively light. Archivo Black
     is the heaviest blocky grotesque of the five that SHIP with the app, so the Canada Day set
     moves to it. The Everyday set is left exactly as it is: he said it looks good. */
  SET_FONT: { canada: 'blackcrush' },
  FONT_REV: 4,

  /* ---- storage -------------------------------------------------------------------------- */

  blankSet(){
    return {
      cards: this.DEFAULTS.map((c, i) => Object.assign({ id: 'pc' + i }, c)),
      font: this.DEFAULT_FONT,
      fontCustom: ''
    };
  },

  /* MIGRATION. A g128-g135 database has one flat `cards` array and a `design` string. That list is
     copied into BOTH sets (deep, so they cannot alias each other and an edit to one cannot show up
     in the other), and the old keys are left where they are rather than deleted — if this build is
     ever rolled back, his prices are still there. */
  store(){
    const s = window.SF.state;
    if (!s.priceCards || typeof s.priceCards !== 'object') s.priceCards = {};
    const p = s.priceCards;

    if (!p.sets || typeof p.sets !== 'object') {
      const legacy = Array.isArray(p.cards) && p.cards.length ? p.cards : null;
      const seed = () => {
        const set = this.blankSet();
        if (legacy) set.cards = JSON.parse(JSON.stringify(legacy));
        return set;
      };
      p.sets = { canada: seed(), everyday: seed() };
      p.migratedFrom = legacy ? 'single-list' : 'defaults';
    }

    this.SETS.forEach(def => {
      let set = p.sets[def.id];
      if (!set || typeof set !== 'object') set = p.sets[def.id] = this.blankSet();
      if (!Array.isArray(set.cards) || !set.cards.length) set.cards = this.blankSet().cards;
      if (!set.font) set.font = this.DEFAULT_FONT;
      if (set.fontCustom == null) set.fontCustom = '';
      set.cards.forEach((c, i) => {
        if (!c.id) c.id = def.id + i;
        if (c.copies == null) c.copies = 1;
      });
    });

    /* g140 seeded both sets with Archivo Black before the PSD was re-read. This moves them to the
       real face ONCE — and never touches a set where he has typed his own font name. */
    if (p.fontRev !== this.FONT_REV) {
      this.SETS.forEach(def => {
        const set = p.sets[def.id];
        const want = this.SET_FONT[def.id];
        if (!set || String(set.fontCustom || '').trim()) return;
        if (p.fontRev == null) set.font = want || this.DEFAULT_FONT;      // never opened before
        else if (want) set.font = want;                                    // only the set that changed
      });
      p.fontRev = this.FONT_REV;
    }

    if (!p.sets[p.active]) p.active = 'canada';
    return p;
  },
  set(id){ return this.store().sets[this.setById(id).id]; },

  /* ==========================================================================================
     g149 — THE FONT CHOICE HAS BEEN SILENTLY THROWN AWAY SINCE g140.
     ==========================================================================================
     Kirk: "black crush is not actually being used on the art cards it is a different font, im not
     sure any of them are 100% correct." He was right about all of it.

     Every stack in FONTS quotes its family names with DOUBLE quotes, and cardHtml wrote them into
     a DOUBLE-QUOTED HTML attribute:

         style="font-family:"SF Black Crush","SF Archivo Black","Arial Black",sans-serif"

     The attribute ends at the first inner quote. The browser reads `style="font-family:"` — an
     empty declaration — and treats the rest as junk attribute names. So the card carried NO font
     of its own and fell through to `.pc-canada{font-family:'Segoe UI'…}`, a light UI face. That is
     why the flag cards looked thin at g143, why Showcard Gothic never appeared at g141, and why
     none of the five bundled faces ever changed anything: the dropdown has been decorative.

     WORSE, AND THE REASON THE SIZES ARE OFF TOO: the fitter measures with canvas using the SAME
     stack, where the quotes are legal. So layoutFor() has been sizing the type for Black Crush
     while the card rendered Segoe UI — every point size computed against a face that was not on
     screen. Correcting the attribute corrects the fit as well.

     THE FIX: family names go into the attribute in SINGLE quotes. CSS accepts either, and single
     quotes cannot terminate a double-quoted attribute. Escaping to &quot; would also work but
     reads as gibberish in devtools, which is where this would next be diagnosed.

     FAMILY, FIFTH TIME: g110 cast shadow, g112 lip shadow, g119 cull zoom, g140 filmstrip — the
     value was right and could not REACH the element. This one never even reached the parser.
     ADD TO THE DIAGNOSTIC ORDER: (0) does the markup carrying the value SURVIVE being parsed —
     look at the emitted tag, not the template that produced it.
     ========================================================================================== */
  fontStackAttr(setId){ return this.fontStack(setId).replace(/"/g, "'"); },

  fontStack(setId){
    const set = this.set(setId);
    if (String(set.fontCustom || '').trim()) return `"${set.fontCustom.trim()}", "SF Archivo Black", "Arial Black", sans-serif`;
    const f = this.FONTS.find(x => x.id === set.font) || this.FONTS[0];
    return f.stack;
  },

  money(v){
    const n = Number(v) || 0;
    return '$' + (n % 1 ? n.toFixed(2) : String(n));
  },

  /* ==========================================================================================
     g147 — THE CARD ON THE TABLE NOW READS THE PRICE THE REGISTER CHARGES.
     ==========================================================================================
     Until now these prices were typed here and NOWHERE ELSE. The market register charges from
     `inventoryProductTemplates` (price / dealQuantity / dealPrice, edited on Inventory → Market
     Pricing & Deals). Two sets of numbers for one decision, with nothing keeping them together:
     put up last year's card, change a price in Inventory, and the card on the table says $30 while
     the register rings $25. He finds out from a customer.

     A card can now be LINKED to the product it advertises. Linked, its price is READ LIVE at
     render time — never copied — so it cannot go stale, and the row shows the figure as text
     rather than an editable box, because an editable box holding a value from somewhere else is a
     lie waiting to be typed into.

     Linking is per card and OPTIONAL: a show special that is not in the register still types its
     own price. And a link to a product that has since been deleted says so loudly rather than
     falling back to a number nobody chose.
     ========================================================================================== */
  templates(){
    return (window.SF.state.inventoryProductTemplates || []).filter(t => t && t.active !== false);
  },
  templateFor(c){
    if (!c || !c.linkId) return null;
    return this.templates().find(t => String(t.id) === String(c.linkId)) || null;
  },
  /* The prices this card should actually SHOW. `source` is what the page reports, so a wrong link
     is visible instead of silently changing what the table says. */
  effective(c){
    if (!c) return { each: 0, bundleQty: 0, bundlePrice: 0, source: 'own' };
    if (!c.linkId) return { each: Number(c.each) || 0, bundleQty: Number(c.bundleQty) || 0,
      bundlePrice: Number(c.bundlePrice) || 0, source: 'own' };
    const t = this.templateFor(c);
    if (!t) return { each: Number(c.each) || 0, bundleQty: Number(c.bundleQty) || 0,
      bundlePrice: Number(c.bundlePrice) || 0, source: 'broken' };
    return {
      each: Number(t.price) || 0,
      bundleQty: Number(t.dealQuantity) || 0,
      bundlePrice: Number(t.dealPrice) || 0,
      source: 'linked', name: t.name || ''
    };
  },

  /* ---- one card ------------------------------------------------------------------------- */

  /* The wording, as lines. One place, so both designs say exactly the same thing and only the
     colours differ. */
  linesFor(c){
    const p = this.effective(c);                       // g147: linked cards read the live price
    const lines = [];
    if (String(c.note || '').trim()) lines.push({ text: c.note.trim(), kind: 'note' });
    lines.push({ text: this.money(p.each) + (p.bundleQty > 1 ? ' each' : ''), kind: 'price' });
    if (p.bundleQty > 1 && p.bundlePrice > 0) {
      lines.push({ text: 'or', kind: 'small' });
      lines.push({ text: `${p.bundleQty} for ${this.money(p.bundlePrice)}`, kind: 'price' });
    }
    return lines;
  },

  /* ---- g141: THE TYPE IS FITTED TO THE CARD, NOT STEPPED THROUGH THREE SIZES ------------- */
  /* MEASURED OFF HIS PSD (Kirk_Canada_day_price_sheet.psd, 300dpi, read with numpy):
       card                 900 x 600px = a true 3 x 2in, which the app already matches
       red bands            208 / 484 / 208px = 23.1% / 53.8% / 23.1%   (the app had 28/44/28)
       ink block            starts ~7% down, ends ~9% up — vertically centred, not top-aligned
       longest line         89% of the card width, crossing BOTH joins
       titles set on TWO LINES ("13x19" / "Print") so they can be large — that is how his cards
       fill the space, and it is why a one-line title looked so small in my last build.
     So the old sizeClass() three-step ladder is gone. Each card is now FITTED: pick the biggest
     type at which the longest line still fits the width and the whole block still fits the height,
     trying the title on one line and on every two-line split, and keeping whichever allows the
     larger size. The title carries the largest weight, per Kirk: "Art Cards, 13x19 Prints should
     be bigger than the other font".
     Fitting happens ONCE per card and the result is stamped inline, so all three flag panes get
     identical metrics — which is the only thing keeping the colour flip on the panel edge. */
  CARD_IN: { w: 3, h: 2 },
  /* g143 weights. `title2` is the SECOND line of an item name and is a separate kind so it can be
     set smaller — Kirk on the mat card: "13x19 (top line large like all others) Print with Mat on
     the next line slightly smaller". It only drops when that second line is a PHRASE; a single
     word ("Prints", "Coasters") stays the same size as the first, which is how his own sheet
     reads. Prices went 0.80 → 0.92 because he wants them larger. */
  FIT: {
    side: 0.05, vert: 0.07,
    weights: { title: 1, title2: 1, title2phrase: 0.66, price: 0.92, small: 0.30, note: 0.42 },
    lh:      { title: 1.04, title2: 1.04, price: 1.06, small: 1.10, note: 1.30 }
  },

  _mctx(){
    if (this.__ctx !== undefined) return this.__ctx;
    try { this.__ctx = document.createElement('canvas').getContext('2d') || null; }
    catch (e) { this.__ctx = null; }
    return this.__ctx;
  },
  /* Width of a string in EMs. Canvas when there is one — that is the only way to be right about a
     face like Showcard Gothic. A character table when there is not (the harness runs in node), so
     the fitter can be tested without a browser rather than being untestable. */
  emWidth(text, stack){
    const ctx = this._mctx();
    if (ctx) { ctx.font = `100px ${stack}`; return ctx.measureText(String(text)).width / 100; }
    let w = 0;
    for (const ch of String(text)) {
      if (/[mwMW]/.test(ch)) w += 0.92;
      else if (/[ .,'!ijlI]/.test(ch)) w += 0.30;
      else if (/[fjrt]/.test(ch)) w += 0.42;
      else if (/[A-Z0-9$]/.test(ch)) w += 0.70;
      else w += 0.60;
    }
    return w;
  },

  /* The title on one line, and on every split at a space. Two lines is the most a 2in card can
     carry alongside a price. */
  titleOptions(title){
    const t = String(title || '').trim();
    const words = t.split(/\s+/).filter(Boolean);
    const opts = [];
    /* g143: a leading SIZE is its own line, offered first — "13 x 19" over "Print with Mat",
       "5 x 7" over "Clip Frames". That is how his PSD is set, and it is what lets the size be the
       big thing on the card. Generic splits still follow as alternatives. */
    const dim = t.match(/^(\d+\s*[x\u00d7]\s*\d+)\s+(.+)$/i);
    if (dim) opts.push([dim[1].replace(/\s*[x\u00d7]\s*/, ' x '), dim[2]]);
    opts.push([t]);
    /* A SIZE IS NEVER BROKEN ACROSS TWO LINES. Without this the fitter happily produced "13 x"
       over "19 Prints", because that split happened to allow a larger first line — technically the
       best fit and obviously wrong to a human. Any split with an "x" on either side of it is
       refused. */
    const isX = w => /^[x\u00d7]$/i.test(w);
    for (let i = 1; i < words.length; i++) {
      if (isX(words[i]) || isX(words[i - 1])) continue;
      opts.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
    }
    return opts.filter((o, i) => opts.findIndex(x => x.join('|') === o.join('|')) === i);
  },

  /* The second line of a name is only shrunk when it is a phrase rather than one word. */
  titleKindFor(lines, i){
    if (i === 0) return 'title';
    return /\s/.test(String(lines[i]).trim()) ? 'title2phrase' : 'title2';
  },

  /* Returns the lines with a point size on each. Everything is in POINTS off the card's inch
     dimensions, so it is resolution-independent and prints at exactly the size it previews. */
  layoutFor(c, setId){
    const stack = this.fontStack(setId), F = this.FIT;
    const W = 72 * this.CARD_IN.w * (1 - 2 * F.side);
    const H = 72 * this.CARD_IN.h * (1 - 2 * F.vert);
    const rest = this.linesFor(c);
    let best = null;
    this.titleOptions(c.title).forEach(tl => {
      const lines = tl.map((t, i) => ({ text: t, kind: this.titleKindFor(tl, i) })).concat(rest);
      let wLimit = Infinity, hSum = 0;
      lines.forEach(l => {
        const wt = F.weights[l.kind] || 1;
        const em = this.emWidth(l.text, stack) * wt;
        if (em > 0) wLimit = Math.min(wLimit, W / em);
        hSum += wt * (F.lh[l.kind] || 1.05);
      });
      const s = Math.min(wLimit, H / hSum);
      /* Ties are common: once the HEIGHT is what limits the size, every two-line split gives the
         same point size, and taking the first would break "8 x 10 Prints" as "8" / "x 10 Prints".
         So a tie is settled by whichever split is more BALANCED — the narrower its widest line,
         the closer the two lines are to each other, which is also what makes them span. */
      const widest = Math.max.apply(null, lines.map(l =>
        this.emWidth(l.text, stack) * (F.weights[l.kind] || 1)));
      if (!best || s > best.s * 1.005 || (s > best.s * 0.995 && widest < best.widest))
        best = { s, lines, widest };
    });
    /* g160 — A SIZE DIAL, because "as big as it fits" is not always "right".
       Kirk: "Some of the larger fonts look good but the font size is one or two too big."
       The fitter picks the LARGEST size at which the wording still fits, which is correct as a
       ceiling and wrong as a judgement — a card can fit at 42pt and look better at 38.
       Only DOWNWARD adjustment is offered, and that is not a limitation to apologise for: the
       fitter is already at the maximum, so a "+" would either overflow the card or do nothing at
       all. A control that silently does nothing is worse than one that is honest about its range.
       Two dials, both in steps of 4%: one for the SET (everything is a shade big) and one per CARD
       (this one item is). They multiply, so a card can be nudged relative to a set already
       nudged. */
    const scale = this.sizeScale(c, setId);
    return best.lines.map(l => Object.assign({}, l, {
      pt: Math.round(best.s * (F.weights[l.kind] || 1) * scale * 100) / 100
    }));
  },

  /* Steps are stored, not percentages — an integer survives a round trip through a number input
     without accumulating float noise, and "two steps smaller" is how he described it. */
  STEP: 0.04,
  MIN_SCALE: 0.6,
  sizeScale(card, setId){
    const set = this.set(setId);
    const setSteps = Math.max(0, Math.min(10, Number(set && set.sizeSteps) || 0));
    const cardSteps = Math.max(0, Math.min(10, Number(card && card.sizeSteps) || 0));
    return Math.max(this.MIN_SCALE, 1 - (setSteps + cardSteps) * this.STEP);
  },

  /* g141, Everyday only: "the $ symbol and the numbers should be red, all of the other words
     should be a colour that will stand out". So a price line is split into money and words rather
     than being one colour. Applied to the price lines, not the title — "13 x 19" would otherwise
     turn half the item name red. */
  numberSpans(text){
    return String(text).split(/(\$?\d[\d.,]*)/).filter(x => x !== '').map(x =>
      /^\$?\d/.test(x) ? `<span class="pc-num">${window.SF.esc(x)}</span>`
                        : `<span class="pc-word">${window.SF.esc(x)}</span>`).join('');
  },

  cardInner(c, setId){
    const sf = window.SF, F = this.FIT;
    const classic = this.setById(setId).design !== 'canada';
    return this.layoutFor(c, setId).map(l => {
      const body = (classic && (l.kind === 'price' || l.kind === 'small'))
        ? this.numberSpans(l.text) : sf.esc(l.text);
      const cls = /^title/.test(l.kind) ? 'title' : l.kind;
      return `<div class="pc-${cls}" style="font-size:${l.pt}pt;line-height:${F.lh[l.kind] || 1.05}">${body}</div>`;
    }).join('');
  },

  cardHtml(c, setId){
    const design = this.setById(setId).design;
    const inner = this.cardInner(c, setId);
    const font = `style="font-family:${this.fontStackAttr(setId)}"`;
    if (design !== 'canada') {
      return `<div class="pc-card pc-classic" ${font}><div class="pc-body">${inner}</div></div>`;
    }
    /* Three windows onto the same words. .pc-pane clips; .pc-shift puts the full-width copy back
       into the card's own coordinates so all three align to the pixel. */
    return `<div class="pc-card pc-canada" ${font}>
      <div class="pc-pane pc-left"><div class="pc-shift pc-on-red">${inner}</div></div>
      <div class="pc-pane pc-mid"><div class="pc-shift pc-on-white">${inner}</div></div>
      <div class="pc-pane pc-right"><div class="pc-shift pc-on-red">${inner}</div></div>
    </div>`;
  },

  /* ---- sheets --------------------------------------------------------------------------- */

  expanded(setId){
    const out = [];
    this.set(setId).cards.forEach(c => {
      const n = Math.max(0, Math.min(20, Number(c.copies) || 0));
      for (let i = 0; i < n; i++) out.push(c);
    });
    return out;
  },

  /* Eight to a sheet, 2 across and 4 down. Cards are a TRUE 3 x 2in so they drop into his mini
     display frames: 0.3in margins leave 7.9 x 10.4in, two 3in columns need 6.22in and four 2in
     rows need 8.66in. A fifth row would need 10.88in and overflow, so eight a sheet stands. */
  PER_SHEET: 8,
  sheetsOf(cards){
    const out = [];
    for (let i = 0; i < cards.length; i += this.PER_SHEET) out.push(cards.slice(i, i + this.PER_SHEET));
    return out.length ? out : [[]];
  },
  sheetHtml(cards, setId, n, total){
    const label = this.setById(setId).label;
    return `<div class="pc-page pc-design-${this.setById(setId).design}">
      <div class="pc-page-label no-print">${window.SF.esc(label)} \u00b7 sheet ${n} of ${total}</div>
      <div class="pc-grid">${cards.map(c => this.cardHtml(c, setId)).join('')}</div>
    </div>`;
  },
  sheetsHtml(setId){
    const cards = this.expanded(setId), sheets = this.sheetsOf(cards);
    return sheets.map((sheet, i) => this.sheetHtml(sheet, setId, i + 1, sheets.length)).join('');
  },

  /* ---- page ----------------------------------------------------------------------------- */

  render(){
    const sf = window.SF, p = this.store();
    const active = this.setById(p.active).id;
    const set = this.set(active), def = this.setById(active);
    const cards = this.expanded(active);
    const sheets = Math.ceil(cards.length / this.PER_SHEET) || 1;

    const counts = this.SETS.map(s => `${s.label}: ${this.expanded(s.id).length} card(s)`).join(' \u00b7 ');

    sf.$('workspace').innerHTML = `<div class="page-stack">
      <section class="card">
        <div class="toolbar"><div><h2 style="margin:0">Price Cards</h2>
          <p class="muted">Two separate sets, each with its own prices. Changing one never touches
          the other. ${sf.esc(counts)}.</p></div>
          <div class="row-actions">
            <button class="button secondary" id="pcPrintBoth">Print both sets</button>
          </div></div>
        <div class="pc-tabs">${this.SETS.map(s => `<button class="button ${s.id === active ? 'primary' : 'secondary'}"
          data-pc-set="${s.id}">${sf.esc(s.label)} set</button>`).join('')}</div>
        <p class="muted" style="margin-top:8px">${sf.esc(def.blurb)}</p>
      </section>

      <section class="card">
        <div class="toolbar"><div><h3 style="margin:0">${sf.esc(def.label)} \u2014 what each card says</h3>
          <p class="muted">${cards.length} card(s) \u00b7 ${sheets} sheet(s) of 8\u00bd \u00d7 11,
          ${this.PER_SHEET} to a sheet at a true 3 \u00d7 2 inches. Cut lines print faintly.</p></div>
          <div class="row-actions">
            <select id="pcFont" title="This font applies to the ${sf.esc(def.label)} set only">${this.FONTS.map(f =>
              `<option value="${f.id}" ${f.id === set.font ? 'selected' : ''}>${sf.esc(f.label)}</option>`).join('')}</select>
            <input id="pcFontCustom" value="${sf.esc(set.fontCustom || '')}" placeholder="or type a font name"
              style="width:170px" title="Any font installed on this computer \u2014 overrides the list">
            <span class="pc-sample" id="pcSample" style="font-family:${this.fontStackAttr(active)}">Art Cards $7</span>
            <label style="display:flex;align-items:center;gap:6px" title="The type is already as large as it will fit \u2014 this steps it back down">Type size
              <select id="pcSizeSteps">${[0,1,2,3,4,5,6].map(n =>
                `<option value="${n}" ${Number(set.sizeSteps || 0) === n ? 'selected' : ''}>${n ? `${n} smaller (${Math.round((1 - n * this.STEP) * 100)}%)` : 'Biggest that fits'}</option>`).join('')}</select></label>
            <button class="button secondary" id="pcAdd">Add a card</button>
            <button class="button primary" id="pcPrint">Print this set</button>
          </div></div>
        <div class="commerce-table"><table>
          <thead><tr><th>Item</th><th>Price from</th><th>Note</th><th>Each</th><th>Bundle of</th><th>Bundle price</th><th>Copies</th><th>Type</th><th></th></tr></thead>
          <tbody>${set.cards.map((c, i) => {
            const p = this.effective(c), live = p.source === 'linked';
            /* A linked row shows its prices as TEXT. An editable box holding a number that comes
               from somewhere else invites him to type into it and wonder why it snaps back. */
            const cell = (field, val, w, step, title) => live
              ? `<td class="pc-live" title="From ${sf.esc(p.name)}">${val ? (field === 'bundleQty' ? val : this.money(val)) : '\u2014'}</td>`
              : `<td><input data-pc="${i}" data-pc-field="${field}" type="number" step="${step}" min="0" value="${val}" style="width:${w}" ${title ? `title="${title}"` : ''}></td>`;
            return `<tr${p.source === 'broken' ? ' class="pc-broken"' : ''}>
            <td><input data-pc="${i}" data-pc-field="title" value="${sf.esc(c.title)}" style="min-width:170px"></td>
            <td><select data-pc-link="${i}" style="max-width:190px">
              <option value="">Typed here</option>
              ${this.templates().map(t => `<option value="${sf.esc(t.id)}" ${String(t.id) === String(c.linkId || '') ? 'selected' : ''}>${sf.esc(t.name)}</option>`).join('')}
              ${p.source === 'broken' ? `<option value="${sf.esc(c.linkId)}" selected>\u26a0 linked product no longer exists</option>` : ''}
            </select></td>
            <td><input data-pc="${i}" data-pc-field="note" value="${sf.esc(c.note || '')}" placeholder="e.g. Discontinued sale" style="min-width:140px"></td>
            ${cell('each', p.each, '82px', '0.01', '')}
            ${cell('bundleQty', p.bundleQty, '70px', '1', '0 means no bundle price')}
            ${cell('bundlePrice', p.bundlePrice, '90px', '0.01', '')}
            <td><input data-pc="${i}" data-pc-field="copies" type="number" step="1" min="0" max="20" value="${Number(c.copies) || 1}" style="width:66px" title="How many of this card to print"></td>
            <td><select data-pc="${i}" data-pc-field="sizeSteps" style="width:74px" title="Step this one card's type down, on top of the set's setting">${[0,1,2,3,4].map(n =>
              `<option value="${n}" ${Number(c.sizeSteps || 0) === n ? 'selected' : ''}>${n ? '\u2212' + n : 'Fit'}</option>`).join('')}</select></td>
            <td><button class="button danger" data-pc-del="${i}">Remove</button></td>
          </tr>`; }).join('')}</tbody>
        </table></div>
        ${(() => {
          const linked = set.cards.filter(c => this.effective(c).source === 'linked').length;
          const broken = set.cards.filter(c => this.effective(c).source === 'broken');
          return `${broken.length ? `<p class="help danger-text"><b>${broken.length} card(s) point at a product that no longer exists</b> —
            ${sf.esc(broken.map(c => c.title).join(', '))}. They are printing the last price typed here.
            Pick the product again, or set them back to “Typed here”.</p>` : ''}
          <p class="help">${linked} of ${set.cards.length} card(s) take their price straight from Inventory → Market Pricing &amp; Deals,
          so the card and the register can never disagree. Change one of those prices there and it is on the card the next time you print.
          Leave a card on “Typed here” for a show special that is not in the register.</p>`;
        })()}
        <div class="row-actions" style="margin-top:10px">
          <button class="button secondary" id="pcSave">Save</button>
          <button class="button secondary" id="pcCopyFrom">Copy prices from the other set</button>
        </div>
        <p class="help" id="pcFontState"></p>
        <p class="help">${(this.FONTS.find(f => f.id === set.font) || {}).personal
          ? 'This set uses <b>Black Crush</b>, your own licensed font. It lives in assets/fonts/personal and is left out of any build made with BUILD_FOR_DISTRIBUTION.bat \u2014 it is yours, not StudioFlow\u2019s.'
          : 'Fonts marked \u201cincluded\u201d ship inside StudioFlow and print the same on any machine.'}</p>
        <p class="help" id="pcPrintNote">After printing you are asked what actually came out, and that
        goes to Print Production \u2014 so the paper and ink these use are counted with the rest of
        your printing.</p>
      </section>

      <section class="card">
        <h3>How the ${sf.esc(def.label)} set will print</h3>
        <div class="pc-sheets pc-design-${def.design}">${this.sheetsHtml(active)}</div>
      </section>
    </div>`;
    this.bind();
    this.whenFontsReady();
    this.reportFont();
  },

  /* The fitter measures with canvas, and canvas measures with whatever font is LOADED. A bundled
     woff2 is not loaded until something asks for it, so the first paint after a cold start would
     be fitted against the fallback face and come out slightly wrong. This waits for the real
     faces, then redraws once. Guarded so it can only ever happen a single time. */
  /* g149 — SAY WHICH FACE IS ACTUALLY ON THE CARD.
     The whole fault above was invisible because nothing ever reported what was being used. The
     sample beside the dropdown is drawn with the same stack the card uses, and this checks whether
     the FIRST family in that stack really loaded — so a missing file, a font he does not have, or
     a typo in the free-text box says so instead of quietly looking like something else. */
  reportFont(){
    const sf = window.SF, host = sf.$('pcFontState');
    if (!host) return;
    const set = this.set(this.store().active);
    const stack = this.fontStack(this.store().active);
    const first = (stack.split(',')[0] || '').replace(/["']/g, '').trim();
    let loaded = null;
    try { if (document.fonts && document.fonts.check) loaded = document.fonts.check(`24pt "${first}"`); }
    catch (e) { loaded = null; }
    const f = this.FONTS.find(x => x.id === set.font);
    if (loaded === false) {
      host.className = 'help danger-text';
      host.innerHTML = `<b>\u201c${sf.esc(first)}\u201d is not available on this computer</b>, so the cards are printing in
        the next face in the list instead. ${f && f.bundled ? 'That one ships with StudioFlow, so this is a fault \u2014 tell me.'
        : f && f.personal ? 'It lives in assets/fonts/personal; a build made for distribution leaves it out.'
        : 'Pick one marked \u201cincluded\u201d and it will look the same on any machine.'}`;
    } else {
      host.className = 'help';
      /* `loaded === null` means the browser would not answer, not that it is fine. Say the same
         thing either way rather than inventing a confidence the check did not give. */
      host.textContent = `The cards are set in ${first}. The sample beside the font list is drawn in it \u2014 if that sample does not look like the face you chose, tell me.`;
    }
  },

  whenFontsReady(){
    if (this._fontsDone) return;
    if (!(document.fonts && document.fonts.load)) { this._fontsDone = true; return; }
    const first = st => (st.split(',')[0] || '').trim();
    Promise.all(this.SETS.map(x => document.fonts.load(`100pt ${first(this.fontStack(x.id))}`).catch(() => {})))
      .then(() => document.fonts.ready)
      .then(() => { this._fontsDone = true; this.__ctx = undefined; this.render(); this.reportFont(); })
      .catch(() => { this._fontsDone = true; });
  },

  bind(){
    const sf = window.SF, p = this.store();
    const active = this.setById(p.active).id;
    const set = this.set(active);

    const read = () => {
      document.querySelectorAll('[data-pc]').forEach(el => {
        const c = set.cards[Number(el.dataset.pc)], f = el.dataset.pcField;
        if (!c || !f) return;
        /* g160: a <select> reports type 'select-one', so the number branch would have missed it
           and stored "2" as a STRING. Number(set.sizeSteps) would still work, but the stored
           database would then hold a string where every other count is a number. */
        c[f] = (el.type === 'number' || f === 'sizeSteps') ? (Number(el.value) || 0) : el.value;
      });
    };
    // Typed fields commit on Save; re-rendering per keystroke would steal focus mid-price.
    const commit = async () => { await sf.persist(); this.render(); };

    document.querySelectorAll('[data-pc-set]').forEach(b => b.onclick = async () => {
      read(); p.active = b.dataset.pcSet; await commit();
    });
    if (sf.$('pcSave')) sf.$('pcSave').onclick = async () => { read(); await commit(); };
    if (sf.$('pcAdd')) sf.$('pcAdd').onclick = async () => {
      read();
      set.cards.push({ id: active + Date.now().toString(36), title: 'New item', each: 0, bundleQty: 0, bundlePrice: 0, note: '', copies: 1 });
      await commit();
    };
    document.querySelectorAll('[data-pc-del]').forEach(b => b.onclick = async () => {
      read(); set.cards.splice(Number(b.dataset.pcDel), 1); await commit();
    });
    document.querySelectorAll('[data-pc-link]').forEach(el => el.onchange = async () => {
      read();
      const c = set.cards[Number(el.dataset.pcLink)];
      if (!c) return;
      /* Linking KEEPS whatever he typed, untouched, underneath. Unlinking then returns him to his
         own numbers rather than to zero — and if the linked product is ever deleted, those are
         what the card falls back to. */
      c.linkId = el.value || '';
      await commit();
    });
    if (sf.$('pcSizeSteps')) sf.$('pcSizeSteps').onchange = async e => {
      read(); set.sizeSteps = Math.max(0, Math.min(10, Number(e.target.value) || 0)); await commit();
    };
    if (sf.$('pcFont')) sf.$('pcFont').onchange = async e => { read(); set.font = e.target.value; await commit(); };
    if (sf.$('pcFontCustom')) sf.$('pcFontCustom').onchange = async e => { read(); set.fontCustom = e.target.value.trim(); await commit(); };

    /* The sets are separate ON PURPOSE, but he will usually want the same prices in both — so
       there is one deliberate, confirmed way to copy them across rather than an automatic link
       that would make "separate" untrue the moment he changed a price. */
    if (sf.$('pcCopyFrom')) sf.$('pcCopyFrom').onclick = async () => {
      const other = this.SETS.find(s => s.id !== active);
      if (!other) return;
      if (!confirm(`Replace every card in the ${this.setById(active).label} set with the ${other.label} set's cards and prices?\n\nThis overwrites what is here now.`)) return;
      read();
      set.cards = JSON.parse(JSON.stringify(this.set(other.id).cards)).map((c, i) => Object.assign(c, { id: active + i }));
      await commit();
    };

    if (sf.$('pcPrint')) sf.$('pcPrint').onclick = () => this.printSheets([active]);
    if (sf.$('pcPrintBoth')) sf.$('pcPrintBoth').onclick = () => this.printSheets(this.SETS.map(s => s.id));
  },

  /* ---- printing ------------------------------------------------------------------------- */

  /* A browser never reports whether the print went through or how many copies were asked for, so
     SFPrintLog asks — prefilled — and records only what he confirms. Accuracy was the point; an
     automatic entry was a guess wearing a number. */
  printSheets(setIds){
    const sf = window.SF;
    const ids = (Array.isArray(setIds) && setIds.length) ? setIds : [this.store().active];
    let sheets = 0, area = 0;
    const body = ids.map(id => {
      const cards = this.expanded(id), n = this.sheetsOf(cards).length;
      sheets += cards.length ? n : 0;
      /* Inked area on ONE sheet: the cards, not the page. Eight 3 x 2in cards ink 48 of the 82
         square inches printable, so costing the whole page would overstate the ink by 70%. */
      area = Math.max(area, Math.min(cards.length, this.PER_SHEET) * 3 * 2);
      return this.sheetsHtml(id);
    }).join('');

    sf.$('modalRoot').innerHTML = `<div class="modal-backdrop"><div class="pc-sheet">
      <div class="no-print" style="text-align:right;margin-bottom:8px">
        <button class="button secondary" id="pcClose">Close</button></div>
      ${body}
    </div></div>`;
    sf.$('pcClose').onclick = () => sf.closeModal();

    const label = ids.map(id => this.setById(id).label).join(' + ');
    /* Canada Day floods two thirds of every card with solid red and the Everyday ground is a full
       bleed as well, so both are costed as heavy coverage rather than ordinary text. */
    setTimeout(async () => {
      const job = await window.SFPrintLog?.printAndLog({
        label: `Price cards \u2014 ${label}`,
        sheets: Math.max(1, sheets),
        areaPerSheet: Number(area.toFixed(2)),
        coverage: 'Heavy',
        media: 'Cardstock', source: 'price-cards'
      });
      const host = sf.$('pcPrintNote');
      if (host) host.textContent = job
        ? `Recorded ${job.quantity} sheet(s) in Print Production.`
        : 'Nothing recorded for that run.';
    }, 140);
  }
};
