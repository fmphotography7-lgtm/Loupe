/* StudioFlow 3.8.3 · Product Service
   =========================================================================
   PURPOSE: one consistent place to look up product types, sizes, website
   pricing, and the real Squarespace product/variant ID for a given local
   product -- instead of each module re-reading sf.state.productTemplates
   or re-implementing SKU-matching independently.

   Same rule as the other three services built so far: FACADE, not a
   rewrite. Delegates to real, already-tested code -- findSquarespaceVariant
   in unified-pricing.js (which itself was fixed to use the correct
   Squarespace attributes-object parsing, confirmed against a real
   Squarespace CSV export) is the actual SKU/variant matcher used here.

   DELIBERATELY EXCLUDED: Frame and Mat data. The 3.8.3 spec lists these as
   Product Service responsibilities, but that data lives inside Room
   Designer's frame-library.js, which is explicitly protected in this
   build ("Do not modify Room Designer"). Reaching into it -- even read-
   only, even through a facade -- was judged too close to that boundary to
   risk without an explicit decision to do so. Left out rather than
   guessed at.
   ========================================================================= */
window.ProductService = {

  // ---- Product Types / Sizes (delegates to state, read-only) ----
  templates(){ return window.SF?.state?.productTemplates || [] },
  template(id){ return this.templates().find(t => String(t.id) === String(id)) || null },
  sizesFor(templateId){ return this.template(templateId)?.sizes || [] },

  // ---- Website Pricing (delegates to unified-pricing.js's actual stored data) ----
  standardPrice(templateId, size){ return Number(window.SF?.state?.pricing?.standard?.[templateId]?.[size] || 0) },
  supplyCost(templateId, size){ return Number(window.SF?.state?.pricing?.costs?.[templateId]?.[size] || 0) },
  isDiscontinued(templateId, size){ return window.SFUnifiedPricing?.isDiscontinued?.(templateId, size) ?? false },

  // ---- Website SKU / Product ID / Variant ID matching (delegates to unified-pricing.js) ----
  // This is the fixed matcher -- confirmed against a real Squarespace CSV export
  // to correctly read the attributes-object variant structure, not the array
  // structure that was silently failing before.
  findSquarespaceVariant(templateName, size, localSku){
    return window.SFUnifiedPricing?.findSquarespaceVariant?.(templateName, size, localSku) || {};
  },

  // NOTE: Frame and Mat data intentionally not exposed here -- see file header.
};
