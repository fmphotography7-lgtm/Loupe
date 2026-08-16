/* StudioFlow 3.9.0 · Product Health (native) -- replaces the old iframe page, which was checking
   its own separate, stale artwork data. This checks the real catalogue and gives every finding a
   direct fix-link into the actual editor, rather than leaving you to guess where to address it. */
window.SFProductHealth = {
  findings(){
    const sf = window.SF;
    const catalog = sf.artworkCatalog().filter(a => a.status !== 'Retired');
    const norm = v => String(v || '').trim().toLowerCase();

    const titleMap = new Map();
    catalog.forEach(a => { const k = norm(a.title); if (!titleMap.has(k)) titleMap.set(k, []); titleMap.get(k).push(a); });
    const duplicateTitles = [...titleMap.values()].filter(x => x.length > 1).flat();

    const serviceRecords = catalog.filter(a => /service|wedding package|deposit|test product/i.test(a.title || ''));

    const missingImages = catalog.filter(a => !(a.image || a.thumbnail || a.imageData));
    const missingVariants = catalog.filter(a => !(a.products || []).length);

    const missingUrls = catalog.filter(a => !(a.currentUrl || '').trim() && !(a.preferredUrl || '').trim());
    const urlMap = new Map();
    catalog.forEach(a => { const k = norm(a.preferredUrl || a.currentUrl); if (k) { if (!urlMap.has(k)) urlMap.set(k, []); urlMap.get(k).push(a); } });
    const duplicateUrls = [...urlMap.values()].filter(x => x.length > 1).flat();

    const skuMap = new Map();
    catalog.forEach(a => (a.products || []).forEach(p => { const k = norm(p.sku); if (k) { if (!skuMap.has(k)) skuMap.set(k, []); skuMap.get(k).push(a); } }));
    const duplicateSkus = [...new Set([...skuMap.values()].filter(x => x.length > 1).flat())];

    // Orphaned variants -- an artwork's product entry pointing at a medium/size combo that no
    // longer exists (e.g. removed via Manage Mediums & Sizes after this artwork already used it).
    const templates = sf.state.productTemplates || [];
    const validKey = new Set(templates.flatMap(t => (t.sizes || []).map(sz => `${t.id}|||${sz}`)));
    const orphanedVariants = catalog.filter(a => (a.products || []).some(p => p.source !== 'Squarespace' && p.mediumId && !validKey.has(`${p.mediumId}|||${p.size}`)));

    return { duplicateTitles, serviceRecords, missingImages, missingVariants, missingUrls, duplicateUrls, duplicateSkus, orphanedVariants,
      total: duplicateTitles.length + serviceRecords.length + missingImages.length + missingVariants.length + missingUrls.length + duplicateUrls.length + duplicateSkus.length + orphanedVariants.length };
  },
  duplicateGroups(){
    const sf = window.SF;
    const norm = v => String(v || '').trim().toLowerCase();
    const map = new Map();
    this.findings().duplicateTitles.forEach(a => { const k = norm(a.title); if (!map.has(k)) map.set(k, []); map.get(k).push(a); });
    return [...map.values()];
  },
  render(){
    const sf = window.SF;
    const f = this.findings();
    const section = (label, items, fixType) => `<div class="health-section"><h3>${sf.esc(label)} <span class="pill">${items.length}</span></h3>${items.length ? `<div class="commerce-table">${items.map(a => `<div class="commerce-row"><span><b>${sf.esc(a.title || 'Untitled')}</b></span><span><button class="mini-edit" data-health-fix="${sf.esc(a.id || a.artworkId)}" data-health-fix-type="${fixType}">Fix</button></span></div>`).join('')}</div>` : '<div class="muted health-none">None -- all clear.</div>'}</div>`;
    const groups = this.duplicateGroups();
    const dupSection = `<div class="health-section"><h3>Duplicate artwork titles <span class="pill">${f.duplicateTitles.length}</span></h3>${groups.length ? groups.map((g, gi) => `<div class="dup-group"><p class="muted">"${sf.esc(g[0].title)}" -- ${g.length} copies. Often caused by an old bug creating a second "ghost" copy when editing through Fix links before this was resolved. Pick the real one to keep.</p><div class="commerce-table">${g.map(a => `<div class="commerce-row"><span>${a.image ? `<img class="dup-thumb" src="${sf.esc(a.image)}">` : '<small class="muted">No image</small>'}</span><span><b>${sf.esc(a.title)}</b><small>${(a.products || []).length} variant(s) · ${sf.esc(a.gallery || 'No gallery')} · ID ${sf.esc(a.id || a.artworkId)}</small></span><span><button class="mini-edit" data-keep-dup="${sf.esc(a.id || a.artworkId)}" data-dup-group="${gi}">Keep This One</button></span></div>`).join('')}</div></div>`).join('') : '<div class="muted health-none">None -- all clear.</div>'}</div>`;
    sf.$('workspace').innerHTML = `<div class="page-stack"><section class="dashboard-hero"><div><div class="section-kicker">PRODUCTS &amp; INVENTORY</div><h2>Product Health</h2><p class="muted">Checks your real, current artwork catalogue -- not a separate copy. Every finding links directly to where you actually fix it.</p></div></section>
      <div class="commerce-kpis"><div><b>${f.total}</b><span>Total findings</span></div><div><b>${f.missingImages.length}</b><span>Missing images</span></div><div><b>${f.missingVariants.length}</b><span>Missing variants</span></div><div><b>${f.missingUrls.length + f.duplicateUrls.length}</b><span>URL issues</span></div></div>
      <section class="card">
        ${dupSection}
        ${section('Service/test records still in artwork catalogue', f.serviceRecords, 'edit')}
        ${section('Missing images', f.missingImages, 'edit')}
        ${section('No saved product variants', f.missingVariants, 'edit')}
        ${section('Missing product URL / Squarespace mapping', f.missingUrls, 'map')}
        ${section('Duplicate product URLs', f.duplicateUrls, 'map')}
        ${section('Duplicate SKUs across variants', f.duplicateSkus, 'edit')}
        ${section('Variants pointing at a removed size/medium', f.orphanedVariants, 'edit')}
      </section>
    </div>`;
    document.querySelectorAll('[data-keep-dup]').forEach(b => b.onclick = () => this.mergeDuplicateArtworks(groups[Number(b.dataset.dupGroup)], b.dataset.keepDup));
    document.querySelectorAll('[data-health-fix]').forEach(b => b.onclick = () => {
      const id = b.dataset.healthFix, type = b.dataset.healthFixType;
      if (type === 'map' && window.SFGalleries) window.SFGalleries.openArtworkMapping(id);
      else if (window.SFArtworks) window.SFArtworks.openEditor(id);
    });
  },
  mergeDuplicateArtworks(group, keepId){
    const sf = window.SF, s = sf.state;
    const keep = group.find(a => String(a.id || a.artworkId) === keepId);
    const remove = group.filter(a => String(a.id || a.artworkId) !== keepId);
    if (!keep || !remove.length) return;
    if (!confirm(`Keep "${keep.title}" (${keepId.slice(0,12)}...) and delete ${remove.length} other cop${remove.length===1?'y':'ies'}?\n\nEverything pointing at the deleted cop${remove.length===1?'y':'ies'} -- inventory, print jobs, order history -- gets redirected to the one you're keeping first, so nothing gets orphaned. This cannot be undone.`)) return;
    let redirected = 0;
    remove.forEach(bad => {
      const badId = String(bad.id || bad.artworkId);
      [s.inventoryItems, s.printJobs, s.websiteOrderItems].forEach(list => {
        (list || []).forEach(item => {
          if (String(item.artworkId) === badId) { item.artworkId = keepId; item.artworkTitle = keep.title; redirected++; }
        });
      });
      // If a gallery's cover image happens to point at the deleted copy's image, and the kept
      // copy has an image too, repoint the cover rather than leave it referencing nothing.
      (s.galleries || []).forEach(g => {
        if (g.coverMode === 'automatic' && g.coverImage === bad.image && keep.image) g.coverImage = keep.image;
      });
      // Only remove it from real native storage -- if it only ever existed via the merged
      // catalog (never promoted), there's nothing in sf.state.artworks to delete.
      s.artworks = (s.artworks || []).filter(a => String(a.id) !== badId);
    });
    sf.logActivity(`Merged ${remove.length} duplicate cop${remove.length===1?'y':'ies'} of "${keep.title}" into one (${redirected} reference(s) redirected)`);
    sf.persist();
    alert(`Merged. ${redirected} reference(s) redirected to the copy you kept.`);
    this.render();
  },
};
