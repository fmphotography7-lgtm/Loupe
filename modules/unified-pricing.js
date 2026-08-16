window.SFUnifiedPricing={
 money(n){return new Intl.NumberFormat('en-CA',{style:'currency',currency:window.SF.state.business.currency||'CAD'}).format(Number(n||0))},
 ensure(){if(window.SFPricing?.ensure)window.SFPricing.ensure();const s=window.SF.state;s.pricing=s.pricing||{};s.pricing.standard=s.pricing.standard||{};s.pricing.addOns=Array.isArray(s.pricing.addOns)?s.pricing.addOns:[];s.pricing.costs=s.pricing.costs||{};s.pricing.pendingWebsiteUpdates=Array.isArray(s.pricing.pendingWebsiteUpdates)?s.pricing.pendingWebsiteUpdates:[];
  // Discontinued variants are tracked separately from productTemplates -- Inventory and Production
  // Workspace both read productTemplates directly, so mutating it here would have side effects
  // outside Website Pricing. A variant is "discontinued" if its (templateId,size) pair is in this list.
  s.pricing.discontinued=Array.isArray(s.pricing.discontinued)?s.pricing.discontinued:[];
  if(this.dedupeTemplateSizes())Promise.resolve(window.SF.persist&&window.SF.persist()).catch(()=>{});
 },
 sizeKey(v){return String(v||'').toLowerCase().replace(/[^0-9a-z]+/g,'')},
 // "30 x 60" and "30x60" are the same real size, but they used to be able to coexist in a
 // template's sizes list (Merge Duplicate Mediums concatenated two lists). That produced two
 // identical-looking rows in Website Pricing, and Delete Permanently then stripped BOTH of them
 // because it matched on a normalised size. Collapse them to one spelling and keep the price.
 dedupeTemplateSizes(){
  const s=window.SF.state;let changed=false;
  (s.productTemplates||[]).forEach(t=>{
   if(!Array.isArray(t.sizes)||!t.sizes.length)return;
   const keep=new Map();
   t.sizes.forEach(sz=>{const k=this.sizeKey(sz);if(!k)return;if(!keep.has(k))keep.set(k,sz)});
   if(keep.size===t.sizes.length)return;
   ['standard','costs'].forEach(bucket=>{
    const tbl=s.pricing?.[bucket]?.[t.id];if(!tbl)return;
    t.sizes.forEach(sz=>{
     const winner=keep.get(this.sizeKey(sz));
     if(!winner||winner===sz)return;
     if(!Number(tbl[winner]||0)&&Number(tbl[sz]||0))tbl[winner]=tbl[sz];
     delete tbl[sz];
    });
   });
   t.sizes=window.SFProductTemplates?window.SFProductTemplates.sortSizes([...keep.values()]):[...keep.values()];
   changed=true;
  });
  return changed;
 },
 // Normalise typed sizes to the "30 x 60" house style so new entries can't reintroduce twins.
 normalizeSize(raw){
  const v=String(raw||'').trim();
  const m=v.match(/^(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)$/);
  return m?`${Number(m[1])} x ${Number(m[2])}`:v;
 },
 // Sizes that still have a saved price or cost but are no longer offered by their template --
 // i.e. sizes that got deleted out from under their pricing. These are one click from coming back.
 orphanedSizes(){
  this.ensure();
  const s=window.SF.state,out=[];
  (s.productTemplates||[]).forEach(t=>{
   const have=new Set((t.sizes||[]).map(x=>this.sizeKey(x)));
   const seen=new Set();
   ['standard','costs'].forEach(bucket=>{
    Object.entries(s.pricing?.[bucket]?.[t.id]||{}).forEach(([size,val])=>{
     const k=this.sizeKey(size);
     if(!k||have.has(k)||seen.has(k))return;
     if(this.isDiscontinued(t.id,size))return;
     seen.add(k);
     out.push({templateId:t.id,templateName:t.name,size,price:Number(s.pricing?.standard?.[t.id]?.[size]||0),cost:Number(s.pricing?.costs?.[t.id]?.[size]||0),hasValue:Number(val||0)>0});
    });
   });
  });
  return out;
 },
 variantKey(templateId,size){return `${templateId}::${size}`},
 isDiscontinued(templateId,size){this.ensure();return window.SF.state.pricing.discontinued.some(d=>d.templateId===templateId&&d.size===size)},

 render(){
  this.ensure();
  const sf=window.SF,p=sf.state.pricing,raw=(sf.state.productTemplates||[]).filter(t=>Array.isArray(t.sizes)&&t.sizes.length);
  const seen=new Set(),templates=raw.filter(t=>{
    const n=String(t.name||t.id||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(!n||n==='unspecified')return false; // "Unspecified" (or an unnamed template) never shows in Website Pricing
    const key=n.includes('art card')||n==='cards'||n==='card'?'art-card':String(t.id||n);
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
  /* g145: say where the number came from, or why there isn't one. A blank cost with no reason is
     what let this sit broken — it looked like "no recipe yet" when it was actually a bad lookup. */
  this.costNote=r=>{
    const esc=window.SF.esc;
    if(r.fromRecipe)return `<small class="pw-match-method">From recipe \u00b7 ${esc(r.matchedName)}</small>`;
    if(r.hasRecipe)return `<small class="muted">Recipe: ${this.money(r.recipeCost)} \u00b7 ${esc(r.matchedName)}</small>`;
    if(r.reason==='no-recipe')return `<small class="danger-text">No recipe on ${esc(r.matchedName)}</small>`;
    return '<small class="danger-text">No matching product in Inventory</small>';
  };
  const category=t=>{const n=String(t.name||'').toLowerCase();if(n.includes('card'))return 'Art Cards';if(n.includes('canvas'))return 'Canvas Prints';if(n.includes('metallic'))return 'Metallic Luster Prints';if(n.includes('luster'))return 'Luster Paper Prints';if(n.includes('metal'))return 'Metal Prints';return 'Other Products'};
  const groups=new Map();
  templates.forEach(t=>{
    const cat=category(t);
    if(!groups.has(cat))groups.set(cat,[]);
    (t.sizes||[]).forEach(size=>{
      if(this.isDiscontinued(t.id,size))return; // discontinued variants move to their own section below
      const manualCost=Number(p.costs?.[t.id]?.[size]||0);
      /* g145: this used to be recipeCost(t.id) — a MEDIUM id handed to a lookup keyed by
         INVENTORY TEMPLATE id, which could never match, so every Supply Cost read $0 and every
         row said "No recipe set up". supplyCostFor() joins the two lists on size + mat-ness +
         medium words, and reports WHICH product it matched so a wrong match is visible. */
      const sc=window.MaterialsService?.supplyCostFor?.(t.name,size)||{cost:0,reason:'no-product',matchedName:'',hasRecipe:false};
      const recipeCost=Number(sc.cost)||0, hasRecipe=!!sc.hasRecipe;
      // Never silently overwrite a cost the user already typed -- only default to the real
      // recipe-computed cost when nothing has been entered yet (manualCost is 0).
      const retail=Number(p.standard[t.id]?.[size]||0),cost=manualCost>0?manualCost:recipeCost;
      groups.get(cat).push({id:t.id,name:t.name,size,retail,cost,hasRecipe,recipeCost,
        matchedName:sc.matchedName||'',reason:sc.reason,fromRecipe:manualCost<=0&&recipeCost>0});
    });
  });
  const order=['Art Cards','Luster Paper Prints','Metallic Luster Prints','Canvas Prints','Metal Prints','Other Products'];
  const sections=order.filter(c=>groups.has(c)&&groups.get(c).length).map(cat=>`<section class="card pricing-category"><div class="pricing-category-title"><div><div class="section-kicker">PRODUCT CATEGORY</div><h3>${sf.esc(cat)}</h3></div><span>${groups.get(cat).length} option${groups.get(cat).length===1?'':'s'}</span></div><div class="website-price-table"><div class="website-price-row header"><span>Product</span><span>Size</span><span>Website Price</span><span>Supply Cost</span><span>Profit</span><span></span></div>${groups.get(cat).map(r=>`<div class="website-price-row"><span><b>${sf.esc(r.name)}</b></span><span>${sf.esc(r.size)}</span><span><div class="money-input"><b>$</b><input data-price-medium="${r.id}" data-price-size="${sf.esc(r.size)}" data-price-original="${r.retail.toFixed(2)}" type="text" inputmode="decimal" value="${r.retail.toFixed(2)}"></div></span><span><div class="money-input"><b>$</b><input data-cost-medium="${r.id}" data-cost-size="${sf.esc(r.size)}" type="text" inputmode="decimal" value="${r.cost.toFixed(2)}"></div>${this.costNote(r)}</span><span class="website-profit">${this.money(r.retail-r.cost)}</span><span><button class="button danger" data-remove-variant="${r.id}" data-remove-size="${sf.esc(r.size)}" data-remove-name="${sf.esc(r.name)} · ${sf.esc(r.size)}">Remove</button></span></div>`).join('')}</div></section>`).join('');

  const discontinued=p.discontinued||[];
  const discontinuedSection=`<section class="card"><details class="discontinued-details"><summary><h3>Discontinued Products <span class="muted">(${discontinued.length})</span></h3></summary>${discontinued.length?`<div class="commerce-table"><div class="commerce-row header"><span>Product</span><span>SKU</span><span>Date Removed</span><span>Website Status</span><span></span></div>${discontinued.map(d=>{const canDelete=this.canPermanentlyDelete(d);return `<div class="commerce-row"><span><b>${sf.esc(d.name)} · ${sf.esc(d.size)}</b></span><span class="mono">${sf.esc(d.sku||'—')}</span><span>${new Date(d.discontinuedAt).toLocaleDateString()}</span><span><i class="stock-pill ${d.wasOnline?'gold':'success'}">${d.wasOnline?'Removal pending approval':'Was never online'}</i></span><span class="row-actions"><button class="button secondary" data-restore-variant="${d.templateId}::${d.size}">Restore</button><button class="button danger" data-delete-forever="${d.templateId}::${d.size}" ${canDelete?'':'disabled title="Cannot permanently delete: this product has history (orders, sales, inventory or a website mapping)"'}>Delete Permanently</button></span></div>`}).join('')}</div>`:'<div class="empty-state roomy">No discontinued products.</div>'}</details></section>`;

  sf.$('workspace').innerHTML=`<div class="page-stack unified-pricing"><section class="card"><div class="toolbar"><div><div class="section-kicker">WEBSITE PRICING</div><h2>Standard Website Pricing</h2><p class="muted">Saving a price change creates a pending Website Update for approval -- nothing changes on the live website automatically.</p></div><div class="row-actions"><button class="button secondary" id="addPricingProduct">＋ Product / Add-on</button><button class="button secondary" id="addPricingSize">＋ Add Size</button><button class="button secondary" id="manageMediums">Manage Mediums &amp; Sizes</button><button class="button secondary" id="mergeMediums">Merge Duplicate Mediums</button><button class="button secondary" id="openUpdateManager">Open Website Updates</button><button class="button primary" id="saveUnifiedPricing">Save Pricing</button></div></div></section>${sections||'<section class="card"><div class="empty-state roomy">No active products available.</div></section>'}<section class="card"><div class="toolbar"><div><h3>Product Add-ons & Variants</h3></div></div><div class="commerce-table addon-table"><div class="commerce-row header"><span>Add-on</span><span>Medium</span><span>Size</span><span>Price Change</span><span>Website</span><span></span></div>${p.addOns.length?p.addOns.map(a=>`<div class="commerce-row"><span><b>${sf.esc(a.name)}</b>${a.colors&&a.colors.length?`<small class="muted"> · ${sf.esc(a.colors.join(' / '))}</small>`:''}</span><span>${sf.esc(this.mediumName(a.mediumId))}</span><span>${a.sizePrices&&a.sizePrices.length?sf.esc(a.sizePrices.map(sp=>sp.size).join(', ')):sf.esc(a.size||'All sizes')}</span><span>${this.addonPriceLabel(a)}</span><span>${a.websiteEnabled===false?'No':'Yes'}</span><span class="row-actions">${a.sizePrices&&a.sizePrices.length?`<button class="button secondary" data-frame-medium="${a.id}">${this.framedTemplateFor(a)?'Update Medium':'Make it a Medium'}</button>`:''}<button class="button secondary" data-edit-addon="${a.id}">Edit</button><button class="button danger" data-delete-addon="${a.id}">Remove</button></span></div>`).join(''):'<div class="empty-state roomy">No product add-ons yet.</div>'}</div></section>${discontinuedSection}</div>`;

  const recalc=()=>document.querySelectorAll('.website-price-row:not(.header)').forEach(row=>{const a=row.querySelector('[data-price-medium]'),c=row.querySelector('[data-cost-medium]'),o=row.querySelector('.website-profit');if(o)o.textContent=this.money(Number(a?.value||0)-Number(c?.value||0))});
  document.querySelectorAll('[data-price-medium],[data-cost-medium]').forEach(i=>i.oninput=e=>{
    const cleaned=e.target.value.replace(/[^0-9.]/g,'').replace(/(\..*)\./g,'$1');
    if(cleaned!==e.target.value)e.target.value=cleaned;
    recalc();
  });
  sf.$('saveUnifiedPricing').onclick=()=>this.save();
  sf.$('addPricingProduct').onclick=()=>this.openAddOn();
  sf.$('addPricingSize').onclick=()=>this.openAddSize();
  sf.$('mergeMediums').onclick=()=>this.openMergeMediums();
  sf.$('manageMediums').onclick=()=>this.openManageMediums();
  sf.$('openUpdateManager').onclick=()=>sf.goTo('Website Updates');
  document.querySelectorAll('[data-delete-addon]').forEach(b=>b.onclick=async()=>{p.addOns=p.addOns.filter(a=>a.id!==b.dataset.deleteAddon);await sf.persist();this.render()});
  document.querySelectorAll('[data-edit-addon]').forEach(b=>b.onclick=()=>this.openAddOn(b.dataset.editAddon));
  document.querySelectorAll('[data-frame-medium]').forEach(b=>b.onclick=()=>this.syncFramedMedium(b.dataset.frameMedium));
  document.querySelectorAll('[data-remove-variant]').forEach(b=>b.onclick=()=>this.confirmRemove(b.dataset.removeVariant,b.dataset.removeSize,b.dataset.removeName));
  document.querySelectorAll('[data-restore-variant]').forEach(b=>b.onclick=()=>this.restore(b.dataset.restoreVariant));
  document.querySelectorAll('[data-delete-forever]').forEach(b=>b.onclick=()=>this.deleteForever(b.dataset.deleteForever));
 },

 mediumName(id){return window.SF.state.productTemplates.find(t=>t.id===id)?.name||id||'Any'},

 // A variant may only be permanently deleted if it has no history anywhere in the app.
 canPermanentlyDelete(d){
  const s=window.SF.state;
  const sku=d.sku||'';
  const hasOrders=(s.websiteOrderItems||[]).some(i=>i.sku&&sku&&i.sku===sku);
  const hasSales=(s.salesTransactions||[]).some(t=>t.sku===sku);
  const hasInventory=(s.inventoryItems||[]).some(i=>i.templateId===d.templateId&&i.size===d.size);
  const hasMapping=Object.values(s.websiteProductMappings||{}).some(v=>v===d.templateId);
  return !hasOrders&&!hasSales&&!hasInventory&&!hasMapping;
 },

 confirmRemove(templateId,size,name){
  const sf=window.SF;
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>Remove ${sf.esc(name)}?</h2><p class="muted">This product will no longer be available for new orders in StudioFlow.</p><p class="muted">If this product is currently available on your website, a pending website removal update will be created. The website will not change until you approve and export or apply that update.</p><p class="muted">Existing sales, orders, inventory records and analytics will be preserved.</p><div class="row-actions"><button class="button secondary" id="cancelRemove">Cancel</button><button class="button danger" id="confirmRemoveBtn">Remove Product</button></div></div></div>`;
  sf.$('cancelRemove').onclick=()=>sf.closeModal();
  sf.$('confirmRemoveBtn').onclick=async()=>{sf.closeModal();await this.discontinue(templateId,size,name)};
 },

 async discontinue(templateId,size,name){
  this.ensure();
  const sf=window.SF,s=sf.state,WU=window.SFWebsiteUpdates,C=window.SFCommerceHub;
  const sku=`${templateId}-${size}`.toUpperCase().replace(/\s+/g,'');
  const match=this.findSquarespaceVariant(sf.state.productTemplates.find(t=>t.id===templateId)?.name,size,sku);
  const wasOnline=!!match.squarespaceVariantId;
  const rawVariant=wasOnline?(C?.liveVariants?.()||[]).find(v=>v.variantId===match.squarespaceVariantId)?.raw:null;
  s.pricing.discontinued.push({templateId,size,name,sku,discontinuedAt:new Date().toISOString(),discontinuedReason:'user_removed',wasOnline,
    // Snapshot needed to reliably restore this exact variant later via the API, since Squarespace
    // has no "undo delete" -- restoring means recreating it from scratch with the same values.
    removalSnapshot:rawVariant?{squarespaceProductId:match.squarespaceProductId,attributes:rawVariant.attributes||null,sku:rawVariant.sku||sku,price:Number(rawVariant.pricing?.basePrice?.value||match.currentPrice||0)}:null});
  if(wasOnline&&WU){
   WU.supersedeForRemoval(templateId,sku);
   WU.create({action:'REMOVE_VARIANT',field:'availability',localProductId:templateId,squarespaceProductId:match.squarespaceProductId,squarespaceVariantId:match.squarespaceVariantId,sku:match.squarespaceSku||sku,productName:name,previousValue:'Active',requestedValue:'Discontinued',source:'product_removal',removalSnapshot:rawVariant?{squarespaceProductId:match.squarespaceProductId,attributes:rawVariant.attributes||null,sku:rawVariant.sku||sku,price:Number(rawVariant.pricing?.basePrice?.value||match.currentPrice||0)}:null});
  }
  sf.logActivity(`Discontinued ${name}${wasOnline?' -- pending website removal created':''}`);
  await sf.persist();
  window.SF.render();
 },

 async restore(key){
  this.ensure();
  const sf=window.SF,s=sf.state,WU=window.SFWebsiteUpdates;
  const d=s.pricing.discontinued.find(x=>`${x.templateId}::${x.size}`===key);
  if(!d)return;
  s.pricing.discontinued=s.pricing.discontinued.filter(x=>x!==d);
  // If the removal was only ever pending (never exported/applied), cancelling it is enough -- no
  // website change is needed since the website never actually changed. If it had already been
  // exported, a restore/add-back update is needed instead.
  const pendingRemoval=(s.websiteUpdates||[]).find(u=>u.localProductId===d.templateId&&u.sku===d.sku&&u.action==='REMOVE_VARIANT'&&['Pending','Approved'].includes(u.status));
  if(pendingRemoval){
   pendingRemoval.status='Cancelled';
   (pendingRemoval.audit=pendingRemoval.audit||[]).push({at:new Date().toISOString(),action:'Cancelled (restored before export)'});
  }else if(d.wasOnline&&WU){
   WU.create({action:'RESTORE_VARIANT',field:'availability',localProductId:d.templateId,sku:d.sku,productName:d.name,previousValue:'Discontinued',requestedValue:'Active',source:'product_restore',removalSnapshot:d.removalSnapshot||null});
  }
  sf.logActivity(`Restored ${d.name}`);
  await sf.persist();
  window.SF.render();
 },

 async deleteForever(key){
  this.ensure();
  const sf=window.SF,s=sf.state;
  const d=s.pricing.discontinued.find(x=>`${x.templateId}::${x.size}`===key);
  if(!d)return;
  if(!this.canPermanentlyDelete(d))return alert('This product has history (orders, sales, inventory, or a website mapping) and cannot be permanently deleted.');
  if(!confirm(`Permanently delete ${d.name} · ${d.size}? This cannot be undone.`))return;
  s.pricing.discontinued=s.pricing.discontinued.filter(x=>x!==d);
  // Actually remove the size from the product template so it can't reappear in the active list on
  // the next render, and drop its price/cost cells. Safe: canPermanentlyDelete confirmed no orders,
  // sales, inventory, or website mapping reference it.
  const _n=v=>String(v||'').toLowerCase().replace(/\s+/g,'');
  const tpl=(s.productTemplates||[]).find(t=>t.id===d.templateId);
  // Only ever remove the exact size that was discontinued. This used to also strip any
  // near-identical spelling (_n normalised away spaces), so deleting one "30 x 60" took out
  // "30x60" with it and the size vanished from the page entirely.
  if(tpl&&Array.isArray(tpl.sizes))tpl.sizes=tpl.sizes.filter(sz=>sz!==d.size);
  if(s.pricing.standard&&s.pricing.standard[d.templateId])delete s.pricing.standard[d.templateId][d.size];
  if(s.pricing.costs&&s.pricing.costs[d.templateId])delete s.pricing.costs[d.templateId][d.size];
  sf.logActivity(`Permanently deleted ${d.name} · ${d.size}`);
  await sf.persist();
  this.render();
 },

 // Finds the REAL Squarespace product/variant ID for a local template+size. Checks a saved
 // manual mapping first (set via the picker in Website Updates), then falls back to matching by
 // SKU or product name + size against the synced catalogue, reusing the same liveVariants() list
 // Sales & Orders already uses for order matching, rather than re-parsing the raw API response.
 findSquarespaceVariant(tplName,size,localSku,mapKey){
  const sf=window.SF, C=window.SFCommerceHub;
  sf.state.pricingSquarespaceMap=sf.state.pricingSquarespaceMap||{};
  const saved=mapKey?sf.state.pricingSquarespaceMap[mapKey]:null;
  const variants=C?.liveVariants?C.liveVariants():[];
  if(saved){
   const hit=variants.find(v=>v.variantId===saved.squarespaceVariantId);
   if(hit)return {squarespaceProductId:hit.productId,squarespaceVariantId:hit.variantId,squarespaceSku:hit.sku,currentPrice:hit.price};
  }
  const wantSku=String(localSku||'').toUpperCase().replace(/\s+/g,'');
  const bySku=variants.find(v=>v.sku&&String(v.sku).toUpperCase().replace(/\s+/g,'')===wantSku);
  if(bySku)return {squarespaceProductId:bySku.productId,squarespaceVariantId:bySku.variantId,squarespaceSku:bySku.sku,currentPrice:bySku.price};
  const nameNorm=String(tplName||'').toLowerCase();
  const sizeNorm=String(size||'').toLowerCase().replace(/\s+/g,'');
  const byName=variants.find(v=>String(v.title||'').toLowerCase().includes(nameNorm)&&String(v.variant||'').toLowerCase().replace(/\s+/g,'').includes(sizeNorm));
  if(byName)return {squarespaceProductId:byName.productId,squarespaceVariantId:byName.variantId,squarespaceSku:byName.sku,currentPrice:byName.price};
  return {};
 },
 async save(){
  this.ensure();
  const sf=window.SF,p=sf.state.pricing,WU=window.SFWebsiteUpdates;
  let changed=0;
  document.querySelectorAll('[data-price-medium][data-price-size]').forEach(i=>{
   const tplId=i.dataset.priceMedium,size=i.dataset.priceSize,original=Number(i.dataset.priceOriginal||0),next=Number(i.value||0);
   p.standard[tplId]=p.standard[tplId]||{};
   p.standard[tplId][size]=next;
   if(Math.abs(next-original)>=0.005){
    changed++;
    if(WU){
     const tpl=sf.state.productTemplates.find(t=>t.id===tplId);
     const localSku=`${tplId}-${size}`.toUpperCase().replace(/\s+/g,'');
     const match=this.findSquarespaceVariant(tpl?.name,size,localSku);
     WU.create({action:'UPDATE_PRICE',field:'price',localProductId:tplId,sku:localSku,squarespaceProductId:match.squarespaceProductId||'',squarespaceVariantId:match.squarespaceVariantId||'',productName:`${tpl?.name||'Product'} (${size})`,previousValue:original.toFixed(2),requestedValue:next.toFixed(2),source:'website_pricing'});
    }
   }
  });
  document.querySelectorAll('[data-cost-medium][data-cost-size]').forEach(i=>{p.costs[i.dataset.costMedium]=p.costs[i.dataset.costMedium]||{};p.costs[i.dataset.costMedium][i.dataset.costSize]=Number(i.value||0)});
  sf.logActivity(changed?`Website pricing saved -- ${changed} price change${changed===1?'':'s'} queued for approval`:'Website pricing saved (no price changes)');
  await sf.persist();
  alert(changed?`${changed} price change${changed===1?'':'s'} saved as a pending Website Update. Open Website Updates to review and approve.`:'Costs saved. No website prices changed, so no update was queued.');
  window.SF.render();
 },

 openMergeMediums(){
  const sf=window.SF,templates=sf.state.productTemplates||[];
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card" id="mergeForm"><h2>Merge Duplicate Mediums</h2><p class="muted">For when two entries represent the same real medium (e.g. "Metallic Luster" and "Metallic Luster Paper"). Everything pointing at the one you merge away -- artwork variants, pricing, costs, add-ons -- gets redirected to the one you keep, then the duplicate is removed.</p><label>Merge away (will be deleted)<select id="mergeFrom">${templates.map(t=>`<option value="${t.id}">${sf.esc(t.name)} (${t.id})${(t.sizes||[]).length?'':' -- no sizes on file'}</option>`).join('')}</select></label><label>Keep (everything redirects here)<select id="mergeInto">${templates.map(t=>`<option value="${t.id}">${sf.esc(t.name)} (${t.id})</option>`).join('')}</select></label><div class="row-actions"><button type="button" class="button secondary" id="mergeCancel">Cancel</button><button class="button danger">Merge &amp; Delete Duplicate</button></div></form></div>`;
  sf.$('mergeCancel').onclick=()=>sf.closeModal();
  sf.$('mergeForm').onsubmit=async e=>{
   e.preventDefault();
   const fromId=sf.$('mergeFrom').value,intoId=sf.$('mergeInto').value;
   if(fromId===intoId)return alert('Pick two different mediums -- one to merge away, one to keep.');
   const from=templates.find(t=>t.id===fromId),into=templates.find(t=>t.id===intoId);
   if(!confirm(`Merge "${from.name}" into "${into.name}"? This redirects every reference and cannot be undone.`))return;
   let artworkCount=0;
   (sf.state.artworks||[]).forEach(a=>{
    let touched=false;
    (a.products||[]).forEach(p=>{if(p.mediumId===fromId){p.mediumId=intoId;p.medium=into.name;touched=true;}});
    if(touched)artworkCount++;
   });
   const p=sf.state.pricing||{};
   if(p.standard?.[fromId]){p.standard[intoId]=p.standard[intoId]||{};Object.entries(p.standard[fromId]).forEach(([size,price])=>{if(!Number(p.standard[intoId][size]||0))p.standard[intoId][size]=price;});delete p.standard[fromId];}
   if(p.costs?.[fromId]){p.costs[intoId]=p.costs[intoId]||{};Object.entries(p.costs[fromId]).forEach(([size,cost])=>{if(!Number(p.costs[intoId][size]||0))p.costs[intoId][size]=cost;});delete p.costs[fromId];}
   (p.addOns||[]).forEach(ad=>{if(ad.mediumId===fromId)ad.mediumId=intoId;});
   // Merge by normalised size so "30 x 60" from one medium and "30x60" from the other don't
   // both land in the kept medium and show up as two identical rows in Website Pricing.
   const mergedSizes=new Map();
   [...(into.sizes||[]),...(from.sizes||[])].forEach(sz=>{const k=this.sizeKey(sz);if(k&&!mergedSizes.has(k))mergedSizes.set(k,sz)});
   into.sizes=window.SFProductTemplates.sortSizes([...mergedSizes.values()]);
   sf.state.productTemplates=templates.filter(t=>t.id!==fromId);
   sf.logActivity(`Merged medium "${from.name}" into "${into.name}" (${artworkCount} artwork(s) updated)`);
   await sf.persist();
   sf.closeModal();
   alert(`Merged. ${artworkCount} artwork(s) redirected to "${into.name}".`);
   this.render();
  };
 },
 // One place to add a size to a medium so every artwork on that medium can offer it, plus a
 // recovery list for sizes whose pricing survived but whose template entry got deleted.
 openAddSize(){
  const sf=window.SF,templates=(sf.state.productTemplates||[]).filter(t=>String(t.name||'').trim());
  const orphans=this.orphanedSizes(),gone=(sf.state.pricing.discontinued||[]);
  const recovery=[
   ...orphans.map(o=>`<div class="commerce-row"><span><b>${sf.esc(o.templateName)}</b> · ${sf.esc(o.size)}</span><span>${o.price?this.money(o.price):'<i class="muted">no saved price</i>'}</span><span><button type="button" class="button secondary" data-readd-size="${sf.esc(o.templateId)}" data-readd-value="${sf.esc(o.size)}">Add back</button></span></div>`),
   ...gone.map(d=>`<div class="commerce-row"><span><b>${sf.esc(d.name)}</b> · ${sf.esc(d.size)} <i class="muted">(discontinued)</i></span><span>${new Date(d.discontinuedAt).toLocaleDateString()}</span><span><button type="button" class="button secondary" data-restore-key="${sf.esc(d.templateId)}::${sf.esc(d.size)}">Restore</button></span></div>`)
  ].join('');
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card" id="addSizeForm"><h2>Add a Size</h2><p class="muted">Sizes belong to a medium, so adding one here makes it available to every artwork that uses that medium. It still has to be ticked on each piece's Products &amp; Sizes tab before it goes to the website.</p>
   <label>Medium<select id="addSizeMedium">${templates.map(t=>`<option value="${sf.esc(t.id)}">${sf.esc(t.name)}${(t.sizes||[]).length?` (${(t.sizes||[]).length} sizes)`:' (no sizes yet)'}</option>`).join('')}</select></label>
   <label>Size<input id="addSizeValue" required placeholder="30 x 60"></label>
   <label>Website Price <small class="muted">(optional -- you can fill it in on the pricing table instead)</small><div class="money-input"><b>$</b><input id="addSizePrice" type="text" inputmode="decimal" placeholder="0.00"></div></label>
   ${recovery?`<section class="card"><h3>Sizes you can bring back</h3><p class="muted">These still have pricing or history on file but aren't being offered right now.</p><div class="commerce-table">${recovery}</div></section>`:''}
   <div class="row-actions"><button type="button" class="button secondary" id="addSizeCancel">Cancel</button><button class="button primary">Add Size</button></div></form></div>`;
  sf.$('addSizeCancel').onclick=()=>sf.closeModal();
  document.querySelectorAll('[data-readd-size]').forEach(b=>b.onclick=async()=>{
   const t=(sf.state.productTemplates||[]).find(x=>x.id===b.dataset.readdSize);
   if(!t)return;
   const size=b.dataset.readdValue;
   if(!(t.sizes||[]).some(s=>this.sizeKey(s)===this.sizeKey(size)))
    t.sizes=window.SFProductTemplates?window.SFProductTemplates.sortSizes([...(t.sizes||[]),size]):[...(t.sizes||[]),size];
   sf.logActivity(`Restored size ${size} to ${t.name}`);
   await sf.persist();
   sf.closeModal();
   this.render();
  });
  document.querySelectorAll('[data-restore-key]').forEach(b=>b.onclick=async()=>{await this.restore(b.dataset.restoreKey);sf.closeModal()});
  sf.$('addSizeForm').onsubmit=async e=>{
   e.preventDefault();
   const t=(sf.state.productTemplates||[]).find(x=>x.id===sf.$('addSizeMedium').value);
   if(!t)return alert('Pick a medium first.');
   const size=this.normalizeSize(sf.$('addSizeValue').value);
   if(!size)return alert('Enter a size, e.g. 30 x 60.');
   if((t.sizes||[]).some(s=>this.sizeKey(s)===this.sizeKey(size)))return alert(`${t.name} already offers ${size}.`);
   const wasDiscontinued=(sf.state.pricing.discontinued||[]).find(d=>d.templateId===t.id&&this.sizeKey(d.size)===this.sizeKey(size));
   if(wasDiscontinued)return alert(`${t.name} · ${wasDiscontinued.size} is sitting in Discontinued Products. Use Restore there (or in the list above) so its website link and history come back with it.`);
   t.sizes=window.SFProductTemplates?window.SFProductTemplates.sortSizes([...(t.sizes||[]),size]):[...(t.sizes||[]),size];
   const price=Number(String(sf.$('addSizePrice').value||'').replace(/[^0-9.]/g,''))||0;
   if(price>0){sf.state.pricing.standard[t.id]=sf.state.pricing.standard[t.id]||{};sf.state.pricing.standard[t.id][size]=price;}
   sf.logActivity(`Added size ${size} to ${t.name}${price?` at ${this.money(price)}`:''}`);
   await sf.persist();
   sf.closeModal();
   this.render();
  };
 },
 openManageMediums(){
  const sf=window.SF,templates=sf.state.productTemplates||[];
  const usersOf=mediumId=>sf.artworkCatalog().filter(a=>(a.products||[]).some(p=>p.mediumId===mediumId));
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Manage Mediums &amp; Sizes</h2><p class="muted">These are the print types and sizes available across every artwork's Products &amp; Sizes tab. Add new ones here as they come up, or remove ones you no longer offer.</p>
    <div class="row-actions"><input id="newMediumName" placeholder="New medium name, e.g. Framed Canvas"><button class="button primary" id="addMedium">＋ Add Medium</button></div>
    <div id="mediumList">${templates.map(t=>{const users=usersOf(t.id);return `<div class="medium-manage-card"><div class="medium-manage-head"><b>${sf.esc(t.name)}</b><span class="muted">${users.length?`${users.length} artwork(s) using this`:'Not currently used'}</span><button class="mini-edit danger" data-delete-medium="${t.id}">Delete Medium</button></div><div class="medium-size-chips">${(t.sizes||[]).map((sz,i)=>`<span class="size-chip">${sf.esc(sz)}<button data-remove-size="${t.id}" data-size="${sf.esc(sz)}" data-size-index="${i}">×</button></span>`).join('')||'<small class="muted">No sizes yet</small>'}</div><div class="row-actions"><input class="new-size-input" data-add-size-medium="${t.id}" placeholder="New size, e.g. 11x14"><button class="button secondary" data-add-size="${t.id}">＋ Add Size</button></div></div>`;}).join('')}</div>
    <div class="row-actions"><button class="button primary" id="mediumsClose">Close</button></div>
  </div></div>`;
  sf.$('mediumsClose').onclick=()=>{sf.closeModal();this.render()};
  sf.$('addMedium').onclick=async()=>{
    const name=sf.$('newMediumName').value.trim();
    if(!name)return alert('Enter a name for the new medium.');
    const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||sf.makeId('MED');
    if(templates.some(t=>t.id===id))return alert('A medium with that name already exists.');
    sf.state.productTemplates.push({id,name,sizes:[],enabled:true});
    sf.logActivity(`Added new medium: ${name}`);
    await sf.persist();
    this.render();this.openManageMediums();
  };
  document.querySelectorAll('[data-add-size]').forEach(b=>b.onclick=async()=>{
    const t=templates.find(x=>x.id===b.dataset.addSize);
    const input=document.querySelector(`[data-add-size-medium="${b.dataset.addSize}"]`);
    const size=input.value.trim();
    if(!size)return;
    if((t.sizes||[]).includes(size))return alert('That size is already listed for this medium.');
    t.sizes=window.SFProductTemplates?window.SFProductTemplates.sortSizes([...(t.sizes||[]),size]):[...(t.sizes||[]),size];
    sf.logActivity(`Added size ${size} to ${t.name}`);
    await sf.persist();
    this.render();this.openManageMediums();
  });
  document.querySelectorAll('[data-remove-size]').forEach(b=>b.onclick=async()=>{
    const t=templates.find(x=>x.id===b.dataset.removeSize);
    const affected=sf.artworkCatalog().filter(a=>(a.products||[]).some(p=>p.mediumId===t.id&&p.size===b.dataset.size));
    const warning=affected.length?`\n\n${affected.length} artwork currently uses this size: ${affected.slice(0,5).map(a=>a.title).join(', ')}${affected.length>5?`, +${affected.length-5} more`:''}.\n\nThey'll keep it until you edit each one -- Product Health will flag them as needing attention so you don't lose track.`:'\n\nNo artwork currently uses this size.';
    if(!confirm(`Remove ${b.dataset.size} from ${t.name}?${warning}`))return;
    // Remove the one chip that was clicked (by position), never every entry that happens to
    // share the same size text -- that behaviour is what made a size vanish in pairs.
    const idx=Number(b.dataset.sizeIndex);
    t.sizes=Number.isInteger(idx)&&idx>=0&&idx<(t.sizes||[]).length
      ?(t.sizes||[]).filter((_,i)=>i!==idx)
      :(t.sizes||[]).filter(s=>s!==b.dataset.size);
    sf.logActivity(`Removed size ${b.dataset.size} from ${t.name}`);
    await sf.persist();
    this.render();this.openManageMediums();
  });
  document.querySelectorAll('[data-delete-medium]').forEach(b=>{
    b.onclick=async()=>{
      const t=templates.find(x=>x.id===b.dataset.deleteMedium);
      const users=usersOf(t.id);
      if(users.length){
        alert(`Can't delete "${t.name}" -- ${users.length} artwork still use it:\n\n${users.slice(0,10).map(a=>a.title).join('\n')}${users.length>10?`\n+${users.length-10} more`:''}\n\nEdit each one to remove this medium from their Products & Sizes first, then delete it here.`);
        return;
      }
      if(!confirm(`Delete "${t.name}" entirely? This cannot be undone.`))return;
      sf.state.productTemplates=sf.state.productTemplates.filter(x=>x.id!==t.id);
      sf.logActivity(`Deleted medium: ${t.name}`);
      await sf.persist();
      this.render();this.openManageMediums();
    };
  });
 },
 addonPriceLabel(a){const sf=window.SF;if(a.sizePrices&&a.sizePrices.length){const ps=a.sizePrices.map(x=>Number(x.price||0));const mn=Math.min(...ps),mx=Math.max(...ps);return mn===mx?this.money(mn):`${this.money(mn)} – ${this.money(mx)}`}return this.money(a.price)},
 // Turn a per-size add-on (the Floating Frame) into a real medium, so a framed size behaves
 // exactly like "Luster Paper + Mat" does: its own template, its own sizes, its own price, its
 // own SKU. Everything downstream -- Products & Sizes, the Website tab, addVariantPlan, the
 // medKey matcher -- then works on it unchanged, with no new push logic to get wrong.
 framedTemplateId(a){return `${a.mediumId}-${String(a.name||'addon').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}`},
 framedTemplateFor(a){return (window.SF.state.productTemplates||[]).find(t=>t.id===this.framedTemplateId(a))},
 async syncFramedMedium(addOnId){
  this.ensure();
  const sf=window.SF,p=sf.state.pricing;
  const a=(p.addOns||[]).find(x=>x.id===addOnId);
  if(!a)return;
  const base=(sf.state.productTemplates||[]).find(t=>t.id===a.mediumId);
  if(!base)return alert(`"${a.name}" isn't attached to a medium yet. Edit the add-on and pick the medium it applies to first.`);
  const rows=(a.sizePrices||[]).filter(sp=>sp&&sp.size);
  if(!rows.length)return alert(`"${a.name}" has no sizes priced yet. Edit it and set a price for each size you offer the frame on.`);
  const id=this.framedTemplateId(a),name=`${base.name} with ${a.name}`;
  let t=(sf.state.productTemplates||[]).find(x=>x.id===id);
  if(!t){t={id,name,sizes:[],enabled:true};sf.state.productTemplates.push(t)}
  t.name=name;t.fromAddOnId=a.id;t.baseTemplateId=base.id;t.frameColours=Array.isArray(a.colors)?a.colors:[];
  // The site has no variant of this medium yet, so the option-naming logic has nothing to copy.
  // Record what this medium adds on top of the base one ("... with Floating Frame") so a new
  // variant can be named from a plain-canvas sibling instead.
  t.baseMediumName=base.name;t.optionSuffix=` with ${a.name}`;
  p.standard[id]=p.standard[id]||{};
  p.costs[id]=p.costs[id]||{};
  const sizes=[],priced=[],unpriced=[];
  rows.forEach(sp=>{
   // Match the add-on's size against the base medium's own spelling ("16x24" -> "16 x 24") so the
   // framed medium lines up with the plain one and the size matcher can pair them.
   const match=(base.sizes||[]).find(s=>this.sizeKey(s)===this.sizeKey(sp.size));
   const size=match||this.normalizeSize(sp.size);
   if(!match)unpriced.push(`${size} (not offered on ${base.name})`);
   sizes.push(size);
   const basePrice=Number(p.standard[base.id]?.[size]||0),addPrice=Number(sp.price||0);
   if(basePrice>0&&addPrice>0){p.standard[id][size]=basePrice+addPrice;priced.push(`${size} — ${this.money(basePrice+addPrice)}`)}
   else{if(p.standard[id][size]==null)p.standard[id][size]=0;unpriced.push(`${size} (${!basePrice?`no ${base.name} price`:'frame price is $0'})`)}
   const baseCost=Number(p.costs[base.id]?.[size]||0),addCost=Number(a.cost||0);
   if(p.costs[id][size]==null||!Number(p.costs[id][size]))p.costs[id][size]=baseCost+addCost;
  });
  t.sizes=window.SFProductTemplates?window.SFProductTemplates.sortSizes(sizes):[...new Set(sizes)];
  sf.logActivity(`Synced framed medium "${name}" from add-on ${a.name} (${t.sizes.length} size${t.sizes.length===1?'':'s'})`);
  await sf.persist();
  this.render();
  alert(`"${name}" is now a medium with ${t.sizes.length} size${t.sizes.length===1?'':'s'}.\n\n${priced.length?`Priced:\n${priced.join('\n')}\n\n`:''}${unpriced.length?`Needs attention:\n${unpriced.join('\n')}\n\n`:''}Tick it on each artwork's Products & Sizes tab to offer it, then push from the Website tab as usual.`);
 },
 openAddOn(id=''){const sf=window.SF,templates=sf.state.productTemplates||[],existing=id?(sf.state.pricing.addOns||[]).find(a=>a.id===id):null,a=existing||{};const cols=Array.isArray(a.colors)?a.colors:[];const colChk=n=>`<label class="checkline addon-col"><input type="checkbox" data-addon-color="${n}" ${cols.includes(n)?'checked':''}> ${n}</label>`;let rows=Array.isArray(a.sizePrices)&&a.sizePrices.length?a.sizePrices.slice():null;if(!rows){const sizes=String(a.size!=null?a.size:(existing?'':'16x24, 20x40, 20x60, 24x36')).split(',').map(x=>x.trim()).filter(Boolean);rows=sizes.length?sizes.map(x=>({size:x,price:Number(a.price||0)})):[{size:'',price:0}];}const rowHtml=r=>`<div class="addon-size-row"><input class="addon-sp-size" value="${sf.esc(r.size||'')}" placeholder="20x40"><div class="money-input"><b>$</b><input class="addon-sp-price" type="number" min="0" step=".01" value="${Number(r.price||0)}"></div><button type="button" class="button danger addon-sp-del" title="Remove size">✕</button></div>`;sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card" id="addonForm"><h2>${existing?'Edit':'Add'} Product Add-on</h2><label>Name<input id="addonName" value="${sf.esc(a.name||'Floating Frame')}" required></label><label>Applies to<select id="addonMedium">${templates.map(t=>`<option value="${t.id}" ${(existing?a.mediumId===t.id:/canvas/i.test(t.name))?'selected':''}>${sf.esc(t.name)}</option>`).join('')}</select></label><div><span class="crop-guides-label">Sizes &amp; prices <small class="muted">— each size can have its own price</small></span><div id="addonSizeRows">${rows.map(rowHtml).join('')}</div><button type="button" class="button secondary" id="addonAddRow">＋ Add size</button></div><div><span class="crop-guides-label">Colour options <small class="muted">(all colours same price)</small></span><div class="addon-colors">${['Black','White','Espresso'].map(colChk).join('')}</div></div><label class="checkline"><input id="addonWebsite" type="checkbox" ${a.websiteEnabled===false?'':'checked'}> Include in website update CSV</label><div class="row-actions"><button type="button" class="button secondary" id="addonCancel">Cancel</button><button class="button primary">${existing?'Save Changes':'Create Add-on'}</button></div></form></div>`;const rowsHost=sf.$('addonSizeRows');const wireDel=()=>rowsHost.querySelectorAll('.addon-sp-del').forEach(b=>b.onclick=()=>{if(rowsHost.querySelectorAll('.addon-size-row').length>1)b.closest('.addon-size-row').remove()});wireDel();sf.$('addonAddRow').onclick=()=>{rowsHost.insertAdjacentHTML('beforeend',rowHtml({size:'',price:0}));wireDel()};sf.$('addonCancel').onclick=()=>sf.closeModal();sf.$('addonForm').onsubmit=async e=>{e.preventDefault();const name=sf.$('addonName').value.trim(),mediumId=sf.$('addonMedium').value,colors=[...document.querySelectorAll('[data-addon-color]:checked')].map(x=>x.dataset.addonColor),websiteEnabled=sf.$('addonWebsite').checked;const sizePrices=[...rowsHost.querySelectorAll('.addon-size-row')].map(r=>({size:r.querySelector('.addon-sp-size').value.trim(),price:Number(r.querySelector('.addon-sp-price').value)||0})).filter(x=>x.size);if(!sizePrices.length)return alert('Add at least one size.');const size=sizePrices.map(x=>x.size).join(', '),price=sizePrices[0].price||0;if(existing){Object.assign(existing,{name,mediumId,sizePrices,size,price,colors,websiteEnabled,updatedAt:new Date().toISOString()});sf.logActivity(`Updated ${name} add-on`);}else{sf.state.pricing.addOns.push({id:sf.makeId('ADDON'),name,mediumId,sizePrices,size,price,colors,websiteEnabled,createdAt:new Date().toISOString()});sf.logActivity(`Added ${name} add-on`);}await sf.persist();sf.closeModal();this.render()};},

 csv(){const sf=window.SF,p=sf.state.pricing,rows=[['Product Type','Size','Variant','Price','Update Type']];(sf.state.productTemplates||[]).forEach(t=>(t.sizes||[]).forEach(size=>{if(this.isDiscontinued(t.id,size))return;rows.push([t.name,size,'Standard',Number(p.standard[t.id]?.[size]||0).toFixed(2),'Price Update']);}));p.addOns.filter(a=>a.websiteEnabled!==false).forEach(a=>rows.push([this.mediumName(a.mediumId),a.size||'All Sizes',a.name,Number(a.price||0).toFixed(2),'Add Variant']));return rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n')},
};

/* StudioFlow 11.5.1 · one practical floating-frame add-on */
(function(){
 const P=window.SFUnifiedPricing;if(!P)return;
 const originalEnsure=P.ensure.bind(P);
 P.ensure=function(){
  originalEnsure();
  const sf=window.SF,p=sf.state.pricing,templates=(sf.state.productTemplates||[]).filter(t=>/canvas/i.test(t.name||''));
  p.addOns=Array.isArray(p.addOns)?p.addOns:[];
  const isFloating=x=>/floating\s*frame/i.test(String(x.name||''))||x.variantType==='Canvas Frame';
  // Only seed a default Floating Frame if the user has none yet. Never wipe/replace an existing one --
  // that was erasing the size/price/colour edits on every render.
  if(!p.addOns.some(isFloating)){
   const canvas=templates.find(t=>(t.sizes||[]).some(z=>String(z).replace(/\s/g,'').toLowerCase()==='20x40'))||templates[0];
   if(canvas)p.addOns.push({id:'ADDON-FLOAT-20X40',name:'Floating Frame',mediumId:canvas.id,sizePrices:[{size:'16x24',price:0},{size:'20x40',price:0},{size:'20x60',price:0},{size:'24x36',price:0}],size:'16x24, 20x40, 20x60, 24x36',colors:['Black','White','Espresso'],price:0,cost:0,websiteEnabled:true,variantType:'Canvas Frame',pricingClass:'Standard Retail',createdAt:new Date().toISOString()});
  }
 };
})();
