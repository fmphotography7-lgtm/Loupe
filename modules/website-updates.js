/* StudioFlow 3.8.2 · Website Updates
   One central approval queue for anything that would change the live Squarespace store:
   price changes, product removals/restorations, new variants, inventory availability. Nothing
   here ever calls Squarespace directly -- it only ever produces records that a human approves,
   then either exports as CSV or (where the API supports it) applies explicitly. Detect
   automatically, organize automatically, notify automatically, publish only with approval. */
window.SFWebsiteUpdates = {

  STATUSES:['Pending','Approved','Exported','Applying','Applied','Ignored','Failed','Cancelled'],
  CATEGORIES:{
    UPDATE_PRICE:'Price Changes', REMOVE_VARIANT:'Product Removals', REMOVE_PRODUCT:'Product Removals',
    ADD_VARIANT:'New Products and Variants', ADD_PRODUCT:'New Products and Variants',
    RESTORE_VARIANT:'Restored Products', UPDATE_PRODUCT:'Product Information Changes',
    UPDATE_INVENTORY:'Website Inventory Changes',
  },

  ensure(){
    const sf=window.SF, s=sf.state;
    s.websiteUpdates=Array.isArray(s.websiteUpdates)?s.websiteUpdates:[];
  },

  // Dedup key: same local product/variant + same action + (for price changes) same field being
  // changed. A second edit before approval updates the existing pending record instead of piling
  // up duplicates -- the requested value moves, the original previousValue is preserved.
  dedupKey(u){return [u.localProductId||'',u.squarespaceVariantId||u.sku||u.variantKey||'',u.action,u.field||''].join('::')},

  create(fields){
    this.ensure();
    const sf=window.SF, s=sf.state;
    const key=this.dedupKey(fields);
    const existing=s.websiteUpdates.find(u=>u.status==='Pending'&&this.dedupKey(u)===key);
    if(existing){
      existing.requestedValue=fields.requestedValue;
      existing.updatedAt=new Date().toISOString();
      (existing.audit=existing.audit||[]).push({at:new Date().toISOString(),action:'Updated (duplicate edit before approval)',previousValue:fields.previousValue,newValue:fields.requestedValue});
      return existing;
    }
    // Respect a previously Ignored update for the exact same change -- without this, re-running
    // Compare StudioFlow to Website would resurrect the same dismissed item every time, since it
    // only checked for a matching Pending record, never an Ignored one.
    const ignored=s.websiteUpdates.find(u=>u.status==='Ignored'&&this.dedupKey(u)===key&&String(u.requestedValue)===String(fields.requestedValue));
    if(ignored)return ignored;
    const u={
      id:sf.makeId('WU'), action:fields.action, category:this.CATEGORIES[fields.action]||'Product Information Changes',
      localProductId:fields.localProductId||'', squarespaceProductId:fields.squarespaceProductId||'',
      squarespaceVariantId:fields.squarespaceVariantId||'', sku:fields.sku||'', productName:fields.productName||'Product', variantKey:fields.variantKey||'', newVariantMedium:fields.newVariantMedium||'', newVariantSize:fields.newVariantSize||'', price:fields.price!=null?fields.price:null,
      field:fields.field||'', previousValue:fields.previousValue, requestedValue:fields.requestedValue,
      createdAt:new Date().toISOString(), approvedAt:null, exportedAt:null, appliedAt:null, ignoredAt:null,
      status:'Pending', error:'', source:fields.source||'website_pricing', removalSnapshot:fields.removalSnapshot||null,
      audit:[{at:new Date().toISOString(),action:'Created',previousValue:fields.previousValue,newValue:fields.requestedValue}],
    };
    s.websiteUpdates.push(u);
    return u;
  },

  // Product removal supersedes any pending price change on the same variant -- never export both.
  supersedeForRemoval(localProductId,variantKey){
    this.ensure();
    const sf=window.SF;
    sf.state.websiteUpdates.filter(u=>u.status==='Pending'&&u.localProductId===localProductId&&(u.squarespaceVariantId||u.sku)===variantKey&&u.action==='UPDATE_PRICE')
      .forEach(u=>{u.status='Cancelled';(u.audit=u.audit||[]).push({at:new Date().toISOString(),action:'Cancelled (superseded by removal)'})});
  },

  counts(){
    this.ensure();
    const s=window.SF.state;
    const by=st=>s.websiteUpdates.filter(u=>u.status===st).length;
    return {pending:by('Pending'),approved:by('Approved'),exported:by('Exported'),applied:by('Applied'),failed:by('Failed')};
  },
  waitingCount(){const c=this.counts();return c.pending+c.approved+c.exported},

  approve(id){this.ensure();const u=window.SF.state.websiteUpdates.find(x=>x.id===id);if(!u||u.status!=='Pending')return;u.status='Approved';u.approvedAt=new Date().toISOString();(u.audit=u.audit||[]).push({at:u.approvedAt,action:'Approved'})},
  ignore(id){this.ensure();const u=window.SF.state.websiteUpdates.find(x=>x.id===id);if(!u)return;u.status='Ignored';u.ignoredAt=new Date().toISOString();(u.audit=u.audit||[]).push({at:u.ignoredAt,action:'Ignored'})},
  // Genuinely removes an update -- for a mistaken price change, a failed attempt you don't want
  // to retry, or clearing clutter. Different from Ignore, which keeps a record but hides it from
  // the active queue; this deletes it outright. Does not touch the underlying price you already
  // typed into Website Pricing -- only removes the pending/failed update record itself.
  delete(id){this.ensure();const s=window.SF.state;s.websiteUpdates=s.websiteUpdates.filter(u=>u.id!==id)},
  approveAll(){this.ensure();window.SF.state.websiteUpdates.filter(u=>u.status==='Pending').forEach(u=>this.approve(u.id))},
  clearCompleted(){this.ensure();const s=window.SF.state;s.websiteUpdates=s.websiteUpdates.filter(u=>!['Applied','Ignored','Cancelled'].includes(u.status))},

  // Can this update be pushed to the live store directly through the Squarespace API?
  canApiApply(u){
    if(!u||u.status!=='Approved')return false;
    if(u.action==='UPDATE_PRICE')return !!(u.squarespaceProductId&&u.squarespaceVariantId);
    if(u.action==='REMOVE_VARIANT')return !!(u.squarespaceProductId&&u.squarespaceVariantId);
    if(u.action==='RESTORE_VARIANT')return !!(u.removalSnapshot&&u.removalSnapshot.squarespaceProductId&&u.removalSnapshot.attributes);
    if(u.action==='UPDATE_INVENTORY')return !!u.squarespaceVariantId;
    if(u.action==='ADD_VARIANT')return !!this.addVariantPlan(u);
    if(u.action==='ADD_PRODUCT'){const p=this.createProductPlan(u);return !!(p&&!p.blocked);}
    return false;
  },
  // Work out how to create a NEW variant on the live product: which Squarespace product it belongs
  // to, and the option attributes to send. We learn the product's real option names (e.g. Size,
  // Material) from an existing sibling variant so the new one matches its structure. Returns null
  // when we can't do that safely (piece not mapped to a live product, or no sibling to learn from) --
  // those fall back to CSV rather than risking a malformed API call.
  addVariantPlan(u){
    const sf=window.SF;
    if(!u||u.action!=='ADD_VARIANT')return null;
    const art=(sf.state.artworks||[]).find(a=>String(a.id)===String(u.localProductId)||String(a.artworkId)===String(u.localProductId))||(sf.artworkCatalog?sf.artworkCatalog().find(a=>String(a.id)===String(u.localProductId)||String(a.artworkId)===String(u.localProductId)):null);
    const liveVariant=(art?.products||[]).find(p=>p.productId||p.squarespaceProductId);
    const productId=u.squarespaceProductId||art?.productId||art?.squarespaceProductId||(art?.squarespace?.productIds||[])[0]||liveVariant?.productId||liveVariant?.squarespaceProductId||'';
    if(!productId)return null;
    const prod=(sf.state.websiteProducts||[]).find(p=>String(p.id||p.productId)===String(productId));
    const variants=prod?(prod.variants||prod.items||[]):[];
    const sibling=Array.isArray(variants)?variants.find(v=>v&&v.attributes&&typeof v.attributes==='object'&&Object.keys(v.attributes).length):null;
    const keys=sibling?Object.keys(sibling.attributes):[];
    if(!keys.length)return null;
    const size=u.newVariantSize||'', medium=u.newVariantMedium||'';
    const attributes={};
    for(const k of keys){
      if(/size|dimension/i.test(k))attributes[k]=size;
      else if(/material|type|medium|paper|finish|print|substrate|format/i.test(k))attributes[k]=medium;
      else attributes[k]=sibling.attributes[k];
    }
    if(size&&!Object.values(attributes).includes(size)){if(keys.length===1)attributes[keys[0]]=size;else return null;}
    // Match against the site's COMBINED "size \u00b7 medium - qualifier" option names.
    const norm=v=>String(v==null?'':v).trim().toLowerCase();
    const normSize=x=>String(x||'').toLowerCase().replace(/[^0-9x]/g,'');
    const hasMat=x=>/\bmat|matt/i.test(String(x||''));
    const stripToMed=o=>String(o||'').toLowerCase().replace(/\d+\s*[x\u00d7]\s*\d+/g,' ').replace(/[\u00b7\u2013\u2014+-]/g,' ').replace(/\bmatted\b|\bmatt\b|\bmat\b|print only|printonly/g,' ').replace(/\s+/g,' ').trim();
    const medKey=o=>stripToMed(o).split(' ').filter(w=>w.length>2).sort().join(' ');
    const optOf=v=>(v&&v.attributes&&typeof v.attributes==='object')?Object.values(v.attributes).filter(Boolean).join(' \u00b7 '):'';
    const wantSize=normSize(size),wantMed=medKey(medium),wantMat=hasMat(medium);
    const sizeKey=keys.find(k=>/size|dimension/i.test(k))||(keys.length===1?keys[0]:null);
    // g69 OPTION-VOCABULARY MAP -- the second half of the live-site regression. On products where
    // size and material are SEPARATE dropdowns, the attribute loop above writes StudioFlow's LOCAL
    // wording ("Luster Paper + Mat") into the Material option, but the site already offers
    // "Luster Paper - Matted". Squarespace then treats it as a BRAND NEW option value, so the new
    // sizes appear under a duplicate material instead of joining the existing one (Botanical Sky).
    // Before writing anything, match each value we're about to send against the values that already
    // exist on that product and reuse the site's own spelling. Same idea as the g44/g51 combined-
    // option work below, applied to the split-option branch it never covered.
    const valuesFor=k=>{const out=[];for(const v of variants){const val=v&&v.attributes&&v.attributes[k];const t=val==null?'':String(val).trim();if(t&&!out.includes(t))out.push(t);}return out;};
    const sizeNorm=x=>String(x||'').toLowerCase().replace(/[\u00d7\u2715]/g,'x').replace(/[^0-9x]/g,'');
    const siteSizeValue=(k,want)=>{const w=sizeNorm(want);if(!w)return null;return valuesFor(k).find(val=>sizeNorm(val)===w)||null;};
    // Exact medium word-set + same mat-ness, so "Luster Paper" never collapses onto "Metallic Luster Paper".
    const siteMedValue=(k,want)=>{const w=medKey(want);if(!w)return null;const m=hasMat(want);const vals=valuesFor(k);
      // Second tier: an option that names two materials ("Canvas/Metal") matches if one of its
      // slash-separated parts is exactly this medium. Exact match always wins first.
      return vals.find(val=>medKey(val)===w&&hasMat(val)===m)||vals.find(val=>hasMat(val)===m&&String(val).split('/').some(part=>medKey(part)===w))||null;};
    const mapped={};
    if(keys.length>1){
      for(const k of keys){
        const before=attributes[k];
        if(!before)continue;
        let hit=null;
        if(/size|dimension/i.test(k))hit=siteSizeValue(k,before);
        else if(/material|type|medium|paper|finish|print|substrate|format/i.test(k))hit=siteMedValue(k,before);
        // No hit on a material means the site genuinely has no equivalent yet -- a derived medium
        // like "Canvas with Floating Frame". Kirk approved that wording as-is at g62, so leave it
        // alone rather than forcing it onto the base medium's spelling.
        if(hit&&hit!==before){attributes[k]=hit;mapped[k]={from:before,to:hit};}
      }
    }
    // Existing-variant detection: strict per-attribute match, else combined-option match
    // (size + EXACT medium word-set + same mat-ness). Exact set so "Luster Paper" never matches "Metallic Luster Paper".
    let existing=null;
    if(sizeKey)existing=variants.find(v=>v&&v.attributes&&norm(v.attributes[sizeKey])===norm(attributes[sizeKey]||size)&&(keys.length<2||keys.every(k=>k===sizeKey||norm(v.attributes[k])===norm(attributes[k]))));
    if(!existing&&wantSize)existing=variants.find(v=>{const o=optOf(v);return o&&normSize(o).includes(wantSize)&&medKey(o)===wantMed&&hasMat(o)===wantMat});
    if(existing)return {productId,exists:true,existingVariantId:String(existing.id||existing.variantId||''),existingSku:existing.sku||'',attributes,mapped};
    // Genuinely new -> unique SKU.
    const usedSkus=new Set(variants.map(v=>norm(v&&v.sku)).filter(Boolean));
    let sku=u.sku||sf.skuFor(art&&art.title,u.newVariantMedium,u.newVariantSize)||('SKU-'+u.id);
    if(usedSkus.has(norm(sku))){let n=2;while(usedSkus.has(norm(`${sku}-${n}`)))n++;sku=`${sku}-${n}`;}
    // Combined-option products: copy the site's exact wording from a same-medium sibling, swap the size,
    // so the new variant reads e.g. "11 x 14 \u00b7 Luster Paper - Matted" (site style), not "+ Mat".
    if(keys.length===1){
      const combined=variants.some(v=>/[\u00b7\u2013\u2014]|-\s*(matted|print)/i.test(optOf(v)));
      if(combined){
        const twin=variants.find(v=>{const o=optOf(v);return o&&medKey(o)===wantMed&&hasMat(o)===wantMat});
        if(twin)attributes[keys[0]]=optOf(twin).replace(/\d+\s*[x\u00d7]\s*\d+/i,size);
        else{
          // No sibling of this exact medium on the site -- which is always the case the first time a
          // derived medium (e.g. "Canvas with Floating Frame") is pushed. Fall back to a sibling of
          // the BASE medium and append what this medium adds, so the option still reads in the
          // site's own wording: "24 x 36 \u00b7 Canvas/Metal with Floating Frame".
          const baseMed=u.baseVariantMedium||'',suffix=u.optionSuffix||'';
          const baseKey=medKey(baseMed),baseMat=hasMat(baseMed);
          const baseTwin=baseMed&&suffix?variants.find(v=>{const o=optOf(v);return o&&medKey(o)===baseKey&&hasMat(o)===baseMat}):null;
          if(baseTwin)attributes[keys[0]]=optOf(baseTwin).replace(/\d+\s*[x\u00d7]\s*\d+/i,size)+suffix;
          else return null;
        }
      }
    }
    return {productId,attributes,price:u.price!=null?u.price:undefined,sku,mapped};
  },
  // ---- g80 OPTION-NAME REPAIR -----------------------------------------------------------------
  // The other half of the live-site regression. Before g69, pushes wrote StudioFlow's LOCAL medium
  // wording into products whose Material is its own dropdown, so Botanical Sky ended up offering
  // both "Luster Paper - Matted" (the site's own) and "Luster Paper + Mat" (ours) as separate
  // options. This finds values that mean the SAME thing and folds the duplicates onto one spelling.
  optionNameScan(){
    const sf=window.SF,prods=sf.state.websiteProducts||[];
    if(!prods.length)return {blocked:'No products have been synced yet. Run Website Sync Products first, then try again.'};
    const norm=v=>String(v==null?'':v).trim().toLowerCase();
    const sizeNorm=x=>String(x||'').toLowerCase().replace(/[\u00d7\u2715]/g,'x').replace(/[^0-9x]/g,'');
    const hasMat=x=>/\bmat|matt/i.test(String(x||''));
    const stripToMed=o=>String(o||'').toLowerCase().replace(/\d+\s*[x\u00d7]\s*\d+/g,' ').replace(/[\u00b7\u2013\u2014+-]/g,' ').replace(/\bmatted\b|\bmatt\b|\bmat\b|print only|printonly/g,' ').replace(/\s+/g,' ').trim();
    const medKey=o=>stripToMed(o).split(' ').filter(w=>w.length>2).sort().join(' ');
    const groups=[];
    for(const p of prods){
      const pid=String(p.id||p.productId||'');
      const variants=(p.variants||p.items||[]).filter(v=>v&&v.attributes&&Object.keys(v.attributes).length);
      if(variants.length<2)continue;
      const keys=Object.keys(variants[0].attributes);
      for(const k of keys){
        const isSize=/size|dimension/i.test(k);
        const isMed=/material|type|medium|paper|finish|print|substrate|format/i.test(k);
        // On a single combined option ("11 x 14 · Luster Paper - Matted") the size is part of the
        // value, so it must be part of the identity too or different sizes would be folded together.
        const combined=keys.length===1;
        if(!combined&&!isSize&&!isMed)continue;
        const identity=val=>combined?`${sizeNorm(val)}|${medKey(val)}|${hasMat(val)}`
          :isSize?sizeNorm(val):`${medKey(val)}|${hasMat(val)}`;
        const buckets={};
        for(const v of variants){
          const val=v.attributes[k];
          if(val==null||!String(val).trim())continue;
          const id=identity(val);
          if(!id||id==='|'||id==='|false')continue;
          (buckets[id]=buckets[id]||{}) ;
          (buckets[id][String(val)]=buckets[id][String(val)]||[]).push(v);
        }
        for(const [,spellings] of Object.entries(buckets)){
          const names=Object.keys(spellings);
          if(names.length<2)continue;   // one spelling = nothing to fold
          // Most-used spelling wins: the site's original sits on far more variants than the handful
          // StudioFlow added. Ties break alphabetically, which favours the spaced house spelling
          // ("20 x 40" over "20x40"). Every row is listed individually so a wrong call can simply
          // be left unticked.
          names.sort((a,b)=>spellings[b].length-spellings[a].length||a.localeCompare(b));
          const keep=names[0];
          const rows=[];
          for(const name of names.slice(1)){
            for(const v of spellings[name]){
              const want={...v.attributes,[k]:keep};
              // Renaming onto a combination that already exists would collide, so that variant has
              // to be removed instead -- it is a genuine duplicate of one already on the product.
              const clash=variants.find(o=>o!==v&&keys.every(kk=>norm(o.attributes[kk])===norm(want[kk])));
              rows.push({
                productId:pid,product:p.name||p.title||'Untitled',
                variantId:String(v.id||v.variantId||''),
                option:Object.values(v.attributes).filter(Boolean).join(' / '),
                from:name,to:keep,key:k,attributes:want,
                action:clash?'delete':'rename',
                clashOption:clash?Object.values(clash.attributes).filter(Boolean).join(' / '):''
              });
            }
          }
          if(rows.length)groups.push({productId:pid,product:p.name||p.title||'Untitled',key:k,keep,rows});
        }
      }
    }
    groups.sort((a,b)=>a.product.localeCompare(b.product)||a.key.localeCompare(b.key));
    return {groups,total:groups.reduce((n,g)=>n+g.rows.length,0)};
  },
  openOptionNameRepair(){
    const sf=window.SF;
    const scan=this.optionNameScan();
    if(scan.blocked)return alert(scan.blocked);
    if(!scan.total)return alert('Nothing to fold — every product on your store uses one spelling per option value.');
    const rows=[];scan.groups.forEach(g=>g.rows.forEach(r=>rows.push(r)));
    this._optionRows=rows;
    let html='',lastProduct='';
    rows.forEach((r,i)=>{
      if(r.product!==lastProduct){html+=`<h3 style="margin:12px 0 4px">${sf.esc(r.product)}</h3>`;lastProduct=r.product;}
      html+=r.action==='rename'
        ? `<label class="checkline"><input type="checkbox" class="on-pick" data-i="${i}" checked> ${sf.esc(r.option)} — <b>${sf.esc(r.from)}</b> → <b>${sf.esc(r.to)}</b></label>`
        : `<label class="checkline"><input type="checkbox" class="on-pick" data-i="${i}"> ${sf.esc(r.option)} — <span class="danger-text">DELETE</span>: renaming would collide with the existing <b>${sf.esc(r.clashOption)}</b>, so this one is a duplicate. Left unticked on purpose.</label>`;
    });
    const deletes=rows.filter(r=>r.action==='delete').length;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Fix Option Names</h2>
      <p class="muted">${rows.length} option value(s) duplicate a spelling your store already uses. Folding them puts the affected sizes back under your existing dropdown entry instead of a second one. ${deletes?`${deletes} of these can't be renamed — the correct combination already exists, so the duplicate would have to be DELETED. Those are unticked; tick one only if you're sure.`:''} Nothing changes until you press Apply, and StudioFlow re-reads your store afterwards to confirm.</p>
      <div class="row-actions"><button type="button" class="button secondary" id="onAll">Tick all renames</button><button type="button" class="button secondary" id="onNone">Untick all</button></div>
      <div style="max-height:44vh;overflow:auto;margin:10px 0">${html}</div>
      <div class="row-actions"><button type="button" class="button secondary" id="onCancel">Cancel</button><button type="button" class="button primary" id="onApply">Apply to Ticked</button></div>
    </div></div>`;
    const picks=()=>[...document.querySelectorAll('.on-pick')];
    sf.$('onAll').onclick=()=>picks().forEach(c=>{if(rows[Number(c.dataset.i)].action==='rename')c.checked=true;});
    sf.$('onNone').onclick=()=>picks().forEach(c=>c.checked=false);
    sf.$('onCancel').onclick=()=>sf.closeModal();
    sf.$('onApply').onclick=()=>this.applyOptionNameRepair(picks().filter(c=>c.checked).map(c=>rows[Number(c.dataset.i)]));
  },
  async applyOptionNameRepair(picked){
    const sf=window.SF;
    if(!picked.length)return alert('Nothing is ticked.');
    const renames=picked.filter(r=>r.action==='rename'),deletes=picked.filter(r=>r.action==='delete');
    if(!confirm(`Apply to your live Squarespace store?\n\n${renames.length} option name(s) folded onto your existing wording${deletes.length?`\n${deletes.length} duplicate variant(s) DELETED — this cannot be undone`:''}\n\nPrices and stock are not touched.`))return;
    const btn=sf.$('onApply');if(btn){btn.disabled=true;btn.textContent='Applying…';}
    const byProduct={};
    renames.forEach(r=>(byProduct[r.productId]=byProduct[r.productId]||[]).push(r));
    let done=0;const problems=[];
    for(const [productId,list] of Object.entries(byProduct)){
      const result=await sf.api.squarespaceRenameVariantOptions({productId,changes:list.map(r=>({variantId:r.variantId,attributes:r.attributes}))});
      if(!result?.ok){
        const log=(result?.attempts||[]).map(a=>`${a.shape}: ${a.result}`).join('; ');
        problems.push(`${list[0].product}: ${result?.error||'refused'}${log?` (${log})`:''}`);
        continue;
      }
      done+=(result.confirmed||[]).length;
      for(const u of (result.unconfirmed||[])){
        const row=list.find(r=>r.variantId===u.variantId);
        problems.push(`${row?`${row.product} — ${row.option}`:u.variantId}: ${u.error}`);
      }
    }
    let deleted=0;
    for(const r of deletes){
      const res=await sf.api.squarespaceRemoveVariant({productId:r.productId,variantId:r.variantId});
      if(res?.ok)deleted++;else problems.push(`${r.product} — ${r.option}: ${res?.error||'could not be deleted'}`);
    }
    sf.closeModal();
    sf.logActivity(`Option-name repair: ${done} renamed, ${deleted} duplicate variant(s) removed${problems.length?`, ${problems.length} problem(s)`:''}`);
    await sf.persist();sf.render();
    const detail=problems.length?`\n\nProblems (${problems.length}):\n`+problems.slice(0,12).join('\n')+(problems.length>12?`\n…and ${problems.length-12} more.`:''):'';
    alert(`${done} option name(s) confirmed folded onto your existing wording${deleted?`, ${deleted} duplicate variant(s) removed`:''}.${detail}\n\nRun Website Sync Products, then check the Material dropdown on Squarespace.`);
  },

  // ---- g72 SOLD-OUT REPAIR --------------------------------------------------------------------
  // The comparison in compare() only ever looked at PRICE and at variants missing from the site.
  // It has never looked at stock, so the variants StudioFlow created before g69 -- all of them
  // finite 0, i.e. unbuyable -- would sit there forever without anything queueing them. This scans
  // the last sync for finite-stock variants and flips them to unlimited in bulk.
  soldOutScan(){
    const sf=window.SF,s=sf.state;
    const inv=s.websiteInventory||[],prods=s.websiteProducts||[];
    if(!inv.length)return {blocked:'No inventory has been synced yet. Run Website Sync Products first, then try again.'};
    // variantId -> {product, option} so the preview names things the way the store does.
    const where={};
    const limitedProductIds=new Set();
    for(const p of prods){
      const pid=String(p.id||p.productId||'');
      for(const v of (p.variants||p.items||[])){
        const vid=String(v.id||v.variantId||'');
        if(!vid)continue;
        where[vid]={productId:pid,product:p.name||p.title||'Untitled',option:(v.attributes?Object.values(v.attributes).filter(Boolean).join(' / '):'')||v.sku||vid};
      }
    }
    // A limited edition is the one case where finite stock is CORRECT, so never tick those by
    // default -- flipping a numbered edition to unlimited would be a real mistake.
    for(const a of (s.artworks||[])){
      if(!a.isLimitedEdition)continue;
      const ids=[a.productId,a.squarespaceProductId,...((a.squarespace?.productIds)||[]),...((a.products||[]).map(p=>p.productId||p.squarespaceProductId))];
      ids.filter(Boolean).forEach(id=>limitedProductIds.add(String(id)));
    }
    const rows=[];
    for(const r of inv){
      const unlimited=r.isUnlimited===true||r.unlimited===true;
      if(unlimited)continue;
      const vid=String(r.variantId||r.id||'');
      if(!vid)continue;
      const w=where[vid]||{};
      rows.push({
        variantId:vid,productId:w.productId||'',
        product:w.product||r.descriptor||'(product not in the last sync)',
        option:w.option||r.sku||vid,
        quantity:Number(r.quantity||0),
        limited:limitedProductIds.has(String(w.productId||''))
      });
    }
    rows.sort((a,b)=>a.product.localeCompare(b.product)||a.option.localeCompare(b.option));
    return {rows,limitedCount:rows.filter(r=>r.limited).length};
  },
  openSoldOutRepair(){
    const sf=window.SF;
    const scan=this.soldOutScan();
    if(scan.blocked)return alert(scan.blocked);
    if(!scan.rows.length)return alert('Nothing to repair -- every variant on your store is already set to unlimited stock.');
    const rows=scan.rows;
    this._soldOutRows=rows;
    const list=rows.map((r,i)=>`<label class="checkline"><input type="checkbox" class="so-pick" data-i="${i}" ${r.limited?'':'checked'}> <b>${sf.esc(r.product)}</b> — ${sf.esc(r.option)}${r.limited?' <span class="danger-text">(limited edition — left unticked on purpose)</span>':''}</label>`).join('');
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Fix Sold Out Variants</h2>
      <p class="muted">${rows.length} variant(s) on your store have a finite stock count, so customers see them as Sold Out. Ticking one sets it to unlimited, which is what a made-to-order print should be. Nothing is changed until you press Apply. This list comes from your last Website Sync Products — run a sync first if the store has changed since, or if an earlier repair attempt didn't take.${scan.limitedCount?` ${scan.limitedCount} belong to limited-edition pieces and are left unticked — finite stock is correct for those.`:''}</p>
      <div class="row-actions"><button type="button" class="button secondary" id="soAll">Tick all</button><button type="button" class="button secondary" id="soNone">Untick all</button></div>
      <div style="max-height:46vh;overflow:auto;margin:10px 0">${list}</div>
      <div class="row-actions"><button type="button" class="button secondary" id="soCancel">Cancel</button><button type="button" class="button primary" id="soApply">Apply to Ticked</button></div>
    </div></div>`;
    const picks=()=>[...document.querySelectorAll('.so-pick')];
    sf.$('soAll').onclick=()=>picks().forEach(c=>c.checked=true);
    sf.$('soNone').onclick=()=>picks().forEach(c=>c.checked=false);
    sf.$('soCancel').onclick=()=>sf.closeModal();
    sf.$('soApply').onclick=()=>this.applySoldOutRepair(picks().filter(c=>c.checked).map(c=>rows[Number(c.dataset.i)]));
  },
  async applySoldOutRepair(picked){
    const sf=window.SF;
    if(!picked.length)return alert('Nothing is ticked.');
    if(!confirm(`Set ${picked.length} variant(s) to unlimited stock on your live Squarespace store?\n\nThis changes stock only — no prices, no option names, nothing is deleted.\n\nStudioFlow will re-read your store afterwards and tell you how many actually changed.`))return;
    const btn=sf.$('soApply');if(btn){btn.disabled=true;btn.textContent='Applying…';}
    const result=await sf.api.squarespaceSetUnlimitedStock({variants:picked.map(r=>({productId:r.productId,variantId:r.variantId}))});
    sf.closeModal();
    if(!result?.ok){
      const log=(result?.attempts||[]).map(a=>`• ${a.shape}\n   ${a.result}`).join('\n');
      alert(`The repair could not run.\n\n${result?.error||'Squarespace refused the request.'}\n\n${log?`StudioFlow tried each known way of asking, on one variant:\n${log}\n\nSend this text to Claude — it names exactly what Squarespace objected to.`:''}`);
      return;
    }
    const byId={};picked.forEach(r=>byId[r.variantId]=r);
    const name=id=>byId[id]?`${byId[id].product} — ${byId[id].option}`:id;
    if(!result.verified){
      alert(`The changes were sent, but StudioFlow could not re-read your store to confirm them${result.verifyError?`:\n${result.verifyError}`:'.'}\n\nCheck one product on Squarespace before assuming it worked, then run Website Sync Products.`);
      return;
    }
    const confirmed=result.confirmed||[],unconfirmed=result.unconfirmed||[];
    // Only mark the ones Squarespace actually confirms -- so a failed row is offered again next run
    // instead of quietly disappearing from the list.
    for(const id of confirmed){
      const row=(sf.state.websiteInventory||[]).find(x=>String(x.variantId||x.id)===String(id));
      if(row){row.isUnlimited=true;row.unlimited=true;}
    }
    sf.logActivity(`Sold-out repair: ${confirmed.length} of ${result.attempted} variant(s) confirmed unlimited on Squarespace`);
    await sf.persist();sf.render();
    const detail=unconfirmed.length?`\n\nStill not unlimited (${unconfirmed.length}):\n`+unconfirmed.slice(0,12).map(f=>`• ${name(f.variantId)}: ${f.error}`).join('\n')+(unconfirmed.length>12?`\n…and ${unconfirmed.length-12} more.`:''):'';
    alert(`${confirmed.length} of ${result.attempted} variant(s) are confirmed unlimited on your store.${detail}\n\n${confirmed.length?'Run Website Sync Products to pull the fresh state back in.':'Nothing changed — tell me what the errors above say.'}`);
  },

  // ---- g70 NEW PRODUCT ----------------------------------------------------------------------
  // Work out how to create a brand-new product on Squarespace for a piece that has never been on
  // the site. We can't copy option wording from the product itself (it doesn't exist yet), so we
  // copy it from a TEMPLATE product already on the store: its option NAMES (Size / Material) and
  // its option VALUES vocabulary. That way a new piece is born speaking the site's own language
  // instead of StudioFlow's, which is the mistake that caused the g69 duplicate-option mess.
  productTemplates(){
    const sf=window.SF;
    const out=[];
    for(const p of (sf.state.websiteProducts||[])){
      const vs=p.variants||p.items||[];
      if(!Array.isArray(vs)||!vs.length)continue;
      const withAttrs=vs.filter(v=>v&&v.attributes&&typeof v.attributes==='object'&&Object.keys(v.attributes).length);
      if(!withAttrs.length)continue;
      out.push({id:String(p.id||p.productId||''),name:p.name||p.title||'Untitled product',storePageId:p.storePageId||'',variants:withAttrs,count:withAttrs.length});
    }
    return out.sort((a,b)=>b.count-a.count);
  },
  storePages(){
    const groups={};
    for(const t of this.productTemplates()){
      if(!t.storePageId)continue;
      (groups[t.storePageId]=groups[t.storePageId]||{storePageId:t.storePageId,products:[]}).products.push(t);
    }
    return Object.values(groups).sort((a,b)=>b.products.length-a.products.length);
  },
  // The old blocked message always blamed missing variants, which was wrong (and confusing) for
  // the common case: the piece has never been pushed, so there is no PRODUCT at all.
  addVariantBlockReason(u){
    const sf=window.SF;
    const art=(sf.state.artworks||[]).find(a=>String(a.id)===String(u.localProductId)||String(a.artworkId)===String(u.localProductId));
    const liveVariant=(art?.products||[]).find(p=>p.productId||p.squarespaceProductId);
    const productId=u.squarespaceProductId||art?.productId||art?.squarespaceProductId||(art?.squarespace?.productIds||[])[0]||liveVariant?.productId||liveVariant?.squarespaceProductId||'';
    if(!productId)return 'This piece isn\u2019t on Squarespace yet, so there is no product to add a size to. Create it as a new product first \u2014 then StudioFlow can add the rest of the sizes normally.';
    const prod=(sf.state.websiteProducts||[]).find(p=>String(p.id||p.productId)===String(productId));
    if(!prod)return 'Linked to a Squarespace product StudioFlow can\u2019t see. Run Website Sync Products, then Re-link to Live Squarespace.';
    return 'That product has no existing variant to copy the option wording from, so StudioFlow can\u2019t tell how your options are named. Add one variant by hand on Squarespace, then sync.';
  },
  createProductPlan(u){
    const sf=window.SF;
    if(!u||u.action!=='ADD_PRODUCT')return null;
    const art=(sf.state.artworks||[]).find(a=>String(a.id)===String(u.localProductId)||String(a.artworkId)===String(u.localProductId));
    if(!art)return {blocked:'This piece no longer exists in StudioFlow.'};
    const templates=this.productTemplates().filter(t=>t.storePageId);
    if(!templates.length)return {blocked:'StudioFlow doesn\u2019t know your store yet. Run Website Sync Products first, so it can see which page your prints live on and how your size and material options are worded.'};
    const chosen=(u.templateProductId&&templates.find(t=>t.id===String(u.templateProductId)))||templates[0];
    const sibling=chosen.variants[0];
    const keys=Object.keys(sibling.attributes);

    const norm=v=>String(v==null?'':v).trim().toLowerCase();
    const sizeNorm=x=>String(x||'').toLowerCase().replace(/[\u00d7\u2715]/g,'x').replace(/[^0-9x]/g,'');
    const hasMat=x=>/\bmat|matt/i.test(String(x||''));
    const stripToMed=o=>String(o||'').toLowerCase().replace(/\d+\s*[x\u00d7]\s*\d+/g,' ').replace(/[\u00b7\u2013\u2014+-]/g,' ').replace(/\bmatted\b|\bmatt\b|\bmat\b|print only|printonly/g,' ').replace(/\s+/g,' ').trim();
    const medKey=o=>stripToMed(o).split(' ').filter(w=>w.length>2).sort().join(' ');
    const optOf=v=>(v&&v.attributes)?Object.values(v.attributes).filter(Boolean).join(' \u00b7 '):'';
    const valuesFor=k=>{const out=[];for(const v of chosen.variants){const t=v.attributes&&v.attributes[k]!=null?String(v.attributes[k]).trim():'';if(t&&!out.includes(t))out.push(t);}return out;};
    const siteSize=(k,want)=>{const w=sizeNorm(want);return w?(valuesFor(k).find(v=>sizeNorm(v)===w)||null):null;};
    // Some option values name two materials at once ("Canvas/Metal"). An exact word-set match fails
    // there, so fall back to matching one slash-separated PART exactly -- precise enough that
    // "Luster Paper" still never lands on "Metallic Luster Paper".
    const partMed=(v,w,m)=>hasMat(v)===m&&String(v).split('/').some(part=>medKey(part)===w);
    const siteMed=(k,want)=>{const w=medKey(want);if(!w)return null;const m=hasMat(want);const vals=valuesFor(k);return vals.find(v=>medKey(v)===w&&hasMat(v)===m)||vals.find(v=>partMed(v,w,m))||null;};

    const rows=[],skipped=[],mapped=[];
    const seen=new Set(),usedSkus=new Set();
    for(const p of (art.products||[])){
      const tpl=(sf.state.productTemplates||[]).find(t=>String(t.id)===String(p.mediumId));
      const size=p.size||'',medium=p.medium||tpl?.name||p.mediumId||'';
      let price=Number(p.price);
      if(!(price>0)&&window.SFPricing?.priceFor){const alt=Number(window.SFPricing.priceFor(art,p.mediumId,p.size));if(alt>0)price=alt;}
      if(!(price>0)){skipped.push(`${size} ${medium}`.trim()+' \u2014 no price set');continue;}
      const attributes={};
      if(keys.length===1){
        // One combined option ("11 x 14 \u00b7 Luster Paper - Matted"). Copy a same-medium twin's
        // exact wording and swap the size in, so we inherit the site's punctuation and spelling.
        const wm=medKey(medium),wmat=hasMat(medium);
        const twin=chosen.variants.find(v=>{const o=optOf(v);return o&&medKey(o)===wm&&hasMat(o)===wmat;})
                 ||chosen.variants.find(v=>{const o=optOf(v);return o&&hasMat(o)===wmat&&String(o).split('/').some(part=>medKey(part)===wm);});
        attributes[keys[0]]=twin?optOf(twin).replace(/\d+\s*[x\u00d7]\s*\d+/i,size):`${size} \u00b7 ${medium}`;
      }else{
        for(const k of keys){
          if(/size|dimension/i.test(k)){const hit=siteSize(k,size);if(hit&&hit!==size)mapped.push({from:size,to:hit});attributes[k]=hit||size;}
          else if(/material|type|medium|paper|finish|print|substrate|format/i.test(k)){const hit=siteMed(k,medium);if(hit&&hit!==medium)mapped.push({from:medium,to:hit});attributes[k]=hit||medium;}
          else attributes[k]=sibling.attributes[k];
        }
      }
      const sig=keys.map(k=>norm(attributes[k])).join('|||');
      if(seen.has(sig))continue;
      seen.add(sig);
      let sku=p.sku||sf.skuFor(art.title,medium,size)||`SKU-${art.id}-${rows.length+1}`;
      if(usedSkus.has(norm(sku))){let n=2;while(usedSkus.has(norm(`${sku}-${n}`)))n++;sku=`${sku}-${n}`;}
      usedSkus.add(norm(sku));
      rows.push({attributes,sku,price,size,medium,mediumId:p.mediumId||'',option:Object.values(attributes).filter(Boolean).join(' / ')});
    }
    if(!rows.length)return {blocked:'None of this piece\u2019s sizes have a price yet, so there is nothing to create. Set prices in Website Pricing first \u2014 StudioFlow will not put a $0 product on your live store.'};
    // Dedupe the mapping note without pulling in a helper that may not exist here.
    const seenMap=new Set(),mapNotes=[];
    for(const m of mapped){const k=m.from+'\u2192'+m.to;if(!seenMap.has(k)){seenMap.add(k);mapNotes.push(m);}}
    return {
      storePageId:chosen.storePageId, templateProductId:chosen.id, templateName:chosen.name,
      name:art.title||'Untitled', description:art.description||art.story||'',
      variantAttributes:keys, variants:rows, mapped:mapNotes, skipped,
      image:art.image||art.imagePath||art.imageData||''
    };
  },
  async applyAddProduct(id,skipConfirm=false){
    this.ensure();
    const sf=window.SF, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    const plan=this.createProductPlan(u);
    if(!plan||plan.blocked){alert(`StudioFlow can\u2019t create this product yet.\n\n${u.productName}\n\n${plan?plan.blocked:'No plan could be worked out for this piece.'}`);return;}
    if(!skipConfirm&&!confirm(`Create this as a NEW product on your live Squarespace store?\n\n${plan.name}\n${plan.variants.length} variant(s), wording copied from "${plan.templateName}"\n\nIt is created HIDDEN so you can check it before anyone can see it. Make it visible on Squarespace once you're happy.`))return;
    u.status='Applying';(u.audit=u.audit||[]).push({at:new Date().toISOString(),action:'Creating product via API'});
    await sf.persist();this.render();
    const result=await sf.api.squarespaceCreateProduct({
      storePageId:plan.storePageId,name:plan.name,description:plan.description,
      variantAttributes:plan.variantAttributes,
      variants:plan.variants.map(v=>({attributes:v.attributes,sku:v.sku,price:v.price})),
      currency:sf.state.business?.currency||'CAD',isVisible:false
    });
    const now=new Date().toISOString();
    if(!result?.ok){
      u.status='Failed';u.error=result?.error||'Squarespace refused the new product.';
      (u.audit=u.audit||[]).push({at:now,action:'Create failed',newValue:u.error});
      sf.logActivity(`Failed to create ${u.productName} on Squarespace: ${u.error}`);
      await sf.persist();sf.render();return;
    }
    const prod=result.product||{};
    const productId=String(prod.id||prod.productId||'');
    // Link every created variant back onto the piece, matched by SKU, so the piece is properly
    // mapped from this moment on and later size additions take the normal ADD_VARIANT path.
    const art=(sf.state.artworks||[]).find(a=>String(a.id)===String(u.localProductId)||String(a.artworkId)===String(u.localProductId));
    if(art){
      const made=prod.variants||[];
      for(const row of plan.variants){
        const live=made.find(v=>String(v.sku||'').toLowerCase()===row.sku.toLowerCase());
        const pv=(art.products||[]).find(p=>String(p.size||'')===String(row.size)&&String(p.medium||p.mediumId||'')===String(row.medium));
        if(!pv)continue;
        pv.productId=productId;pv.squarespaceProductId=productId;pv.sku=pv.sku||row.sku;pv.source='Squarespace';
        if(live){const vid=String(live.id||live.variantId||'');if(vid){pv.variantId=vid;pv.squarespaceVariantId=vid;}}
      }
      art.productId=art.productId||productId;art.squarespaceProductId=productId;
    }
    let imageNote='';
    if(plan.image){
      const up=await sf.api.squarespaceUploadProductImage({productId,image:plan.image,filename:`${(plan.name||'artwork').replace(/[^\w\-]+/g,'-')}.jpg`});
      imageNote=up?.ok?' Image uploaded.':` Image did NOT upload: ${up?.error||'unknown error'} \u2014 add it by hand on Squarespace.`;
    }else imageNote=' No image was saved on this piece, so none was uploaded.';
    u.status='Applied';u.appliedAt=now;u.error='';u.squarespaceProductId=productId;
    (u.audit=u.audit||[]).push({at:now,action:`Created on Squarespace (hidden) with ${plan.variants.length} variant(s).${imageNote}`});
    sf.logActivity(`Created ${plan.name} on Squarespace as a hidden product with ${plan.variants.length} variant(s)`);
    await sf.persist();sf.render();
    alert(`Created "${plan.name}" on Squarespace with ${plan.variants.length} variant(s).${imageNote}\n\nIt is HIDDEN. Open it on Squarespace, check the image and wording, then make it visible.`);
  },

  // Approve + push live in one step: approving IS the go-ahead, so applicable updates apply via API
  // immediately (no separate button, no CSV). Anything the API can't do stays Approved for CSV.
  async approveAndApply(id){
    this.approve(id);
    const u=window.SF.state.websiteUpdates.find(x=>x.id===id);
    if(u&&u.status==='Approved'&&this.canApiApply(u))await this.applyUpdate(id,true);
    else{await window.SF.persist();window.SF.render();}
  },
  async approveAllAndApply(){
    this.ensure();const sf=window.SF;
    sf.state.websiteUpdates.filter(u=>u.status==='Pending').forEach(u=>this.approve(u.id));
    await sf.persist();
    for(const u of sf.state.websiteUpdates.filter(x=>x.status==='Approved')){if(this.canApiApply(u))await this.applyUpdate(u.id,true);}
    await sf.persist();sf.render();
  },

  fieldLabel(u){
    if(u.action==='UPDATE_PRICE')return `Price<br>${window.SF.esc(String(u.previousValue))} → ${window.SF.esc(String(u.requestedValue))}`;
    if(u.action==='REMOVE_VARIANT'||u.action==='REMOVE_PRODUCT')return 'Remove Variant';
    if(u.action==='RESTORE_VARIANT'||u.action==='ADD_VARIANT')return 'Restore / Add Variant';
    if(u.action==='UPDATE_INVENTORY')return `Availability<br>${window.SF.esc(String(u.previousValue))} → ${window.SF.esc(String(u.requestedValue))}`;
    return window.SF.esc(u.field||'Product info');
  },

  // ---- CSV export (Approved only; generating the CSV moves them to Exported, not Applied) -----
  csv(){
    this.ensure();
    const sf=window.SF;
    const approved=sf.state.websiteUpdates.filter(u=>u.status==='Approved');
    const rows=[['Action','Product Name','SKU','Field','Previous Value','Requested Value','Local Product ID','Squarespace Product ID','Squarespace Variant ID']];
    approved.forEach(u=>rows.push([u.action,u.productName,u.sku,u.field,u.previousValue??'',u.requestedValue??'',u.localProductId,u.squarespaceProductId,u.squarespaceVariantId]));
    return {csv:rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n'),approved};
  },
  async exportCsv(){
    this.ensure();
    const sf=window.SF;
    const {csv,approved}=this.csv();
    if(!approved.length)return alert('No approved updates to export. Approve at least one update first.');
    const savedPath=await sf.api.saveText({name:'StudioFlow-Squarespace-Approved-Updates.csv',text:csv});
    if(!savedPath)return; // user cancelled the save dialog -- nothing was written, so nothing should be marked Exported
    const now=new Date().toISOString();
    approved.forEach(u=>{u.status='Exported';u.exportedAt=now;(u.audit=u.audit||[]).push({at:now,action:'Exported to CSV'})});
    sf.logActivity(`Generated approved website update CSV (${approved.length} update${approved.length===1?'':'s'})`);
    await sf.persist();
    alert(`CSV saved to:\n${savedPath}\n\n${approved.length} approved update${approved.length===1?'':'s'} included. These are now marked Exported -- mark them Applied once you've confirmed the website update succeeded.`);
    this.render();
  },
  async markExportedApplied(){
    this.ensure();
    const sf=window.SF;
    const exported=sf.state.websiteUpdates.filter(u=>u.status==='Exported');
    if(!exported.length)return alert('No exported updates waiting to be confirmed.');
    const now=new Date().toISOString();
    exported.forEach(u=>{u.status='Applied';u.appliedAt=now;(u.audit=u.audit||[]).push({at:now,action:'Marked Applied'})});
    await sf.persist();
    this.render();
  },

  // ---- Compare StudioFlow to Website: differences become pending updates, never applied automatically
  compare(){
    this.ensure();
    const sf=window.SF, s=sf.state;
    const templates=(s.productTemplates||[]).filter(t=>t.status!=='discontinued'&&Array.isArray(t.sizes));
    const mappings=s.websiteProductMappings||{};
    let found=0;
    templates.forEach(t=>{
      (t.sizes||[]).forEach(size=>{
        const retail=Number(s.pricing?.standard?.[t.id]?.[size]||0);
        const mappedSku=`${t.id}-${size}`.toUpperCase().replace(/\s+/g,'');
        // Best-effort: compare against the last synced website product catalogue, if one exists.
        const webProduct=(s.websiteProducts||[]).find(p=>String(p.sku||'').toUpperCase()===mappedSku||String(p.name||'').toLowerCase().includes(String(t.name||'').toLowerCase())&&String(p.variant||'').includes(size));
        if(webProduct&&Number(webProduct.price||0)!==retail&&retail>0){
          this.create({action:'UPDATE_PRICE',field:'price',localProductId:t.id,squarespaceProductId:webProduct.productId,squarespaceVariantId:webProduct.variantId,sku:webProduct.sku,productName:`${t.name} (${size})`,previousValue:Number(webProduct.price||0).toFixed(2),requestedValue:retail.toFixed(2),source:'website_comparison'});
          found++;
        }
        if(!webProduct&&retail>0&&(s.websiteProducts||[]).length){
          this.create({action:'ADD_VARIANT',field:'availability',localProductId:t.id,productName:`${t.name} (${size})`,sku:mappedSku,previousValue:'Not on website',requestedValue:'Add to website',source:'website_comparison'});
          found++;
        }
      });
    });
    return found;
  },

  // ---- Website Updates workspace ---------------------------------------------------------
  render(){
    this.ensure();
    const sf=window.SF, s=sf.state;
    const groups={};
    s.websiteUpdates.filter(u=>!['Applied','Ignored','Cancelled'].includes(u.status)).forEach(u=>{(groups[u.category]=groups[u.category]||[]).push(u)});
    const order=['Product Removals','New Products and Variants','Price Changes','Product Information Changes','Website Inventory Changes','Restored Products','Failed Updates'];
    const failedList=s.websiteUpdates.filter(u=>u.status==='Failed');
    if(failedList.length)groups['Failed Updates']=failedList;
    const c=this.counts();

    const canApplyViaApi=u=>this.canApiApply(u);
    const card=u=>`<div class="wu-card"><div class="wu-card-head"><b>${sf.esc(u.productName)}</b><i class="stock-pill ${u.status==='Failed'?'danger':u.status==='Applied'?'success':u.status==='Exported'?'gold':'gold'}">${sf.esc(u.status)}</i></div><div class="wu-field">${this.fieldLabel(u)}</div><div class="wu-meta">SKU: ${sf.esc(u.sku||'—')} · Created ${new Date(u.createdAt).toLocaleDateString()}${u.action==='ADD_VARIANT'?(()=>{
   // Show exactly what will land on the site, so a new medium can be eyeballed before approving
   // rather than discovered afterwards. No plan means it cannot be applied at all.
   const p=this.addVariantPlan(u);
   const opt=p&&p.attributes?Object.values(p.attributes).filter(Boolean).join(' / '):'';
   // g69: say so when a value was snapped onto the site's existing wording, so the fix is visible
   // on the card rather than only discoverable on the live store after the fact.
   const mapNote=(()=>{const m=p&&p.mapped?Object.values(p.mapped):[];return m.length?`<div class="update-option-preview">Matched to your site's existing wording: ${m.map(x=>`${sf.esc(x.from)} → <b>${sf.esc(x.to)}</b>`).join(', ')}</div>`:'';})();
   return opt?`<div class="update-option-preview">Will create: <b>${sf.esc(opt)}</b> · in stock (unlimited)</div>${mapNote}`
    :`<div class="update-option-preview update-option-blocked">Can't be created yet — ${sf.esc(this.addVariantBlockReason(u))}</div>`;
  })():''}${u.action==='ADD_PRODUCT'?(()=>{
   // g70: show the whole new product before it is created -- which store page it lands on, whose
   // option wording it copies, and every variant. Nothing about a new product should be a surprise.
   const p=this.createProductPlan(u);
   if(!p||p.blocked)return `<div class="update-option-preview update-option-blocked">Can't be created yet — ${sf.esc(p?p.blocked:'no plan could be worked out for this piece.')}</div>`;
   const list=p.variants.map(v=>`${sf.esc(v.option)} — $${Number(v.price).toFixed(2)}`).join('<br>');
   const map=p.mapped.length?`<div class="update-option-preview">Matched to your site's existing wording: ${p.mapped.map(x=>`${sf.esc(x.from)} → <b>${sf.esc(x.to)}</b>`).join(', ')}</div>`:'';
   const skip=p.skipped.length?`<div class="update-option-preview update-option-blocked">Left out (${p.skipped.length}): ${sf.esc(p.skipped.join('; '))}</div>`:'';
   const img=p.image?'':`<div class="update-option-preview update-option-blocked">No image saved on this piece — the product will be created without one.</div>`;
   return `<div class="update-option-preview">Will create a NEW hidden product: <b>${sf.esc(p.name)}</b> · ${p.variants.length} variant(s) · option wording copied from <b>${sf.esc(p.templateName)}</b><br>${list}</div>${map}${skip}${img}`;
  })():''}${u.status==='Approved'&&u.action==='UPDATE_PRICE'&&!canApplyViaApi(u)?'<br><span class="danger-text">No matching Squarespace product found automatically.</span>':''}${u.error?`<br><span class="danger-text">${sf.esc(u.error)}</span>`:''}</div><div class="row-actions">${u.status==='Pending'?`<button class="button primary" data-approve-wu="${u.id}">Approve</button><button class="button secondary" data-ignore-wu="${u.id}">Ignore</button>`:''}${canApplyViaApi(u)?`<button class="button primary" data-apply-api="${u.id}">Apply to Squarespace Now</button>`:''}${u.status==='Failed'?`<button class="button primary" data-apply-api="${u.id}">Retry</button>`:''}${u.status==='Approved'&&u.action==='UPDATE_PRICE'?`<button class="button secondary" data-choose-sq="${u.id}">Choose Product</button><button class="button primary" data-bulk-sq="${u.id}">Apply to All Matching Products</button>`:''}<button class="button secondary" data-details-wu="${u.id}">Details</button><button class="button danger" data-delete-wu="${u.id}">Delete</button></div></div>`;

    sf.$('workspace').innerHTML=`<div class="page-stack">
      <section class="dashboard-hero"><div><div class="section-kicker">WEBSITE SYNC</div><h2>Website Updates</h2><p>Everything here is detected and organized automatically. Nothing changes on the live website until you approve it -- and approving pushes the change straight to your Squarespace store through the API. The CSV is only a fallback for the rare update the API can't do (like a brand-new product that isn't on the site yet).</p></div></section>
      <section class="card"><div class="commerce-kpis compact-kpis"><div><b>${c.pending}</b><span>Pending Approval</span></div><div><b>${c.approved}</b><span>Approved, Waiting Export</span></div><div><b>${c.exported}</b><span>Exported, Waiting Confirmation</span></div><div><b>${c.failed}</b><span>Failed</span></div></div>
      <div class="row-actions"><button class="button secondary" id="wuApproveAll" ${c.pending?'':'disabled'}>Approve All &amp; Apply</button><button class="button secondary" id="wuGenerateCsv">Generate Approved CSV</button><button class="button secondary" id="wuMarkApplied" ${c.exported?'':'disabled'}>Mark Exported Updates as Applied</button><button class="button secondary" id="wuCompare">Compare StudioFlow to Website</button><button class="button secondary" id="wuFixSoldOut">Fix Sold Out Variants</button><button class="button secondary" id="wuFixOptionNames">Fix Option Names</button><button class="button secondary" id="wuClear">Clear Completed</button></div></section>
      ${order.filter(cat=>groups[cat]?.length).map(cat=>`<section class="card"><h3>${sf.esc(cat)} <span class="muted">(${groups[cat].length})</span></h3><div class="wu-grid">${groups[cat].map(card).join('')}</div></section>`).join('')||'<section class="card"><div class="empty-state roomy">No pending website updates. StudioFlow will queue anything here automatically when a price changes, a product is removed or restored, or a comparison finds a difference.</div></section>'}
    </div>`;

    sf.$('wuApproveAll').onclick=async()=>{if(!confirm('Approve all pending updates and push everything the API supports to your live Squarespace store now?'))return;await this.approveAllAndApply()};
    sf.$('wuGenerateCsv').onclick=()=>this.exportCsv();
    sf.$('wuMarkApplied').onclick=async()=>this.markExportedApplied();
    if(sf.$('wuFixSoldOut'))sf.$('wuFixSoldOut').onclick=()=>this.openSoldOutRepair();
    if(sf.$('wuFixOptionNames'))sf.$('wuFixOptionNames').onclick=()=>this.openOptionNameRepair();
    sf.$('wuCompare').onclick=async()=>{const n=this.compare();await sf.persist();window.SF.render();alert(n?`${n} difference${n===1?'':'s'} found and added to the pending queue.`:'No differences found. StudioFlow matches your last synced website catalogue.')};
    sf.$('wuClear').onclick=async()=>{this.clearCompleted();await sf.persist();window.SF.render()};
    document.querySelectorAll('[data-approve-wu]').forEach(b=>b.onclick=async()=>{await this.approveAndApply(b.dataset.approveWu)});
    document.querySelectorAll('[data-ignore-wu]').forEach(b=>b.onclick=async()=>{this.ignore(b.dataset.ignoreWu);await sf.persist();window.SF.render()});
    document.querySelectorAll('[data-details-wu]').forEach(b=>b.onclick=()=>this.details(b.dataset.detailsWu));
    document.querySelectorAll('[data-apply-api]').forEach(b=>b.onclick=()=>this.applyUpdate(b.dataset.applyApi));
    document.querySelectorAll('[data-choose-sq]').forEach(b=>b.onclick=()=>this.chooseSquarespaceProduct(b.dataset.chooseSq));
    document.querySelectorAll('[data-delete-wu]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this update? This cannot be undone. It will not change any price you already saved in Website Pricing -- it only removes this pending/failed update record.'))return;this.delete(b.dataset.deleteWu);await sf.persist();window.SF.render()});
    document.querySelectorAll('[data-bulk-sq]').forEach(b=>b.onclick=()=>this.bulkApplyPrice(b.dataset.bulkSq));
  },

  applyUpdate(id,skipConfirm=false){
    const sf=window.SF, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    if(u.action==='UPDATE_PRICE')return this.applyPriceUpdate(id,skipConfirm);
    if(u.action==='REMOVE_VARIANT')return this.applyRemoveVariant(id,skipConfirm);
    if(u.action==='ADD_VARIANT')return this.applyAddVariant(id,skipConfirm);
    if(u.action==='ADD_PRODUCT')return this.applyAddProduct(id,skipConfirm);
    if(u.action==='RESTORE_VARIANT')return this.applyRestoreVariant(id,skipConfirm);
    if(u.action==='UPDATE_INVENTORY')return this.applyInventoryUpdate(id,skipConfirm);
  },

  async applyInventoryUpdate(id,skipConfirm=false){
    this.ensure();
    const sf=window.SF, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    if(!u.squarespaceVariantId){alert('No matching Squarespace variant on file for this update.');return}
    const newQty=parseInt(String(u.requestedValue).match(/\d+/)?.[0]||'0',10);
    if(!skipConfirm&&!confirm(`Set live stock to ${newQty} for this product now?\n\n${u.productName}\n${u.previousValue} → ${u.requestedValue}`))return;
    u.status='Applying';
    (u.audit=u.audit||[]).push({at:new Date().toISOString(),action:'Applying inventory update via API'});
    await sf.persist(); this.render();
    const result=await sf.api.squarespaceAdjustInventory({variantId:u.squarespaceVariantId,quantity:newQty});
    const now=new Date().toISOString();
    if(result?.ok){
      u.status='Applied'; u.appliedAt=now; u.error='';
      (u.audit=u.audit||[]).push({at:now,action:'Applied via API -- live stock updated on Squarespace'});
      sf.logActivity(`Updated live stock for ${u.productName} to ${newQty} via API`);
    }else{
      u.status='Failed'; u.error=result?.error||'Unknown error updating inventory.';
      (u.audit=u.audit||[]).push({at:now,action:'Failed to apply via API',previousValue:'',newValue:u.error});
      sf.logActivity(`Failed to update stock for ${u.productName}: ${u.error}`);
    }
    await sf.persist(); window.SF.render();
  },

  async applyAddVariant(id,skipConfirm=false){
    this.ensure();
    const sf=window.SF, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    const plan=this.addVariantPlan(u);
    if(!plan){alert(`StudioFlow can't add this variant through the API yet.\n\n${u.productName}\n\nIt needs the piece mapped to a Squarespace product that already has at least one variant (so StudioFlow knows the option names). Map it on the piece first, or use Generate Approved CSV for this one.`);return}
    const now0=new Date().toISOString();
    if(plan.exists){
      // This size is already live on Squarespace -- don't re-create it (that's the "SKU already in
      // use" error). Link the existing variant onto the piece and mark this update done.
      const art=(sf.state.artworks||[]).find(a=>String(a.id)===String(u.localProductId)||String(a.artworkId)===String(u.localProductId));
      if(art){const pv=(art.products||[]).find(p=>`${p.mediumId||''}|||${p.size}`===u.variantKey||`${p.medium||''}|||${p.size}`===u.variantKey);if(pv){pv.productId=plan.productId;pv.squarespaceProductId=plan.productId;if(plan.existingVariantId){pv.variantId=plan.existingVariantId;pv.squarespaceVariantId=plan.existingVariantId;}pv.sku=pv.sku||plan.existingSku;pv.source='Squarespace';}}
      u.status='Applied';u.appliedAt=now0;u.error='';u.sku=u.sku||plan.existingSku;
      (u.audit=u.audit||[]).push({at:now0,action:'Already on Squarespace — linked the existing variant (no duplicate created)'});
      sf.logActivity(`${u.productName} already on Squarespace — linked, no add needed`);
      await sf.persist();window.SF.render();return;
    }
    if(!(Number(plan.price)>0)){
      // Never create a $0 variant on the live store. If the price is missing it means this size has
      // no price in Website Pricing yet -- pushing it would put a $0 product on the site. Stop here
      // with a clear reason instead.
      u.status='Failed';u.error='No price set for this variant ($0). Set its price in Website Pricing first, then approve again — StudioFlow will not push a $0 product to your live store.';
      (u.audit=u.audit||[]).push({at:now0,action:'Blocked — $0 price',newValue:u.error});
      sf.logActivity(`Skipped adding ${u.productName}: price is $0`);
      await sf.persist();window.SF.render();return;
    }
    if(!skipConfirm&&!confirm(`Add this variant to your live Squarespace store now?\n\n${u.productName}\n\nThis creates the variant on Squarespace.`))return;
    u.status='Applying';(u.audit=u.audit||[]).push({at:new Date().toISOString(),action:'Adding via API'});
    await sf.persist();this.render();
    const result=await sf.api.squarespaceRestoreVariant({productId:plan.productId,attributes:plan.attributes,sku:plan.sku,price:plan.price,currency:sf.state.business?.currency||'CAD',stock:{unlimited:true}});
    const now=new Date().toISOString();
    if(result?.ok){
      u.status='Applied';u.appliedAt=now;u.error='';
      const v=result.variant||{};const newVid=String(v.id||v.variantId||'');
      const art=(sf.state.artworks||[]).find(a=>String(a.id)===String(u.localProductId)||String(a.artworkId)===String(u.localProductId));
      if(art){const pv=(art.products||[]).find(p=>`${p.mediumId||''}|||${p.size}`===u.variantKey||`${p.medium||''}|||${p.size}`===u.variantKey);if(pv){pv.productId=plan.productId;pv.squarespaceProductId=plan.productId;if(newVid){pv.variantId=newVid;pv.squarespaceVariantId=newVid;}pv.sku=pv.sku||plan.sku;pv.source='Squarespace';}}
      u.sku=u.sku||plan.sku;
      (u.audit=u.audit||[]).push({at:now,action:'Added via API -- created on Squarespace'});
      sf.logActivity(`Added ${u.productName} to Squarespace via API`);
    }else{
      u.status='Failed';u.error=result?.error||'Unknown error adding the variant.';
      (u.audit=u.audit||[]).push({at:now,action:'Failed to add via API',previousValue:'',newValue:u.error});
      sf.logActivity(`Failed to add ${u.productName} to Squarespace: ${u.error}`);
    }
    await sf.persist();window.SF.render();
  },

  async applyRemoveVariant(id,skipConfirm=false){
    this.ensure();
    const sf=window.SF, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    if(!u.squarespaceProductId||!u.squarespaceVariantId){alert('No matching Squarespace product/variant on file for this removal.');return}
    if(!skipConfirm&&!confirm(`Remove this variant from your live Squarespace store now?\n\n${u.productName}\n\nThis deletes the variant on Squarespace. It can be restored later from the snapshot StudioFlow saved, but Squarespace itself has no undo for this.`))return;
    u.status='Applying';
    (u.audit=u.audit||[]).push({at:new Date().toISOString(),action:'Removing via API'});
    await sf.persist(); this.render();
    const result=await sf.api.squarespaceRemoveVariant({productId:u.squarespaceProductId,variantId:u.squarespaceVariantId});
    const now=new Date().toISOString();
    if(result?.ok){
      u.status='Applied'; u.appliedAt=now; u.error='';
      (u.audit=u.audit||[]).push({at:now,action:'Removed via API -- deleted from Squarespace'});
      sf.logActivity(`Removed ${u.productName} from Squarespace via API`);
    }else{
      u.status='Failed'; u.error=result?.error||'Unknown error removing the variant.';
      (u.audit=u.audit||[]).push({at:now,action:'Failed to remove via API',previousValue:'',newValue:u.error});
      sf.logActivity(`Failed to remove ${u.productName} from Squarespace: ${u.error}`);
    }
    await sf.persist(); window.SF.render();
  },

  async applyRestoreVariant(id,skipConfirm=false){
    this.ensure();
    const sf=window.SF, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    const snap=u.removalSnapshot;
    if(!snap||!snap.squarespaceProductId||!snap.attributes){alert('No saved snapshot of the original variant on file -- StudioFlow can only restore a variant it removed itself and captured a snapshot of. You may need to re-add this manually in Squarespace.');return}
    if(!skipConfirm&&!confirm(`Restore this variant on your live Squarespace store now?\n\n${u.productName}\n\nThis recreates it from the snapshot saved when it was removed (same options, SKU, and price).`))return;
    u.status='Applying';
    (u.audit=u.audit||[]).push({at:new Date().toISOString(),action:'Restoring via API'});
    await sf.persist(); this.render();
    const result=await sf.api.squarespaceRestoreVariant({productId:snap.squarespaceProductId,attributes:snap.attributes,sku:snap.sku,price:snap.price,currency:sf.state.business?.currency||'CAD'});
    const now=new Date().toISOString();
    if(result?.ok){
      u.status='Applied'; u.appliedAt=now; u.error='';
      (u.audit=u.audit||[]).push({at:now,action:'Restored via API -- recreated on Squarespace'});
      sf.logActivity(`Restored ${u.productName} on Squarespace via API`);
    }else{
      u.status='Failed'; u.error=result?.error||'Unknown error restoring the variant.';
      (u.audit=u.audit||[]).push({at:now,action:'Failed to restore via API',previousValue:'',newValue:u.error});
      sf.logActivity(`Failed to restore ${u.productName} on Squarespace: ${u.error}`);
    }
    await sf.persist(); window.SF.render();
  },

  // ---- Apply a single approved price update directly via the Squarespace API -----------------
  async applyPriceUpdate(id,skipConfirm=false){
    this.ensure();
    const sf=window.SF, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    if(!u.squarespaceProductId||!u.squarespaceVariantId){alert('No matching Squarespace product/variant ID on file for this update. Run Sync Products on the Website Connection page first.');return}
    if(!skipConfirm&&!confirm(`Apply this price change to your live Squarespace store now?\n\n${u.productName}\n${u.previousValue} → ${u.requestedValue}\n\nThis will make a live change to the connected Squarespace store.`))return;
    u.status='Applying';
    (u.audit=u.audit||[]).push({at:new Date().toISOString(),action:'Applying via API'});
    await sf.persist();
    this.render();
    const result=await sf.api.squarespaceUpdateVariantPrice({productId:u.squarespaceProductId,variantId:u.squarespaceVariantId,price:u.requestedValue,currency:sf.state.business?.currency||'CAD'});
    const now=new Date().toISOString();
    if(result?.ok){
      u.status='Applied';
      u.appliedAt=now;
      u.error='';
      (u.audit=u.audit||[]).push({at:now,action:'Applied via API -- live price updated on Squarespace'});
      sf.logActivity(`Applied price update for ${u.productName} directly to Squarespace via API`);
    }else{
      u.status='Failed';
      u.error=result?.error||'Unknown error applying the update.';
      (u.audit=u.audit||[]).push({at:now,action:'Failed to apply via API',previousValue:'',newValue:u.error});
      sf.logActivity(`Failed to apply price update for ${u.productName}: ${u.error}`);
    }
    await sf.persist();
    window.SF.render();
  },

  chooseSquarespaceProduct(id){
    const sf=window.SF, C=window.SFCommerceHub, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    const variants=C?.liveVariants?C.liveVariants():[];
    // Pre-filter to the size this price change actually applies to (parsed from "Art Card (5x7)"),
    // so the picker starts narrow instead of showing all 1000+ variants across every product.
    const sizeMatch=u.productName.match(/\(([^)]+)\)/);
    const sizeHint=(sizeMatch?sizeMatch[1]:'').toLowerCase().replace(/\s+/g,'');
    const wantsMatted=/matt?ed|\bmat\b/i.test(u.productName);
    const wantsMetallic=/metallic/i.test(u.productName);
    const renderList=filter=>{
      const isDefault=filter===undefined;
      const q=String(filter??sizeHint).toLowerCase();
      let matches=variants.filter(v=>!q||`${v.title} ${v.variant} ${v.sku}`.toLowerCase().replace(/\s+/g,'').includes(q));
      // On the initial (un-searched) list, also respect matted-vs-plain and metallic-vs-standard,
      // same precision as Apply to All Matching Products -- a free-text search you type yourself
      // overrides this and searches broadly instead.
      if(isDefault){
        matches=matches.filter(v=>/matt?ed/i.test(v.variant)===wantsMatted&&/metallic/i.test(v.variant)===wantsMetallic);
      }
      matches=matches.slice(0,60);
      return matches.map(v=>`<label class="pw-check-row"><input type="radio" name="sqPick-${id}" value="${sf.esc(v.productId)}::${sf.esc(v.variantId)}"><span><b>${sf.esc(v.title)}</b> — ${sf.esc(v.variant)} <small>SKU ${sf.esc(v.sku||'none')} · ${C.money(v.price)}</small></span></label>`).join('')||'<div class="empty-state">No matches. Try clearing the search box.</div>';
    };
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide sq-picker-modal"><h2>Choose Squarespace Product</h2><p class="muted">Applying: <b>${sf.esc(u.productName)}</b> — ${sf.esc(this.fieldLabel(u).replace(/<[^>]+>/g,' '))}</p><div class="form-grid"><label>Search (started filtered to "${sf.esc(sizeHint||'all')}"${wantsMatted?' · matted':''}${wantsMetallic?' · metallic':''} -- clear to see everything)<input id="sqSearch-${id}" value="${sf.esc(sizeHint)}"></label></div><div class="pw-batch-lines sq-picker-results" id="sqResults-${id}">${renderList(undefined)}</div><div class="row-actions"><button class="button secondary" id="sqPickCancel">Cancel</button><button class="button primary" data-confirm-sq="${id}">Use Selected Product</button></div></div></div>`;
    sf.$(`sqSearch-${id}`).oninput=e=>{sf.$(`sqResults-${id}`).innerHTML=renderList(e.target.value)};
    sf.$('sqPickCancel').onclick=()=>sf.closeModal();
    sf.$('modalRoot').querySelector(`[data-confirm-sq]`).onclick=async()=>{
      const picked=sf.$('modalRoot').querySelector(`input[name="sqPick-${id}"]:checked`);
      if(!picked)return alert('Select a product first.');
      const [productId,variantId]=picked.value.split('::');
      const v=variants.find(x=>x.productId===productId&&x.variantId===variantId);
      u.squarespaceProductId=productId;
      u.squarespaceVariantId=variantId;
      u.squarespaceSku=v?.sku||'';
      (u.audit=u.audit||[]).push({at:new Date().toISOString(),action:`Manually matched to Squarespace product: ${v?.title||productId} — ${v?.variant||variantId}`});
      await sf.persist();
      sf.closeModal();
      window.SF.render();
    };
  },

  // ---- Apply one price change to every matching product at once (e.g. every 5x7 Art Card),
  // automatically excluding Limited Edition artworks, with a reviewable list before anything is
  // sent and a clear per-item result report after -- partial success never rolls back what
  // succeeded, and every failure is shown individually with its own error.
  isLimitedEditionTitle(title){
    const sf=window.SF;
    const norm=String(title||'').toLowerCase().trim();
    return sf.artworkCatalog().some(a=>String(a.title||'').toLowerCase().trim()===norm&&(a.isLimitedEdition||a.limited||/limited edition/i.test(a.gallery||sf.galleryForArtwork?.(a)?.name||'')));
  },
  bulkApplyPrice(id){
    const sf=window.SF, C=window.SFCommerceHub, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    const variants=C?.liveVariants?C.liveVariants():[];
    const sizeMatch=u.productName.match(/\(([^)]+)\)/);
    const sizeHint=(sizeMatch?sizeMatch[1]:'').toLowerCase().replace(/\s+/g,'');
    if(!sizeHint)return alert('Could not determine which size this price change applies to.');
    const wantsMatted=/matt?ed|\bmat\b/i.test(u.productName);
    const wantsMetallic=/metallic/i.test(u.productName);
    const candidates=variants.filter(v=>{
      if(!`${v.title} ${v.variant}`.toLowerCase().replace(/\s+/g,'').includes(sizeHint))return false;
      const isMatted=/matt?ed/i.test(v.variant);
      const isMetallic=/metallic/i.test(v.variant);
      // Squarespace encodes both matted-vs-plain and metallic-vs-standard as text within the same
      // Material value (e.g. "Metallic Luster Paper - Matted" contains "Luster", so a plain
      // substring search on "luster" would wrongly match it too) -- both must match the target.
      return isMatted===wantsMatted&&isMetallic===wantsMetallic;
    });
    const excluded=candidates.filter(v=>this.isLimitedEditionTitle(v.title));
    const included=candidates.filter(v=>!this.isLimitedEditionTitle(v.title));
    if(!candidates.length)return alert(`No Squarespace products found matching size "${sizeMatch[1]}". Try Choose Product to search manually instead.`);
    const row=v=>`<label class="pw-check-row"><input type="checkbox" data-bulk-item value="${sf.esc(v.productId)}::${sf.esc(v.variantId)}" checked><span><b>${sf.esc(v.title)}</b> — ${sf.esc(v.variant)} <small>SKU ${sf.esc(v.sku||'none')} · currently ${C.money(v.price)} → ${C.money(u.requestedValue)}</small></span></label>`;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide sq-picker-modal"><h2>Apply to All Matching Products</h2><p class="muted">${sf.esc(u.productName)} — new price ${C.money(u.requestedValue)}. Review the list below; uncheck anything you don't want changed.</p><div class="pw-batch-lines sq-picker-results">${included.map(row).join('')||'<div class="empty-state">Nothing to apply -- everything matching this size is Limited Edition.</div>'}</div>${excluded.length?`<p class="muted">${excluded.length} Limited Edition product${excluded.length===1?'':'s'} automatically excluded: ${excluded.map(v=>sf.esc(v.title)).join(', ')}</p>`:''}<div class="row-actions"><button class="button secondary" id="bulkCancel">Cancel</button><button class="button primary" id="bulkConfirm" ${included.length?'':'disabled'}>Apply Price to Selected</button></div></div></div>`;
    sf.$('bulkCancel').onclick=()=>sf.closeModal();
    sf.$('bulkConfirm').onclick=async()=>{
      const picked=[...sf.$('modalRoot').querySelectorAll('[data-bulk-item]:checked')].map(el=>el.value);
      if(!picked.length)return alert('Nothing selected.');
      if(!confirm(`Apply ${C.money(u.requestedValue)} to ${picked.length} product${picked.length===1?'':'s'} on your live Squarespace store now?`))return;
      sf.closeModal();
      const results=[];
      for(const key of picked){
        const [productId,variantId]=key.split('::');
        const v=variants.find(x=>x.productId===productId&&x.variantId===variantId);
        const r=await sf.api.squarespaceUpdateVariantPrice({productId,variantId,price:u.requestedValue,currency:sf.state.business?.currency||'CAD'});
        results.push({title:v?.title||productId,variant:v?.variant||'',ok:!!r?.ok,error:r?.error||''});
      }
      const okCount=results.filter(r=>r.ok).length;
      sf.logActivity(`Bulk price apply for ${u.productName}: ${okCount}/${results.length} succeeded`);
      (u.audit=u.audit||[]).push({at:new Date().toISOString(),action:`Bulk applied to ${okCount}/${results.length} products`});
      if(okCount===results.length){u.status='Applied';u.appliedAt=new Date().toISOString()}
      await sf.persist();
      sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Bulk Apply Results</h2><p class="muted">${okCount} of ${results.length} succeeded.</p><div class="pw-batch-lines">${results.map(r=>`<div class="pw-batch-line"><span>${r.ok?'✓':'✗'} <b>${sf.esc(r.title)}</b> ${sf.esc(r.variant)}</span><span>${r.ok?'Applied':sf.esc(r.error)}</span></div>`).join('')}</div><div class="row-actions"><button class="button primary" id="bulkResultsClose">Close</button></div></div></div>`;
      sf.$('bulkResultsClose').onclick=()=>{sf.closeModal();window.SF.render()};
    };
  },

  details(id){
    this.ensure();
    const sf=window.SF, u=sf.state.websiteUpdates.find(x=>x.id===id);
    if(!u)return;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card"><h2>${sf.esc(u.productName)}</h2><p class="muted">${sf.esc(u.action)} · ${sf.esc(u.category)}</p><div class="fact-grid"><div><span>Status</span><b>${sf.esc(u.status)}</b></div><div><span>SKU</span><b>${sf.esc(u.sku||'—')}</b></div><div><span>Squarespace Product ID</span><b>${sf.esc(u.squarespaceProductId||'—')}</b></div><div><span>Squarespace Variant ID</span><b>${sf.esc(u.squarespaceVariantId||'—')}</b></div></div><h3>Audit Trail</h3><div class="pw-batch-lines">${(u.audit||[]).map(a=>`<div class="pw-batch-line"><span>${sf.esc(a.action)}${a.previousValue!==undefined?` (${sf.esc(String(a.previousValue))} → ${sf.esc(String(a.newValue))})`:''}</span><span>${new Date(a.at).toLocaleString()}</span></div>`).join('')}</div><div class="row-actions"><button class="button secondary" id="wuDetailsClose">Close</button></div></div></div>`;
    sf.$('wuDetailsClose').onclick=()=>sf.closeModal();
  },

  // ---- Notifications --------------------------------------------------------------------
  notify(title,body){
    try{
      if(typeof Notification==='undefined')return;
      if(Notification.permission==='granted')new Notification(title,{body});
      else if(Notification.permission!=='denied')Notification.requestPermission().then(p=>{if(p==='granted')new Notification(title,{body})});
    }catch(e){/* notifications are a nice-to-have, never block on them */}
  },

  // ---- Developer / Test Mode: simulate a Squarespace order without touching the live store -----
  simulateOrder(kind){
    const sf=window.SF, s=sf.state;
    this.ensure();
    const catalog=sf.artworkCatalog?sf.artworkCatalog():[];
    const art=catalog[Math.floor(Math.random()*Math.max(1,catalog.length))]||{title:'Sample Artwork',id:''};
    const specs={
      'Art Card':{productName:`${art.title} - Art Card`,variant:'5x7',price:8.5},
      'Framed Print':{productName:`${art.title} - Framed Print`,variant:'17x25',price:245},
      'Canvas':{productName:`${art.title} - Canvas`,variant:'24x36',price:310},
    };
    const kinds=kind==='Multiple Items'?['Art Card','Framed Print']:[kind];
    const order={id:sf.makeId('WEB-ORD'),orderNumber:`TEST-${Math.floor(1000+Math.random()*9000)}`,source:'Squarespace (Simulated)',customerName:'Test Customer',email:'test@example.com',orderDate:new Date().toISOString(),status:'Pending',paymentState:'PAID',total:0,inventoryDeducted:false,isNew:true,testMode:true,createdAt:new Date().toISOString()};
    let total=0;
    kinds.forEach(k=>{
      const spec=specs[k]||specs['Art Card'];
      total+=spec.price;
      s.websiteOrderItems.push({id:sf.makeId('WEB-LINE'),orderId:order.id,sku:`TEST-${k.replace(/\s/g,'').toUpperCase()}`,productName:spec.productName,variant:spec.variant,quantity:1,unitPrice:spec.price,artworkId:art.id,createdAt:new Date().toISOString()});
    });
    order.total=total;
    s.websiteOrders.push(order);
    sf.logActivity(`Developer Mode: simulated a ${kind} website order (does not touch your live Squarespace store)`);
    this.notify('New Website Order Received',`Order #${order.orderNumber} · ${order.customerName} · ${kinds.length} item${kinds.length===1?'':'s'} · $${total.toFixed(2)}`);
    return order;
  },
};
