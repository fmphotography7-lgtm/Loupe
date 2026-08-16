/* StudioFlow 3.8.3 · Squarespace Service
   =========================================================================
   PURPOSE: one consistent place for any module to request a Squarespace-
   related action, instead of reaching directly into WebsiteConnection,
   WebsiteUpdates, or CommerceHub's Squarespace-specific methods.

   IMPORTANT: this is a FACADE, not a rewrite. Every method below simply
   calls the real, already-working implementation that already exists
   elsewhere in the app (commerce-hub.js, website-connection.js,
   website-updates.js). Nothing about how Squarespace sync, order import,
   pricing, or updates actually work has changed -- this file adds no new
   behavior and changes no existing behavior. Its only job is to give
   future code (starting with the 3.9.0 Recipe Engine) one stable place to
   call instead of duplicating or guessing at which module owns what.

   As those underlying modules get genuinely consolidated in a future
   pass, this is the file that absorbs that work -- callers using
   SquarespaceService today won't need to change when that happens.
   ========================================================================= */
window.SquarespaceService = {

  // ---- Connection & Authentication (delegates to website-connection.js) ----
  ensureConnection(){ return window.SFWebsiteConnection?.ensure?.() },
  saveCredentials(){ return window.SFCommerceHub?.saveConnection?.() },
  testConnection(){ return window.SFCommerceHub?.testConnection?.() },
  disconnect(){ return window.SFCommerceHub?._sqTimer && clearInterval(window.SFCommerceHub._sqTimer) },
  connectionStatus(){ return window.SF?.state?.squarespace?.connectionStatus || 'Not Connected' },
  isConnected(){ return this.connectionStatus() === 'Connected' },

  // ---- Synchronization (delegates to commerce-hub.js) ----
  syncProducts(silent=false){ return window.SFCommerceHub?.syncProducts?.(silent) },
  syncOrders(silent=false){ return window.SFCommerceHub?.syncOrders?.(silent) },
  startAutoSync(){ return window.SFCommerceHub?.startAutoSync?.() },
  lastOrderSync(){ return window.SF?.state?.squarespace?.lastOrderSync || null },
  lastProductSync(){ return window.SF?.state?.squarespace?.lastProductSync || null },

  // ---- Product / Variant matching (delegates to commerce-hub.js's liveVariants) ----
  // The single, shared source of truth for "what does Squarespace actually have" --
  // fixed once (the attributes-object parsing bug) and every caller benefits.
  liveVariants(){ return window.SFCommerceHub?.liveVariants?.() || [] },
  orderNeed(line){ return window.SFCommerceHub?.orderNeed?.(line) },
  autoInventoryMatch(variant){ return window.SFCommerceHub?.autoInventoryMatch?.(variant) },
  mappingKey(variant){ return window.SFCommerceHub?.mappingKey?.(variant) },

  // ---- Order Import (delegates to commerce-hub.js) ----
  importOrderCsv(){ return window.SFCommerceHub?.importWebsiteOrders?.() },
  newWebsiteOrders(){ return window.SFCommerceHub?.newWebsiteOrders?.() || [] },
  pendingWebsiteOrders(){ return window.SFCommerceHub?.pendingWebsiteOrders?.() || [] },

  // ---- Website Updates / approval queue (delegates to website-updates.js) ----
  createUpdate(fields){ return window.SFWebsiteUpdates?.create?.(fields) },
  approveUpdate(id){ return window.SFWebsiteUpdates?.approve?.(id) },
  ignoreUpdate(id){ return window.SFWebsiteUpdates?.ignore?.(id) },
  deleteUpdate(id){ return window.SFWebsiteUpdates?.delete?.(id) },
  waitingUpdateCount(){ return window.SFWebsiteUpdates?.waitingCount?.() || 0 },
  updateCounts(){ return window.SFWebsiteUpdates?.counts?.() || {pending:0,approved:0,exported:0,applied:0,failed:0} },

  // ---- Website Comparison (delegates to website-updates.js) ----
  compareToWebsite(){ return window.SFWebsiteUpdates?.compare?.() },

  // ---- CSV Export (delegates to website-updates.js) ----
  exportApprovedCsv(){ return window.SFWebsiteUpdates?.exportCsv?.() },

  // ---- Live API Updates (delegates to website-updates.js -- these are the actual
  // write-to-Squarespace actions, each requiring the user's explicit confirmation
  // at the point they're called; this facade does not add or remove that gate) ----
  applyPriceUpdate(id){ return window.SFWebsiteUpdates?.applyPriceUpdate?.(id) },
  applyRemoveVariant(id){ return window.SFWebsiteUpdates?.applyRemoveVariant?.(id) },
  applyRestoreVariant(id){ return window.SFWebsiteUpdates?.applyRestoreVariant?.(id) },
  applyInventoryUpdate(id){ return window.SFWebsiteUpdates?.applyInventoryUpdate?.(id) },
  bulkApplyPrice(id){ return window.SFWebsiteUpdates?.bulkApplyPrice?.(id) },
};
