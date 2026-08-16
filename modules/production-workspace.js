/* StudioFlow 3.8.1 · Production Workspace (corrective build)
   Fixes the 3.8.0 inventory-matching bug: the workspace had its own weak matcher (SKU-or-exact-
   title only) instead of reusing the product-mapping system StudioFlow already had in
   commerce-hub.js (C.orderNeed / websiteProductMappings). This build resolves inventory through
   that existing system first, extends it with ID- and structured-match fallbacks, fixes the
   reservation math (reserving no longer silently deletes stock from on-hand), supports multiple
   order lines, and reads raw materials from the existing Materials & Sheet Cutting system instead
   of a duplicate one. */
window.SFProductionWorkspace = {

  STAGES:['import','inventory','production','package','ship','complete'],
  STAGE_LABELS:{import:'Import',inventory:'Inventory',production:'Production',package:'Package',ship:'Ship',complete:'Complete'},

  CHECKLISTS:{
    'art card':['Print','Trim','Package'],
    'framed print':['Print','Trim','Mount','Cut Mat','Assemble Frame','Package'],
    'canvas':['Print','Stretch','Inspect','Package'],
    'metal print':['Print','Mount','Inspect','Package'],
    'print':['Print','Trim','Package'],
  },

  // ---- 1. one authoritative on-hand reader --------------------------------------------------
  // Zero is a valid quantity, so this uses ?? throughout, never ||.
  getInventoryOnHand(item){
    return Number(
      item?.currentOnHand ??
      item?.quantity ??
      item?.onHand ??
      item?.stock ??
      item?.qty ??
      0
    );
  },
  getInventoryReserved(item){return Math.max(0,Number(item?.reserved ?? 0))},
  getInventoryAvailable(item){return Math.max(0,this.getInventoryOnHand(item)-this.getInventoryReserved(item))},
  // Whenever on-hand changes, keep the legacy field in sync too, since other modules
  // (Inventory, Product Mapping) still read `quantity` directly.
  setInventoryOnHand(item,value){
    const v=Math.max(0,Number(value)||0);
    item.currentOnHand=v;
    item.quantity=v;
  },

  ensure(){
    const sf=window.SF, s=sf.state;
    s.productionBatches=Array.isArray(s.productionBatches)?s.productionBatches:[];
    // 7. Migrate/discard the 3.8.0 duplicate raw-materials array. Only keep it if a user actually
    // entered a non-zero quantity somewhere in it; otherwise it was only ever the auto-seeded
    // zero-quantity defaults and is safe to drop now that Materials & Sheet Cutting is the single
    // source of truth for raw materials.
    if(Array.isArray(s.rawMaterials)&&s.rawMaterials.length){
      const real=s.rawMaterials.filter(m=>Number(m.quantity||0)>0);
      if(real.length){
        s._rawMaterialsBackup=s.rawMaterials; // keep a copy rather than silently deleting user data
        real.forEach(m=>{
          const existing=(s.materials||[]).find(x=>String(x.name).toLowerCase()===String(m.name).toLowerCase());
          if(existing)existing.onHand=Number(existing.onHand||0)+Number(m.quantity||0);
          else (s.materials=s.materials||[]).push({id:sf.makeId('MAT'),name:m.name,kind:'unit',unit:m.unit||'unit',onHand:Number(m.quantity||0),lowWarning:Number(m.lowThreshold||0),createdAt:new Date().toISOString()});
        });
        sf.logActivity?.(`Migrated ${real.length} raw material record(s) from the 3.8.0 workspace into Materials & Sheet Cutting.`);
      }
      delete s.rawMaterials;
    }
  },

  // ---- helpers -----------------------------------------------------------
  medium(line){
    const text=`${line?.productName||''} ${line?.variant||''}`.toLowerCase();
    if(/frame/.test(text))return 'framed print';
    if(/canvas/.test(text))return 'canvas';
    if(/metal/.test(text))return 'metal print';
    if(/card/.test(text))return 'art card';
    return 'print';
  },
  describe(line){
    const sf=window.SF;
    const text=`${line?.variant||''} ${line?.productName||''}`.trim();
    const sizeMatch=text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    const mediumNames={'art card':'Art Card','framed print':'Framed Print','canvas':'Canvas','metal print':'Metal Print','print':'Print'};
    const mediumLabel=mediumNames[this.medium(line)];
    if(sizeMatch)return `${sizeMatch[1]}×${sizeMatch[2]} ${mediumLabel}`;
    return sf.esc(line?.productName||mediumLabel);
  },
  money(v){return window.SFCommerceHub?window.SFCommerceHub.money(v):`$${Number(v||0).toFixed(2)}`},
  checklistStepsFor(line){
    const recipe=this.recipeFor(line);
    if(recipe?.productionSteps?.length)return recipe.productionSteps;
    return this.CHECKLISTS[this.medium(line)]||this.CHECKLISTS.print;
  },
  norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()},

  // ---- 2. centralized finished-inventory resolver --------------------------------------------
  // Priority: saved product mapping -> exact SKU -> ID matches -> structured artwork+product+size
  // match -> safe fallback (only when artwork AND product type are both confidently identified).
  resolveInventoryMatch(line){
    const sf=window.SF, s=sf.state, C=window.SFCommerceHub;
    const items=s.inventoryItems||[];
    const qtyOf=item=>this.getInventoryOnHand(item);

    const result=(item,matchMethod,confidence,reason)=>{
      const onHand=item?qtyOf(item):0;
      const reserved=item?this.getInventoryReserved(item):0;
      return {item,onHand,reserved,available:Math.max(0,onHand-reserved),matchMethod,confidence,reason};
    };

    // Priority 1 + 2: reuse StudioFlow's existing product-mapping / SKU matcher directly, rather
    // than re-implementing it -- this is the exact system Product Mapping already saves to.
    if(C?.orderNeed){
      const need=C.orderNeed(line);
      if(need?.inv)return result(need.inv,'Product mapping / SKU','high','Matched via the saved Squarespace product mapping or an exact SKU.');
    }

    // Priority 3: direct ID matches.
    const idFields=['artworkId','productTemplateId','templateId','inventoryId','productId','variantId'];
    for(const field of idFields){
      const val=line[field];
      if(!val)continue;
      const hit=items.find(i=>String(i[field]||i.id)===String(val));
      if(hit)return result(hit,`ID match (${field})`,'medium',`Matched on ${field}.`);
    }

    // Priority 4: structured match on artwork title + product type + size, NOT the raw Squarespace
    // product title against the artwork title (that comparison is too broad and misses real matches).
    const art=sf.artworkById?.(line.artworkId);
    const artworkTitle=this.norm(art?.title||line.artworkTitle||'');
    const medium=this.medium(line);
    const sizeMatch=`${line.variant||''} ${line.productName||''}`.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    const sizeKey=sizeMatch?`${sizeMatch[1]}x${sizeMatch[2]}`:'';
    if(artworkTitle){
      const templates=s.inventoryProductTemplates||[];
      const candidates=items.filter(i=>{
        const iTitle=this.norm(i.artworkTitle||sf.artworkById?.(i.artworkId)?.title||'');
        if(iTitle!==artworkTitle)return false;
        const tpl=templates.find(t=>String(t.id)===String(i.templateId));
        const tplText=this.norm(tpl?.name||i.productName||'');
        const mediumOk=tplText.includes(medium.split(' ')[0]);
        const sizeOk=!sizeKey||this.norm(tpl?.size||i.size||'').includes(sizeKey)||this.norm(i.sku||'').includes(sizeKey.replace('x',''));
        return mediumOk&&sizeOk;
      });
      if(candidates.length===1)return result(candidates[0],'Structured match (artwork + product + size)','medium','Matched by artwork title, product type and size.');
      if(candidates.length>1)return result(candidates[0],'Structured match (multiple candidates)','low','Multiple inventory items matched artwork + product type; used the first. Please confirm.');
    }

    // Priority 5: safe fallback -- only if we're confident about BOTH artwork and product type,
    // never an unrelated item just because nothing else matched.
    if(artworkTitle&&medium!=='print'){
      const looseHit=items.find(i=>this.norm(i.artworkTitle||sf.artworkById?.(i.artworkId)?.title||'')===artworkTitle);
      if(looseHit)return result(looseHit,'Fallback (artwork title only)','low','Only the artwork title matched; product type/size could not be confirmed. Please verify.');
    }

    return result(null,'No match','none','No saved mapping, SKU, ID, or structured match was found for this line.');
  },

  // ---- order workspace -----------------------------------------------------------
  async cancelOrder(orderId){
    const sf=window.SF, C=window.SFCommerceHub;
    const o=sf.state.websiteOrders.find(x=>x.id===orderId);
    if(!o)return;
    if(!confirm(`Cancel order ${o.orderNumber||o.id}? It will be marked Cancelled and kept in your records, and any reserved inventory will be released. This does not delete anything.`))return;
    const lines=sf.state.websiteOrderItems.filter(i=>i.orderId===orderId);
    lines.forEach(line=>{
      const st=(o.lineState||{})[this.lineKey(line)];
      if(st?.reservation&&st.reservation.reservationStatus==='reserved'){
        const item=sf.state.inventoryItems.find(i=>i.id===st.reservation.inventoryItemId);
        if(item)item.reserved=Math.max(0,this.getInventoryReserved(item)-st.reservation.reservedQuantity);
        st.reservation.reservationStatus='released';
      }
    });
    o.status='Cancelled';
    o.cancelledAt=new Date().toISOString();
    sf.state.productionQueue=(sf.state.productionQueue||[]).filter(t=>t.orderId!==orderId||['Completed'].includes(t.status));
    sf.logActivity(`Cancelled order ${o.orderNumber||o.id}`);
    await sf.persist();
    this.render(orderId);
  },

  async deleteOrder(orderId){
    const sf=window.SF, C=window.SFCommerceHub;
    const o=sf.state.websiteOrders.find(x=>x.id===orderId);
    if(!o)return;
    const hasRevenue=!!o.salesTransactionId;
    const orderLabel=o.orderNumber||o.id;
    const warning=hasRevenue
      ? `<p class="muted">This order has an associated sales transaction (real recorded revenue). Deleting the order will also delete that transaction and remove it from revenue totals.</p>`
      : `<p class="muted">This removes the order, its items, and any related production tasks. This cannot be undone.</p>`;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>Delete order ${sf.esc(orderLabel)}?</h2>${warning}<label>Type the order number exactly to confirm<input id="pwDeleteOrderConfirm" placeholder="${sf.esc(orderLabel)}"></label><div class="row-actions"><button class="button secondary" id="pwDeleteOrderCancel">Cancel</button><button class="button danger" id="pwDeleteOrderConfirmBtn">Delete Permanently</button></div></div></div>`;
    sf.$('pwDeleteOrderCancel').onclick=()=>sf.closeModal();
    sf.$('pwDeleteOrderConfirmBtn').onclick=async()=>{
      if(sf.$('pwDeleteOrderConfirm').value!==orderLabel){alert('Order number did not match -- nothing was deleted.');return}
      try{
        const lines=sf.state.websiteOrderItems.filter(i=>i.orderId===orderId);
        // Release any reserved-but-not-fulfilled inventory back, rather than leaving it stuck
        // "reserved" forever with no order left to ever release it.
        lines.forEach(line=>{
          const st=(o.lineState||{})[this.lineKey(line)];
          if(st?.reservation&&st.reservation.reservationStatus==='reserved'){
            const item=sf.state.inventoryItems.find(i=>i.id===st.reservation.inventoryItemId);
            if(item)item.reserved=Math.max(0,this.getInventoryReserved(item)-st.reservation.reservedQuantity);
          }
        });
        sf.state.websiteOrders=sf.state.websiteOrders.filter(x=>x.id!==orderId);
        sf.state.websiteOrderItems=sf.state.websiteOrderItems.filter(i=>i.orderId!==orderId);
        sf.state.productionQueue=(sf.state.productionQueue||[]).filter(t=>t.orderId!==orderId);
        if(hasRevenue)sf.state.salesTransactions=(sf.state.salesTransactions||[]).filter(t=>t.id!==o.salesTransactionId);
        sf.logActivity(`Deleted order ${orderLabel}${hasRevenue?' (and its associated sales transaction)':''}`);
        await sf.persist();
        sf.closeModal();
        C.orders1147();
      }catch(err){
        console.error('Delete order failed:',err);
        alert(`Delete failed with an error: ${err.message}\n\nNothing was changed. Please share this error message so it can be fixed properly.`);
      }
    };
  },

  render(id){
    if(!id)return this.batches();
    this.ensure();
    const sf=window.SF, C=window.SFCommerceHub;
    const o=sf.state.websiteOrders.find(x=>x.id===id);
    if(!o)return;
    o.pwStage=o.pwStage||'import';
    o.lineState=o.lineState||{}; // per-line: {fulfillMethod, checklist, extrasProduced}
    const allLines=sf.state.websiteOrderItems.filter(i=>i.orderId===id);
    const physicalLines=allLines.filter(l=>!/digital|download|gift card|service booking/i.test(`${l.productName||''}`));
    const customer=sf.state.customers.find(c=>c.id===o.customerId);
    const headLine=physicalLines[0]||allLines[0]||{};
    const art=sf.artworkById?.(headLine.artworkId);
    // 9. thumbnail priority: order-line image -> matched artwork -> placeholder.
    const thumb=headLine.imageUrl||art?.image||art?.thumbnail||'';

    const progressBar=this.STAGES.map((st,i)=>{
      const idx=this.STAGES.indexOf(o.pwStage);
      const state=i<idx?'done':i===idx?'current':'todo';
      return `<div class="pw-stage pw-stage-${state}"><span class="pw-stage-dot"></span><span class="pw-stage-label">${this.STAGE_LABELS[st]}</span></div>`;
    }).join('<span class="pw-stage-line"></span>');

    let body='';
    if(o.pwStage==='import'||o.pwStage==='inventory'||o.pwStage==='production'){
      // 8. every physical line gets its own card: match, fulfillment choice, checklist.
      body=physicalLines.map((line,i)=>this.lineCardHtml(o,line,i)).join('');
      const allReady=physicalLines.every(l=>this.lineReady(o,l));
      body+=`<div class="row-actions pw-line-summary"><button class="button primary" id="pwAllToPackage" ${allReady?'':'disabled'}>All Lines Ready — Continue to Packaging</button></div>`;
    }else if(o.pwStage==='package'){
      body=this.packageHtml(o);
    }else if(o.pwStage==='ship'){
      body=this.shippingHtml(o);
    }else{
      body=`<section class="card pw-complete"><h3>Order Complete</h3><p class="muted">This order has shipped and is marked delivered.</p><div class="fact-grid">${[['Shipping method',o.deliveryMethod||'Shipping'],['Tracking',o.tracking||'—'],['Delivered',o.deliveredAt?new Date(o.deliveredAt).toLocaleDateString():'—']].map(([a,b])=>`<div><span>${a}</span><b>${sf.esc(b)}</b></div>`).join('')}</div></section>`;
    }

    sf.$('commerceBody').innerHTML=`<div class="pw-workspace">
      <div class="row-actions"><button class="back-link" id="pwBack">← Sales & Orders</button>${o.status!=='Cancelled'&&o.pwStage!=='complete'?'<button class="button secondary" id="pwCancelOrder">Cancel Order</button>':''}<button class="button danger" id="pwDeleteOrder">Delete Order</button></div>
      <div class="pw-progress">${progressBar}</div>
      <section class="card pw-order-head">
        <div class="pw-thumb">${thumb?`<img src="${thumb}" alt="">`:'<span class="pw-thumb-empty">No image</span>'}</div>
        <div class="pw-order-info">
          <h2>${sf.esc(art?.title||headLine.productName||'Untitled order')}</h2>
          <p class="pw-desc">${physicalLines.length>1?`${physicalLines.length} items`:this.describe(headLine)}</p>
          <div class="pw-fact-row">
            <span>Customer: <b>${sf.esc(o.customerName||customer?.name||'Website customer')}</b></span>
            <span>Payment: <b>${sf.esc((window.SFCommerceHub?.paymentLabel(o)||['Unknown'])[0])}</b></span>
            <span>Due Date: <b>${sf.esc(o.dueDate||'Not set')}</b></span>
          </div>
        </div>
      </section>
      ${body}
    </div>`;

    sf.$('pwBack').onclick=()=>C.orders1147();
    const cancelBtn=sf.$('pwCancelOrder');
    if(cancelBtn)cancelBtn.onclick=()=>this.cancelOrder(o.id);
    sf.$('pwDeleteOrder').onclick=()=>this.deleteOrder(o.id);
    this.wire(o,physicalLines);
  },

  lineKey(line){return String(line.id||`${line.sku||''}:${line.productName||''}`)},
  lineReady(o,line){
    const st=o.lineState[this.lineKey(line)];
    if(!st)return false;
    if(st.fulfillMethod==='existing')return !!st.reservation;
    if(st.fulfillMethod==='produce')return (st.checklist||[]).every(c=>c.done);
    return false;
  },

  lineCardHtml(o,line,idx){
    const sf=window.SF;
    const key=this.lineKey(line);
    const st=o.lineState[key]=o.lineState[key]||{};
    const qty=Number(line.quantity||1);
    const catalog=sf.artworkCatalog?sf.artworkCatalog():[];
    const isCustom=line.artworkId==='__custom__';
    const currentArt=isCustom?null:sf.artworkById?.(line.artworkId);
    // Custom/portrait-session items (a client's own session photos, not a catalog artwork) have
    // nothing in Finished Inventory to ever match against -- there's no "existing stock" of
    // someone's personal portrait print. Skipping straight to Produce New for those, rather than
    // offering an "Use Existing Inventory" choice that could never find anything.
    const artworkPicker=`<label class="pw-artwork-picker">Artwork
      <select data-set-artwork="${key}">
        <option value="">-- Select the correct piece --</option>
        ${catalog.map(a=>`<option value="${sf.esc(a.id||a.artworkId)}" ${String(line.artworkId||'')===String(a.id||a.artworkId)?'selected':''}>${sf.esc(a.title||'Untitled')}</option>`).join('')}
        <option value="__custom__" ${isCustom?'selected':''}>Other / Custom (portrait session print, not in catalog)</option>
      </select>
    </label>`;
    const header=`<div class="pw-line-head"><b>Line ${idx+1}: ${this.describe(line)}</b><span>Qty ${qty}</span></div>${artworkPicker}`;

    if(!line.artworkId){
      return `<section class="card pw-decision">${header}<p class="muted">Select the artwork above before choosing how to fulfill this item -- StudioFlow needs to know which piece this is to check existing inventory correctly.</p></section>`;
    }

    if(!st.fulfillMethod){
      return `<section class="card pw-decision">${header}
        <h3>How would you like to fulfill this item?</h3>
        <div class="pw-decision-row">
          ${isCustom?'':'<button class="pw-decision-card" data-use-existing="'+key+'"><b>Use Existing Inventory</b><span>Check finished stock and reserve it for this order</span></button>'}
          <button class="pw-decision-card" data-produce-new="${key}"><b>Produce New</b><span>Calculate materials and start production</span></button>
        </div>
        ${isCustom?'<p class="muted">Custom/portrait-session item -- Produce New is the only option, since there\'s no existing stock of a client\'s own session print. Printing it uses your materials and is logged for ink, but the prints are never added to Finished Inventory: they are already spoken for.</p>':''}
      </section>`;
    }

    if(st.fulfillMethod==='existing'){
      const match=st.reservation?{item:sf.state.inventoryItems.find(i=>i.id===st.reservation.inventoryItemId),onHand:0,reserved:0,available:0,matchMethod:st.reservation.matchMethod}:this.resolveInventoryMatch(line);
      const onHand=match.item?this.getInventoryOnHand(match.item):0;
      const reserved=match.item?this.getInventoryReserved(match.item):0;
      const available=Math.max(0,onHand-reserved);
      const enough=available>=qty;
      const already=!!st.reservation;
      return `<section class="card pw-existing">${header}
        <h3>Existing Inventory</h3>
        ${match.item?`<div class="pw-matched-item"><b>Matched Inventory</b><p>${sf.esc(match.item.artworkTitle||match.item.name||'Inventory item')}</p><small>SKU: ${sf.esc(match.item.sku||'—')}</small><small class="pw-match-method">Matched by: ${sf.esc(match.matchMethod)}</small></div>`:`<p class="pw-missing">${sf.esc(match.reason||'No matching inventory item was found.')}</p>`}
        <div class="fact-grid"><div><span>On Hand</span><b>${onHand}</b></div><div><span>Reserved</span><b>${reserved}</b></div><div><span>Available</span><b>${available}</b></div><div><span>Needed</span><b>${qty}</b></div></div>
        <p class="muted ink-cost-line">Printing Required: No · Ink Cost: ${window.SFInkCostEngine?window.SFInkCostEngine.money(0):'$0.00'} · Raw Materials: Not Consumed</p>
        <p class="${enough?'pw-ready':'pw-missing'}">${already?'✓ Reserved for this order.':enough?'✓ Enough available stock to fulfill this item.':'Not enough available stock — consider Produce New instead.'}</p>
        <details class="pw-diagnostic"><summary>Inventory Match Details</summary><pre>${sf.esc(JSON.stringify({matchMethod:match.matchMethod,confidence:match.confidence,onHand,reserved,available},null,2))}</pre></details>
        <div class="row-actions">
          <button class="button secondary" data-change-method="${key}">Change Method</button>
          <button class="button secondary" data-choose-item="${key}">Choose Different Inventory Item</button>
          ${already?'':`<button class="button primary" data-reserve="${key}" ${enough&&match.item?'':'disabled'}>Reserve &amp; Continue</button>`}
        </div>
        <div class="pw-choose-panel" id="pwChoosePanel-${key}" hidden></div>
      </section>`;
    }

    // produce
    const recipe=this.recipeFor(line);
    // A manual override (set via "Specify Materials Manually") replaces the recipe-derived check
    // entirely for this line -- for exactly the case where no formal recipe exists yet, or this
    // specific production run genuinely needs something different (e.g. one cello bag and one
    // foam core offcut shared across several prints, rather than per print).
    const checks=st.manualMaterials?this.manualMaterialsCheck(st.manualMaterials,qty):[...this.materialsCheckFor(recipe,qty),...this.packagingCheckFor(recipe)];
    const ready=checks.length>0&&checks.every(c=>!c.short);
    const sizeMatch=String(line.productName||'').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    const inkEstimate=recipe&&sizeMatch&&window.SFInkCostEngine?window.SFInkCostEngine.estimateForRecipe(recipe,sizeMatch[0]):null;
    if(!st.checklist){
      return `<section class="card pw-produce">${header}
        <h3>Produce New — Materials Needed</h3>
        ${st.manualMaterials?'<p class="muted">Using manually specified materials for this production run.</p>':''}
        ${checks.length?`<ul class="pw-materials">${checks.map(c=>`<li class="${c.short?'pw-short':'pw-ok'}">${c.short?'✗':'✓'} ${sf.esc(c.name)} <small>(${c.have}/${c.need} on hand${c.recommendedOffcut?` -- use offcut ${c.recommendedOffcut.width}×${c.recommendedOffcut.height}`:''}${c.packaging?' -- once per order':''})</small></li>`).join('')}</ul>`:`<p class="muted">No material recipe is set up for this product yet. Set one up in Materials &amp; Sheet Cutting for an automatic check, or specify materials manually for just this production run.</p>`}
        ${inkEstimate?`<p class="ink-cost-line"><b>${sf.esc(inkEstimate.label)}: ${window.SFInkCostEngine.money(inkEstimate.cost*qty)}</b> <small class="muted">Ink Confidence: ${sf.esc(inkEstimate.confidence)}</small></p>`:recipe?.printerProfileId?'<p class="muted">No ink cost data yet for this printer/media combination -- log some print jobs and calibrate to get an estimate.</p>':''}
        <p class="${ready?'pw-ready':'pw-missing'}">${ready?'READY TO PRODUCE':checks.length?'MISSING MATERIALS':'NO RECIPE ON FILE'}</p>
        <div class="row-actions">
          <button class="button secondary" data-change-method="${key}">Change Method</button>
          <button class="button secondary" data-manual-materials="${key}">${st.manualMaterials?'Edit Manual Materials':'Specify Materials Manually'}</button>
          <button class="button primary" data-start-production="${key}" ${checks.length?(ready?'':'disabled'):''}>Start Production</button>
        </div>
      </section>`;
    }
    const allDone=st.checklist.every(c=>c.done);
    if(!allDone||st.extrasHandled===undefined){
      if(allDone&&st.extrasHandled===undefined){
        return `<section class="card pw-extras">${header}
          <h3>Did you produce extras, or have any waste?</h3>
          <div class="fact-grid"><div><span>Order Qty</span><b>${qty}</b></div></div>
          <label>Extra Produced<input id="pwExtraQty-${key}" type="number" min="0" value="0"></label>
          <label>Waste / Reprints (misprints, errors, damage)<input id="pwWasteQty-${key}" type="number" min="0" value="0"></label>
          <p class="muted">Waste still consumed paper and ink -- it's counted in what gets deducted, but doesn't add to Finished Inventory.</p>
          <div class="row-actions"><button class="button primary" data-save-extras="${key}">Continue</button></div>
        </section>`;
      }
      return `<section class="card pw-checklist-card">${header}
        <h3>Production Checklist</h3>
        <div class="pw-checklist">${st.checklist.map((c,i)=>`<label class="pw-check-row"><input type="checkbox" data-check-line="${key}" data-check-idx="${i}" ${c.done?'checked':''}><span>${sf.esc(c.label)}</span></label>`).join('')}</div>
        <div class="row-actions"><button class="button primary" data-finish-production="${key}" ${allDone?'':'disabled'}>Production Complete</button></div>
      </section>`;
    }
    return `<section class="card pw-ready-line">${header}<p class="pw-ready">✓ Produced and ready.</p></section>`;
  },

  recipeFor(line){
    const sf=window.SF, s=sf.state;
    const templates=s.inventoryProductTemplates||[];
    const medium=this.medium(line);
    const tpl=templates.find(t=>String(t.id)===String(line.productTemplateId))
      ||templates.find(t=>this.norm(t.name).includes(medium.split(' ')[0]));
    if(!tpl)return null;
    return (s.productRecipes||[]).find(r=>String(r.templateId)===String(tpl.id))||null;
  },
  materialsCheckFor(recipe,qty){
    if(!recipe||!recipe.components?.length)return [];
    const sf=window.SF, s=sf.state, MC=window.SFMaterialsCutting;
    return recipe.components.map(c=>{
      const mat=(s.materials||[]).find(m=>String(m.id)===String(c.materialId));
      const need=Number(c.quantity||1)*qty;
      // Sheet-yield components (mat board, foam core cut to size) need the same authoritative
      // yield math recipeCost() already uses, not a flat quantity check -- one sheet on hand can
      // cover several pieces, and a matching offcut can cover a piece without touching a full
      // sheet at all. Fixed-count components (envelopes, cello sleeves, hardware) keep the
      // simple, correct quantity check they already had.
      if(mat?.kind==='sheet'&&c.cutWidth&&c.cutHeight&&MC){
        const gap=Number(mat.gap||0), edge=Number(mat.edgeTrim||0), rotate=mat.allowRotate!==false;
        const perSheet=Number(c.manualYield||0)||MC.bestYield(Number(mat.width),Number(mat.height),Number(c.cutWidth),Number(c.cutHeight),gap,edge,rotate);
        const fromSheets=Math.floor(Number(mat.onHand||0))*Math.max(0,perSheet);
        const eligibleOffcuts=(s.sheetOffcuts||[]).filter(o=>String(o.materialId)===String(mat.id)&&MC.bestYield(Number(o.width),Number(o.height),Number(c.cutWidth),Number(c.cutHeight),gap,edge,rotate)>0)
          .sort((a,b)=>(Number(a.width)*Number(a.height))-(Number(b.width)*Number(b.height)));
        const fromOffcuts=eligibleOffcuts.reduce((n,o)=>n+Math.max(0,MC.bestYield(Number(o.width),Number(o.height),Number(c.cutWidth),Number(c.cutHeight),gap,edge,rotate)),0);
        const have=fromSheets+fromOffcuts;
        // The smallest eligible offcut is the one deduction will actually reach for first -- surface
        // it here too, so you know exactly which physical piece to pull rather than grabbing a
        // larger one that might be better saved for something else.
        const recommendedOffcut=eligibleOffcuts[0]?{width:eligibleOffcuts[0].width,height:eligibleOffcuts[0].height,id:eligibleOffcuts[0].id}:null;
        return {name:mat?.name||'Unknown material',need,have,short:have<need,materialId:c.materialId,sheetYield:true,fromOffcuts:fromOffcuts>0,recommendedOffcut};
      }
      const have=Math.max(0,Number(mat?.onHand||0));
      return {name:mat?.name||'Unknown material',need,have,short:have<need,materialId:c.materialId};
    });
  },
  // Packaging is shared across the whole line, not multiplied by quantity -- one cello bag and
  // one foam core backing for 5 prints from the same session, not five of each.
  async deleteBatch(batchId){
    const sf=window.SF, s=sf.state;
    const b=(s.productionBatches||[]).find(x=>x.id===batchId);
    if(!b)return;
    if(b.status==='Queued'){
      // Nothing was ever deducted for a queued (not-yet-printed) batch -- cancelling it is just
      // removing the plan, no reversal needed.
      if(!confirm(`Cancel this queued print run (${b.purpose})? Nothing has been deducted yet, so this just removes the plan.`))return;
      s.productionBatches=s.productionBatches.filter(x=>x.id!==batchId);
      sf.logActivity(`Cancelled queued print run: ${b.purpose}`);
      await sf.persist();
      this.batches();
      return;
    }
    const materialTotals=new Map();
    b.lines.forEach(l=>{
      const recipe=(s.productRecipes||[]).find(r=>String(r.templateId)===String(l.templateId));
      if(!recipe)return;
      const totalQty=l.qty+(l.waste||0);
      [...this.materialsCheckFor(recipe,totalQty),...this.packagingCheckFor(recipe)].forEach(c=>{
        const cur=materialTotals.get(c.materialId)||{name:c.name,amount:0,sheetYield:c.sheetYield,materialId:c.materialId};
        cur.amount+=c.need;
        materialTotals.set(c.materialId,cur);
      });
    });
    const materialRows=[...materialTotals.values()];
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Delete this batch and reverse it?</h2><p class="muted">${b.purpose} · ${new Date(b.createdAt).toLocaleDateString()} · ${b.lines.reduce((n,l)=>n+l.qty,0)} units</p><p class="muted">This will restore raw materials and remove the finished inventory this batch added, based on today's recipes. If a recipe has changed since this batch ran, the restored amount may not exactly match what was originally deducted -- offcuts specifically aren't restored to their exact original size, just as an equivalent raw material amount.</p>${materialRows.length?`<h3>Raw materials to restore</h3><ul class="pw-materials">${materialRows.map(m=>`<li class="pw-ok">${sf.esc(m.name)}: +${Math.round(m.amount*100)/100}${m.sheetYield?' (as equivalent sheets, not exact offcuts)':''}</li>`).join('')}</ul>`:'<p class="muted">No raw materials to restore -- these products had no recipe when the batch ran.</p>'}<h3>Finished inventory to remove</h3><ul class="pw-materials">${b.lines.map(l=>`<li class="pw-ok">-${l.qty} × ${sf.esc(l.artworkTitle)} — ${sf.esc(l.productName)}</li>`).join('')}</ul><div class="row-actions"><button class="button secondary" id="delBatchCancel">Cancel</button><button class="button danger" id="delBatchConfirm">Delete &amp; Reverse</button></div></div></div>`;
    sf.$('delBatchCancel').onclick=()=>sf.closeModal();
    sf.$('delBatchConfirm').onclick=async()=>{
      materialRows.forEach(m=>{
        const mat=s.materials.find(x=>String(x.id)===String(m.materialId));
        if(mat)mat.onHand=Number(mat.onHand||0)+m.amount;
      });
      const clientJobDel=/^Client Job/.test(String(b.purpose||''));
      b.lines.forEach(l=>{
        /* g152: nothing was added for a client job or a non-catalogue line, so nothing is taken
           back. Reversing an addition that never happened would quietly eat real stock of another
           product sharing the template. */
        const isCustom=l.artworkId==='__custom__';
        if(clientJobDel||isCustom)return;
        const inv=s.inventoryItems.find(i=>String(i.templateId)===String(l.templateId)&&String(i.artworkId)===String(l.artworkId));
        if(inv)this.setInventoryOnHand(inv,Math.max(0,this.getInventoryOnHand(inv)-l.qty));
      });
      s.productionBatches=s.productionBatches.filter(x=>x.id!==batchId);
      // Remove any print jobs this batch created too -- leaving them behind would corrupt future
      // ink calibration with jobs that no longer correspond to anything real.
      if(s.printJobs)s.printJobs=s.printJobs.filter(j=>j.productionBatchId!==batchId);
      sf.logActivity?.(`Deleted and reversed production batch: ${b.purpose} (${b.lines.reduce((n,l)=>n+l.qty,0)} units)`);
      await sf.persist();
      sf.closeModal();
      this.batches();
    };
  },

  packagingCheckFor(recipe){
    if(!recipe||!recipe.packagingComponents?.length)return [];
    const sf=window.SF, s=sf.state;
    return recipe.packagingComponents.map(c=>{
      const mat=(s.materials||[]).find(m=>String(m.id)===String(c.materialId));
      const have=Math.max(0,Number(mat?.onHand||0));
      const need=Number(c.quantity||1); // once per line, no qty multiplier
      return {name:mat?.name||'Unknown material',need,have,short:have<need,materialId:c.materialId,packaging:true};
    });
  },

  manualMaterialsCheck(manualMaterials,qty){
    const sf=window.SF, s=sf.state;
    return manualMaterials.map(m=>{
      const mat=(s.materials||[]).find(x=>String(x.id)===String(m.materialId));
      const have=Math.max(0,Number(mat?.onHand||0));
      const need=m.perOrder?Number(m.quantity||1):Number(m.quantity||1)*qty;
      return {name:mat?.name||'Unknown material',need,have,short:have<need,materialId:m.materialId,packaging:!!m.perOrder};
    });
  },

  openManualMaterials(orderId,lineKey){
    const sf=window.SF, o=sf.state.websiteOrders.find(x=>x.id===orderId), st=o.lineState[lineKey];
    const existing=st.manualMaterials||[];
    const matRow=(m={})=>`<div class="pw-manual-mat-row"><select class="mmMat"><option value="">Select material</option>${sf.state.materials.map(x=>`<option value="${x.id}" ${m.materialId===x.id?'selected':''}>${sf.esc(x.name)}</option>`).join('')}</select><input class="mmQty" type="number" min=".01" step=".01" value="${m.quantity||1}" title="Quantity"><label class="checkline"><input class="mmPerOrder" type="checkbox" ${m.perOrder?'checked':''}> Once per order (not per unit)</label><button type="button" class="mini-edit mmDel">Remove</button></div>`;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Specify Materials Manually</h2><p class="muted">For a one-off production run without a formal recipe yet. Leave "Once per order" unchecked for anything that scales with quantity (like paper, one sheet per print); check it for anything shared across the whole order (like one cello bag or one foam core backing for several prints).</p><div id="mmRows">${(existing.length?existing:[{}]).map(matRow).join('')}</div><button type="button" class="button secondary" id="mmAdd">＋ Add Material</button><div class="row-actions"><button type="button" class="button secondary" id="mmCancel">Cancel</button><button type="button" class="button primary" id="mmSave">Save</button></div></div></div>`;
    const bind=()=>document.querySelectorAll('.mmDel').forEach(b=>b.onclick=()=>b.closest('.pw-manual-mat-row').remove());
    bind();
    sf.$('mmAdd').onclick=()=>{sf.$('mmRows').insertAdjacentHTML('beforeend',matRow());bind()};
    sf.$('mmCancel').onclick=()=>sf.closeModal();
    sf.$('mmSave').onclick=async()=>{
      const materials=[...document.querySelectorAll('.pw-manual-mat-row')].map(r=>({materialId:r.querySelector('.mmMat').value,quantity:Number(r.querySelector('.mmQty').value)||1,perOrder:r.querySelector('.mmPerOrder').checked})).filter(m=>m.materialId);
      st.manualMaterials=materials;
      await sf.persist();
      sf.closeModal();
      this.render(orderId);
    };
  },

  // Single source of truth for actually consuming a recipe's materials, given a quantity being
  // produced. Used by both per-order Produce New completion and Production Batches -- previously
  // duplicated between them, and the batch copy had the flat-deduction bug this fixes. Sheet-yield
  // components consume matching offcuts first (smallest eligible one first), then only deduct
  // whole sheets for whatever's still needed; packaging is consumed once regardless of quantity.
  consumeRecipeMaterials(recipe,qty){
    if(!recipe)return;
    const sf=window.SF;
    this.materialsCheckFor(recipe,qty).forEach(c=>{
      const mat=sf.state.materials.find(m=>String(m.id)===String(c.materialId));
      if(!mat)return;
      if(c.sheetYield&&window.SFMaterialsCutting){
        const comp=(recipe.components||[]).find(x=>String(x.materialId)===String(c.materialId));
        const gap=Number(mat.gap||0), edge=Number(mat.edgeTrim||0), rotate=mat.allowRotate!==false;
        let remaining=c.need;
        const eligible=sf.state.sheetOffcuts.filter(o=>String(o.materialId)===String(mat.id)
          &&window.SFMaterialsCutting.bestYield(Number(o.width),Number(o.height),Number(comp.cutWidth),Number(comp.cutHeight),gap,edge,rotate)>0)
          .sort((a,b)=>(Number(a.width)*Number(a.height))-(Number(b.width)*Number(b.height)));
        for(const off of eligible){
          if(remaining<=0)break;
          const y=window.SFMaterialsCutting.bestYield(Number(off.width),Number(off.height),Number(comp.cutWidth),Number(comp.cutHeight),gap,edge,rotate);
          remaining-=y;
          sf.state.sheetOffcuts=sf.state.sheetOffcuts.filter(x=>x.id!==off.id);
        }
        if(remaining>0){
          const perSheet=Number(comp.manualYield||0)||window.SFMaterialsCutting.bestYield(Number(mat.width),Number(mat.height),Number(comp.cutWidth),Number(comp.cutHeight),gap,edge,rotate);
          const sheetsNeeded=perSheet>0?Math.ceil(remaining/perSheet):0;
          mat.onHand=Math.max(0,Number(mat.onHand||0)-sheetsNeeded);
        }
      }else{
        mat.onHand=Math.max(0,Number(mat.onHand||0)-c.need);
      }
    });
    this.packagingCheckFor(recipe).forEach(c=>{
      const mat=sf.state.materials.find(m=>String(m.id)===String(c.materialId));
      if(mat)mat.onHand=Math.max(0,Number(mat.onHand||0)-c.need);
    });
  },

  // Aggregate materials needed across every line in a draft batch, combining shared materials
  // (e.g. two products both using the same cello bag) rather than showing separate, confusing
  // per-line totals -- so shortages are visible before committing to the batch, not after.
  batchMaterialsPreview(draftLines){
    const sf=window.SF, s=sf.state;
    const totals=new Map();
    draftLines.forEach(l=>{
      const recipe=(s.productRecipes||[]).find(r=>String(r.templateId)===String(l.templateId));
      if(!recipe)return;
      const totalQty=l.qty+(l.waste||0); // materials are consumed for everything attempted, not just good units
      [...this.materialsCheckFor(recipe,totalQty),...this.packagingCheckFor(recipe)].forEach(c=>{
        const cur=totals.get(c.materialId)||{name:c.name,need:0,have:c.have,recommendedOffcut:c.recommendedOffcut};
        cur.need+=c.need;
        totals.set(c.materialId,cur);
      });
    });
    if(!totals.size)return '<p class="muted">No recipes set up for these products yet -- material requirements can\'t be previewed until they are.</p>';
    const rows=[...totals.values()];
    const anyShort=rows.some(r=>r.have<r.need);
    return `<div class="notice"><b>Materials needed for this batch:</b><ul class="pw-materials">${rows.map(r=>`<li class="${r.have<r.need?'pw-short':'pw-ok'}">${r.have<r.need?'✗':'✓'} ${sf.esc(r.name)} <small>(${r.have}/${Math.round(r.need*100)/100} on hand${r.recommendedOffcut?` -- use offcut ${r.recommendedOffcut.width}×${r.recommendedOffcut.height}`:''})</small></li>`).join('')}</ul>${anyShort?'<p class="pw-missing">Some materials are short -- starting the batch will still deduct what\'s available, going negative is not allowed, so double check before starting.</p>':'<p class="pw-ready">Materials on hand cover this batch.</p>'}</div>`;
  },

  packageHtml(o){
    return `<section class="card pw-package"><h3>Ready to Package</h3><p class="muted">Every line is ready. Confirm the order is packaged and ready to move to shipping.</p><div class="row-actions"><button class="button primary" id="pwToShip">Packaged — Continue to Shipping</button></div></section>`;
  },
  shippingHtml(o){
    const sf=window.SF;
    return `<section class="card form-grid pw-shipping"><h3>Shipping</h3><label>Shipping Method<select id="pwShipMethod"><option ${o.deliveryMethod==='Shipping'?'selected':''}>Shipping</option><option ${o.deliveryMethod==='Pickup'?'selected':''}>Pickup</option></select></label><label>Tracking Number<input id="pwTracking" value="${sf.esc(o.tracking||'')}"></label><div class="row-actions"><button class="button secondary" id="pwPrintLabel">Print Shipping Label</button><button class="button primary" id="pwMarkDelivered">Mark Delivered</button></div></section>`;
  },

  wire(o,physicalLines){
    const sf=window.SF, C=window.SFCommerceHub;
    const lineByKey=k=>physicalLines.find(l=>this.lineKey(l)===k);
    const save=async(msg)=>{if(msg)(o.history=o.history||[]).push({at:new Date().toISOString(),text:msg});await sf.persist();this.render(o.id)};

    document.querySelectorAll('[data-set-artwork]').forEach(sel=>sel.onchange=()=>{
      const key=sel.dataset.setArtwork, line=lineByKey(key);
      line.artworkId=sel.value;
      // Changing the artwork invalidates whatever fulfillment choice/match was already made
      // against the old (or missing) artwork -- reset so it's re-evaluated correctly.
      o.lineState[key]={};
      save(sel.value==='__custom__'?'Marked as custom/portrait-session item':`Artwork set to ${sf.artworkById?.(sel.value)?.title||sel.value}`);
    });
    document.querySelectorAll('[data-use-existing]').forEach(b=>b.onclick=()=>{o.lineState[b.dataset.useExisting].fulfillMethod='existing';save();});
    document.querySelectorAll('[data-produce-new]').forEach(b=>b.onclick=()=>{o.lineState[b.dataset.produceNew].fulfillMethod='produce';save();});
    document.querySelectorAll('[data-change-method]').forEach(b=>b.onclick=()=>{o.lineState[b.dataset.changeMethod]={};save();});

    // 4. reservation only increases `reserved` and never touches on-hand directly.
    document.querySelectorAll('[data-reserve]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.reserve, line=lineByKey(key), st=o.lineState[key];
      if(st.reservation)return; // guard: already reserved, never reserve twice
      const match=this.resolveInventoryMatch(line);
      if(!match.item)return;
      const qty=Number(line.quantity||1);
      if(!o.testMode){
        match.item.reserved=this.getInventoryReserved(match.item)+qty;
      }
      st.reservation={inventoryItemId:match.item.id,reservedQuantity:qty,reservedAt:new Date().toISOString(),reservationStatus:'reserved',matchMethod:match.matchMethod};
      save(o.testMode?`TEST order — reserved ${qty} locally, real inventory untouched`:`Reserved ${qty} of "${match.item.artworkTitle||match.item.name}" (matched by ${match.matchMethod})`);
    });

    document.querySelectorAll('[data-choose-item]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.chooseItem, panel=sf.$(`pwChoosePanel-${key}`);
      if(!panel)return;
      const choices=(C?.inventoryChoices?C.inventoryChoices():sf.state.inventoryItems.map(i=>({id:i.id,label:i.artworkTitle||'Item',qty:this.getInventoryOnHand(i)})));
      panel.hidden=!panel.hidden;
      panel.innerHTML=panel.hidden?'':`<select id="pwChooseSelect-${key}">${choices.map(c=>`<option value="${sf.esc(c.id)}">${sf.esc(c.label)} · ${c.qty} on hand</option>`).join('')}</select><button class="button secondary" data-confirm-choice="${key}">Use This Item</button>`;
      if(!panel.hidden){
        sf.$(`pwChoosePanel-${key} [data-confirm-choice]`)?.addEventListener('click',async()=>{
          const chosenId=sf.$(`pwChooseSelect-${key}`).value, line=lineByKey(key);
          // Save the manual correction back to the persistent product mapping so this variant
          // matches correctly automatically next time.
          if(C?.mappingKey){
            const mapKey=C.mappingKey({variantId:line.variantId,sku:line.sku,productId:line.productId,variant:line.variant});
            sf.state.websiteProductMappings=sf.state.websiteProductMappings||{};
            sf.state.websiteProductMappings[mapKey]=chosenId;
          }
          save('Manually matched inventory item and saved the mapping for next time');
        });
      }
    });

    document.querySelectorAll('[data-manual-materials]').forEach(b=>b.onclick=()=>this.openManualMaterials(o.id,b.dataset.manualMaterials));
    document.querySelectorAll('[data-start-production]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.startProduction, line=lineByKey(key), st=o.lineState[key];
      st.checklist=this.checklistStepsFor(line).map(label=>({label,done:false}));
      save('Production started');
    });
    document.querySelectorAll('[data-check-line]').forEach(cb=>cb.onchange=()=>{
      o.lineState[cb.dataset.checkLine].checklist[Number(cb.dataset.checkIdx)].done=cb.checked;
      save();
    });
    document.querySelectorAll('[data-finish-production]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.finishProduction, line=lineByKey(key), st=o.lineState[key];
      if(st.materialsDeducted)return; // guard: never deduct twice
      if(!o.testMode){
        const qty=Number(line.quantity||1);
        if(st.manualMaterials){
          this.manualMaterialsCheck(st.manualMaterials,qty).forEach(c=>{
            const mat=sf.state.materials.find(m=>String(m.id)===String(c.materialId));
            if(mat)mat.onHand=Math.max(0,Number(mat.onHand||0)-c.need);
          });
        }else{
          const recipe=this.recipeFor(line);
          this.consumeRecipeMaterials(recipe,qty);
          // Printing genuinely happened here -- create a print job automatically, same as
          // Production Batches already do, rather than requiring a duplicate manual entry.
          if(recipe?.printerProfileId){
            const sizeMatch=String(line.productName||'').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
            if(sizeMatch){
              sf.state.printJobs=Array.isArray(sf.state.printJobs)?sf.state.printJobs:[];
              const width=Number(sizeMatch[1]),height=Number(sizeMatch[2]);
              sf.state.printJobs.push({id:sf.makeId('PJOB'),printerProfileId:recipe.printerProfileId,artworkId:line.artworkId||'',artworkTitle:line.artworkTitle||'',width,height,printedArea:width*height,quantity:qty,mediaType:recipe.inkMediaType||'',quality:'Standard',coverageClass:'Typical',orderId:o.id,createdAt:new Date().toISOString()});
            }
          }
        }
      }
      st.materialsDeducted=true;
      save(o.testMode?'TEST order — production marked complete, no real materials deducted':'Production complete — raw materials deducted');
    });
    document.querySelectorAll('[data-save-extras]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.saveExtras, line=lineByKey(key), st=o.lineState[key];
      const extra=Math.max(0,Number(sf.$(`pwExtraQty-${key}`).value)||0);
      const waste=Math.max(0,Number(sf.$(`pwWasteQty-${key}`).value)||0);
      const additional=extra+waste;
      if(!o.testMode){
        if(extra>0){
          const match=this.resolveInventoryMatch(line);
          if(match.item)this.setInventoryOnHand(match.item,this.getInventoryOnHand(match.item)+extra);
          else sf.state.inventoryItems.push({id:sf.makeId('STOCK'),artworkId:line.artworkId,artworkTitle:line.productName,sku:line.sku,quantity:extra,createdAt:new Date().toISOString()});
        }
        if(additional>0){
          // Extras and waste both consumed real paper/materials/ink to produce -- only extras
          // add to Finished Inventory, but the material and ink cost applies to everything
          // actually printed, waste included, matching the "11 printed, 9 usable" accounting
          // from the original design.
          if(!st.manualMaterials){
            const recipe=this.recipeFor(line);
            if(recipe)this.consumeRecipeMaterials(recipe,additional);
            if(recipe?.printerProfileId){
              const sizeMatch=String(line.productName||'').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
              if(sizeMatch){
                sf.state.printJobs=Array.isArray(sf.state.printJobs)?sf.state.printJobs:[];
                const width=Number(sizeMatch[1]),height=Number(sizeMatch[2]);
                sf.state.printJobs.push({id:sf.makeId('PJOB'),printerProfileId:recipe.printerProfileId,artworkId:line.artworkId||'',artworkTitle:line.artworkTitle||'',width,height,printedArea:width*height,quantity:additional,mediaType:recipe.inkMediaType||'',quality:'Standard',coverageClass:'Typical',jobType:waste>0&&extra===0?'waste':undefined,orderId:o.id,createdAt:new Date().toISOString()});
              }
            }
          }
        }
      }
      st.extrasHandled=true;
      const parts=[];
      if(extra>0)parts.push(`${extra} extra added to finished inventory`);
      if(waste>0)parts.push(`${waste} recorded as waste`);
      save(o.testMode?'TEST order — extras/waste step skipped, no real inventory or materials changed':(parts.length?parts.join(', '):'No extras or waste'));
    });

    if(sf.$('pwAllToPackage'))sf.$('pwAllToPackage').onclick=()=>{o.pwStage='package';save('All lines ready — moved to packaging');};
    if(sf.$('pwToShip'))sf.$('pwToShip').onclick=()=>{o.pwStage='ship';save('Packaged');};
    if(sf.$('pwPrintLabel'))sf.$('pwPrintLabel').onclick=()=>{o.deliveryMethod=sf.$('pwShipMethod').value;o.tracking=sf.$('pwTracking').value;alert('Shipping label sent to printer.');save('Shipping label printed');};
    if(sf.$('pwMarkDelivered'))sf.$('pwMarkDelivered').onclick=()=>{
      if(o.pwStage==='complete')return; // guard: never fulfill twice
      o.deliveryMethod=sf.$('pwShipMethod').value;
      o.tracking=sf.$('pwTracking').value;
      if(!o.testMode){
        // 4. fulfillment: decrease on-hand AND reserved together, exactly once.
        physicalLines.forEach(line=>{
          const st=o.lineState[this.lineKey(line)];
          if(st?.reservation&&st.reservation.reservationStatus==='reserved'){
            const item=sf.state.inventoryItems.find(i=>i.id===st.reservation.inventoryItemId);
            if(item){
              this.setInventoryOnHand(item,this.getInventoryOnHand(item)-st.reservation.reservedQuantity);
              item.reserved=Math.max(0,this.getInventoryReserved(item)-st.reservation.reservedQuantity);
            }
            st.reservation.reservationStatus='fulfilled';
          }
        });
      }
      o.deliveryStatus='Delivered';
      o.deliveredAt=new Date().toISOString();
      o.pwStage='complete';
      o.status='Fulfilled';
      if(!o.salesTransactionId&&!o.testMode){
        sf.state.salesTransactions=Array.isArray(sf.state.salesTransactions)?sf.state.salesTransactions:[];
        const payState=String(o.paymentState||'').toUpperCase();
        const txn={id:sf.makeId('SALE'),customerId:o.customerId||'',customerName:o.customerName||'Website customer',saleSource:'Website',websiteOrderId:o.id,total:Number(o.total||0),soldAt:o.deliveredAt,orderStatus:payState==='PAID'?'Paid in Full':payState==='PARTIALLY_PAID'?'Partially Paid':payState||'Completed',createdAt:new Date().toISOString()};
        sf.state.salesTransactions.push(txn);
        o.salesTransactionId=txn.id;
      }
      save(o.testMode?'TEST order marked delivered — no real inventory or revenue was affected':'Marked delivered');
      C.refreshOrderAttention?.();
    };
  },

  // ---- production batches page (uses the real Materials/Recipes system) -----------------------
  batches(){
    this.ensure();
    const sf=window.SF, s=sf.state;
    s.productionBatches=(s.productionBatches||[]).map(b=>({status:'Completed',...b})); // older batches predate the queue step -- treat as already completed
    /* g150/g151: TWO CASES, ONE RULE. Kirk prints art cards for a friend from the friend's images, and
   he prints a customer's own portraits from a shoot. In the first the photograph is not his; in the
   second it is his but the prints are not — either way the paper and ink ARE his and must be
   tracked, while the finished prints are NOT stock and must never reach Finished Inventory.
   g150 called this "not my artwork", which is only true of the friend's job. The rule is about
   whose STOCK it is, not whose photograph, so the purpose is named for that. */
const purposes=['Market','Gallery','Website Stock','Wholesale','Personal Prints','Client Job (not for my stock)'];
    const templates=s.inventoryProductTemplates.filter(t=>t.active!==false);
    const catalog=sf.artworkCatalog?sf.artworkCatalog():[];
    const printers=s.printerProfiles||[];
    const queued=s.productionBatches.filter(b=>b.status==='Queued');
    const completed=s.productionBatches.filter(b=>b.status==='Completed');
    sf.$('workspace').innerHTML=`<div class="page-stack">
      <section class="dashboard-hero"><div><div class="section-kicker">PRODUCTION</div><h2>Print Production</h2><p>Plan a print run for a market, gallery, personal, or wholesale order. Queue what needs printing, print it, then confirm when it's done -- that's the right moment to record any waste, since you won't know that until after you've actually printed.</p></div></section>
      <section class="card">
        <h3>Plan a Print Run</h3>
        <div class="form-grid">
          <label>Purpose<select id="pbPurpose">${purposes.map(p=>`<option>${p}</option>`).join('')}</select></label>
          <label>Printer<select id="pbPrinter">${printers.map(p=>`<option value="${p.id}">${sf.esc(p.name)}</option>`).join('')||'<option value="">No printers set up -- set one up in Printers &amp; Ink for ink tracking</option>'}</select></label>
          <label>Media type<select id="pbMedia"><option>Luster Paper</option><option>Metallic Luster Paper</option><option>Card Stock</option><option>Canvas</option><option>Other</option></select></label>
          <label>Coverage<select id="pbCoverage"><option value="Typical">Typical Photo</option><option value="Light">Light Coverage</option><option value="Dark">Dark / High Coverage</option></select></label>
        </div>
        <p class="muted">Printer and media apply to this whole run -- if you're printing very different things (e.g. a mix of canvas and paper), it's simplest to plan them as separate runs so ink tracking stays accurate per printer/media.</p>
        <div class="form-grid">
          <label>Artwork<select id="pbArtwork"><option value="">-- Select --</option><option value="__custom__">Not a catalogue piece \u2014 a client's image or a shoot photo</option>${catalog.map(a=>`<option value="${sf.esc(a.id||a.artworkId)}">${sf.esc(a.title||'Untitled')}</option>`).join('')}<option value="__custom__">Other / Test print / No specific artwork</option></select></label>
          <label>Product &amp; Size<select id="pbProduct">${templates.map(t=>`<option value="${t.id}">${sf.esc(t.name)} ${sf.esc(t.size?`(${t.size})`:'')}</option>`).join('')}</select></label>
          <label>Quantity<input id="pbQty" type="number" min="1" value="1"></label>
          <label>Whose image / what for<input id="pbCustomLabel" placeholder="e.g. Dave's harbour shot, or Henderson wedding 8x10s"></label>
        </div>
        <div class="form-grid">
          <label>Bill this run to<select id="pbJob">
            <option value="">Nobody \u2014 this is my own printing</option>
            ${(s.serviceJobs||[]).slice().reverse().slice(0,40).map(j=>`<option value="${sf.esc(j.id)}">${sf.esc(j.customerName||'Client')} \u2014 ${sf.esc(j.type||'Job')}${j.date?` (${sf.esc(String(j.date).slice(0,10))})`:''}</option>`).join('')}
          </select></label>
        </div>
        <p class="help">Printing for someone who is paying you \u2014 a friend's cards, a client's shoot prints \u2014
        belongs to a job under Sales &amp; Orders &rarr; Services. Pick it here and what this run COSTS in
        materials and ink is added to that job's expenses when you mark it printed, so the job's profit is
        the real one. Postage is not something StudioFlow can know: add that to the job yourself.</p>
        <button class="button secondary" id="pbAddLine">＋ Add to List</button>
        <div id="pbLines" class="pw-batch-lines">${(this._draftBatch||[]).map((l,i)=>`<div class="pw-batch-line"><span>${sf.esc(l.qty)} × ${sf.esc(l.artworkTitle)} — ${sf.esc(l.productName)}${l.size?` (${sf.esc(l.size)})`:''}</span><button data-remove-line="${i}" class="button danger">Remove</button></div>`).join('')||'<div class="empty-state">No lines added yet.</div>'}</div>
        ${(this._draftBatch||[]).length?this.batchMaterialsPreview(this._draftBatch):''}
        <button class="button primary" id="pbQueue" ${this._draftBatch?.length?'':'disabled'}>Queue for Printing</button>
      </section>
      ${queued.length?`<section class="card"><h3>Queued -- Ready to Print</h3>${queued.map(b=>`<div class="pw-batch-row"><span><b>${sf.esc(b.purpose)}</b> · ${new Date(b.createdAt).toLocaleDateString()}</span><span>${b.lines.reduce((n,l)=>n+l.qty,0)} planned</span><span class="row-actions"><button class="button secondary" data-print-list="${b.id}">Printable List</button><button class="button primary" data-confirm-printed="${b.id}">Confirm Printing Done</button><button class="mini-edit danger" data-delete-batch="${b.id}">Cancel</button></span></div>`).join('')}</section>`:''}
      <section class="card">
        <h3>Completed</h3>
        ${completed.length?completed.slice().reverse().slice(0,10).map(b=>{
          const jobCount=s.printJobs.filter(j=>j.productionBatchId===b.id).length;
          return `<div class="pw-batch-row"><span><b>${sf.esc(b.purpose)}</b> · ${new Date(b.completedAt||b.createdAt).toLocaleDateString()}</span><span>${b.lines.reduce((n,l)=>n+l.qty,0)} units${b.lines.some(l=>l.waste)?` <small class="danger-text">(+${b.lines.reduce((n,l)=>n+(l.waste||0),0)} waste)</small>`:''}</span><span><small class="${jobCount?'':'muted'}">${jobCount?`✓ ${jobCount} print job(s) logged for ink tracking`:(b.printerId?'No print jobs logged (size missing on a product)':'No printer selected -- ink not tracked')}</small></span><button class="mini-edit danger" data-delete-batch="${b.id}">Delete &amp; Reverse</button></div>`;
        }).join(''):'<div class="empty-state">No completed print runs yet.</div>'}
      </section>
    </div>`;

    document.querySelectorAll('[data-delete-batch]').forEach(b=>b.onclick=()=>this.deleteBatch(b.dataset.deleteBatch));
    document.querySelectorAll('[data-print-list]').forEach(b=>b.onclick=()=>this.showPrintableList(b.dataset.printList));
    document.querySelectorAll('[data-confirm-printed]').forEach(b=>b.onclick=()=>this.confirmBatchPrinted(b.dataset.confirmPrinted));
    sf.$('pbAddLine').onclick=()=>{
      const artId=sf.$('pbArtwork').value, tplId=sf.$('pbProduct').value, tpl=templates.find(t=>t.id===tplId), qty=Math.max(1,Number(sf.$('pbQty').value)||1);
      if(!artId)return alert('Select an artwork (or "Other / Test print / No specific artwork") first.');
      const art=artId==='__custom__'?null:catalog.find(a=>String(a.id||a.artworkId)===artId);
      this._draftBatch=this._draftBatch||[];
      /* g150: a client job is labelled with WHOSE image it is, so a print history a year from now
         still says "Dave's harbour shot" rather than "Other / Unassigned". */
      const custom=String(sf.$('pbCustomLabel')?.value||'').trim();
      this._draftBatch.push({artworkId:artId,
        artworkTitle:artId==='__custom__'?(custom||'Client print (not a catalogue piece)'):(art?.title||'Untitled'),
        templateId:tplId,productName:tpl?.name||'Product',size:tpl?.size||'',qty});
      if(sf.$('pbCustomLabel'))sf.$('pbCustomLabel').value='';
      this.batches();
    };
    document.querySelectorAll('[data-remove-line]').forEach(b=>b.onclick=()=>{this._draftBatch.splice(Number(b.dataset.removeLine),1);this.batches();});
    if(sf.$('pbQueue'))sf.$('pbQueue').onclick=()=>{
      const lines=this._draftBatch||[];
      if(!lines.length)return;
      const batch={id:sf.makeId('BATCH'),purpose:sf.$('pbPurpose').value,serviceJobId:sf.$('pbJob')?.value||'',printerId:sf.$('pbPrinter')?.value||'',media:sf.$('pbMedia')?.value||'',coverage:sf.$('pbCoverage')?.value||'Typical',lines,status:'Queued',createdAt:new Date().toISOString()};
      s.productionBatches.push(batch);
      this._draftBatch=[];
      sf.persist();
      sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>Queued for Printing</h2><p class="muted">Nothing's been deducted yet -- that happens when you confirm printing is done. Want a printable list of what to print?</p><div class="row-actions"><button class="button secondary" id="qSkip">No List Needed</button><button class="button primary" id="qList">Show Printable List</button></div></div></div>`;
      sf.$('qSkip').onclick=()=>{sf.closeModal();this.batches()};
      sf.$('qList').onclick=()=>{sf.closeModal();this.showPrintableList(batch.id)};
    };
  },
  showPrintableList(batchId){
    const sf=window.SF, s=sf.state;
    const b=s.productionBatches.find(x=>x.id===batchId);
    if(!b)return;
    const printer=s.printerProfiles.find(p=>p.id===b.printerId);
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide" id="printableListCard"><h2>Print This List</h2><div id="printableListBody" class="printable-list"><h1>Print Run -- ${sf.esc(b.purpose)}</h1><p>${new Date(b.createdAt).toLocaleDateString()}${printer?` · ${sf.esc(printer.name)}`:''}${b.media?` · ${sf.esc(b.media)}`:''}</p><table><thead><tr><th>Qty</th><th>Size</th><th>Artwork</th><th>Product</th></tr></thead><tbody>${b.lines.map(l=>`<tr><td>${l.qty}</td><td>${sf.esc(l.size||'--')}</td><td>${sf.esc(l.artworkTitle)}</td><td>${sf.esc(l.productName)}</td></tr>`).join('')}</tbody></table></div><div class="row-actions"><button class="button secondary" id="plClose">Close</button><button class="button primary" id="plPrint">Print</button></div></div></div>`;
    sf.$('plClose').onclick=()=>sf.closeModal();
    sf.$('plPrint').onclick=()=>{
      const w=window.open('','_blank');
      w.document.write(`<html><head><title>Print Run -- ${b.purpose}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #999;padding:8px;text-align:left}</style></head><body>${sf.$('printableListBody').innerHTML}</body></html>`);
      w.document.close();
      w.print();
    };
  },
  confirmBatchPrinted(batchId){
    const sf=window.SF, s=sf.state;
    const b=s.productionBatches.find(x=>x.id===batchId);
    if(!b)return;
    // The right moment for waste -- after printing has actually happened, not guessed at when
    // the run was planned.
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Confirm Printing Done</h2><p class="muted">For each item, confirm how many came out good versus wasted (misprints, errors). Materials and ink are deducted for everything printed; only good units are added to Finished Inventory.</p><div id="confirmLines">${b.lines.map((l,i)=>`<div class="pw-batch-line"><span>${sf.esc(l.artworkTitle)} — ${sf.esc(l.productName)}${l.size?` (${sf.esc(l.size)})`:''}</span><span>Good <input type="number" min="0" class="cfGood" data-idx="${i}" value="${l.qty}" style="width:60px"></span><span>Waste <input type="number" min="0" class="cfWaste" data-idx="${i}" value="0" style="width:60px"></span></div>`).join('')}</div><div class="row-actions"><button class="button secondary" id="cfCancel">Cancel</button><button class="button primary" id="cfConfirm">Confirm &amp; Deduct Materials</button></div></div></div>`;
    sf.$('cfCancel').onclick=()=>sf.closeModal();
    sf.$('cfConfirm').onclick=async()=>{
      document.querySelectorAll('.cfGood').forEach(input=>{
        const i=Number(input.dataset.idx);
        b.lines[i].qty=Math.max(0,Number(input.value)||0);
      });
      document.querySelectorAll('.cfWaste').forEach(input=>{
        const i=Number(input.dataset.idx);
        b.lines[i].waste=Math.max(0,Number(input.value)||0);
      });
      await this.completeBatch(b);
      sf.closeModal();
      this.batches();
    };
  },
  async completeBatch(b){
    const sf=window.SF, s=sf.state;
    const lines=b.lines;
    s.printJobs=Array.isArray(s.printJobs)?s.printJobs:[];
    // Capture exactly what will be deducted BEFORE deducting it, so the completion report can
    // show real numbers rather than just repeating the line list.
    const materialTotals=new Map();
    lines.forEach(l=>{
      const recipe=(s.productRecipes||[]).find(r=>String(r.templateId)===String(l.templateId));
      if(!recipe)return;
      const totalQty=l.qty+(l.waste||0);
      [...this.materialsCheckFor(recipe,totalQty),...this.packagingCheckFor(recipe)].forEach(c=>{
        const cur=materialTotals.get(c.materialId)||{name:c.name,used:0};
        cur.used+=c.need;
        materialTotals.set(c.materialId,cur);
      });
    });
    const inventorySummary=[];
    const clientJob=/^Client Job/.test(String(b.purpose||''));
    lines.forEach(l=>{
      const recipe=(s.productRecipes||[]).find(r=>String(r.templateId)===String(l.templateId));
      const totalQty=l.qty+(l.waste||0);
      // Materials/ink consumed for everything actually attempted -- waste included -- but
      // only the good, sellable units below go into Finished Inventory.
      this.consumeRecipeMaterials(recipe,totalQty);
      const isCustom=l.artworkId==='__custom__';
      /* g150 — A CLIENT JOB IS NOT STOCK. A friend's art cards, or a customer's prints from a
         portrait or wedding shoot: either way the run consumes his paper and his ink, so the
         materials above and the print jobs below are recorded exactly as for any other run. What
         must NOT happen is the prints landing in Finished Inventory — they are spoken for, and
         stock he cannot sell would flow into the Pack List, the Production Plan's "have" column
         and every stock flag on Business Intelligence.
         NOTE the OTHER path: when the shoot has a real order in StudioFlow, fulfil it through
         Print Production's order flow instead, which reserves and then releases the stock. This
         purpose is for printing with no order behind it. */
      /* g152 — ONE RULE FOR BOTH, at Kirk's instruction: "Client prints and this print job should
         look the same. They use stock, but never end up as inventory."
         A CLIENT JOB and a NON-CATALOGUE line (`__custom__` — a portrait or wedding print, a
         friend's image) are the same thing from the shelf's point of view: they eat raw materials
         and they are already spoken for. Neither may ever become Finished Inventory.

         THIS ALSO CLOSES A REAL BUG. A custom line used to be PUSHED into inventoryItems here and
         only ever removed again by the fulfilment step — and that step decrements only lines
         carrying a RESERVATION, which a custom line can never have (Produce New is its only
         option). So every portrait-session print ever produced left a phantom stock row behind for
         good, feeding the Pack List, the plan's "have" column and the stock flags with prints that
         went out the door months ago. Not adding it is the fix. */
      if(clientJob||isCustom){
        inventorySummary.push(`${l.qty} × ${l.artworkTitle} — ${l.productName} (materials and ink recorded — not added to your stock, these are already spoken for)`);
        return;
      }
      let inv=s.inventoryItems.find(i=>String(i.templateId)===String(l.templateId)&&(isCustom?!i.artworkId:String(i.artworkId)===String(l.artworkId)));
      if(inv)this.setInventoryOnHand(inv,this.getInventoryOnHand(inv)+l.qty);
      else s.inventoryItems.push({id:sf.makeId('STOCK'),templateId:l.templateId,artworkId:isCustom?'':l.artworkId,artworkTitle:l.artworkTitle,quantity:l.qty,createdAt:new Date().toISOString()});
      inventorySummary.push(`${l.qty} × ${l.artworkTitle} — ${l.productName}${l.waste?` (+${l.waste} waste, materials consumed but not added to inventory)`:''}${recipe?'':' (no recipe -- raw materials not tracked for this line)'}`);
    });
    // Create a print job per line, same event that consumed materials -- printing genuinely
    // happened here, so a print job record should exist automatically rather than requiring a
    // duplicate manual entry in Print Jobs.
    const skippedJobs=[];
    if(b.printerId&&window.SFInkCostEngine){
      lines.forEach(l=>{
        const m=String(l.size||'').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
        if(!m){skippedJobs.push(l.productName);return}
        const width=Number(m[1]),height=Number(m[2]),totalQty=l.qty+(l.waste||0);
        s.printJobs.push({id:sf.makeId('PJOB'),printerProfileId:b.printerId,artworkId:l.artworkId==='__custom__'?'':l.artworkId,artworkTitle:l.artworkTitle,width,height,printedArea:width*height,quantity:totalQty,mediaType:b.media,quality:'Standard',coverageClass:b.coverage,jobType:l.waste>0&&l.qty===0?'waste':undefined,productionBatchId:b.id,createdAt:new Date().toISOString()});
      });
    }

    /* ==========================================================================================
       g152 — WHAT THIS RUN COST, PUT AGAINST THE JOB THAT IS PAYING FOR IT.
       ==========================================================================================
       Kirk: "I'll be paid for printing and shipping my friends work as well…so there is some
       revenue." A client job now has BOTH sides. The revenue is a service job under Sales &
       Orders; g150 recorded the materials and ink but attached them to nothing, so that job's
       profit was the fee with no cost against it — the printing looked free.

       Materials come from the recipe (which is what "cost" means everywhere else in StudioFlow, so
       one definition). Ink is added ONLY when the ink engine can actually price it — a printer
       profile with a calibrated estimate for that paper and quality. When it cannot, the expense
       says materials only rather than quietly presenting a partial figure as the whole cost.

       WASTE IS INCLUDED. He paid for the sheets he ruined; the job that caused them carries them.

       IT CANNOT DOUBLE-COUNT: each batch id is recorded in j.printCostLog and a second attempt
       for the same batch is refused. `j.expenses` is a single NUMBER on the job — this ADDS to it
       rather than replacing, so anything he typed himself survives, and the log is what makes the
       total explainable a year later.
       ========================================================================================== */
    let billed=null;
    const job=b.serviceJobId?(s.serviceJobs||[]).find(x=>String(x.id)===String(b.serviceJobId)):null;
    if(job){
      if(!Array.isArray(job.printCostLog))job.printCostLog=[];
      if(job.printCostLog.some(e=>String(e.batchId)===String(b.id))){
        billed={already:true};
      }else{
        let materials=0, ink=0, inkPriced=true;
        lines.forEach(l=>{
          const totalQty=l.qty+(l.waste||0);
          materials+=(Number(window.MaterialsService?.recipeCost?.(l.templateId))||0)*totalQty;
        });
        const jobsForBatch=s.printJobs.filter(x=>String(x.productionBatchId)===String(b.id));
        if(!jobsForBatch.length)inkPriced=false;
        jobsForBatch.forEach(pj=>{
          const c=window.SFInkCostEngine?.estimateJobCost?.(pj);
          if(c==null){inkPriced=false;return}
          ink+=Number(c)||0;
        });
        const total=Math.round((materials+(inkPriced?ink:0))*100)/100;
        if(total>0){
          const label=`Printing \u2014 ${lines.reduce((n,l)=>n+l.qty,0)} item(s)${inkPriced?' (materials and ink)':' (materials only \u2014 ink not costed for this printer/paper yet)'}`;
          job.printCostLog.push({batchId:b.id,label,amount:total,materials:Math.round(materials*100)/100,
            ink:inkPriced?Math.round(ink*100)/100:null,at:new Date().toISOString()});
          job.expenses=Math.round(((Number(job.expenses)||0)+total)*100)/100;
          billed={total,label,job,inkPriced};
        }else{
          billed={none:true};
        }
      }
    }
    b.status='Completed';
    b.completedAt=new Date().toISOString();
    sf.logActivity?.(`Print run completed: ${lines.reduce((n,l)=>n+l.qty,0)} units for ${b.purpose}`);
    await sf.persist();
    const materialRows=[...materialTotals.values()];
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Print Run Complete</h2>
      <h3>Raw Materials Deducted</h3>${materialRows.length?`<ul class="pw-materials">${materialRows.map(m=>`<li class="pw-ok">${sf.esc(m.name)}: ${Math.round(m.used*100)/100} used</li>`).join('')}</ul>`:'<p class="muted">No raw materials were deducted -- none of these products had a recipe set up.</p>'}
      <h3>Added to Finished Inventory</h3><ul class="pw-materials">${inventorySummary.map(x=>`<li class="pw-ok">✓ ${sf.esc(x)}</li>`).join('')}</ul>
      <h3>Print Jobs</h3>${b.printerId?(skippedJobs.length<lines.length?`<p class="muted">${lines.length-skippedJobs.length} print job(s) logged for ink calibration.</p>`:'')+(skippedJobs.length?`<p class="danger-text">${skippedJobs.join(', ')} skipped -- no size on file to calculate printed area from.</p>`:''):'<p class="muted">No printer was selected for this run, so no print jobs were logged.</p>'}
      ${billed?`<h3>Billed to the job</h3>${
        billed.already?'<p class="muted">This run was already charged to that job \u2014 nothing added twice.</p>'
        :billed.none?'<p class="muted">Nothing could be costed: none of these products has a recipe yet, so no expense was added.</p>'
        :`<p class="pw-ok">${sf.esc(this.money?this.money(billed.total):'$'+billed.total.toFixed(2))} added to
          <b>${sf.esc(billed.job.customerName||'the job')} \u2014 ${sf.esc(billed.job.type||'Job')}</b>.
          ${sf.esc(billed.label)}.</p>
          <p class="help">Postage is not something StudioFlow can know \u2014 add what you actually paid to ship it
          as an expense on that job, and its profit is then the real one.</p>`
      }`:''}
      <p class="muted">This is committed -- check Materials &amp; Sheet Cutting for updated raw stock, or Inventory for the new finished items.</p>
      <div class="row-actions"><button class="button primary" id="pbCompleteClose">Close</button></div></div></div>`;
    sf.$('pbCompleteClose').onclick=()=>{sf.closeModal();this.batches()};
  },
};

(function(){
  const tryWire=()=>{if(window.SFCommerceHub)window.SFCommerceHub.openOrderWorkspace=function(id){window.SFProductionWorkspace.render(id);};};
  tryWire();
  document.addEventListener('DOMContentLoaded',tryWire);
})();
