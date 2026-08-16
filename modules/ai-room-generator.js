/* StudioFlow — AI Room Generator (g87)
   Replaces the old AI Art Creation page, which was a near-copy of the room designer that composed
   a prompt for Kirk to paste elsewhere. This one generates the whole room.

   THE POINT OF TWO SYSTEMS (Kirk's words, and the rule this file follows):
     Room Designer — a calibrated scene from the library, artwork composited at true scale, every
                     dimension and position adjustable. Accurate.
     AI Generator  — one shot. The model renders the entire photograph: room, light, furniture and
                     the print on the wall. Nothing here is editable afterwards, the result is NOT
                     calibrated and does NOT enter the scene library. If it isn't right, change the
                     inputs and generate again.
   So there are deliberately no size, placement, shadow or blend controls on this page. Adding them
   would collapse it back into a duplicate of the room designer, which is what it used to be.

   THE ARTWORK IS UPLOADED, NOT DESCRIBED. Kirk's real file is sent as a reference image on
   /v1/images/edits, and the prompt instructs the model to reproduce it exactly. Describing the
   photograph in words would produce a room containing the model's invention of his picture, which
   is not something he could show a client.

   Generated images are NOT written into state. The database already runs past 100MB with artwork
   inline; parking base64 renders in it would make every save worse. The result is held in memory
   and saved to disk through a download link. */
