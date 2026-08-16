/* StudioFlow g166 · PLATFORM ADAPTER
   =========================================================================================
   Kirk is going to sell StudioFlow to other photographers, so it has to reach more than one
   selling platform. Before any second platform can be added, there has to be somewhere to plug
   it in — and there was not. Measured rather than guessed: 29 files mention Squarespace, main.js
   about a hundred times and website-updates.js about a hundred more. `squarespace-service.js`
   looks like an abstraction but is a 72-line pass-through: every method forwards to a
   Squarespace-specific implementation, so it names the calls without generalising them.

   THE HARDER HALF IS THE DATA, NOT THE CODE. An artwork's link to the store is stored as
   `sqProductId` and as `products[].productId`, read across eight modules. A second platform would
   need its own parallel field everywhere, and a third a third — which is how an app ends up with
   `sqProductId`, `shopifyProductId`, `zenfolioPhotoId` and no way to ask a general question.

   SO THIS FILE DOES TWO THINGS AND DELIBERATELY NOTHING ELSE:
     1. ONE INTERFACE with named CAPABILITIES, and backends registered against it.
     2. A PLATFORM-NEUTRAL PLACE FOR REMOTE IDS — `remoteIds: { squarespace: {...} }` — with
        readers that still understand the old fields and writers that keep the old fields in step.

   WHAT IT DOES NOT DO, on purpose: it does not rewire a single existing call site. The Squarespace
   path is proven, verified twice against Kirk's live store, and is the last thing to break for the
   sake of tidiness. The backend below FORWARDS to exactly the code that runs today. Migrating
   callers onto the adapter is a later pass, done a few at a time, each one verifiable.

   CAPABILITIES ARE THE POINT, not decoration. Platforms genuinely differ:
     - Squarespace can upload a product image on CREATE but has no replace-image path in this app
     - a gallery platform (Zenfolio, SmugMug) has photos and price lists, not variants and stock
   Without declared capabilities the UI has to either hide useful buttons from everyone or offer
   buttons that fail. With them it can say "Shopify can do this, your platform cannot" — which is
   the honest answer and the one that stops a feature silently doing nothing.
   ========================================================================================= */
