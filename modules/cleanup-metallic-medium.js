/* StudioFlow 3.9.0 · Automatic medium cleanup -- merges "Unspecified" and "Metallic Luster" (not
   "...Paper") into "Metallic Luster Paper" on load. Idempotent: does nothing once already merged,
   safe to run every startup. Reuses the same redirect logic as the manual Merge Duplicate Mediums
   tool on the Pricing page -- every artwork variant, price, cost, and add-on pointing at the old
   ones gets redirected before they're removed. */
(function(){
  const sf=window.SF; if(!sf) return;
  const templates=sf.state.productTemplates||[];
  const into=templates.find(t=>String(t.name||'').trim().toLowerCase()==='metallic luster paper');
  if(!into) return; // nothing to merge into -- leave everything as-is rather than guess
  const duplicates=templates.filter(t=>t.id!==into.id&&['metallic luster','unspecified'].includes(String(t.name||'').trim().toLowerCase()));
  if(!duplicates.length) return; // already clean

  let artworkCount=0;
  duplicates.forEach(from=>{
    (sf.state.artworks||[]).forEach(a=>{
      let touched=false;
      (a.products||[]).forEach(p=>{ if(p.mediumId===from.id){ p.mediumId=into.id; p.medium=into.name; touched=true; } });
      if(touched) artworkCount++;
    });
    const p=sf.state.pricing||{};
    if(p.standard?.[from.id]){ p.standard[into.id]=p.standard[into.id]||{}; Object.entries(p.standard[from.id]).forEach(([size,price])=>{ if(!Number(p.standard[into.id][size]||0)) p.standard[into.id][size]=price; }); delete p.standard[from.id]; }
    if(p.costs?.[from.id]){ p.costs[into.id]=p.costs[into.id]||{}; Object.entries(p.costs[from.id]).forEach(([size,cost])=>{ if(!Number(p.costs[into.id][size]||0)) p.costs[into.id][size]=cost; }); delete p.costs[from.id]; }
    (p.addOns||[]).forEach(ad=>{ if(ad.mediumId===from.id) ad.mediumId=into.id; });
    into.sizes=window.SFProductTemplates?window.SFProductTemplates.sortSizes([...(into.sizes||[]),...(from.sizes||[])]):[...new Set([...(into.sizes||[]),...(from.sizes||[])])];
  });
  const removedNames=duplicates.map(d=>d.name).join(', ');
  sf.state.productTemplates=templates.filter(t=>!duplicates.some(d=>d.id===t.id));
  sf.logActivity?.(`Automatically merged duplicate medium(s) "${removedNames}" into "Metallic Luster Paper" (${artworkCount} artwork(s) redirected)`);
  sf.persist?.();
})();
