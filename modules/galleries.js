
window.SFGalleries = {
  openEditor(id=''){
    const sf=window.SF;
    const current=sf.state.galleries.find(g=>g.id===id)||{
      id:sf.makeId('GAL'),name:'',description:'',coverImage:'',coverMode:'automatic'
    };
    const firstArtwork=sf.state.artworks.find(a=>(window.SF.artworkInGallery(a,current))&&a.image);
    const displayedCover=current.coverImage||firstArtwork?.image||'';

    sf.$('modalRoot').innerHTML=`
      <div class="modal-backdrop"><div class="modal">
        <div class="modal-head"><h2>${id?'Edit':'New'} Gallery</h2><button class="close-button" id="closeGalleryModal">×</button></div>
        <div class="grid2">
          <div>
            <label>Gallery Name</label><input id="galleryName" value="${sf.esc(current.name)}">
            <label>Description</label><textarea id="galleryDescription">${sf.esc(current.description||'')}</textarea>
          </div>
          <div>
            <div class="preview-mini" id="galleryCoverPreview">${displayedCover?`<img src="${displayedCover}">`:'No cover image'}</div>
            <input type="hidden" id="galleryCoverData">
            <input type="hidden" id="galleryCoverMode">
            <div class="help">By default, StudioFlow uses the first artwork in this gallery as its cover. Choose a cover here to override it.</div>
            <div class="row-actions">
              <button class="button secondary" id="chooseGalleryCover">Choose Custom Cover</button>
              <button class="button secondary" id="useAutomaticCover">Use First Artwork</button>
            </div>
          </div>
        </div>
        <div class="row-actions">
          <button class="button primary" id="saveGalleryButton">Save Gallery</button>
          <button class="button secondary" id="cancelGalleryButton">Cancel</button>
        </div>
      </div></div>`;

    sf.$('galleryCoverData').value=current.coverImage||'';
    sf.$('galleryCoverMode').value=current.coverMode||'automatic';
    sf.$('closeGalleryModal').addEventListener('click',()=>sf.closeModal());
    sf.$('cancelGalleryButton').addEventListener('click',()=>sf.closeModal());
    sf.$('chooseGalleryCover').addEventListener('click',()=>this.chooseCover());
    sf.$('useAutomaticCover').addEventListener('click',()=>this.useAutomaticCover(current));
    sf.$('saveGalleryButton').addEventListener('click',()=>this.save(id));
  },
  async chooseCover(){
    const sf=window.SF;
    const file=await sf.api.openImage();
    if(!file)return;
    sf.$('galleryCoverData').value=file.data;
    sf.$('galleryCoverMode').value='manual';
    sf.$('galleryCoverPreview').innerHTML=`<img src="${file.data}">`;
  },
  useAutomaticCover(current){
    const sf=window.SF;
    const firstArtwork=sf.state.artworks.find(a=>(window.SF.artworkInGallery(a,current))&&a.image);
    sf.$('galleryCoverData').value='';
    sf.$('galleryCoverMode').value='automatic';
    sf.$('galleryCoverPreview').innerHTML=firstArtwork?.image?`<img src="${firstArtwork.image}">`:'No cover image';
  },
  async save(originalId){
    const sf=window.SF;
    const name=sf.$('galleryName').value.trim();
    if(!name)return alert('Enter a gallery name.');
    if(sf.state.galleries.some(g=>g.name.toLowerCase()===name.toLowerCase()&&g.id!==originalId)){
      return alert('Gallery names must be unique.');
    }

    const previous=sf.state.galleries.find(g=>g.id===originalId);
    const record={
      id:previous?.id||sf.makeId('GAL'),
      name,
      description:sf.$('galleryDescription').value,
      coverImage:sf.$('galleryCoverData').value,
      coverMode:sf.$('galleryCoverMode').value||'automatic'
    };
    const index=sf.state.galleries.findIndex(g=>g.id===originalId);
    if(index>=0)sf.state.galleries[index]=record;else sf.state.galleries.push(record);

    if(previous&&previous.name!==name){
      sf.state.artworks.filter(a=>a.gallery===previous.name).forEach(a=>{
        a.gallery=name;a.galleryId=record.id;
      });
    }

    sf.logActivity(`${index>=0?'Updated':'Added'} gallery: ${name}`);
    await sf.persist();
    sf.closeModal();
    this.render();
  },
  async delete(id){
    const sf=window.SF;
    const gallery=sf.state.galleries.find(g=>g.id===id);
    if(!gallery)return;
    const count=sf.state.artworks.filter(a=>window.SF.artworkInGallery(a,gallery)).length;
    if(count)return alert('Move artwork out of this gallery before deleting it.');
    if(!confirm(`Delete gallery "${gallery.name}"?`))return;
    sf.state.galleries=sf.state.galleries.filter(g=>g.id!==id);
    sf.logActivity(`Deleted gallery: ${gallery.name}`);
    await sf.persist();
    this.render();
  }
};

