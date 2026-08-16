/* StudioFlow 3.8.3 · Production Service
   =========================================================================
   PURPOSE: interface scaffolding for StudioFlow 3.9.0's Recipe & Production
   Engine. Per the 3.8.3 spec: "Create an empty Production Service. Do not
   build recipes yet." This file deliberately implements nothing -- every
   method below is a documented placeholder that throws a clear "not yet
   implemented" error if called, rather than silently doing nothing or
   returning fake data.

   This exists so 3.9.0 has a stable shape to build against from day one,
   and so any module written against it now (there shouldn't be any yet)
   fails loudly and immediately rather than behaving unpredictably.

   The Production Workspace module (production-workspace.js) is a SEPARATE,
   already-working, unrelated thing -- it handles fulfilling individual
   orders (existing inventory vs. produce-new) and is not touched by this
   file. This service is specifically for the future recipe-driven batch
   production system described in the 3.9.0 plan: recipes, material
   consumption, labour/time estimation, and production batches.
   ========================================================================= */
window.ProductionService = {

  _notImplemented(method){
    throw new Error(`ProductionService.${method}() is not implemented yet -- this service is interface scaffolding for StudioFlow 3.9.0's Recipe Engine. See modules/production-workspace.js for the existing, working order-fulfillment system this does not replace.`);
  },

  // ---- Production Orders ----
  createProductionOrder(){ this._notImplemented('createProductionOrder') },
  getProductionOrder(){ this._notImplemented('getProductionOrder') },

  // ---- Production Queue ----
  queue(){ this._notImplemented('queue') },
  advanceQueueItem(){ this._notImplemented('advanceQueueItem') },

  // ---- Production Recipes (the core of 3.9.0) ----
  getRecipe(){ this._notImplemented('getRecipe') },
  saveRecipe(){ this._notImplemented('saveRecipe') },
  listRecipes(){ this._notImplemented('listRecipes') },

  // ---- Material Consumption ----
  consumeMaterialsForRecipe(){ this._notImplemented('consumeMaterialsForRecipe') },
  previewConsumption(){ this._notImplemented('previewConsumption') },

  // ---- Labour & Time Estimates ----
  estimateLabour(){ this._notImplemented('estimateLabour') },
  estimateTime(){ this._notImplemented('estimateTime') },

  // ---- Production Batches ----
  createBatch(){ this._notImplemented('createBatch') },
  completeBatch(){ this._notImplemented('completeBatch') },

  // Used by Developer > System Information to report real status rather than
  // just "loaded" -- this service is loaded but has no working methods yet.
  status(){ return { loaded:true, implemented:false, note:'Interface scaffolding only -- see 3.9.0 Recipe Engine plan.' } },
};
