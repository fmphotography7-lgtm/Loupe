window.SFArtworks = {
  filtered(){
    const sf=window.SF,q=sf.artworkSearch.trim().toLowerCase();
    if(!q)return sf.state.artworks;
    return sf.state.artworks.filter(a=>[a.title,a.id,a.orientation,a.description,sf.galleryForArtwork(a)?.name,(a.keywords||[]).join(' '),(a.products||[]).map(p=>`${p.medium} ${p.size}`).join(' ')].join(' ').toLowerCase().includes(q));
  },
  render(){
    const sf=window.SF,list=this.filtered();
    // g77: some pieces only have their image on the website-cache side of artworkCatalog(), so the
    // native-record-only lookup showed "No image" for photographs that are plainly on the site.
    const _imgIdx=sf.imageIndex?sf.imageIndex():null;
    sf.$('workspace').innerHTML=`<div class="page-stack"><div class="card"><div class="toolbar"><input id="artworkSearch" class="search" placeholder="Search artwork, medium or size" value="${sf.esc(sf.artworkSearch)}"><div class="row-actions"><button id="swapImages" class="button secondary">Swap In Clean Images…</button><button id="assignFileIds" class="button secondary">Assign File IDs</button><button id="importCatalog" class="button secondary">Import Squarespace CSV</button><button id="addArtworkButton" class="button primary">Add Artwork</button></div></div></div><div class="art-grid">${list.map(a=>`<div class="art-card"><div class="image-box">${(()=>{const src=sf.artworkImage?sf.artworkImage(a,_imgIdx):(a.image||a.imagePath||a.imageData);return src?`<img src="${src}" loading="lazy">`:'No image';})()}</div><div class="card-copy"><div class="art-title-row"><b>${sf.esc(a.title)}</b>${a.isLimitedEdition?`<span class="badge gold">Limited${a.editionSize?` · Edition of ${a.editionSize}`:''}</span>`:'<span class="badge">Unlimited</span>'}</div><small>${sf.esc(sf.galleryForArtwork(a)?.name||'Unassigned')}</small><div class="meta-pills"><span class="badge">${sf.esc(a.orientation)}</span><span class="badge">${window.SFProducts.renderSummary(a)}</span>${a.squarespace?.imported?'<span class="badge success">Squarespace</span>':''}</div><div class="row-actions"><button class="button secondary edit-artwork" data-id="${a.id}">Edit</button>${(a.products||[]).some(p=>p.productId||p.squarespaceProductId)||a.squarespaceProductId?'':`<button class="button secondary send-artwork" data-id="${a.id}">Send to Squarespace</button>`}<button class="button danger delete-artwork" data-id="${a.id}">Delete</button></div></div></div>`).join('')||'<div class="empty">No artwork yet.</div>'}</div></div>`;
    sf.$('artworkSearch').oninput=e=>{sf.artworkSearch=e.target.value;this.render();};
    if(sf.$('assignFileIds'))sf.$('swapImages').onclick=()=>this.openImageSwap();sf.$('assignFileIds').onclick=()=>this.openFileIdRepair();
    document.querySelectorAll('.send-artwork').forEach(b=>b.onclick=()=>this.queueSendToWebsite(b.dataset.id));
    sf.$('addArtworkButton').onclick=()=>this.openEditor();
    sf.$('importCatalog').onclick=()=>window.SFSquarespace.import();
    document.querySelectorAll('.edit-artwork').forEach(b=>b.onclick=()=>this.openEditor(b.dataset.id));
    document.querySelectorAll('.delete-artwork').forEach(b=>b.onclick=()=>this.delete(b.dataset.id));
  },
  renderWebsitePanel(artwork){
    const sf=window.SF,host=sf.$('websiteReconcile');if(!host)return;
    if(artwork.isLimitedEdition){host.innerHTML='<div class="notice">This is a Limited Edition — its variants and prices are managed by the Limited Edition tracker, not here.</div>';return;}
    const C=window.SFCommerceHub,live=(C&&C.liveVariants)?C.liveVariants():[];
    const tk=t=>sf.titleKey(t),normSize=x=>String(x||'').toLowerCase().replace(/[^0-9x]/g,''),hasMat=x=>/\bmat|matt/i.test(String(x||''));
    const medKey=o=>String(o||'').toLowerCase().replace(/\d+\s*[x\u00d7]\s*\d+/g,' ').replace(/[\u00b7\u2013\u2014+-]/g,' ').replace(/\bmatted\b|\bmatt\b|\bmat\b|print only|printonly/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(w=>w.length>2).sort().join(' ');
    const mine=live.filter(v=>tk(v.title)===tk(artwork.title));
    const matchesFor=(medium,size)=>{const sz=normSize(size),wm=medKey(medium),mat=hasMat(medium);return mine.filter(v=>normSize(v.variant).includes(sz)&&medKey(v.variant)===wm&&hasMat(v.variant)===mat)};
    const money=n=>'$'+Number(n||0).toFixed(2);
    const realCb=(tid,size)=>{try{return document.querySelector('[data-size-medium="'+tid+'"][value="'+String(size).replace(/"/g,'\\"')+'"]')}catch{return null}};
    const templates=sf.state.productTemplates||[];
    let ok=0,issues=0,adds=0;
    const groups=templates.map(t=>{
      const rows=(t.sizes||[]).map(size=>{
        const cb=realCb(t.id,size),checked=cb?cb.checked:false;
        const sfPrice=Number(window.SFPricing.priceFor(artwork,t.id,size)||0);
        const ms=matchesFor(t.name,size);
        let tag='',cls='',action='';
        if(ms.length>1){tag='\u26a0 Duplicate ('+ms.length+')';cls='bad';issues++;}
        else if(ms.length===1){const lp=Number(ms[0].price||0);
          if(!lp){tag='\ud83d\udeab $0 on site';cls='bad';issues++;}
          else if(Math.abs(lp-sfPrice)>0.005){tag='\u26a0 site '+money(lp);cls='warn';issues++;action='<button class="button secondary web-fix" data-tpl="'+t.id+'" data-size="'+sf.esc(size)+'" data-vid="'+sf.esc(ms[0].variantId||'')+'" data-pid="'+sf.esc(ms[0].productId||'')+'" data-price="'+sfPrice+'">Use StudioFlow Price</button>';}
          else{tag='\u2705 Live';cls='ok';ok++;}
        } else { if(checked){tag='\u2795 Will add on save';cls='warn';adds++;} else {tag='\u2014';cls='';} }
        if(checked&&sfPrice<=0){tag='\ud83d\udeab $0 price';cls='bad';issues++;}
        return '<div class="web-row '+cls+'"><label class="web-check"><input type="checkbox" class="web-size" data-tpl="'+t.id+'" value="'+sf.esc(size)+'" '+(checked?'checked':'')+'> '+sf.esc(size)+'</label><span class="web-price">'+money(sfPrice)+'</span><span class="web-tag '+cls+'">'+tag+'</span><span class="web-act">'+action+'</span></div>';
      }).join('');
      return '<div class="web-group"><h4>'+sf.esc(t.name)+'</h4>'+rows+'</div>';
    }).join('');
    host.innerHTML=(live.length?'':'<div class="notice">No live Squarespace data loaded — sync your products (Website \u2192 Sync Products) to see live prices, duplicates and $0 flags.</div>')+
      '<div class="web-summary">'+ok+' matched \u00b7 '+issues+' need attention \u00b7 '+adds+' queued to add</div>'+
      '<div class="web-headrow"><span>Size</span><span>Your price</span><span>Status</span><span></span></div>'+groups+
      '<p class="muted" style="margin-top:8px">Tick a size to queue it for adding on Save. \u201cUse StudioFlow Price\u201d queues a price update (you approve it under Website Updates). Green rows already match your site.</p>';
    host.querySelectorAll('.web-size').forEach(w=>w.onchange=()=>{const real=realCb(w.dataset.tpl,w.value);if(real){real.checked=w.checked;}this.renderWebsitePanel(artwork);});
    host.querySelectorAll('.web-fix').forEach(b=>b.onclick=()=>{const WU=window.SFWebsiteUpdates,t=(sf.state.productTemplates||[]).find(x=>x.id===b.dataset.tpl);if(WU&&WU.create){WU.create({action:'UPDATE_PRICE',field:'price',localProductId:b.dataset.tpl,squarespaceProductId:b.dataset.pid,squarespaceVariantId:b.dataset.vid,productName:artwork.title+' \u2014 '+(t?t.name:'')+' ('+b.dataset.size+')',requestedValue:Number(b.dataset.price).toFixed(2),source:'artwork_website_tab'});}b.textContent='Queued \u2713';b.disabled=true;});
  },
  // g73: give pre-g71 pieces a proper FMP file id, carrying every reference with them.
  // g76: queue a piece that has never been on Squarespace as a new product. Needed because website
  // updates can be deleted, and until now nothing could re-queue a creation once it was gone.
  async queueSendToWebsite(id){
    const sf=window.SF;
    const art=(sf.state.artworks||[]).find(a=>String(a.id)===String(id));
    if(!art)return;
    const priced=(art.products||[]).filter(p=>Number(p.price)>0);
    if(!(art.products||[]).length)return alert(`"${art.title}" has no sizes yet. Add its sizes and prices first, then send it up.`);
    if(!priced.length)return alert(`"${art.title}" has sizes but none of them have a price. StudioFlow won't put a $0 product on your live store — set prices in Website Pricing first.`);
    if(!window.SFWebsiteUpdates?.create)return;
    window.SFWebsiteUpdates.create({action:'ADD_PRODUCT',localProductId:art.id,productName:art.title,previousValue:'Not yet on Squarespace',requestedValue:`New product -- ${priced.length} variant(s)`,source:'artwork_card'});
    sf.logActivity(`Queued ${art.title} to be created on Squarespace`);
    await sf.persist();sf.render();
    alert(`"${art.title}" is queued on the Website Updates page.\n\nApprove it there and StudioFlow creates the product, its ${priced.length} priced size(s) and the image on your store — hidden, so you can check it before anyone sees it.`);
  },
  /* ==========================================================================================
     g158 — SWAP EVERY PIECE ONTO ITS CLEAN FILE IN ONE PASS.
     ==========================================================================================
     Kirk is dropping the watermarks from his site and asked whether he has to do all 75 pieces by
     hand. His files differ ONLY by a suffix: "Botanical Sky.jpg" is the clean one and
     "Botanical Sky WM.jpg" is the watermarked one.

     SO THE MATCH IS ON TITLE, NOT ON FILE ID. I had offered FMP-id matching (the rule the
     room-images folder uses) before he told me how his files are actually named — worth
     remembering that the matching rule has to come from HIS filenames, never from the convention
     that happens to exist elsewhere in the app.

     Deliberately conservative, because this rewrites the image on every piece:
       - a title must match ONE file exactly after normalising (case, punctuation, spacing);
         two candidates for one piece is reported as ambiguous and skipped, never guessed at;
       - any file whose name still ends in the watermark suffix is EXCLUDED from the candidates,
         so a folder holding both versions cannot swap him onto the watermarked one;
       - NOTHING is written until he has seen the list and pressed the button;
       - the previous path is kept on the piece as `previousImagePath`, so a bad swap is
         recoverable rather than final.
     ========================================================================================== */
  normTitle(v){
    return String(v||'').toLowerCase()
      .replace(/\.(jpe?g|png|webp|tiff?)$/,'')
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  },
  /* The clean/watermarked distinction is a SUFFIX on the name. Anything ending in it is not a
     candidate; everything else is. Kept as its own method so the suffix is one editable thing. */
  isWatermarked(name,suffix){
    const suf=this.normTitle(suffix||'wm');
    if(!suf)return false;
    const n=this.normTitle(name);
    return n===suf||n.endsWith(' '+suf);
  },

  /* g159 — WHICH SUFFIX HE WANTS CHANGED DIRECTION.
     g158 assumed "WM" marks the file to AVOID: the clean one is the bare title. Kirk then said he
     is making a NEW small-corner-watermark version and wants everything swapped onto THAT — so the
     suffixed file becomes the one he WANTS. Same mechanism, opposite sense, and a tool that only
     knew how to exclude would have refused every file he had just made.
     `mode` is therefore explicit:
       'plain'  — take the bare title, ignore anything carrying the suffix   (g158 behaviour)
       'suffix' — take title + suffix, ignore the bare title
     Nothing about the matching, the ambiguity check or the confirm step differs between them. */
  planImageSwap(files,suffix,mode){
    const sf=window.SF, wantSuffix=(mode==='suffix');
    const clean=(files||[]).filter(f=>this.isWatermarked(f.name,suffix)===wantSuffix);
    const byTitle=new Map();
    clean.forEach(f=>{
      /* In suffix mode the file is "Title WM", so the suffix comes off before matching — the
         piece is still called "Botanical Sky". */
      const raw=this.normTitle(f.name);
      const suf=this.normTitle(suffix||'wm');
      const k=wantSuffix&&suf&&raw.endsWith(' '+suf)?raw.slice(0,-(suf.length+1)).trim():raw;
      if(!k)return;
      if(!byTitle.has(k))byTitle.set(k,[]);
      byTitle.get(k).push(f);
    });
    const matched=[],ambiguous=[],unmatched=[];
    (sf.state.artworks||[]).forEach(a=>{
      const k=this.normTitle(a.title||a.name||'');
      const hits=k?(byTitle.get(k)||[]):[];
      const current=a.imagePath||a.permanentImagePath||a.filePath||'';
      if(hits.length===1){
        /* Already pointing at that exact file: nothing to do, and saying so keeps the "will
           change" count honest. */
        if(String(current)===String(hits[0].path))return;
        matched.push({artwork:a,file:hits[0],current});
      }
      else if(hits.length>1)ambiguous.push({artwork:a,files:hits});
      else unmatched.push({artwork:a,current});
    });
    return {matched,ambiguous,unmatched,mode:wantSuffix?'suffix':'plain',
      skipped:(files||[]).length-clean.length};
  },

  async openImageSwap(){
    const sf=window.SF;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide">
      <h2>Swap In Clean Images</h2>
      <p class="muted">Point this at the folder holding your un-watermarked files. Each piece is matched
      to the file whose NAME IS ITS TITLE \u2014 so "Botanical Sky.jpg" matches the piece called
      Botanical Sky. Nothing is changed until you have seen the list.</p>
      <div class="form-grid">
        <label>Which files do you want to use?<select id="swMode">
          <option value="plain">The plain ones — "Botanical Sky.jpg"</option>
          <option value="suffix">The ones with a suffix — "Botanical Sky WM.jpg"</option>
        </select></label>
        <label>That suffix<input id="swSuffix" value="WM" style="width:120px"></label>
      </div>
      <p class="help" id="swModeNote"></p>
      <div class="row-actions"><button class="button secondary" id="swCancel">Cancel</button>
        <button class="button primary" id="swPick">Choose the folder\u2026</button></div>
      <div id="swBody"></div></div></div>`;
    sf.$('swCancel').onclick=()=>sf.closeModal();
    const note=()=>{const m=sf.$('swMode').value,x=sf.$('swSuffix').value.trim()||'WM';
      sf.$('swModeNote').textContent=m==='suffix'
        ? `Files ending in "${x}" will be used; anything without it is ignored. Pick this when the version you want is the marked one — a small corner watermark, say.`
        : `Files ending in "${x}" will be IGNORED; the plain title is used. Pick this when you want the unmarked version.`};
    sf.$('swMode').onchange=note; sf.$('swSuffix').oninput=note; note();
    sf.$('swPick').onclick=async()=>{
      const suffix=sf.$('swSuffix').value.trim()||'WM';
      const mode=sf.$('swMode').value;
      const picked=await sf.api.siteChooseImageFolder?.();
      if(!picked||!picked.folder)return;
      if(!picked.files?.length){
        sf.$('swBody').innerHTML=`<p class="danger-text">No JPEG, PNG or WebP files in that folder.</p>`;
        return;
      }
      const plan=this.planImageSwap(picked.files,suffix,mode);
      const row=m=>`<tr><td>${sf.esc(m.artwork.title||m.artwork.name||'Untitled')}</td>
        <td class="muted">${sf.esc(String(m.current||'').split(/[\\/]/).pop()||'\u2014')}</td>
        <td><b>${sf.esc(m.file.name)}</b></td></tr>`;
      sf.$('swBody').innerHTML=`
        <p class="muted" style="margin-top:14px">${picked.files.length} file(s) in that folder${plan.skipped?`, ${plan.skipped} ignored (${mode==='suffix'?`no "${sf.esc(suffix)}" on the name`:`named with "${sf.esc(suffix)}"`})`:''}.</p>
        ${plan.matched.length?`<h3>${plan.matched.length} piece(s) will change</h3>
          <div class="commerce-table"><table><thead><tr><th>Piece</th><th>Now using</th><th>Will use</th></tr></thead>
          <tbody>${plan.matched.map(row).join('')}</tbody></table></div>`
          :`<p class="danger-text"><b>Nothing matched.</b> ${mode==='suffix'
              ? `Files have to be named "&lt;title&gt; ${sf.esc(suffix)}" \u2014 e.g. "Botanical Sky ${sf.esc(suffix)}.jpg".`
              : 'Files have to be named as the piece titles \u2014 e.g. "Botanical Sky.jpg".'} Check one against the list below before going further.</p>`}
        ${plan.ambiguous.length?`<p class="help danger-text"><b>${plan.ambiguous.length} piece(s) matched more than one file and were left alone:</b>
          ${sf.esc(plan.ambiguous.map(a=>`${a.artwork.title} (${a.files.map(f=>f.name).join(', ')})`).slice(0,6).join(' \u00b7 '))}</p>`:''}
        ${plan.unmatched.length?`<details class="help"><summary>${plan.unmatched.length} piece(s) had no matching file \u2014 they keep the image they have</summary>
          <p>${sf.esc(plan.unmatched.map(u=>u.artwork.title||'Untitled').slice(0,60).join(' \u00b7 '))}</p></details>`:''}
        ${plan.matched.length?`<div class="row-actions" style="margin-top:12px">
          <button class="button primary" id="swApply">Swap these ${plan.matched.length} image(s)</button>
          <span class="help">The old path is kept on each piece, so this can be undone.</span></div>`:''}`;
      if(sf.$('swApply'))sf.$('swApply').onclick=async()=>{
        plan.matched.forEach(m=>{
          m.artwork.previousImagePath=m.current||'';
          m.artwork.imagePath=m.file.path;
          /* Both of the other spellings the app reads are cleared, or a stale one wins the
             fallback chain and the swap appears to have done nothing. */
          if(m.artwork.permanentImagePath)m.artwork.permanentImagePath=m.file.path;
          if(m.artwork.filePath)m.artwork.filePath=m.file.path;
          m.artwork.imageUpdatedAt=new Date().toISOString();
        });
        await sf.persist();
        sf.logActivity?.(`Swapped ${plan.matched.length} artwork image(s) to un-watermarked files`);
        sf.closeModal();
        this.render();
        alert(`${plan.matched.length} piece(s) now point at the clean files.\n\nRun Website Export again to rebuild the site with them. Squarespace is not touched \u2014 that site has to be updated by hand.`);
      };
    };
  },

  openFileIdRepair(){
    const sf=window.SF;
    const pending=(sf.artworksWithoutFileId?sf.artworksWithoutFileId():[]);
    if(!pending.length)return alert('Every piece already has an FMP file ID — nothing to assign.');
    // Reserve the numbers up front so the preview shows exactly what each piece will get.
    const taken=new Set();
    const rows=pending.map(a=>{
      let next=sf.nextArtworkId();
      while(taken.has(next)){const m=/^(.*?)(\d+)$/.exec(next);next=m?`${m[1]}${String(Number(m[2])+1).padStart(m[2].length,'0')}`:next+'X';}
      taken.add(next);
      const scan=sf.artworkReferenceScan(String(a.id),next,false);
      return {oldId:String(a.id),newId:next,title:a.title||'Untitled',refs:scan.hits,where:scan.where};
    });
    this._fileIdRows=rows;
    const list=rows.map((r,i)=>`<label class="checkline"><input type="checkbox" class="fid-pick" data-i="${i}" checked> <b>${sf.esc(r.title)}</b> — <code>${sf.esc(r.oldId)}</code> → <b>${sf.esc(r.newId)}</b> · ${r.refs} reference${r.refs===1?'':'s'} (${sf.esc(Object.keys(r.where).join(', ')||'none')})</label>`).join('');
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Assign File IDs</h2>
      <p class="muted">${rows.length} piece(s) still carry a generated ID instead of an FMP number. Each keeps its own record — the ID is changed in place and every sale, inventory row and website update that points at it moves with it. Nothing is deleted and no piece is merged. Export a backup first if you want a safety net.</p>
      <div style="max-height:46vh;overflow:auto;margin:10px 0">${list}</div>
      <div class="row-actions"><button type="button" class="button secondary" id="fidCancel">Cancel</button><button type="button" class="button primary" id="fidApply">Assign to Ticked</button></div>
    </div></div>`;
    sf.$('fidCancel').onclick=()=>sf.closeModal();
    sf.$('fidApply').onclick=async()=>{
      const picked=[...document.querySelectorAll('.fid-pick')].filter(c=>c.checked).map(c=>rows[Number(c.dataset.i)]);
      if(!picked.length)return alert('Nothing is ticked.');
      if(!confirm(`Assign file IDs to ${picked.length} piece(s)?\n\nEvery reference moves with them. This changes StudioFlow only — nothing is sent to Squarespace.`))return;
      const done=[],failed=[];
      for(const r of picked){
        const res=sf.renumberArtwork(r.oldId,r.newId);
        if(res.ok)done.push(`${r.title}: ${r.oldId} → ${r.newId} (${res.hits} reference${res.hits===1?'':'s'} moved)`);
        else failed.push(`${r.title}: ${res.error}`);
      }
      sf.logActivity(`Assigned FMP file IDs to ${done.length} piece(s)`);
      await sf.persist();
      sf.closeModal();sf.render();
      alert(`${done.length} piece(s) renumbered.\n\n${done.slice(0,12).join('\n')}${done.length>12?`\n…and ${done.length-12} more.`:''}${failed.length?`\n\nNot changed:\n${failed.join('\n')}`:''}`);
    };
  },
  openEditor(id=''){
    const sf=window.SF;window.SFProductTemplates.ensure(sf.state);window.SFPricing.ensure();
    // Resolve by EITHER stored id or file id (artworkId), so a piece opened via a secondary id
    // still finds its real self instead of looking brand-new.
    const old=sf.state.artworks.find(a=>a.id===id||a.artworkId===id);
    // If it's not in native storage yet, it may still exist via the merged catalog (old-app-only
    // data that was never "promoted" into sf.state.artworks). Use that as the real starting point
    // rather than silently creating a blank duplicate with a fresh ID.
    const catalogMatch=!old&&id?sf.artworkCatalog().find(a=>String(a.id)===String(id)||String(a.artworkId)===String(id)):null;
    const source=old||catalogMatch;
    // Canonical identity = the file id (artworkId, e.g. FMP-0076) when the piece has one, so that
    // saving updates THAT record in place rather than adopting a secondary StudioFlow-generated
    // id (ART-...) and leaving a duplicate behind. IMPORTANT: prefer a real FMP-#### file id over a
    // generated ART- id when EITHER field still holds one, so editing a piece never overwrites its
    // surviving FMP id with a corrupted ART- id (which was silently spreading the ART- prefix).
    const _isGen=v=>/^ART-[a-z0-9]{3,}-\d+$/i.test(String(v||''));
    const _pickId=()=>{if(!source)return sf.nextArtworkId?sf.nextArtworkId():sf.makeId('ART');const cands=[source.artworkId,source.id].filter(Boolean);return cands.find(v=>/^FMP-/i.test(String(v)))||cands.find(v=>!_isGen(v))||cands[0]||sf.makeId('ART')};
    const canonicalId=_pickId();
    const artwork=source?{...source,id:canonicalId,artworkId:canonicalId}:{id:canonicalId,title:'',galleryId:sf.state.galleries[0]?.id||'',orientation:'Landscape',description:'',keywords:[],image:'',isLimitedEdition:false,editionSize:null,limitedEditionPricing:{},products:[],squarespace:{imported:false,productIds:[]}};
    // Pre-check EVERY size this piece already sells for each medium -- including Squarespace-
    // imported variants. Previously imported ones were excluded, so the editor looked empty and
    // re-selecting a size that already existed created a second (duplicate) variant, inflating the
    // count. Showing the true current state is the whole point of editing from here.
    const selected={};for(const t of sf.state.productTemplates)selected[t.id]=new Set((artwork.products||[]).filter(p=>(p.mediumId===t.id||p.medium===t.name)).map(p=>p.size));
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal artwork-modal"><div class="modal-head"><h2>${source?'Edit':'New'} Artwork</h2><button class="close-button" id="closeArtworkModal">×</button></div>`+`<div class="tabs"><button class="tab active" data-tab="details">Artwork Details</button><button class="tab" data-tab="products">Products & Sizes</button><button class="tab" data-tab="limited">Limited Edition</button><button class="tab" data-tab="website">Website</button></div><div id="tab-details" class="tab-panel active"><div class="grid2"><div><label>Artwork ID</label><input id="artId" value="${sf.esc(artwork.id)}" ${source?'readonly title="Not editable -- this identifies the artwork internally and changing it would disconnect it from its own history."':''}><label>Title</label><input id="artTitle" value="${sf.esc(artwork.title)}"><label>Gallery</label><select id="artGallery"><option value="">Unassigned</option>${sf.state.galleries.map(g=>`<option value="${g.id}" ${g.id===artwork.galleryId?'selected':''}>${sf.esc(g.name)}</option>`).join('')}</select><label>Orientation</label><select id="artOrientation">${['Landscape','Portrait','Panoramic','Square'].map(o=>`<option ${o===artwork.orientation?'selected':''}>${o}</option>`).join('')}</select><label>Keywords</label><input id="artKeywords" value="${sf.esc((artwork.keywords||[]).join(', '))}"><label>Description</label><textarea id="artDescription">${sf.esc(artwork.description||'')}</textarea></div><div><div class="preview-mini" id="artImagePreview">${artwork.image?`<img src="${artwork.image}">`:'No image selected'}</div><input type="hidden" id="artImageData" value="${sf.esc(artwork.imageData||'')}"><input type="hidden" id="artImagePath" value="${sf.esc(artwork.imagePath||artwork.permanentImagePath||artwork.filePath||'')}"><button class="button secondary" id="chooseArtworkImage">Choose Image</button><div class="help">Artwork details are stored once and reused across every product variation.</div></div></div></div><div id="tab-products" class="tab-panel"><p class="muted">Choose the mediums and sizes sold for this artwork. Regular artwork uses the shared prices from Pricing.</p><div class="template-list">${sf.state.productTemplates.map(t=>`<div class="template-card"><div class="template-head"><label class="check-row"><input type="checkbox" class="medium-toggle" data-medium="${t.id}" ${selected[t.id].size?'checked':''}><b>${sf.esc(t.name)}</b></label></div><div class="size-checks" data-sizegroup="${t.id}">${t.sizes.map(size=>`<label><input type="checkbox" data-size-medium="${t.id}" value="${sf.esc(size)}" ${selected[t.id].has(size)?'checked':''}> ${sf.esc(size)} <small>$${window.SFPricing.priceFor(artwork,t.id,size).toFixed(2)}</small></label>`).join('')}</div></div>`).join('')}</div>${(artwork.products||[]).some(p=>p.source==='Squarespace')?`<div class="notice">These checkboxes are the correct variants for this piece. Adding or removing a size here is proposed as a Website Update you review before anything changes on your live site.</div>`:''}</div><div id="tab-limited" class="tab-panel"><label class="check-row large"><input type="checkbox" id="artLimited" ${artwork.isLimitedEdition?'checked':''}><b>This artwork is a Limited Edition</b></label><div class="grid2"><div><label>Edition Run</label><input id="editionSize" type="number" min="1" value="${artwork.editionSize||''}" placeholder="25"></div><div><label>Starting Price</label><div class="money-input"><b>$</b><input id="editionStartingPrice" type="number" min="0" step="0.01" value="${artwork.limitedEditionStartingPrice||''}" placeholder="400"></div></div></div><p class="muted">Limited Editions may use custom prices. Enter only the prices that differ from standard pricing.</p><div class="limited-price-list">${sf.state.productTemplates.map(t=>`<div class="template-card"><h4>${sf.esc(t.name)}</h4><div class="price-grid compact">${t.sizes.map(size=>`<label class="price-cell"><span>${sf.esc(size)}</span><div class="money-input"><b>$</b><input class="limited-price" data-medium="${t.id}" data-size="${sf.esc(size)}" type="number" min="0" step="0.01" value="${artwork.limitedEditionPricing?.[t.id]?.[size]??''}" placeholder="${window.SFPricing.priceFor(null,t.id,size).toFixed(2)}"></div></label>`).join('')}</div></div>`).join('')}</div></div><div id="tab-website" class="tab-panel"><div id="websiteReconcile" class="muted" style="padding:8px">Loading live website data…</div></div><div class="modal-footer"><button class="button primary" id="saveArtworkButton">Save Artwork</button><button class="button secondary" id="cancelArtworkButton">Cancel</button>${source?`<button class="button danger" id="deleteArtworkButton">Delete Artwork</button>`:''}</div></div></div>`;
    document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.tab-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');sf.$(`tab-${b.dataset.tab}`).classList.add('active');});
    this.renderWebsitePanel(artwork);
    document.querySelectorAll('.medium-toggle').forEach(toggle=>toggle.onchange=()=>document.querySelectorAll(`[data-size-medium="${toggle.dataset.medium}"]`).forEach(c=>c.checked=toggle.checked));
    sf.$('closeArtworkModal').onclick=sf.$('cancelArtworkButton').onclick=()=>sf.closeModal();
    if(sf.$('deleteArtworkButton'))sf.$('deleteArtworkButton').onclick=()=>{sf.closeModal();this.delete(artwork.id)};
    sf.$('chooseArtworkImage').onclick=()=>this.chooseImage();
    sf.$('saveArtworkButton').onclick=()=>this.save(source?artwork.id:'');
  },
  async chooseImage(){const sf=window.SF;try{const file=await sf.api.openImage({preferredName:sf.$('artTitle')?.value||'artwork'});if(!file)return;if(file.ok===false)throw new Error(file.error);sf.$('artImageData').value=file.data||'';sf.$('artImagePath').value=file.storedPath||file.sourcePath||'';sf.$('artImagePreview').innerHTML=`<img src="${file.data}">`;}catch(e){sf.logError(e,'Choose Artwork Image');alert('The image could not be loaded.');}},
  async save(originalId){
    const sf=window.SF;try{const title=sf.$('artTitle').value.trim();if(!title)return alert('Enter an artwork title.');
    // Same fallback as openEditor: this artwork may only exist via the merged catalog (never
    // natively promoted yet). Resolve its real identity first, so both the duplicate-title check
    // and the diff below compare against the truth, not a false "this looks brand new" read.
    const cid=String(originalId||'').trim();
    // Find EVERY native record that is really this piece -- by stored id OR by file id -- so a
    // legacy "ghost" copy saved under a different id gets folded into one instead of surviving as
    // a duplicate.
    const matchIdx=[];sf.state.artworks.forEach((a,i)=>{if(cid&&(String(a.id)===cid||String(a.artworkId)===cid))matchIdx.push(i);});
    const previous=(matchIdx.length?sf.state.artworks[matchIdx[0]]:null)||(cid?sf.artworkCatalog().find(a=>String(a.id)===cid||String(a.artworkId)===cid):null);
    const selfIds=new Set([cid,previous?.id,previous?.artworkId].filter(Boolean).map(String));
    // Same-title native records that aren't already recognized as THIS piece.
    const _norm=s=>String(s||'').trim().toLowerCase();
    const myImg=sf.$('artImagePath').value||sf.$('artImageData').value||previous?.image||previous?.imagePath||'';
    const _genShape=id=>/^ART-[a-z0-9]{4,}-\d+$/i.test(String(id||''));
    const myId=String(originalId||sf.$('artId').value||'');
    const sameTitleIdx=[];sf.state.artworks.forEach((a,i)=>{if(_norm(a.title)===_norm(title)&&!selfIds.has(String(a.id))&&!selfIds.has(String(a.artworkId)))sameTitleIdx.push(i);});
    // A same-title record that shares this piece's image -- OR carries a bug-generated ART-... id
    // while this piece has a real file id -- is a leftover "ghost" of the SAME artwork, spawned by
    // the old save-under-a-new-id bug. Absorb those. A same-title record that is a genuinely
    // different photo (different image, both real ids) is a real clash and still blocks the save.
    const _isGhost=a=>{const im=myImg&&(a.image===myImg||a.imagePath===myImg||a.imageData===myImg);return im||(_genShape(a.id)&&!_genShape(myId));};
    const ghostIdx=sameTitleIdx.filter(i=>_isGhost(sf.state.artworks[i]));
    const realIdx=sameTitleIdx.filter(i=>!ghostIdx.includes(i));
    if(realIdx.length){const c=sf.state.artworks[realIdx[0]];return alert(`Artwork titles must be unique.\n\nThis title matches a DIFFERENT artwork (a different photo), so it's a real clash:\nConflicting ID: ${c.id}\nConflicting title (exact): ${JSON.stringify(c.title)}\nThis piece's ID: ${originalId||'(new)'}\n\nGive one of the two a distinct title, then save again.`);}
    let absorbIdx=[];
    if(ghostIdx.length){const ids=ghostIdx.map(i=>sf.state.artworks[i].id).join(', ');if(!confirm(`An earlier bug left ${ghostIdx.length} leftover duplicate${ghostIdx.length===1?'':'s'} of this exact piece in your catalog (same photo + title).\n\nDuplicate ID${ghostIdx.length===1?'':'s'}: ${ids}\nKeeping: ${myId||'this piece'}\n\nClick OK to merge ${ghostIdx.length===1?'it':'them'} in (no variants lost) and finish saving.\nClick Cancel to change nothing.`))return;absorbIdx=ghostIdx.slice();}
    const limited={};document.querySelectorAll('.limited-price').forEach(i=>{if(i.value!==''){limited[i.dataset.medium] ||= {};limited[i.dataset.medium][i.dataset.size]=Number(i.value);}});const finalId=cid||sf.$('artId').value.trim()||sf.makeId('ART');const record={...previous,id:finalId,artworkId:previous?.artworkId||finalId,title,galleryId:sf.$('artGallery').value,orientation:sf.$('artOrientation').value,keywords:sf.$('artKeywords').value.split(',').map(x=>x.trim()).filter(Boolean),description:sf.$('artDescription').value,image:sf.$('artImagePath').value||sf.$('artImageData').value,imagePath:sf.$('artImagePath').value,permanentImagePath:sf.$('artImagePath').value,imageData:sf.$('artImageData').value,isLimitedEdition:sf.$('artLimited').checked||/limited edition/i.test(sf.state.galleries.find(g=>g.id===sf.$('artGallery').value)?.name||''),editionSize:Number(sf.$('editionSize').value)||null,limitedEditionStartingPrice:Number(sf.$('editionStartingPrice').value)||0,limitedEditionPricing:limited,products:Array.isArray(previous?.products)?previous.products:[],squarespace:previous?.squarespace||{imported:false,productIds:[]},createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};const selections={};document.querySelectorAll('[data-size-medium]:checked').forEach(i=>{selections[i.dataset.sizeMedium] ||= [];selections[i.dataset.sizeMedium].push(i.value);});const key=p=>`${p.mediumId}|||${p.size}`;const templates=sf.state.productTemplates||[];const midKey=p=>`${p.mediumId||templates.find(t=>t.name===p.medium)?.id||p.medium}|||${p.size}`;const isLive=p=>p.source==='Squarespace'||!!(p.productId||p.squarespaceProductId||p.variantId);const representable=p=>(!!p.mediumId&&templates.some(t=>t.id===p.mediumId))||templates.some(t=>t.name===p.medium);const desiredKeys=new Set(Object.entries(selections).flatMap(([m,szs])=>szs.map(s=>`${m}|||${s}`)));const liveBefore=(previous?.products||[]).filter(isLive);const liveBeforeKeys=new Set(liveBefore.map(midKey));window.SFProducts.buildFromSelections(record,selections);
    // Reconcile the site to exactly the variants you selected. A size you UNCHECKED that was live
    // (an imported/live variant) is a deliberate removal: drop it from this record and propose
    // removing it online. Only variants the editor could actually show (medium maps to a known
    // template) are eligible -- anything it couldn't display is left untouched, so a display gap
    // can never silently wipe live variants.
    const removedLive=liveBefore.filter(p=>representable(p)&&!desiredKeys.has(midKey(p)));const removedKeys=new Set(removedLive.map(midKey));record.products=record.products.filter(p=>!removedKeys.has(midKey(p)));
    // Variant changes become real Website Updates -- proposed here, reviewed and applied on the
    // Website Updates page, never pushed silently.
    // The Squarespace product these variants belong to (shared across the piece's live variants),
    // so an approved ADD_VARIANT can be created against the right product via the API.
    const sqProductId=(previous?.products||[]).map(p=>p.productId||p.squarespaceProductId).find(Boolean)||record.productId||record.squarespaceProductId||(record.squarespace?.productIds||[])[0]||'';
    if(window.SFWebsiteUpdates){
      const _added=record.products.filter(p=>!liveBeforeKeys.has(midKey(p)));
      // g76: with no Squarespace product there is nothing to add variants TO -- one ADD_VARIANT per
      // size would just queue a pile of blocked cards. Queue a single new-product update instead,
      // which g70 can actually create (hidden, image and all).
      if(!sqProductId&&_added.length){
        window.SFWebsiteUpdates.create({action:'ADD_PRODUCT',localProductId:record.id,productName:record.title,previousValue:'Not yet on Squarespace',requestedValue:`New product -- ${_added.length} variant(s)`,source:'artwork_editor'});
      }else _added.forEach(p=>{
        const _tpl=(window.SF.state.productTemplates||[]).find(t=>t.id===p.mediumId)||{};
        window.SFWebsiteUpdates.create({action:'ADD_VARIANT',field:'availability',localProductId:record.id,variantKey:midKey(p),squarespaceProductId:sqProductId,newVariantMedium:p.medium,newVariantSize:p.size,baseVariantMedium:_tpl.baseMediumName||'',optionSuffix:_tpl.optionSuffix||'',price:p.price,productName:`${record.title} (${p.medium} ${p.size})`,previousValue:'Not on website',requestedValue:'Add to website',source:'artwork_editor'});
      });
      removedLive.forEach(p=>{
        window.SFWebsiteUpdates.create({action:'REMOVE_VARIANT',localProductId:record.id,variantKey:midKey(p),squarespaceProductId:p.productId||p.squarespaceProductId,squarespaceVariantId:p.variantId||p.squarespaceVariantId,sku:p.sku,productName:`${record.title} (${p.medium} ${p.size})`,previousValue:'On website',requestedValue:'Remove from website',source:'artwork_editor'});
      });
    }
    // Fold any absorbed ghost duplicates into this record first, so no live variant / website
    // link is lost: keep every unique variant, and copy real product/variant IDs onto matches
    // that never went live.
    if(absorbIdx.length){const haveKey=new Set(record.products.map(key));absorbIdx.forEach(i=>{const g=sf.state.artworks[i];(g.products||[]).forEach(p=>{const k=key(p);if(!haveKey.has(k)){record.products.push(p);haveKey.add(k);}else{const ex=record.products.find(q=>key(q)===k);if(ex&&!ex.productId&&!ex.squarespaceProductId&&(p.productId||p.squarespaceProductId)){ex.productId=p.productId||ex.productId;ex.squarespaceProductId=p.squarespaceProductId||ex.squarespaceProductId;ex.variantId=p.variantId||ex.variantId;ex.squarespaceVariantId=p.squarespaceVariantId||ex.squarespaceVariantId;ex.sku=ex.sku||p.sku;}}});if(g.squarespace&&Array.isArray(g.squarespace.productIds)){record.squarespace=record.squarespace||{imported:false,productIds:[]};record.squarespace.productIds=Array.from(new Set([...(record.squarespace.productIds||[]),...g.squarespace.productIds]));if(g.squarespace.imported)record.squarespace.imported=true;}});}
    // If this title/id was previously tombstoned (deleted), re-creating or re-saving it clears the
    // tombstone so the catalog treats it as live again.
    if(Array.isArray(sf.state.removedArtworks)&&sf.state.removedArtworks.length){const rt=sf.titleKey(record.title);sf.state.removedArtworks=sf.state.removedArtworks.filter(t=>!(String(t.id||t.artworkId)===String(record.id)||String(t.artworkId||t.id)===String(record.artworkId)||(t.title&&rt&&sf.titleKey(t.title)===rt)));}
    const wasExisting=matchIdx.length>0;const removeIdx=Array.from(new Set([...matchIdx.slice(1),...absorbIdx])).filter(i=>i!==matchIdx[0]).sort((a,b)=>b-a);if(wasExisting)sf.state.artworks[matchIdx[0]]=record;else sf.state.artworks.push(record);removeIdx.forEach(i=>sf.state.artworks.splice(i,1));const mergedCount=(matchIdx.length>1?matchIdx.length-1:0)+absorbIdx.length;const gallery=sf.state.galleries.find(g=>g.id===record.galleryId);if(gallery&&!gallery.coverImage&&record.image){gallery.coverImage=record.image;gallery.coverMode='automatic';}sf.logActivity(`${wasExisting?'Updated':'Added'} artwork: ${record.title}${mergedCount>0?` (merged ${mergedCount} duplicate record${mergedCount===1?'':'s'})`:''}`);await sf.persist();sf.closeModal();sf.render();}catch(e){sf.logError(e,'Save Artwork');alert('Artwork could not be saved.');}
  },
  async delete(id){
    const sf=window.SF;
    let a=sf.state.artworks.find(x=>x.id===id);
    let nativeOnly=!!a;
    if(!a){
      // Same class of bug as openEditor/save/openArtworkMapping -- this artwork may only exist
      // via the merged catalog. Look it up there so the confirmation at least shows correctly
      // (previously this failed silently with no dialog and no visible effect at all).
      a=sf.artworkCatalog().find(x=>String(x.id)===String(id)||String(x.artworkId)===String(id));
      nativeOnly=false;
    }
    if(!a||!confirm(`Delete "${a.title}"? This cannot be undone.`))return;
    sf.state.artworks=sf.state.artworks.filter(x=>x.id!==id&&x.artworkId!==id);
    // Remember this deletion so the merged catalog won't resurrect it from a stale website cache
    // (those caches key on their own ids, so matching by title as well is what makes it stick).
    sf.state.removedArtworks=Array.isArray(sf.state.removedArtworks)?sf.state.removedArtworks:[];
    const _tid=String(a.id||a.artworkId||id),_ttl=String(a.title||'').trim();
    if(!sf.state.removedArtworks.some(t=>String(t.id||t.artworkId)===_tid||(t.title&&_ttl&&sf.titleKey(t.title)===sf.titleKey(_ttl))))sf.state.removedArtworks.push({id:a.id||id,artworkId:a.artworkId||a.id||id,title:_ttl,at:new Date().toISOString()});
    // A catalog-only artwork (never natively promoted) still exists in the old app's own
    // separate storage -- removing only from native state would let it silently reappear next
    // time the catalog rebuilds. Clear matching entries there too.
    try{
      const bridged=JSON.parse(localStorage.getItem('studioflow-website-artworks-bridge')||'[]');
      if(Array.isArray(bridged)){
        const filtered=bridged.filter(x=>String(x.id||x.artworkId)!==String(id)&&String(x.artworkId||x.id)!==String(id));
        if(filtered.length!==bridged.length)localStorage.setItem('studioflow-website-artworks-bridge',JSON.stringify(filtered));
      }
    }catch{}
    try{
      const web=JSON.parse(localStorage.getItem('fmpGalleryManager')||'null');
      if(Array.isArray(web?.artworks)){
        const filtered=web.artworks.filter(x=>String(x.artworkId||x.id)!==String(id));
        if(filtered.length!==web.artworks.length){ web.artworks=filtered; localStorage.setItem('fmpGalleryManager',JSON.stringify(web)); }
      }
    }catch{}
    const g=sf.state.galleries.find(x=>x.id===a.galleryId);if(g&&g.coverMode!=='manual'&&g.coverImage===a.image){const next=sf.state.artworks.find(x=>x.galleryId===g.id&&x.image);g.coverImage=next?.image||'';g.coverMode='automatic';}sf.logActivity(`Deleted artwork: ${a.title}`);await sf.persist();sf.render();}
};