/* StudioFlow 11.1.2 catalogue-aware gallery manager */
window.SFGalleries.render=function(){const sf=window.SF;sf.healGalleryNamesOnce&&sf.healGalleryNamesOnce(),catalog=sf.artworkCatalog(),norm=v=>String(v||'').trim().toLowerCase(),matches=(a,g)=>window.SF.artworkInGallery(a,g);
  // An artwork needs attention if it's untagged entirely, OR if it names a gallery (via
  // gallery/galleryName/category) that doesn't match any current gallery by ID or by name --
  // typically because a gallery's name changed outside the normal rename flow and left it behind.
  const orphaned=catalog.filter(a=>{
    const tag=a.gallery||a.galleryName||a.category;
    if(!tag)return true; // untagged entirely -- previously invisible to this check
    return !sf.state.galleries.some(g=>matches(a,g));
  });
  sf.$('workspace').innerHTML=`<div class="card"><div class="toolbar"><div><h2 style="margin:0">Gallery Manager</h2><small style="color:var(--muted)">All catalogue artwork, including imported website artwork, appears here. Each gallery also shows its Squarespace mapping status.</small></div><div class="row-actions"><button class="button secondary" id="importSquarespaceGallery">Import Squarespace CSV</button><button class="button secondary" id="newArtworkButton">＋ New Artwork</button><button class="button primary" id="addGalleryButton">Add Gallery</button></div></div>${orphaned.length?`<div class="notice">${orphaned.length} artwork${orphaned.length===1?' is':'s are'} unassigned or tagged with a gallery name that doesn't match any gallery listed below -- they won't appear in any gallery here even though they exist in your catalogue. <button class="button secondary" id="repairGalleryLinks">Review &amp; Fix</button></div>`:''}<div class="gallery-grid">${sf.state.galleries.map(g=>{const items=catalog.filter(a=>matches(a,g)),first=items.find(a=>a.image||a.thumbnail||a.imageData),cover=g.coverImage||first?.image||first?.thumbnail||first?.imageData||String(first?.imageUrls||'').split(/\s+/)[0]||'';
    const mapped=items.filter(a=>a.productId||a.squarespaceProductId).length;
    const pendingUrl=items.filter(a=>{const u=a.currentUrl||a.preferredUrl||'';return /-new$|-migration$/i.test(u)}).length;
    return `<div class="gallery-card"><div class="image-box" data-open-gallery="${g.id}" style="cursor:pointer">${cover?`<img src="${sf.esc(cover)}">`:'No cover image'}</div><div class="card-copy"><b class="gallery-title-link" data-open-gallery="${g.id}" style="cursor:pointer">${sf.esc(g.name)}</b><small>${items.length} artwork</small><p class="muted gallery-map-status">${mapped}/${items.length} mapped to a Squarespace product${pendingUrl?` · ${pendingUrl} with a pending/unfinished URL`:''}</p><div class="gallery-art-strip">${items.slice(0,5).map(a=>{const im=a.thumbnail||a.image||a.imageData||String(a.imageUrls||'').split(/\s+/)[0]||'';return im?`<img src="${sf.esc(im)}" title="${sf.esc(a.title||'Artwork')}" class="gallery-art-thumb" data-edit-art="${sf.esc(a.id||a.artworkId)}">`:''}).join('')}</div><div class="row-actions"><button class="button primary" data-open-gallery="${g.id}">Open Gallery</button><button class="button secondary edit-gallery" data-id="${g.id}">Edit</button><button class="button secondary" data-map-gallery="${g.id}">Website Mapping</button><button class="button danger delete-gallery" data-id="${g.id}">Delete</button></div></div></div>`}).join('')}</div></div>`;
  sf.$('addGalleryButton').addEventListener('click',()=>this.openEditor());
  sf.$('newArtworkButton').addEventListener('click',()=>this.openNewArtwork());
  sf.$('importSquarespaceGallery').addEventListener('click',()=>window.SFSquarespace.import());
  document.querySelectorAll('.edit-gallery').forEach(b=>b.onclick=()=>this.openEditor(b.dataset.id));
  document.querySelectorAll('.delete-gallery').forEach(b=>b.onclick=()=>this.delete(b.dataset.id));
  document.querySelectorAll('[data-map-gallery]').forEach(b=>b.onclick=()=>this.openGalleryMapping(b.dataset.mapGallery));
  document.querySelectorAll('[data-edit-art]').forEach(b=>b.onclick=()=>window.SFArtworks.openEditor(b.dataset.editArt));
  document.querySelectorAll('[data-open-gallery]').forEach(b=>b.onclick=()=>this.openGalleryView(b.dataset.openGallery));
  const repairBtn=sf.$('repairGalleryLinks');
  if(repairBtn)repairBtn.onclick=()=>this.reviewOrphanedArtwork(orphaned);
};
window.SFGalleries.openGalleryView=function(galleryId){
  const sf=window.SF,catalog=sf.artworkCatalog();
  const norm=v=>String(v||'').trim().toLowerCase();
  const g=sf.state.galleries.find(x=>x.id===galleryId);
  if(!g)return;
  const items=catalog.filter(a=>String(a.galleryId||'')===String(g.id)||norm(a.gallery||a.galleryName||a.category)===norm(g.name));
  sf.$('workspace').innerHTML=`<div class="card"><div class="toolbar"><div><button class="button secondary" id="backToGalleries">← All Galleries</button><h2 style="margin:8px 0 0">${sf.esc(g.name)}</h2><small style="color:var(--muted)">${items.length} artwork · click any piece to edit its details, variants, or Limited Edition settings</small></div><button class="button primary" id="galleryAddArt">＋ New Artwork Here</button></div><div class="gallery-full-grid">${items.map(a=>{const im=a.thumbnail||a.image||a.imageData||String(a.imageUrls||'').split(/\s+/)[0]||'';const variantCount=(a.products||[]).length;return `<div class="gallery-full-item" data-edit-art="${sf.esc(a.id||a.artworkId)}"><button class="gallery-full-delete" data-quick-delete-art="${sf.esc(a.id||a.artworkId)}" data-art-title="${sf.esc(a.title||'Untitled')}" title="Delete">×</button><div class="image-box">${im?`<img src="${sf.esc(im)}">`:'No image'}</div><b>${sf.esc(a.title||'Untitled')}</b><small>${variantCount} variant${variantCount===1?'':'s'}${a.isLimitedEdition?' · Limited Edition':''}</small></div>`}).join('')||'<div class="empty-state roomy">No artwork in this gallery yet.</div>'}</div></div>`;
  sf.$('backToGalleries').onclick=()=>this.render();
  sf.$('galleryAddArt').onclick=()=>this.openNewArtwork(galleryId);
  document.querySelectorAll('[data-edit-art]').forEach(el=>el.onclick=()=>window.SFArtworks.openEditor(el.dataset.editArt));
  document.querySelectorAll('[data-quick-delete-art]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();window.SFArtworks.delete(btn.dataset.quickDeleteArt).then(()=>this.openGalleryView(galleryId))});
};
window.SFGalleries.openGalleryMapping=function(galleryId){
  const sf=window.SF,catalog=sf.artworkCatalog(),g=sf.state.galleries.find(x=>x.id===galleryId);
  const norm=v=>String(v||'').trim().toLowerCase();
  const items=catalog.filter(a=>String(a.galleryId||'')===String(g.id)||norm(a.gallery||a.galleryName||a.category)===norm(g.name));
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Website Mapping — ${sf.esc(g.name)}</h2><p class="muted">Squarespace product ID and URL for each artwork in this gallery. Click one to edit.</p><div class="commerce-table"><div class="commerce-row header"><span>Artwork</span><span>Product ID</span><span>URL</span><span></span></div>${items.map(a=>{const id=a.id||a.artworkId,pid=a.productId||a.squarespaceProductId||'',url=a.preferredUrl||a.currentUrl||'',pending=/-new$|-migration$/i.test(url);return `<div class="commerce-row"><span>${sf.esc(a.title||'Untitled')}</span><span>${pid?sf.esc(pid):'<small class="muted">Not mapped</small>'}</span><span>${url?sf.esc(url):'<small class="muted">None</small>'}${pending?' <small class="danger-text">(pending)</small>':''}</span><span><button class="mini-edit" data-map-art="${sf.esc(id)}">Edit</button></span></div>`}).join('')||'<div class="empty-state">No artwork in this gallery yet.</div>'}</div><div class="row-actions"><button class="button primary" id="mapClose">Close</button></div></div></div>`;
  sf.$('mapClose').onclick=()=>sf.closeModal();
  document.querySelectorAll('[data-map-art]').forEach(b=>b.onclick=()=>this.openArtworkMapping(b.dataset.mapArt));
};
window.SFGalleries.openArtworkMapping=function(artworkId){
  const sf=window.SF;
  let art=sf.state.artworks.find(a=>String(a.id)===artworkId||String(a.artworkId)===artworkId);
  if(!art){
    // Same class of bug as openEditor/save -- this artwork may only exist via the merged catalog
    // (never natively promoted). Find it there, then promote it into real native storage now,
    // so the mutations below actually persist to something real instead of a throwaway object
    // artworkCatalog() returns fresh each call.
    const catalogMatch=sf.artworkCatalog().find(a=>String(a.id)===String(artworkId)||String(a.artworkId)===String(artworkId));
    if(!catalogMatch){alert('Could not find that artwork.');return}
    art={...catalogMatch,id:artworkId,artworkId};
    sf.state.artworks.push(art);
  }
  const groups=window.SFSquarespace?window.SFSquarespace.productGroups(art):[];
  const variantDetail=groups.length?`<h3>Squarespace Variants</h3>${groups.map((g,gi)=>`<div class="sq-product"><div class="sq-product-head"><small>Squarespace Product ${gi+1}</small><code>${sf.esc(g.productId)}</code></div><div class="table-wrap"><table><thead><tr><th>Medium</th><th>Size</th><th>Price</th><th>SKU</th><th>Variant ID</th></tr></thead><tbody>${g.variants.map(v=>`<tr><td>${sf.esc(v.medium)}</td><td>${sf.esc(v.size)}</td><td>$${Number(v.price||0).toFixed(2)}</td><td>${sf.esc(v.sku||'')}</td><td><code>${sf.esc(v.variantId||'')}</code></td></tr>`).join('')}</tbody></table></div></div>`).join('')}`:'<p class="muted">No Squarespace variants imported for this artwork yet.</p>';
  // Look for a matching synced product by title or existing product ID -- if found, we already
  // know the real URL from your last sync, so there's no reason to make you type it in from
  // memory or guess at it.
  const norm=v=>String(v||'').trim().toLowerCase();
  const synced=(sf.state.websiteProducts||[]).find(p=>(art.productId&&String(p.id)===String(art.productId))||norm(p.name||p.title)===norm(art.title));
  const syncedNote=synced?`<p class="muted">Auto-filled from your last product sync (${sf.state.squarespace?.lastProductSync?new Date(sf.state.squarespace.lastProductSync).toLocaleDateString():'unknown date'}).</p>`:`<p class="muted">No matching product found in your last sync -- run Sync Products (Sales &amp; Orders) first if this should have a live match, or leave blank if this piece isn't on the site yet.</p>`;
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Website Mapping</h2><p class="muted">${sf.esc(art.title||'Untitled')}</p>${syncedNote}<label>Squarespace Product ID<input id="mapProductId" value="${sf.esc(art.productId||art.squarespaceProductId||synced?.id||'')}" placeholder="e.g. 6a53eed66d53a147293a3909"></label><label>Current URL<input id="mapCurrentUrl" value="${sf.esc(art.currentUrl||synced?.url||'')}"></label><label>Preferred URL <small class="muted">(optional -- only needed if you want this piece's URL to change to something different than what's live now)</small><input id="mapPreferredUrl" value="${sf.esc(art.preferredUrl||'')}"></label><div class="row-actions"><button class="button secondary" id="mapCancel">Cancel</button><button class="button primary" id="mapSave">Save Mapping</button></div>${variantDetail}</div></div>`;
  sf.$('mapCancel').onclick=()=>sf.closeModal();
  sf.$('mapSave').onclick=async()=>{
    try{
      art.productId=sf.$('mapProductId').value.trim();
      art.currentUrl=sf.$('mapCurrentUrl').value.trim();
      art.preferredUrl=sf.$('mapPreferredUrl').value.trim();
      art.updatedAt=new Date().toISOString();
      // Remember this mapping by title so it survives no matter how the website cache re-adds the
      // piece -- this is what stops a mapped piece (e.g. Si'Wash Rock) reappearing as "missing URL".
      sf.state.squarespace=sf.state.squarespace||{};
      sf.state.squarespace.urlByTitle=sf.state.squarespace.urlByTitle||{};
      if(art.title)sf.state.squarespace.urlByTitle[sf.titleKey(art.title)]={currentUrl:art.currentUrl,preferredUrl:art.preferredUrl,productId:art.productId};
      sf.logActivity(`Updated website mapping for ${art.title||'artwork'}`);
      await sf.persist();
      sf.closeModal();
      sf.render();
    }catch(err){
      sf.logError?.(err,'Save Website Mapping');
      alert(`Something went wrong saving this mapping: ${err.message||err}\n\nNothing was saved. Please try again, and if this keeps happening, let me know exactly what this says.`);
    }
  };
};
window.SFGalleries.openNewArtwork=function(preselectedGalleryId){
  const sf=window.SF,s=sf.state;
  const templates=(s.productTemplates||[]).filter(t=>t.enabled!==false);
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal-card wide" id="newArtworkForm"><h2>New Artwork</h2>
    <label>Title<input id="naTitle" required></label>
    <label>File ID<input id="naFileId" value="${sf.esc(sf.nextArtworkId?sf.nextArtworkId():'')}" required></label>
    <small class="muted">The next number in your FMP sequence. Change it only if you're deliberately filling a gap.</small>
    <label>Gallery<select id="naGallery">${s.galleries.map(g=>`<option value="${g.id}" ${g.id===preselectedGalleryId?'selected':''}>${sf.esc(g.name)}</option>`).join('')||'<option value="">No galleries yet -- add one first</option>'}</select></label>
    <div class="row-actions"><button type="button" class="button secondary" id="naChooseImage">Choose Image</button><span id="naImagePreview" class="preview-mini"></span></div>
    <input type="hidden" id="naImageData">
    <h3>Variants</h3>
    <label class="checkline"><input type="radio" name="naVariantType" value="standard" checked> Standard -- use the common size/medium set most pieces share</label>
    <label class="checkline"><input type="radio" name="naVariantType" value="custom"> Custom -- this piece only offers a specific set (e.g. Cox Bay)</label>
    <div id="naCustomVariants" style="display:none">${templates.map(t=>`<div><b>${sf.esc(t.name)}</b> ${(t.sizes||[]).map(sz=>`<label class="checkline inline"><input type="checkbox" class="naCustomCheck" data-medium="${t.id}" data-size="${sf.esc(sz)}"> ${sf.esc(sz)}</label>`).join('')||'<small class="muted">No sizes on file for this medium</small>'}</div>`).join('')}</div>
    <p class="muted">This creates the artwork in StudioFlow and its gallery immediately. Getting it live on Squarespace goes through Website Updates for confirmation -- approve it there and StudioFlow creates the product, its priced sizes and the image on your store as a HIDDEN product, which you make visible once you've checked it.</p>
    <div class="row-actions"><button type="button" class="button secondary" id="naCancel">Cancel</button><button class="button primary">Create Artwork</button></div>
  </form></div>`;
  sf.$('naCancel').onclick=()=>sf.closeModal();
  sf.$('naChooseImage').onclick=async()=>{
    const file=await sf.api.openImage();
    if(!file)return;
    sf.$('naImageData').value=file.data;
    sf.$('naImagePreview').innerHTML=`<img src="${file.data}">`;
  };
  document.querySelectorAll('[name="naVariantType"]').forEach(r=>r.onchange=()=>{
    sf.$('naCustomVariants').style.display=document.querySelector('[name="naVariantType"]:checked').value==='custom'?'block':'none';
  });
  sf.$('newArtworkForm').onsubmit=async e=>{
    e.preventDefault();
    const galleryId=sf.$('naGallery').value;
    const gallery=s.galleries.find(g=>g.id===galleryId);
    if(!gallery)return alert('Add a gallery first.');
    const variantType=document.querySelector('[name="naVariantType"]:checked').value;
    let products=[];
    if(variantType==='standard'){
      // Every medium/size combination that currently has a standard price set -- the common set
      // most pieces share.
      const pricing=window.SFPricing?.ensure()||s.pricing||{};
      templates.forEach(t=>(t.sizes||[]).forEach(sz=>{
        if(Number(pricing.standard?.[t.id]?.[sz]||0)>0)products.push({mediumId:t.id,size:sz,source:'StudioFlow'});
      }));
    }else{
      document.querySelectorAll('.naCustomCheck:checked').forEach(cb=>products.push({mediumId:cb.dataset.medium,size:cb.dataset.size,source:'StudioFlow'}));
    }
    // One id, used for both fields. Two separate makeId('ART') calls meant a new piece's id and
    // artworkId disagreed, and neither matched the FMP-#### house numbering.
    const fileId=(sf.$('naFileId')?.value||'').trim()||(sf.nextArtworkId?sf.nextArtworkId():sf.makeId('ART'));
    const clash=(s.artworks||[]).some(a=>String(a.id||'').toUpperCase()===fileId.toUpperCase()||String(a.artworkId||'').toUpperCase()===fileId.toUpperCase());
    if(clash)return alert(`File ID ${fileId} is already used by another piece. Pick a different one.`);
    const art={id:fileId,artworkId:fileId,title:sf.$('naTitle').value.trim(),gallery:gallery.name,galleryId:gallery.id,image:sf.$('naImageData').value||'',isLimitedEdition:false,products,createdAt:new Date().toISOString()};
    s.artworks.push(art);
    // Tracked in Website Updates for visibility/confirmation -- matches how every other website
    // change already works (propose, confirm, then act), rather than pushing anything live
    // automatically.
    if(window.SFWebsiteUpdates){
      window.SFWebsiteUpdates.create?.({action:'ADD_PRODUCT',localProductId:art.id,productName:art.title,previousValue:'Not yet on Squarespace',requestedValue:`New product -- ${gallery.name}, ${products.length} variant(s) (${variantType})`,source:'gallery_new_artwork'});
    }
    sf.logActivity(`Created new artwork: ${art.title} (${gallery.name})`);
    await sf.persist();
    sf.closeModal();
    this.render();
  };
};
window.SFGalleries.reviewOrphanedArtwork=function(orphaned){
  const sf=window.SF;
  // Suggest a match for each orphaned artwork: a current gallery whose name contains the
  // orphaned tag, or vice versa (e.g. "West Coast Landscapes" contains "Landscapes").
  const suggest=tag=>{
    const n=String(tag||'').trim().toLowerCase();
    if(!n)return null;
    return sf.state.galleries.find(g=>{const gn=g.name.toLowerCase();return gn.includes(n)||n.includes(gn)});
  };
  const rows=orphaned.map(a=>{
    const tag=a.gallery||a.galleryName||a.category;
    const suggestion=suggest(tag);
    return `<div class="commerce-row"><span><b>${sf.esc(a.title||'Untitled artwork')}</b></span><span>${tag?`Currently tagged: "${sf.esc(tag)}"`:'<small class="muted">No gallery assigned</small>'}</span><span><select data-orphan-fix="${sf.esc(a.id||a.artworkId)}"><option value="">Leave as-is</option>${sf.state.galleries.map(g=>`<option value="${sf.esc(g.id)}" ${suggestion&&suggestion.id===g.id?'selected':''}>${sf.esc(g.name)}</option>`).join('')}</select></span></div>`;
  }).join('');
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card wide"><h2>Fix Unlinked Artwork</h2><p class="muted">Suggested matches are pre-selected where a current gallery name contains the artwork's old tag. Review each one, then apply.</p><div class="commerce-table">${rows}</div><div class="row-actions"><button class="button secondary" id="orphanCancel">Cancel</button><button class="button primary" id="orphanApply">Apply Fixes</button></div></div></div>`;
  sf.$('orphanCancel').onclick=()=>sf.closeModal();
  sf.$('orphanApply').onclick=async()=>{
    let fixed=0;
    document.querySelectorAll('[data-orphan-fix]').forEach(sel=>{
      if(!sel.value)return;
      const artworkId=sel.dataset.orphanFix;
      const art=orphaned.find(a=>String(a.id||a.artworkId)===artworkId);
      const gallery=sf.state.galleries.find(g=>g.id===sel.value);
      if(art&&gallery){art.galleryId=gallery.id;art.gallery=gallery.name;fixed++}
    });
    sf.logActivity(`Relinked ${fixed} artwork(s) to the correct gallery`);
    await sf.persist();
    sf.closeModal();
    this.render();
    alert(`${fixed} artwork(s) relinked.`);
  };
};
