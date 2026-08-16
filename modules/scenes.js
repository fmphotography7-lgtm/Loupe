
window.SFScenes = {
  render(){
    const sf=window.SF;
    sf.$('workspace').innerHTML=`
      <div class="card">
        <div id="sceneInstallStatus"></div>
        <div class="toolbar">
          <div><h2 style="margin:0">StudioFlow Scene Packs</h2><small style="color:var(--muted)">Install packs or create individual scene records.</small></div>
          <div class="row-actions">
            <button class="button secondary" id="installScenePackButton">Install Pack</button>
            <button class="button secondary" id="batchImportButton">Batch Import Rooms</button>
            <button class="button primary" id="createSceneWizardButton">Create New Scene</button><button class="button secondary" id="addSceneButton">Manual Scene</button>
          </div>
        </div>
        <div class="scene-room-folders">
          ${Object.entries(sf.state.scenes.reduce((groups,scene)=>{const room=(scene.room||'Uncategorized').trim()||'Uncategorized';(groups[room]||=[]).push(scene);return groups},{})).sort(([a],[b])=>a.localeCompare(b)).map(([room,scenes])=>`
            <details class="scene-room-folder" open><summary><span>📁 ${sf.esc(room)}</span><small>${scenes.length} room${scenes.length===1?'':'s'}</small></summary><div class="scene-grid">
              ${scenes.map(s=>`
                <div class="scene-card">
                  <div class="image-box">${s.image?`<img src="${s.image}">`:`${sf.esc(s.style)}<br>${sf.esc(s.room)}`}</div>
                  <div class="card-copy">
                    <b>${sf.esc(s.internalName||s.name)}</b>
                    <small>${sf.esc(s.style)} · ${sf.esc(s.room)}</small>
                    <div class="badge">${s.wallWidth}" wall</div>
                    ${s.calibrationLocked?'<div class="badge approved-badge">Production Approved</div>':s.calibrated?'<div class="badge calibrated-badge">Awaiting Approval</div>':'<div class="badge pending-badge">Needs Calibration</div>'}
                    ${(s.foregroundLayers||[]).length?`<div class="badge layer-badge">${s.foregroundLayers.length} foreground layer${s.foregroundLayers.length===1?'':'s'}</div>`:''}
                    <div class="row-actions">
                      <button class="button secondary attach-scene" data-id="${s.id}">${s.image?'Replace':'Attach'} Image</button>
                      ${s.calibrated&&!s.calibrationLocked?`<button class="button primary approve-scene" data-id="${s.id}">Approve & Lock</button>`:''}
                      ${s.calibrationLocked?`<button class="button secondary unlock-scene" data-id="${s.id}">Unlock</button>`:''}
                      <button class="button secondary calibrate-scene" data-id="${s.id}" ${s.calibrationLocked?'disabled':''}>Calibrate</button>
                      <button class="button secondary series-scene" data-id="${s.id}">Series…</button>
                      <button class="button secondary edit-scene" data-id="${s.id}">Edit</button>
                      <button class="button danger delete-scene" data-id="${s.id}">Delete</button>
                    </div>
                  </div>
                </div>`).join('')}
            </div></details>`).join('') || '<div class="empty">No scene records installed.</div>'}
        </div>
      </div>`;

    sf.$('installScenePackButton').addEventListener('click',()=>this.installPack());
    sf.$('batchImportButton').addEventListener('click',()=>window.SFAssetImporter.open());
    sf.$('createSceneWizardButton').addEventListener('click',()=>window.SFSceneWizard.open());
    sf.$('addSceneButton').addEventListener('click',()=>this.openEditor());
    document.querySelectorAll('.attach-scene').forEach(button=>
      button.addEventListener('click',()=>this.attachImage(button.dataset.id)));
    document.querySelectorAll('.approve-scene').forEach(button=>
      button.addEventListener('click',async()=>{
        const scene=sf.state.scenes.find(s=>s.id===button.dataset.id);
        if(!scene||!scene.calibrated)return;
        if(!confirm(`Approve and lock "${scene.internalName||scene.name}" as a production scene?`))return;
        window.SFAssetManager.markLibrary(scene.assetId||scene.id);
        sf.logActivity(`Approved production scene: ${scene.internalName||scene.name}`);
        await sf.persist();
        this.render();
      }));
    document.querySelectorAll('.unlock-scene').forEach(button=>
      button.addEventListener('click',async()=>{
        const scene=sf.state.scenes.find(s=>s.id===button.dataset.id);
        if(!scene||!confirm(`Unlock "${scene.internalName||scene.name}" for editing?`))return;
        scene.calibrationLocked=false;
        scene.productionStatus='Calibrated - Awaiting Approval';
        sf.logActivity(`Unlocked production scene: ${scene.internalName||scene.name}`);
        await sf.persist();
        this.render();
      }));
    document.querySelectorAll('.calibrate-scene').forEach(button=>
      button.addEventListener('click',()=>{
        const scene=sf.state.scenes.find(s=>s.id===button.dataset.id);
        if(scene){window.SFCalibration.loadScene(scene);sf.goTo('Scene Calibration')}
      }));
    document.querySelectorAll('.edit-scene').forEach(button=>
      button.addEventListener('click',()=>this.openEditor(button.dataset.id)));
    document.querySelectorAll('.delete-scene').forEach(button=>
      button.addEventListener('click',()=>this.delete(button.dataset.id)));
  },
  openEditor(id=''){
    const sf=window.SF;
    const scene=sf.state.scenes.find(s=>s.id===id)||{
      id:sf.makeId('SCN'),name:'',style:'Modern',room:'Living Room',
      wallWidth:144,safeWidth:72,safeHeight:48,safeCenterX:50,safeCenterY:38,
      lightDirection:'left',lightAngle:35,shadowSoftness:72,shadowStrength:36,image:''
    };

    sf.$('modalRoot').innerHTML=`
      <div class="modal-backdrop"><div class="modal">
        <div class="modal-head"><h2>${id?'Edit':'New'} Scene</h2><button class="close-button" id="closeSceneModal">×</button></div>
        <div class="grid2">
          <div>
            <label>Scene ID</label><input id="sceneId" value="${sf.esc(scene.id)}">
            <label>Name</label><input id="sceneName" value="${sf.esc(scene.name)}">
            <label>Style</label><input id="sceneStyle" value="${sf.esc(scene.style)}">
            <label>Room Type</label><input id="sceneRoom" value="${sf.esc(scene.room)}">
          </div>
          <div>
            <label>Wall Width</label><input id="sceneWall" type="number" value="${scene.wallWidth}">
            <label>Safe Width</label><input id="sceneSafeWidth" type="number" value="${scene.safeWidth}">
            <label>Safe Height</label><input id="sceneSafeHeight" type="number" value="${scene.safeHeight}">
            <label>Display Centre X (%)</label><input id="sceneSafeCenterX" type="number" min="0" max="100" value="${scene.safeCenterX??50}">
            <label>Display Centre Y (%)</label><input id="sceneSafeCenterY" type="number" min="0" max="100" value="${scene.safeCenterY??38}">
            <label>Main Light Source</label>
            <select id="sceneLightDirection">
              ${['left','right','top','front'].map(v=>`<option value="${v}" ${(scene.lightDirection||'left')===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}
            </select>
            <label>Light Angle (degrees)</label><input id="sceneLightAngle" type="number" min="0" max="90" value="${scene.lightAngle??35}">
            <label>Shadow Softness (%)</label><input id="sceneShadowSoftness" type="number" min="0" max="100" value="${scene.shadowSoftness??72}">
            <label>Shadow Strength (%)</label><input id="sceneShadowStrength" type="number" min="0" max="100" value="${scene.shadowStrength??36}">
          </div>
        </div>
        <div class="row-actions">
          <button class="button primary" id="saveSceneButton">Save Scene</button>
          <button class="button secondary" id="cancelSceneButton">Cancel</button>
        </div>
      </div></div>`;

    sf.$('closeSceneModal').addEventListener('click',()=>sf.closeModal());
    sf.$('cancelSceneButton').addEventListener('click',()=>sf.closeModal());
    sf.$('saveSceneButton').addEventListener('click',()=>this.save(id));
  },
  async save(originalId){
    const sf=window.SF;
    const name=sf.$('sceneName').value.trim();
    if(!name)return alert('Enter a scene name.');

    const previous=sf.state.scenes.find(s=>s.id===originalId);
    const proposedId=sf.$('sceneId').value.trim()||sf.makeId('SCN');
    if(proposedId!==originalId && sf.state.scenes.some(s=>(s.assetId||s.id)===proposedId))return alert('That Asset ID already exists. Choose a unique ID.');
    const record={
      ...(previous||{}),
      id:proposedId,assetId:proposedId,sourceImageId:previous?.sourceImageId||proposedId,recordType:'roomAsset',
      packId:previous?.packId||'',
      name,
      style:sf.$('sceneStyle').value.trim()||'Uncategorized',
      room:sf.$('sceneRoom').value.trim()||'Room',
      wallWidth:Number(sf.$('sceneWall').value||144),
      safeWidth:Number(sf.$('sceneSafeWidth').value||72),
      safeHeight:Number(sf.$('sceneSafeHeight').value||48),
      safeCenterX:Number(sf.$('sceneSafeCenterX').value||50),
      safeCenterY:Number(sf.$('sceneSafeCenterY').value||38),
      lightDirection:sf.$('sceneLightDirection').value||'left',
      lightAngle:Number(sf.$('sceneLightAngle').value||35),
      shadowSoftness:Number(sf.$('sceneShadowSoftness').value||72),
      shadowStrength:Number(sf.$('sceneShadowStrength').value||36),
      image:previous?.image||'',backgroundLayer:previous?.backgroundLayer||previous?.image||'',
      updatedAt:new Date().toISOString()
    };

    const index=sf.state.scenes.findIndex(s=>s.id===originalId);
    if(index>=0)sf.state.scenes[index]=record;else sf.state.scenes.push(record);

    sf.logActivity(`${index>=0?'Updated':'Added'} scene: ${record.name}`);
    await sf.persist();
    sf.closeModal();
    this.render();
  },
  async attachImage(id){
    const sf=window.SF;
    const file=await sf.api.openImage();
    if(!file)return;
    const scene=sf.state.scenes.find(s=>s.id===id);
    /* g112: store the PATH file:openImage already produced, not a second base64 copy in the DB. */
    const src=file.storedPath||file.data;
    scene.image=src;scene.backgroundLayer=src;scene.sourceFilename=file.name;
    if(scene.calibrated){scene.calibrated=false;scene.calibrationLocked=false;scene.inLibrary=false;scene.productionStatus='Modified - Needs Recalibration';scene.calibration=null;}
    sf.logActivity(`Attached image to scene: ${scene.name}`);
    await sf.persist();
    this.render();
  },
  async delete(id){
    const sf=window.SF,scene=window.SFAssetManager.find(id);
    if(!scene)return;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal">
      <div class="modal-head"><h2>Manage ${sf.esc(scene.internalName||scene.name)}</h2><button class="close-button" id="deleteClose">×</button></div>
      <p>Choose exactly what StudioFlow should remove. Operations are scoped to Asset ID <b>${sf.esc(scene.assetId||scene.id)}</b>.</p>
      <div class="stack-actions">
        <button class="button secondary" id="removeCalibration">Remove Calibration Only</button>
        <button class="button secondary" id="removeLibrary">Remove Library Copy Only</button>
        <button class="button danger" id="removeAsset">Delete Entire Room Asset</button>
      </div>
    </div></div>`;
    sf.$('deleteClose').onclick=()=>sf.closeModal();
    sf.$('removeCalibration').onclick=async()=>{window.SFAssetManager.removeCalibration(id);sf.logActivity(`Removed calibration: ${scene.name}`);await sf.persist();sf.closeModal();this.render()};
    sf.$('removeLibrary').onclick=async()=>{window.SFAssetManager.removeLibraryReference(id);sf.logActivity(`Removed library reference: ${scene.name}`);await sf.persist();sf.closeModal();this.render()};
    sf.$('removeAsset').onclick=async()=>{if(!confirm(`Permanently delete only ${scene.name} (${scene.assetId||scene.id})?`))return;window.SFAssetManager.removeAsset(id);sf.logActivity(`Deleted room asset: ${scene.name}`);await sf.persist();sf.closeModal();this.render()};
  },
  async installPack(){
    const sf=window.SF;
    try{
      const raw=await sf.api.openJson();
      if(!raw)return;
      const pack=JSON.parse(raw);
      const packId=pack.packId||sf.makeId('PACK');
      if(!sf.state.scenePacks.some(p=>p.id===packId)){
        sf.state.scenePacks.push({
          id:packId,name:pack.packName||'Imported Scene Pack',
          version:pack.version||'1.0',installedAt:new Date().toISOString()
        });
      }

      for(const input of pack.scenes||[]){
        const scene={
          id:input.id||input.sceneId||sf.makeId('SCN'),
          packId,
          name:input.name||'Unnamed Scene',
          style:input.style||'Uncategorized',
          room:input.room||input.roomType||'Room',
          wallWidth:Number(input.wallWidth||input.wallWidthInches||144),
          safeWidth:Number(input.safeWidth||input.safeWidthInches||72),
          safeHeight:Number(input.safeHeight||input.safeHeightInches||48),
          safeCenterX:Number(input.safeCenterX??50),
          safeCenterY:Number(input.safeCenterY??38),
          lightDirection:input.lightDirection||'left',
          lightAngle:Number(input.lightAngle??35),
          shadowSoftness:Number(input.shadowSoftness??72),
          shadowStrength:Number(input.shadowStrength??36),
          image:input.image||''
        };
        const index=sf.state.scenes.findIndex(s=>s.id===scene.id);
        if(index>=0)sf.state.scenes[index]={...sf.state.scenes[index],...scene};
        else sf.state.scenes.push(scene);
      }

      const packName=pack.packName||'Imported Scene Pack';
      sf.logActivity(`Installed Scene Pack: ${packName}`);
      await sf.persist();
      this.render();
      const status=sf.$('sceneInstallStatus');
      if(status)status.innerHTML=`<div class="install-status">Installed ${sf.esc(packName)} successfully.</div>`;
      window.focus();
    }catch(error){
      sf.logError(error,'Install Scene Pack');
      alert('The selected file is not a valid StudioFlow Scene Pack.');
    }
  }
};

