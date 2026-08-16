
window.SFPhotoCull={
  session:null,index:0,thumbCache:new Map(),objectUrls:new Map(),loading:false,comparePaths:new Set(),zoomMode:'fit',zoomPct:100,preloadToken:0,viewRequestId:0,
  profile:{version:1,weights:{sharpness:.45,exposure:.25,contrast:.15,uniqueness:.15},corrections:0},
  loadProfile(){try{this.profile={...this.profile,...JSON.parse(localStorage.getItem('sf-cull-profile')||'{}')}}catch{}},
  saveProfile(){localStorage.setItem('sf-cull-profile',JSON.stringify(this.profile))},
  async render(){this.loadProfile();const sf=window.SF;sf.$('workspace').innerHTML=`
    <div class="cull-shell">
      <section class="cull-viewer">
        <div class="cull-toolbar"><button class="button primary" id="cullChoose">Open Shoot Folder</button><button class="button" id="cullChange">Change Folder</button><button class="button danger" id="cullCancel">Cancel Import</button><button class="button" id="cullFocus" title="Hide the panels and fill the window with the photograph (F)">Full view</button><button class="button" id="cullAiPass">AI First Pass</button><button class="button ai-accept" id="cullAcceptAi">Accept AI Suggestions</button><div class="cull-progress"><span id="cullProgress" style="width:0%"></span></div><span id="cullPosition">0 / 0</span></div>
        <div class="cull-preload" id="cullPreload" hidden><div class="cull-preload-glow"></div><div class="cull-preload-bar"><div class="cull-preload-fill" id="cullPreloadFill"></div></div><div class="cull-preload-label" id="cullPreloadLabel">Loading previews…</div></div>
        <div class="cull-stage" id="cullStage"><div class="cull-placeholder"><h2>StudioFlow Photo Cull</h2><p>Open a shoot folder to review RAW and image files.</p><p><b>1</b> Yes &nbsp; <b>2</b> Maybe &nbsp; <b>3</b> No &nbsp; <b>← →</b> Navigate</p></div></div>
        <div class="cull-lower-deck">
          <div class="cull-control-deck">
            <div class="cull-zoom-controls">
              <button class="button cull-zoom-step" id="cullZoomOut" title="Zoom out">−</button>
              <label for="cullZoom">Zoom</label>
              <input id="cullZoom" type="range" min="25" max="400" step="25" value="100">
              <output id="cullZoomValue">Fit</output>
              <button class="button cull-zoom-step" id="cullZoomIn" title="Zoom in">+</button>
              <button class="button" data-cull-zoom="100">100%</button>
              <button class="button" data-cull-zoom="200">200%</button>
            </div>
            <div class="cull-focus-deck">
              <button class="button" id="cullFocusPrev" title="Previous (\u2190)">\u2190</button>
              <button class="cull-rating yes" data-rate="yes">YES<br><small>1</small></button>
              <button class="cull-rating maybe" data-rate="maybe">MAYBE<br><small>2</small></button>
              <button class="cull-rating no" data-rate="no">NO<br><small>3</small></button>
              <button class="button" id="cullFocusNext" title="Next (\u2192)">\u2192</button>
              <span class="cull-focus-sep"></span>
              <button class="button" id="cullFocusAddCompare" title="Add this frame to the comparison (C)">\uff0b Compare</button>
              <button class="button" id="cullFocusShowCompare" title="View the comparison">View Compare (0)</button>
              <span class="cull-focus-counter" id="cullFocusCounter"></span>
            </div>
            <div class="cull-compare-controls"><button class="button secondary" id="cullAddCompare">＋ Compare</button><button class="button primary" id="cullShowCompare">View Compare</button><button class="button" id="cullClearCompare">Clear</button></div>
          </div>
          <div class="cull-filmstrip-row"><button class="button cull-strip-arrow" id="cullStripLeft" title="Previous thumbnails">◀</button><div class="cull-filmstrip" id="cullFilmstrip"></div><button class="button cull-strip-arrow" id="cullStripRight" title="Next thumbnails">▶</button></div>
          <div class="cull-footer"><span id="cullFilename">No shoot loaded</span><div><button class="button" id="cullPrev">← Previous</button> <button class="button" id="cullNext">Next →</button></div></div>
        </div>
      </section>
      <aside class="cull-panel"><div class="cull-panel-body">
        <h2>Photo Cull</h2><div class="cull-rating-grid"><button class="cull-rating yes" data-rate="yes">YES<br><small>1</small></button><button class="cull-rating maybe" data-rate="maybe">MAYBE<br><small>2</small></button><button class="cull-rating no" data-rate="no">NO<br><small>3</small></button></div>
        <div class="cull-counts"><div class="cull-count">Yes<b id="countYes">0</b></div><div class="cull-count">Maybe<b id="countMaybe">0</b></div><div class="cull-count">No<b id="countNo">0</b></div><div class="cull-count">Unrated<b id="countUnrated">0</b></div></div>
        <div class="ai-card"><div class="cull-switch"><input type="checkbox" id="aiEnabled" checked><label for="aiEnabled">AI assisted recommendations</label></div><div id="aiResult"><p class="muted">Open a photograph to calculate a local recommendation.</p></div></div>
        <div class="cull-meta" id="cullMeta">RAW files remain untouched. StudioFlow uses Windows-generated previews when available.</div>
        <hr><h3>Finish this shoot</h3><div class="cull-file-plan"><b>Space-saving finish</b><small>YES and MAYBE originals are moved into their folders. NO files are sent to the Windows Recycle Bin. No duplicate RAW files are created.</small></div><input id="cullMode" type="hidden" value="move"><label class="cull-switch"><input id="cullDeleteNo" type="checkbox" checked> Send No files to Recycle Bin</label><button class="button primary" id="cullFinish" style="width:100%;margin-top:12px">Organize Rated Files</button><button class="button" id="cullLightroom" style="width:100%;margin-top:8px">Export YES Files to Lightroom Classic</button>
        <div class="ai-training-panel" style="margin-top:15px"><h3>AI Cull Training</h3><p class="muted">After you correct AI suggestions, click Train from My Decisions to reinforce your choices.</p><div>Corrections learned: <b id="aiCorrections">${this.profile.corrections||0}</b></div><button class="button primary" id="trainAi" style="margin-top:8px;width:100%">Train from My Decisions</button><button class="button" id="cullTrainArchive" style="margin-top:6px;width:100%" title="Point at a past shoot, or a folder of them, and learn from everything you edited">Train from past shoots\u2026</button><button class="button" id="cullLearnEdits" style="margin-top:6px;width:100%" title="Reads the lightroom alterations folder in this shoot and learns from which frames you edited">Learn from my edits</button>${(()=>{const m=this.learned&&this.learned();return m&&m.w?`<div class="muted" style="margin-top:6px;font-size:.78rem">Trained on <b>${m.trainedOn}</b> frames across <b>${m.shoots}</b> shoot(s) \u00b7 agrees with you <b>${Math.round(m.accuracy*100)}%</b> of the time <button class="button" id="cullLearnWhat" style="margin-top:4px;width:100%">What did it learn?</button></div>`:'<div class="muted" style="margin-top:6px;font-size:.78rem">Nothing learned yet. Open a shoot you have already edited and press the button above.</div>';})()}<button class="button" id="resetAi" style="margin-top:8px;width:100%">Reset AI Training</button></div>
      </div></aside>
    </div>`;
    sf.$('cullChoose').onclick=()=>this.chooseFolder();sf.$('cullChange').onclick=()=>this.chooseFolder();sf.$('cullCancel').onclick=()=>this.cancelImport();sf.$('cullAcceptAi').onclick=()=>this.acceptAISuggestions();sf.$('cullAiPass').onclick=()=>this.aiFirstPass();sf.$('cullPrev').onclick=()=>this.move(-1);sf.$('cullNext').onclick=()=>this.move(1);sf.$('cullFinish').onclick=()=>this.finish(false);sf.$('cullLightroom').onclick=()=>this.finish(true);sf.$('cullStripLeft').onclick=()=>this.scrollFilmstrip(-1);sf.$('cullStripRight').onclick=()=>this.scrollFilmstrip(1);sf.$('resetAi').onclick=()=>this.resetAI();sf.$('trainAi').onclick=()=>this.trainFromDecisions();sf.$('cullZoom').oninput=e=>this.setZoom(+e.target.value);sf.$('cullZoomIn').onclick=()=>this.setZoom(Math.min(400,(this.zoomPct||100)+25));sf.$('cullZoomOut').onclick=()=>this.setZoom(Math.max(25,(this.zoomPct||100)-25));document.querySelectorAll('[data-cull-zoom]').forEach(b=>b.onclick=()=>this.setZoom(+b.dataset.cullZoom));sf.$('cullAddCompare').onclick=()=>this.toggleCompare();sf.$('cullShowCompare').onclick=()=>this.showCompare();sf.$('cullClearCompare').onclick=()=>{this.comparePaths.clear();this.updateCompareButtons()};sf.$('cullStage').ondblclick=()=>this.setZoom(this.zoomMode==='fit'?100:'fit');this.bindViewerPanZoom();
    document.querySelectorAll('.cull-rating').forEach(b=>b.onclick=()=>this.rate(b.dataset.rate));
    /* g120 — FULL VIEW.
       Kirk asked for a bigger picture while culling: collapse both sides and leave only zoom,
       scroll and yes/no/maybe. The ratings in the deck carry the SAME .cull-rating class and
       data-rate attribute as the ones in the side panel, so the line above wires them with no
       extra handler — and the active-state sync below already targets every .cull-rating too.
       The state is remembered, because someone who wants the big view wants it every time. */
    const applyFocus=()=>{
      document.body.classList.toggle('cull-focus',!!this.focusMode);
      const b=window.SF.$('cullFocus');
      if(b)b.textContent=this.focusMode?'Show panels':'Full view';
      if(this.applyZoom)this.applyZoom();          // the stage just changed size
    };
    if(this.focusMode===undefined){
      try{ this.focusMode=localStorage.getItem('sf-cull-focus')==='1'; }catch(_){ this.focusMode=false; }
    }
    const archiveBtn=window.SF.$('cullTrainArchive');
    if(archiveBtn)archiveBtn.onclick=()=>this.trainFromArchive();
    const learnBtn=window.SF.$('cullLearnEdits');
    if(learnBtn)learnBtn.onclick=()=>this.learnFromEdits();
    const learnWhat=window.SF.$('cullLearnWhat');
    if(learnWhat)learnWhat.onclick=()=>this.explainLearning();
    const focusBtn=window.SF.$('cullFocus');
    if(focusBtn)focusBtn.onclick=()=>{
      this.focusMode=!this.focusMode;
      try{ localStorage.setItem('sf-cull-focus',this.focusMode?'1':'0'); }catch(_){}
      applyFocus();
    };
    const fp=window.SF.$('cullFocusPrev'), fn=window.SF.$('cullFocusNext');
    if(fp)fp.onclick=()=>window.SF.$('cullPrev')?.click();
    if(fn)fn.onclick=()=>window.SF.$('cullNext')?.click();
    const fac=window.SF.$('cullFocusAddCompare'), fsc=window.SF.$('cullFocusShowCompare');
    if(fac)fac.onclick=()=>window.SF.$('cullAddCompare')?.click();
    if(fsc)fsc.onclick=()=>window.SF.$('cullShowCompare')?.click();
    this.updateCompareButtons();
    applyFocus();
    this.keyHandler=e=>{if(sf.currentPage!=='Photo Cull'||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='c'||e.key==='C'){/* g121: C adds the current frame to the comparison. */e.preventDefault();sf.$('cullAddCompare')?.click();return}if(e.key==='f'||e.key==='F'){/* g120: F toggles Full view, matching the button's tooltip. */e.preventDefault();const b=sf.$('cullFocus');if(b)b.click();return};if(e.key==='1')this.rate('yes');if(e.key==='2')this.rate('maybe');if(e.key==='3')this.rate('no');if(e.key==='ArrowLeft')this.move(-1);if(e.key==='ArrowRight')this.move(1)};document.addEventListener('keydown',this.keyHandler);
    if(this.session)this.refresh();
  },
  // g79: nothing at all was shown between picking a folder and the first preview appearing --
  // the progress bar only started once thumbnail preloading began, so scanning a big shoot looked
  // like the app had done nothing. Show the bar from the moment the picker opens.
  showPreloadMessage(text){
    const sf=window.SF,bar=sf.$('cullPreload'),fill=sf.$('cullPreloadFill'),label=sf.$('cullPreloadLabel');
    if(!bar)return;
    clearTimeout(this._preloadHide);
    bar.hidden=false;bar.classList.remove('done');bar.classList.add('indeterminate');
    if(fill)fill.style.width='100%';
    if(label)label.textContent=text;
  },
  hidePreload(){
    const sf=window.SF,bar=sf.$('cullPreload');
    if(!bar)return;
    clearTimeout(this._preloadHide);
    bar.classList.remove('indeterminate');bar.hidden=true;
  },
  async chooseFolder(){
    this.showPreloadMessage('Choose a shoot folder…');
    let data=null;
    try{data=await window.SF.api.chooseCullFolder?.();}
    catch(error){this.hidePreload();alert(`That folder could not be read.\n\n${error.message||error}`);return;}
    if(!data){this.hidePreload();return;}
    this.showPreloadMessage(`Reading ${data.files.length} file${data.files.length===1?'':'s'}…`);
    this.preloadToken++;this.session={folder:data.folder,files:data.files.map(f=>({...f,rating:'',ai:null,hdrGroup:'',previewState:'pending'})),createdAt:new Date().toISOString()};this.detectBracketGroups();this.index=0;this.zoomMode='fit';this.zoomPct=100;this.comparePaths.clear();this.thumbCache.clear();
    this.showPreloadMessage('Opening the first photograph…');
    await this.refresh();
    this.preloadThumbnails(this.preloadToken);
  },
  cancelImport(){this.hidePreload();if(!this.session)return;if(confirm('Cancel this shoot import? Your source files will not be changed.')){this.preloadToken++;this.session=null;this.index=0;this.thumbCache.clear();this.render()}},
  async requestPreview(f){if(!f)return null;if(this.thumbCache.has(f.path))return this.thumbCache.get(f.path);f.previewState='loading';this.renderFilmstrip();let result;try{result=await window.SF.api.getCullThumbnail?.(f.path)}catch(error){result={ok:false,error:error?.message||String(error),stages:[]}}this.thumbCache.set(f.path,result||{ok:false,error:'No preview response was returned.',stages:[]});f.previewState=result?.ok?'ready':'failed';return this.thumbCache.get(f.path)},
  async preloadThumbnails(token){if(!this.session)return;const files=[...this.session.files],total=files.length;let cursor=0,done=0;this.updatePreload(0,total);const worker=async()=>{while(token===this.preloadToken&&this.session&&cursor<files.length){const f=files[cursor++];if(!this.thumbCache.has(f.path))await this.requestPreview(f);done++;if(token!==this.preloadToken||!this.session)return;this.updatePreload(done,total);this.renderFilmstrip();await new Promise(r=>setTimeout(r,0))}};await Promise.all(Array.from({length:Math.min(4,files.length)},()=>worker()));if(token===this.preloadToken){this.updatePreload(total,total);this.renderFilmstrip()}},
  updatePreload(done,total){const sf=window.SF,bar=sf.$('cullPreload'),fill=sf.$('cullPreloadFill'),label=sf.$('cullPreloadLabel');if(!bar)return;bar.classList.remove('indeterminate');const pct=total?Math.round(done/total*100):100;if(total>0&&done>=total){bar.classList.add('done');if(fill)fill.style.width='100%';if(label)label.textContent=`✓ All ${total} previews ready — start your AI first pass`;clearTimeout(this._preloadHide);this._preloadHide=setTimeout(()=>{const b=sf.$('cullPreload');if(b)b.hidden=true},2600)}else{clearTimeout(this._preloadHide);bar.hidden=false;bar.classList.remove('done');if(fill)fill.style.width=pct+'%';if(label)label.textContent=`Loading previews… ${pct}%  ·  ${done} / ${total}`}},
    acceptAISuggestions(){if(!this.session)return alert('Open a shoot folder first.');const suggested=this.session.files.filter(f=>f.ai&&!f.rating);if(!suggested.length)return alert('Run AI First Pass first, or all suggestions have already been rated.');if(!confirm(`Accept ${suggested.length} AI suggestions as Yes, Maybe, or No? You can still review them before organizing files.`))return;suggested.forEach(f=>f.rating=f.ai.rating);this.updateCounts();this.renderFilmstrip();this.refresh()},
  current(){return this.session?.files?.[this.index]},
  async refresh(){if(!this.session)return;const files=this.session.files,f=this.current();this.zoomMode='fit';this.zoomPct=100;window.SF.$('cullPosition').textContent=`${files.length?this.index+1:0} / ${files.length}`;/* g120: mirror the position into the full-view deck, where the progress bar is hidden. */
    {const fc=window.SF.$('cullFocusCounter');if(fc)fc.textContent=`${files.length?this.index+1:0} / ${files.length}`;};window.SF.$('cullProgress').style.width=`${files.length?(this.index+1)/files.length*100:0}%`;window.SF.$('cullFilename').textContent=f?.name||'No images';this.updateCounts();this.renderFilmstrip();if(f)await this.showFile(f);this.updateCompareButtons()},
  diagnosticHtml(stages=[]){return `<details class="cull-pipeline"><summary>Preview diagnostics</summary>${stages.map(x=>`<div class="cull-pipeline-row ${x.status}"><b>${x.status==='ok'?'✓':x.status==='running'?'…':x.status==='skipped'?'–':'✕'}</b><span>${window.SF.esc(x.name)}</span><small>${window.SF.esc(x.detail||'')}</small></div>`).join('')}</details>`},
  metadataHtml(f,exif={},result={}){const esc=window.SF.esc,rows=[['Camera',exif.camera],['Lens',exif.lens],['Exposure',exif.exposure],['Aperture',exif.aperture],['ISO',exif.iso],['Focal length',exif.focalLength],['Dimensions',exif.dimensions],['Captured',exif.captured]].filter(x=>x[1]);return `<div class="cull-camera-info"><h3>Camera Information</h3>${rows.length?rows.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join(''):'<p class="muted">Camera information was not available for this file.</p>'}</div><div class="cull-file-info"><b>${esc(f.name)}</b><br>${esc(f.extension)} · ${this.fileSize(f.size)}<br>Modified ${new Date(f.modified).toLocaleString()}<br>Preview: ${esc(f.previewSource||result.source||'available')}</div>${this.diagnosticHtml(result?.stages||[])}`},
  previewUrl(result,key=''){if(result?.data)return result.data;if(result?.previewUrl)return `${result.previewUrl}${result.previewUrl.includes('?')?'&':'?'}sf=${Date.now()}`;if(result?.bytes){if(key&&this.objectUrls.has(key))URL.revokeObjectURL(this.objectUrls.get(key));const bytes=result.bytes instanceof Uint8Array?result.bytes:new Uint8Array(result.bytes);const url=URL.createObjectURL(new Blob([bytes],{type:result.mime||'image/jpeg'}));if(key)this.objectUrls.set(key,url);return url}return ''},
  async showFile(f){
    const requestId=++this.viewRequestId,stage=window.SF.$('cullStage');
    stage.innerHTML='<div class="cull-loading">Loading preview…</div>';
    const result=await this.requestPreview(f);
    let exif={};try{exif=await window.SF.api.getCullMetadata?.(f.path)||{}}catch{}
    if(requestId!==this.viewRequestId||this.current()?.path!==f.path)return;
    this.renderFilmstrip();
    if(result?.ok){
      f.previewSource=result.source||'decoded-preview';
      stage.innerHTML=`<img id="cullMainImage" alt="${window.SF.esc(f.name)}" draggable="false">`;
      const img=window.SF.$('cullMainImage');
      const sources=[result.data,result.thumbnailData,this.previewUrl(result,f.path)].filter((v,i,a)=>v&&a.indexOf(v)===i);
      let loaded=false,lastError='';
      for(const src of sources){
        const attempt=await this.loadMainImage(img,src);
        if(attempt.ok){loaded=true;break}
        lastError=attempt.error;
      }
      if(!loaded){
        stage.innerHTML=`<div class="cull-placeholder"><h3>CR3 preview diagnostic</h3><p>${window.SF.esc(f.name)}</p><p>${window.SF.esc(lastError||'Electron could not display the prepared preview.')}</p><p>Extraction source: ${window.SF.esc(result.source||'unknown')}<br>Display routes attempted: medium preview, filmstrip preview, cached preview</p><button class="button primary" id="openRawExternally">Open Original in Windows</button></div>`;
        const b=window.SF.$('openRawExternally');if(b)b.onclick=()=>window.SF.api.openCullFile?.(f.path);
        f.ai={rating:'maybe',confidence:35,score:50,reasons:['Preview renderer failed, manual review recommended']};this.renderAI(f.ai);
      }else{
        const deg=this.cullRotationDeg(exif.orientation);
        f.rotationDeg=deg;
        if(deg)await this.applyRotation(img,deg);
        if(!f.ai)f.ai=this.analyzeImage(img);
        if(f.hdrGroup){f.ai.rating='maybe';f.ai.confidence=Math.max(f.ai.confidence,82);f.ai.reasons.unshift('Possible HDR bracket sequence · keep the exposure set together')}
        this.renderAI(f.ai);this.applyZoom();this.bindImagePan();
      }
    }else{
      stage.innerHTML=`<div class="cull-placeholder"><h3>Preview unavailable</h3><p>${window.SF.esc(f.name)}</p><p>${window.SF.esc(result?.error||'StudioFlow could not decode this RAW preview.')}</p>${this.diagnosticHtml(result?.stages)}<button class="button primary" id="openRawExternally">Open Original in Windows</button></div>`;
      setTimeout(()=>{const b=window.SF.$('openRawExternally');if(b)b.onclick=()=>window.SF.api.openCullFile?.(f.path)},0);
      f.ai={rating:'maybe',confidence:35,score:50,reasons:['Preview unavailable, manual review recommended']};this.renderAI(f.ai)
    }
    window.SF.$('cullMeta').innerHTML=this.metadataHtml(f,exif,result);
    document.querySelectorAll('.cull-rating').forEach(b=>b.classList.toggle('active',b.dataset.rate===f.rating));
  },
  loadMainImage(img,src){return new Promise(resolve=>{let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)};const timer=setTimeout(()=>finish({ok:false,error:'Image renderer timed out after 10 seconds.'}),10000);img.onload=()=>finish(img.naturalWidth>0?{ok:true}:{ok:false,error:'The preview loaded without image dimensions.'});img.onerror=()=>finish({ok:false,error:'Electron rejected this preview source.'});img.removeAttribute('src');img.src=src;if(img.complete&&img.naturalWidth>0)finish({ok:true})})},
  analyzeImage(img){const canvas=document.createElement('canvas'),max=320,scale=Math.min(1,max/img.naturalWidth);canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,canvas.width,canvas.height);const d=c.getImageData(0,0,canvas.width,canvas.height).data;let lum=0,lum2=0,edges=0,n=d.length/4,prev=0;for(let i=0;i<d.length;i+=4){const l=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];lum+=l;lum2+=l*l;if(i>0)edges+=Math.abs(l-prev);prev=l}const mean=lum/n,contrast=Math.sqrt(Math.max(0,lum2/n-mean*mean)),sharp=Math.min(100,edges/n*1.6),exposure=Math.max(0,100-Math.abs(mean-128)*1.15);const w=this.profile.weights||{};const score=Math.round(sharp*(w.sharpness||.45)+exposure*(w.exposure||.25)+Math.min(100,contrast*2)*(w.contrast||.15)+70*(w.uniqueness||.15));const rating=this.rateFromScore(score);const reasons=[sharp>65?'Strong detail estimate':sharp<35?'Possible softness or motion blur':'Moderate detail',exposure>75?'Balanced brightness':exposure<45?'Possible exposure issue':'Usable brightness',contrast>42?'Good tonal separation':'Low tonal separation'];return{rating,confidence:Math.min(96,Math.round(55+Math.abs(score-55)*1.2)),score,reasons,features:{sharp,exposure,contrast}}},
  renderAI(ai){const host=window.SF.$('aiResult');if(!host)return;host.innerHTML=`<div class="ai-recommendation"><span>Suggested: <b>${ai.rating.toUpperCase()}</b></span><span class="ai-score">${ai.confidence}%</span></div><div class="ai-reasons">${ai.reasons.map(r=>'• '+window.SF.esc(r)).join('<br>')}</div><div class="muted" style="margin-top:6px">Local technical first-pass score: ${ai.score}/100. Final creative choice remains yours.</div>`},
  // EXIF orientation -> clockwise degrees to rotate the preview so portrait shots display upright.
  // The extracted RAW preview is re-encoded and loses its orientation tag, so we apply it ourselves.
  cullRotationDeg(o){o=String(o||'').toLowerCase();if(o==='6'||/rotate 90 cw|90 cw/.test(o))return 90;if(o==='8'||/rotate 270 cw|rotate 90 ccw|270 cw|90 ccw/.test(o))return 270;if(o==='3'||/rotate 180|(^|[^0-9])180([^0-9]|$)/.test(o))return 180;return 0;},
  applyRotation(img,deg){return new Promise(resolve=>{try{if(!deg||!img.naturalWidth)return resolve();const w=img.naturalWidth,h=img.naturalHeight,c=document.createElement('canvas');if(deg===90||deg===270){c.width=h;c.height=w}else{c.width=w;c.height=h}const ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(deg*Math.PI/180);ctx.drawImage(img,-w/2,-h/2);const url=c.toDataURL('image/jpeg',0.9);img.onload=()=>resolve();img.onerror=()=>resolve();img.src=url}catch{resolve()}})},
  analyzeSource(src){return new Promise(resolve=>{const img=new Image();img.onload=()=>{try{resolve(this.analyzeImage(img))}catch{resolve(null)}};img.onerror=()=>resolve(null);img.src=src})},
  /* g144 — RATING SPLIT FROM ADVANCING. The compare screen has to be able to rate any of the
     frames on it, not just the one the viewer happens to be showing, so everything that HAPPENS to
     a rating now lives in applyRating() and rate() is only "rate what I am looking at, then move
     on". One behaviour, two callers — the alternative was a second copy of the learning code that
     would have drifted from this one within a build or two. */
  applyRating(f,rating){
    if(!f)return;
    if(f.ai&&f.ai.rating!==rating){this.learn(f.ai,rating);f.trainingApplied=true}
    f.rating=rating;
    /* g125: every rating is an example. Retraining is deferred — doing it on each click would run
       gradient descent over thousands of rows between keystrokes — so it batches every 25 new
       decisions, quietly, and the whole set is retrained on demand from the panel. */
    this.noteRating&&this.noteRating(f);
    this._sinceTrain=(this._sinceTrain||0)+1;
    if(this._sinceTrain>=25){this._sinceTrain=0;this.retrain&&this.retrain(true);}
    this.updateCounts();this.renderFilmstrip();
  },
  rate(rating){const f=this.current();if(!f)return;this.applyRating(f,rating);
    document.querySelectorAll('.cull-rating').forEach(b=>b.classList.toggle('active',b.dataset.rate===rating));
    setTimeout(()=>this.move(1),120)},
  learn(ai,choice){this.profile.corrections=(this.profile.corrections||0)+1;const delta=choice==='yes'?0.006:choice==='no'?-0.006:0;this.profile.weights.sharpness=Math.max(.25,Math.min(.65,this.profile.weights.sharpness+delta));this.profile.weights.exposure=Math.max(.12,Math.min(.4,this.profile.weights.exposure-delta/2));this.saveProfile();const el=window.SF.$('aiCorrections');if(el)el.textContent=this.profile.corrections},
  move(delta){if(!this.session?.files.length)return;this.index=Math.max(0,Math.min(this.session.files.length-1,this.index+delta));this.refresh()},
  updateCounts(){if(!this.session)return;const c={yes:0,maybe:0,no:0,unrated:0};this.session.files.forEach(f=>c[f.rating||'unrated']++);for(const k of Object.keys(c)){const el=window.SF.$('count'+k[0].toUpperCase()+k.slice(1));if(el)el.textContent=c[k]}},
  scrollFilmstrip(direction){const host=window.SF.$('cullFilmstrip');if(!host)return;host.scrollBy({left:direction*Math.max(240,host.clientWidth*.75),behavior:'smooth'})},
  renderFilmstrip(){const host=window.SF.$('cullFilmstrip');if(!host||!this.session)return;host.innerHTML=this.session.files.map((f,i)=>{const suggestion=f.ai?.rating||'',cached=this.thumbCache.get(f.path),thumb=cached?.thumbnailData||'',state=f.previewState||'pending';const body=thumb?`<img src="${thumb}" alt="${window.SF.esc(f.name)}">`:`<span class="cull-thumb-state">${state==='loading'?'…':state==='failed'?'!':f.extension}</span>`;return `<button class="cull-thumb ${i===this.index?'active':''}${this.comparePaths.has(f.path)?' compared':''} ai-${suggestion} preview-${state}" data-index="${i}" data-path="${window.SF.esc(f.path)}" data-rating="${f.rating||''}" data-ai="${suggestion}" title="${window.SF.esc(f.name)} · ${state==='failed'?'Preview unavailable':state==='loading'?'Loading preview':`AI ${suggestion||'pending'}`}">${body}${suggestion?`<i>${suggestion.toUpperCase()}</i>`:''}</button>`}).join('');host.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const next=+b.dataset.index;if(!Number.isFinite(next))return;this.index=next;this.renderFilmstrip();await this.refresh()});host.querySelector('.active')?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})},
  async aiFirstPass(){if(!this.session)return alert('Open a shoot folder first.');if(!confirm('Run a technical AI first pass? This scores every frame from its preview -- suggestions only, nothing is moved or deleted.'))return;const files=this.session.files,total=files.length;const prog=window.SF.$('cullProgress'),pos=window.SF.$('cullPosition');let done=0;for(const f of files){if(!f.ai){const r=await this.requestPreview(f);const src=r&&r.ok?(r.thumbnailData||r.data||this.previewUrl(r,f.path)):'';let ai=src?await this.analyzeSource(src):null;if(!ai)ai={rating:'maybe',confidence:35,score:50,reasons:['Preview unavailable, manual review recommended']};if(f.hdrGroup){ai.rating='maybe';ai.confidence=Math.max(ai.confidence,82);ai.reasons.unshift('Possible HDR bracket sequence · keep the exposure set together')}f.ai=ai}done++;if(done%4===0||done===total){this.updateCounts();this.renderFilmstrip();if(prog)prog.style.width=Math.round(done/total*100)+'%';if(pos)pos.textContent=`${done} / ${total}`;await new Promise(r=>setTimeout(r,0))}}this.index=0;await this.refresh();this.updateCounts();alert('AI first pass complete. Review every recommendation before organizing files.')},
  async finish(openLightroom=false){if(!this.session)return alert('Open a shoot first.');const unrated=this.session.files.filter(f=>!f.rating).length;if(unrated&&!confirm(`${unrated} files are still unrated and will remain in the main folder. Continue?`))return;const ratings=Object.fromEntries(this.session.files.filter(f=>f.rating).map(f=>[f.path,f.rating]));const yes=Object.values(ratings).filter(v=>v==='yes').length,maybe=Object.values(ratings).filter(v=>v==='maybe').length,no=Object.values(ratings).filter(v=>v==='no').length;if(!confirm(`Finish this cull?\n\nMove ${yes} YES files\nMove ${maybe} MAYBE files\nSend ${no} NO files to the Windows Recycle Bin\n\nOriginals will not be copied.`))return;const result=await window.SF.api.organizeCull?.({folder:this.session.folder,ratings,mode:'move',deleteNo:true});if(!result?.ok&&result?.error)return alert(result.error);const changed=new Set(Object.entries(ratings).filter(([,r])=>['yes','maybe','no'].includes(r)).map(([path])=>path));this.session.files=this.session.files.filter(x=>!changed.has(x.path));this.index=Math.min(this.index,Math.max(0,this.session.files.length-1));alert(`Finished.\nYes moved: ${result.yes}\nMaybe moved: ${result.maybe}\nNo sent to Recycle Bin: ${result.no}\nFiles left in main folder: ${this.session.files.length}\nErrors: ${(result.errors||[]).length}`);if(result.errors?.length)console.warn('Cull organize errors',result.errors);if(result.yesFolder){if(openLightroom||confirm('Open Lightroom Classic and the YES folder now?')){const lr=await window.SF.api.openCullInLightroom?.(result.yesFolder);if(!lr?.ok)alert(lr?.error||'Lightroom Classic could not be opened.');}else if(confirm('Open the YES folder in Windows Explorer?'))window.SF.api.openCullFolder(result.yesFolder)}if(this.session.files.length)await this.refresh();else this.render()},

  setZoom(value){this.zoomMode=value==='fit'?'fit':'percent';if(value!=='fit')this.zoomPct=Math.max(25,Math.min(400,Number(value)||100));const slider=window.SF.$('cullZoom'),label=window.SF.$('cullZoomValue');if(slider)slider.value=this.zoomPct;if(label)label.textContent=this.zoomMode==='fit'?'Fit':`${this.zoomPct}%`;this.applyZoom()},
  /* g119 — WHY ZOOM DID NOTHING.
     styles.css ends with `#cullMainImage{max-width:100%!important;max-height:100%!important;
     object-fit:contain!important}`. A CSS !important BEATS A PLAIN INLINE STYLE, so setting
     img.style.maxWidth='none' here was discarded and the picture stayed pinned to the stage
     however wide the zoom made it. Same fault that hid the room designer's cast shadow for six
     builds. setProperty(..., 'important') is the only thing that outranks it.
     object-fit:contain must go too: it re-fits the image inside its own box, which would undo the
     zoom even once the size took effect. */
  applyZoom(){
    const img=window.SF.$('cullMainImage'), stage=window.SF.$('cullStage');
    if(!img||!stage) return;
    const set=(prop,val)=>img.style.setProperty(prop,val,'important');
    stage.style.setProperty('overflow','auto','important');

    /* g144 — HE COULD ONLY EVER SCROLL DOWNWARDS. "when I zoom in I cannot pull the image down to
       see faces only up." The stage centres its image with align-items/justify-content:center, and
       a centred flex item that OVERFLOWS its container puts the overflow at the start edge out of
       reach: scrollTop 0 is already the centred position, so the top of the picture — where the
       faces are — could not be scrolled to at all. Nothing to do with the drag handler, which was
       working perfectly on a scroll range that stopped short.
       `safe` alignment centres only while the content fits and falls back to start alignment the
       moment it does not, which restores the whole scroll range. Set here as well as in the
       stylesheet so it cannot be lost to a later rule. */
    stage.style.setProperty('align-items','safe center','important');
    stage.style.setProperty('justify-content','safe center','important');

    /* Remember where he was looking, in fractions of the whole picture, and put him back there
       after the resize — otherwise every zoom step throws him back to the middle. */
    const cw=stage.clientWidth, ch=stage.clientHeight;
    const fx=(stage.scrollLeft+cw/2)/Math.max(1,stage.scrollWidth);
    const fy=(stage.scrollTop+ch/2)/Math.max(1,stage.scrollHeight);

    if(this.zoomMode==='fit'){
      set('max-width','100%'); set('max-height','100%');
      set('width','auto'); set('height','auto');
      set('object-fit','contain');
      stage.style.setProperty('padding','0','important');
      stage.scrollLeft=0; stage.scrollTop=0;
    }else{
      set('max-width','none'); set('max-height','none');
      set('object-fit','fill');
      set('width',`${Math.max(1,Math.round(img.naturalWidth*this.zoomPct/100))}px`);
      set('height','auto');
      /* MORE RANGE FOR THE GRAB, as he asked. Padding round the zoomed picture means a face in the
         top corner can be dragged into the MIDDLE of the stage instead of stopping at the edge —
         at 45% of the stage on each side, any point in the picture can be brought to the centre. */
      stage.style.setProperty('padding',`${Math.round(ch*0.45)}px ${Math.round(cw*0.45)}px`,'important');
    }
    img.style.setProperty('transform','none','important');
    img.style.cursor=this.zoomMode==='fit'?'zoom-in':'grab';

    if(this.zoomMode!=='fit'){
      stage.scrollLeft=Math.max(0,fx*stage.scrollWidth-cw/2);
      stage.scrollTop=Math.max(0,fy*stage.scrollHeight-ch/2);
    }
  },
  bindViewerPanZoom(){const stage=window.SF.$('cullStage');if(!stage)return;stage.onwheel=e=>{if(!window.SF.$('cullMainImage'))return;e.preventDefault();const delta=e.deltaY<0?25:-25;this.setZoom(Math.max(25,Math.min(400,(this.zoomMode==='fit'?100:this.zoomPct)+delta))) }},
  bindImagePan(){const stage=window.SF.$('cullStage'),img=window.SF.$('cullMainImage');if(!stage||!img)return;let active=false,x=0,y=0,left=0,top=0;img.onpointerdown=e=>{if(this.zoomMode==='fit')return;active=true;x=e.clientX;y=e.clientY;left=stage.scrollLeft;top=stage.scrollTop;img.setPointerCapture?.(e.pointerId);img.style.cursor='grabbing';e.preventDefault()};img.onpointermove=e=>{if(!active)return;stage.scrollLeft=left-(e.clientX-x);stage.scrollTop=top-(e.clientY-y);e.preventDefault()};const stop=e=>{active=false;try{img.releasePointerCapture?.(e.pointerId)}catch{}img.style.cursor=this.zoomMode==='fit'?'zoom-in':'grab'};img.onpointerup=stop;img.onpointercancel=stop;img.onlostpointercapture=()=>{active=false;img.style.cursor=this.zoomMode==='fit'?'zoom-in':'grab'}},
  toggleCompare(){const f=this.current();if(!f)return;if(this.comparePaths.has(f.path))this.comparePaths.delete(f.path);else this.comparePaths.add(f.path);this.updateCompareButtons()},
  updateCompareButtons(){
    /* g121: the full-view deck carries its own pair of compare buttons, so label BOTH from here.
       They click the originals rather than re-implementing toggleCompare/showCompare, so there is
       one behaviour and it cannot drift. */
    const f=this.current();
    const label=this.comparePaths.has(f?.path)?'\u2713 Added':'\uff0b Compare';
    const count=`View Compare (${this.comparePaths.size})`;
    ['cullAddCompare','cullFocusAddCompare'].forEach(id=>{
      const b=window.SF.$(id); if(b&&f)b.textContent=label;
    });
    ['cullShowCompare','cullFocusShowCompare'].forEach(id=>{
      const v=window.SF.$(id); if(v)v.textContent=count;
    });
    /* g122: mark the thumbnails that are already in the comparison, so the filmstrip is how he
       picks them rather than something he has to remember. Toggled in place — re-rendering the
       whole strip on every add would throw away its scroll position mid-selection. */
    document.querySelectorAll('.cull-thumb[data-path]').forEach(t=>{
      t.classList.toggle('compared',this.comparePaths.has(t.dataset.path));
    });
  },
  async rotatedPreview(f){let r=this.thumbCache.get(f.path);if(!r){try{r=await window.SF.api.getCullThumbnail?.(f.path)}catch{r=null}if(r)this.thumbCache.set(f.path,r)}if(!r?.ok)return null;const src=r.data||r.thumbnailData||this.previewUrl(r,f.path+'-cmp');let deg=f.rotationDeg;if(deg===undefined){let ex={};try{ex=await window.SF.api.getCullMetadata?.(f.path)||{}}catch{}deg=this.cullRotationDeg(ex.orientation);f.rotationDeg=deg}if(!deg)return src;return await new Promise(res=>{const img=new Image();img.onload=()=>{try{const c=document.createElement('canvas'),w=img.naturalWidth,h=img.naturalHeight;if(deg===90||deg===270){c.width=h;c.height=w}else{c.width=w;c.height=h}const ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(deg*Math.PI/180);ctx.drawImage(img,-w/2,-h/2);res(c.toDataURL('image/jpeg',.9))}catch{res(src)}};img.onerror=()=>res(src);img.src=src})},
  /* g144 — COMPARE IS A FULL-SCREEN DECISION SCREEN, NOT A PREVIEW.
     Kirk: "the window and images has to be a lot bigger, use a pop up to take up the whole screen
     let me select the one i like the best and sort them yes maybe no."
     The old one was a boxed dialog that could only send him back to the viewer to rate — which
     meant the decision was made in one place and recorded in another, with the other candidates no
     longer on screen. Now the whole screen is the comparison, and the decision is made ON it:
     click the frame he wants, press Keep, and that one is marked YES and the rest NO in a single
     action. The three buttons under each frame are there for the times it is not that clean.
     Ratings go through applyRating(), so the learning, the counts and the filmstrip all update
     exactly as they do in the viewer. */
  async showCompare(){
    const sf=window.SF;
    if(this.comparePaths.size<2)return alert('Add at least two images first — press \uff0b Compare on each one you want to compare.');
    const files=[...this.comparePaths].map(p=>this.session.files.find(f=>f.path===p)).filter(Boolean).slice(0,6);
    const root=sf.$('modalRoot');
    /* Two across up to four frames, three across for five or six — anything narrower and the
       frames stop being big enough to judge, which is the whole complaint. */
    const cols=files.length<=4?2:3;
    root.innerHTML=`<div class="modal-backdrop cull-compare-modal"><div class="cull-compare-window">
      <div class="cull-compare-head">
        <h3>Compare \u2014 click the one you like best</h3>
        <div class="cull-compare-actions">
          <button class="button primary" id="cullCompareKeep" disabled>Keep the one I picked</button>
          <button class="button" id="cullCompareClose">Done \u2715</button>
        </div>
      </div>
      <div class="cull-compare-grid" id="cullCompareGrid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))"><div class="cull-loading">Preparing comparison\u2026</div></div>
      <p class="muted cull-compare-hint">Scroll on a photo to zoom in, drag to move it around. Keep marks your pick YES and the others NO \u2014 or rate them one at a time underneath.</p>
    </div></div>`;

    const close=()=>{sf.closeModal();this.updateCounts();this.renderFilmstrip();this.updateCompareButtons()};
    sf.$('cullCompareClose').onclick=close;
    const bd=root.querySelector('.cull-compare-modal');
    if(bd)bd.onclick=e=>{if(e.target===bd)close()};

    const cards=[];
    for(let i=0;i<files.length;i++){
      const f=files[i], url=await this.rotatedPreview(f);
      const body=url?`<img src="${url}" alt="${sf.esc(f.name)}" draggable="false">`
                    :`<div class="cull-compare-missing">Preview unavailable</div>`;
      cards.push(`<figure class="cull-compare-card" data-cmp="${i}">
        <div class="cull-compare-imgwrap">${body}<span class="cull-compare-pick">\u2713 Picked</span></div>
        <figcaption>
          <span class="cull-compare-name" title="${sf.esc(f.name)}">${sf.esc(f.name)}</span>
          <span class="cull-compare-rate rate-${f.rating||'none'}" id="cmpRate${i}">${f.rating?f.rating.toUpperCase():'\u2014'}</span>
          <span class="cull-compare-btns">
            <button class="button small" data-cmp-rate="yes" data-i="${i}">Yes</button>
            <button class="button small" data-cmp-rate="maybe" data-i="${i}">Maybe</button>
            <button class="button small" data-cmp-rate="no" data-i="${i}">No</button>
            <button class="button small secondary" data-cmp-open="${i}">Open</button>
          </span>
        </figcaption></figure>`);
    }

    const grid=sf.$('cullCompareGrid');
    if(!grid)return;
    grid.innerHTML=cards.join('');
    const keep=sf.$('cullCompareKeep');
    let picked=-1;

    const showRating=(i)=>{
      const lab=sf.$('cmpRate'+i), f=files[i];
      if(!lab)return;
      lab.textContent=f.rating?f.rating.toUpperCase():'\u2014';
      lab.className='cull-compare-rate rate-'+(f.rating||'none');
    };

    grid.querySelectorAll('[data-cmp]').forEach(el=>{
      const i=+el.dataset.cmp, wrap=el.querySelector('.cull-compare-imgwrap');
      this.bindCompareZoom(el);
      if(wrap)wrap.addEventListener('click',()=>{
        if(wrap._dragged){wrap._dragged=false;return}   // a pan that ended over the photo is not a choice
        picked=i;
        grid.querySelectorAll('[data-cmp]').forEach(x=>x.classList.toggle('picked',+x.dataset.cmp===i));
        if(keep)keep.disabled=false;
      });
    });
    grid.querySelectorAll('[data-cmp-rate]').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const i=+b.dataset.i;
      this.applyRating(files[i],b.dataset.cmpRate);
      showRating(i);
    });
    grid.querySelectorAll('[data-cmp-open]').forEach(b=>b.onclick=async e=>{
      e.stopPropagation();
      const idx=this.session.files.indexOf(files[+b.dataset.cmpOpen]);
      close();
      if(idx>=0){this.index=idx;await this.refresh()}
    });
    if(keep)keep.onclick=()=>{
      if(picked<0)return;
      this.keepOnly(files,picked);
      close();
    };
  },

  /* The whole point of the screen in one line: the frame he chose becomes a YES and every other
     frame he was weighing up becomes a NO. Kept as its own method rather than living inside a
     click handler so it can be tested without a browser — and so the rule is stated once. */
  keepOnly(files,index){
    (files||[]).forEach((f,i)=>this.applyRating(f,i===index?'yes':'no'));
  },

  /* Wheel to zoom, drag to move. The drag is deliberately allowed to run to half the zoomed frame
     in each direction, so a face in a corner can be pulled right into the middle rather than
     stopping at the edge — the same complaint he raised about the main viewer. */
  bindCompareZoom(card){
    const wrap=card.querySelector('.cull-compare-imgwrap'), im=card.querySelector('img');
    if(!wrap||!im)return;
    let z=1,ox=0,oy=0,drag=false,sx=0,sy=0,bx=0,by=0;
    const apply=()=>{
      const r=wrap.getBoundingClientRect();
      const lx=r.width*z/2, ly=r.height*z/2;
      ox=Math.max(-lx,Math.min(lx,ox)); oy=Math.max(-ly,Math.min(ly,oy));
      im.style.transform=`translate(${ox}px,${oy}px) scale(${z})`;
      wrap.style.cursor=z>1?(drag?'grabbing':'grab'):'zoom-in';
    };
    im.style.transformOrigin='center center';
    wrap.onwheel=e=>{
      e.preventDefault();
      const was=z;
      z=Math.max(1,Math.min(8,z+(e.deltaY<0?.5:-.5)));
      if(z===1){ox=0;oy=0}else{ox*=z/was;oy*=z/was}
      apply();
    };
    wrap.onpointerdown=e=>{
      if(z<=1)return;
      drag=true;wrap._dragged=false;sx=e.clientX;sy=e.clientY;bx=ox;by=oy;
      wrap.setPointerCapture?.(e.pointerId);apply();e.preventDefault();
    };
    wrap.onpointermove=e=>{
      if(!drag)return;
      ox=bx+(e.clientX-sx);oy=by+(e.clientY-sy);
      if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>4)wrap._dragged=true;
      apply();
    };
    const stop=e=>{drag=false;try{wrap.releasePointerCapture?.(e.pointerId)}catch{}apply()};
    wrap.onpointerup=stop;wrap.onpointercancel=stop;
    apply();
  },
  detectBracketGroups(){if(!this.session)return;const fs=this.session.files;let group=0;for(let i=0;i<fs.length-2;i++){const trio=fs.slice(i,i+3),times=trio.map(x=>+new Date(x.modified));const close=Math.max(...times)-Math.min(...times)<=5000;if(close){group++;trio.forEach(x=>x.hdrGroup=x.hdrGroup||`HDR-${group}`);i+=2}}},
  trainFromDecisions(){if(!this.session)return alert('Open and rate a shoot first.');let n=0;this.session.files.forEach(f=>{if(f.rating&&f.ai&&f.rating!==f.ai.rating&&!f.trainingApplied){this.learn(f.ai,f.rating);f.trainingApplied=true;n++}});alert(n?`Training updated from ${n} corrected decisions.`:'No new AI corrections were found. Change an AI suggestion, then train again.')},
  resetAI(){if(!confirm('Reset the locally learned AI Cull profile?'))return;localStorage.removeItem('sf-cull-profile');this.profile={version:1,weights:{sharpness:.45,exposure:.25,contrast:.15,uniqueness:.15},corrections:0};this.render()},
  fileSize(n){if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB'}
};

