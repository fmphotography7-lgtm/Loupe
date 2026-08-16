/* StudioFlow 12.0.3 · Revenue Recognition & Creative Rendering Repair */
(function(){
 const sf=window.SF;if(!sf)return;
 const num=v=>Number(v||0);
 const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
 const imageOf=a=>{
  if(!a)return '';
  const candidates=[a.image,a.thumbnail,a.imageData,a.data,a.dataUrl,a.url,a.imageUrl,a.previewUrl,a.localUrl,a.sourceUrl,a.originalUrl,a.fileUrl,a.path,a.filePath,a.originalPath,a.assetPath,a.fullPath,a.src,a.source,a.original,a.preview,a.large,a.medium];
  if(Array.isArray(a.imageUrls))candidates.push(...a.imageUrls);
  else if(a.imageUrls)candidates.push(...String(a.imageUrls).split(/\s+/));
  if(Array.isArray(a.images))for(const x of a.images)candidates.push(typeof x==='string'?x:x?.url||x?.data||x?.src||x?.image||x?.thumbnail);
  if(Array.isArray(a.files))for(const x of a.files)candidates.push(typeof x==='string'?x:x?.url||x?.data||x?.src||x?.path);
  return candidates.find(x=>typeof x==='string'&&x.trim())||'';
 };
 const mergeBetter=(old,a)=>{const img=imageOf(a)||imageOf(old);return {...old,...a,image:img,thumbnail:a.thumbnail||img,title:a.title||a.name||old.title||'Untitled'};};
 const originalArtworkCatalog=sf.artworkCatalog.bind(sf);
 sf.artworkCatalog=function(){
  const all=originalArtworkCatalog();const map=new Map();
  for(const a of all){const title=norm(a.title||a.name);const id=norm(a.artworkId||a.id);const key=title||id;if(!key)continue;map.set(key,mergeBetter(map.get(key)||{},a));}
  return [...map.values()].sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
 };
 sf.artworkById=function(id){const wanted=norm(id);return this.artworkCatalog().find(a=>norm(a.artworkId||a.id)===wanted)||null;};
 const sceneCatalog=()=>{const map=new Map();for(const s of sf.state.scenes||[]){const image=s.backgroundLayer||s.image||s.imageData||s.dataUrl||s.url||'';const name=s.displayName||s.name||s.title||s.roomType||s.room||'Room';const key=norm(name);if(!key)continue;const old=map.get(key)||{};map.set(key,{...old,...s,id:old.id||s.id,backgroundLayer:image||old.backgroundLayer||old.image||'',image:image||old.image||old.backgroundLayer||''});}return [...map.values()];};
 if(window.SFRoomDesigner){
  const rd=window.SFRoomDesigner;
  rd.artworkCatalog=()=>sf.artworkCatalog().map(a=>({...a,image:imageOf(a)}));
  rd.sceneCatalog=sceneCatalog;
  rd.art=function(){const m=this.model;if(m.externalImage)return {id:'external',artworkId:'external',title:m.externalName||'External artwork',image:m.externalImage,orientation:m.imageWidth>=m.imageHeight?'Landscape':'Portrait'};const a=this.artworkCatalog().find(x=>norm(x.id||x.artworkId)===norm(m.artworkId));return a?{...a,image:imageOf(a)}:null;};
 }
 if(window.SFAIArtCreation){
  const ai=window.SFAIArtCreation;
  ai.artworkCatalog=()=>sf.artworkCatalog().map(a=>({...a,image:imageOf(a)}));
  ai.image=function(){if(this.externalImage)return this.externalImage;const a=this.artworkCatalog().find(x=>norm(x.artworkId||x.id)===norm(this.model.artworkId));return imageOf(a);};
  const oldRender=ai.render.bind(ai);ai.render=function(){oldRender();const room=sf.$('aiScene');if(room){const chosen=this.model.sceneId;room.innerHTML='<option value="">Select room</option>'+sceneCatalog().map(s=>`<option value="${sf.esc(s.id)}" ${String(chosen)===String(s.id)?'selected':''}>${sf.esc(s.displayName||s.name||s.title||s.roomType||'Room')}</option>`).join('');}}
 }
 const servicePayments=j=>{
  const rows=[];const deposit=num(j.amountPaid);if(deposit>0)rows.push({amount:deposit,date:String(j.depositDate||j.paymentDate||j.date||j.createdAt||'').slice(0,10),note:'Deposit'});
  for(const p of j.payments||[]){const amount=num(p.amount);if(amount>0)rows.push({amount,date:String(p.date||p.paidAt||j.date||'').slice(0,10),note:p.note||'Payment'});}return rows;
 };
 const BI=window.SFBusinessIntelligence;
 if(BI){const baseCollect=BI.collect.bind(BI);BI.collect=function(){const others=baseCollect().filter(r=>r.channel!=='Services');for(const j of sf.state.serviceJobs||[]){for(const p of servicePayments(j)){if(this.inPeriod(p.date)&&(this.channel==='all'||this.channel==='Services'))others.push({channel:'Services',date:p.date,gross:p.amount,revenue:p.amount,cost:0,customer:j.customerName||'Client',label:`${j.type||'Service'} · ${p.note}`});}const expenses=num(j.expenses)+num(j.mileageExpense);if(expenses>0){const d=String(j.expenseDate||j.date||j.createdAt||'').slice(0,10);if(this.inPeriod(d)&&(this.channel==='all'||this.channel==='Services'))others.push({channel:'Services',date:d,gross:0,revenue:0,cost:expenses,customer:j.customerName||'Client',label:`${j.type||'Service'} expenses`});}}return others;};}
 const C=window.SFCommerceHub;
 if(C){const old=C.periodFigures?.bind(C);C.periodFigures=function(year=new Date().getFullYear(),month=null){const out=old?old(year,month):{};const priorService=num(out.service);const inPeriod=d=>{if(!d)return false;const x=new Date(`${String(d).slice(0,10)}T12:00:00`);return x.getFullYear()===year&&(month===null||x.getMonth()===month)};let received=0,contracted=0;for(const j of sf.state.serviceJobs||[]){if(inPeriod(j.date))contracted+=num(j.revenue);for(const p of servicePayments(j))if(inPeriod(p.date))received+=p.amount;}out.service=received;out.serviceReceived=received;out.serviceContracted=contracted;if(out.revenue!==undefined){out.revenue=(num(out.revenue)-priorService)+received;}return out;};}
 sf.state.appVersion='12.0.3';sf.state.schemaVersion=Math.max(12,num(sf.state.schemaVersion));
})();
