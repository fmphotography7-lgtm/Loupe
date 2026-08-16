window.SFSettings={
 render(){
  const sf=window.SF;
  if(sf.currentPage==='Data Manager')return this.renderDataManager();
  sf.$('workspace').innerHTML=`<div class="grid2"><div class="card"><h2>Business Settings</h2><label>Business Name</label><input id="businessNameInput" value="${sf.esc(sf.state.business.name)}"><label>Currency</label><select id="currencyInput">${['CAD','USD','GBP','EUR'].map(c=>`<option ${c===sf.state.business.currency?'selected':''}>${c}</option>`).join('')}</select><label>Business Logo</label><div class="logo-preview" id="businessLogoPreview">${sf.state.business.logo?`<img src="${sf.state.business.logo}">`:'No logo selected'}</div><div class="row-actions"><button class="button secondary" id="chooseBusinessLogo">Choose Logo</button><button class="button secondary" id="removeBusinessLogo">Remove Logo</button></div><div class="row-actions"><button class="button primary" id="saveBusinessSettings">Save Settings</button></div></div><div class="card"><h2>Data Manager</h2><p class="muted">Your services, markets, customers, events, orders, artwork and inventory live outside the application folder in StudioFlow's permanent database.</p><button class="button primary" id="openDataManager">Open Data Manager</button></div></div><div class="card"><h2>Error Log</h2>${sf.state.errors.length?sf.state.errors.slice(0,12).map(e=>`<div class="error-block"><b>${sf.esc(e.context)}</b><small>${new Date(e.time).toLocaleString()}</small><pre>${sf.esc(e.message)}</pre></div>`).join(''):'<div class="empty">No saved errors.</div>'}<div class="row-actions"><button class="button secondary" id="clearErrorsButton">Clear Error Log</button></div></div>`;
  sf.$('chooseBusinessLogo').onclick=()=>this.chooseLogo();sf.$('removeBusinessLogo').onclick=()=>this.removeLogo();sf.$('saveBusinessSettings').onclick=()=>this.save();sf.$('openDataManager').onclick=()=>sf.goTo('Data Manager');sf.$('clearErrorsButton').onclick=()=>this.clearErrors();
 },
 async renderDataManager(){
  const sf=window.SF;
  const stats=await sf.api.databaseStatistics();
  const backups=await sf.api.listBackups();
  const settings=sf.state.backupSettings||{};
  const health=stats?.health||{status:'Unknown',issues:[]};
  sf.$('workspace').innerHTML=`
   <div class="data-manager-grid">
    <section class="card data-manager-hero">
     <div class="section-kicker">PERSISTENT DATABASE ENGINE</div>
     <div class="data-health-row"><div><h2>StudioFlow Data Vault</h2><p class="muted">Application updates replace program files, never your business database.</p></div><span class="health-badge ${health.ok?'healthy':'attention'}">${sf.esc(health.status||'Unknown')}</span></div>
     <div class="data-path-box"><small>PERMANENT DATA LOCATION</small><code>${sf.esc(stats?.dataFile||'Unavailable')}</code></div>
     <div class="data-action-grid"><button class="button primary" id="createBackup">Create Safety Backup</button><button class="button secondary" id="restoreBackup">Restore External Backup</button><button class="button secondary" id="openDataFolder">Open Data Folder</button><button class="button secondary" id="refreshDataManager">Refresh</button></div>
     <div id="dataManagerMessage" class="data-message"></div>
    </section>
    <section class="card"><div class="section-header"><div><h3>Website Health Check</h3><p class="muted">Start here. One click shows whether your database is healthy and saving, whether Squarespace is synced, how many variants are linked, and a plain list of pieces/sizes not yet on your website.</p></div></div><button class="button primary" id="webHealthBtn">Run Website Health Check</button></section>
    <section class="card"><div class="section-header"><div><h3>Restore Product Identities from Backup</h3><p class="muted">Recovers original FMP file ids, gallery assignments and Squarespace variant links from an older backup, matching pieces by title. Keeps your current prices, sizes and content — only restores identity. Use this to fix pieces showing ART- ids or unlinked variants. A safety backup is created first.</p></div></div><label class="button primary" style="display:inline-block;cursor:pointer">Choose Backup File…<input id="restoreIdentitiesFile" type="file" accept=".json,application/json" style="display:none"></label></section>
    <section class="card"><div class="section-header"><div><h3>Restore FMP IDs from Website Cache</h3><p class="muted">Tries to recover your original FMP file numbers for pieces now showing ART- ids, by reading them from your website (fmpGalleryManager) cache and matching by title. Preview-first — shows how many it can restore before changing anything. Only the id changes; prices, links and content are kept. Cosmetic (website matching doesn't use the FMP number), so it's safe and optional.</p></div></div><button class="button primary" id="restoreFmpBtn">Preview FMP Restore</button></section>
    <section class="card"><div class="section-header"><div><h3>Re-link Variants to Live Squarespace</h3><p class="muted">Matches each piece's variants to your LIVE Squarespace store by product title + size + medium (reads your combined "size · medium" option names, mat-aware) and writes the real product/variant/SKU onto them. This is what stops duplicate variants — future updates change the existing variant instead of creating a new one. Sync your Squarespace products first (Website). Keeps your current prices; safety backup made first.</p></div></div><button class="button primary" id="relinkLiveBtn">Re-link to Live Squarespace</button></section>
    <section class="card"><h3>Protection Settings</h3>
     <label class="checkline"><input id="autoBackupUpdates" type="checkbox" ${settings.automaticBeforeUpdates!==false?'checked':''}> Automatic backup before StudioFlow updates</label>
     <label class="checkline"><input id="autoDailyBackup" type="checkbox" ${settings.automaticDailyBackup!==false?'checked':''}> One automatic backup per day</label>
     <label>Backups to retain</label><input id="backupRetention" type="number" min="5" max="200" value="${Number(settings.retentionCount)||30}">
     <div class="row-actions"><button class="button primary" id="saveProtectionSettings">Save Protection Settings</button></div>
    </section>
    <section class="card"><h3>Database Health</h3>
     <div class="summary-line"><span>Application version</span><b>${sf.esc(stats?.appVersion||sf.state.appVersion||'')}</b></div>
     <div class="summary-line"><span>Database schema</span><b>${Number(stats?.schemaVersion||sf.state.schemaVersion||0)}</b></div>
     <div class="summary-line"><span>Database size</span><b>${((Number(stats?.sizeBytes)||0)/1024).toFixed(1)} KB</b></div>
     <div class="summary-line"><span>Last saved</span><b>${stats?.lastModified?new Date(stats.lastModified).toLocaleString():'Not yet saved'}</b></div>
     ${(health.issues||[]).length?`<div class="health-issues">${health.issues.map(issue=>`<p>${sf.esc(issue)}</p>`).join('')}</div>`:'<div class="healthy-message">Database structure verified. No issues found.</div>'}
    </section>
    <section class="card data-records-card"><h3>Stored Records</h3><div class="record-count-grid">${Object.entries(stats?.counts||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div><span>${sf.esc(this.label(k))}</span><b>${v}</b></div>`).join('')||'<div class="empty">No collections found.</div>'}</div></section>
    <section class="card backup-history-card"><div class="section-header"><div><h3>Backup History</h3><p class="muted">Newest backup first. Restoring always creates a safety copy of the current database.</p></div><span>${backups.length} saved</span></div>
     <div class="backup-list">${backups.length?backups.map((backup,index)=>`<div class="backup-row"><div><b>${sf.esc(backup.name)}</b><small>${new Date(backup.modified).toLocaleString()} · ${(backup.sizeBytes/1024).toFixed(1)} KB · ${backup.healthy?'Verified':'Needs attention'}</small>${backup.summary?`<small>${backup.summary.scenes||0} scenes · ${backup.summary.artworks||0} artworks · ${backup.summary.websiteProducts||0} website products · ${backup.summary.inventoryItems||0} inventory items</small>`:''}</div><div class="row-actions"><button class="button secondary inspect-saved-backup" data-path="${sf.esc(backup.path)}">Preview</button><button class="button secondary restore-saved-backup" data-path="${sf.esc(backup.path)}">Restore All</button>${index>2?`<button class="button danger delete-saved-backup" data-path="${sf.esc(backup.path)}">Delete</button>`:''}</div></div>`).join(''):'<div class="empty-state">No backups yet. Create the first safety backup above.</div>'}</div>
    </section>
   </div>`;
  sf.$('createBackup').onclick=async()=>{const r=await sf.api.createBackup();this.message(r?.ok?`Backup created: ${r.path}`:'Backup was not created.');if(r?.ok)setTimeout(()=>this.renderDataManager(),500)};
  sf.$('restoreBackup').onclick=async()=>{const r=await sf.api.restoreBackup();if(r?.ok){sf.state=sf.normalize(r.data);this.message('Backup restored successfully.');setTimeout(()=>this.renderDataManager(),300)}};
  { const fi=sf.$('restoreIdentitiesFile'); if(fi) fi.onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;this.message('Reading backup…');const r=new FileReader();r.onload=()=>this.restoreIdentities(String(r.result||''));r.onerror=()=>alert('Could not read that file.');r.readAsText(f)}; }
  { const rb=sf.$('relinkLiveBtn'); if(rb) rb.onclick=()=>this.relinkLive(); }
  { const wb=sf.$('webHealthBtn'); if(wb) wb.onclick=()=>this.websiteHealthCheck(); }
  { const fb=sf.$('restoreFmpBtn'); if(fb) fb.onclick=()=>this.restoreFmpFromCache(); }
  sf.$('openDataFolder').onclick=()=>sf.api.openDataFolder();
  sf.$('refreshDataManager').onclick=()=>this.renderDataManager();
  sf.$('saveProtectionSettings').onclick=async()=>{sf.state.backupSettings={automaticBeforeUpdates:sf.$('autoBackupUpdates').checked,automaticDailyBackup:sf.$('autoDailyBackup').checked,retentionCount:Math.max(5,Math.min(200,Number(sf.$('backupRetention').value)||30))};await sf.persist();this.message('Protection settings saved.');};
  document.querySelectorAll('.inspect-saved-backup').forEach(btn=>btn.onclick=()=>this.previewBackup(btn.dataset.path));
  document.querySelectorAll('.restore-saved-backup').forEach(btn=>btn.onclick=async()=>{if(!confirm(`Restore ${btn.closest('.backup-row').querySelector('b').textContent}? A safety backup of the current database will be created first.`))return;const r=await sf.api.restoreBackupPath(btn.dataset.path);if(r?.ok){sf.state=sf.normalize(r.data);await this.renderDataManager();this.message('Backup restored successfully.')}else this.message(r?.error||'Restore failed.');});
  document.querySelectorAll('.delete-saved-backup').forEach(btn=>btn.onclick=async()=>{if(!confirm('Delete this older backup?'))return;const r=await sf.api.deleteBackup(btn.dataset.path);if(r?.ok)this.renderDataManager();else this.message(r?.error||'Delete failed.');});
 },
 async previewBackup(path){
  const sf=window.SF,r=await sf.api.inspectBackup(path);if(!r?.ok)return this.message(r?.error||'Backup preview failed.');
  const choices=(r.collections||[]).sort((a,b)=>b.count-a.count).map(x=>`<label class="checkline"><input type="checkbox" class="restore-collection" value="${sf.esc(x.key)}"> ${sf.esc(this.label(x.key))} <b>${x.count}</b></label>`).join('');
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card" style="max-width:760px"><h2>Backup Preview</h2><p class="muted">${sf.esc(r.path)}</p><div class="grid4"><div class="metric"><span>Scenes</span><b>${r.summary.scenes||0}</b></div><div class="metric"><span>Artworks</span><b>${r.summary.artworks||0}</b></div><div class="metric"><span>Website Products</span><b>${r.summary.websiteProducts||0}</b></div><div class="metric"><span>Inventory</span><b>${r.summary.inventoryItems||0}</b></div></div><h3>Selective Restore</h3><p class="muted">Choose only the collections you need. StudioFlow creates a safety backup first.</p><div style="max-height:320px;overflow:auto">${choices}</div><div class="row-actions"><button class="button secondary" id="cancelBackupPreview">Cancel</button><button class="button secondary" id="selectAllCollections">Select All</button><button class="button primary" id="restoreSelectedCollections">Restore Selected</button></div></div></div>`;
  sf.$('cancelBackupPreview').onclick=()=>sf.$('modalRoot').innerHTML='';sf.$('selectAllCollections').onclick=()=>document.querySelectorAll('.restore-collection').forEach(x=>x.checked=true);
  sf.$('restoreSelectedCollections').onclick=async()=>{const collections=[...document.querySelectorAll('.restore-collection:checked')].map(x=>x.value);if(!collections.length)return alert('Select at least one collection.');if(!confirm(`Restore ${collections.length} selected collection${collections.length===1?'':'s'}?`))return;const result=await sf.api.restoreSelectedCollections({backupPath:path,collections});if(result?.ok){sf.state=sf.normalize(result.data);sf.$('modalRoot').innerHTML='';await this.renderDataManager();this.message(`Restored: ${result.collections.map(x=>this.label(x)).join(', ')}`)}else alert(result?.error||'Selective restore failed.');};
 },
 label(key){return String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,m=>m.toUpperCase())},
 message(t){const el=window.SF.$('dataManagerMessage');if(el)el.textContent=t},
 async chooseLogo(){const sf=window.SF,file=await sf.api.openImage();if(file){sf.state.business.logo=file.data;sf.$('businessLogoPreview').innerHTML=`<img src="${file.data}">`}},
 removeLogo(){const sf=window.SF;sf.state.business.logo='';sf.$('businessLogoPreview').textContent='No logo selected'},
 async websiteHealthCheck(){
  const sf=window.SF,C=window.SFCommerceHub;
  let stats=null;try{stats=await(sf.api.databaseStatistics&&sf.api.databaseStatistics())}catch{}
  const live=(C&&C.liveVariants)?C.liveVariants():[];
  const tk=t=>sf.titleKey(t),normSize=x=>String(x||'').toLowerCase().replace(/[^0-9x]/g,''),hasMat=x=>/\bmat|matt/i.test(String(x||''));
  const medKey=o=>String(o||'').toLowerCase().replace(/\d+\s*[x\u00d7]\s*\d+/g,' ').replace(/[\u00b7\u2013\u2014+-]/g,' ').replace(/\bmatted\b|\bmatt\b|\bmat\b|print only|printonly/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(w=>w.length>2).sort().join(' ');
  const byTitle=new Map();live.forEach(v=>{const k=tk(v.title);if(!k)return;if(!byTitle.has(k))byTitle.set(k,[]);byTitle.get(k).push(v)});
  const liveIds=new Set(live.map(v=>String(v.variantId||'')).filter(Boolean));
  const isLinked=p=>!!(p&&p.variantId&&liveIds.has(String(p.variantId)));
  const findLive=(cands,medium,size)=>{const sz=normSize(size);if(!sz)return null;const wm=medKey(medium),mat=hasMat(medium);return cands.find(v=>v.variantId&&normSize(v.variant).includes(sz)&&medKey(v.variant)===wm&&hasMat(v.variant)===mat)||null};
  const arts=sf.state.artworks||[];
  let linkedPieces=0,needAttention=0,linkedV=0,staleV=0,toPush=0;const pushList=[];
  arts.forEach(a=>{const cands=byTitle.get(tk(a.title));let issue=false;(a.products||[]).forEach(p=>{if(isLinked(p)){linkedV++;return}if(p.variantId)staleV++;const m=cands&&findLive(cands,p.medium,p.size);if(!m){toPush++;issue=true;if(pushList.length<50)pushList.push(`${a.title} — ${p.medium||'?'} ${p.size||'?'}`)}else issue=true});if(issue)needAttention++;else if((a.products||[]).length)linkedPieces++});
  const dbOK=stats&&Number(stats.sizeBytes||0)>1000000;
  const row=(ok,label,detail)=>`<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0"><span style="font-size:16px">${ok?'\u2705':'\u26a0\ufe0f'}</span><div><b>${sf.esc(label)}</b><br><small class="muted">${sf.esc(detail)}</small></div></div>`;
  const box=(t,arr)=>arr&&arr.length?`<h3 style="margin:12px 0 4px">${t} (${arr.length}${arr.length>=50?'+':''})</h3><div class="mono" style="max-height:200px;overflow:auto;font-size:12px;background:rgba(0,0,0,.15);border-radius:8px;padding:8px">${arr.map(x=>sf.esc(x)).join('<br>')}</div>`:'';
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card" style="max-width:760px"><h2>Website Health Check</h2><p class="muted">A quick read of where things stand before touching variants.</p>${row(dbOK,'Database',stats?`${(Number(stats.sizeBytes||0)/1048576).toFixed(0)} MB \u00b7 last saved ${stats.lastModified?new Date(stats.lastModified).toLocaleString():'unknown'} \u00b7 ${(stats.health&&stats.health.status)||'\u2014'}`:'Could not read database stats (open Data Manager, click Refresh).')}${row(live.length>0,'Squarespace sync',live.length?`${new Set(live.map(v=>v.productId)).size} products \u00b7 ${live.length} live variants loaded`:'No live variants loaded \u2014 sync your Squarespace products (Website) first.')}${row(needAttention===0,'Variant links',`${linkedV} variants linked \u00b7 ${staleV} stale \u00b7 ${toPush} not yet on the site \u00b7 ${needAttention} piece(s) need attention`)}${box('Pieces/sizes not yet on your website (to add & push)',pushList)}<p class="muted" style="margin-top:12px">Suggested order: sync Squarespace \u2192 Re-link to Live Squarespace (repairs links) \u2192 edit a listed piece \u2192 save \u2192 approve the new sizes \u2192 verify one-per-size on Squarespace.</p><div class="row-actions"><button class="button primary" id="whcClose">Close</button></div></div></div>`;
  sf.$('whcClose').onclick=()=>sf.closeModal();
 },
 async relinkLive(){
  const sf=window.SF,C=window.SFCommerceHub;
  const live=(C&&C.liveVariants)?C.liveVariants():[];
  if(!live.length)return alert('No live Squarespace variants found. Go to Website and sync your Squarespace products first, then run this again.');
  const tk=t=>sf.titleKey(t),nz=x=>String(x||'').toLowerCase(),normSize=x=>String(x||'').toLowerCase().replace(/[^0-9x]/g,''),hasMat=x=>/\bmat|matt/i.test(String(x||''));
  const medKey=o=>String(o||'').toLowerCase().replace(/\d+\s*[x\u00d7]\s*\d+/g,' ').replace(/[\u00b7\u2013\u2014+-]/g,' ').replace(/\bmatted\b|\bmatt\b|\bmat\b|print only|printonly/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(w=>w.length>2).sort().join(' ');
  const byTitle=new Map();live.forEach(v=>{const k=tk(v.title);if(!k)return;if(!byTitle.has(k))byTitle.set(k,[]);byTitle.get(k).push(v)});
  const liveIds=new Set(live.map(v=>String(v.variantId||'')).filter(Boolean));
  const isLinked=p=>!!(p&&p.variantId&&liveIds.has(String(p.variantId)));
  const findLive=(cands,medium,size)=>{const sz=normSize(size);if(!sz)return null;const wm=medKey(medium),mat=hasMat(medium);return cands.find(v=>v.variantId&&normSize(v.variant).includes(sz)&&medKey(v.variant)===wm&&hasMat(v.variant)===mat)||null};
  const liveProducts=new Set(live.map(v=>v.productId)).size,total=(sf.state.artworks||[]).length;
  let willLink=0,pieces=0,titleMatched=0,noTitle=0,alreadyLinked=0,unmatched=0,stale=0,staleNoMatch=0;
  const sampleUnmatched=[],sampleLive=new Set(),noTitleSamples=[];
  (sf.state.artworks||[]).forEach(a=>{const cands=byTitle.get(tk(a.title));if(!cands){noTitle++;if(noTitleSamples.length<8&&a.title)noTitleSamples.push(a.title);return}titleMatched++;let any=false;(a.products||[]).forEach(p=>{if(isLinked(p)){alreadyLinked++;return}const _sl=!!p.variantId;if(_sl)stale++;if(findLive(cands,p.medium,p.size)){willLink++;any=true}else{unmatched++;if(_sl){staleNoMatch++;any=true}if(sampleUnmatched.length<10)sampleUnmatched.push(`${a.title} — "${p.medium||'?'}" ${p.size||'?'}`);cands.slice(0,3).forEach(v=>{if(sampleLive.size<15)sampleLive.add(v.variant)})}});if(any)pieces++});
  const box=(t,arr)=>arr&&arr.length?`<h3 style="margin:12px 0 4px">${t}</h3><div class="mono" style="max-height:130px;overflow:auto;font-size:12px;background:rgba(0,0,0,.15);border-radius:8px;padding:8px">${arr.map(x=>sf.esc(x)).join('<br>')}</div>`:'';
  sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal-card" style="max-width:740px"><h2>Re-link to Live Squarespace</h2><p class="muted">Live sync: <b>${live.length}</b> variants across <b>${liveProducts}</b> products.<br>Pieces matched to a live product by title: <b>${titleMatched}</b> of ${total} (<b>${noTitle}</b> had no title match).<br>Their variants: <b>${alreadyLinked}</b> already linked &middot; <b>${willLink}</b> to (re)link${stale?` (incl. <b>${stale}</b> stale link${stale===1?'':'s'} to deleted variants)`:''} &middot; <b>${unmatched}</b> no live-option match.</p>${box('Examples that could not match a live option (your StudioFlow medium + size)',sampleUnmatched)}${box('What your live Squarespace options look like',[...sampleLive])}${box('Pieces with no title match',noTitleSamples)}${staleNoMatch?`<p class="muted"><b>${staleNoMatch}</b> variant(s) point to a deleted site variant with no live match — these will be UNLINKED so their sizes get re-proposed as adds on the next save.</p>`:''}<div class="row-actions"><button class="button secondary" id="relinkCancel">Close</button>${(willLink||staleNoMatch)?`<button class="button primary" id="relinkGo">Re-link / clean up ${willLink+staleNoMatch} now</button>`:''}</div></div></div>`;
  sf.$('relinkCancel').onclick=()=>sf.closeModal();
  const goBtn=sf.$('relinkGo');if(goBtn)goBtn.onclick=async()=>{sf.closeModal();try{await(sf.api.createBackup&&sf.api.createBackup())}catch{}let done=0,cleared=0;(sf.state.artworks||[]).forEach(a=>{const cands=byTitle.get(tk(a.title));if(!cands)return;(a.products||[]).forEach(p=>{if(isLinked(p))return;const m=findLive(cands,p.medium,p.size);if(m){p.productId=m.productId;p.squarespaceProductId=m.productId;p.variantId=m.variantId;p.squarespaceVariantId=m.variantId;if(m.sku)p.sku=m.sku;p.source='Squarespace';done++}else if(p.variantId||p.productId){p.productId='';p.squarespaceProductId='';p.variantId='';p.squarespaceVariantId='';if(p.source==='Squarespace')p.source='StudioFlow';cleared++}})});sf.logActivity(`Re-linked ${done} variants, cleared ${cleared} dead links`);await sf.persist();this.message(`Re-linked ${done} variant(s)${cleared?`, and cleared ${cleared} dead link(s) so their sizes can be re-added on save`:''}.`);setTimeout(()=>this.renderDataManager(),400)};
 },
  async restoreFmpFromCache(){
  const sf=window.SF;
  let web=null;try{web=JSON.parse(localStorage.getItem('fmpGalleryManager')||'null')}catch{}
  let bridged=[];try{bridged=JSON.parse(localStorage.getItem('studioflow-website-artworks-bridge')||'[]')}catch{}
  const webArts=[...(web&&Array.isArray(web.artworks)?web.artworks:[]),...(Array.isArray(bridged)?bridged:[])];
  if(!webArts.length)return alert('No website cache found (fmpGalleryManager). Open your website / gallery manager once so StudioFlow captures it, then try again.');
  const tk=t=>sf.titleKey(t);
  const grab=obj=>{ // pull an FMP-#### id from the record: prefer explicit id fields, else deep-scan
    let s='';
    for(const k of ['artworkId','fileId','fmpId','sku','id','filename','fileName','name']){const v=obj&&obj[k];if(typeof v==='string'&&/FMP-?\d/i.test(v)){s=v;break}}
    if(!s){try{s=JSON.stringify(obj)}catch{s=''}}
    const m=String(s).match(/FMP-?(\d{2,})/i);return m?('FMP-'+m[1]):null;
  };
  const fmpByTitle=new Map();
  webArts.forEach(a=>{const k=tk(a&&a.title);if(!k||fmpByTitle.has(k))return;const f=grab(a);if(f)fmpByTitle.set(k,f)});
  const isFmp=v=>/^FMP-?\d/i.test(String(v||''));
  const cur=sf.state.artworks||[];
  let willRestore=0;const samples=[];
  cur.forEach(c=>{if(isFmp(c.artworkId))return;const f=fmpByTitle.get(tk(c.title));if(f){willRestore++;if(samples.length<12)samples.push(`${c.title} \u2192 ${f}`)}});
  if(!fmpByTitle.size)return alert('The website cache is present but contains no FMP numbers — so they are truly gone from every source we have. Nothing to restore. (Your titles + Squarespace links are intact, so this is cosmetic only.)');
  if(!willRestore)return alert(`Found ${fmpByTitle.size} FMP number(s) in the cache, but they all already match pieces that still have their FMP id (nothing currently showing ART- needs one). Nothing to restore.`);
  if(!confirm(`Found FMP numbers in your website cache for ${willRestore} piece(s) currently showing ART- ids.\n\nExamples:\n${samples.slice(0,8).join('\n')}\n\nRestore these FMP file ids? Only the id changes; prices, links and content are kept. A safety backup is made first. Proceed?`))return;
  try{await(sf.api.createBackup&&sf.api.createBackup())}catch{}
  let done=0;
  cur.forEach(c=>{if(isFmp(c.artworkId))return;const f=fmpByTitle.get(tk(c.title));if(f){c.artworkId=f;c.id=f;done++}});
  sf.logActivity(`Restored ${done} FMP file ids from website cache`);
  await sf.persist();
  this.message(`Restored ${done} FMP file ids from your website cache. Those pieces show their FMP numbers again.`);
  setTimeout(()=>this.renderDataManager(),500);
 },
 async restoreIdentities(text){
  const sf=window.SF;let backup;try{backup=JSON.parse(text)}catch{return alert('That file is not a readable StudioFlow backup (JSON).')}
  const looksLikeArtworks=arr=>Array.isArray(arr)&&arr.length&&arr.some(x=>x&&typeof x==='object'&&('title' in x)&&(('artworkId' in x)||('products' in x)||('galleryId' in x)));
  let bArts=[backup&&backup.artworks,backup&&backup.data&&backup.data.artworks,backup&&backup.state&&backup.state.artworks].find(looksLikeArtworks);
  if(!bArts){ // deep-search the backup for the artworks array wherever it lives
    const seen=new Set();const stack=[backup];while(stack.length&&!bArts){const o=stack.pop();if(!o||typeof o!=='object'||seen.has(o))continue;seen.add(o);if(looksLikeArtworks(o.artworks)){bArts=o.artworks;break}for(const k in o){const v=o[k];if(looksLikeArtworks(v)){bArts=v;break}if(v&&typeof v==='object')stack.push(v)}}}
  if(!bArts||!bArts.length)return alert('No artworks found in that backup file. Make sure you picked a StudioFlow database backup (the larger .json — your Desktop\\StudioFlow\\Back up files copy), not an app file.');
  const tk=t=>sf.titleKey(t),isFmp=v=>/^FMP-/i.test(String(v||''));
  const bByTitle=new Map();bArts.forEach(a=>{const k=tk(a.title);if(k&&!bByTitle.has(k))bByTitle.set(k,a)});
  const cur=sf.state.artworks||[];
  let matched=0,idN=0,galN=0,relinkN=0;
  cur.forEach(c=>{const b=bByTitle.get(tk(c.title));if(!b)return;matched++;
   if([b.artworkId,b.id].some(isFmp)&&!isFmp(c.artworkId))idN++;
   if(!c.galleryId&&b.galleryId)galN++;
   const bp=Array.isArray(b.products)?b.products:[];
   (c.products||[]).forEach(p=>{const m=bp.find(x=>String(x.mediumId||'')===String(p.mediumId||'')&&String(x.size||'')===String(p.size||''));if(m&&(m.productId||m.variantId)&&!(p.productId||p.variantId))relinkN++});
  });
  if(!matched)return alert('None of your current pieces matched this backup by title — make sure you picked the right backup file.');
  if(!confirm(`Matched ${matched} of ${cur.length} pieces by title.\n\nThis will:\n  • restore ${idN} FMP file id(s)\n  • restore ${galN} gallery assignment(s)\n  • re-link ${relinkN} Squarespace variant(s)\n\nYour current prices, sizes and content are kept. A safety backup is made first. Proceed?`))return;
  try{await (sf.api.createBackup&&sf.api.createBackup())}catch{}
  let di=0,dg=0,dr=0;
  cur.forEach(c=>{const b=bByTitle.get(tk(c.title));if(!b)return;
   const fmp=[b.artworkId,b.id].find(isFmp);
   if(fmp&&!isFmp(c.artworkId)){c.artworkId=fmp;c.id=fmp;di++}
   if(!c.galleryId&&b.galleryId){c.galleryId=b.galleryId;c.gallery=c.gallery||b.gallery;dg++}
   const bp=Array.isArray(b.products)?b.products:[];
   (c.products||[]).forEach(p=>{const m=bp.find(x=>String(x.mediumId||'')===String(p.mediumId||'')&&String(x.size||'')===String(p.size||''));if(m&&(m.productId||m.variantId)&&!(p.productId||p.variantId)){p.productId=m.productId||p.productId;p.squarespaceProductId=m.squarespaceProductId||m.productId||p.squarespaceProductId;p.variantId=m.variantId||p.variantId;p.squarespaceVariantId=m.squarespaceVariantId||m.variantId||p.squarespaceVariantId;if(m.sku&&!p.sku)p.sku=m.sku;if(m.source==='Squarespace')p.source='Squarespace';dr++}});
  });
  sf.logActivity(`Restored identities from backup: ${di} file ids, ${dg} galleries, ${dr} variant links`);
  await sf.persist();
  this.message(`Done — restored ${di} FMP file ids, ${dg} gallery assignments, and ${dr} Squarespace variant links. Current prices kept.`);
  setTimeout(()=>this.renderDataManager(),500);
 },
 async save(){const sf=window.SF;sf.state.business.name=sf.$('businessNameInput').value.trim()||'Your Photography Business';sf.state.business.currency=sf.$('currencyInput').value;sf.logActivity('Updated business settings');await sf.persist();sf.syncBrand();this.render()},
 async exportBackup(){return window.SF.api.createBackup()},async importBackup(){return window.SF.api.restoreBackup()},
 async clearErrors(){const sf=window.SF;sf.state.errors=[];await sf.persist();this.render()}
};
