/* StudioFlow 3.8.3 · Materials Service
   =========================================================================
   PURPOSE: one consistent place to read raw material stock, cost, and the
   already-existing recipe-based material cost per product -- instead of
   reaching into materials-cutting.js's internals directly.

   Same rule as the other five: FACADE, not a rewrite. Delegates to real,
   already-working code -- including recipeCost(), which already computes
   a product's material cost from its recipe components (accounting for
   sheet-yield math), and was already built before this service existed.
   This file doesn't add that capability; it just gives other code (like
   Website Pricing) a stable, documented way to ask for it.
   ========================================================================= */
window.MaterialsService = {

  // ---- Raw material reads (delegates to materials-cutting.js) ----
  material(id){ return window.SFMaterialsCutting?.material?.(id) },
  onHand(m){ return window.SFMaterialsCutting?.onHand?.(m) ?? Math.max(0, Number(m?.onHand || 0)) },
  allMaterials(){ return window.SF?.state?.materials || [] },
  purchases(materialId){ return window.SFMaterialsCutting?.purchases?.(materialId) || [] },
  offcuts(materialId){ return window.SFMaterialsCutting?.offcuts?.(materialId) || [] },

  // ---- Recipes (delegates to materials-cutting.js's already-working recipe system) ----
  recipeFor(templateId){ return window.SF?.state?.productRecipes?.find(r => String(r.templateId) === String(templateId)) || null },
  // The real material cost for a product, computed from its recipe components. Already existed
  // before this service -- this is the function Website Pricing's Supply Cost now reads from.
  recipeCost(templateId){ return window.SFMaterialsCutting?.recipeCost?.(templateId) ?? 0 },
  hasRecipe(templateId){ return !!this.recipeFor(templateId) },

  /* ==========================================================================================
     g145 — WHY SUPPLY COST WAS BLANK ON THE PRICING PAGE, AND THE JOIN THAT FIXES IT.
     ==========================================================================================
     The column was built and wired. It called recipeCost(t.id) where `t` is a WEBSITE/PRICING
     template (a MEDIUM: "Luster Paper", with a list of sizes). Recipes are keyed to the OTHER
     list — inventoryProductTemplates, where size is baked into the row ("11 x 14 Luster Print").
     A medium id can never equal an inventory template id, so the find() never matched, every row
     fell to 0, and every row read "No recipe set up" — including the products Kirk HAS written
     recipes for. It also ignored `size` completely, which could not have worked anyway: an 11 x 14
     and a 24 x 36 on the same paper do not cost the same.

     So this is the join. It is deliberately CONSERVATIVE — a wrong match puts a wrong cost against
     a price, which is worse than showing none — and it reports what it matched so a wrong one is
     visible rather than silent.

     THREE THINGS MUST AGREE:
       size      digits x digits, with ×/✕ folded to x and 11 vs 11.0 folded, so "20x40",
                 "20 x 40" and "20 × 40" are one size.
       mat       matted and print-only are different products with different material lists.
       medium    the SIGNIFICANT words must match as a SET. "paper", "print", "only" and the
                 mat words are dropped as noise, so "Luster Paper" and "11 x 14 Luster Print"
                 both reduce to {luster} — while "Metallic Luster Paper" reduces to
                 {metallic, luster} and therefore CANNOT match a plain Luster row.
     ========================================================================================== */
  NOISE_WORDS: ['print','prints','printed','paper','only','mat','matted','matting','with','and','the','a','of','x'],

  sizeKey(v){
    const m = String(v || '').match(/(\d+(?:\.\d+)?)\s*[x\u00d7\u2715]\s*(\d+(?:\.\d+)?)/i);
    return m ? `${parseFloat(m[1])}x${parseFloat(m[2])}` : '';
  },
  isMatted(){
    const t = Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
    return /\bmatte?d?\b|\+\s*mat\b/i.test(t) && !/\bmatte\s+finish\b/i.test(t);
  },
  /* The words that actually identify the medium, as a sorted set. */
  mediumWords(text){
    const cleaned = String(text || '')
      .replace(/(\d+(?:\.\d+)?)\s*[x\u00d7\u2715]\s*(\d+(?:\.\d+)?)/gi, ' ')   // the size is matched separately
      .replace(/[^a-z0-9]+/gi, ' ')
      .toLowerCase();
    const out = [];
    cleaned.split(/\s+/).forEach(w => {
      if (!w || this.NOISE_WORDS.indexOf(w) >= 0) return;
      /* "cards" and "coasters" are the same product as "card" and "coaster"; "canvas" is not a
         plural and must survive intact. */
      if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') && w !== 'canvas') w = w.slice(0, -1);
      if (out.indexOf(w) < 0) out.push(w);
    });
    return out.sort();
  },
  sameMedium(a, b){
    const x = this.mediumWords(a), y = this.mediumWords(b);
    return x.length > 0 && x.length === y.length && x.every((w, i) => w === y[i]);
  },

  /* Find the inventory product template that means the same thing as this medium at this size.
     Returns null rather than guessing. When several match, one WITH a recipe wins — that is the
     only difference that matters to the caller. */
  matchInventoryTemplate(mediumName, size){
    const list = window.SF?.state?.inventoryProductTemplates || [];
    const wantSize = this.sizeKey(size);
    const wantMat  = this.isMatted(mediumName);
    const hits = list.filter(it => {
      if (it.active === false) return false;
      const itSize = this.sizeKey(it.size) || this.sizeKey(it.name);
      if (itSize !== wantSize) return false;
      if (this.isMatted(it.name, it.presentation) !== wantMat) return false;
      return this.sameMedium(mediumName, `${it.name || ''} ${it.presentation || ''}`);
    });
    if (!hits.length) return null;
    return hits.find(it => this.hasRecipe(it.id)) || hits[0];
  },

  /* ==========================================================================================
     g147 — WHAT A PRINT RUN WILL ACTUALLY CONSUME.
     ==========================================================================================
     recipeCost() answers "what does one of these cost". The Production Plan needs the other half:
     print six of these and four of those — how much material is that, and DO I HAVE IT? A plan
     that says "print 6" without saying "you have 3 sheets" is only half a decision.

     The yield maths is NOT reimplemented here. A sheet component consumes 1/yield of a sheet, and
     `yield` is whatever materials-cutting already computes (manual override first, then its own
     bestYield with the material's gap, edge trim and rotation rules). Reimplementing that would
     give two answers to the same question, and the cost figure and the stock figure would drift.
     ========================================================================================== */
  yieldFor(material, component){
    const c = component || {}, m = material || {};
    const manual = Number(c.manualYield || 0);
    if (manual) return manual;
    return window.SFMaterialsCutting?.bestYield?.(
      Number(m.width), Number(m.height), Number(c.cutWidth), Number(c.cutHeight),
      Number(m.gap || 0), Number(m.edgeTrim || 0), m.allowRotate !== false) || 0;
  },

  /* How much of each material ONE of this product uses. Packaging counts — a print he cannot bag
     is not ready to sell. Returns [] when there is no recipe, which the caller must distinguish
     from "needs nothing". */
  usagePerItem(templateId){
    const r = this.recipeFor(templateId);
    if (!r) return [];
    const out = [];
    const add = (c, sheet) => {
      const m = this.material(c.materialId);
      if (!m) return;
      let units = Number(c.quantity || 1);
      if (sheet && m.kind === 'sheet' && c.cutWidth && c.cutHeight) {
        const y = this.yieldFor(m, c);
        units = y ? units / y : 0;                 // a fraction of a sheet
      }
      if (!(units > 0)) return;
      out.push({ materialId: m.id, name: m.name || '(unnamed material)', unit: m.unit || (m.kind === 'sheet' ? 'sheet' : 'unit'),
        kind: m.kind || 'unit', perItem: units });
    };
    (r.components || []).forEach(c => add(c, true));
    (r.packagingComponents || []).forEach(c => add(c, false));
    return out;
  },

  /* The whole plan at once: [{templateId, qty}] in, one row per MATERIAL out, with what is on the
     shelf and what is short. Rows are merged across products — mat board used by three different
     sizes is one shortage, not three. */
  requirementsFor(items){
    const need = new Map(), missing = [];
    (items || []).forEach(it => {
      const qty = Number(it.qty || 0);
      if (!(qty > 0)) return;
      const usage = this.usagePerItem(it.templateId);
      if (!usage.length) { missing.push(it.name || it.templateId); return; }
      usage.forEach(u => {
        const row = need.get(u.materialId) || { materialId: u.materialId, name: u.name, unit: u.unit, kind: u.kind, need: 0, usedBy: [] };
        row.need += u.perItem * qty;
        if (it.name && row.usedBy.indexOf(it.name) < 0) row.usedBy.push(it.name);
        need.set(u.materialId, row);
      });
    });
    const rows = [...need.values()].map(r => {
      const m = this.material(r.materialId);
      const have = m ? Number(this.onHand(m)) || 0 : 0;
      /* Sheets are whole things — 2.3 sheets means he needs 3. Consumables that come by the metre
         or the millilitre are left as they are. */
      const needed = r.kind === 'sheet' ? Math.ceil(r.need - 1e-9) : Math.round(r.need * 100) / 100;
      return Object.assign(r, { need: needed, onHand: have, short: Math.max(0, Math.round((needed - have) * 100) / 100) });
    });
    rows.sort((a, b) => (b.short - a.short) || String(a.name).localeCompare(String(b.name)));
    return { rows, noRecipe: [...new Set(missing)] };
  },

  /* What the Pricing page asks for: the material cost of one medium at one size, plus enough
     context to SAY where the number came from. */
  supplyCostFor(mediumName, size){
    const it = this.matchInventoryTemplate(mediumName, size);
    if (!it) return { cost: 0, matched: null, matchedName: '', hasRecipe: false, reason: 'no-product' };
    if (!this.hasRecipe(it.id)) return { cost: 0, matched: it, matchedName: it.name || '', hasRecipe: false, reason: 'no-recipe' };
    return { cost: Number(this.recipeCost(it.id)) || 0, matched: it, matchedName: it.name || '', hasRecipe: true, reason: 'ok' };
  },
};