/* StudioFlow g123 — LEARNING KIRK'S EYE FROM HIS OWN EDITS.
   =========================================================
   The old "AI Cull profile" was a weighted sum of sharpness, exposure and contrast, nudged by
   0.006 per correction. It could only ever learn how much he cares about sharpness versus
   exposure, and its exposure term rewarded frames averaging mid-grey — actively marking down the
   deliberate underexposure he uses to protect highlights.

   This trains a real model, locally, at no cost, on the strongest label available: WHICH FRAMES HE
   ACTUALLY EDITED AND DELIVERED. Not a rating he clicked, but time he chose to spend.

   Honest about the ceiling: this still cannot see WHAT is in the picture. It learns his technical
   signature — exposure, sharpness, contrast, ISO, shutter, focal length — not his eye for a
   moment. That distinction is stated in the UI too, so the numbers are never oversold.

   Logistic regression, batch gradient descent, features standardised so no one of them dominates
   by unit alone. A few hundred frames trains in well under a second. */
Object.assign(window.SFPhotoCull, {
  /* g123: once a model exists it decides the suggestion; the old thresholds remain the fallback
     until he has trained it, so nothing changes for a fresh install. */
  rateFromScore(score){
    return score>=68?'yes':score>=43?'maybe':'no';
  },
  suggestionFor(f,score){
    const p=this.probability&&this.probability(f);
    if(p==null) return this.rateFromScore(score);
    return p>=0.62?'yes':p>=0.32?'maybe':'no';
  },
  FEATURES: [
    { key: 'sharp',    label: 'sharpness' },
    { key: 'exposure', label: 'brightness' },
    { key: 'contrast', label: 'contrast' },
    { key: 'iso',      label: 'ISO' },
    { key: 'shutter',  label: 'shutter speed' },
    { key: 'focal',    label: 'focal length' }
  ],

  /* State lives in the DATABASE, not localStorage: the old profile sat outside the backups, so a
     cleared app folder silently threw away the training. Migrated on first read. */
  learned(){
    const sf=window.SF;
    if(!sf.state.cullModel||typeof sf.state.cullModel!=='object')sf.state.cullModel={};
    return sf.state.cullModel;
  },

  featureVector(f){
    const ai=f.ai||{}, ft=ai.features||{}, ex=f.exif||{};
    const num=v=>{const n=Number(String(v??'').replace(/[^0-9.]/g,''));return isFinite(n)?n:0;};
    /* Shutter arrives as "1/2000" or a decimal; store stops so 1/2000 and 1/250 are comparable. */
    let shutter=0;
    const raw=String(ex.exposureTime||ex.ExposureTime||'');
    if(/\//.test(raw)){const [a,b]=raw.split('/').map(Number); if(b)shutter=Math.log2(b/(a||1));}
    else if(num(raw)>0) shutter=-Math.log2(num(raw));
    return {
      sharp:Number(ft.sharp)||0,
      exposure:Number(ft.exposure)||0,
      contrast:Number(ft.contrast)||0,
      iso:Math.log2(Math.max(50,num(ex.iso||ex.ISO)||100)),
      shutter,
      focal:num(ex.focalLength||ex.FocalLength)
    };
  },

  async learnFromEdits(){
    const sf=window.SF, session=this.session;
    if(!session||!session.files||!session.files.length){
      alert('Open a shoot first — the learning comes from the frames in it.');
      return;
    }
    /* g142 — IT COULD NOT FIND HIS EDITS, and the message told him nothing useful.
       Two faults in the finder (it only looked in the shoot root, and it matched exactly one
       spelling of the folder name) are fixed in main.js. What is fixed HERE is the dead end: when
       it still finds nothing it now LISTS THE FOLDERS IT DID SEE and offers to let him point at
       the right one — and the name he picks is remembered, so every later shoot matches it without
       being asked again. Guessing at folder names in my head is what produced this bug. */
    let res=await sf.api.cullFindEdits?.({folder:session.folder,names:this.editFolderNames()});
    if(!res||!res.ok){
      alert((res&&res.error)||'The edited folder could not be read.');
      return;
    }
    if(!res.folderFound){
      const saw=(res.sawFolders||[]);
      const list=saw.length?`\n\nFolders it looked in:\n  ${saw.slice(0,20).join('\n  ')}`:'\n\nIt found no subfolders at all in this shoot.';
      if(!confirm('It could not find your edited photos in this shoot or one folder inside it.'+list+
        '\n\nPoint at the folder yourself? The name will be remembered for next time.')) return;
      const picked=await sf.api.cullChooseEditFolder?.();
      if(!picked||!picked.folder) return;
      this.rememberEditFolder(picked.name);
      res=await sf.api.cullFindEdits?.({folder:session.folder,editFolder:picked.folder,names:this.editFolderNames()});
      if(!res||!res.ok||!res.folderFound){
        alert('Nothing readable in that folder \u2014 it needs the edited JPEGs themselves, not a folder of folders.');
        return;
      }
      await sf.persist();
    }
    if(!res.edits.length){
      alert(`Found "${res.folderName}", but there are no edited photos in it yet.`);
      return;
    }
    const edited=new Set(res.edits);
    const baseOf=p=>String(p||'').split(/[\\/]/).pop().replace(/\.[^.]+$/,'').trim().toLowerCase();

    /* g124 — LABELS COME FROM HIS RATINGS FIRST, THE EDIT FOLDER SECOND.
       Kirk's workflow separates the NOs out (the organiser trashes them and moves YES/MAYBE into
       subfolders), so by the time an edit exists the rejects are gone from disk and "edited vs not"
       compares keepers against keepers — a weak and misleading contrast. His own YES/NO ratings in
       the session are a stronger label and are present BEFORE anything is moved.

       So: a rating decides the label when he has given one. MAYBE is genuinely ambiguous and is
       left out entirely rather than forced to one side — except when he went back and edited it,
       which is him settling the question himself, and counts as a yes. Frames with no rating fall
       back to whether an edit exists. */
    const rows=[];
    let fromRating=0, fromEdit=0, skippedMaybe=0;
    for(const f of session.files){
      const v=this.featureVector(f);
      if(!v.sharp&&!v.exposure) continue;              // never analysed; nothing to learn from
      const isEdited=edited.has(baseOf(f.path));
      let y=null;
      if(f.rating==='yes'){ y=1; fromRating++; }
      else if(f.rating==='no'){ y=0; fromRating++; }
      else if(f.rating==='maybe'){
        if(isEdited){ y=1; fromRating++; }             // he edited it: that IS the decision
        else { skippedMaybe++; continue; }
      }
      else { y=isEdited?1:0; fromEdit++; }
      rows.push({x:v,y});
    }
    const kept=rows.filter(r=>r.y).length;
    if(rows.length<12||kept<3||kept===rows.length){
      alert(`Not enough to learn from yet: ${rows.length} usable frames, ${kept} of them keepers.\n\n`+
            `It needs a spread — at least a dozen frames with several kept and several not.\n\n`+
            (kept===rows.length
              ? `Every frame here is a keeper, so there is nothing to contrast against. Train BEFORE you `+
                `organise a shoot, while the rejects are still on disk — once the NOs are trashed the `+
                `comparison is gone.`
              : `Rate more of this shoot, or open one you culled fully.`));
      return;
    }

    const keys=this.FEATURES.map(f=>f.key);
    const mean={}, sd={};
    keys.forEach(k=>{
      const vals=rows.map(r=>r.x[k]);
      mean[k]=vals.reduce((a,b)=>a+b,0)/vals.length;
      const varr=vals.reduce((a,b)=>a+(b-mean[k])**2,0)/vals.length;
      sd[k]=Math.sqrt(varr)||1;                        // a constant feature must not divide by zero
    });
    const X=rows.map(r=>keys.map(k=>(r.x[k]-mean[k])/sd[k]));
    const y=rows.map(r=>r.y);

    let w=keys.map(()=>0), b=0;
    const lr=0.12, iters=600, lambda=0.01;             // light L2 so a small shoot cannot overfit hard
    for(let it=0;it<iters;it++){
      const gw=keys.map(()=>0); let gb=0;
      for(let i=0;i<X.length;i++){
        const z=X[i].reduce((s,v,j)=>s+v*w[j],b);
        const p=1/(1+Math.exp(-z)), e=p-y[i];
        for(let j=0;j<w.length;j++)gw[j]+=e*X[i][j];
        gb+=e;
      }
      for(let j=0;j<w.length;j++)w[j]-=lr*(gw[j]/X.length+lambda*w[j]);
      b-=lr*(gb/X.length);
    }

    /* How well does it actually do? Reported honestly, including when the answer is "not well". */
    let right=0;
    X.forEach((row,i)=>{
      const z=row.reduce((s,v,j)=>s+v*w[j],b);
      if(((1/(1+Math.exp(-z)))>=0.5?1:0)===y[i])right++;
    });

    /* g125: keep the examples rather than only the model, so this shoot ADDS to what it knows
       instead of replacing it. The weights below are recomputed from the whole store by retrain(). */
    rows.forEach((r,i)=>{
      const f=(session.files||[])[i];
      this.recordSample((f&&f.path)||('row-'+i), r.x, r.y, 'edit');
    });
    /* retrain() computes the weights from the WHOLE store and writes them. Assigning this shoot's
       own weights afterwards would throw that away and make the last shoot the only teacher —
       which is exactly the behaviour g125 exists to remove. Only the per-shoot counters are added. */
    const trained=await this.retrain(true);
    const model=this.learned();
    model.skippedMaybe=skippedMaybe;
    model.shoots=(model.shoots||0)+1;
    await sf.persist();
    if(!trained){ this.render&&this.render(); return; }
    this.explainLearning();
    this.render&&this.render();
  },

  probability(f){
    const m=this.learned();
    if(!m.w||!m.keys) return null;
    const v=this.featureVector(f);
    const z=m.keys.reduce((s,k,j)=>s+((v[k]-m.mean[k])/(m.sd[k]||1))*m.w[j],m.b);
    return 1/(1+Math.exp(-z));
  },

  /* Says what it learned in words, because a set of weights tells him nothing. */
  explainLearning(){
    const sf=window.SF, m=this.learned();
    if(!m.w) return;
    const ranked=m.keys.map((k,j)=>({
      k, w:m.w[j],
      label:(this.FEATURES.find(f=>f.key===k)||{}).label||k
    })).sort((a,b)=>Math.abs(b.w)-Math.abs(a.w));
    const dir=x=>x.w>0?'higher':'lower';
    const expDiff=(m.keptExposure-m.allExposure);
    const lines=ranked.slice(0,4).map(r=>
      `<li><b>${sf.esc(r.label)}</b> — you keep frames with ${dir(r)} ${sf.esc(r.label)}` +
      ` <span class="muted">(influence ${Math.abs(r.w).toFixed(2)})</span></li>`);
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal">
      <h3>What it learned from your edits</h3>
      <p class="muted">From <b>${m.trainedOn}</b> frames, <b>${m.kept}</b> of them keepers. It agrees with your own decisions on <b>${Math.round(m.accuracy*100)}%</b> of them.</p>
      <p class="muted">${m.fromRating?`<b>${m.fromRating}</b> came from your own yes/no ratings`:''}${m.fromRating&&m.fromEdit?', and ':''}${m.fromEdit?`<b>${m.fromEdit}</b> from whether an edit exists in your lightroom alterations folder`:''}.${m.skippedMaybe?` <b>${m.skippedMaybe}</b> maybes were left out \u2014 they are genuinely undecided, so forcing them either way would teach it something you did not mean.`:''}</p>
      <ul>${lines.join('')}</ul>
      ${Math.abs(expDiff)>3?`<p>Your keepers average <b>${expDiff<0?'darker':'brighter'}</b> than the shoot as a whole${expDiff<0?' \u2014 the underexposure you use to hold highlights. The old scoring marked that down; this does not.':'.'}</p>`:''}
      ${m.accuracy<0.65?`<p class="muted"><b>Treat this lightly for now.</b> Agreeing with you only ${Math.round(m.accuracy*100)}% of the time means the measurable qualities do not yet separate your keepers from the rest. More shoots will help; some of what you respond to may simply not be measurable this way.</p>`:''}
      <p class="muted">It reads brightness, sharpness, contrast, ISO, shutter and focal length. It cannot
      see <i>what</i> is in the photograph — it learns your technical signature, not your eye for a moment.</p>
      <div class="modal-footer"><button class="button primary" id="cullLearnClose">Close</button></div>
    </div></div>`;
    sf.$('cullLearnClose').onclick=()=>sf.closeModal();
  }
});

/* StudioFlow g125 — A TRAINING SET THAT ACCUMULATES.
   =================================================
   g123/g124 trained on one shoot and replaced the model each time, so the last shoot overwrote
   everything learned before it. Kirk wants the opposite: seed it from years of edited work in one
   go, then have it keep learning as he culls.

   So examples are KEPT — one row per frame, {features, label, source} — and the model is retrained
   from the whole set. Keyed by file path so re-training a shoot updates rather than duplicates,
   and so a rating he changes his mind about corrects the example instead of adding a contradictory
   second one.

   Capped, because this lives in a database that is already past 100MB. A sample is about 120 bytes
   of numbers — no pixels, no paths beyond the key — so 6000 of them is well under a megabyte, and
   the oldest give way first. */
Object.assign(window.SFPhotoCull, {
  SAMPLE_CAP: 6000,

  /* g142 — folder names he has taught it, kept in the DATABASE beside the model so they are inside
     the backups and survive a reinstall. The built-in list (alterations / edits / edited / exports
     / processed / finals, with or without "lightroom" in front and any separator) still applies on
     top of these. */
  editFolderNames(){
    const m=this.learned();
    if(!Array.isArray(m.editFolderNames))m.editFolderNames=[];
    return m.editFolderNames;
  },
  rememberEditFolder(name){
    const n=String(name||'').trim();
    if(!n)return;
    const list=this.editFolderNames();
    if(!list.some(x=>String(x).toLowerCase()===n.toLowerCase()))list.push(n);
  },

  samples(){
    const m=this.learned();
    if(!Array.isArray(m.samples))m.samples=[];
    return m.samples;
  },

  /* One place that records an example, whatever the source. */
  recordSample(path,vector,label,source){
    if(label!==0&&label!==1)return;
    const rows=this.samples();
    const key=String(path||'');
    if(!key)return;
    const at=rows.findIndex(r=>r.p===key);
    const row={p:key,x:vector,y:label,s:source||'cull',t:Date.now()};
    if(at>=0)rows[at]=row; else rows.push(row);
    if(rows.length>this.SAMPLE_CAP)rows.splice(0,rows.length-this.SAMPLE_CAP);
  },

  /* Learn as he culls: called whenever he rates a frame. Maybe is not a label — unless he later
     edits it, which g124 handles — so a maybe REMOVES any earlier example for that frame rather
     than leaving a stale yes/no behind from a previous decision. */
  noteRating(f){
    if(!f||!f.ai)return;
    const v=this.featureVector(f);
    if(!v.sharp&&!v.exposure)return;
    if(f.rating==='yes')this.recordSample(f.path,v,1,'rating');
    else if(f.rating==='no')this.recordSample(f.path,v,0,'rating');
    else{
      const rows=this.samples(), at=rows.findIndex(r=>r.p===f.path);
      if(at>=0&&rows[at].s==='rating')rows.splice(at,1);
    }
  },

  /* Retrain from EVERY example held, not just the current shoot. */
  async retrain(quiet){
    const sf=window.SF, rows=this.samples();
    const kept=rows.filter(r=>r.y===1).length;
    if(rows.length<12||kept<3||kept===rows.length){
      if(!quiet)alert(`Not enough to learn from yet: ${rows.length} frames held, ${kept} of them keepers.\n\n`+
        `It needs a spread — at least a dozen frames with several kept and several not.`);
      return false;
    }
    const keys=this.FEATURES.map(f=>f.key);
    const mean={},sd={};
    keys.forEach(k=>{
      const vals=rows.map(r=>Number(r.x[k])||0);
      mean[k]=vals.reduce((a,b)=>a+b,0)/vals.length;
      sd[k]=Math.sqrt(vals.reduce((a,b)=>a+(b-mean[k])**2,0)/vals.length)||1;
    });
    const X=rows.map(r=>keys.map(k=>((Number(r.x[k])||0)-mean[k])/sd[k]));
    const y=rows.map(r=>r.y);
    let w=keys.map(()=>0),b=0;
    const lr=0.12,iters=600,lambda=0.01;
    for(let it=0;it<iters;it++){
      const gw=keys.map(()=>0);let gb=0;
      for(let i=0;i<X.length;i++){
        const z=X[i].reduce((s,v,j)=>s+v*w[j],b);
        const e=1/(1+Math.exp(-z))-y[i];
        for(let j=0;j<w.length;j++)gw[j]+=e*X[i][j];
        gb+=e;
      }
      for(let j=0;j<w.length;j++)w[j]-=lr*(gw[j]/X.length+lambda*w[j]);
      b-=lr*(gb/X.length);
    }
    let right=0;
    X.forEach((row,i)=>{
      const z=row.reduce((s,v,j)=>s+v*w[j],b);
      if(((1/(1+Math.exp(-z)))>=0.5?1:0)===y[i])right++;
    });
    const keptRows=rows.filter(r=>r.y===1);
    Object.assign(this.learned(),{
      version:3,keys,w,b,mean,sd,
      trainedOn:rows.length,kept,accuracy:right/rows.length,
      fromRating:rows.filter(r=>r.s==='rating').length,
      fromEdit:rows.filter(r=>r.s==='edit').length,
      keptExposure:keptRows.reduce((a,r)=>a+(Number(r.x.exposure)||0),0)/(keptRows.length||1),
      allExposure:rows.reduce((a,r)=>a+(Number(r.x.exposure)||0),0)/rows.length,
      updatedAt:new Date().toISOString()
    });
    await sf.persist();
    return true;
  },

  /* Seed it from shoots already edited. Runs on paths alone, so it never disturbs the shoot he
     currently has open. */
  async trainFromArchive(){
    const sf=window.SF;
    const picked=await sf.api.cullChooseArchive?.();
    if(!picked||!picked.folder)return;
    const scan=await sf.api.cullScanArchive?.({folder:picked.folder,names:this.editFolderNames()});
    if(!scan||!scan.ok){alert((scan&&scan.error)||'That folder could not be read.');return;}
    if(!scan.shoots.length){
      alert('No shoots found there.\n\nIt looks for a folder of edited photos \u2014 named '+
            'alterations, edits, edited, exports, processed or finals, with or without '+
            '"lightroom" in front \u2014 either in the shoot itself or one folder inside it, '+
            'such as YES.\n\nIf yours is called something else, open one of those shoots in the '+
            'cull tool and use "Learn from my edits": it lets you point at the folder, and '+
            'remembers the name for every scan after that.');
      return;
    }
    /* g126: a shoot only teaches something if it has BOTH keepers and rejects. Kirk's older shoots
       are organised as "Fairy Lake / YES / lightroom alterations" — the YES folder is all keepers,
       and the rejects are the frames still sitting in the shoot root. Reading YES alone would add
       nothing but positives and teach it to say yes to everything, so a shoot whose rejects have
       been deleted is SKIPPED and reported rather than quietly biasing the model. */
    const usable=scan.shoots.filter(s=>s.positives.length&&s.negatives.length);
    const oneSided=scan.shoots.filter(s=>!s.negatives.length);
    if(!usable.length){
      alert(`Found ${scan.shoots.length} shoot(s), but none can teach it anything.\n\n`+
        `Every one has keepers with no rejects left beside them — the frames you turned down were `+
        `deleted, so there is nothing to contrast against. A shoot needs both.\n\n`+
        `Shoots where you kept the whole take on disk are the ones to point at.`);
      return;
    }
    const total=usable.reduce((n,s)=>n+s.positives.length+s.negatives.length,0);
    if(!confirm(`Found ${usable.length} usable shoot(s), ${total} frames.\n`+
      (oneSided.length?`\n${oneSided.length} other shoot(s) were skipped: keepers only, nothing to compare against.\n`:'')+
      `\nEach frame has to be read and measured, so this takes a while — roughly a minute per few `+
      `hundred. You can keep working; it will say when it is done.\n\nGo ahead?`))return;

    this._archiveCancel=false;
    let done=0,added=0;
    const measure=async(filePath,label)=>{
      try{
        const prev=await sf.api.getCullThumbnail?.(filePath);
        const src=prev&&prev.ok?(prev.thumbnailData||prev.data||''):'';
        if(!src)return;
        const ai=await this.analyzeSource(src);
        if(!ai||!ai.features)return;
        let exif={};
        try{ exif=await sf.api.getCullMetadata?.(filePath)||{}; }catch(_){}
        this.recordSample(filePath,this.featureVector({ai,exif}),label,'edit');
        added++;
      }catch(_){ /* one unreadable frame must not stop the run */ }
    };
    for(const shoot of usable){
      for(const [list,label] of [[shoot.positives,1],[shoot.negatives,0]]){
        for(const filePath of list){
          if(this._archiveCancel)break;
          done++;
          if(done%10===0)this.showPreloadMessage?.(`Learning from ${shoot.name}\u2026 ${done} of ${total}`);
          await measure(filePath,label);
        }
        if(this._archiveCancel)break;
      }
      if(this._archiveCancel)break;
    }
    this.hidePreload?.();
    await this.retrain(true);
    await sf.persist();
    alert(`${this._archiveCancel?'Stopped early. ':''}Learned from ${added} frames across `+
          `${usable.length} shoot(s).\n\nIt now holds ${this.samples().length} examples in total.`);
    this.explainLearning();
    this.render&&this.render();
  }
});