window.SFAIRoomGenerator = {
  /* The room vocabulary is scene-wizard.js's, because it's the language Kirk already uses for his
     library. Here it feeds a text prompt rather than a filter, so the FULL list is offered --
     unlike the room designer's picker, which only offers collections he has actually built. */
  COLLECTIONS:{
    'Modern':'clean-lined modern interior, restrained palette, uncluttered surfaces',
    'Coastal':'coastal interior, pale woods, linen textures, airy and light-filled',
    'Contemporary':'contemporary interior, mixed textures, considered styling',
    'Corporate':'corporate interior, formal and understated, commercial finishes',
    'Hospitality':'upscale hotel or condo interior, styled and inviting',
    'Gallery':'gallery space, plain walls, deliberate lighting, minimal furnishing'
  },
  ROOMS:['Living Room','Dining Room','Entry','Bedroom','Home Office','Sitting Room',
         'Reception','Waiting Area','Boardroom','Executive Office',
         'Hotel Lobby','Hotel Suite','Condo Living Room','Stairwell','Hallway'],
  MEDIA:{
    'Framed Print':'framed behind glass with a {frame} frame and a wide white mat',
    'Canvas (gallery wrap)':'a gallery-wrapped canvas with no frame, edges wrapping around a deep stretcher bar',
    'Canvas with Floating Frame':'a gallery-wrapped canvas set inside a {frame} floating frame with a visible shadow gap',
    'Metal Print':'a metal print, no frame, slightly reflective surface, floated off the wall on a hidden mount'
  },
  FRAMES:['black','white','natural oak','walnut','espresso','brushed aluminium'],
  LIGHT:{
    'Window on the left':'the main light source is a large window out of frame to the left, so light rakes across the room from the left and shadows fall to the right',
    'Window on the right':'the main light source is a large window out of frame to the right, so light rakes across the room from the right and shadows fall to the left',
    'Window facing the wall':'a window opposite the artwork wall throws even frontal light onto the picture with soft, short shadows',
    'Window behind the viewer':'daylight comes from behind the camera, lighting the wall evenly and flatly',
    'Lamplight only':'no daylight; warm lamps and practical fixtures light the room, with pooled light and deeper falloff'
  },
  TIME:{
    'Early morning':'early morning light, cool and low-angled, long soft shadows',
    'Midday':'midday light, bright and neutral, short shadows, high ambient fill',
    'Late afternoon':'late afternoon light, warm and golden, long raking shadows',
    'Night':'after dark; interior lighting only, warm pools of lamplight, black windows'
  },
  SIZES:{
    'Landscape':'1536x1024','Portrait':'1024x1536','Square':'1024x1024','Landscape (2K)':'2048x1152'
  },
  // From OpenAI's published pricing, 2026-08-06. Output only -- the reference image adds input
  // tokens on top, which is why the figure is shown as "about".
  COST:{
    'gpt-image-2':{low:{'1024x1024':0.006,'1024x1536':0.005,'1536x1024':0.005,'2048x1152':0.010},
                   medium:{'1024x1024':0.053,'1024x1536':0.041,'1536x1024':0.041,'2048x1152':0.082},
                   high:{'1024x1024':0.211,'1024x1536':0.165,'1536x1024':0.165,'2048x1152':0.330}}
  },

  state:{collection:'Modern',room:'Living Room',medium:'Framed Print',frame:'black',
    printSize:'24 x 36',artworkId:'',externalImage:'',externalName:'',
    light:'Window on the left',time:'Late afternoon',orientation:'Landscape',
    quality:'medium',notes:''},
  result:null,busy:false,keyConfigured:false,lastError:null,

  catalog(){ return (window.SF.artworkCatalog&&window.SF.artworkCatalog())||window.SF.state.artworks||[]; },
  artwork(){
    const id=this.state.artworkId;
    return this.catalog().find(a=>String(a.id)===String(id)||String(a.artworkId)===String(id))||null;
  },
  // Whatever form the image is stored in -- data URL, stored path, inline base64 -- main.js
  // resolves both, so pass the first one that exists.
  /* g93: this read only the native fields, but for many of Kirk's pieces the ONLY image lives on
     the website-cache side of artworkCatalog() — the exact problem g77 fixed for the artworks grid
     with SF.imageIndex()/SF.artworkImage(). "Tree of Life" was one of those, so this returned ''
     or a bare Squarespace URL and the render went out with no reference at all. Use the same
     resolver the grid uses rather than a second, weaker copy of it. */
  artworkSource(){
    if(this.state.externalImage) return this.state.externalImage;
    const a=this.artwork();
    if(!a) return '';
    const sf=window.SF;
    try{
      if(sf.artworkImage) return sf.artworkImage(a, sf.imageIndex?sf.imageIndex():null)||'';
    }catch(_){}
    return a.image||a.permanentImagePath||a.imagePath||a.imageData||a.thumbnail||'';
  },
  artworkLabel(){
    if(this.state.externalName) return this.state.externalName;
    const a=this.artwork();
    return a?(a.title||'Untitled'):'';
  },
  sizeValue(){ return this.SIZES[this.state.orientation]||'1536x1024'; },
  estimatedCost(){
    const t=this.COST['gpt-image-2'][this.state.quality]||{};
    return t[this.sizeValue()]||0;
  },

  /* The prompt. Ordered deliberately: what the picture IS, then the room, then the light, then --
     last and most emphatic -- the instruction not to touch the artwork, because that is the
     requirement most likely to be lost in a long prompt. */
  buildPrompt(){
    const s=this.state;
    const medium=(this.MEDIA[s.medium]||'').replace('{frame}',s.frame);
    const L=[];
    L.push(`A photorealistic interior photograph of a ${s.collection.toLowerCase()} ${s.room.toLowerCase()}.`);
    L.push(`${this.COLLECTIONS[s.collection]||''}.`);
    L.push(`On the main wall hangs a single artwork, approximately ${s.printSize} inches, presented as ${medium}.`);
    L.push(`Lighting: ${this.LIGHT[s.light]||''}. ${this.TIME[s.time]||''}.`);
    /* g94 — FRAMING. Left to itself the model composes a room photograph and treats the artwork as
       one more object in it, often on a hard oblique wall. Kirk needs the opposite: the print is
       the subject and the room is context. Stating the camera position numerically ("within about
       15 degrees", "centred in the upper-middle third") holds far better than adjectives. */
    L.push(`COMPOSITION: the artwork is the subject of this photograph and must be the clear focal point. Place the camera nearly square to the wall the artwork hangs on — within about 15 degrees of straight-on, never a hard oblique or raking angle — so the piece reads close to rectangular rather than steeply foreshortened. Frame it centred in the upper-middle of the image and large enough to dominate the composition, with the furniture and room arranged around and below it as supporting context. Shot on a full-frame camera with a 50mm lens at eye level, natural perspective, no wide-angle distortion. The artwork is fully visible, unobstructed and hung at standard gallery height.`);
    if(String(s.notes||'').trim()) L.push(String(s.notes).trim());
    L.push('');
    L.push(`CRITICAL: the supplied reference image is the exact artwork that must appear in the frame on the wall. Reproduce it EXACTLY as provided — same composition, same colours, same tones, same subject, same crop. Do not reinterpret, restyle, redraw, recolour, crop, flip, extend or substitute it, and do not add or remove any element within it. The only permissible change is the perspective foreshortening and the lighting falling across its surface as it hangs on the wall. Everything else in the photograph is yours to create; the artwork itself is not.`);
    return L.join(' ').replace(/\s+\n/g,'\n');
  },

  async refreshKey(){
    try{ const st=await window.SF.api.aiKeyStatus(); this.keyConfigured=!!(st&&st.configured); }
    catch(_){ this.keyConfigured=false; }
  },

  render(){
    const sf=window.SF,s=this.state;
    const opt=(list,val)=>list.map(o=>`<option value="${sf.esc(o)}" ${o===val?'selected':''}>${sf.esc(o)}</option>`).join('');
    const arts=this.catalog();
    const cost=this.estimatedCost();
    const ready=!!this.artworkSource()&&this.keyConfigured&&!this.busy;

    sf.$('workspace').innerHTML=`<div class="page-stack"><div class="airg-shell">
      <aside class="designer-panel card airg-panel">
        <h2>AI Room Generator</h2>
        <p class="muted">A complete room rendered from scratch, with your photograph in it. Not a
        library scene and not adjustable afterwards — change the settings and generate again.
        For precise, true-to-scale mockups use Room Designer.</p>

        <label>Artwork</label>
        <select id="airgArt"><option value="">Choose artwork</option>${arts.map(a=>{
          const k=a.id||a.artworkId;
          return `<option value="${sf.esc(k)}" ${String(k)===String(s.artworkId)&&!s.externalImage?'selected':''}>${sf.esc(a.title||'Untitled')}</option>`;
        }).join('')}</select>
        <button class="button secondary" id="airgBrowse" style="margin-top:8px;width:100%">Choose outside file…</button>
        <div class="help">${this.artworkLabel()?`Using: <b>${sf.esc(this.artworkLabel())}</b>`:'Your file is uploaded with the request, so the print in the render is the real photograph.'}</div>

        <label>Collection</label><select id="airgCollection">${opt(Object.keys(this.COLLECTIONS),s.collection)}</select>
        <label>Room</label><select id="airgRoom">${opt(this.ROOMS,s.room)}</select>

        <label>Presentation</label><select id="airgMedium">${opt(Object.keys(this.MEDIA),s.medium)}</select>
        ${/Frame/i.test(s.medium)?`<label>Frame colour</label><select id="airgFrame">${opt(this.FRAMES,s.frame)}</select>`:''}
        <label>Print size (inches)</label><input id="airgSize" value="${sf.esc(s.printSize)}">

        <label>Main light source</label><select id="airgLight">${opt(Object.keys(this.LIGHT),s.light)}</select>
        <label>Time of day</label><select id="airgTime">${opt(Object.keys(this.TIME),s.time)}</select>

        <label>Shape</label><select id="airgOrientation">${opt(Object.keys(this.SIZES),s.orientation)}</select>
        <label>Quality</label><select id="airgQuality">${opt(['low','medium','high'],s.quality)}</select>

        <label>Anything else</label>
        <textarea id="airgNotes" rows="3" placeholder="e.g. a leather sofa below, plants, brick wall">${sf.esc(s.notes)}</textarea>

        <button class="button primary" id="airgGo" ${ready?'':'disabled'} style="width:100%;margin-top:12px">
          ${this.busy?'Generating…':'Generate room'}</button>
        <div class="help">${this.keyConfigured
          ? `About <b>$${cost.toFixed(3)}</b> per render, plus a little for the uploaded artwork. Can take up to two minutes.`
          : 'Connect an OpenAI account below before generating.'}</div>

        <div class="airg-key">
          <b>OpenAI</b>
          <div class="help">${this.keyConfigured?'A key is saved and encrypted on this computer.':'No key saved. Paste an API key from platform.openai.com. GPT Image also requires organisation verification on your OpenAI account.'}</div>
          ${this.keyConfigured
            ? `<button class="button secondary" id="airgClearKey">Remove key</button>`
            : `<input id="airgKey" type="password" placeholder="sk-...">
               <div class="row-actions"><button class="button secondary" id="airgPaste">Paste</button>
               <button class="button secondary" id="airgSaveKey">Save key</button></div>`}
        </div>
      </aside>

      <section class="card airg-stage">
        ${this.busy?`<div class="airg-progress"><div class="airg-bar"></div>
            <p class="muted">Rendering the room. This can take up to two minutes.</p></div>`:''}
        ${this.lastError?`<div class="notice airg-error"><b>OpenAI could not complete that.</b>
            <p>${sf.esc(this.lastError.error||'')}</p>
            ${this.lastError.code?`<p class="muted">Code: ${sf.esc(this.lastError.code)}${this.lastError.requestId?` · request ${sf.esc(this.lastError.requestId)}`:''}</p>`:''}
            ${this.lastError.raw?`<details><summary>Full response</summary><pre>${sf.esc(this.lastError.raw)}</pre></details>`:''}
          </div>`:''}
        ${this.result&&!this.result.usedReference?`<div class="notice airg-error"><b>This render does not contain your photograph.</b>
            <p>It went out with no reference image, so the picture on the wall is the model's invention. Don't use it as a mockup.</p></div>`:''}
        ${this.result?`<img class="airg-image" src="${this.result.dataUrl}" alt="Generated room">
          <div class="row-actions" style="margin-top:10px">
            <a class="button primary" id="airgSave" download="${sf.esc(this.suggestedFilename())}" href="${this.result.dataUrl}">Save image</a>
            <button class="button secondary" id="airgAgain">Generate another</button>
          </div>
          <p class="muted">${sf.esc(this.result.model)} · ${sf.esc(this.result.size)} · ${sf.esc(this.result.quality)}${this.result.usedReference?' · your artwork was uploaded as the reference':''} · ${Math.round((this.result.ms||0)/1000)}s</p>`
          :(this.busy?'':`<div class="empty-state roomy">
            <p>Nothing generated yet.</p>
            <p class="muted">Choose an artwork and a room on the left, then Generate.</p>
          </div>`)}
      </section>
    </div>

    <details class="card"><summary><b>The prompt being sent</b></summary>
      <pre class="airg-prompt">${sf.esc(this.buildPrompt())}</pre>
      <button class="button secondary" id="airgCopy">Copy prompt</button>
    </details></div>`;

    this.bind();
  },

  suggestedFilename(){
    const bits=[this.artworkLabel()||'room',this.state.collection,this.state.room]
      .join('-').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
    return `${bits}.png`;
  },

  bind(){
    const sf=window.SF,s=this.state;
    const on=(id,fn)=>{const el=sf.$(id);if(el)el.onchange=fn;};
    on('airgArt',e=>{s.artworkId=e.target.value;s.externalImage='';s.externalName='';this.render();});
    on('airgCollection',e=>{s.collection=e.target.value;this.render();});
    on('airgRoom',e=>{s.room=e.target.value;this.render();});
    on('airgMedium',e=>{s.medium=e.target.value;this.render();});
    on('airgFrame',e=>{s.frame=e.target.value;this.render();});
    on('airgLight',e=>{s.light=e.target.value;this.render();});
    on('airgTime',e=>{s.time=e.target.value;this.render();});
    on('airgOrientation',e=>{s.orientation=e.target.value;this.render();});
    on('airgQuality',e=>{s.quality=e.target.value;this.render();});
    // Typed fields update in place -- re-rendering on every keystroke would steal focus, which is
    // the same bug g65/g67 chased through the sales register.
    const size=sf.$('airgSize'); if(size)size.oninput=e=>{s.printSize=e.target.value;};
    const notes=sf.$('airgNotes'); if(notes)notes.oninput=e=>{s.notes=e.target.value;};

    const browse=sf.$('airgBrowse');
    if(browse)browse.onclick=async()=>{
      const files=await sf.api.openImages?.();
      const f=files&&files[0];
      if(!f)return;
      s.externalImage=f.data||f.dataUrl||f.url||f.path||'';
      s.externalName=f.name||f.filename||'External file';
      s.artworkId='';
      this.render();
    };
    /* g88: right-click and Ctrl+V are fixed app-wide in main.js, but a key is the one thing
       that must go in on the first try, so read the clipboard directly as well. */
    const paste=sf.$('airgPaste');
    if(paste)paste.onclick=async()=>{
      try{
        const t=(await navigator.clipboard.readText()||'').trim();
        if(!t){paste.textContent='Clipboard empty';return;}
        sf.$('airgKey').value=t;
        paste.textContent='Pasted ✓';
      }catch(e){ paste.textContent='Blocked — use Ctrl+V'; }
    };
    const saveKey=sf.$('airgSaveKey');
    if(saveKey)saveKey.onclick=async()=>{
      const v=String(sf.$('airgKey').value||'').trim();
      if(!v)return;
      const r=await sf.api.aiSaveKey({apiKey:v});
      if(!r||!r.ok){alert((r&&r.error)||'The key could not be saved.');return;}
      await this.refreshKey();this.render();
    };
    const clearKey=sf.$('airgClearKey');
    if(clearKey)clearKey.onclick=async()=>{
      await sf.api.aiClearKey();await this.refreshKey();this.render();
    };
    const copy=sf.$('airgCopy');
    if(copy)copy.onclick=()=>{navigator.clipboard.writeText(this.buildPrompt());copy.textContent='Copied ✓';};
    const go=sf.$('airgGo'); if(go)go.onclick=()=>this.generate();
    const again=sf.$('airgAgain'); if(again)again.onclick=()=>this.generate();
  },

  async generate(){
    if(this.busy)return;
    const ref=this.artworkSource();
    if(!ref){alert('Choose an artwork first — it is uploaded with the request so the render contains your real photograph.');return;}
    this.busy=true;this.lastError=null;this.render();
    let r;
    try{
      r=await window.SF.api.aiGenerateRoom({
        prompt:this.buildPrompt(),referenceImage:ref,
        model:'gpt-image-2',size:this.sizeValue(),quality:this.state.quality
      });
    }catch(e){ r={ok:false,error:String(e&&e.message||e)}; }
    this.busy=false;
    if(r&&r.ok){ this.result=r; this.lastError=null; }
    else{ this.lastError=r||{error:'No response from the generator.'}; }
    this.render();
  }
};

// The page map in core.js captured this object at load time, so render() has to exist by then;
// the key status is asynchronous, so fetch it once and repaint when it lands.
(function(){
  const G=window.SFAIRoomGenerator, origRender=G.render;
  let asked=false;
  G.render=function(){
    if(!asked){
      asked=true;
      this.refreshKey().then(()=>origRender.call(this)).catch(()=>origRender.call(this));
      return;
    }
    return origRender.call(this);
  };
})();
