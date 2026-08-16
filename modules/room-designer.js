
window.SFRoomDesigner = {
  model:{
    projectId:'',artworkId:'',sceneId:'',medium:'Framed Print',canvasFrame:'none',floatGap:.5,mode:'place',
    imageWidth:25,imageHeight:17,matWidth:3.5,frameWidth:1.5,depth:1.5,wrapEdge:'mirror',wrapColor:'#111111',
    frameColor:'black-wood',frameProfile:'gallery-flat',matColor:'warm white',artTemperature:0,artTint:0,artBrightness:100,artContrast:100,artSaturation:100,frameStyle:'simple contemporary',shadowDirection:'auto',shadowSpread:'tight',shadowOpacity:28,shadowBlur:3,shadowSize:100,shadowWidth:100,shadowHeight:100,shadowOffsetX:0,shadowOffsetY:2,mountGap:15,contactOpacity:45,contactScale:82,contactBlur:1.2,contactOffsetX:0,contactOffsetY:0,innerShadowOpacity:20,innerShadowBlur:3.5,ambientBounce:true,wallColorBleed:true,glassReflection:true,rotation:0,perspectiveX:0,perspectiveY:0,scale:1,physicalScale:1,showBackground:true,showLighting:true,showShadow:true,showArtwork:true,showForeground:true,showMeasurements:true,x:null,y:null,showSafe:false,snap:true,locked:false,zoom:1,externalImage:'',externalName:'',
    undo:[],redo:[]
  },

  art(){const m=this.model; if(m.externalImage)return {id:'external',artworkId:'external',title:m.externalName||'External artwork',image:m.externalImage,orientation:m.imageWidth>=m.imageHeight?'Landscape':'Portrait'}; return this.artworkCatalog().find(a=>(a.id||a.artworkId)===m.artworkId)||null},
  scene(){return this.sceneCatalog().find(s=>s.id===this.model.sceneId)||null},
  artworkCatalog(){
    const sf=window.SF, own=sf.state.artworks||[]; let web=[];
    try{web=JSON.parse(localStorage.getItem('fmpGalleryManager')||'{}').artworks||[]}catch(e){}
    const map=new Map();
    [...own,...web].forEach(a=>{
      const image=a.image||a.thumbnail||a.imageData||String(a.imageUrls||'').split(/\s+/)[0]||'';
      const title=String(a.title||a.name||'Untitled').trim();
      const key=(title+'|'+image).toLowerCase();
      if(!map.has(key)) map.set(key,{...a,id:a.id||a.artworkId||key,artworkId:a.artworkId||a.id||key,title,image});
    });
    return [...map.values()].sort((a,b)=>String(a.title).localeCompare(String(b.title)));
  },
  sceneCatalog(){
    const map=new Map();
    (window.SF.state.scenes||[]).forEach(s=>{
      const image=s.backgroundLayer||s.image||'';
      const name=s.displayName||s.name||s.roomType||s.room||'Room';
      const key=(name+'|'+image).toLowerCase();
      if(!map.has(key)) map.set(key,s);
    });
    return [...map.values()];
  },

  render(){
    const previousPresentationScroll=document.querySelector('.rd-presentation-panel')?.scrollTop ?? this._presentationPanelScroll ?? 0;
    const sf=window.SF, m=this.model, art=this.art(), scene=this.scene();
    if(scene && (m.x===null||m.y===null)){
      m.x=scene.wallCenterX ?? (((scene.calibration?.wallLeft ?? 0)+(scene.calibration?.wallRight ?? 100))/2);
      m.y=scene.wallCenterY ?? (((scene.calibration?.wallTop ?? 0)+(scene.calibration?.wallBottom ?? 90))/2);
    }
    if(art){
      if(art.orientation==='Portrait'&&m.imageWidth>m.imageHeight)[m.imageWidth,m.imageHeight]=[m.imageHeight,m.imageWidth];
      if(['Landscape','Panoramic'].includes(art.orientation)&&m.imageWidth<m.imageHeight)[m.imageWidth,m.imageHeight]=[m.imageHeight,m.imageWidth];
    }

    sf.$('workspace').innerHTML=`
    <div class="designer-shell">
      <aside class="designer-panel card rd-left-tools">
        <h2>Room Designer</h2>
        <label>Artwork</label>
        <select id="rdArtwork"><option value="">Choose artwork</option>${this.artworkCatalog().map(a=>{const key=a.id||a.artworkId;return `<option value="${key}" ${key===m.artworkId?'selected':''}>${sf.esc(a.title)}</option>`}).join('')}</select>
        <button class="button secondary" id="rdBrowseArtwork" style="margin-top:8px;width:100%">Choose outside file…</button>
        <div class="help">${m.externalName?`External: ${sf.esc(m.externalName)}`:'Choose from StudioFlow or browse your computer.'}</div>

        ${this.scenePickerHtml()}
        <div class="room-library-summary"><b>Room Library</b><span>${this.sceneCatalog().filter(s=>s.inLibrary||s.calibrated).length} reusable calibrated rooms</span><button class="button secondary" id="rdSaveRoomLibrary" ${scene?'':'disabled'}>${scene?.inLibrary?'Saved in Library':'Save Selected Room to Library'}</button></div>
        <div class="help">${this.wallModeNote()}</div>


        <h3>Artwork Blend</h3><div class="rd-blend-tools"><label>Temperature</label><input id="rdTemperature" type="range" min="-30" max="30" step="1" value="${m.artTemperature||0}"><label>Tint</label><input id="rdTint" type="range" min="-30" max="30" step="1" value="${m.artTint||0}"><label>Brightness</label><input id="rdBrightness" type="range" min="60" max="140" value="${m.artBrightness||100}"><label>Contrast</label><input id="rdContrast" type="range" min="60" max="140" value="${m.artContrast||100}"><label>Saturation</label><input id="rdSaturation" type="range" min="50" max="130" value="${m.artSaturation||100}"><button class="button secondary" id="rdMatchRoom" type="button">Match Room Lighting</button><button class="button secondary" id="rdResetBlend" type="button">Reset Blend</button></div><div class="help" id="rdMatchInfo"></div>
        <h3>Placement</h3>
        <label class="check-row"><input id="rdSnap" type="checkbox" ${m.snap?'checked':''}> Snap to display centre</label>
        <label class="check-row"><input id="rdLock" type="checkbox" ${m.locked?'checked':''}> Lock artwork position</label>
        <div class="nudge-pad" aria-label="Nudge artwork"><button type="button" data-nudge="0,-1">↑</button><button type="button" data-nudge="-1,0">←</button><button type="button" data-nudge="1,0">→</button><button type="button" data-nudge="0,1">↓</button></div>
        <div class="row-actions">
          <button class="button secondary" id="rdCenter">Centre Artwork</button><button class="button secondary" id="rdResetPlacement">Reset Placement</button><button class="button secondary" id="rdFitWall">Fit Artwork to Wall View</button>
          <button class="button secondary" id="rdUndo" ${m.undo.length?'':'disabled'}>Undo</button><button class="button secondary" id="rdRedo" ${m.redo.length?'':'disabled'}>Redo</button>
        </div>
      </aside>

      <section class="designer-stage card rd-main-stage">
        <div class="designer-toolbar sf-topbar">
          <div class="sf-scene-title"><button class="button secondary" id="rdBackScenes">‹ Back to Scenes</button><span>${art?sf.esc(art.title):'Select artwork'}</span></div>
          <div class="sf-wall-readout">${scene&&scene.wallWidth?`Wall: ${Number(scene.wallWidth).toFixed(0)}\" wide`:''}${art?` &nbsp;|&nbsp; Total: ${this.finishedSize().w.toFixed(1)}\" × ${this.finishedSize().h.toFixed(1)}\"`:''}</div>
          <div class="mode-switch"><button class="button ${m.mode==='place'?'primary':'secondary'}" id="rdPlaceMode">Placement</button><button class="button ${m.mode==='preview'?'primary':'secondary'}" id="rdPreviewMode">Preview</button></div>
        </div>
        <div class="stage-viewport">
          <div id="rdRoom" class="rd-room" style="transform:scale(${m.zoom})">
            ${scene?.backgroundLayer||scene?.image?`<img class="rd-scene-image rd-background-layer sf-fit-room" src="${scene.backgroundLayer||scene.image}">`:'<div class="rd-placeholder"><b>Attach a calibrated room image in Scene Packs</b><span>The placement engine can still be tested here.</span></div>'}
            <div id="rdLightingLayer">${scene?.lightingOverlay?`<img src="${scene.lightingOverlay}">`:''}</div><div id="rdSafeZone"></div><div id="rdRulerLayer"></div><div id="rdArtworkLayer"></div>
            <div id="rdForegroundLayer">${(scene?.foregroundLayers||[]).filter(x=>x.enabled!==false).sort((a,b)=>(a.z||0)-(b.z||0)).map(x=>`<img class="rd-foreground-object" src="${x.src}" data-layer="${sf.esc(x.name||x.id)}">`).join('')}</div>
          </div>
        </div>
        <div class="zoom-row"><button class="button secondary" id="rdZoomOut" type="button">−</button><span>Zoom</span><input id="rdZoom" type="range" min=".45" max="2" step=".05" value="${m.zoom}"><b>${Math.round(m.zoom*100)}%</b><button class="button secondary" id="rdZoomIn" type="button">+</button><button class="button secondary" id="rdZoomReset" type="button">100%</button></div>
      </section>

      <section class="designer-panel card rd-presentation-panel">
        <h3>Presentation</h3>
        <label>Medium</label><select id="rdMedium">${['Framed Print','Canvas','Metal Print'].map(x=>`<option ${x===m.medium?'selected':''}>${x}</option>`).join('')}</select>
        ${m.medium==='Canvas'?`<label>Canvas Frame</label><select id="rdCanvasFrame"><option value="none" ${m.canvasFrame==='none'?'selected':''}>No Frame</option><option value="floating" ${m.canvasFrame==='floating'?'selected':''}>Floating Frame</option></select><label>Wrapped Edge <small class="muted">\u2014 what the sides of the canvas show</small></label><select id="rdWrapEdge">${[['mirror','Mirrored image (gallery wrap)'],['black','Black'],['white','White'],['custom','A colour I choose']].map(x=>`<option value="${x[0]}" ${(m.wrapEdge||'mirror')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select>${(m.wrapEdge||'mirror')==='custom'?`<div class="grid2"><div><label>Edge colour</label><input id="rdWrapColor" type="color" value="${m.wrapColor||'#111111'}"></div><div><label>&nbsp;</label><div class="rd-swatch-row">${['#111111','#f2f0ec','#6b5b4a','#2f4858','#7a2f2f','#3f5d3a'].map(c=>`<button type="button" class="rd-swatch ${(m.wrapColor||'').toLowerCase()===c?'active':''}" data-wrap-swatch="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div></div></div>`:''}<div class="help">The sides only show once the piece is tilted \u2014 square on to a wall you cannot see them, which is exactly how a real canvas behaves.</div>${'' }<label class="rd-diag-line" title="A diagnostic — paints the four side faces solid magenta so you can see whether they are drawn at all"><input type="checkbox" id="rdShowEdges" ${window.SFRD_SHOW_EDGES?'checked':''}> <span>Highlight the edges (diagnostic)</span></label>${m.canvasFrame==='floating'?`<label>Floating Gap</label><input id="rdFloatGap" type="number" min=".125" step=".125" value="${m.floatGap}">`:''}`:''}
        <div class="grid2">
          <div><label>Image Width</label><div class="dimension-control"><button type="button" data-dim="width" data-delta="-1">−</button><input id="rdWidth" type="text" inputmode="decimal" value="${m.imageWidth}"><button type="button" data-dim="width" data-delta="1">+</button></div></div>
          <div><label>Image Height</label><div class="dimension-control"><button type="button" data-dim="height" data-delta="-1">−</button><input id="rdHeight" type="text" inputmode="decimal" value="${m.imageHeight}"><button type="button" data-dim="height" data-delta="1">+</button></div></div>
          <div><label>Mat Width</label><input id="rdMat" type="number" min="0" step=".25" value="${m.matWidth}"></div><div><label>Frame Width</label><input id="rdFrame" type="number" min="0" step=".25" value="${m.frameWidth}"></div>
          <div><label>Product Depth</label><input id="rdDepth" type="number" min=".1" step=".25" value="${m.depth}"></div><div><label>Frame Profile</label><select id="rdFrameProfile">${(window.SFFrameLibrary?.profiles||[]).filter(p=>m.medium!=='Canvas'||p.category==='floating').map(p=>`<option value="${p.id}" ${p.id===(m.frameProfile||'gallery-flat')?'selected':''}>${p.name}</option>`).join('')}</select></div></div><label>Frame Material</label><div class="rd-frame-library-tools"><input id="rdFrameSearch" type="search" placeholder="Search frames…" aria-label="Search frames"><div class="rd-frame-filter" role="group" aria-label="Frame categories"><button type="button" class="selected" data-frame-filter="all">All</button><button type="button" data-frame-filter="wood">Wood</button><button type="button" data-frame-filter="metal">Metal</button></div></div><div class="rd-material-browser">${(window.SFFrameLibrary?.materials||[]).filter(x=>m.medium!=='Canvas'||x.category==='wood').map(x=>`<button type="button" class="rd-material-card ${x.id===m.frameColor?'selected':''}" data-frame-material="${x.id}" data-frame-category="${x.category}" data-frame-name="${x.name.toLowerCase()}" title="${x.name}"><span class="rd-frame-corner-preview"><img src="${x.asset}" alt="${x.name} frame corner"></span><span class="rd-frame-card-name">${x.name}</span></button>`).join('')}</div><select id="rdColor" class="hidden">${(window.SFFrameLibrary?.materials||[]).map(x=>`<option value="${x.id}" ${x.id===m.frameColor?'selected':''}>${x.name}</option>`).join('')}</select><div class="grid2">
          ${m.medium==='Framed Print'?`<div class="rd-mat-colour-control"><label>Mat Colour</label><select id="rdMatColor">${(window.SFFrameLibrary?.mats||[]).map(x=>`<option value="${x.name.toLowerCase()}" ${m.matColor===x.name.toLowerCase()?'selected':''}>${x.name}</option>`).join('')}</select></div>`:''}
        </div>
        <h3>Transform</h3><div class="grid2"><div><label>Physical Scale</label><input id="rdScale" type="range" min="0.25" max="2" step="0.01" value="${Number(m.physicalScale??m.scale??1)}"><small id="rdScaleValue">${Math.round(Number(m.physicalScale??m.scale??1)*100)}%</small></div><div><label>Rotation</label><input id="rdRotation" type="range" min="-15" max="15" step="0.1" value="${m.rotation}"><small>${Number(m.rotation).toFixed(1)}°</small></div><div><label>Perspective X</label><input id="rdPerspectiveX" type="range" min="-35" max="35" step="1" value="${m.perspectiveX}"></div><div><label>Perspective Y</label><input id="rdPerspectiveY" type="range" min="-35" max="35" step="1" value="${m.perspectiveY}"></div></div><button class="button secondary" id="rdResetTransform">Reset Transform</button><h3>Scene Lighting</h3>${scene?`<div class="lighting-readout"><span>Saved room direction</span><b>${sf.esc(scene.lightDirection||'left')}</b><span>Angle</span><b>${scene.lightAngle??35}°</b><span>Softness</span><b>${scene.shadowSoftness??72}%</b></div><label>Light source (viewer perspective)</label><select id="rdShadowDirection"><option value="auto" ${m.shadowDirection==='auto'?'selected':''}>Automatic from room</option><option value="left" ${m.shadowDirection==='left'?'selected':''}>Light from viewer left</option><option value="right" ${m.shadowDirection==='right'?'selected':''}>Light from viewer right</option><option value="top-left" ${m.shadowDirection==='top-left'?'selected':''}>Light from upper left</option><option value="top-right" ${m.shadowDirection==='top-right'?'selected':''}>Light from upper right</option></select><div class="help">The shadow falls away from the selected light source.</div><label>Shadow spread</label><select id="rdShadowSpread"><option value="tight" ${m.shadowSpread==='tight'?'selected':''}>Tight · wall mounted</option><option value="soft" ${m.shadowSpread==='soft'?'selected':''}>Slightly softer</option></select><div class="grid2"><div><label>Opacity</label><input id="rdShadowOpacity" type="range" min="0" max="100" value="${m.shadowOpacity}"></div><div><label>Shadow Width</label><div class="rd-range-stepper"><button type="button" class="rd-range-nudge" data-range-target="rdShadowWidth" data-range-delta="-1" aria-label="Decrease shadow width">−</button><input id="rdShadowWidth" type="range" min="0" max="200" step="1" value="${m.shadowWidth??m.shadowSize??100}"><button type="button" class="rd-range-nudge" data-range-target="rdShadowWidth" data-range-delta="1" aria-label="Increase shadow width">+</button></div><small id="rdShadowWidthValue">${Math.round(m.shadowWidth??m.shadowSize??100)}%</small></div><div><label>Shadow Height</label><div class="rd-range-stepper"><button type="button" class="rd-range-nudge" data-range-target="rdShadowHeight" data-range-delta="-1" aria-label="Decrease shadow height">−</button><input id="rdShadowHeight" type="range" min="0" max="200" step="1" value="${m.shadowHeight??m.shadowSize??100}"><button type="button" class="rd-range-nudge" data-range-target="rdShadowHeight" data-range-delta="1" aria-label="Increase shadow height">+</button></div><small id="rdShadowHeightValue">${Math.round(m.shadowHeight??m.shadowSize??100)}%</small></div><div><label>Blur</label><input id="rdShadowBlur" type="range" min="0" max="20" step="0.5" value="${m.shadowBlur}"><small id="rdShadowBlurValue">${Number(m.shadowBlur||0).toFixed(1)}</small></div><div><label>Offset X</label><input id="rdShadowOffsetX" type="range" min="-30" max="30" value="${m.shadowOffsetX}"></div><div><label>Offset Y</label><input id="rdShadowOffsetY" type="range" min="-30" max="30" value="${m.shadowOffsetY}"></div></div>`:'<div class="help">Select a scene to load its lighting profile.</div>'}
        <h3>Depth & Mounting</h3>
        <div class="grid2 rd-depth-controls">
          <div><label>Mount Gap</label><input id="rdMountGap" type="range" min="0" max="30" value="${m.mountGap??15}"><small>${m.mountGap??15} mm</small></div>
          <div><label>Product Depth</label><input id="rdProductDepth" type="range" min="2" max="50" value="${Math.round((m.depth||1.5)*25.4)}"><small>${Math.round((m.depth||1.5)*25.4)} mm</small></div>
          <div class="rd-shadow-control-group rd-contact-controls"><h4>Contact Shadow</h4>
            <label>Opacity <small id="rdContactOpacityValue">${m.contactOpacity??45}%</small></label><input id="rdContactOpacity" type="range" min="0" max="100" value="${m.contactOpacity??45}">
            <label>Size <small id="rdContactScaleValue">${m.contactScale??82}%</small></label><input id="rdContactScale" type="range" min="50" max="110" step="1" value="${m.contactScale??82}">
            <label>Blur <small id="rdContactBlurValue">${Number(m.contactBlur??1.2).toFixed(1)}</small></label><input id="rdContactBlur" type="range" min="0" max="6" step="0.1" value="${m.contactBlur??1.2}">
            <label>Offset X <small id="rdContactOffsetXValue">${m.contactOffsetX??0}</small></label><input id="rdContactOffsetX" type="range" min="-12" max="12" step="0.5" value="${m.contactOffsetX??0}">
            <label>Offset Y <small id="rdContactOffsetYValue">${m.contactOffsetY??0}</small></label><input id="rdContactOffsetY" type="range" min="-12" max="12" step="0.5" value="${m.contactOffsetY??0}">
          </div>
          <div class="rd-shadow-control-group rd-inner-controls"><h4>Inner Shadow</h4>
            <label>Opacity <small id="rdInnerShadowOpacityValue">${m.innerShadowOpacity??20}%</small></label><input id="rdInnerShadowOpacity" type="range" min="0" max="100" value="${m.innerShadowOpacity??20}">
            <label>Blur <small id="rdInnerShadowBlurValue">${Number(m.innerShadowBlur??3.5).toFixed(1)}</small></label><input id="rdInnerShadowBlur" type="range" min="0" max="12" step="0.1" value="${m.innerShadowBlur??3.5}">
          </div>
        </div>
        <label class="check-row"><input id="rdAmbientBounce" type="checkbox" ${m.ambientBounce!==false?'checked':''}> Ambient bounce</label>
        <label class="check-row"><input id="rdWallColorBleed" type="checkbox" ${m.wallColorBleed!==false?'checked':''}> Wall colour bleed</label>${m.medium==='Framed Print'?`<label class="check-row"><input id="rdGlassReflection" type="checkbox" ${m.glassReflection!==false?'checked':''}> Subtle glass reflection</label>`:''}
        <h3>Layer Stack</h3><div class="rd-layer-stack">${[['showMeasurements','Measurements'],['showForeground','Foreground'],['showArtwork','Artwork / Frame / Mat'],['showShadow','Shadow'],['showLighting','Lighting'],['showBackground','Room']].map(([key,label])=>`<label><input type="checkbox" data-layer-toggle="${key}" ${m[key]?'checked':''}><span>${label}</span></label>`).join('')}</div>
        <label class="check-row rd-measure-toggle"><input id="rdShowMeasurements" type="checkbox" ${m.showMeasurements!==false?'checked':''}> Show width and height measurements</label>
        <h3>Physical Scale</h3><div id="rdScaleReadout" class="help"></div>
        <div class="row-actions rd-render-actions"><button class="button primary" id="rdRenderPresentation">Render Presentation</button><button class="button secondary" id="rdSaveProject">${m.projectId?'Update Room Project':'Save Room Project'}</button><button class="button secondary" id="rdOpenProjects">Saved Projects</button><button class="button secondary" id="rdExportProject">Export Project File</button></div>
      </section>
    </div>`;
    this.bind();requestAnimationFrame(()=>{const panel=document.querySelector('.rd-presentation-panel');if(panel){panel.scrollTop=previousPresentationScroll;this._presentationPanelScroll=previousPresentationScroll;}this.draw();});
  },
  bind(){
    const sf=window.SF, m=this.model;
    sf.$('rdArtwork').addEventListener('change',e=>{this.checkpoint();m.externalImage='';m.externalName='';m.artworkId=e.target.value;this.render()});if(sf.$('rdBrowseArtwork'))sf.$('rdBrowseArtwork').onclick=async()=>{const files=await sf.api.openImages?.();const f=files?.[0];if(!f)return;this.checkpoint();m.externalImage=f.data||f.dataUrl||f.url||'';m.externalName=f.name||f.filename||'External artwork';m.artworkId='';this.render()};
    sf.$('rdScene').addEventListener('change',e=>{this.checkpoint();m.sceneId=e.target.value;const s=this.scene();
      m.x=s?.wallCenterX ?? (((s?.calibration?.wallLeft ?? 0)+(s?.calibration?.wallRight ?? 100))/2);
      m.y=s?.wallCenterY ?? (((s?.calibration?.wallTop ?? 0)+(s?.calibration?.wallBottom ?? 90))/2);
      this.render()});
    ['rdScale','rdRotation','rdPerspectiveX','rdPerspectiveY','rdShadowOpacity','rdShadowWidth','rdShadowHeight','rdShadowBlur','rdShadowOffsetX','rdShadowOffsetY','rdTemperature','rdTint','rdBrightness','rdContrast','rdSaturation','rdMountGap','rdProductDepth','rdContactOpacity','rdContactScale','rdContactBlur','rdContactOffsetX','rdContactOffsetY','rdInnerShadowOpacity','rdInnerShadowBlur'].forEach(id=>{const el=sf.$(id);if(el)el.oninput=e=>{const map={rdScale:'scale',rdRotation:'rotation',rdPerspectiveX:'perspectiveX',rdPerspectiveY:'perspectiveY',rdShadowOpacity:'shadowOpacity',rdShadowWidth:'shadowWidth',rdShadowHeight:'shadowHeight',rdShadowBlur:'shadowBlur',rdShadowOffsetX:'shadowOffsetX',rdShadowOffsetY:'shadowOffsetY',rdTemperature:'artTemperature',rdTint:'artTint',rdBrightness:'artBrightness',rdContrast:'artContrast',rdSaturation:'artSaturation',rdMountGap:'mountGap',rdProductDepth:'productDepthMm',rdContactOpacity:'contactOpacity',rdContactScale:'contactScale',rdContactBlur:'contactBlur',rdContactOffsetX:'contactOffsetX',rdContactOffsetY:'contactOffsetY',rdInnerShadowOpacity:'innerShadowOpacity',rdInnerShadowBlur:'innerShadowBlur'};m[map[id]]=+e.target.value;if(id==='rdScale'){m.physicalScale=+e.target.value;m.scale=m.physicalScale;if(sf.$('rdScaleValue'))sf.$('rdScaleValue').textContent=`${Math.round(m.physicalScale*100)}%`}if(id==='rdProductDepth')m.depth=(+e.target.value)/25.4;if(id==='rdShadowWidth'&&sf.$('rdShadowWidthValue'))sf.$('rdShadowWidthValue').textContent=`${Math.round(m.shadowWidth)}%`;if(id==='rdShadowHeight'&&sf.$('rdShadowHeightValue'))sf.$('rdShadowHeightValue').textContent=`${Math.round(m.shadowHeight)}%`;if(id==='rdShadowBlur'&&sf.$('rdShadowBlurValue'))sf.$('rdShadowBlurValue').textContent=Number(m.shadowBlur).toFixed(1);if(id==='rdContactOpacity'&&sf.$('rdContactOpacityValue'))sf.$('rdContactOpacityValue').textContent=`${Math.round(m.contactOpacity)}%`;if(id==='rdContactScale'&&sf.$('rdContactScaleValue'))sf.$('rdContactScaleValue').textContent=`${Math.round(m.contactScale)}%`;if(id==='rdContactBlur'&&sf.$('rdContactBlurValue'))sf.$('rdContactBlurValue').textContent=Number(m.contactBlur).toFixed(1);if(id==='rdContactOffsetX'&&sf.$('rdContactOffsetXValue'))sf.$('rdContactOffsetXValue').textContent=Number(m.contactOffsetX).toFixed(1);if(id==='rdContactOffsetY'&&sf.$('rdContactOffsetYValue'))sf.$('rdContactOffsetYValue').textContent=Number(m.contactOffsetY).toFixed(1);if(id==='rdInnerShadowOpacity'&&sf.$('rdInnerShadowOpacityValue'))sf.$('rdInnerShadowOpacityValue').textContent=`${Math.round(m.innerShadowOpacity)}%`;if(id==='rdInnerShadowBlur'&&sf.$('rdInnerShadowBlurValue'))sf.$('rdInnerShadowBlurValue').textContent=Number(m.innerShadowBlur).toFixed(1);this.draw();const wallReadout=document.querySelector('.sf-wall-readout');if(wallReadout){const scene=this.scene(),art=this.art(),f=this.finishedSize();wallReadout.innerHTML=`${scene&&scene.wallWidth?`Wall: ${Number(scene.wallWidth).toFixed(0)}\" wide`:''}${art?` &nbsp;|&nbsp; Total: ${f.w.toFixed(1)}\" × ${f.h.toFixed(1)}\"`:''}`}}});document.querySelectorAll('.rd-range-nudge').forEach(btn=>btn.onclick=()=>{const target=sf.$(btn.dataset.rangeTarget);if(!target)return;const delta=Number(btn.dataset.rangeDelta||0);const min=Number(target.min||0),max=Number(target.max||100),step=Number(target.step||1);const next=Math.max(min,Math.min(max,Number(target.value||0)+delta*step));target.value=String(next);target.dispatchEvent(new Event('input',{bubbles:true}));});if(sf.$('rdResetTransform'))sf.$('rdResetTransform').onclick=()=>{this.checkpoint();Object.assign(m,{scale:1,physicalScale:1,rotation:0,perspectiveX:0,perspectiveY:0});this.render()};document.querySelectorAll('[data-layer-toggle]').forEach(el=>el.onchange=e=>{m[e.target.dataset.layerToggle]=e.target.checked;this.draw()});if(sf.$('rdExportProject'))sf.$('rdExportProject').onclick=()=>this.exportProject();
    sf.$('rdMedium').addEventListener('change',e=>{this.checkpoint();m.medium=e.target.value;this.render()});
    if(sf.$('rdCanvasFrame'))sf.$('rdCanvasFrame').addEventListener('change',e=>{this.checkpoint();m.canvasFrame=e.target.value;this.render()});
    /* g207 — THE DIAGNOSTIC NEEDED A CONTROL, NOT A CONSOLE. I told Kirk to press F12; this window
       hides its menu bar, so nothing happened, and asking a photographer to find developer tools to
       answer MY question was the wrong shape of request in the first place. The toggle lives where
       the thing it diagnoses lives. */
    if(sf.$('rdShowEdges'))sf.$('rdShowEdges').addEventListener('change',e=>{
      window.SFRD_SHOW_EDGES=!!e.target.checked; this.draw();
    });
    if(sf.$('rdFloatGap'))sf.$('rdFloatGap').addEventListener('change',e=>{this.checkpoint();m.floatGap=Math.max(.125,+e.target.value||.5);this.render()});
    const commitDimension=(id,key,min=0)=>{
      const input=sf.$(id);
      const apply=()=>{
        const value=Number(String(input.value).replace(/[^0-9.]/g,''));
        if(!Number.isFinite(value)||value<min){input.value=m[key];return}
        m[key]=value;
        input.value=value;
        this.draw();
      };
      input.addEventListener('focus',()=>input.select());
      input.addEventListener('keydown',e=>{
        if(e.key==='Enter'){e.preventDefault();apply();input.blur()}
      });
      input.addEventListener('blur',apply);
    };
    commitDimension('rdWidth','imageWidth',1);
    commitDimension('rdHeight','imageHeight',1);
    commitDimension('rdMat','matWidth',0);
    commitDimension('rdFrame','frameWidth',0);
    commitDimension('rdDepth','depth',.1);
    document.querySelectorAll('[data-dim]').forEach(button=>button.addEventListener('click',()=>{
      this.checkpoint();
      const key=button.dataset.dim==='width'?'imageWidth':'imageHeight';
      m[key]=Math.max(1,Number(m[key]) + Number(button.dataset.delta));
      this.render();
    }));
    sf.$('rdColor').addEventListener('change',e=>{this.checkpoint();m.frameColor=e.target.value;this.render()});document.querySelectorAll('[data-frame-material]').forEach(b=>b.onclick=()=>{const browser=document.querySelector('.rd-material-browser');const panel=document.querySelector('.rd-presentation-panel');this._frameBrowserScroll=browser?.scrollTop||0;this._presentationPanelScroll=panel?.scrollTop||0;this.checkpoint();m.frameColor=b.dataset.frameMaterial;this.render();requestAnimationFrame(()=>{const next=document.querySelector('.rd-material-browser');const nextPanel=document.querySelector('.rd-presentation-panel');if(next)next.scrollTop=this._frameBrowserScroll||0;if(nextPanel)nextPanel.scrollTop=this._presentationPanelScroll||0;});});const applyFrameLibraryFilter=()=>{const q=String(sf.$('rdFrameSearch')?.value||'').trim().toLowerCase();const active=document.querySelector('[data-frame-filter].selected')?.dataset.frameFilter||'all';document.querySelectorAll('[data-frame-material]').forEach(card=>{const category=card.dataset.frameCategory||'';const name=card.dataset.frameName||'';card.hidden=!((active==='all'||category===active)&&(!q||name.includes(q)))})};if(sf.$('rdFrameSearch'))sf.$('rdFrameSearch').addEventListener('input',applyFrameLibraryFilter);document.querySelectorAll('[data-frame-filter]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-frame-filter]').forEach(x=>x.classList.remove('selected'));button.classList.add('selected');applyFrameLibraryFilter()});if(sf.$('rdFrameProfile'))sf.$('rdFrameProfile').onchange=e=>{this.checkpoint();m.frameProfile=e.target.value;const p=(window.SFFrameLibrary?.profiles||[]).find(x=>x.id===m.frameProfile);if(p){m.frameWidth=p.defaultWidth;m.depth=p.depth}this.render()};if(sf.$('rdWrapEdge'))sf.$('rdWrapEdge').addEventListener('change',e=>{this.checkpoint();m.wrapEdge=e.target.value;this.render()});
    if(sf.$('rdWrapColor'))sf.$('rdWrapColor').addEventListener('input',e=>{m.wrapColor=e.target.value;this.draw()});
    document.querySelectorAll('[data-wrap-swatch]').forEach(b=>b.addEventListener('click',()=>{
      this.checkpoint();m.wrapColor=b.dataset.wrapSwatch;m.wrapEdge='custom';this.render();
    }));
    if(sf.$('rdMatColor'))sf.$('rdMatColor').addEventListener('change',e=>{this.checkpoint();m.matColor=e.target.value;this.draw()});if(sf.$('rdShowMeasurements'))sf.$('rdShowMeasurements').addEventListener('change',e=>{m.showMeasurements=e.target.checked;this.draw()});if(sf.$('rdRenderPresentation'))sf.$('rdRenderPresentation').addEventListener('click',()=>this.renderPresentation());if(sf.$('rdAmbientBounce'))sf.$('rdAmbientBounce').onchange=e=>{m.ambientBounce=e.target.checked;this.draw()};if(sf.$('rdWallColorBleed'))sf.$('rdWallColorBleed').onchange=e=>{m.wallColorBleed=e.target.checked;this.draw()};if(sf.$('rdGlassReflection'))sf.$('rdGlassReflection').onchange=e=>{m.glassReflection=e.target.checked;this.draw()};if(sf.$('rdShadowDirection'))sf.$('rdShadowDirection').onchange=e=>{m.shadowDirection=e.target.value;this.draw()};if(sf.$('rdShadowSpread'))sf.$('rdShadowSpread').onchange=e=>{m.shadowSpread=e.target.value;this.draw()};
    sf.$('rdSnap').addEventListener('change',e=>{m.snap=e.target.checked});
    sf.$('rdLock').addEventListener('change',e=>{m.locked=e.target.checked;this.draw()});
    
    document.querySelectorAll('[data-nudge]').forEach(b=>b.addEventListener('click',()=>{if(m.locked)return;this.checkpoint();const [dx,dy]=b.dataset.nudge.split(',').map(Number);m.x=(m.x??50)+dx*.35;m.y=(m.y??40)+dy*.35;this.draw()}));

    sf.$('rdCenter').addEventListener('click',()=>this.center());
    if(sf.$('rdResetPlacement'))sf.$('rdResetPlacement').addEventListener('click',()=>this.resetPlacement());
    if(sf.$('rdFitWall'))sf.$('rdFitWall').addEventListener('click',()=>this.fitArtworkToWallView());
    sf.$('rdUndo').addEventListener('click',()=>this.undo());
    sf.$('rdRedo').addEventListener('click',()=>this.redo());
    sf.$('rdZoom').addEventListener('input',e=>{m.zoom=+e.target.value;this.draw()});if(sf.$('rdZoomIn'))sf.$('rdZoomIn').onclick=()=>{m.zoom=Math.min(2,m.zoom+.1);this.render()};if(sf.$('rdZoomOut'))sf.$('rdZoomOut').onclick=()=>{m.zoom=Math.max(.45,m.zoom-.1);this.render()};if(sf.$('rdZoomReset'))sf.$('rdZoomReset').onclick=()=>{m.zoom=1;this.render()};if(sf.$('rdMatchRoom'))sf.$('rdMatchRoom').onclick=()=>{this.checkpoint();const scene=this.scene()||{},light=String(scene.lightDirection||'').toLowerCase(),name=String(scene.name||scene.style||'').toLowerCase();m.artTemperature=/night|cool|modern/.test(name)?-3:/late|warm|coastal|luxury|bedroom/.test(name)?5:2;m.artTint=/green|forest/.test(name)?-1:1;m.artBrightness=/night/.test(name)?90:98;m.artContrast=/soft|coastal|bedroom/.test(name)?96:99;m.artSaturation=98;this.render()};if(sf.$('rdResetBlend'))sf.$('rdResetBlend').onclick=()=>{this.checkpoint();Object.assign(m,{artTemperature:0,artTint:0,artBrightness:100,artContrast:100,artSaturation:100});this.render()};const vp=document.querySelector('.stage-viewport');if(vp)vp.onwheel=e=>{if(e.ctrlKey||Math.abs(e.deltaY)>0){e.preventDefault();m.zoom=Math.max(.45,Math.min(2,m.zoom+(e.deltaY<0?.08:-.08)));this.render()} };
    sf.$('rdPlaceMode').addEventListener('click',()=>{m.mode='place';this.render()});
    sf.$('rdPreviewMode').addEventListener('click',()=>{m.mode='preview';m.showSafe=false;this.render()});
    sf.$('rdSaveProject').addEventListener('click',()=>this.saveProject());
    sf.$('rdOpenProjects').addEventListener('click',()=>sf.goTo('Saved Room Projects'));

    const room=sf.$('rdRoom');
    room.addEventListener('pointerdown',e=>this.dragStart(e));
    window.addEventListener('resize',this._resizeHandler||(this._resizeHandler=()=>{if(window.SF.currentPage==='Art Placement')this.draw()}));
  },

  checkpoint(){
    const snapshot=JSON.parse(JSON.stringify({...this.model,undo:[],redo:[]}));
    this.model.undo.push(snapshot);
    this.model.undo=this.model.undo.slice(-30);
    this.model.redo=[];
  },
  restore(snapshot){
    const u=this.model.undo,r=this.model.redo;
    Object.assign(this.model,JSON.parse(JSON.stringify(snapshot)),{undo:u,redo:r});
    this.render();
  },
  undo(){
    if(!this.model.undo.length)return;
    const current=JSON.parse(JSON.stringify({...this.model,undo:[],redo:[]}));
    this.model.redo.push(current);
    this.restore(this.model.undo.pop());
  },
  redo(){
    if(!this.model.redo.length)return;
    const current=JSON.parse(JSON.stringify({...this.model,undo:[],redo:[]}));
    this.model.undo.push(current);
    this.restore(this.model.redo.pop());
  },
  center(){
    const scene=this.scene();if(!scene)return;
    this.checkpoint();
    const c=scene.calibration||{};
    this.model.x=scene.wallCenterX ?? (((c.wallLeft ?? 0)+(c.wallRight ?? 100))/2);
    this.model.y=scene.wallCenterY ?? (((c.wallTop ?? 0)+(c.wallBottom ?? 90))/2);
    this.draw();
  },

  resetPlacement(){
    const scene=this.scene();if(!scene)return;
    this.checkpoint();
    const c=scene.calibration||{};
    this.model.x=scene.wallCenterX ?? (((c.wallLeft ?? 0)+(c.wallRight ?? 100))/2);
    this.model.y=scene.wallCenterY ?? (((c.wallTop ?? 0)+(c.wallBottom ?? 90))/2);
    this.model.zoom=1;
    this.model.locked=false;
    this.model.snap=false;
    this.render();
  },
  fitArtworkToWallView(){
    const room=window.SF.$('rdRoom'),scene=this.scene();if(!room||!scene)return;
    const c=scene.calibration||{},f=this.finishedSize();
    const wallW=Math.max(1,Number(scene.wallWidth||144));
    const wallH=Math.max(1,Number(scene.wallHeight||c.ceilingHeightInches||96));
    const usableW=Math.max(1,(Number(c.wallRight??100)-Number(c.wallLeft??0))/100*wallW);
    const usableH=Math.max(1,(Number(c.wallBottom??90)-Number(c.wallTop??0))/100*wallH);
    const fit=Math.min(1.65,Math.max(.45,Math.min(usableW/f.w,usableH/f.h)*.72));
    this.model.zoom=Number(fit.toFixed(2));
    this.render();
  },

  rulerMarkup(scene,room){
    const c=scene.calibration||{};
    const width=Number(scene.wallWidth||0);
    const left=Number(c.wallLeft??0);
    const right=Number(c.wallRight??100);
    if(!width||right<=left)return '';
    const ticks=[];
    const fullSteps=Math.floor(width/12);
    for(let i=0;i<=fullSteps;i++){
      const value=i*12;
      const pct=left+(right-left)*(value/width);
      ticks.push(`<div class="ruler-tick" style="left:${pct}%"><i></i><span>${value}"</span></div>`);
    }
    if(width%12!==0){
      ticks.push(`<div class="ruler-tick ruler-end" style="left:${right}%"><i></i><span>${width.toFixed(0)}"</span></div>`);
    }
    return `<div class="scale-ruler calibrated-ruler">
      <div class="ruler-line" style="left:${left}%;right:${100-right}%"></div>
      ${ticks.join('')}
    </div>`;
    const placed=sf.$('rdPlacedArt');if(placed){placed.style.touchAction='none';placed.onpointerdown=e=>this.dragStart(e)}
  },

  finishedSize(){
    const m=this.model;
    let w=m.imageWidth,h=m.imageHeight;
    if(m.medium==='Framed Print'){w+=2*(m.matWidth+m.frameWidth);h+=2*(m.matWidth+m.frameWidth)}
    if(m.medium==='Canvas'&&m.canvasFrame==='floating'){
      w+=2*(m.frameWidth+m.floatGap);h+=2*(m.frameWidth+m.floatGap)
    }
    const physicalScale=Math.max(.1,Number(m.physicalScale??m.scale)||1);
    return {w:w*physicalScale,h:h*physicalScale};
  },
  frameMaterial(){return (window.SFFrameLibrary?.materials||[]).find(x=>x.id===this.model.frameColor)||(window.SFFrameLibrary?.materials||[])[0]||{id:'black-wood',baseColor:'#151515',asset:'assets/frames/master-v1/black-wood.png'};},
  frameColor(){return this.frameMaterial().baseColor||'#151515';},
  frameMaterialFilter(){const material=this.frameMaterial();return material.category==='metal'?'brightness(1) contrast(1.015) saturate(.92)':'brightness(1) contrast(1.01) saturate(1)';},
  frameCalibration(){
    const material=this.frameMaterial();
    const slices={
      'black-wood':'99 103 93 103','white-wood':'100 103 95 103','natural-oak':'99 101 92 104',
      'walnut':'99 100 92 103','espresso':'104 103 100 105','driftwood-grey':'114 93 95 101',
      'brushed-aluminum':'107 106 97 110','matte-black-aluminum':'108 107 101 105','satin-silver':'124 115 112 106',
      'champagne':'104 106 100 103','bronze':'109 109 99 107','gunmetal':'118 106 123 107'
    };
    return {asset:material.asset,slice:slices[material.id]||'220 220 220 220',material};
  },
  frameAsset(){return this.frameCalibration().asset;},
  frameSlice(){return this.frameCalibration().slice;},

  shadow(scene,ppi){
    const m=this.model, medium=m.medium;
    const source=String(m.shadowDirection==='auto'?(scene?.lightDirection||'left'):m.shadowDirection).toLowerCase();
    const direction=source.includes('left')?1:source.includes('right')?-1:0;
    const gapMm=Math.max(0,Number(m.mountGap??15));
    const sizeFactorX=Math.max(.05,Math.min(2,Number(m.shadowWidth??m.shadowSize??100)/100));
    const sizeFactorY=Math.max(.05,Math.min(2,Number(m.shadowHeight??m.shadowSize??100)/100));
    const distance=Math.max(.75,Math.min(14,(gapMm/4.5)+1.25));
    let x=direction*distance;
    let y=source.includes('top')?Math.max(.75,distance*.42):Math.max(.5,distance*.22);
    x+=Math.max(-8,Math.min(8,Number(m.shadowOffsetX)||0));
    y+=Math.max(-8,Math.min(8,Number(m.shadowOffsetY)||0));
    const requested=Math.max(0,Math.min(100,Number(m.shadowOpacity)||0))/100;
    const blurControl=Number.isFinite(Number(m.shadowBlur))?Number(m.shadowBlur):3;
    const blur=Math.max(0,Math.min(10,blurControl*.32));
    const growX=(sizeFactorX-1)*Math.min(18,Math.max(6,ppi*1.25));
    const growY=(sizeFactorY-1)*Math.min(18,Math.max(6,ppi*1.25));
    const alpha=Math.min(.72,requested*.88);
    return {x,y,blur,alpha,direction,gapMm,sizeFactorX,sizeFactorY,growX,growY};
  },

  /* g91 — TEMPERATURE AND TINT.
     These two read their model values into `warm` and `tint` and then never used them; the chain
     returned only brightness/contrast/saturate. That is why they did nothing while the other three
     worked, and it is the same fault class as g90's inner shadow: a control that writes a value
     nothing consumes.

     They can't be fixed by adding a CSS function because CSS has none for colour temperature. The
     old behaviour Kirk remembers -- "it was actually inverting the colours" -- is what hue-rotate()
     does: it rotates every hue around the wheel, so a blue sky swings to green and skin goes
     magenta. It is the wrong tool and was rightly abandoned.

     The right tool is a colour matrix, which is what Photoshop is doing behind its Kelvin slider:
     scale the red and blue channels in opposition rather than rotating hue.
         warm > 0  -> red and green up, blue down    = yellow/amber pushes in
         warm < 0  -> the same formula in reverse    = blue pushes in
         tint > 0  -> red and blue up, green down    = magenta
         tint < 0  -> green up, red and blue down    = green
     Hue is never rotated, so colours warm and cool the way film and white balance do instead of
     travelling around the wheel. */
  /* g105 — THE BEVEL TAKES ITS COLOUR FROM THE MAT.
     g101 hardcoded a near-white core, which on Kirk's Warm White mat read as a white border on the
     two lit sides. A mat bevel is the INSIDE OF THE SAME BOARD: on a pale mat it is barely lighter
     than the surface and should only whisper; the bright white line people picture is what you see
     on a DARK mat, where the white core is genuinely exposed. So derive both faces from the mat's
     own colour and only reach for a true white core when the board is dark. */
  matRGB(){
    const raw = ((window.SFFrameLibrary?.mats||[])
      .find(x=>x.name.toLowerCase()===String(this.model.matColor).toLowerCase())?.color) || '#f3efe5';
    const hex = String(raw).replace('#','').trim();
    const full = hex.length===3 ? hex.split('').map(c=>c+c).join('') : hex.padEnd(6,'f').slice(0,6);
    const n = parseInt(full,16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  },
  bevelColours(){
    const c = this.matRGB();
    const lum = (0.2126*c.r + 0.7152*c.g + 0.0722*c.b) / 255;
    const mix = (col,t)=>`rgb(${Math.round(col.r+(255-col.r)*t)},${Math.round(col.g+(255-col.g)*t)},${Math.round(col.b+(255-col.b)*t)})`;
    const dark = (col,t)=>`rgb(${Math.round(col.r*(1-t))},${Math.round(col.g*(1-t))},${Math.round(col.b*(1-t))})`;
    // A dark board really does expose a white core; a pale one barely changes tone.
    /* g113: the white mitred line Kirk keeps seeing is these two LIT faces meeting at the 45-degree
       corner. He has now reported a white edge three times and has said he would rather it were
       not there at all. So on a pale mat the lit face is no longer lightened AT ALL — the bevel
       reads only as the shaded faces, which is enough to give the opening depth without ever
       producing a bright line. A dark mat still gets its genuine white core, because that is the
       one case where a bright bevel is real and expected. */
    return lum < 0.45
      ? { lit:'rgb(250,248,242)', shaded:'rgb(196,190,178)' }
      : { lit:`rgb(${c.r},${c.g},${c.b})`, shaded:dark(c,0.20) };
  },
  artColorMatrix(){
    const m=this.model;
    const k=Math.max(-30,Math.min(30,Number(m.artTemperature||0)))/30;
    const j=Math.max(-30,Math.min(30,Number(m.artTint||0)))/30;
    /* g92 — WHY THE FIRST VERSION FELT LIKE A YELLOW WASH.
       Scaling the channels alone changes the picture's overall LUMINANCE as well as its colour:
       warming raised red and green and dropped blue, so the whole image also got brighter, and
       cooling darkened it. The eye reads that combination as "a coloured sheet laid over the
       photograph" rather than as white balance. Photoshop's slider doesn't do that — the image
       changes hue while its brightness stays put.

       So two changes: the coefficients are roughly halved (Kirk: the sliders were far too
       sensitive), and the result is normalised by its own luminance using the Rec.709 weights, so
       mid-grey keeps exactly the brightness it had and only its colour moves. Green carries most
       of the luminance weight, which is why warming now barely shifts perceived brightness. */
    /* g94: softened again at Kirk's request — "better but need refinement". Roughly 60% of g92,
       which is about a third of the original g91 strength. Full travel is now a believable white-
       balance nudge rather than a grade; the luminance normalisation below is what keeps it
       reading as balance rather than as a colour cast. */
    let r=1+0.058*k+0.034*j,
        g=1+0.027*k-0.046*j,
        b=1-0.064*k+0.034*j;
    const L=0.2126*r+0.7152*g+0.0722*b;
    if(L>0){r/=L;g/=L;b/=L;}
    return {r,g,b,active:Math.abs(k)>0.0001||Math.abs(j)>0.0001};
  },
  artFilter(){
    const m=this.model;
    const base=`brightness(${Number(m.artBrightness||100)}%) contrast(${Number(m.artContrast||100)}%) saturate(${Number(m.artSaturation||100)}%)`;
    // The matrix runs LAST so it tints the already-graded image, the way an adjustment layer sits
    // above the others rather than underneath them.
    return this.artColorMatrix().active?`${base} url(#rdTempTint)`:base;
  },
  /* The filter has to exist in the document for url(#rdTempTint) to resolve. color-interpolation-
     filters="sRGB" is essential: SVG filters default to linearRGB, which makes the same matrix
     look washed out and behave unlike Photoshop. */
  tempTintSvg(){
    const c=this.artColorMatrix();
    if(!c.active) return '';
    const f=n=>Number(n.toFixed(4));
    return `<svg width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true">
      <filter id="rdTempTint" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="
          ${f(c.r)} 0 0 0 0
          0 ${f(c.g)} 0 0 0
          0 0 ${f(c.b)} 0 0
          0 0 0 1 0"/>
      </filter></svg>`;
  },

  /* g97 — THE OVERLAY NOW USES THE ROOM IT SAMPLED.
     This built its colour from the temperature and tint SLIDER values. So Match Room read the real
     wall, reduced it to two slider numbers, and then this reconstructed an approximation of the
     wall back out of those numbers — throwing away the actual measurement, which is the one thing
     worth keeping and the reason there was no colour to show in a swatch.
     When a sample exists, the wall's own colour IS the overlay. Slider-derived colour remains the
     fallback for manual grading and for rooms whose image can't be read. */
  blendOverlay(){
    const m=this.model,warm=Math.max(-30,Math.min(30,Number(m.artTemperature||0))),tint=Math.max(-30,Math.min(30,Number(m.artTint||0)));
    const info=m._matchRoomInfo;
    if(info&&m.wallColorBleed!==false){
      // Strength follows how far the wall is from neutral grey, so a strongly coloured room bleeds
      // more than a white one -- which is what happens physically.
      const cast=(Math.abs(info.r-info.g)+Math.abs(info.g-info.b)+Math.abs(info.r-info.b))/3;
      return {color:`rgb(${info.r} ${info.g} ${info.b})`,
              opacity:Math.min(.20,Math.max(.04,cast/255*.9)),
              sampled:true};
    }
    const strength=Math.min(.22,(Math.abs(warm)+Math.abs(tint))*.0045);
    let r=128,g=128,b=128;
    if(warm>0){r+=warm*3.2;g+=warm*1.35;b-=warm*2.4}else if(warm<0){r+=warm*.9;g+=warm*.15;b-=warm*3.0}
    if(tint>0){r+=tint*1.7;g-=tint*1.2;b+=tint*1.25}else if(tint<0){r+=tint*.4;g-=tint*2.0;b+=tint*.25}
    const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
    return {color:`rgb(${clamp(r)} ${clamp(g)} ${clamp(b)})`,opacity:strength,sampled:false};
  },

  draw(){
    const sf=window.SF, room=sf.$('rdRoom'),safe=sf.$('rdSafeZone'),ruler=sf.$('rdRulerLayer'),layer=sf.$('rdArtworkLayer');
    if(!room||!safe||!ruler||!layer)return;
    const scene=this.scene(),art=this.art(),m=this.model;
    if(scene && scene.calibrated===false){safe.innerHTML='';ruler.innerHTML='';layer.innerHTML='';sf.$('rdScaleReadout').innerHTML='<b>This room must be calibrated before accurate placement.</b>';return;}
    if(!scene){
      safe.innerHTML='';layer.innerHTML='';
      sf.$('rdScaleReadout').textContent='Select a scene to establish wall scale.';
      return;
    }
    const c=scene.calibration||{};
    const wallTop=Number(c.wallTop??Math.min(c.floorPoint?.y??100,c.ceilingPoint?.y??0));
    const wallBottom=Number(c.wallBottom??Math.max(c.floorPoint?.y??100,c.ceilingPoint?.y??0));
    const wallLeft=Number(c.wallLeft??0),wallRight=Number(c.wallRight??100);
    const wallPixelWidth=(wallRight-wallLeft)/100*room.clientWidth;
    const ppi=wallPixelWidth/Math.max(1,Number(scene.wallWidth||144));
    safe.innerHTML='';
    ruler.innerHTML=m.mode==='place'?this.rulerMarkup(scene,room):'';
    room.classList.toggle('preview-mode',m.mode==='preview');

    const f=this.finishedSize();
    sf.$('rdScaleReadout').innerHTML=`Finished size: <b>${f.w.toFixed(1)} × ${f.h.toFixed(1)} inches</b><br>Scene wall width: <b>${scene.wallWidth}"</b>`;
    if(!art?.image){layer.innerHTML='';return}

    const physicalScale=Math.max(.1,Number(m.physicalScale??m.scale)||1);
    const w=f.w*ppi,h=f.h*ppi,fr=m.frameWidth*physicalScale*ppi,mat=m.medium==='Framed Print'?m.matWidth*physicalScale*ppi:0,gap=m.floatGap*physicalScale*ppi;
    const sh=this.shadow(scene,ppi);const bevelCols=this.bevelColours();
    /* g108: shadow() caps its spread at 18px no matter how big the print is —
       Math.min(18,Math.max(6,ppi*1.25)) — so on a 59in piece the whole Width/Height travel moved
       the shadow by less than the frame moulding is thick. Kirk read that as the sliders doing
       nothing, and at that scale he was right. Spread now scales with the RENDERED PIECE: full
       travel adds or removes ~18% of its width/height per side, which is a real change at any
       size and still proportionate on a small one. */
    const growX=(sh.sizeFactorX-1)*w*0.18, growY=(sh.sizeFactorY-1)*h*0.18;
    let inner='';
    if(m.medium==='Framed Print'){
      const matColor=((window.SFFrameLibrary?.mats||[]).find(x=>x.name.toLowerCase()===String(m.matColor).toLowerCase())?.color||'#f3efe5');
      const frameMaterial=this.frameMaterial();
      inner=`<div class="rd-product rd-exact-frame" data-frame-material="${frameMaterial.id}" data-frame-category="${frameMaterial.category||'wood'}" data-blend-engine="3.5.2" style="--rd-frame-width:${fr}px;--rd-mat-width:${mat}px;--rd-frame-color:${this.frameColor()};--rd-frame-filter:${this.frameMaterialFilter()};--rd-frame-asset:url('${this.frameAsset()}');--rd-frame-slice:${this.frameSlice()}"><div class="rd-exact-mat" style="background:${(()=>{
        /* g112 — THE LIP SHADOW MOVED INTO THE MAT'S OWN BACKGROUND.
           Three previous attempts put it on .rd-exact-frame:before (sixteen competing rules), then
           on a dedicated .rd-lip-shadow div (no competing rules, but still dependent on the
           containing block, the stacking context and z-index all resolving as expected). Kirk saw
           nothing every time. This depends on none of that: it is one inline background on an
           element that already exists and that NO rule in styles.css gives a background to.
           Layers paint first-on-top, so the gradients go before the mat colour. */
        const A=Math.max(0,Math.min(100,Number(m.innerShadowOpacity??20)))/100;
        if(A<=0) return matColor;
        const sx=Math.sign(sh.x||1), sy=Math.sign(sh.y||1);
        /* g113 — STRONGER, AND STARTING WHERE HE CAN SEE IT.
           Kirk: "opacity has to be pretty high in order to even see it... almost as if it is
           starting further away under the frame". That is exactly right, and it was two things:
           (a) the mat sits at inset calc(frame-width - 1px), so it UNDERLAPS the frame and the
               darkest point of each gradient was hidden beneath the moulding;
           (b) a gradient from full alpha straight to zero spends most of its length nearly
               transparent, so the visible part was the faint tail.
           Fixed by holding the shadow at full strength for a short SOLID band first, then fading —
           and by raising the strength outright, which he explicitly preferred to moving anything
           around given the history of white-edge problems here. */
        const a=(on)=>Math.min(1,A*(on?1.9:0.42)).toFixed(3);
        /* g115 — REACH IS MEASURED ACROSS THE MAT, NOT THE FRAME.
           It was fr*(0.35+blur/9). The frame is 1.5in against a 3.5in mat, so even a big move on
           the blur slider changed the shadow by a fraction of an inch of a surface more than twice
           as wide — Kirk read that as the control doing nothing, and at that scale he was right.
           The mat is the surface the shadow falls across, so it sets the scale. Blur now spans
           12% of the mat at 0 up to about 67% at the slider's maximum of 12, which is the whole
           usable range from a crisp line to a soft wash. */
        const blur=Math.max(0,Math.min(12,Number(m.innerShadowBlur??3.5)));
        const span=mat>0?mat:fr;
        const reachPx=Math.max(6,span*(0.12+(blur/12)*0.55));
        const holdPx=Math.max(2,reachPx*0.18);           // solid band, clears the frame lip
        const reach=reachPx.toFixed(1)+'px', hold=holdPx.toFixed(1)+'px';
        const g=(dir,alpha)=>`linear-gradient(to ${dir}, rgba(0,0,0,${alpha}) 0px, rgba(0,0,0,${alpha}) ${hold}, rgba(0,0,0,0) ${reach})`;
        return `${g('bottom',a(sy>0))},${g('top',a(sy<0))},${g('right',a(sx>0))},${g('left',a(sx<0))},${matColor}`;
      })()}"><div class="rd-mat-recess"><img class="rd-art-image" src="${art.image}"></div></div>${m.glassReflection!==false?`<div class="rd-glass-reflection" aria-hidden="true"></div>`:''}</div>`;
    }else if(m.medium==='Canvas'&&m.canvasFrame==='floating'){
      inner=`<div class="rd-product rd-floating-canvas-frame" data-frame-material="${this.frameMaterial().id}" style="--rd-float-frame:${fr}px;--rd-float-gap:${gap}px;--rd-float-color:${this.frameColor()};--rd-frame-asset:url('${this.frameAsset()}');--rd-frame-slice:${this.frameSlice()}"><div class="rd-floating-frame-shell"><div class="rd-floating-reveal"><div class="rd-canvas rd-floating-canvas-face"><img class="rd-art-image" src="${art.image}"></div></div></div></div>`;
    }else if(m.medium==='Canvas'){
      inner=`<div class="rd-canvas"><img class="rd-art-image" src="${art.image}"></div>`;
    }else{
      inner=`<div class="rd-metal"><img class="rd-art-image" src="${art.image}"></div>`;
    }
    /* ==========================================================================================
       g190 — THE PIECE NOW SITS ON THE WALL'S OWN PLANE.
       ==========================================================================================
       Kirk, twice: "the image is also the wrong scale. it is far too large… it is still flat…
       so i guess you still have to build the reading of wall angle and the 3d render."

       Both faults had ONE cause: this module never read the calibration. It took a single
       `ppi = wallPixelWidth / scene.wallWidth` — one scale for the whole wall — and a manual
       tilt from two sliders. On a wall that turns away, neither is true: the near end is bigger
       than the far end, and the piece should lean with the wall rather than face the camera.

       g164 already solves the wall and stores a HOMOGRAPHY: wall inches → stage pixels. What was
       missing was reading it. Now, when a scene is calibrated AT AN ANGLE:

         - the piece's position is converted from stage pixels to WALL INCHES (inverse homography),
           so dragging still works in the room but MEANS something on the wall;
         - its four corners are found in inches and mapped through the homography;
         - a matrix3d is built from the piece's own rectangle to those four corners.

       A 2D projective transform maps onto matrix3d exactly — the third row and column are the
       identity and the perspective terms ride in the fourth. So ONE transform gives correct
       foreshortening AND correct size, and the sliders are no longer needed on such a wall.

       THE SQUARE-ON PATH IS UNTOUCHED. Every scene calibrated the old way renders exactly as it
       did; this branch is entered only when there is an angled solve to read.
       ========================================================================================== */
    const cal = scene.calibration || {};
    const wallH3 = (cal.mode === 'corners' && cal.homography && window.SFWallPerspective) ? cal.homography : null;
    let perspectiveMatrix = '', wallPerspective = 0, wallPerspectiveOrigin = null, wallDepthPx = 0;
    let wallEdgePx = 0;
    this._wallEdgePx = 0;   /* cleared every render, or a figure from the last scene survives */

    if (wallH3) {
      const WP = window.SFWallPerspective;
      const stage = layer.parentElement || layer;
      const sw = stage.clientWidth || 1, sh2 = stage.clientHeight || 1;
      /* The homography was solved in the CALIBRATION stage's pixels. The designer's stage is a
         different size, so it is rescaled rather than assumed equal — the same mistake as reading
         a percentage as a pixel. */
      const kx = sw / (cal.stageWidthPixels || sw), ky = sh2 / (cal.stageHeightPixels || sh2);
      const H = [
        [wallH3[0][0] * kx, wallH3[0][1] * kx, wallH3[0][2] * kx],
        [wallH3[1][0] * ky, wallH3[1][1] * ky, wallH3[1][2] * ky],
        [wallH3[2][0],      wallH3[2][1],      wallH3[2][2]]
      ];
      const inv = WP.invert(H);
      if (inv) {
        /* Where he dragged it to, in inches ON THE WALL. */
        const cx = (Number(m.x ?? scene.wallCenterX ?? 50) / 100) * sw;
        const cy = (Number(m.y ?? scene.wallCenterY ?? 45) / 100) * sh2;
        const onWall = WP.apply(inv, { x: cx, y: cy });
        if (onWall) {
          const pieceW = f.w, pieceH = f.h;          /* real inches, frame included */
          const quad = WP.quadFor({ H3: H }, onWall.x - pieceW / 2, onWall.y - pieceH / 2, pieceW, pieceH);
          if (quad) {
            /* From the element's own box to those four points. The element is laid out at its
               nominal pixel size; the matrix does the rest. */
            /* g195 — THE INVERSION, and it was an ordering error rather than anything subtle.
               WALL Y RUNS UPWARD: calibration clicks the BOTTOM-left corner first, so wall (0,0)
               is the floor and (0, ceilingHeight) is the ceiling. An HTML element's y runs
               DOWNWARD. quadFor() therefore hands back [bottom-left, bottom-right, top-right,
               top-left], and mapping the element's TOP-left onto the first of those put the top
               of the picture at the bottom of its space — a vertical flip, which is exactly what
               Kirk kept reporting.
               The quad is reordered to match the element's own sense: top-left, top-right,
               bottom-right, bottom-left. Proven by mapping the element's corners through the
               result and checking the top edge lands ABOVE the bottom edge on screen. */
            /* ==================================================================================
               g200 — A REAL 3D PLANE WHEN THE CAMERA IS KNOWN.
               ==================================================================================
               g190's matrix is a 2D projective map: correct size, correct perspective, but its
               third column is (0,0,1,0), so a side face sticking out of the wall contributes
               nothing to the screen and collapses to a line. That is why the 3D render never
               appeared on a calibrated wall, and no amount of work on the faces themselves could
               have fixed it.
               With the focal length — which g163 had to solve for anyway to measure the wall —
               the homography decomposes into the wall's real pose, and CSS can be driven with a
               perspective and a matrix whose third axis IS the wall's normal. The faces then have
               somewhere to point.
               THE FLAT PATH REMAINS for a wall solved without a focal length (the level-camera
               case, where it is genuinely unrecoverable). Size and perspective are right there
               too; only the edges are missing, which is what he had before this build. */
            /* g202 — AN ESTIMATE RATHER THAN NOTHING. A missing focal length used to mean no pose,
               no perspective and no edges — which is what Kirk has been looking at. But the size
               and perspective come from the homography and are exact without it; only the DEPTH
               direction needs the camera. So a sensible estimate gives a believable edge where the
               alternative is a flat rectangle, and the readout says plainly that it is estimated. */
            /* g203 — THE ESTIMATE IS WITHDRAWN, and Kirk found exactly what I had measured.
               "the scale is now no longer correct in this room where it was accurate before."
               g202 fell back to an assumed 26mm when no lens was recorded. He shot this room on a
               17mm — a 53% error — and my own h200 figures say that shifts the piece by more than
               a tenth of its width. So the estimate did not just soften the edge, it MOVED THE
               PIECE, and it did so on a wall whose scale had been exact.
               THE TRADE IS NOT WORTH IT. Correct size with no edge beats a visible edge on a piece
               that is the wrong size — size is what he shows a client to sell a print. So the pose
               is used ONLY when the lens is actually known, and the lens is now one click away in
               Scene Calibration (g203 put the picker where it can be reached). An estimate stays
               available in the code for a caller that wants it; nothing calls it silently. */
            const focal = Number(cal.focalPx) * kx;
            let posed = null;
            if (focal > 0) {
              const pose = WP.pose(H, focal, { x: sw / 2, y: sh2 / 2 });
              posed = pose && WP.cssMatrix(pose, {
                pieceWidthIn: pieceW, pieceHeightIn: pieceH,
                elementWidthPx: w, elementHeightPx: h,
                leftIn: onWall.x - pieceW / 2, bottomIn: onWall.y - pieceH / 2
              });
            }
            if (posed) {
              perspectiveMatrix = posed.transform;
              wallPerspective = posed.perspective;
              wallPerspectiveOrigin = posed.perspectiveOrigin;
              wallDepthPx = posed.depthPxFor(Number(m.depth) || 1.5);
              /* How much of that depth actually reaches the screen, at this zoom, on the near
                 side — the figure the note reports. */
              const f0 = WP.cssProject(posed, 0, h, 0);
              const f1 = WP.cssProject(posed, 0, h, -wallDepthPx);
              wallEdgePx = (f0 && f1) ? Math.hypot(f1.x - f0.x, f1.y - f0.y) : 0;
              /* Kept on the module, because wallModeNote() is a sibling method and cannot see a
                 local declared inside the render. Caught before shipping by asking where the note
                 reads it from — the g84 check, applied to my own new variable. */
              this._wallEdgePx = wallEdgePx;
            }
            const wallQuad = [quad[3], quad[2], quad[1], quad[0]];
            const M = posed ? null : WP.homography(
              [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], wallQuad);
            if (M) {
              perspectiveMatrix = `matrix3d(${M[0][0]},${M[1][0]},0,${M[2][0]},` +
                `${M[0][1]},${M[1][1]},0,${M[2][1]},0,0,1,0,${M[0][2]},${M[1][2]},0,${M[2][2]})`;
            }
          }
        }
      }
    }

    const transform=`translate(-50%,-50%) rotate(${m.rotation||0}deg) perspective(900px) rotateY(${m.perspectiveX||0}deg) rotateX(${m.perspectiveY||0}deg)`;
    const depthPx=Math.max(1.5,Math.min(12,(Number(m.depth)||1.5)*ppi*.16));
    const contactAlpha=Math.max(0,Math.min(1,Number(m.contactOpacity??82)/100));
    const sideX=sh.direction>0?-depthPx:depthPx;

    /* ==========================================================================================
       g165 — REAL SIDE FACES, so a tilted piece shows its actual EDGE.
       ==========================================================================================
       Kirk asked whether tilting shows the proper edge of the frame, canvas or metal. It did not,
       and the reason was structural: `.rd-depth-extrusion` is an offset COPY of the piece sitting
       behind it, shifted by (--rd-side-x, --rd-depth). Two things follow from that. Its direction
       comes from the LIGHT, not from the tilt — so the "thickness" pointed wherever the shadow was
       set. And it is a child of the rotated card, so it moves WITHIN the wall plane, while real
       thickness sticks out PERPENDICULAR to it. An in-plane offset can never foreshorten and can
       never swap sides.

       So the piece is now a real box. `#rdPlacedArt` becomes `transform-style:preserve-3d` and
       four faces are hinged to its edges, each rotated a quarter turn about that edge so it runs
       BACKWARDS towards the wall:
         left   origin 0 50%,   rotateY(90deg)     right  origin 100% 50%, rotateY(-90deg)
         top    origin 50% 0,   rotateX(-90deg)    bottom origin 50% 100%, rotateX(90deg)
       Checked rather than guessed — rotateY(90°) maps +x to −z, so a panel spanning 0..d in x ends
       up spanning 0..−d in z, i.e. behind the face. Each of the four was worked out the same way.

       WHY THE PAINTED EXTRUSION IS KEPT AT ZERO TILT: square on to a wall you genuinely CANNOT see
       the sides of a canvas — true geometry makes the edges vanish, which is correct and would
       read as a regression against what he has now. So the old painted sliver stays while the tilt
       is under a degree, and the real faces take over the moment the piece turns. Both are never
       visible at once.

       CANVAS WRAP: the default is a MIRRORED wrap, which is what a gallery wrap actually is —
       each face shows the strip of image next to that edge, flipped, so the picture folds round
       the stretcher and matches at the corner. Painted alternatives (black, white, a colour he
       picks) are the other real options a print shop offers.
       ========================================================================================== */
    /* g193 — WHY KIRK SAW NO SIDE FACES, and it is two separate things.
       (1) They only ever appear once the piece is TILTED — square on to a wall you cannot see the
           sides of a canvas, which is correct (g165). With both perspective sliders at zero, as on
           a fresh scene, there is nothing to show. That is what he was looking at in g188.
       (2) On a wall placed by the g190 matrix, the sliders are bypassed entirely — so `tilted`
           stayed false and the faces were suppressed on the very walls where they matter most.
       The flag now also fires for a wall-placed piece. THE HONEST LIMIT, recorded rather than
       papered over: the g190 matrix is a 2D projective map, whose third column is (0,0,1,0) — a
       face sticking out in −z contributes NOTHING to screen x or y and collapses to a line. So a
       correctly built face still cannot be SEEN under it. Making the sides visible on an angled
       wall needs the homography DECOMPOSED into a real 3D rotation and translation (K⁻¹h1, K⁻¹h2,
       r3 = r1×r2), which the calibration already has the focal length for. Until that is built,
       the sides show on slider-tilted pieces only. */
    const tilted=Math.abs(Number(m.perspectiveX)||0)>1||Math.abs(Number(m.perspectiveY)||0)>1
      ||!!perspectiveMatrix;
    /* The TRUE depth in pixels. The painted extrusion deliberately damps it (×0.16) because it is
       a suggestion of thickness seen head-on; a real side face must be the real size or a 1.5in
       canvas would look like a sheet of paper when turned. */
    /* g200 — ON A POSED WALL THE DEPTH IS IN THE WALL'S OWN SPACE. The matrix maps one element
       pixel to `pieceWidthIn / elementWidthPx` inches, so a 1.5in canvas is 1.5/that many pixels
       deep — NOT the screen-derived figure, which would be right only for a wall facing the
       camera. Using the wrong one gives a canvas whose thickness changes as he moves it along an
       angled wall, which is the kind of wrongness that is very hard to name. */
    const depthTrue=wallDepthPx>0
      ? Math.max(1,wallDepthPx)
      : Math.max(1,(Number(m.depth)||1.5)*ppi*Number(m.physicalScale??m.scale??1));
    const wrapMode=m.medium==='Canvas'?(m.wrapEdge||'mirror'):'';
    const wrapPaint=wrapMode==='black'?'#111111':wrapMode==='white'?'#f2f0ec':wrapMode==='custom'?(m.wrapColor||'#111111'):'';
    /* g206 — see the note above: `SFRD_SHOW_EDGES = true` makes every side face solid magenta so
       one screenshot settles whether they paint at all. */
    const showEdges = !!(window.SFRD_SHOW_EDGES);
    const faces=(()=>{
      if(!tilted)return '';
      /* A face turned away from the light is darker. Same convention as everywhere else in this
         module: sh.direction +1 is light from the LEFT. */
      const lit=0.06, dark=0.34;
      const shade=side=>{
        if(side==='left')return sh.direction>0?lit:dark;
        if(side==='right')return sh.direction>0?dark:lit;
        if(side==='top')return lit;                   // rooms are lit from above
        return dark;
      };
      const mirrorFor=side=>{
        if(!art.image)return '';
        const size=(side==='left'||side==='right')?`${w}px 100%`:`100% ${h}px`;
        const pos={left:'left center',right:'right center',top:'center top',bottom:'center bottom'}[side];
        const flip=(side==='left'||side==='right')?'scaleX(-1)':'scaleY(-1)';
        return `<div class="rd-face-wrap" style="background-image:url('${art.image}');background-size:${size};background-position:${pos};transform:${flip}"></div>`;
      };
      const body=side=>{
        /* g206 — the diagnostic wins over every wrap style, so nothing about the medium, the
           colour or the shading can hide the answer. */
        if(showEdges) return `<div class="rd-face-wrap" style="background:#ff00aa;opacity:1"></div>`;
        if(m.medium==='Canvas'){
          return wrapMode==='mirror'?mirrorFor(side)
            :`<div class="rd-face-wrap" style="background:${wrapPaint}"></div>`;
        }
        if(m.medium==='Metal Print'){
          /* Aluminium: a bright specular band across an otherwise dark edge. */
          return `<div class="rd-face-wrap" style="background:linear-gradient(${(side==='top'||side==='bottom')?'90deg':'180deg'},#3a3d3f,#c8ccce 45%,#6c7072)"></div>`;
        }
        /* Framed print: the moulding, in the frame's own colour. */
        return `<div class="rd-face-wrap" style="background:${this.frameColor()}"></div>`;
      };
      const geom={
        left:  `left:0;top:0;width:${depthTrue}px;height:100%;transform-origin:0 50%;transform:rotateY(90deg)`,
        right: `right:0;top:0;width:${depthTrue}px;height:100%;transform-origin:100% 50%;transform:rotateY(-90deg)`,
        top:   `left:0;top:0;height:${depthTrue}px;width:100%;transform-origin:50% 0;transform:rotateX(-90deg)`,
        bottom:`left:0;bottom:0;height:${depthTrue}px;width:100%;transform-origin:50% 100%;transform:rotateX(90deg)`
      };
      /* ==========================================================================================
         g167 — THE SIDES ARE PART OF THE PIECE, so Match Room must reach them.
         ==========================================================================================
         Kirk asked whether Blend to Room still works with the new 3D render. IT DID NOT, and the
         reason is structural rather than arithmetic: the colour filter and the blend overlay are
         both carried by `.rd-visible-product`, and g165 hung the four faces OUTSIDE that element
         as siblings. So a canvas in a warm room would have had a warmed face and four edges still
         at the room's daylight colour — a seam down every side, appearing only when tilted, which
         is exactly the kind of fault that gets blamed on the tilt rather than on the blend.

         Both are applied to each face directly, from the SAME two functions the face uses — not a
         second copy of the mapping. If Match Room ever changes how it computes a colour, the sides
         change with it; two implementations of one job drift, which is the fault that made the
         supply-cost lookup read zero for weeks.

         The blend is a soft-light layer, matching the overlay on the front, and sits ABOVE the
         face's own shading so a dark edge still takes the room's colour rather than swallowing it.
         ========================================================================================== */
      const pieceFilter=this.artFilter();
      const blend=this.blendOverlay();
      return ['left','right','top','bottom'].map(side=>
        /* ==================================================================================
           g208 — THE FILTER WAS ON THE FACE ITSELF, AND THAT IS WHAT KILLED IT.
           ==================================================================================
           Kirk ticked the diagnostic that paints every face solid magenta and NOTHING appeared —
           so the faces are positioned but never painted. That rules out geometry entirely and
           leaves rendering, and there is one property here that changes how an element takes part
           in its parent's 3D space: **a filter forces the element to be rendered into a flattened
           plane of its own.** g167 put `filter` directly on the face element, to keep the blend
           matching the front. Every face has carried it since, and Kirk has never seen an edge in
           any build since.
           THE INTENT OF g167 IS KEPT — the sides must take the same colour treatment as the front,
           or a warm room gives a warmed picture with daylight-coloured edges. The filter simply
           moves to an INNER wrapper, so the face element stays a plain box positioned in 3D and
           the filtering happens inside it, where it cannot affect the 3D context.
           `backface-visibility:visible` goes on for the same reason: on a wall-placed piece the
           handedness is set by the wall's pose rather than by a slider, so a face can legitimately
           present its back to the camera and be culled — invisible for a second, separate reason. */
        `<div class="rd-face rd-face-${side}" aria-hidden="true" style="${geom[side]};backface-visibility:visible!important"><div class="rd-face-inner" style="position:absolute;inset:0;filter:${pieceFilter}">${body(side)}</div><div class="rd-face-shade" style="background:rgba(0,0,0,${shade(side)})"></div><div class="rd-face-blend" style="background:${blend.color};opacity:${blend.opacity}"></div></div>`
      ).join('');
    })();
    const bounce=m.ambientBounce!==false?'1':'0';
    const bleed=m.wallColorBleed!==false?'1':'0';
    const measureW=Number(f.w.toFixed(2)).toString(),measureH=Number(f.h.toFixed(2)).toString();
    /* g200 — THE PERSPECTIVE LIVES ON THE PARENT, and its origin is the camera's principal point.
       CSS projects a child about `perspective-origin` on the element that declares `perspective`,
       so this must sit on the LAYER, not on the piece. Set with !important because the layer is
       pinned by several earlier rules — the g110 lesson: a correct value that cannot reach the
       element is worth nothing. Cleared when there is no posed wall, or a stale perspective would
       distort a square-on scene rendered after an angled one. */
    /* ==========================================================================================
       g206 — A DIAGNOSTIC, BECAUSE I HAVE RUN OUT OF THINGS I CAN CHECK WITHOUT A BROWSER.
       ==========================================================================================
       Everything measurable now says the edge is there: the wall solves at 52° (his photograph
       shows about 60°), the pose reproduces its own homography, the faces are emitted, and the
       edge computes to three or four pixels. Kirk still sees nothing.

       So the remaining question is not geometric, it is whether those faces PAINT — and that is
       the one thing a harness in this container cannot answer, because it needs a real layout
       engine. Guessing again would be a seventh build spent on a hunch.

       `window.SFRD_SHOW_EDGES = true` in the console paints every side face solid magenta at full
       opacity and drops the shading. If magenta slivers appear, the faces render and the problem
       is that a dark edge on a dark picture is too subtle. If nothing appears, they are not being
       painted at all and the fault is structural — preserve-3d being flattened by something in
       the chain, most likely. Either answer costs one screenshot and settles it. */
    if (wallPerspective && wallPerspectiveOrigin) {
      layer.style.setProperty('perspective', wallPerspective + 'px', 'important');
      layer.style.setProperty('perspective-origin',
        wallPerspectiveOrigin.x + 'px ' + wallPerspectiveOrigin.y + 'px', 'important');
      layer.style.setProperty('transform-style', 'preserve-3d', 'important');
    } else {
      layer.style.removeProperty('perspective');
      layer.style.removeProperty('perspective-origin');
      layer.style.removeProperty('transform-style');
    }
    layer.innerHTML=`${this.tempTintSvg()}<div id="rdPlacedArt" class="rd-placed-art rd-depth-${m.medium.toLowerCase().replace(/\s+/g,'-')} ${m.medium==='Canvas'&&m.canvasFrame==='floating'?'rd-canvas-floating':''} ${sh.direction>0?'rd-light-left':'rd-light-right'}" style="${perspectiveMatrix?`left:0;top:0;transform-origin:0 0;${wallPerspective?`transform-style:preserve-3d;`:''}`:`left:${m.x??scene.wallCenterX??50}%;top:${m.y??scene.wallCenterY??45}%;`}width:${w}px;height:${h}px;transform:${perspectiveMatrix||transform};display:${m.showArtwork?'block':'none'};--rd-depth:${depthPx}px;--rd-side-x:${sideX}px;--rd-inner-shadow-x:${Math.sign(sh.x||1)*2.25}px;--rd-inner-shadow-y:${Math.sign(sh.y||1)*2.25}px;--rd-inner-x:${Math.sign(sh.x||1)};--rd-inner-y:${Math.sign(sh.y||1)};--rd-inner-blur:${Math.max(0,Number(m.innerShadowBlur??3.5))};--sf-inner-blur:${Math.max(0,Number(m.innerShadowBlur??3.5))}px;--sf-inner-alpha:${Math.max(0,Math.min(100,Number(m.innerShadowOpacity??20)))/100};--rd-inner-off:${Math.max(0.5,Math.min(3,Math.max(0,Number(m.innerShadowBlur??3.5))*0.45)).toFixed(2)}px;--rd-sh-top:${(Math.max(0,Math.min(100,Number(m.innerShadowOpacity??20)))/100*(Math.sign(sh.y||1)>0?1:0.22)).toFixed(3)};--rd-sh-bot:${(Math.max(0,Math.min(100,Number(m.innerShadowOpacity??20)))/100*(Math.sign(sh.y||1)<0?1:0.22)).toFixed(3)};--rd-sh-left:${(Math.max(0,Math.min(100,Number(m.innerShadowOpacity??20)))/100*(Math.sign(sh.x||1)>0?1:0.22)).toFixed(3)};--rd-sh-right:${(Math.max(0,Math.min(100,Number(m.innerShadowOpacity??20)))/100*(Math.sign(sh.x||1)<0?1:0.22)).toFixed(3)};--rd-inner-reach:${Math.max(3,Math.max(0,Number(m.innerShadowBlur??3.5))*3.2).toFixed(1)}px;--rd-lip-reach:${Math.max(4,fr*(0.30+Math.max(0,Number(m.innerShadowBlur??3.5))/12)).toFixed(1)}px;--rd-bevel:${mat>0?Math.max(1,0.055*physicalScale*ppi).toFixed(2):0}px;--rd-bev-top:${Math.sign(sh.y||1)>0?bevelCols.shaded:bevelCols.lit};--rd-bev-bot:${Math.sign(sh.y||1)<0?bevelCols.shaded:bevelCols.lit};--rd-bev-left:${Math.sign(sh.x||1)>0?bevelCols.shaded:bevelCols.lit};--rd-bev-right:${Math.sign(sh.x||1)<0?bevelCols.shaded:bevelCols.lit};--rd-inner-alpha:${Math.max(0,Math.min(100,Number(m.innerShadowOpacity??20)))/100};--rd-frame-rotation:${sh.direction>0?180:0}deg;--rd-physical-scale:${Number(m.physicalScale??m.scale??1)};--rd-contact:${contactAlpha};--rd-bounce:${bounce};--rd-bleed:${bleed}">
      ${m.mode==='place'&&m.showMeasurements!==false?`<div class="rd-piece-measurements" aria-hidden="true"><div class="rd-measure-width"><span>${measureW}\"</span></div><div class="rd-measure-height"><span>${measureH}\"</span></div></div>`:''}
      <div class="rd-cast-shadow" style="display:${m.showShadow?'block':'none'};left:${-growX}px!important;top:${-growY}px!important;right:${-growX}px!important;bottom:${-growY}px!important;transform:translate(${sh.x}px,${sh.y}px);filter:blur(${sh.blur}px);opacity:${sh.alpha}"></div>
      <div class="rd-contact-shadow" style="display:${m.showShadow?'block':'none'}"></div>
      ${faces}
      ${tilted?'':`${m.medium==='Canvas'?`<div class="rd-depth-side rd-canvas-edge" aria-hidden="true"><img src="${art.image}"></div><div class="rd-depth-bottom rd-canvas-edge" aria-hidden="true"><img src="${art.image}"></div>`:m.medium==='Metal Print'?`<div class="rd-metal-float-mount" aria-hidden="true"></div><div class="rd-depth-side rd-metal-edge" aria-hidden="true"></div><div class="rd-depth-bottom rd-metal-edge" aria-hidden="true"></div>`:'<div class="rd-depth-side" aria-hidden="true"></div><div class="rd-depth-bottom" aria-hidden="true"></div>'}`}
      <div class="rd-visible-product" style="--sf-piece-filter:${this.artFilter()};filter:${this.artFilter()};--sf-blend-color:${this.blendOverlay().color};--sf-blend-opacity:${this.blendOverlay().opacity}">${inner}</div>
    </div>`;
    const bg=room.querySelector('.rd-background-layer');if(bg)bg.style.display=m.showBackground?'block':'none';
    const light=sf.$('rdLightingLayer');if(light)light.style.display=m.showLighting?'block':'none';
    const fg=sf.$('rdForegroundLayer');if(fg)fg.style.display=m.showForeground?'block':'none';
    return;
    layer.innerHTML=`<div id="rdPlacedArt" class="rd-placed-art" style="left:${m.x??scene.wallCenterX??50}%;top:${m.y??scene.wallCenterY??45}%;width:${w}px;height:${h}px">
      <div class="rd-cast-shadow" style="transform:translate(${sh.x}px,${sh.y}px);filter:blur(${sh.blur}px);opacity:${sh.alpha}"></div>
      <div class="rd-visible-product" style="--sf-piece-filter:${this.artFilter()};filter:${this.artFilter()};--sf-blend-color:${this.blendOverlay().color};--sf-blend-opacity:${this.blendOverlay().opacity}">${inner}</div>
    </div>`;
  },

  dragStart(event){
    const sf=window.SF,placed=sf.$('rdPlacedArt'),room=sf.$('rdRoom'),scene=this.scene();
    if(!placed||!scene||this.model.mode!=='place'||this.model.locked)return;
    event.preventDefault();event.stopPropagation();
    try{placed.setPointerCapture?.(event.pointerId)}catch{}
    this.checkpoint();
    const rect=room.getBoundingClientRect();
    const move=e=>{
      let x=(e.clientX-rect.left)/rect.width*100;
      let y=(e.clientY-rect.top)/rect.height*100;
      const f=this.finishedSize();
      const c=scene.calibration||{};
      const top=Number(c.wallTop??Math.min(c.floorPoint?.y??100,c.ceilingPoint?.y??0));
      const bottom=Number(c.wallBottom??Math.max(c.floorPoint?.y??100,c.ceilingPoint?.y??0));
      const left=Number(c.wallLeft??0),right=Number(c.wallRight??100);
      const wallPixelWidth=(right-left)/100*rect.width;
      const ppi=wallPixelWidth/Math.max(1,Number(scene.wallWidth||144));
      const halfWPct=(f.w*ppi/rect.width)*50;
      const halfHPct=(f.h*ppi/rect.height)*50;
      const cx=(left+right)/2,cy=(top+bottom)/2;
      x=Math.max(left+halfWPct,Math.min(right-halfWPct,x));
      y=Math.max(top+halfHPct,Math.min(bottom-halfHPct,y));
      if(this.model.snap&&Math.abs(x-cx)<2.2)x=cx;
      if(this.model.snap&&Math.abs(y-cy)<2.2)y=cy;
      this.model.x=x;this.model.y=y;
      /* g194 — THE DRAG BROKE ON A WALL-CALIBRATED SCENE, and it was my doing at g190.
         The old placement positions the piece with left/top percentages, so nudging those during
         a drag is a cheap way to move it without a full redraw. g190 pins left:0;top:0 and puts
         the position INSIDE the matrix instead — so writing left/top mid-drag shoved the element
         to the stage corner while the matrix went on drawing it from its old spot. That is the
         "disappears when grabbed" and the flipped look Kirk saw: a matrix built for one place
         applied to an element sitting somewhere else.
         On such a scene the position now goes through the real render, which rebuilds the matrix
         from m.x/m.y — the only thing that knows where the piece belongs on the wall. */
      const wallPlaced=(scene.calibration||{}).mode==='corners'&&(scene.calibration||{}).homography;
      if(wallPlaced){this.draw();}
      else{placed.style.left=`${x}%`;placed.style.top=`${y}%`;}
    };
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);try{placed.releasePointerCapture?.(event.pointerId)}catch{}this.draw()};
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
  },

  /* ==========================================================================================
     g201 — SAY WHICH PATH THIS SCENE IS ON.
     ==========================================================================================
     Kirk, after g200: "in room designer, the image still looks flat with no 3d edge" — with a
     scene reading **Wall: 163" wide**, which is a SQUARE-ON measurement of a wall that turns away.
     The whole g190/g195/g200 chain is gated on `calibration.mode === 'corners'`. A square-on scene
     never enters it: no homography, no pose, no perspective, no edges. That is the square-on path
     working as designed — but from where he sits it is indistinguishable from a build that did not
     work, and he has now reported it four times.
     So the designer states which one it is, in his words, with the reason and the remedy. A tool
     that silently takes one of two paths owes the user a sentence about which.
     ========================================================================================== */
  wallModeNote(){
    const scene = this.scene() || {}, cal = scene.calibration || {};
    const cal2 = cal;
    const angled = cal.mode === 'corners' && cal.homography;
    if (!angled) {
      return 'This room is calibrated <b>square-on</b>, so a piece is placed flat against the wall '
        + 'and shows no side edges \u2014 which is correct for a wall facing the camera. '
        + 'If this wall turns away from the camera, recalibrate it in Scene Calibration under '
        + '<b>At an angle</b>; the piece will then sit on the wall\u2019s own plane and show its depth.';
    }
    if (!(Number(cal.focalPx) > 0)) {
      /* Says what is missing and what it costs, without overstating either. Guessing the lens was
         tried at g202 and made the SIZE wrong, which is worse than a missing edge. */
      return 'This room is calibrated <b>at an angle</b>, so the piece is placed at the wall\u2019s '
        + 'own scale and perspective \u2014 both exact. The lens was not recorded, so the piece is '
        + 'drawn flat, without the thickness of its canvas or frame. '
        + '<b>Set the lens in Scene Calibration</b> (or read it from the photograph) to get that.';
    }
    /* g204 — SAY HOW MUCH EDGE THERE ACTUALLY IS. Measured on his own room — a 163in wall, 17mm
       lens, a 36x24 canvas near the middle — a 1.5in edge comes to about ONE PIXEL at 100% and two
       at 200%. That is not a fault: 1.5in on a 36in piece is 4% of its width, and the wall in that
       photograph is only mildly turned. But "it looks flat" and "the edge is two pixels" are the
       same picture, and he has no way to tell them apart without being told which.
       So the note reports the actual figure. A number he can check beats an assurance he cannot. */
    /* g207 — SAY THE NUMBERS THIS DEPENDS ON. Kirk has now recalibrated, locked, set the lens and
       still sees nothing, and each round costs him a screenshot and me a guess. The note now
       states the wall width, the focal length and where it came from, so one look tells us both
       whether the scene actually carries what the render needs — rather than me inferring it from
       a photograph of a photograph. */
    const px = Number(this._wallEdgePx) > 0 ? Number(this._wallEdgePx) : 0;
    /* g208 — THE READOUT SAID "0in wall" AND THAT WAS MY OWN BUG, not bad data: saveCalibration
       writes the width to `scene.wallWidth`, not onto the calibration object. A diagnostic that
       reports a wrong number is worse than none — it sent us both looking at the save. */
    const diag = ' <span class="muted">[' + Math.round(Number(scene.wallWidth) || 0) + 'in wall, '
      + (Number(cal2.focalPx) > 0 ? Math.round(Number(cal2.focalPx)) + 'px lens' : 'NO LENS')
      + (cal2.focalSourceKind ? ' \u00b7 ' + cal2.focalSourceKind : '') + ']</span>';
    return 'This room is calibrated <b>at an angle</b> and the lens is set, so the piece sits on '
      + 'the wall\u2019s own plane with its real thickness.'
      + diag
      + (px ? ` At this zoom its edge is about <b>${px < 1 ? px.toFixed(1) : Math.round(px)} px</b> — `
            + (px < 3
               ? 'a piece facing the camera shows almost none of its side, which is correct. '
                 + 'Zoom in, or move it towards the end of the wall that turns away, to see more.'
               : 'visible on the near side.')
          : '');
  },

  renderPresentation(){
    const sf=window.SF,art=this.art(),scene=this.scene(),m=this.model;
    if(!art||!scene)return alert('Select artwork and a calibrated room first.');
    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal room-render-modal"><div class="modal-head"><h2>Render Presentation</h2><button class="close-button" id="closeRoomRender">×</button></div><p>Choose the client-ready version you want to export.</p><div class="render-choice-grid"><button class="render-choice" id="renderClean"><b>Clean Room Presentation</b><span>Exports only the room and artwork, without measurement guides.</span></button><button class="render-choice" id="renderMeasured"><b>Measured Client Presentation</b><span>Includes the accurate finished width and height around the piece.</span></button></div><div id="roomRenderStatus" class="help"></div></div></div>`;
    sf.$('closeRoomRender').onclick=()=>sf.closeModal();
    sf.$('renderClean').onclick=()=>this.capturePresentation(false);
    sf.$('renderMeasured').onclick=()=>this.capturePresentation(true);
  },

  async capturePresentation(withMeasurements){
    const sf=window.SF,m=this.model,art=this.art();
    const previousMeasurements=m.showMeasurements,previousMode=m.mode;
    m.showMeasurements=withMeasurements;
    m.mode=withMeasurements?'place':'preview';
    sf.closeModal();
    this.render();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const target=document.querySelector('.stage-viewport');
    if(!target||!sf.api?.capturePresentation){
      m.showMeasurements=previousMeasurements;m.mode=previousMode;this.render();
      return alert('Presentation rendering is unavailable in this environment.');
    }
    const rect=target.getBoundingClientRect();
    const title=(art?.title||'StudioFlow-Presentation').replace(/[^a-z0-9-_ ]/gi,'').trim().replace(/\s+/g,'-');
    const result=await sf.api.capturePresentation({rect:{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)},name:`${title||'StudioFlow-Presentation'}${withMeasurements?'-Measured':''}.png`});
    m.showMeasurements=previousMeasurements;m.mode=previousMode;this.render();
    if(result?.ok===false)alert(result.error||'The presentation could not be rendered.');
  },

  async exportProject(){
    const sf=window.SF,art=this.art(),scene=this.scene(),m=this.model;
    if(!art||!scene)return alert('Select artwork and a room first.');
    const payload={format:'StudioFlow Room Project',version:'3.3.1',createdAt:new Date().toISOString(),artwork:{id:art.id||art.artworkId,title:art.title},scene:{id:scene.id,name:scene.name},settings:{...m,undo:[],redo:[]}};
    const name=(art.title||'Room-Project').replace(/[^a-z0-9-_ ]/gi,'').trim().replace(/\s+/g,'-');
    if(sf.api?.saveText)await sf.api.saveText({name:`${name||'Room-Project'}.studioflow-room.json`,text:JSON.stringify(payload,null,2)});
  },

  saveProject(){
    const sf=window.SF,art=this.art(),scene=this.scene();
    if(!art||!scene)return alert('Select both artwork and a scene.');
    const existing=this.model.projectId
      ? (sf.state.roomProjects||[]).find(p=>p.id===this.model.projectId)
      : null;
    const suggested=existing?.name||`${art.title} — ${scene.name}`;

    sf.$('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal room-save-modal">
      <div class="modal-head">
        <h2>${existing?'Update':'Save'} Room Project</h2>
        <button class="close-button" id="closeRoomSave">×</button>
      </div>
      <label>Project Name</label>
      <input id="roomProjectName" value="${sf.esc(suggested)}">
      <div class="project-save-summary">
        <div><span>Artwork</span><b>${sf.esc(art.title)}</b></div>
        <div><span>Scene</span><b>${sf.esc(scene.name)}</b></div>
        <div><span>Presentation</span><b>${sf.esc(this.model.medium)}</b></div>
        <div><span>Image Size</span><b>${this.model.imageWidth} × ${this.model.imageHeight} inches</b></div>
      </div>
      <div id="roomSaveStatus"></div>
      <div class="row-actions">
        <button class="button primary" id="confirmRoomSave">${existing?'Update Project':'Save Project'}</button>
        <button class="button secondary" id="cancelRoomSave">Cancel</button>
      </div>
    </div></div>`;

    sf.$('closeRoomSave').addEventListener('click',()=>sf.closeModal());
    sf.$('cancelRoomSave').addEventListener('click',()=>sf.closeModal());
    sf.$('confirmRoomSave').addEventListener('click',()=>this.commitProjectSave());
    setTimeout(()=>sf.$('roomProjectName')?.select(),0);
  },

  async commitProjectSave(){
    const sf=window.SF,art=this.art(),scene=this.scene(),m=this.model;
    const name=sf.$('roomProjectName').value.trim();
    if(!name)return alert('Enter a project name.');

    try{
      if(!Array.isArray(sf.state.roomProjects))sf.state.roomProjects=[];
      const now=new Date().toISOString();
      const settings=JSON.parse(JSON.stringify({...this.model,undo:[],redo:[]}));
      let project;

      if(this.model.projectId){
        project=sf.state.roomProjects.find(p=>p.id===this.model.projectId);
      }

      if(project){
        Object.assign(project,{
          name,updatedAt:now,artworkId:art.id||art.artworkId,externalImage:m.externalImage||'',externalName:m.externalName||'',sceneId:scene.id,settings
        });
        sf.logActivity(`Updated room project: ${name}`);
      }else{
        const id=sf.makeId('ROOM');
        project={
          id,name,createdAt:now,updatedAt:now,
          artworkId:art.id||art.artworkId,externalImage:m.externalImage||'',externalName:m.externalName||'',sceneId:scene.id,settings
        };
        sf.state.roomProjects.push(project);
        this.model.projectId=id;
        sf.logActivity(`Saved room project: ${name}`);
      }

      const result=await sf.persist();
      if(result && result.ok===false){
        throw new Error(result.error||'StudioFlow could not write the project database.');
      }

      const verified=sf.state.roomProjects.some(p=>p.id===project.id);
      if(!verified)throw new Error('The project was not found after saving.');

      sf.$('roomSaveStatus').innerHTML='<div class="install-status">Room project saved successfully.</div>';
      setTimeout(()=>{
        sf.closeModal();
        sf.goTo('Saved Room Projects');
      },450);
    }catch(error){
      sf.logError(error,'Save Room Project');
      sf.$('roomSaveStatus').innerHTML=`<div class="save-error">Project could not be saved: ${sf.esc(error.message||String(error))}</div>`;
    }
  }
};

/* g86 — CASCADING SCENE PICKER
   One "Choose scene" list becomes Collection → Series → Room, so the list stays usable once the
   whole room library is loaded instead of becoming one enormous roll.

   Two decisions worth knowing:

   1. The options are built from the SCENES THAT ACTUALLY EXIST, not from scene-wizard.js's
      hard-coded vocabulary. If no Coastal room has been made yet, "Coastal" is not offered — an
      option that leads to an empty result is worse than no option.

   2. Collection + Series + Room does not always land on exactly one scene: two variations of the
      same room (different angle, different time of day) share all three. When that happens a
      fourth "Variation" select appears; when only one matches it is selected automatically and no
      fourth control is shown. So it is Kirk's four dropdowns in the normal case, and nothing
      becomes unreachable in the case he hasn't hit yet.

   Scenes made before the wizard existed carry only `style` and `room`, so every read falls back
   through collection||style and roomType||room, and anything still blank files under "Unfiled"
   rather than vanishing. */
Object.assign(window.SFRoomDesigner,{
  sceneFilter:{collection:'',family:'',roomType:''},
  UNFILED:'Unfiled',
  sceneCollection(s){return String(s.collection||s.style||'').trim()||this.UNFILED;},
  sceneFamily(s){return String(s.productionFamily||s.family||'').trim()||this.UNFILED;},
  /* g88: Kirk's rooms are named "Bedroom 1", "Bedroom 2" where a room was shot more than once.
     Read as-is, those are two DIFFERENT rooms and the list grows one entry per variation, which is
     the long-list problem the picker exists to solve. So a trailing number is stripped for
     grouping and becomes the variation instead -- the same trick seriesName() uses to fold eight
     years of "Moss Street 2019/2020/..." into one market. Only a trailing number is stripped, so
     "Bedroom" and "Suite 100" are left alone... note "Suite 100" WOULD be folded to "Suite"; that
     is the accepted cost of the rule and is why the variation label keeps the full original name. */
  ROOM_NUM:/^(.*?)[\s#\-]*(\d+)\s*$/,
  sceneRoomType(s){
    const raw=String(s.roomType||s.room||'').trim();
    if(!raw) return this.UNFILED;
    const m=raw.match(this.ROOM_NUM);
    return (m&&m[1].trim())?m[1].trim():raw;
  },
  sceneRoomNumber(s){
    const raw=String(s.roomType||s.room||'').trim();
    const m=raw.match(this.ROOM_NUM);
    return (m&&m[1].trim())?m[2]:'';
  },
  // The variation needs to be nameable: prefer its own display name, else "Bedroom 2".
  sceneVariantLabel(s){
    const name=String(s.displayName||s.name||s.internalName||'').trim();
    if(name) return name;
    const raw=String(s.roomType||s.room||'').trim();
    return raw||'Room';
  },
  sceneLabel(s){return String(s.displayName||s.name||s.internalName||'Room').trim();},

  // Keep the three filters pointing at whatever scene is actually loaded, so opening a saved
  // project shows the dropdowns already narrowed to that room rather than reading "All".
  syncFilterToScene(){
    const s=(this.sceneCatalog()||[]).find(x=>String(x.id)===String(this.model.sceneId));
    if(!s)return;
    this.sceneFilter={collection:this.sceneCollection(s),family:this.sceneFamily(s),roomType:this.sceneRoomType(s)};
  },
  scenesMatching(level){
    const f=this.sceneFilter;
    return (this.sceneCatalog()||[]).filter(s=>{
      if(level!=='collection'&&f.collection&&this.sceneCollection(s)!==f.collection)return false;
      if(level==='room'||level==='scene'){if(f.family&&this.sceneFamily(s)!==f.family)return false;}
      if(level==='scene'){if(f.roomType&&this.sceneRoomType(s)!==f.roomType)return false;}
      return true;
    });
  },
  uniqueValues(list,fn){
    const seen=[...new Set(list.map(fn))];
    // "Unfiled" always sinks to the bottom; everything else alphabetical.
    return seen.sort((a,b)=>(a===this.UNFILED)-(b===this.UNFILED)||a.localeCompare(b));
  },
  scenePickerHtml(){
    const sf=window.SF,f=this.sceneFilter;
    const total=(this.sceneCatalog()||[]).length;
    // bind() calls sf.$('rdScene').addEventListener with no null guard, so this element has to
    // exist on every path -- including the empty one -- or opening the page throws.
    if(!total)return `<label>Scene</label><div class="help">No rooms yet. Build one under Scene Packs, then it appears here.</div><select id="rdScene" style="display:none"></select>`;
    const sel=(id,label,value,options,hint)=>`<label>${label}</label>
      <select id="${id}"><option value="">${hint}</option>${options.map(o=>
        `<option value="${sf.esc(o)}" ${o===value?'selected':''}>${sf.esc(o)}</option>`).join('')}</select>`;

    const collections=this.uniqueValues(this.scenesMatching('collection'),s=>this.sceneCollection(s));
    const families=this.uniqueValues(this.scenesMatching('family'),s=>this.sceneFamily(s));
    const rooms=this.uniqueValues(this.scenesMatching('room'),s=>this.sceneRoomType(s));
    const matches=this.scenesMatching('scene');

    /* g88: Kirk's scenes carry no productionFamily, so Series offered only "All series" and
       "Unfiled" -- a control with nothing in it. Show it only when something real populates it,
       leaving Collection -> Room -> Variation, which is what his library actually has. If he
       starts filing scenes into series later, the dropdown reappears on its own. */
    const hasFamilies=families.some(x=>x!==this.UNFILED);
    if(!hasFamilies&&f.family){f.family='';}
    let html=`<div class="rd-scene-picker">
      ${sel('rdCollection','Collection',f.collection,collections,'All collections')}
      ${hasFamilies?sel('rdFamily','Series',f.family,families,'All series'):''}
      ${sel('rdRoomType','Room',f.roomType,rooms,'All rooms')}`;
    // Fourth control only when the first three genuinely don't disambiguate.
    if(matches.length>1){
      html+=`<label>Variation <small class="muted">${matches.length} to choose from</small></label>
        <select id="rdScene"><option value="">Choose one</option>${matches.map(s=>
          `<option value="${sf.esc(s.id)}" ${String(s.id)===String(this.model.sceneId)?'selected':''}>${sf.esc(this.sceneVariantLabel(s))}</option>`).join('')}</select>`;
    }else{
      // Hidden select keeps every existing rdScene reference in bind()/draw() working unchanged.
      html+=`<select id="rdScene" style="display:none">${matches.map(s=>
        `<option value="${sf.esc(s.id)}" ${String(s.id)===String(this.model.sceneId)?'selected':''}>${sf.esc(this.sceneLabel(s))}</option>`).join('')}</select>
        <div class="help">${matches.length===1?`Room: <b>${sf.esc(this.sceneVariantLabel(matches[0]))}</b>`:'No room matches those choices yet.'}</div>`;
    }
    return html+`</div>`;
  },

  /* Applying a filter change: narrow, then drop any choice below it that the new selection has
     made impossible, then land on a scene if exactly one survives. Without the pruning, picking
     Modern while Room was set to "Boardroom" would silently show nothing. */
  applySceneFilter(level,value){
    const f=this.sceneFilter;
    f[level]=value;
    if(level==='collection'){f.family='';f.roomType='';}
    else if(level==='family'){f.roomType='';}
    const rooms=this.uniqueValues(this.scenesMatching('room'),s=>this.sceneRoomType(s));
    if(f.roomType&&!rooms.includes(f.roomType))f.roomType='';
    const matches=this.scenesMatching('scene');
    if(matches.length===1)this.selectScene(matches[0].id);
    else if(matches.length&&!matches.some(s=>String(s.id)===String(this.model.sceneId)))this.model.sceneId='';
    this.render();
  },
  // Same centring the original rdScene handler did, kept in one place now that two paths select.
  selectScene(id){
    const m=this.model;
    if(String(m.sceneId)===String(id))return;
    this.checkpoint();
    m.sceneId=id;
    const s=this.scene();
    m.x=s?.wallCenterX ?? (((s?.calibration?.wallLeft ?? 0)+(s?.calibration?.wallRight ?? 100))/2);
    m.y=s?.wallCenterY ?? (((s?.calibration?.wallTop ?? 0)+(s?.calibration?.wallBottom ?? 90))/2);
  }
});

(function(){
  const R=window.SFRoomDesigner;
  const origBind=R.bind, origRender=R.render;
  /* Filters follow the loaded project on the way IN, but must not fight the user afterwards:
     re-syncing on every render would snap "All collections" straight back to the selected room's
     own collection the moment it was chosen. So sync only on the first render, or when the
     selected scene has fallen outside the current filters (i.e. a project was loaded). */
  R.render=function(){
    const inSet=this.model.sceneId&&this.scenesMatching('scene').some(s=>String(s.id)===String(this.model.sceneId));
    if(this.model.sceneId&&(!this._pickerInit||!inSet))this.syncFilterToScene();
    this._pickerInit=true;
    return origRender.apply(this,arguments);
  };
  R.bind=function(){
    const r=origBind.apply(this,arguments);
    const on=(id,level)=>{const el=document.getElementById(id);if(el)el.onchange=e=>this.applySceneFilter(level,e.target.value);};
    on('rdCollection','collection');on('rdFamily','family');on('rdRoomType','roomType');
    return r;
  };
})();


/* StudioFlow g92 — MATCH ROOM LIGHTING, restored.
   The button was never dead: the live handler guessed from the scene's NAME ("night", "coastal")
   and set artTemperature to values like -3 or 5. Those two properties did nothing at all until
   g91, and the brightness/contrast it also set were 96-99% — invisible. So it ran, and had almost
   nothing to show for it.

   The real implementation was in room-designer.js.mine_backup, lost in the 29 July merge:
   sampleAmbient() reads the actual room photograph through a canvas and returns the average
   colour and brightness of the wall AROUND the piece, correcting for the object-fit:cover crop so
   the region sampled is really the wall behind it. That is what makes it match the room instead
   of matching a word in the room's name.

   Restored verbatim from the backup rather than rewritten, so the merge is undone rather than
   re-guessed. The keyword table is kept as the FALLBACK for scenes whose image a canvas can't
   read back (it fails quietly and returns null). */
Object.assign(window.SFRoomDesigner,{
  /* g98: THIS LINE WAS THE WHOLE BUG. When g92 lifted artworkRegion and sampleAmbient out of the
     backup by brace-matching each function, this one-line property sitting between them was left
     behind. sampleAmbient's first act is to read this._ambientCache[key], so every click threw
     "Cannot read properties of undefined" before touching a pixel — no error dialog, no visible
     effect, which is exactly what Kirk reported twice. Extracting functions is not the same as
     extracting what they depend on. */
  _ambientCache:{},
artworkRegion(w,h){
    const m=this.model, scene=this.scene()||{};
    const xPct=m.x??scene.wallCenterX??50, yPct=m.y??scene.wallCenterY??45;
    let ww=w,hh=h;
    if(ww==null||hh==null){
      const el=document.getElementById('rdPlacedArt');
      ww=el?.offsetWidth||120; hh=el?.offsetHeight||90;
    }
    return {xPct,yPct,w:ww,h:hh};
  },
sampleAmbient(scene,region){
    if(!scene)return null;
    const src=scene.backgroundLayer||scene.image||'';
    const regionKey=region?`${Math.round(region.xPct)}:${Math.round(region.yPct)}:${Math.round(region.w)}:${Math.round(region.h)}`:'whole';
    const key=(scene.id||'')+'|'+src+'|'+regionKey;
    if(this._ambientCache[key])return this._ambientCache[key];
    if(this._ambientCache[key]===false)return null;
    const imgEl=document.querySelector('#rdRoom .rd-background-layer');
    if(!imgEl||!imgEl.complete||!imgEl.naturalWidth)return null;
    try{
      const size=32;
      const canvas=document.createElement('canvas');
      canvas.width=size;canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(region){
        // Map the artwork's on-screen position to the room photo's natural pixel space, accounting
        // for the object-fit:cover crop (the displayed image is scaled to fill the container, with
        // one axis cropped) so the sampled region really is the wall behind/around the piece.
        const rect=imgEl.getBoundingClientRect();
        const boxW=Math.max(1,rect.width), boxH=Math.max(1,rect.height);
        const naturalW=imgEl.naturalWidth, naturalH=imgEl.naturalHeight;
        const containerAspect=boxW/boxH, imageAspect=naturalW/naturalH;
        let dispW,dispH,cropX,cropY;
        if(imageAspect>containerAspect){dispH=naturalH;dispW=naturalH*containerAspect;cropX=(naturalW-dispW)/2;cropY=0}
        else{dispW=naturalW;dispH=naturalW/containerAspect;cropX=0;cropY=(naturalH-dispH)/2}
        const scaleX=dispW/boxW, scaleY=dispH/boxH;
        const centerX=cropX+(region.xPct/100)*boxW*scaleX;
        const centerY=cropY+(region.yPct/100)*boxH*scaleY;
        // Sample a region a bit larger than the piece itself, capturing the surrounding wall.
        const sampleW=Math.max(24,region.w*scaleX*1.8);
        const sampleH=Math.max(24,region.h*scaleY*1.8);
        const sx=Math.max(0,Math.min(naturalW-1,centerX-sampleW/2));
        const sy=Math.max(0,Math.min(naturalH-1,centerY-sampleH/2));
        const sw=Math.max(1,Math.min(naturalW-sx,sampleW));
        const sh2=Math.max(1,Math.min(naturalH-sy,sampleH));
        ctx.drawImage(imgEl,sx,sy,sw,sh2,0,0,size,size);
      }else{
        ctx.drawImage(imgEl,0,0,size,size);
      }
      const data=ctx.getImageData(0,0,size,size).data;
      let r=0,g=0,b=0,n=0;
      for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2];n++}
      r/=n;g/=n;b/=n;
      const brightness=(r*0.299+g*0.587+b*0.114)/255;
      const result={r:Math.round(r),g:Math.round(g),b:Math.round(b),brightness:Number(brightness.toFixed(3))};
      this._ambientCache[key]=result;
      return result;
    }catch(error){
      // Some room images (e.g. loaded from an unusual source) can't be read back by canvas.
      // Fail quietly and fall back to the manual blend sliders rather than breaking the render.
      console.warn('StudioFlow: room colour sampling unavailable for this scene, using manual blend controls instead.',error);
      this._ambientCache[key]=false;
      return null;
    }
  }
});

(function(){
  const R=window.SFRoomDesigner, origBind=R.bind;
  /* Feedback line under the button. Kirk could not tell whether Match Room had run, because a
     correct match on a neutral room legitimately changes very little. Now it states what it
     sampled and what it set, so "it did nothing" and "it did nothing visible, correctly" can be
     told apart without reading the sliders. */
  R.paintMatchInfo=function(){
    const host=document.getElementById('rdMatchInfo');
    if(!host)return;
    const m=this.model, info=m._matchRoomInfo;
    if(!m._matchRoomSource){host.innerHTML='';return;}
    const sf=window.SF;
    if(m._matchRoomSource==='sampled'&&info){
      const warmth=info.r-info.b;
      const word=warmth>18?'warm':warmth<-18?'cool':'fairly neutral';
      const ov=this.blendOverlay();
      host.innerHTML=`<span class="rd-match-swatch" style="background:${ov.color}"
          title="The colour being blended over the artwork"></span>
        Sampled the wall around the piece: <b>${word}</b>
        (R${info.r} G${info.g} B${info.b}, ${Math.round(info.brightness*100)}% bright).
        Set temperature <b>${m.artTemperature>0?'+':''}${m.artTemperature}</b>,
        tint <b>${m.artTint>0?'+':''}${m.artTint}</b>,
        brightness <b>${m.artBrightness}%</b>.
        Overlay <b>${Math.round(ov.opacity*100)}%</b> of that colour.
        ${word==='fairly neutral'?'A neutral room correctly needs very little.':''}`;
    }else if(m._matchRoomSource==='error'){
      host.innerHTML=`<b>Match Room Lighting failed:</b> ${sf.esc(m._matchRoomError||'unknown error')}. Nothing was changed.`;
    }else{
      host.innerHTML=`Couldn't read this room's image, so the settings were estimated from the
        scene name instead. Temperature <b>${m.artTemperature}</b>, brightness <b>${m.artBrightness}%</b>.`;
    }
  };
  R.matchRoom=function(){
    const sf=window.SF, m=this.model, scene=this.scene()||{};
    this.checkpoint();
    /* g98: previously an exception here died in the console and the button looked inert. Any
       failure now reports itself in the readout line instead of vanishing. */
    let ambient=null;
    try{ ambient=this.sampleAmbient(scene,this.artworkRegion()); }
    catch(err){
      console.error('StudioFlow: Match Room Lighting failed.',err);
      m._matchRoomSource='error'; m._matchRoomInfo=null;
      m._matchRoomError=String(err&&err.message||err);
      this.render(); this.paintMatchInfo();
      return;
    }
    if(ambient){
      // Derived from the real photograph. The /255*46 scaling and the tight brightness/contrast
      // clamps are the backup's own numbers -- deliberately gentle, since this sets a starting
      // point for the sliders rather than a finished grade.
      /* g95: the backup's original mapping was (r-b)/255*46, which on a normal room yields a
         temperature of 2 or 3 and a brightness of 99 — already almost invisible, and completely
         invisible once g92/g94 softened the sliders to a third of their strength. Kirk reported
         the button "did not seem to affect anything"; it was working and setting values too small
         to see. Scaled to 90 so a genuinely warm wall produces a genuinely warm setting, and
         brightness now swings around 100 rather than sitting just under it. A neutral wall still
         lands near zero, which is correct — matching a neutral room SHOULD do very little. */
      m.artTemperature=Math.max(-30,Math.min(30,Math.round((ambient.r-ambient.b)/255*90)));
      m.artTint=Math.max(-30,Math.min(30,Math.round((ambient.g-(ambient.r+ambient.b)/2)/255*90)));
      m.artBrightness=Math.max(85,Math.min(115,Math.round(100+(ambient.brightness-0.5)*40)));
      m.artContrast=Math.max(92,Math.min(104,Math.round(100-(ambient.brightness-0.5)*10)));
      m.artSaturation=97;
      m.wallColorBleed=true;
      m._matchRoomSource='sampled';
      m._matchRoomInfo={r:ambient.r,g:ambient.g,b:ambient.b,brightness:ambient.brightness};
    }else{
      const name=String(scene.name||scene.displayName||scene.style||'').toLowerCase();
      m.artTemperature=/night|cool|modern/.test(name)?-3:/late|warm|coastal|luxury|bedroom/.test(name)?5:2;
      m.artTint=/green|forest/.test(name)?-1:1;
      m.artBrightness=/night/.test(name)?90:98;
      m.artContrast=/soft|coastal|bedroom/.test(name)?96:99;
      m.artSaturation=98;
      m._matchRoomSource='guessed';
      m._matchRoomInfo=null;
    }
    this.render();
    this.paintMatchInfo();
  };
  R.bind=function(){
    const r=origBind.apply(this,arguments);
    // Replaces the name-guessing handler the original bind() just attached.
    const b=document.getElementById('rdMatchRoom');
    if(b)b.onclick=()=>this.matchRoom();
    /* g97: Reset Blend zeroes the sliders, but now that the overlay comes from the SAMPLE rather
       than from the sliders, clearing the sliders alone would leave the wall colour still laid
       over the piece — a reset that doesn't reset. Clear the sample too. */
    const rb=document.getElementById('rdResetBlend');
    if(rb)rb.onclick=()=>{
      this.checkpoint();
      Object.assign(this.model,{artTemperature:0,artTint:0,artBrightness:100,artContrast:100,artSaturation:100});
      delete this.model._matchRoomInfo;
      delete this.model._matchRoomSource;
      this.render();
      this.paintMatchInfo();
    };
    this.paintMatchInfo();
    return r;
  };
})();