window.SFPlatforms = {

  /* Every capability a backend may claim. A backend declares only what it can actually do; the
     app asks before offering. Adding a capability here without a backend implementing it is safe —
     `can()` simply returns false. */
  CAPABILITIES: [
    'listProducts',      // read the catalogue back
    'createProduct',     // make a new listing
    'updatePrice',
    'setStock',
    'removeVariant',
    'addVariant',
    'uploadImage',       // attach an image to an existing listing
    'replaceImage',      // swap the image on an existing listing — Squarespace: NO
    'fetchOrders',
    'galleries',         // photo-gallery model rather than a product model
    'priceLists'
  ],

  _backends: {},

  /* ---- registration ---------------------------------------------------------------------- */

  register(backend){
    if (!backend || !backend.id) throw new Error('A platform backend needs an id.');
    const unknown = (backend.capabilities || []).filter(c => !this.CAPABILITIES.includes(c));
    /* A typo in a capability name would otherwise be indistinguishable from "cannot do it" —
       exactly the silent-nothing failure this layer exists to prevent. */
    if (unknown.length) throw new Error(`Unknown capability on ${backend.id}: ${unknown.join(', ')}`);
    this._backends[backend.id] = backend;
    return backend;
  },
  list(){ return Object.keys(this._backends).map(id => this._backends[id]); },
  get(id){ return this._backends[id] || null; },

  /* The platform the app is currently working with. One today; a setting later. Kept as a method
     rather than a constant so no caller hard-codes 'squarespace' a second time. */
  activeId(){
    const s = window.SF && window.SF.state;
    return (s && s.activePlatform) || 'squarespace';
  },
  active(){ return this.get(this.activeId()); },

  can(capability, platformId){
    const b = platformId ? this.get(platformId) : this.active();
    return !!(b && (b.capabilities || []).includes(capability));
  },
  /* Ask before offering. Returns the reason when it cannot, so a page can SAY why rather than
     hiding a button with no explanation. */
  why(capability, platformId){
    const b = platformId ? this.get(platformId) : this.active();
    if (!b) return 'No selling platform is connected.';
    if ((b.capabilities || []).includes(capability)) return '';
    return `${b.name || b.id} cannot ${this.CAPABILITY_WORDS[capability] || capability}.`;
  },
  CAPABILITY_WORDS: {
    replaceImage: 'replace the picture on a listing that already exists',
    setStock: 'set stock levels',
    fetchOrders: 'send orders back to StudioFlow',
    createProduct: 'create new listings',
    addVariant: 'add sizes to an existing listing',
    galleries: 'organise work into galleries'
  },

  /* Call a capability. Refuses loudly rather than returning undefined, because a sync that
     quietly does nothing is the failure mode this whole project keeps running into. */
  async call(capability, args, platformId){
    const b = platformId ? this.get(platformId) : this.active();
    if (!b) throw new Error('No selling platform is connected.');
    if (!this.can(capability, b.id)) throw new Error(this.why(capability, b.id));
    if (typeof b[capability] !== 'function') {
      throw new Error(`${b.name || b.id} claims it can ${capability} but does not implement it.`);
    }
    return b[capability](args || {});
  },

  /* ---- remote ids, the part that actually unblocks a second platform --------------------- */

  /* LEGACY FIELDS, in the order they are trusted. `sqProductId` is what artworks.js writes today;
     `squarespaceProductId` appears on update records. Both are read, neither is removed. */
  LEGACY: {
    squarespace: { productId: ['sqProductId', 'squarespaceProductId'], variantId: ['sqVariantId'] }
  },

  bag(record){
    if (!record) return null;
    if (!record.remoteIds || typeof record.remoteIds !== 'object') record.remoteIds = {};
    return record.remoteIds;
  },
  /* Read an id for a platform. Falls back to the legacy field so EVERY existing artwork keeps
     working with no migration step — a migration that must run before the app is usable is a
     migration that will one day not run. */
  remoteId(record, kind, platformId){
    if (!record) return '';
    const p = platformId || this.activeId();
    const bag = (record.remoteIds || {})[p];
    if (bag && bag[kind]) return String(bag[kind]);
    const legacy = (this.LEGACY[p] || {})[kind] || [];
    for (const f of legacy) if (record[f]) return String(record[f]);
    return '';
  },
  /* Write an id BOTH ways. The new home is authoritative going forward; the legacy field is kept
     in step so the eight modules still reading it are unaffected. Dropping the old field is a
     separate, later decision — and only once nothing reads it. */
  setRemoteId(record, kind, value, platformId){
    if (!record) return record;
    const p = platformId || this.activeId();
    const bag = this.bag(record);
    if (!bag[p] || typeof bag[p] !== 'object') bag[p] = {};
    bag[p][kind] = value ? String(value) : '';
    const legacy = (this.LEGACY[p] || {})[kind] || [];
    /* Only the FIRST legacy name is written — the others are aliases this app reads but has never
       been the one to create, and inventing them would spread the problem rather than contain it. */
    if (legacy.length) record[legacy[0]] = value ? String(value) : '';
    return record;
  },
  /* Is this record on that platform at all? */
  isLinked(record, platformId){ return !!this.remoteId(record, 'productId', platformId); },
  /* Which platforms know about this record. The question that was impossible to ask before. */
  linkedPlatforms(record){
    return this.list().map(b => b.id).filter(id => this.isLinked(record, id));
  }
};

/* =========================================================================================
   THE SQUARESPACE BACKEND — a forwarder, not a reimplementation.
   Every method below calls the code that runs on Kirk's live store today. If any of these ever
   starts doing its own thing, there are two implementations of one job and they will drift; that
   is precisely the fault that made the supply-cost lookup silently return zero for weeks.
   ========================================================================================= */
window.SFPlatforms.register({
  id: 'squarespace',
  name: 'Squarespace',
  /* replaceImage is DELIBERATELY ABSENT. The app can upload an image when it creates a product
     and has no path to change one afterwards — so claiming it would produce a button that fails.
     Absent is the truthful answer, and `why()` explains it to the user. */
  capabilities: ['listProducts','createProduct','updatePrice','setStock','removeVariant',
                 'addVariant','uploadImage','fetchOrders'],

  isConnected(){ return !!window.SquarespaceService?.isConnected?.(); },
  status(){ return window.SquarespaceService?.connectionStatus?.() || 'Not Connected'; },

  listProducts(){ return window.SquarespaceService?.syncProducts?.(true); },
  fetchOrders(){ return window.SquarespaceService?.syncOrders?.(true); },
  createProduct(a){ return window.SF?.api?.squarespaceCreateProduct?.(a); },
  updatePrice(a){ return window.SF?.api?.squarespaceUpdateVariantPrice?.(a); },
  setStock(a){ return window.SF?.api?.squarespaceSetUnlimitedStock?.(a); },
  removeVariant(a){ return window.SF?.api?.squarespaceRemoveVariant?.(a); },
  addVariant(a){ return window.SF?.api?.squarespaceRestoreVariant?.(a); },
  uploadImage(a){ return window.SF?.api?.squarespaceUploadProductImage?.(a); }
});
