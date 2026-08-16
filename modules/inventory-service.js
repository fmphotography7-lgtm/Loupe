/* StudioFlow 3.8.3 · Inventory Service
   =========================================================================
   PURPOSE: one consistent place to read inventory levels, availability, and
   match an order line to a finished-inventory item -- instead of each
   module reading item.quantity directly or reimplementing the on-hand/
   reserved/available math independently.

   Same rule as SquarespaceService and AnalyticsService: this is a FACADE,
   not a rewrite. Every method delegates to real, already-tested code:
    - getInventoryOnHand/Reserved/Available and resolveInventoryMatch
      already exist in production-workspace.js, built and unit-tested
      during the 3.8.1 inventory-matching fix (see tests/production-
      workspace.test.js -- 10 passing tests covering exactly this math).
    - orderNeed() already exists in commerce-hub.js as a properly layered
      3-stage matcher (SKU match -> product-mapping fallback -> Smart
      Catalog Interpreter fallback) -- traced carefully before relying on
      it here; confirmed NOT a duplicate-logic bug, just legitimately
      layered enhancement code.

   No inventory math has been rewritten. This file changes no existing
   behavior; it gives future code (and 3.9.0's Recipe Engine, which will
   need to consume finished inventory the same way orders do today) one
   stable, documented place to ask "how much do we actually have" instead
   of guessing which module owns the answer.
   ========================================================================= */
window.InventoryService = {

  // ---- Finished Inventory reads (delegates to production-workspace.js) ----
  // Uses ?? throughout internally, not ||, since zero is a valid on-hand value --
  // this was the actual bug fixed in 3.8.1; delegating here means that fix
  // benefits every future caller automatically.
  onHand(item){ return window.SFProductionWorkspace?.getInventoryOnHand?.(item) ?? Number(item?.quantity ?? 0) },
  reserved(item){ return window.SFProductionWorkspace?.getInventoryReserved?.(item) ?? Number(item?.reserved ?? 0) },
  available(item){ return window.SFProductionWorkspace?.getInventoryAvailable?.(item) ?? Math.max(0, this.onHand(item)-this.reserved(item)) },

  // ---- Order-line to inventory-item matching ----
  // The layered SKU -> mapping -> Smart Catalog Interpreter matcher used
  // throughout order fulfillment today.
  resolveForOrderLine(line){ return window.SFCommerceHub?.orderNeed?.(line) },
  // The deeper, priority-ranked matcher (mapping -> SKU -> IDs -> structured
  // artwork+product+size -> safe fallback) built for the Production
  // Workspace specifically.
  resolveDetailed(line){ return window.SFProductionWorkspace?.resolveInventoryMatch?.(line) },

  // ---- Raw list access (no filtering/transformation -- callers still own their own logic) ----
  allItems(){ return window.SF?.state?.inventoryItems || [] },

  // ---- Adjustments (delegates to the same authoritative setter used by
  // Production Workspace, which keeps currentOnHand and quantity in sync --
  // the field-compatibility fix from 3.8.1) ----
  setOnHand(item, value){ return window.SFProductionWorkspace?.setInventoryOnHand?.(item, value) },
};
