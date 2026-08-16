/* StudioFlow 3.8.3 · Analytics Service
   =========================================================================
   PURPOSE: one consistent place to request revenue/reporting figures,
   instead of reaching into commerce-hub.js directly or -- worse --
   recalculating revenue independently somewhere new.

   Same rule as SquarespaceService: this is a FACADE, not a rewrite. Every
   method delegates to the real, already-working calculation that already
   exists in commerce-hub.js. periodFigures() is confirmed as the single,
   canonical revenue/expense/profit calculation in the app (searched for
   duplicates before building this -- found none for periodFigures itself).

   One real duplicate WAS found and fixed while building this: commerce-
   hub.js had two separate mappingStats() definitions, silently
   overriding each other (the same class of bug already found and fixed
   in dashboard.js/galleries.js/inventory-sales.js). Removed the dead one
   before wiring this facade to the real one.

   NOT yet covered by this service, and worth being honest about why: the
   Gallery Interest / Service Interest / traffic-source figures on the Home
   Dashboard, and the Market & Art Show net-revenue accounting in
   build-11.6.1.js, are calculated inline inside large render() template
   strings rather than as separate named functions. Wrapping those would
   mean extracting them into standalone functions first -- a real, riskier
   change to code that currently works -- not just adding a facade on top.
   Left alone for now rather than rushed.
   ========================================================================= */
window.AnalyticsService = {

  // ---- Core revenue/expense/profit calculation (delegates to commerce-hub.js) ----
  // The one confirmed, single source of truth -- searched for duplicates before
  // relying on it as canonical.
  periodFigures(year, month){ return window.SFCommerceHub?.periodFigures?.(year, month) },
  thisMonth(){ const now=new Date(); return this.periodFigures(now.getFullYear(), now.getMonth()) },
  thisYear(){ const now=new Date(); return this.periodFigures(now.getFullYear()) },

  // ---- Reporting (delegates to commerce-hub.js) ----
  showOverview(){ return window.SFCommerceHub?.overview?.() },
  printAnnualSummary(year){ return window.SFCommerceHub?.printAnnualSummary?.(year) },

  // ---- Product/variant mapping coverage stats (delegates to commerce-hub.js) ----
  // Fixed a real duplicate here: commerce-hub.js had two mappingStats()
  // definitions silently overriding each other. Removed the dead one before
  // wiring this facade to the surviving, real implementation.
  mappingStats(){ return window.SFCommerceHub?.mappingStats?.() },
};
