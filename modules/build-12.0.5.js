/* StudioFlow 12.0.5 · Persistent Artwork Image Library & Renderer Repair */
(function(){
 const sf=window.SF;if(!sf)return;
 const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
 const isUsable=v=>typeof v==='string'&&v.trim()&&!/^blob:/i.test(v.trim());
 const imageOf=a=>{
  if(!a)return '';
  const candidates=[a.permanentImagePath,a.imagePath,a.image,a.imageData,a.dataUrl,a.data,a.filePath,a.path,a.originalPath,a.thumbnail,a.imageUrl,a.url,a.src];
  if(Array.isArray(a.imageUrls))candidates.push(...a.imageUrls);
  else if(a.imageUrls)candidates.push(...String(a.imageUrls).split(/\s+/));
  return candidates.find(isUsable)||'';
 };
 const score=a=>{const src=imageOf(a);let n=0;if(a?.permanentImagePath||a?.imagePath)n+=100;if(/^data:image\//i.test(src))n+=80;if(src)n+=40;if(a?.catalogSource==='core')n+=20;if(a?.description)n+=2;return n;};
 const original=sf.artworkCatalog.bind(sf);
 sf.artworkCatalog=function(){
  const map=new Map();
  for(const a of original()){
   const key=norm(a.title||a.name)||norm(a.artworkId||a.id);if(!key)continue;
   const old=map.get(key);
   if(!old||score(a)>score(old))map.set(key,{...old,...a,image:imageOf(a)||imageOf(old),imagePath:a.imagePath||a.permanentImagePath||old?.imagePath||old?.permanentImagePath||''});
   else map.set(key,{...a,...old,image:imageOf(old)||imageOf(a)});
  }
  return [...map.values()].sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
 };
 sf.artworkById=function(id){const wanted=norm(id);return this.artworkCatalog().find(a=>norm(a.artworkId||a.id)===wanted)||null;};
 const resolve=async a=>{
  if(!a)return '';
  const src=imageOf(a);if(!src)return '';
  if(/^data:image\//i.test(src)||/^https?:/i.test(src))return src;
  const result=await window.studioflow?.resolveImageSource?.(src);return result?.ok?result.data:'';
 };
 const persistExisting=async()=>{
  let changed=false;
  for(const a of sf.state.artworks||[]){
   if(a.permanentImagePath||a.imagePath)continue;
   const src=imageOf(a);if(!/^data:image\//i.test(src))continue;
   const result=await window.studioflow?.storeArtworkImage?.({data:src,name:a.title||a.id||'artwork'});
   if(result?.ok){a.imagePath=result.storedPath;a.permanentImagePath=result.storedPath;a.image=result.storedPath;a.imageData=result.data;changed=true;}
  }
  if(changed)await sf.persist();
 };
 async function relink(id,owner){
  const a=sf.artworkById(id);if(!a)return alert('Choose an artwork first.');
  const file=await sf.api.openImage({preferredName:a.title||'artwork'});if(!file||file.ok===false)return file?.error&&alert(file.error);
  const target=(sf.state.artworks||[]).find(x=>norm(x.id||x.artworkId)===norm(a.id||a.artworkId)||norm(x.title)===norm(a.title));
  if(target){target.imagePath=file.storedPath;target.permanentImagePath=file.storedPath;target.image=file.storedPath;target.imageData=file.data;target.updatedAt=new Date().toISOString();await sf.persist();}
  if(owner==='rd'){window.SFRoomDesigner.model.externalImage='';window.SFRoomDesigner.render();}
  else window.SFAIArtCreation.render();
 }
 if(window.SFRoomDesigner){
  const rd=window.SFRoomDesigner;
  rd.artworkCatalog=()=>sf.artworkCatalog();
  const baseRender=rd.render.bind(rd);rd.render=function(){baseRender();this.draw();};
  const baseDraw=rd.draw.bind(rd);rd.draw=function(){
   const a=this.art();const layer=sf.$('rdArtworkLayer');
   if(a&&!imageOf(a)){if(layer)layer.innerHTML='<div class="rd-image-error"><b>Artwork image needs relinking</b><span>Use “Relink Selected Artwork Image” in the left panel.</span></div>';return;}
   baseDraw();
   const img=layer?.querySelector('.rd-art-image');if(a&&img){resolve(a).then(src=>{if(src&&img.getAttribute('src')!==src)img.src=src;else if(!src&&layer)layer.innerHTML='<div class="rd-image-error"><b>Artwork image needs relinking</b><span>Use “Relink Selected Artwork Image” in the left panel.</span></div>';});}
  };
 }
 if(window.SFAIArtCreation){
  const ai=window.SFAIArtCreation;ai.artworkCatalog=()=>sf.artworkCatalog();ai.image=function(){if(this.externalImage)return this.externalImage;return imageOf(sf.artworkById(this.model.artworkId));};
  const baseRender=ai.render.bind(ai);ai.render=function(){baseRender();const sel=sf.$('aiArtwork');if(sel&&!sf.$('aiRelinkArtwork')){const b=document.createElement('button');b.id='aiRelinkArtwork';b.className='button secondary';b.textContent='Relink Selected Artwork Image';b.style.marginTop='8px';sel.insertAdjacentElement('afterend',b);b.onclick=()=>relink(this.model.artworkId,'ai');}this.preview();};
  const basePreview=ai.preview.bind(ai);ai.preview=function(){basePreview();const a=sf.artworkById(this.model.artworkId),host=sf.$('aiLayerPreview'),img=host?.querySelector('.ai-image-well img,.ai-canvas-face img,.ai-metal-face img');if(a&&!imageOf(a)&&host){host.innerHTML='<div class="ai-image-error"><b>Artwork image needs relinking</b><span>Use “Relink Selected Artwork Image”.</span></div>';return;}if(a&&img)resolve(a).then(src=>{if(src)img.src=src;});};
 }
 persistExisting().catch(e=>sf.logError(e,'Artwork image migration'));
 sf.state.appVersion='12.0.5';sf.state.schemaVersion=Math.max(14,Number(sf.state.schemaVersion||0));
})();
