window.SFAssetManager = {
  collectionCode(name){
    const map={Modern:'MOD',Coastal:'CST',Contemporary:'CON',Corporate:'COR',Hospitality:'HSP',Gallery:'GAL'};
    return map[name]||String(name||'XXX').replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase().padEnd(3,'X');
  },
  roomCode(name){
    const map={'Living Room':'LR','Dining Room':'DR','Entry':'EN','Bedroom':'BR','Home Office':'HO','Sitting Room':'SR','Reception':'RC','Waiting Area':'WA','Boardroom':'BD','Executive Office':'EO','Hotel Lobby':'HL','Hotel Suite':'HS','Condo Living Room':'CL','Condo Dining Room':'CD','Condo Entry':'CE','White Gallery':'WG','Contemporary Gallery':'CG','Intimate Gallery':'IG'};
    return map[name]||String(name||'RM').replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase().padEnd(2,'X');
  },
  familyCode(name){return String(name||'XXX').replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase().padEnd(3,'X')},
  nextId({collection,productionFamily,roomType}){
    const sf=window.SF;
    const prefix=`${this.collectionCode(collection)}-${this.familyCode(productionFamily)}-${this.roomCode(roomType)}-`;
    const used=new Set((sf.state.scenes||[]).map(s=>String(s.assetId||s.id||'')));
    let n=1,id='';
    do{id=`${prefix}${String(n++).padStart(3,'0')}`}while(used.has(id));
    return id;
  },
  ensureUniqueIds(scenes){
    const used=new Set();
    return (scenes||[]).map((scene,index)=>{
      let id=String(scene.assetId||scene.id||'').trim();
      if(!id||used.has(id)){
        const base=id||`SCN-MIGRATED-${String(index+1).padStart(3,'0')}`;
        let n=2; id=base;
        while(used.has(id))id=`${base}-V${n++}`;
      }
      used.add(id);
      return {...scene,id,assetId:id,sourceImageId:scene.sourceImageId||id,recordType:'roomAsset'};
    });
  },
  find(id){return (window.SF.state.scenes||[]).find(s=>(s.assetId||s.id)===id)},
  add(record){
    const sf=window.SF;
    if(!Array.isArray(sf.state.scenes))sf.state.scenes=[];
    const id=record.assetId||record.id;
    if(!id)throw new Error('Asset ID is required.');
    if(this.find(id))throw new Error(`Asset ID ${id} already exists.`);
    const now=new Date().toISOString();
    const asset={...record,id,assetId:id,sourceImageId:record.sourceImageId||id,recordType:'roomAsset',createdAt:record.createdAt||now,updatedAt:now};
    sf.state.scenes.unshift(asset);
    return asset;
  },
  update(id,changes){
    const asset=this.find(id); if(!asset)throw new Error('Room asset not found.');
    Object.assign(asset,changes,{id:asset.id,assetId:asset.assetId||asset.id,updatedAt:new Date().toISOString()});
    return asset;
  },
  removeAsset(id){
    const sf=window.SF;
    const before=sf.state.scenes.length;
    sf.state.scenes=sf.state.scenes.filter(s=>(s.assetId||s.id)!==id);
    return before!==sf.state.scenes.length;
  },
  removeCalibration(id){
    return this.update(id,{calibrated:false,calibration:null,wallPlane:null,calibrationLocked:false,productionStatus:'Needs Calibration',approvedAt:''});
  },
  removeLibraryReference(id){
    return this.update(id,{inLibrary:false,libraryAddedAt:'',calibrationLocked:false,productionStatus:this.find(id)?.calibrated?'Calibrated - Awaiting Approval':'Needs Calibration'});
  },
  markLibrary(id){return this.update(id,{inLibrary:true,libraryAddedAt:new Date().toISOString(),calibrationLocked:true,productionStatus:'Production Approved',approvedAt:new Date().toISOString()})}
};
