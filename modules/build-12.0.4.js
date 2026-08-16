/* StudioFlow 12.0.4 · Artwork Rendering Pipeline Repair */
(function(){
 const sf=window.SF;if(!sf)return;
 const norm=v=>String(v||'').trim().toLowerCase();
 const browserSafe=v=>/^data:image\//i.test(v)||/^https?:\/\//i.test(v)||/^blob:/i.test(v);
 const sourceOf=a=>{
  if(!a)return '';
  const values=[a.__sfResolvedImage,a.image,a.thumbnail,a.imageData,a.data,a.dataUrl,a.url,a.imageUrl,a.previewUrl,a.localUrl,a.sourceUrl,a.originalUrl,a.fileUrl,a.path,a.filePath,a.originalPath,a.assetPath,a.fullPath,a.src,a.source,a.original,a.preview,a.large,a.medium];
  if(Array.isArray(a.imageUrls))values.push(...a.imageUrls);else if(a.imageUrls)values.push(...String(a.imageUrls).split(/\s+/));
  if(Array.isArray(a.images))for(const x of a.images)values.push(typeof x==='string'?x:x?.data||x?.url||x?.src||x?.path);
  return values.find(v=>typeof v==='string'&&v.trim())||'';
 };
 const cache=new Map(), pending=new Map();
 async function resolve(source,key=''){
  source=String(source||'').trim();
  const ck=key||source;
  if(cache.has(ck))return cache.get(ck);
  if(!source)return '';
  if(browserSafe(source)&&!source.startsWith('blob:')){cache.set(ck,source);return source;}
  if(pending.has(ck))return pending.get(ck);
  const job=(async()=>{
   try{
    const result=await window.studioflow?.resolveImageSource?.(source);
    if(result?.ok&&result.data){cache.set(ck,result.data);return result.data;}
    console.warn('StudioFlow artwork image could not be resolved',result?.error||source);
    return '';
   }catch(error){console.error('StudioFlow image pipeline',error);return ''}
  })();pending.set(ck,job);const out=await job;pending.delete(ck);return out;
 }
 window.SFImagePipeline={sourceOf,resolve,cache};
 function artKey(a){return norm(a?.artworkId||a?.id||a?.title)}
 function errorCard(message){return `<div class="rd-image-error"><b>Artwork image unavailable</b><span>${sf.esc(message||'Open Artwork Library, edit this artwork, and choose its image again.')}</span></div>`}

 if(window.SFRoomDesigner){
  const rd=window.SFRoomDesigner;
  const baseArt=rd.art.bind(rd), baseDraw=rd.draw.bind(rd);
  rd.art=function(){const a=baseArt();if(!a)return a;const key=artKey(a),resolved=cache.get(key);return {...a,image:resolved||sourceOf(a),__sfKey:key};};
  rd.draw=function(){
   const a=baseArt();const key=artKey(a),raw=sourceOf(a);
   if(a&&raw&&!cache.has(key)&&(!browserSafe(raw)||raw.startsWith('blob:'))){
    const layer=sf.$('rdArtworkLayer');if(layer)layer.innerHTML='<div class="rd-image-loading">Loading artwork…</div>';
    resolve(raw,key).then(img=>{if(img){a.__sfResolvedImage=img;cache.set(key,img);baseDraw();}else{const l=sf.$('rdArtworkLayer');if(l)l.innerHTML=errorCard('The saved image reference could not be opened. Re-select the artwork image once to repair it permanently.');}});
    return;
   }
   baseDraw();
   const img=sf.$('rdArtworkLayer')?.querySelector('.rd-art-image');
   if(img){
    img.addEventListener('error',()=>{const current=baseArt(),src=sourceOf(current);resolve(src,key).then(fixed=>{if(fixed&&img.src!==fixed)img.src=fixed;else{const l=sf.$('rdArtworkLayer');if(l)l.innerHTML=errorCard();}})},{once:true});
   }
  };
 }

 if(window.SFAIArtCreation){
  const ai=window.SFAIArtCreation, baseImage=ai.image.bind(ai), basePreview=ai.preview.bind(ai);
  ai.image=function(){const a=this.artworkCatalog().find(x=>norm(x.artworkId||x.id)===norm(this.model.artworkId));const key=artKey(a);return this.externalImage||cache.get(key)||sourceOf(a)||baseImage();};
  ai.preview=function(){
   const a=this.artworkCatalog().find(x=>norm(x.artworkId||x.id)===norm(this.model.artworkId));const key=artKey(a),raw=this.externalImage||sourceOf(a);
   if(raw&&!cache.has(key)&&(!browserSafe(raw)||raw.startsWith('blob:'))){
    const host=sf.$('aiLayerPreview');if(host)host.innerHTML='<div class="ai-empty-layer">Loading artwork…</div>';
    resolve(raw,key).then(img=>{if(img){cache.set(key,img);basePreview();}else if(host)host.innerHTML='<div class="ai-image-error"><b>Artwork image unavailable</b><span>Edit the artwork and choose its image again.</span></div>'});
    return;
   }
   basePreview();
   const img=sf.$('aiLayerPreview')?.querySelector('img');
   if(img)img.addEventListener('error',()=>resolve(raw,key).then(fixed=>{if(fixed)img.src=fixed;}),{once:true});
  };
 }
 sf.state.appVersion='12.0.4';sf.state.schemaVersion=Math.max(13,Number(sf.state.schemaVersion||0));
})();
