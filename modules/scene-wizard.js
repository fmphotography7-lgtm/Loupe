
window.SFSceneWizard = {
  draft:null,

  fresh(){
    return {
      collection:'Modern',
      productionFamily:'Aspen',
      roomType:'Living Room',
      displayName:'',
      internalName:'',
      sceneId:'',
      background:'',
      foreground:'',
      lightingDirection:'left',
      lightingStrength:'soft',
      ceilingHeight:96
    };
  },

  collectionCode(name){
    const map={
      'Modern':'MOD',
      'Coastal':'CST',
      'Contemporary':'CON',
      'Corporate':'COR',
      'Hospitality':'HSP',
      'Gallery':'GAL'
    };
    return map[name]||String(name||'XXX').slice(0,3).toUpperCase();
  },

  roomTypeCode(name){
    const map={
      'Living Room':'LR','Dining Room':'DR','Entry':'EN',
      'Bedroom':'BR','Home Office':'HO','Sitting Room':'SR',
      'Reception':'RC','Waiting Area':'WA','Boardroom':'BD',
      'Executive Office':'EO',
      'Hotel Lobby':'HL','Hotel Suite':'HS',
      'Condo Living Room':'CL','Condo Dining Room':'CD','Condo Entry':'CE',
      'Canvas':'CV','Axis':'AX','Frame':'FR',
      'Loft':'LO','Studio':'ST','Heritage':'HR',
      'Atrium':'AT','Vista':'VS','Monolith':'ML'
    };
    return map[name]||String(name||'RM').replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase();
  },

  productionFamilies(collection){
    const map={
      'Modern':['Aspen','Cascade','Horizon'],
      'Coastal':['Driftwood','Salish','Shoreline'],
      'Contemporary':['Slate','Vertex','District'],
      'Corporate':['Summit','Meridian','Foundry'],
      'Hospitality':['Pacific','Regent','Aurora'],
      'Gallery':['White Cube','Atelier','Pavilion']
    };
    return map[collection]||[];
  },

  roomTypes(collection,productionFamily){
    if(['Modern','Coastal','Contemporary'].includes(collection)){
      return ['Living Room','Dining Room','Entry','Bedroom','Home Office','Sitting Room'];
    }
    if(collection==='Corporate'){
      return ['Reception','Waiting Area','Boardroom','Executive Office'];
    }
    if(collection==='Hospitality'){
      return ['Hotel Lobby','Hotel Suite','Condo Living Room','Condo Dining Room','Condo Entry'];
    }
    if(collection==='Gallery'){
      const map={
        'White Cube':['Canvas','Axis','Frame'],
        'Atelier':['Loft','Studio','Heritage'],
        'Pavilion':['Atrium','Vista','Monolith']
      };
      return map[productionFamily]||map['White Cube'];
    }
    return ['Living Room'];
  },

  familyCode(name){
    const cleaned=String(name||'XXX').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
    return cleaned.slice(0,3).padEnd(3,'X');
  },

  nextSceneId(collection,roomType){
    const sf=window.SF;
    const family=this.draft?.productionFamily||this.productionFamilies(collection)[0]||'Series';
    const prefix=`${this.collectionCode(collection)}-${this.familyCode(family)}-${this.roomTypeCode(roomType)}-`;
    const numbers=(sf.state.scenes||[])
      .map(s=>String(s.id||''))
      .filter(id=>id.startsWith(prefix))
      .map(id=>Number(id.slice(prefix.length)))
      .filter(Number.isFinite);
    const next=(numbers.length?Math.max(...numbers):0)+1;
    return `${prefix}${String(next).padStart(3,'0')}`;
  },

  refreshSceneId(){
    const d=this.draft;
    const existingCount=(window.SF.state.scenes||[]).filter(s=>
      s.collection===d.collection &&
      s.productionFamily===d.productionFamily &&
      s.roomType===d.roomType
    ).length+1;
    d.sceneId=this.nextSceneId(d.collection,d.roomType);
    const suffix=d.displayName?` - ${d.displayName}`:'';
    d.internalName=`${d.productionFamily} ${d.roomType} ${String(existingCount).padStart(2,'0')}${suffix}`;
  },

  sequenceNumber(){
    const parts=String(this.draft.sceneId||'').split('-');
    return Number(parts[parts.length-1]||0);
  },

  refreshInternalName(){
    const d=this.draft;
    const number=String(this.sequenceNumber()||1).padStart(2,'0');
    const suffix=d.displayName?.trim()?` - ${d.displayName.trim()}`:'';
    d.internalName=`${d.collection} ${d.roomType} ${number}${suffix}`;
  },

  open(){
    this.draft=this.fresh();
    this.refreshSceneId();
    this.renderStep(1);
  },

  renderStep(step){
    const sf=window.SF,d=this.draft;
    const steps=['Identity','Room Image','Foreground','Lighting','Review'];
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal wizard-modal">
      <div class="modal-head">
        <div><small class="wizard-kicker">CREATE NEW SCENE</small><h2>${steps[step-1]}</h2></div>
        <button class="close-button" id="wizardClose">×</button>
      </div>
      <div class="wizard-progress">${steps.map((s,i)=>`<div class="${i+1===step?'active':i+1<step?'done':''}"><b>${i+1}</b><span>${s}</span></div>`).join('')}</div>
      <div id="wizardBody">${this.body(step)}</div>
      <div class="wizard-actions">
        ${step>1?'<button class="button secondary" id="wizardBack">Back</button>':''}
        <span></span>
        ${step<5?'<button class="button primary" id="wizardNext">Continue</button>':'<button class="button primary" id="wizardCreate">Create & Calibrate</button>'}
      </div>
    </div></div>`;

    sf.$('wizardClose').addEventListener('click',()=>sf.closeModal());
    sf.$('wizardBack')?.addEventListener('click',()=>{this.capture(step);this.renderStep(step-1)});
    sf.$('wizardNext')?.addEventListener('click',async()=>{
      if(!this.capture(step))return;
      if(step===2 && !d.background)return alert('Choose a room image before continuing.');
      this.renderStep(step+1);
    });
    sf.$('wizardCreate')?.addEventListener('click',()=>this.createScene());

    sf.$('wizCollection')?.addEventListener('change',e=>{
      d.collection=e.target.value;
      d.productionFamily=this.productionFamilies(d.collection)[0];
      d.roomType=this.roomTypes(d.collection,d.productionFamily)[0];
      this.refreshSceneId();
      this.renderStep(1);
    });
    sf.$('wizProductionFamily')?.addEventListener('change',e=>{
      d.productionFamily=e.target.value;
      const options=this.roomTypes(d.collection,d.productionFamily);
      d.roomType=options[0];
      const roomTypeSelect=sf.$('wizRoomType');
      if(roomTypeSelect)roomTypeSelect.innerHTML=options.map(x=>`<option ${x===d.roomType?'selected':''}>${x}</option>`).join('');
      this.refreshSceneId();
      sf.$('wizSceneId').textContent=d.sceneId;
      sf.$('wizInternalName').textContent=d.internalName;
    });
    sf.$('wizRoomType')?.addEventListener('change',e=>{
      d.roomType=e.target.value;
      this.refreshSceneId();
      sf.$('wizSceneId').textContent=d.sceneId;
      sf.$('wizInternalName').textContent=d.internalName;
    });
    sf.$('wizDisplayName')?.addEventListener('input',e=>{
      d.displayName=e.target.value.trim();
      this.refreshSceneId();
      sf.$('wizSceneId').textContent=d.sceneId;
      sf.$('wizInternalName').textContent=d.internalName;
    });
    sf.$('wizardChooseBackground')?.addEventListener('click',()=>this.chooseBackground());
    sf.$('wizardChooseForeground')?.addEventListener('click',()=>this.chooseForeground());
    sf.$('wizardSkipForeground')?.addEventListener('click',()=>{
      if(!d.foreground)this.renderStep(4);
    });
    sf.$('wizardRemoveForeground')?.addEventListener('click',()=>{
      d.foreground='';
      this.renderStep(3);
    });
  },

  body(step){
    const sf=window.SF,d=this.draft;
    if(step===1)return `
      <div class="grid3">
        <div>
          <label>Collection</label>
          <select id="wizCollection">
            ${['Modern','Coastal','Contemporary','Corporate','Hospitality','Gallery'].map(x=>`<option ${x===d.collection?'selected':''}>${x}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Series</label>
          <select id="wizProductionFamily">
            ${this.productionFamilies(d.collection).map(x=>`<option ${x===d.productionFamily?'selected':''}>${x}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Room Type</label>
          <select id="wizRoomType">
            ${this.roomTypes(d.collection,d.productionFamily).map(x=>`<option ${x===d.roomType?'selected':''}>${x}</option>`).join('')}
          </select>
        </div>
      </div>
      <label>Display Name</label>
      <input id="wizDisplayName" value="${sf.esc(d.displayName)}" placeholder="${sf.esc(d.productionFamily)} ${sf.esc(d.roomType)}">
      <div class="auto-name-card">
        <small>AUTO-GENERATED</small>
        <div><span>Scene ID</span><b id="wizSceneId">${sf.esc(d.sceneId)}</b></div>
        <div><span>Internal Name</span><b id="wizInternalName">${sf.esc(d.internalName)}</b></div>
      </div>
      <div class="help">The series groups rooms shot in one production. It is the middle dropdown in the Room Designer, between Collection and Room, so filling it in here is what makes that filter useful once the library grows.</div>`;

    if(step===2)return `
      <div class="wizard-image-preview">${d.background?`<img src="${d.background}">`:'<div><b>No room image selected</b><span>Choose a clean, photorealistic room with no artwork or measurement graphics.</span></div>'}</div>
      <div class="row-actions"><button class="button primary" id="wizardChooseBackground">Choose Room Image</button></div>
      <div class="help">Use a straight, natural camera view with visible floor-wall and wall-ceiling seams. Exact measurements are added in Scene Calibration.</div>`;

    if(step===3)return `
      <div class="wizard-image-preview transparent-preview">${d.foreground?`<img src="${d.foreground}">`:'<div><b>No foreground layer</b><span>This is optional. Use only subtle plants, branches, small vases or furniture edges.</span></div>'}</div>
      <div class="row-actions">
        <button class="button secondary" id="wizardChooseForeground">Choose Transparent PNG</button>
        <button class="button secondary" id="wizardSkipForeground">${d.foreground?'Keep Current Layer':'Skip — No Foreground Layer'}</button>
        ${d.foreground?'<button class="button secondary" id="wizardRemoveForeground">Remove Layer</button>':''}
      </div>
      <div class="help">Avoid chandeliers, pendant lights and large objects crossing the display wall. Foreground overlap should remain minimal.</div>`;

    if(step===4)return `
      <div class="grid2">
        <div><label>Primary Window Position</label><select id="wizLightDirection">
          <option value="left" ${d.lightingDirection==='left'?'selected':''}>Window left of viewer</option>
          <option value="right" ${d.lightingDirection==='right'?'selected':''}>Window right of viewer</option>
          <option value="front" ${d.lightingDirection==='front'?'selected':''}>Light near camera/front</option>
        </select></div>
        <div><label>Shadow Character</label><select id="wizLightStrength">${['soft','medium','strong'].map(x=>`<option value="${x}" ${x===d.lightingStrength?'selected':''}>${x[0].toUpperCase()+x.slice(1)}</option>`).join('')}</select></div>
        <div><label>Known Ceiling Height</label><select id="wizCeilingHeight">${[96,108,120,144,168,192,216].map(v=>`<option value="${v}" ${v===d.ceilingHeight?'selected':''}>${v/12} ft (${v}")</option>`).join('')}</select></div>
      </div>
      <div class="help">The selected window side becomes the room's main light direction. StudioFlow automatically casts artwork shadows away from that window. Calibration uses the known ceiling height to establish actual scale.</div>`;

    return `
      <div class="wizard-review">
        <div class="wizard-review-image">${d.background?`<img src="${d.background}">`:''}</div>
        <div>
          <h3>${sf.esc(d.internalName||d.displayName)}</h3>
          <dl>
            <dt>Scene ID</dt><dd>${sf.esc(d.sceneId)}</dd>
            <dt>Collection</dt><dd>${sf.esc(d.collection)}</dd>
            <dt>Series</dt><dd>${sf.esc(d.productionFamily)}</dd>
            <dt>Room Type</dt><dd>${sf.esc(d.roomType)}</dd>
            <dt>Photographer Name</dt><dd>${sf.esc(d.displayName)}</dd>
            <dt>Ceiling</dt><dd>${d.ceilingHeight/12} ft</dd>
            <dt>Main Light</dt><dd>${sf.esc(d.lightingDirection)} · ${sf.esc(d.lightingStrength)}</dd>
            <dt>Foreground Layer</dt><dd>${d.foreground?'Included':'None'}</dd>
          </dl>
        </div>
      </div>
      <div class="help">Create & Calibrate saves this room to Scene Packs and opens it immediately in the five-point calibration tool.</div>`;
  },

  capture(step){
    const sf=window.SF,d=this.draft;
    if(step===1){
      d.collection=sf.$('wizCollection').value;
      d.productionFamily=sf.$('wizProductionFamily').value;
      d.roomType=sf.$('wizRoomType').value;
      d.displayName=sf.$('wizDisplayName').value.trim()||`${d.productionFamily} ${d.roomType}`;
      this.refreshSceneId();
      if(!d.sceneId||!d.internalName){
        alert('StudioFlow could not generate the scene information.');
        return false;
      }
    }
    if(step===4){
      d.lightingDirection=sf.$('wizLightDirection').value;
      d.lightingStrength=sf.$('wizLightStrength').value;
      d.ceilingHeight=Number(sf.$('wizCeilingHeight').value);
    }
    return true;
  },

  async chooseBackground(){
    const file=await window.SF.api.openImage();
    if(!file)return;
    this.draft.background=file.data;
    this.renderStep(2);
  },

  async chooseForeground(){
    const file=await window.SF.api.openImage();
    if(!file)return;
    this.draft.foreground=file.data;
    this.renderStep(3);
  },

  lighting(){
    const d=this.draft;
    const profiles={
      soft:{angle:34,softness:82,strength:28},
      medium:{angle:32,softness:68,strength:38},
      strong:{angle:28,softness:48,strength:52}
    };
    return profiles[d.lightingStrength]||profiles.soft;
  },

  async createScene(){
    const sf=window.SF,d=this.draft,p=this.lighting();
    if(!Array.isArray(sf.state.scenes))sf.state.scenes=[];
    const scene={
      id:d.sceneId,
      packId:`PACK-${d.collection.toUpperCase().replace(/\s+/g,'-')}`,
      internalName:d.internalName,
      displayName:d.displayName,
      name:d.displayName,
      collection:d.collection,
      productionFamily:d.productionFamily,
      roomType:d.roomType,
      style:d.collection,
      room:d.roomType,
      image:d.background,
      backgroundLayer:d.background,
      foregroundLayers:d.foreground?[{
        id:`${d.sceneId}-FG-01`,
        name:'Foreground Layer 01',
        src:d.foreground,
        z:30,
        enabled:true
      }]:[],
      lightingOverlay:'',
      lightDirection:d.lightingDirection,
      lightAngle:p.angle,
      shadowSoftness:p.softness,
      shadowStrength:p.strength,
      wallHeight:d.ceilingHeight,
      wallWidth:0,
      safeWidth:0,
      safeHeight:0,
      calibrated:false,
      calibration:null,
      productionStatus:'Needs Calibration',
      calibrationLocked:false,
      approvedAt:'',
      designNotes:'',
      createdAt:new Date().toISOString()
    };
    // A pre-created Scene Pack slot is only a placeholder, not a completed room asset.
    // Reuse that slot instead of rejecting the new room as a duplicate.
    const existing=window.SFAssetManager.find(scene.id) || (sf.state.scenes||[]).find(s=>{
      const sameName=String(s.displayName||s.name||s.internalName||'').trim().toLowerCase()===String(scene.displayName||scene.name||scene.internalName||'').trim().toLowerCase();
      const sameGroup=s.collection===scene.collection && s.roomType===scene.roomType;
      const placeholder=!s.image&&!s.backgroundLayer&&!s.calibration&&s.calibrated!==true;
      return sameName&&sameGroup&&placeholder;
    });
    try{
      if(existing){
        const preservedId=existing.assetId||existing.id||scene.id;
        Object.assign(existing,scene,{id:preservedId,assetId:preservedId,sourceImageId:preservedId,recordType:'roomAsset',updatedAt:new Date().toISOString()});
        scene.id=preservedId;scene.assetId=preservedId;scene.sourceImageId=preservedId;
      }else{
        window.SFAssetManager.add({...scene,assetId:scene.id,sourceImageId:scene.id,inLibrary:false});
      }
    }catch(error){
      // A placeholder name must not prevent its first actual room image from
      // being saved. Merge directly into state if an older asset rule rejects it.
      const idx=(sf.state.scenes||[]).findIndex(s=>(s.id||s.assetId)===scene.id);
      if(idx>=0)Object.assign(sf.state.scenes[idx],scene);else sf.state.scenes.push(scene);
    }
    if(!sf.state.scenePacks.some(x=>x.id===scene.packId)){
      sf.state.scenePacks.push({
        id:scene.packId,
        name:`${d.collection} Collection`,
        version:'Beta 5',
        installedAt:new Date().toISOString()
      });
    }
    sf.logActivity(`Created scene: ${d.internalName}`);
    const result=await sf.persist();
    if(result&&result.ok===false)return alert(result.error||'Scene could not be saved.');
    sf.closeModal();
    window.SFCalibration.loadScene(scene);
    sf.goTo('Scene Calibration');
  }
};
