
window.SF = {
  pages: ['Home Dashboard','Website Dashboard','Website Connection','Sales & Orders','Data Manager','Business Intelligence','AI Printing Assistant','Materials & Sheet Cutting','Artwork Timeline','Limited Editions','Website Pricing','Sales','Inventory','Product Health','Photo Cull','Crop Tool','Room Designer','AI Art Creation','Scene Packs','Scene Calibration','Saved Room Projects','Settings'],
  state: null,
  currentPage: 'Home Dashboard',
  artworkSearch: '',
  api: window.studioflow || {
    isElectron:false,
    async loadData(){const raw=localStorage.getItem('studioflow-core-2');return raw?JSON.parse(raw):null},
    async saveData(data){localStorage.setItem('studioflow-core-2',JSON.stringify(data));return {ok:true}},
    async openImages(){return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=true;input.onchange=()=>{const files=[...input.files];Promise.all(files.map(file=>new Promise(done=>{const reader=new FileReader();reader.onload=()=>done({name:file.name,data:reader.result});reader.readAsDataURL(file)}))).then(resolve)};input.click()})},
    async openImage(){return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>{const file=input.files[0];if(!file)return resolve(null);const reader=new FileReader();reader.onload=()=>resolve({name:file.name,data:reader.result});reader.readAsDataURL(file)};input.click()})},
    async openJson(){return null},
    async openText(){return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept='.csv,text/csv,text/plain';input.onchange=()=>{const file=input.files[0];if(!file)return resolve(null);const reader=new FileReader();reader.onload=()=>resolve({name:file.name,text:reader.result});reader.readAsText(file)};input.click()})},
    async saveText(){return null},async createBackup(){return {ok:false}},async autoBackup(){return {ok:false}},async restoreBackup(){return null},async openDataFolder(){return null},async databaseStatistics(){return null},async listBackups(){return []},async databaseHealth(){return null},async restoreBackupPath(){return null},async deleteBackup(){return null}
  },
  defaults(){
    return {
      schemaVersion:7,
      appVersion:'StudioFlow 3.9.0',
      business:{name:'Your Photography Business',currency:'CAD',logo:''},
      galleries:[
        {id:'GAL-LANDSCAPES',name:'Landscapes',description:'',coverImage:''},
        {id:'GAL-WILDLIFE',name:'Wildlife',description:'',coverImage:''},
        {id:'GAL-WORLD',name:'World Images',description:'',coverImage:''},
        {id:'GAL-LIMITED',name:'Limited Editions',description:'',coverImage:''}
      ],
      artworks:[],customers:[],serviceJobs:[],salesSources:[],artworkTimelineEntries:[],limitedEditionRecords:[],limitedEditionPriceTiers:[],limitedEditionCostProfiles:[],limitedEditionCostHistory:[],printingAssistantPlans:[],printingAssistantSettings:{},materials:[],materialPurchases:[],productRecipes:[],sheetOffcuts:[],productTemplates:[],inventoryProductTemplates:[],inventoryItems:[],marketSales:[],marketSessions:[],salesEvents:[],salesTransactions:[],salesTransactionItems:[],salesSpecials:[],salesPriceHistory:[],businessTransactions:[],quotes:[],giftCertificates:[],dailyBusinessLogs:[],backupSettings:{automaticBeforeUpdates:true,automaticDailyBackup:true,retentionCount:30},migrationHistory:[],databaseMeta:{createdAt:new Date().toISOString(),lastSavedAt:'',lastBackupAt:''},pricing:{standard:{},addOns:[],currency:'CAD',pendingWebsiteUpdates:[]},squarespace:{},scenePacks:[],scenes:[],roomProjects:[],activity:[],errors:[],removedArtworks:[]
    };
  },
  $(id){return document.getElementById(id)},
  esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))},
  makeId(prefix){return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*1000)}`},
  // Punctuation-robust title key for matching the same piece across native + website sources
  // (apostrophes/quotes removed, other punctuation collapsed to single spaces).
  titleKey(v){return String(v||'').toLowerCase().replace(/[\u2018\u2019\u02bc'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();},
  // Deterministic SKU for a variant that never had one, so Squarespace (which requires a SKU on
  // every variant) accepts it. Same piece+medium+size always yields the same SKU; the title keeps
  // it unique across different products (Squarespace SKUs must be unique store-wide).
  skuFor(title,medium,size){const clean=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,14);const sz=String(size||'').toUpperCase().replace(/[^0-9X]+/g,'');const mat=/\bmat|matt/i.test(String(medium||''))?'M':'';const frame=/floating\s*frame|framed/i.test(String(medium||''))?'F':'';const parts=[clean(title),clean(medium).slice(0,8)+mat+frame,sz].filter(Boolean);return parts.length?parts.join('-'):('SKU-'+Date.now().toString(36).toUpperCase());},
  normalize(input){
    const base=this.defaults();
    const data={...base,...(input||{})};
    data.business={...base.business,...(data.business||{})};
    if(Array.isArray(data.galleries)&&data.galleries.every(g=>typeof g==='string')){
      data.galleries=data.galleries.map((name,index)=>({id:`GAL-MIGRATED-${index+1}`,name,description:'',coverImage:''}));
    }
    // Only seed the starter galleries when there is NO gallery data at all (a brand-new database).
    // Do NOT top up individually "missing" defaults on every load -- that used to resurrect a
    // default gallery (e.g. Landscapes) every launch after the user had deliberately deleted it.
    // Once the user has their own galleries, their deletions stick.
    data.galleries=Array.isArray(data.galleries)?data.galleries:base.galleries.map(g=>({...g}));
    data.artworks=Array.isArray(data.artworks)?data.artworks:[];
    // Tombstones: artworks the user deliberately deleted, so the merged catalog won't resurrect
    // them from a stale website cache. Each entry: {id, artworkId, title, at}.
    data.removedArtworks=Array.isArray(data.removedArtworks)?data.removedArtworks:[];
    data.customers=Array.isArray(data.customers)?data.customers:[];
    data.serviceJobs=Array.isArray(data.serviceJobs)?data.serviceJobs:[];
    data.salesSources=Array.isArray(data.salesSources)?data.salesSources:[];
    data.artworkTimelineEntries=Array.isArray(data.artworkTimelineEntries)?data.artworkTimelineEntries:[];
    data.limitedEditionRecords=Array.isArray(data.limitedEditionRecords)?data.limitedEditionRecords:[];
    data.limitedEditionPriceTiers=Array.isArray(data.limitedEditionPriceTiers)?data.limitedEditionPriceTiers:[];
    data.limitedEditionCostProfiles=Array.isArray(data.limitedEditionCostProfiles)?data.limitedEditionCostProfiles:[];
    data.limitedEditionCostHistory=Array.isArray(data.limitedEditionCostHistory)?data.limitedEditionCostHistory:[];
    data.printingAssistantPlans=Array.isArray(data.printingAssistantPlans)?data.printingAssistantPlans:[];
    data.printingAssistantSettings=data.printingAssistantSettings&&typeof data.printingAssistantSettings==='object'?data.printingAssistantSettings:{};
    data.materials=Array.isArray(data.materials)?data.materials:[];data.materialPurchases=Array.isArray(data.materialPurchases)?data.materialPurchases:[];data.productRecipes=Array.isArray(data.productRecipes)?data.productRecipes:[];data.sheetOffcuts=Array.isArray(data.sheetOffcuts)?data.sheetOffcuts:[];
    data.productTemplates=Array.isArray(data.productTemplates)?data.productTemplates:[];
    data.inventoryProductTemplates=Array.isArray(data.inventoryProductTemplates)?data.inventoryProductTemplates:[];
    data.inventoryItems=Array.isArray(data.inventoryItems)?data.inventoryItems:[];
    data.marketSales=Array.isArray(data.marketSales)?data.marketSales:[];
    data.marketSessions=Array.isArray(data.marketSessions)?data.marketSessions:[];
    data.salesEvents=Array.isArray(data.salesEvents)?data.salesEvents:[];
    data.salesTransactions=Array.isArray(data.salesTransactions)?data.salesTransactions:[];
    data.salesTransactionItems=Array.isArray(data.salesTransactionItems)?data.salesTransactionItems:[];
    data.salesSpecials=Array.isArray(data.salesSpecials)?data.salesSpecials:[];
    data.salesPriceHistory=Array.isArray(data.salesPriceHistory)?data.salesPriceHistory:[];
    data.businessTransactions=Array.isArray(data.businessTransactions)?data.businessTransactions:[];data.quotes=Array.isArray(data.quotes)?data.quotes:[];data.giftCertificates=Array.isArray(data.giftCertificates)?data.giftCertificates:[];data.dailyBusinessLogs=Array.isArray(data.dailyBusinessLogs)?data.dailyBusinessLogs:[];data.backupSettings=data.backupSettings&&typeof data.backupSettings==='object'?{automaticBeforeUpdates:true,automaticDailyBackup:true,retentionCount:30,...data.backupSettings}:{automaticBeforeUpdates:true,automaticDailyBackup:true,retentionCount:30};data.migrationHistory=Array.isArray(data.migrationHistory)?data.migrationHistory:[];data.databaseMeta=data.databaseMeta&&typeof data.databaseMeta==='object'?data.databaseMeta:{createdAt:new Date().toISOString(),lastSavedAt:'',lastBackupAt:''};
    data.pricing=data.pricing&&typeof data.pricing==='object'?data.pricing:{standard:{},addOns:[],currency:data.business.currency||'CAD',pendingWebsiteUpdates:[]};data.pricing.standard=data.pricing.standard||{};data.pricing.addOns=Array.isArray(data.pricing.addOns)?data.pricing.addOns:[];data.pricing.pendingWebsiteUpdates=Array.isArray(data.pricing.pendingWebsiteUpdates)?data.pricing.pendingWebsiteUpdates:[];
    data.squarespace=data.squarespace&&typeof data.squarespace==='object'?data.squarespace:{};
    data.artworks=data.artworks.map(a=>{const gallery=data.galleries.find(g=>String(g.id).toLowerCase()===String(a.galleryId||'').toLowerCase()||String(g.name).trim().toLowerCase()===String(a.gallery||'').trim().toLowerCase());const galleryLimited=/limited edition/i.test(gallery?.name||a.gallery||'');return ({...a,galleryId:a.galleryId||gallery?.id||'',gallery:a.gallery||gallery?.name||'',isLimitedEdition:a.isLimitedEdition===true||a.limited===true||galleryLimited,editionSize:a.editionSize??null,limitedEditionStartingPrice:Number(a.limitedEditionStartingPrice??a.startingPrice??0)||0,limitedEditionPricing:a.limitedEditionPricing||{},products:Array.isArray(a.products)?a.products:[],squarespace:a.squarespace||{imported:false,productIds:[]},createdAt:a.createdAt||new Date().toISOString(),updatedAt:a.updatedAt||new Date().toISOString()})});
    data.scenePacks=Array.isArray(data.scenePacks)?data.scenePacks:[];
    data.scenes=Array.isArray(data.scenes)?data.scenes:[];
    data.roomProjects=Array.isArray(data.roomProjects)?data.roomProjects:[];
    data.scenes=data.scenes.map(s=>({
      ...s,
      assetId:s.assetId||s.id,
      sourceImageId:s.sourceImageId||s.assetId||s.id,
      recordType:'roomAsset',
      inLibrary:s.inLibrary===true,
      safeCenterX:Number(s.safeCenterX ?? 50),
      safeCenterY:Number(s.safeCenterY ?? 38),
      lightDirection:s.lightDirection||'left',
      lightAngle:Number(s.lightAngle ?? 35),
      shadowSoftness:Number(s.shadowSoftness ?? 72),
      shadowStrength:Number(s.shadowStrength ?? 36),
      backgroundLayer:s.backgroundLayer||s.image||'',
      foregroundLayers:Array.isArray(s.foregroundLayers)?s.foregroundLayers:[],
      lightingOverlay:s.lightingOverlay||'',
      wallPlane:s.wallPlane||{
        topLeft:{x:24,y:13},topRight:{x:78,y:13},
        bottomRight:{x:78,y:65},bottomLeft:{x:24,y:65}
      },
      calibrated:s.calibrated===true,
      productionStatus:s.productionStatus||(s.calibrated?'Calibrated':'Needs Calibration'),
      calibrationLocked:s.calibrationLocked===true,
      approvedAt:s.approvedAt||'',
      designNotes:s.designNotes||'',
      calibration:s.calibration||{
        floorPoint:{x:20,y:90},ceilingPoint:{x:20,y:10},
        ceilingHeightInches:Number(s.wallHeight||96),pixelsPerInch:0,
        wallLeft:20,wallRight:80,furnitureTopY:65,topClearanceInches:3
      }
    }));
    if(window.SFAssetManager)data.scenes=window.SFAssetManager.ensureUniqueIds(data.scenes);
    else{
      const used=new Set();
      data.scenes=data.scenes.map((scene,index)=>{
        let id=String(scene.assetId||scene.id||`SCN-MIGRATED-${index+1}`);
        const base=id;let n=2;while(used.has(id))id=`${base}-V${n++}`;
        used.add(id);return {...scene,id,assetId:id,sourceImageId:scene.sourceImageId||id,recordType:'roomAsset'};
      });
    }
    data.activity=Array.isArray(data.activity)?data.activity:[];
    data.errors=Array.isArray(data.errors)?data.errors:[];
    return data;
  },
  async persist(){return await this.api.saveData(this.state)},
  logActivity(text){
    this.state.activity.unshift({id:this.makeId('ACT'),text,time:new Date().toISOString()});
    this.state.activity=this.state.activity.slice(0,40);
  },
  logError(error,context='Application'){
    const message=error?.stack||error?.message||String(error);
    this.state.errors.unshift({id:this.makeId('ERR'),context,message,time:new Date().toISOString()});
    this.state.errors=this.state.errors.slice(0,30);
    this.api.saveData(this.state);
  },
  artworkCatalog(){
    const map=new Map();
    // Tombstoned artworks: pieces the user deliberately deleted. Website caches (the live site
    // manager and two saved caches) key on their own ids, so an id-only delete can't reliably
    // reach them -- title is the stable join key. Suppress any website-sourced record whose id
    // OR title was tombstoned, so a delete actually sticks instead of being resurrected here.
    const _normTomb=v=>this.titleKey(v);
    const _tomb=Array.isArray(this.state?.removedArtworks)?this.state.removedArtworks:[];
    const _tombIds=new Set();const _tombTitles=new Set();
    _tomb.forEach(t=>{if(t&&t.id)_tombIds.add(String(t.id));if(t&&t.artworkId)_tombIds.add(String(t.artworkId));const nt=_normTomb(t&&t.title);if(nt)_tombTitles.add(nt);});
    // A blind {...existing,...a} spread lets a later source's empty field silently overwrite an
    // earlier source's real value (e.g. native core data saved correctly, then an old, stale
    // website-sourced record with an empty field wipes it back out in the merged view, even
    // though the underlying saved data is still correct). Merge field-by-field instead: only let
    // a source's value win if it's actually non-empty, so real data never loses to blank data
    // regardless of which source ran first or last.
    const mergeNonEmpty=(existing,incoming)=>{
      const out={...existing};
      for(const [k,v] of Object.entries(incoming)){
        const isEmpty=v==null||v===''||(Array.isArray(v)&&v.length===0);
        if(!isEmpty)out[k]=v;
      }
      return out;
    };
    const _nativeTitleToId=new Map();
    const add=(a,source='core')=>{
      if(!a)return;
      let id=String(a.artworkId||a.id||'').trim();
      if(!id)return;
      const _nt=_normTomb(a.title||a.name);
      // Native ('core') records are always kept -- a deletion removed them from state already, so
      // if one's here the user still has it. Only website sources get suppressed by tombstones,
      // and only when there is no native record already in the map for this id.
      if(source==='website'){
        if(!map.has(id)&&(_tombIds.has(id)||(_nt&&_tombTitles.has(_nt))))return;
        // Fold a website record into the matching native record (same title) so the piece stays a
        // single catalogue entry carrying the native data you saved (e.g. a mapped URL). Website
        // caches use their own ids, so without this the same piece appears twice -- native with
        // the URL, website without -- and Product Health keeps re-flagging the URL-less copy.
        if(_nt&&_nativeTitleToId.has(_nt))id=_nativeTitleToId.get(_nt);
      }
      const existing=map.get(id)||{};
      const image=a.permanentImagePath||a.imagePath||a.image||a.imageData||a.thumbnail||String(a.imageUrls||'').split(/\s+/).filter(Boolean)[0]||existing.permanentImagePath||existing.imagePath||existing.image||existing.imageData||'';
      const galleryName=a.gallery||this.state?.galleries?.find(g=>g.id===a.galleryId)?.name||existing.gallery||'';const galleryLimited=/limited edition/i.test(galleryName);map.set(id,{...mergeNonEmpty(existing,a),id:existing.id||a.id||id,artworkId:existing.artworkId||a.artworkId||id,title:a.title||a.name||existing.title||id,image,thumbnail:a.thumbnail||image,gallery:galleryName,isLimitedEdition:a.isLimitedEdition===true||a.limited===true||galleryLimited,editionSize:Number(a.editionSize||existing.editionSize||0)||null,limitedEditionStartingPrice:Number(a.limitedEditionStartingPrice??a.startingPrice??existing.limitedEditionStartingPrice??0)||0,catalogSource:existing.catalogSource==='core'?'core':source});
    };
    (this.state?.artworks||[]).forEach(a=>add(a,'core'));
    (this.state?.artworks||[]).forEach(a=>{const nt=_normTomb(a.title);const nid=String(a.artworkId||a.id||'').trim();if(nt&&nid&&!_nativeTitleToId.has(nt))_nativeTitleToId.set(nt,nid);});
    try{
      const frame=window.SFWebsiteManager?.iframe?.contentWindow;
      const live=typeof frame?.getStudioFlowArtworkCatalog==='function'?frame.getStudioFlowArtworkCatalog():[];
      if(Array.isArray(live))live.forEach(a=>add(a,'website'));
    }catch{}
    try{
      const bridged=JSON.parse(localStorage.getItem('studioflow-website-artworks-bridge')||'[]');
      if(Array.isArray(bridged))bridged.forEach(a=>add(a,'website'));
    }catch{}
    try{
      const web=JSON.parse(localStorage.getItem('fmpGalleryManager')||'null');
      if(Array.isArray(web?.artworks))web.artworks.forEach(a=>add(a,'website'));
    }catch{}
    // Title-keyed URL memory, now self-healing: apply a remembered URL to any entry that's missing
    // one, AND capture any URL we DO see (from a mapped native record or a sync) into that memory.
    // So a piece's URL sticks by title permanently the first time it appears anywhere -- no repeated
    // re-mapping needed (Si'Wash Rock).
    const _sq=(this.state&&this.state.squarespace&&typeof this.state.squarespace==='object')?this.state.squarespace:null;
    const _urlByTitle=(_sq&&_sq.urlByTitle)||{};
    const _out=[...map.values()];
    _out.forEach(a=>{
      const tk=this.titleKey(a.title);if(!tk)return;
      const hasUrl=(a.currentUrl||'').trim()||(a.preferredUrl||'').trim();
      const saved=_urlByTitle[tk];
      if(!hasUrl&&saved){
        if(saved.currentUrl)a.currentUrl=saved.currentUrl;
        if(saved.preferredUrl)a.preferredUrl=saved.preferredUrl;
        if(saved.productId&&!(a.productId||'').trim())a.productId=saved.productId;
      }else if(hasUrl&&_sq){
        const cur=a.currentUrl||'',pref=a.preferredUrl||'',pid=a.productId||'';
        if(!saved||saved.currentUrl!==cur||saved.preferredUrl!==pref||saved.productId!==pid){
          _sq.urlByTitle=_sq.urlByTitle||{};
          _sq.urlByTitle[tk]={currentUrl:cur||(saved&&saved.currentUrl)||'',preferredUrl:pref||(saved&&saved.preferredUrl)||'',productId:pid||(saved&&saved.productId)||''};
        }
      }
    });
    return _out.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
  },
  artworkById(id){return this.artworkCatalog().find(a=>String(a.artworkId||a.id)===String(id))||null;},
  galleryForArtwork(artwork){
    return this.state.galleries.find(g=>g.id===artwork.galleryId) ||
           this.state.galleries.find(g=>String(g.name).trim().toLowerCase()===String(artwork.gallery||'').trim().toLowerCase()) || null;
  },
  closeModal(){this.$('modalRoot').innerHTML=''},

  /* g147 — ONE REPLACEMENT FOR window.prompt(), WHICH ELECTRON DOES NOT IMPLEMENT.
     ============================================================================
     prompt() returns undefined here and logs "prompt() is and will not be supported". Every guard
     written as `const v = prompt(...); if (!v) return;` therefore abandons the operation silently:
     the button appears dead. Found at g113 in the client-room path and fixed there ONLY — four
     more call sites were left, and all four were still dead a month later: Pricing → Add Size,
     Markets & Shows → Add Cost, Crop Tool → custom ratio, Saved Room Projects → rename.
     So this is a SHARED helper rather than a fifth hand-rolled modal. It resolves to an object of
     values, or NULL if cancelled — null is unambiguous, where '' is a legitimate answer.
     Enter accepts, Escape and the backdrop cancel, the first field is focused and selected. */
  askFields(opts){
    const sf=this, o=opts||{}, fields=(o.fields||[]).filter(Boolean);
    return new Promise(resolve=>{
      const row=f=>{
        const v=f.value==null?'':String(f.value);
        if(f.type==='select'){
          return `<label>${sf.esc(f.label||'')}<select data-af="${sf.esc(f.key)}">${
            (f.options||[]).map(x=>`<option value="${sf.esc(x)}" ${x===v?'selected':''}>${sf.esc(x)}</option>`).join('')
          }</select></label>`;
        }
        return `<label>${sf.esc(f.label||'')}<input data-af="${sf.esc(f.key)}" type="${f.type||'text'}"
          value="${sf.esc(v)}" placeholder="${sf.esc(f.placeholder||'')}"
          ${f.step?`step="${sf.esc(f.step)}"`:''} ${f.min!=null?`min="${sf.esc(f.min)}"`:''}></label>`;
      };
      sf.$('modalRoot').innerHTML=`<div class="modal-backdrop" id="afBack"><div class="modal">
        <h3>${sf.esc(o.title||'')}</h3>
        ${o.note?`<p class="muted">${sf.esc(o.note)}</p>`:''}
        <div class="form-grid">${fields.map(row).join('')}</div>
        ${o.help?`<p class="help">${sf.esc(o.help)}</p>`:''}
        <div class="modal-footer">
          <button class="button secondary" id="afCancel">Cancel</button>
          <button class="button primary" id="afOk">${sf.esc(o.okLabel||'Save')}</button>
        </div></div></div>`;
      let done=false;
      const finish=v=>{ if(done)return; done=true; document.removeEventListener('keydown',key,true); sf.closeModal(); resolve(v); };
      const read=()=>{
        const out={};
        document.querySelectorAll('[data-af]').forEach(el=>{ out[el.dataset.af]=el.value; });
        return out;
      };
      const key=e=>{
        if(e.key==='Escape'){e.preventDefault();finish(null)}
        else if(e.key==='Enter'&&e.target&&e.target.tagName!=='TEXTAREA'){e.preventDefault();finish(read())}
      };
      document.addEventListener('keydown',key,true);
      sf.$('afCancel').onclick=()=>finish(null);
      sf.$('afOk').onclick=()=>finish(read());
      const back=sf.$('afBack');
      if(back)back.onclick=e=>{ if(e.target===back)finish(null); };
      const first=document.querySelector('[data-af]');
      if(first){ first.focus(); if(first.select)first.select(); }
    });
  },
  /* The single-answer case, which is most of them. Resolves to '' when cancelled, so an existing
     `if(!v) return;` guard keeps working unchanged. */
  async askText(title,label,value,placeholder,note){
    const r=await this.askFields({title,note,fields:[{key:'v',label,value,placeholder}]});
    return r?String(r.v||'').trim():'';
  },
  buildNavigation(){
    const icons={
      home:'<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
      sales:'<svg viewBox="0 0 24 24"><path d="M5 19V9M12 19V4M19 19v-7M3 19h18"/></svg>',
      website:'<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 9h16"/><circle cx="7" cy="7" r=".6"/></svg>',
      products:'<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 10h16M9 5v14"/></svg>',
      creative:'<svg viewBox="0 0 24 24"><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/></svg>',
      data:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3A1.7 1.7 0 0 0 14 21v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>'
    };
    const groups=[
      {label:'Sales & Business',accent:'#d9b56d',icon:icons.sales,pages:['Sales & Orders','Markets & Shows','Production Plan','Pack List','Price Cards','Invoices','Business Intelligence','Artwork Timeline']},
      /* g180 — WHOLESALE. Kirk: "these functions are all spread out and the tasks should all be
         in one place... we should call this tab wholesale and have the venue commissions and
         the artwork labels in here and whatever else we need for the hotel and designer sales
         flow." The two pages were in different groups for no better reason than the order they
         were built in — labels landed under Products because they name artworks, commission
         under Sales because it counts money. Neither is how the JOB is organised: he prints a
         label, hangs the piece, and gets paid on what sells off that wall. One flow, one tab. */
      {label:'Wholesale',accent:'#c58bd6',icon:icons.sales,pages:['Artwork Labels','Venue Commission']},
      {label:'Website',accent:'#4fa9ff',icon:icons.website,pages:['Website Dashboard','Website Connection','Website Updates','Website Pricing','Website Export','Client Galleries','Product Health']},
      {label:'Products & Inventory',accent:'#70d59a',icon:icons.products,pages:['Artworks','Inventory','Print Production','Materials & Sheet Cutting','AI Printing Assistant','Limited Editions','Pricing','Galleries']},
      {label:'Creative',accent:'#d991ff',icon:icons.creative,pages:['Photo Cull','Crop Tool','Room Designer','AI Art Creation','Scene Packs','Scene Calibration','Saved Room Projects']},
      {label:'Data & Settings',accent:'#a7b4c3',icon:icons.data,pages:['Data Manager','Settings']}
    ];
    const item=(name,accent='#4fa9ff')=>{const badge=name==='Website Updates'&&window.SFWebsiteUpdates?window.SFWebsiteUpdates.waitingCount():0;return `<button class="${name===this.currentPage?'active':''}" data-page="${name}" style="--nav-accent:${accent}"><span class="nav-item-dot"></span><span class="nav-label">${name}${badge?` (${badge})`:''}</span></button>`};
    const home=`<button class="nav-home ${this.currentPage==='Home Dashboard'?'active':''}" data-page="Home Dashboard" style="--nav-accent:#f2c94c"><span class="nav-icon">${icons.home}</span><span class="nav-label">Home Dashboard</span></button>`;
    const sections=groups.map(group=>{
      const open=group.pages.includes(this.currentPage)?' open':'';
      return `<details class="nav-section"${open}><summary style="--nav-accent:${group.accent}"><span class="nav-icon">${group.icon}</span><span class="nav-label">${group.label}</span><span class="nav-chevron">▾</span></summary><div class="nav-submenu">${group.pages.map(page=>item(page,group.accent)).join('')}</div></details>`;
    }).join('');
    this.$('navigation').innerHTML=home+sections;
    this.$('navigation').querySelectorAll('button[data-page]').forEach(button=>button.addEventListener('click',()=>this.goTo(button.dataset.page)));
  },
  initSidebar(){
    const shell=document.querySelector('.sf8-shell');
    const toggle=this.$('sidebarToggle');
    if(!shell||!toggle)return;
    const apply=collapsed=>{shell.classList.toggle('sidebar-collapsed',collapsed);toggle.textContent=collapsed?'›':'‹';toggle.title=collapsed?'Expand sidebar':'Collapse sidebar';toggle.setAttribute('aria-label',toggle.title);};
    apply(localStorage.getItem('studioflow-sidebar-collapsed')==='1');
    toggle.onclick=()=>{const collapsed=!shell.classList.contains('sidebar-collapsed');localStorage.setItem('studioflow-sidebar-collapsed',collapsed?'1':'0');apply(collapsed);};
  },
  goTo(name){
    this.currentPage=name;
    this.buildNavigation();
    this.$('pageTitle').textContent=name;
    this.render();
  },
  syncBrand(){
    this.$('eyebrow').textContent='StudioFlow';
    const logo=this.$('businessBannerLogo');
    const name=this.$('businessBannerName');
    name.textContent=this.state.business.name||'Your Photography Business';
    if(this.state.business.logo){
      logo.src=this.state.business.logo;
      logo.classList.remove('hidden');
    }else{
      logo.removeAttribute('src');
      logo.classList.add('hidden');
    }
  },
  render(){
    // Wired here rather than a one-time init -- this button lives in the persistent top bar
    // outside the page-content area render() replaces, so it was never actually connected to
    // anything. Re-wiring on every render is harmless and guarantees it's always live.
    const backupBtn=this.$('topBackup');
    if(backupBtn&&!backupBtn.dataset.wired){
      backupBtn.dataset.wired='1';
      backupBtn.onclick=async()=>{
        backupBtn.disabled=true;
        const original=backupBtn.textContent;
        backupBtn.textContent='Backing up...';
        try{
          const result=await this.api.createBackup();
          if(result?.ok||result?.path||result){
            this.logActivity('Manual backup created');
            alert(`Backup saved${result?.path?`:\n${result.path}`:'.'}`);
          }else{
            alert('Backup may not have completed -- check Data Manager to confirm, or try again.');
          }
        }catch(err){
          this.logError?.(err,'Manual Backup');
          alert(`Backup failed: ${err.message||err}`);
        }finally{
          backupBtn.disabled=false;
          backupBtn.textContent=original;
        }
      };
    }
    try{
      const map={
        'Home Dashboard':window.SFDashboard,
        'Website Dashboard':window.SFWebsiteDashboard,
        'Website Connection':window.SFWebsiteConnection,
        'Sales & Orders':window.SFCommerceHub,
        'Markets & Shows':window.SFMarketsShows,
                'Data Manager':window.SFSettings,
        'Production Plan':window.SFForecast,'Pack List':window.SFPackList,'Invoices':window.SFInvoices,'Artwork Labels':window.SFLabelQR,'Client Galleries':window.SFClientGalleries,'Venue Commission':window.SFVenueCommission,'Price Cards':window.SFPriceCards,'Business Intelligence':window.SFBusinessIntelligence,
        'AI Printing Assistant':window.SFAIPrintingAssistant,
        'Materials & Sheet Cutting':window.SFMaterialsCutting,
        'Artwork Timeline':window.SFArtworkTimeline,
        'Limited Editions':window.SFLimitedEditions,
        'Website Pricing':window.SFUnifiedPricing,
                'Inventory':window.SFInventorySales,
        'Print Production':window.SFProductionWorkspace,
        'Website Updates':window.SFWebsiteUpdates,'Website Export':window.SFWebsiteExport,
        'Product Health':window.SFProductHealth,
        'Photo Cull':window.SFPhotoCull,
        'Crop Tool':window.SFCropTool,
        'Dashboard':window.SFDashboard,
        'Pricing':window.SFUnifiedPricing,
        'Artworks':window.SFArtworks,'Galleries':window.SFGalleries,
        'Scene Packs':window.SFScenes,
        'Scene Calibration':window.SFCalibration,
        'Room Designer':window.SFRoomDesigner,
        'AI Art Creation':window.SFAIRoomGenerator,
        'Saved Room Projects':window.SFRoomProjects,
        'Settings':window.SFSettings
      };
      const module=map[this.currentPage]||window.SFDashboard;
      module.render.call(module);
    }catch(error){
      this.logError(error,`Render ${this.currentPage}`);
      this.$('workspace').innerHTML=`<div class="card"><h2>StudioFlow could not display this page</h2><p>The error was saved in Settings.</p></div>`;
    }
  }
};

/* StudioFlow 3.9.0 g65 · Don't rewrite the page out from under someone who's typing.
   A background job (website sync, gallery updates) finishing mid-entry called SF.render(), which
   replaces the workspace DOM and silently discards whatever was half-typed. Kirk hit this on the
   expense Amount field and had to stop web updates before he could edit anything. Now a render
   that arrives while a field is focused or a modal is open is held and applied on the way out. */
(function(){
 const SF=window.SF;if(!SF)return;
 const original=SF.render;
 let deferred=false;
 SF.renderNow=function(){deferred=false;return original.call(SF)};
 const busy=()=>{
  const modal=document.getElementById('modalRoot');
  if(modal&&modal.innerHTML.trim())return true;
  const el=document.activeElement;
  if(!el||el===document.body)return false;
  if(el.isContentEditable)return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&!el.disabled&&!/^(button|submit|reset)$/i.test(el.type||'');
 };
 SF.render=function(){
  if(busy()){deferred=true;return;}
  return SF.renderNow();
 };
 const flush=()=>{if(deferred&&!busy())SF.renderNow()};
 // Leaving a field, or closing a modal, is the moment it's safe to catch up.
 document.addEventListener('focusout',()=>setTimeout(flush,150),true);
 const originalClose=SF.closeModal;
 SF.closeModal=function(){const r=originalClose.call(this);setTimeout(flush,0);return r};
 setInterval(flush,2000);
})();

/* g71 FMP FILE IDS. New artwork was being stamped with two DIFFERENT generated ids
   (id:sf.makeId('ART'), artworkId:sf.makeId('ART')), so a new piece didn't match the FMP-0076
   house numbering and its two id fields disagreed with each other. nextArtworkId() reads the
   highest number already in use across native artworks AND the merged website catalog, so a
   number is never reused even if a piece only exists on the website side. Prefix and zero-padding
   are learned from the existing ids rather than hard-coded, and the result is checked against
   every id in use before being handed out. */
(function(){
  const SF=window.SF; if(!SF) return;
  SF.nextArtworkId=function(){
    const rx=/^([A-Za-z]{2,6})-(\d{2,6})$/;
    const rows=[],taken=new Set();
    const add=v=>{const t=String(v==null?'':v).trim();if(!t)return;taken.add(t.toUpperCase());const m=rx.exec(t);if(m)rows.push(m);};
    (this.state?.artworks||[]).forEach(a=>{add(a.artworkId);add(a.id);});
    try{(this.artworkCatalog?this.artworkCatalog():[]).forEach(a=>{add(a.artworkId);add(a.id);});}catch(e){}
    const fmp=rows.filter(m=>/^fmp$/i.test(m[1]));
    const use=fmp.length?fmp:rows;
    const prefix=fmp.length?'FMP':(use.length?use[0][1].toUpperCase():'FMP');
    const width=use.length?Math.max(4,...use.map(m=>m[2].length)):4;
    let n=use.length?Math.max(...use.map(m=>Number(m[2]))):0,id='';
    do{n++;id=`${prefix}-${String(n).padStart(width,'0')}`;}while(taken.has(id.toUpperCase())&&n<999999);
    return id;
  };
  // How many pieces are still on a generated id rather than a proper file id -- surfaced so the
  // gap is visible instead of silently growing.
  SF.artworksWithoutFileId=function(){
    return (this.state?.artworks||[]).filter(a=>!/^FMP-/i.test(String(a.artworkId||a.id||'')));
  };
})();

/* g73 RENUMBER AN ARTWORK. Pieces created before g71 carry a generated ART- id instead of an
   FMP-#### file id. The tempting fix -- make a new record and merge the old one into it -- is the
   wrong shape: it briefly creates two records for one photograph and any reference missed during
   the merge is left pointing at a record that then gets deleted, silently orphaning sales history.
   Renumbering in place is strictly safer: the record never stops existing, and every reference to
   it moves in the same operation.
   Rather than enumerate the collections that hold artwork references (and miss one), this walks
   the whole state tree and rewrites reference-bearing keys whose value is EXACTLY the old id.
   Exact-value matching is what makes it safe: localProductId is also used for pricing-template
   ids, but a template id is never equal to an artwork id. */
(function(){
  const SF=window.SF; if(!SF) return;
  const REF_KEYS=new Set(['artworkId','localProductId']);
  SF.artworkReferenceScan=function(oldId,newId,apply){
    const state=this.state||{};
    const where={};let hits=0;
    const bump=label=>{where[label]=(where[label]||0)+1;hits++;};
    const seen=new WeakSet();
    const walk=(node,label)=>{
      if(!node||typeof node!=='object')return;
      if(seen.has(node))return; seen.add(node);
      if(Array.isArray(node)){node.forEach(n=>walk(n,label));return;}
      for(const k of Object.keys(node)){
        const v=node[k];
        if(REF_KEYS.has(k)&&typeof v==='string'&&v===oldId){if(apply)node[k]=newId;bump(label);}
        else if(k==='artworkIds'&&Array.isArray(v)){v.forEach((x,i)=>{if(x===oldId){if(apply)v[i]=newId;bump(label);}});}
        else if(v&&typeof v==='object')walk(v,label);
      }
    };
    for(const key of Object.keys(state))walk(state[key],key);
    return {hits,where};
  };
  SF.renumberArtwork=function(oldId,newId){
    const o=String(oldId||'').trim(),n=String(newId||'').trim();
    if(!o||!n)return {ok:false,error:'Both the old and new file ID are needed.'};
    if(o===n)return {ok:false,error:'That piece already has that file ID.'};
    const arts=this.state?.artworks||[];
    const art=arts.find(a=>String(a.id)===o||String(a.artworkId)===o);
    if(!art)return {ok:false,error:`No piece in StudioFlow has the ID ${o}.`};
    const clash=arts.find(a=>a!==art&&(String(a.id).toUpperCase()===n.toUpperCase()||String(a.artworkId||'').toUpperCase()===n.toUpperCase()));
    if(clash)return {ok:false,error:`${n} is already used by "${clash.title||'another piece'}".`};
    const result=this.artworkReferenceScan(o,n,true);
    art.id=n;art.artworkId=n;art.updatedAt=new Date().toISOString();
    return {ok:true,hits:result.hits,where:result.where,title:art.title||''};
  };
})();

/* g77 GALLERY MEMBERSHIP + IMAGE FALLBACK.
   Membership: a piece carries BOTH `galleryId` (what the editor writes, and what the user is
   actually choosing) and a legacy `gallery` NAME string. The gallery views OR'd the two together,
   so a piece reassigned to a new gallery kept showing under its OLD one whenever the stale name
   string hadn't been rewritten -- "in the wrong gallery even though they are properly assigned".
   The id wins whenever it resolves to a real gallery; the name is only consulted for pieces that
   have no galleryId at all (older records that predate ids).
   The stale strings are also healed on load, so the mismatch stops coming back. */
(function(){
  const SF=window.SF; if(!SF) return;
  SF.artworkInGallery=function(a,gallery){
    if(!a||!gallery)return false;
    const gid=String(a.galleryId||'');
    if(gid){
      // Only trust the id if it points at a gallery that still exists -- a deleted-and-recreated
      // gallery leaves dangling ids, and those pieces should still be findable by name.
      const resolves=(this.state?.galleries||[]).some(g=>String(g.id)===gid);
      if(resolves)return gid===String(gallery.id);
    }
    // No usable id: fall back by name. `category` comes from the WEBSITE side (a Squarespace
    // category/tag), and OR-ing it in meant a piece correctly filed in Wildlife ALSO matched
    // "World Images" because its website record carried that category -- the same photograph
    // appearing in two galleries at once. Category is now a last resort, used only when the piece
    // has no gallery name of its own, so website-only records stay findable without overriding a
    // real assignment.
    // g83: a single record can only land in one gallery now, so a photograph appearing TWICE means
    // the catalogue holds TWO records for it -- the native one Kirk filed, plus a website-cache
    // record whose title didn't match closely enough to fold into it. That stray has no galleryId,
    // so it was being placed by its Squarespace category or a cached gallery name, which is how
    // the correct copy AND a wrong copy both showed. Gallery membership is a StudioFlow concept:
    // if a record isn't a real native piece and has no resolving galleryId, it doesn't belong in a
    // gallery at all. It stays in the artwork catalogue and in Product Health, just not here.
    const key=this.titleKey?this.titleKey(a.title):String(a.title||'').toLowerCase();
    const native=(this.state?.artworks||[]).some(x=>
      String(x.id)===String(a.id)||
      (a.artworkId&&String(x.artworkId||'')===String(a.artworkId))||
      (key&&(this.titleKey?this.titleKey(x.title):String(x.title||'').toLowerCase())===key));
    if(!native)return false;
    const norm=v=>String(v==null?'':v).trim().toLowerCase();
    const own=a.gallery||a.galleryName||'';
    if(own)return norm(own)===norm(gallery.name);
    return !!a.category&&norm(a.category)===norm(gallery.name);
  };
  let _healed=false;
  // Correct display no longer depends on this (artworkInGallery makes the id authoritative), but
  // healing the stale strings keeps every other consumer honest too. Once per session, and only
  // saved if something actually changed.
  SF.healGalleryNamesOnce=function(){
    if(_healed)return 0;_healed=true;
    const n=this.healGalleryNames();
    if(n){try{this.persist&&this.persist();}catch(e){}}
    return n;
  };
  SF.healGalleryNames=function(){
    const galleries=this.state?.galleries||[];
    if(!galleries.length)return 0;
    const byId=new Map(galleries.map(g=>[String(g.id),g]));
    let fixed=0;
    for(const a of (this.state?.artworks||[])){
      const g=byId.get(String(a.galleryId||''));
      if(g&&a.gallery!==g.name){a.gallery=g.name;fixed++;}
    }
    return fixed;
  };
  // The Artworks grid reads state.artworks directly, but for some pieces the only image lives on
  // the website-cache side of artworkCatalog(). Build one lookup per render rather than per card.
  SF.imageIndex=function(){
    const idx=new Map();
    const add=(k,v)=>{if(k&&v&&!idx.has(k))idx.set(k,v);};
    try{
      for(const a of (this.artworkCatalog?this.artworkCatalog():[])){
        const src=a.image||a.permanentImagePath||a.imagePath||a.imageData||a.thumbnail||'';
        if(!src)continue;
        add(String(a.id),src); add(String(a.artworkId||''),src); add(this.titleKey(a.title),src);
      }
    }catch(e){}
    return idx;
  };
  SF.artworkImage=function(a,idx){
    return a.image||a.permanentImagePath||a.imagePath||a.imageData||a.thumbnail||
      (idx?(idx.get(String(a.id))||idx.get(String(a.artworkId||''))||idx.get(this.titleKey(a.title))):'')||'';
  };
})();
