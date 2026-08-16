window.SFAssetImporter = {
  files:[],
  defaults:{collection:'Modern',roomType:'Bedroom',lightingDirection:'left',ceilingHeight:96},
  families:['Aspen','Cascade','Horizon'],
  parseName(filename,index){
    const base=String(filename||'Room').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
    const lower=base.toLowerCase();
    const family=this.families.find(f=>lower.includes(f.toLowerCase()))||this.families[index%this.families.length]||'Series';
    const match=base.match(/(?:^|\s)(\d+)(?:\s|$)/);
    const variation=match?Number(match[1]):(Math.floor(index/this.families.length)+1);
    return {family,variation,displayName:`${family} ${variation}`};
  },
  async open(){
    const sf=window.SF;
    const files=await sf.api.openImages();
    if(!files||!files.length)return;
    this.files=files.map((file,index)=>({...file,...this.parseName(file.name,index)}));
    this.render();
  },
  render(){
    const sf=window.SF;
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal wizard-modal batch-import-modal">
      <div class="modal-head"><div><small class="wizard-kicker">ASSET IMPORT MANAGER</small><h2>Batch Import Rooms</h2></div><button class="close-button" id="batchClose">×</button></div>
      <div class="grid3">
        <div><label>Collection</label><select id="batchCollection">${['Modern','Coastal','Contemporary','Corporate','Hospitality','Gallery'].map(x=>`<option ${x===this.defaults.collection?'selected':''}>${x}</option>`).join('')}</select></div>
        <div><label>Room Type</label><input id="batchRoomType" value="${sf.esc(this.defaults.roomType)}"></div>
        <div><label>Ceiling Height</label><select id="batchCeiling">${[96,108,120,144,168,192,216].map(v=>`<option value="${v}" ${v===this.defaults.ceilingHeight?'selected':''}>${v/12} ft (${v}")</option>`).join('')}</select></div>
      </div>
      <div class="batch-list">${this.files.map((f,i)=>`<div class="batch-row" data-index="${i}">
        <img src="${f.data}"><div><small>${sf.esc(f.name)}</small><label>Family</label><input class="batch-family" value="${sf.esc(f.family)}"><label>Display Name</label><input class="batch-name" value="${sf.esc(f.displayName)}"></div>
        <div><label>Variation</label><input class="batch-variation" type="number" min="1" value="${f.variation}"><div class="batch-id-preview"></div></div>
      </div>`).join('')}</div>
      <div class="help">Every image receives its own permanent Asset ID. Existing names may repeat, but Asset IDs never do.</div>
      <div class="wizard-actions"><button class="button secondary" id="batchCancel">Cancel</button><span></span><button class="button primary" id="batchImport">Import ${this.files.length} Rooms</button></div>
    </div></div>`;
    const refresh=()=>this.refreshPreview();
    ['batchCollection','batchRoomType'].forEach(id=>sf.$(id).addEventListener('input',refresh));
    document.querySelectorAll('.batch-family,.batch-name,.batch-variation').forEach(el=>el.addEventListener('input',refresh));
    sf.$('batchClose').addEventListener('click',()=>sf.closeModal());
    sf.$('batchCancel').addEventListener('click',()=>sf.closeModal());
    sf.$('batchImport').addEventListener('click',()=>this.importAll());
    this.refreshPreview();
  },
  rows(){
    const sf=window.SF,collection=sf.$('batchCollection').value,roomType=sf.$('batchRoomType').value.trim()||'Room';
    return [...document.querySelectorAll('.batch-row')].map((row,index)=>({
      index,collection,roomType,
      productionFamily:row.querySelector('.batch-family').value.trim()||'Series',
      displayName:row.querySelector('.batch-name').value.trim()||`Room ${index+1}`,
      variation:Number(row.querySelector('.batch-variation').value||index+1),
      file:this.files[index]
    }));
  },
  refreshPreview(){
    const manager=window.SFAssetManager;
    this.rows().forEach((r,index)=>{
      const preview=document.querySelectorAll('.batch-id-preview')[index];
      if(preview)preview.textContent=manager.nextId(r);
    });
  },
  async importAll(){
    const sf=window.SF,manager=window.SFAssetManager;
    try{
      const ceilingHeight=Number(sf.$('batchCeiling').value||96);
      const rows=this.rows();
      for(const row of rows){
        const assetId=manager.nextId(row);
        manager.add({
          id:assetId,assetId,packId:`PACK-${row.collection.toUpperCase().replace(/\s+/g,'-')}`,
          internalName:`${row.productionFamily} ${row.roomType} ${String(row.variation).padStart(2,'0')} - ${row.displayName}`,
          displayName:row.displayName,name:row.displayName,collection:row.collection,productionFamily:row.productionFamily,variation:row.variation,
          roomType:row.roomType,style:row.collection,room:row.roomType,image:row.file.data,backgroundLayer:row.file.data,sourceFilename:row.file.name,
          foregroundLayers:[],lightingOverlay:'',lightDirection:'left',lightAngle:34,shadowSoftness:82,shadowStrength:28,
          wallHeight:ceilingHeight,wallWidth:0,safeWidth:0,safeHeight:0,calibrated:false,calibration:null,productionStatus:'Needs Calibration',calibrationLocked:false,inLibrary:false
        });
      }
      sf.logActivity(`Batch imported ${rows.length} room assets.`);
      const result=await sf.persist();
      if(result&&result.ok===false)throw new Error(result.error||'Could not save imported rooms.');
      sf.closeModal(); window.SFScenes.render();
    }catch(error){sf.logError(error,'Batch Import');alert(error.message||'Batch import failed.');}
  }
};