/* StudioFlow g89 — assign a Series to scenes that already exist.
   Kirk asked that the wizard's "Internal Production Family" and the Room Designer's "Series"
   become one word for one thing so they link. Renaming the wizard label is half of it; the other
   half is that the field only ever existed at CREATION time, so every scene already in his
   library had no way to get one. Without this, the rename would link two labels over an empty
   field and the Series dropdown would stay hidden forever.

   Deliberately a rename-in-place on the existing productionFamily key rather than a new `series`
   field — a second field would mean two sources of truth and scenes filed under whichever one the
   reader happened to check. */
(function(){
  const S=window.SFScenes;
  if(!S||!S.render)return;
  const orig=S.render;

  S.seriesNames=function(){
    const set=new Set();
    (window.SF.state.scenes||[]).forEach(x=>{
      const v=String(x.productionFamily||x.family||'').trim();
      if(v)set.add(v);
    });
    return [...set].sort((a,b)=>a.localeCompare(b));
  };

  S.openSeries=function(id){
    const sf=window.SF;
    const scene=(sf.state.scenes||[]).find(x=>String(x.id)===String(id));
    if(!scene)return;
    const current=String(scene.productionFamily||scene.family||'').trim();
    const known=this.seriesNames();
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal">
      <h3>Series</h3>
      <p class="muted">Groups rooms shot in one production — Aspen, Cascade, and so on. This is the
      middle dropdown in the Room Designer, between Collection and Room. Leave it blank if you
      don't use series; the dropdown stays hidden until at least one scene has one.</p>
      <p class="muted"><b>${sf.esc(scene.internalName||scene.name||'Scene')}</b></p>
      ${known.length?`<label>Use an existing series</label>
        <select id="scSeriesPick"><option value="">—</option>${known.map(n=>
          `<option value="${sf.esc(n)}" ${n===current?'selected':''}>${sf.esc(n)}</option>`).join('')}</select>`:''}
      <label>Series name</label>
      <input id="scSeriesName" value="${sf.esc(current)}" placeholder="e.g. Aspen">
      <div class="modal-footer">
        <button class="button secondary" id="scSeriesCancel">Cancel</button>
        <button class="button primary" id="scSeriesSave">Save</button>
      </div></div></div>`;
    const pick=sf.$('scSeriesPick');
    if(pick)pick.onchange=e=>{if(e.target.value)sf.$('scSeriesName').value=e.target.value;};
    sf.$('scSeriesCancel').onclick=()=>sf.closeModal();
    sf.$('scSeriesSave').onclick=async()=>{
      const v=String(sf.$('scSeriesName').value||'').trim();
      if(v)scene.productionFamily=v; else delete scene.productionFamily;
      // The legacy mirror is cleared too, or a stale value would keep winning on the read path.
      if(scene.family!==undefined)delete scene.family;
      scene.updatedAt=new Date().toISOString();
      await sf.persist();
      sf.closeModal();
      S.render();
    };
  };

  S.render=function(){
    const r=orig.apply(this,arguments);
    try{
      document.querySelectorAll('.series-scene').forEach(b=>b.onclick=()=>this.openSeries(b.dataset.id));
    }catch(e){ console.warn('Series button could not be wired:',e); }
    return r;
  };
})();

/* StudioFlow g112 — A CLIENT'S OWN ROOM.
   Kirk wants to photograph (or be sent) a client's wall, calibrate it, and hang their piece in it.
   Every part already existed — scenes hold an image, calibration measures one, Room Designer draws
   into one — but only as a three-stop route: make a scene, attach an image, go and calibrate it.
   This is that route as one button.

   Two decisions:
   1. THE PHOTO IS STORED AS A PATH, not as base64 in the database. file:openImage already copies
      the chosen file into StudioFlow's managed images folder and returns storedPath. A client's
      room photo off a phone is several megabytes, the database already exceeds 100MB, and every
      save rewrites the whole file. attachImage() below is corrected the same way.
   2. A client room is a ONE-OFF, not library material, so it is filed under the collection
      "Client Rooms" and never enters the scene packs. That keeps Kirk's Collection → Series → Room
      picker clean, and the g86 picker will group them together on their own automatically. */
(function(){
  const S=window.SFScenes;
  if(!S||!S.render)return;

  S.CLIENT_COLLECTION='Client Rooms';

  /* A real modal, with a preview of the photograph so he can see what he is naming. */
  S.askRoomName=function(suggested,previewSrc){
    const sf=window.SF;
    return new Promise(resolve=>{
      sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal">
        <h3>Name this room</h3>
        <p class="muted">This is a client's own room. It is filed separately from your scene packs
        and will not appear among your library collections.</p>
        <img src="${sf.esc(previewSrc)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:6px;margin:6px 0 10px">
        <label>Room name<input id="clientRoomName" value="${sf.esc(suggested)}" placeholder="e.g. Henderson living room"></label>
        <div class="modal-footer">
          <button class="button secondary" id="clientRoomCancel">Cancel</button>
          <button class="button primary" id="clientRoomSave">Calibrate this room</button>
        </div></div></div>`;
      const field=sf.$('clientRoomName');
      field.focus(); field.select();
      const finish=(v)=>{ sf.closeModal(); resolve(v); };
      sf.$('clientRoomCancel').onclick=()=>finish('');
      sf.$('clientRoomSave').onclick=()=>finish(String(field.value||'').trim());
      field.onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();finish(String(field.value||'').trim());} };
    });
  };

  S.newFromClientPhoto=async function(){
    const sf=window.SF;
    const file=await sf.api.openImage({title:'Choose the client\u2019s room photograph'});
    if(!file)return;
    const src=file.storedPath||file.data;
    if(!src){alert('That image could not be read.');return;}

    /* g113: this used prompt(), which ELECTRON DOES NOT IMPLEMENT — it returns undefined and logs
       "prompt() is and will not be supported". The name came back empty, the guard below treated
       that as a cancel, and the whole thing silently did nothing after the picker closed. Exactly
       what Kirk reported. Replaced with the app's own modal.
       NOTE: crop-tool.js, limited-editions.js, markets-shows.js, pricing.js and room-projects.js
       each still called prompt() and were broken the same way — ALL FIXED IN g147, which replaced
       every one of them with the shared SF.askFields()/SF.askText() modal in core.js. */
    const suggested=String(file.name||'Client room').replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ').trim();
    const name=await this.askRoomName(suggested,src);
    if(!name)return;                                    // genuinely cancelled — create nothing

    const scene={
      id:sf.makeId('SCN'),
      name, displayName:name, internalName:name,
      collection:S.CLIENT_COLLECTION, style:S.CLIENT_COLLECTION,
      roomType:'Client Room', room:'Client Room',
      clientScene:true,
      image:src, backgroundLayer:src, sourceFilename:file.name||'',
      calibrated:false, calibrationLocked:false, inLibrary:false,
      productionStatus:'Needs calibration',
      createdAt:new Date().toISOString()
    };
    sf.state.scenes=sf.state.scenes||[];
    sf.state.scenes.push(scene);
    sf.logActivity?.(`Added client room: ${name}`);
    await sf.persist();

    /* Straight into calibration with the scene already loaded — the whole point of the button is
       that he does not have to go and find it. */
    if(window.SFCalibration?.loadScene){
      window.SFCalibration.loadScene(scene);
      sf.goTo('Scene Calibration');
    }else{
      sf.goTo('Scene Calibration');
    }
  };

  const origRender=S.render;
  S.render=function(){
    const r=origRender.apply(this,arguments);
    try{
      const host=document.getElementById('addSceneButton');
      if(host&&!document.getElementById('clientPhotoButton')){
        host.insertAdjacentHTML('afterend',
          '<button class="button secondary" id="clientPhotoButton">Client\u2019s Photo\u2026</button>');
        document.getElementById('clientPhotoButton').onclick=()=>this.newFromClientPhoto();
      }
    }catch(e){ console.warn('Client photo button could not be added:',e); }
    return r;
  };
})();
