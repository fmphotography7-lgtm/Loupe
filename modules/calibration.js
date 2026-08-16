
window.SFCalibration = {
  model:{
    sceneId:'',
    floorPoint:null,
    ceilingPoint:null,
    wallLeft:null,
    wallRight:null,
    ceilingHeightInches:96,
    topClearanceInches:0,
    step:'floor',
    testWidth:36,
    testHeight:24,
    /* g164 — WHICH METHOD IS IN USE.
       'square'  Kirk's own: stand square on, know the ceiling, stack equal squares up the wall.
                 Correct, and only correct when the wall is square to the camera.
       'corners' the wall is at an ANGLE: click its four corners and let the perspective solver
                 work out the width. Both are kept — square-on is genuinely better square-on. */
    mode:'square',
    corners:[],
    focalPx:null,
    focalSource:'',
    manualWidth:null
  },

  scene(){
    return window.SF.state.scenes.find(s=>s.id===this.model.sceneId)||null;
  },

  loadScene(scene){
    const c=scene.calibration||{};
    this.model.sceneId=scene.id;
    this.model.floorPoint=c.floorPoint||null;
    this.model.ceilingPoint=c.ceilingPoint||null;
    this.model.wallLeft=c.wallLeft??null;
    this.model.wallRight=c.wallRight??null;
    this.model.ceilingHeightInches=c.ceilingHeightInches||scene.wallHeight||96;
    this.model.topClearanceInches=c.topClearanceInches??3;
    this.model.mode=c.mode==='corners'?'corners':'square';
    this.model.corners=Array.isArray(c.corners)?c.corners.slice():[];
    this.model.focalPx=c.focalPx||null;
    this.model.focalSource=c.focalSource||'';
    this.model.manualWidth=c.manualWidth||null;
    this.model.step='floor';
  },

  render(){
    const sf=window.SF,m=this.model,scene=this.scene();
    sf.$('workspace').innerHTML=`
      <div class="calibration-layout">
        <aside class="card calibration-panel">
          <h2>Scene Calibration</h2>
          <label>Scene</label>
          <select id="calScene">
            <option value="">Choose a scene</option>
            ${sf.state.scenes.map(s=>`<option value="${s.id}" ${s.id===m.sceneId?'selected':''}>${sf.esc(s.internalName||s.name)}</option>`).join('')}
          </select>

          <div class="help">
            Calibration squares are an internal authoring tool. The end user sees only accurate artwork dimensions and rulers.
          </div>
          ${scene?.calibrationLocked?'<div class="locked-notice">🔒 This production scene is approved and locked.</div>':''}

          <h3>Wall Height</h3>
          <label>Known Ceiling Height</label>
          <select id="calHeight">
            ${[96,108,120,144,168,192,216].map(v=>`<option value="${v}" ${v===m.ceilingHeightInches?'selected':''}>${v/12} ft (${v}")</option>`).join('')}
          </select>

          <h3>How is the wall sitting?</h3>
          <div class="row-actions">
            <button class="button ${m.mode==='square'?'primary':'secondary'}" id="calModeSquare">Square to the camera</button>
            <button class="button ${m.mode==='corners'?'primary':'secondary'}" id="calModeCorners">At an angle</button>
          </div>
          <div class="help">${m.mode==='square'
            ? 'The wall faces the camera, so one scale covers all of it \u2014 the height gives it, and the same square measures the width.'
            : 'The wall turns away, so the far end is smaller than the near end and no single scale fits. Clicking its four corners gives the whole surface instead.'}</div>

          ${m.mode==='corners'?`
            <h3>Click the wall\u2019s four corners</h3>
            <div class="cal-step ${m.corners.length===0?'active':''}">1. Bottom left \u2014 where the wall meets the floor</div>
            <div class="cal-step ${m.corners.length===1?'active':''}">2. Bottom right</div>
            <div class="cal-step ${m.corners.length===2?'active':''}">3. Top right \u2014 where it meets the ceiling</div>
            <div class="cal-step ${m.corners.length===3?'active':''}">4. Top left</div>
            <div class="help">Go round the same way every time. A fifth click starts again.</div>
            <div id="calSolveNote" class="help"></div>
            <div id="calLensBlock"></div>
          `:`
            <h3>Calibration Steps</h3>
            <div class="cal-step ${m.step==='floor'?'active':''}">1. Click the bottom of the display wall</div>
            <div class="cal-step ${m.step==='ceiling'?'active':''}">2. Click the top of the display wall</div>
            <div class="cal-step ${m.step==='left'?'active':''}">3. Click the actual left wall boundary</div>
            <div class="cal-step ${m.step==='right'?'active':''}">4. Click the actual right wall boundary</div>
          `}

          <div class="row-actions">
            <button class="button secondary" id="calReset">Reset Points</button>
            <button class="button primary" id="calSave" ${(this.isComplete()&&!scene?.calibrationLocked)?'':'disabled'}>Save Calibration</button>
          </div>
          <!-- g208 — WHY SAVE DID NOTHING. Kirk: "when i go to save calibration after choosing the
               lens it is not giving me the confirmation that it is saved. i have gone in and
               approve and locked..." He locked the room, then came back and set the lens — and a
               LOCKED room disables this button. So the click did nothing, silently, and the lens
               was never stored. A disabled control that does not say why is indistinguishable from
               a broken one, and it cost us three rounds. -->
          <div id="calSaveNote" class="help" style="margin-top:6px">${
            scene?.calibrationLocked
              ? '<span class="danger-text">This room is <b>locked</b>, so nothing here can be saved \u2014 including the lens. Unlock it on Scene Packs first, then set the lens and save.</span>'
              : (this.isComplete() ? '' : 'Finish clicking the corners to enable saving.')
          }</div>

          <h3>Test Artwork</h3>
          <div class="grid2">
            <div><label>Width</label><input id="calTestW" type="number" min="1" value="${m.testWidth}"></div>
            <div><label>Height</label><input id="calTestH" type="number" min="1" value="${m.testHeight}"></div>
          </div>
          <div id="calReadout" class="help"></div>
        </aside>

        <section class="card calibration-stage-card">
          <div class="designer-toolbar">
            <span>${scene?sf.esc(scene.name):'Choose a scene'}</span>
            <span>Internal calibration view</span>
          </div>
          <div class="calibration-stage-wrap">
            <div id="calStage" class="calibration-stage">
              ${scene?.backgroundLayer||scene?.image?`<img id="calRoomImage" src="${scene.backgroundLayer||scene.image}" class="calibration-room-image">`:'<div class="rd-placeholder">Choose a room image</div>'}
              <canvas id="calCanvas"></canvas>
            </div>
          </div>
        </section>
      </div>`;

    sf.$('calScene').addEventListener('change',e=>{
      const s=sf.state.scenes.find(x=>x.id===e.target.value);
      if(s)this.loadScene(s);
      else this.model.sceneId='';
      this.render();
    });
    sf.$('calHeight').addEventListener('change',e=>{m.ceilingHeightInches=+e.target.value;this.draw()});
    
    sf.$('calTestW').addEventListener('change',e=>{m.testWidth=Math.max(1,+e.target.value||1);this.draw()});
    sf.$('calTestH').addEventListener('change',e=>{m.testHeight=Math.max(1,+e.target.value||1);this.draw()});
    sf.$('calReset').addEventListener('click',()=>{Object.assign(m,{floorPoint:null,ceilingPoint:null,wallLeft:null,wallRight:null,corners:[],step:'floor'});this.render()});
    sf.$('calSave').addEventListener('click',()=>this.saveCalibration());
    sf.$('calModeSquare').addEventListener('click',()=>{m.mode='square';this.render()});
    sf.$('calModeCorners').addEventListener('click',()=>{m.mode='corners';this.render()});
    if(sf.$('calReadLens'))sf.$('calReadLens').addEventListener('click',()=>this.readLens());
    /* Picking from the list writes the same field a typed value would, so there is ONE path to the
       focal length rather than two that can disagree. */
    if(sf.$('calFocalPick'))sf.$('calFocalPick').addEventListener('change',e=>{
      const mm=Number(e.target.value)||0,sz=this.stagePx();
      if(!mm)return;
      m.focalMm=mm;
      /* g204 — a null stage width would silently store NO focal length, and the only sign would be
         a piece that stays flat. Refuse and say so instead. */
      if(!sz||!(sz.w>0)){alert('The room photograph is not loaded yet \u2014 open the scene, then set the lens.');return;}
      m.focalPx=sz.w*mm/36;
      m.focalSource=`${mm}mm equivalent, chosen`;
      this.render();
    });
    if(sf.$('calFocalMm'))sf.$('calFocalMm').addEventListener('change',e=>{
      /* Typed as a 35mm-EQUIVALENT because that is what a lens is labelled with and what a phone
         reports; converting here keeps millimetres out of the solver. */
      const mm=Number(e.target.value)||0,sz=this.stagePx();
      m.focalMm=mm>0?mm:0;
      m.focalPx=(mm>0&&sz)?sz.w*mm/36:null;
      m.focalSource=mm>0?`${mm}mm equivalent, typed`:'';
      this.render();
    });
    if(sf.$('calManualWidth'))sf.$('calManualWidth').addEventListener('change',e=>{
      m.manualWidth=Math.max(0,Number(e.target.value)||0)||null;this.render();
    });
    sf.$('calStage').addEventListener('click',e=>this.capturePoint(e));
    const roomImage=sf.$('calRoomImage');
    if(roomImage){
      const fitImage=()=>{
        const stage=sf.$('calStage');
        if(!stage||!roomImage.naturalWidth||!roomImage.naturalHeight)return;
        stage.style.aspectRatio=`${roomImage.naturalWidth}/${roomImage.naturalHeight}`;
        scene.imageWidthPixels=roomImage.naturalWidth;
        scene.imageHeightPixels=roomImage.naturalHeight;
        this.draw();
      };
      roomImage.addEventListener('load',fitImage);
      if(roomImage.complete)fitImage();
    }
    window.addEventListener('resize',this._resize||(this._resize=()=>{if(sf.currentPage==='Scene Calibration')this.draw()}));
    requestAnimationFrame(()=>this.draw());
  },

  isComplete(){
    const m=this.model;
    if(!m.sceneId)return false;
    if(m.mode==='corners'){
      const sol=this.solveCorners();
      return !!(sol&&sol.ok);
    }
    return !!(m.floorPoint&&m.ceilingPoint&&m.wallLeft!==null&&m.wallRight!==null);
  },

  capturePoint(e){
    if(!this.scene())return;
    const stage=window.SF.$('calStage'),rect=stage.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width*100;
    const y=(e.clientY-rect.top)/rect.height*100;
    const m=this.model;
    if(m.mode==='corners'){
      /* Four clicks, in the order the solver needs. A fifth starts again rather than being
         ignored — a stray click is far more likely than a wish to add a corner. */
      if(m.corners.length>=4)m.corners=[];
      m.corners.push({x,y});
      this.render();
      return;
    }
    if(m.step==='floor'){m.floorPoint={x,y};m.step='ceiling'}
    else if(m.step==='ceiling'){m.ceilingPoint={x,y};m.step='left'}
    else if(m.step==='left'){m.wallLeft=x;m.step='right'}
    else if(m.step==='right'){m.wallRight=x;m.step='done'}
    this.render();
  },

  /* ==========================================================================================
     g164 — THE ANGLED-WALL PATH.
     ==========================================================================================
     Everything below sits alongside metrics(), which is untouched: Kirk's square-on method is
     correct where it applies and BETTER there than the perspective solve, whose arithmetic starts
     dividing by almost nothing as the vanishing points run to infinity.

     Points are stored as PERCENTAGES of the stage, exactly as the existing steps are, so a
     calibration survives the window being resized. They are converted to PIXELS only at the moment
     of solving, because the solver works in the photograph's own coordinates.
     ========================================================================================== */
  stagePx(){
    const stage=window.SF.$('calStage');
    return stage?{w:stage.clientWidth,h:stage.clientHeight}:null;
  },
  cornersPx(){
    const sz=this.stagePx();
    if(!sz||this.model.corners.length!==4)return null;
    return this.model.corners.map(p=>({x:p.x/100*sz.w,y:p.y/100*sz.h}));
  },
  /* The PRINCIPAL POINT is the centre of the PHOTOGRAPH, not of the stage — they coincide here
     only because the stage is given the image's own aspect ratio on load. Taken from the stage so
     it stays right if that ever changes. */
  principal(){
    const sz=this.stagePx();
    return sz?{x:sz.w/2,y:sz.h/2}:null;
  },

  solveCorners(){
    const W=window.SFWallPerspective,m=this.model;
    if(!W)return {ok:false,reason:'The wall solver is not loaded.'};
    const pts=this.cornersPx(),p0=this.principal();
    if(!pts||!p0)return {ok:false,reason:'Click the wall\u2019s four corners.'};
    const sol=W.solveWall(pts,m.ceilingHeightInches,p0,m.focalPx||0);
    /* A width he measured himself is the last resort and beats everything — it is the one number
       in this whole calculation that was not inferred. */
    if((!sol||!sol.ok)&&m.manualWidth>0){
      const H3=W.homography(
        [{x:0,y:0},{x:m.manualWidth,y:0},{x:m.manualWidth,y:m.ceilingHeightInches},{x:0,y:m.ceilingHeightInches}],
        pts);
      if(H3)return {ok:true,method:'measured',widthInches:m.manualWidth,H3,corners:pts,
        note:'Using the wall width you measured yourself.'};
    }
    return sol;
  },

  /* Read the lens out of the photograph. Only ever offered when the solver ASKS for it, so it is
     not another button to wonder about. */
  /* g203 — ONE lens panel, rendered by BOTH branches so it cannot go missing from one of them.
     Kirk's own kit decides the list: "i shot this with a 17mm lens, but most of the lenses i will
     use for interior shots will be 16mm. we would also need phone as an option and .6 or .5 so if
     i get a client image i can ask what they shot it with."
     A phone's 0.5x and 0.6x are named the way the phone names them, because that is what a client
     will say when he asks — nobody replies "13 millimetres". */
  lensPanel(sol){
    const sf=window.SF,m=this.model,W=window.SFWallPerspective;
    const have=Number(m.focalPx)>0;
    const opts=(W.FOCAL_CHOICES||[]).map(c=>
      `<option value="${c.mm}" ${Number(m.focalMm)===c.mm?'selected':''}>${sf.esc(c.name)}</option>`).join('');
    return `
      <div class="help" style="margin-top:10px">
        ${have
          ? `Lens: <b>${sf.esc(m.focalSource||'set')}</b>. The piece will sit on this wall with its real thickness
             \u2014 <b>press Save calibration</b> to keep it.`
          : 'The wall is measured. <b>Set the lens</b> to give a canvas or frame its real thickness \u2014 without it the piece is placed flat.'}
      </div>
      <div class="row-actions" style="margin-top:6px">
        <button class="button secondary" id="calReadLens">Read it from the photo</button>
      </div>
      <div class="grid2" style="margin-top:6px">
        <div><label>Pick the lens</label><select id="calFocalPick">
          <option value="">\u2014 choose \u2014</option>${opts}
        </select></div>
        <div><label>Or type it (35mm equivalent)</label>
          <input id="calFocalMm" type="number" min="1" step="0.1" placeholder="e.g. 16" value="${m.focalMm||''}"></div>
      </div>`;
  },

  async readLens(){
    const sf=window.SF,scene=this.scene(),m=this.model;
    const src=scene&&(scene.backgroundLayer||scene.image)||'';
    const path=String(src).replace(/^file:\/\/\//,'').replace(/%20/g,' ');
    const out=sf.$('calLensNote');
    if(!path||/^data:/.test(String(src))){
      if(out)out.textContent='This scene\u2019s picture is stored inside the database rather than as a file, so its EXIF cannot be read. Type the focal length or a measured width instead.';
      return;
    }
    const r=await sf.api.imageLensInfo?.(path);
    if(!r||!r.ok){
      if(out)out.textContent=(r&&r.error)||'The photograph\u2019s details could not be read.';
      return;
    }
    /* THE IMAGE'S OWN PIXEL WIDTH is what the focal length must be expressed against — not the
       stage width. Converting to stage pixels afterwards is what keeps the solve consistent. */
    const px=window.SFWallPerspective.focalPxFromExif(
      {FocalLengthIn35mmFormat:r.focalLength35,FocalLength:r.focalLength}, r.width);
    if(!px){
      if(out)out.textContent=r.note||'That photograph does not carry enough lens information.';
      return;
    }
    const sz=this.stagePx();
    const scale=(sz&&r.width)?sz.w/r.width:1;
    m.focalPx=px*scale;
    m.focalSource=`${r.make||''} ${r.model||''}`.trim()||'the photograph';
    this.render();
  },

  metrics(){
    const m=this.model,stage=window.SF.$('calStage');
    if(!stage||!m.floorPoint||!m.ceilingPoint||m.wallLeft===null||m.wallRight===null)return null;
    const topY=Math.min(m.floorPoint.y,m.ceilingPoint.y);
    const bottomY=Math.max(m.floorPoint.y,m.ceilingPoint.y);
    const left=Math.min(m.wallLeft,m.wallRight);
    const right=Math.max(m.wallLeft,m.wallRight);
    const wallPixelHeight=(bottomY-topY)/100*stage.clientHeight;
    const ppi=wallPixelHeight/m.ceilingHeightInches;
    const wallPixelWidth=(right-left)/100*stage.clientWidth;
    const wallWidthInches=wallPixelWidth/ppi;
    return {ppi,topY,bottomY,left,right,wallPixelHeight,wallPixelWidth,wallWidthInches};
  },

  draw(){
    const sf=window.SF,m=this.model,canvas=sf.$('calCanvas'),stage=sf.$('calStage');
    if(!canvas||!stage)return;
    canvas.width=stage.clientWidth;
    canvas.height=stage.clientHeight;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const blue='#49a6df';
    ctx.strokeStyle=blue;ctx.fillStyle=blue;ctx.lineWidth=2;
    ctx.font='12px Segoe UI';

    const px=p=>({x:p.x/100*canvas.width,y:p.y/100*canvas.height});

    if(m.floorPoint&&m.ceilingPoint){
      const f=px(m.floorPoint),c=px(m.ceilingPoint);
      const total=m.ceilingHeightInches/12;
      const square=Math.abs(f.y-c.y)/total;
      const x=c.x;
      ctx.save();
      ctx.strokeStyle=blue;ctx.lineWidth=1.5;
      for(let i=0;i<total;i++){
        const y=f.y-square*(i+1);
        ctx.strokeRect(x,y,square,square);
        ctx.fillText(String(i+1),x+square/2-4,y+square/2+4);
      }
      ctx.restore();
    }

    /* ==========================================================================================
       g164 — DRAWING THE ANGLED WALL.
       The grid is the PROOF. A wall that has been solved correctly gets a grid whose squares are
       one foot on the WALL — so they shrink towards the far end and their verticals converge.
       If that grid does not sit on the room's own lines, the solve is wrong and it is obvious at a
       glance; a number in a readout could be wrong for a long time without anyone noticing.
       ========================================================================================== */
    if(m.mode==='corners'){
      const W=window.SFWallPerspective;
      const pts=this.cornersPx();
      ctx.fillStyle='#ffcf5a';
      (this.cornersPx()||[]).forEach((q,i)=>{
        ctx.beginPath();ctx.arc(q.x,q.y,6,0,Math.PI*2);ctx.fill();
        ctx.fillText(['bottom left','bottom right','top right','top left'][i],q.x+10,q.y-8);
      });
      const sol=(m.corners.length===4)?this.solveCorners():null;
      const note=sf.$('calSolveNote'),lens=sf.$('calLensBlock');
      if(sol&&sol.ok&&sol.H3){
        const P=p=>W.apply(sol.H3,p);
        const wIn=sol.widthInches,hIn=m.ceilingHeightInches;
        ctx.save();
        ctx.strokeStyle='rgba(73,166,223,.85)';ctx.lineWidth=1;
        for(let ft=0;ft<=Math.floor(wIn/12);ft++){
          const a=P({x:ft*12,y:0}),b=P({x:ft*12,y:hIn});
          if(a&&b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
        }
        for(let ft=0;ft<=Math.floor(hIn/12);ft++){
          const a=P({x:0,y:ft*12}),b=P({x:wIn,y:ft*12});
          if(a&&b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
        }
        ctx.restore();
        /* The test piece drawn ON the wall — a trapezium, because it lies on a surface that turns
           away. This is the thing the old single scale could never draw. */
        const q=W.quadFor(sol,Math.max(0,(wIn-m.testWidth)/2),Math.max(0,(hIn-m.testHeight)/2),
          m.testWidth,m.testHeight);
        if(q){
          ctx.strokeStyle='#ffffff';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);
          q.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
          ctx.closePath();ctx.stroke();
          ctx.fillStyle='#ffffff';
          ctx.fillText(`${m.testWidth}" \u00d7 ${m.testHeight}"`,q[0].x+8,q[0].y-8);
        }
        const near=W.ppiAt(sol,2,hIn/2),far=W.ppiAt(sol,wIn-2,hIn/2);
        const spread=(near&&far)?Math.abs(near-far)/Math.max(near,far):0;
        if(sf.$('calReadout'))sf.$('calReadout').innerHTML=
          `Wall width: <b>${sol.widthInches.toFixed(1)}"</b><br>
           Wall height: <b>${hIn.toFixed(1)}"</b><br>
           Scale across the wall: <b>${near?near.toFixed(2):'?'}</b> to <b>${far?far.toFixed(2):'?'}</b> pixels per inch
           ${spread>0.08?'<br><span class="muted">The two ends differ, which is what an angled wall does \u2014 there is no single figure for the whole surface.</span>':''}`;
        if(note)note.innerHTML=`<b>Solved.</b> ${sf.esc(sol.note||'')}${
          sol.method==='level-camera'?` Using ${sf.esc(m.focalSource||'the lens')}.`:''}${
          sol.method==='measured'?'':''}`;
        /* g203 — THE PICKER WAS NEVER REACHED. Kirk: "i still do not see pick a lens anywhere in
           build 202." g202 added it to the branch that runs while a wall is UNSOLVED — and this
           is the SOLVED branch, which cleared the panel outright. A solved wall is exactly when he
           needs it: the lens is not needed to MEASURE the wall, it is needed to turn the flat map
           into a real plane so a canvas has thickness.
           LESSON, and it is the same shape as g142: when a fix is about what the user can reach,
           apply it to EVERY branch that renders that thing, not the one that prompted the report. */
        if(lens)lens.innerHTML=this.lensPanel(sol);
      }else{
        if(sf.$('calReadout'))sf.$('calReadout').textContent=
          m.corners.length<4?`Click the wall\u2019s corners \u2014 ${4-m.corners.length} to go.`:'';
        if(note)note.innerHTML=(m.corners.length===4&&sol)?`<b class="danger-text">${sf.esc(sol.reason||'Not solved.')}</b>`:'';
        /* g202 — THE LENS FIELDS NOW APPEAR WHENEVER THE WALL IS SOLVED AT AN ANGLE, not only when
           the solver could not manage without them. Kirk: "there is no where in scene calibration
           to add a camera. is that necissary for the 3d render". It was, and there was nowhere —
           because the fields were gated on the ONE outcome that cannot solve without them.
           But the focal length is ALSO what turns the flat wall map into a real plane, which is
           what draws a canvas's thickness. A wall that solved perfectly still needs it for that,
           and had no way to offer it. */
        if(lens)lens.innerHTML=(sol&&(sol.needs==='focal-or-width'||sol.ok))?`
          <div class="row-actions" style="margin-top:8px">
            <button class="button secondary" id="calReadLens">Read it from the photo</button>
          </div>
          <div class="grid2" style="margin-top:6px">
            <div><label>Lens (35mm equivalent)</label><input id="calFocalMm" type="number" min="1" step="0.1" placeholder="e.g. 26" value="${m.focalMm||''}"></div>
            <div><label>Or pick the lens</label><select id="calFocalPick">
              <option value="">\u2014</option>
              ${(window.SFWallPerspective.FOCAL_CHOICES||[]).map(c=>`<option value="${c.mm}">${c.name}</option>`).join('')}
            </select></div>
            <div><label>Or the wall width you measured</label><input id="calManualWidth" type="number" min="1" step="0.5" value="${m.manualWidth||''}"></div>
          </div>
          <div id="calLensNote" class="help"></div>`:'';
      }
      return;
    }

    const metric=this.metrics();
    if(metric){
      const top=metric.topY/100*canvas.height;
      const bottom=metric.bottomY/100*canvas.height;
      const left=metric.left/100*canvas.width;
      const right=metric.right/100*canvas.width;
      ctx.setLineDash([8,6]);ctx.strokeRect(left,top,right-left,bottom-top);ctx.setLineDash([]);
      ctx.fillText('CALIBRATED WALL BOUNDARY',left+8,top+18);

      const artW=m.testWidth*metric.ppi,artH=m.testHeight*metric.ppi;
      const cx=(left+right)/2,cy=(top+bottom)/2;
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2;
      ctx.strokeRect(cx-artW/2,cy-artH/2,artW,artH);
      ctx.fillStyle='#ffffff';ctx.fillText(`${m.testWidth}" × ${m.testHeight}"`,cx-artW/2+8,cy-artH/2+18);

      sf.$('calReadout').innerHTML=`Pixels per inch: <b>${metric.ppi.toFixed(3)}</b><br>
        Wall width: <b>${metric.wallWidthInches.toFixed(1)}"</b><br>
        Wall height: <b>${m.ceilingHeightInches.toFixed(1)}"</b>`;
    }else if(sf.$('calReadout')){
      sf.$('calReadout').textContent='Click the floor and ceiling seams to establish the scale.';
    }

    const points=[
      ['Floor',m.floorPoint],['Ceiling',m.ceilingPoint]
    ];
    ctx.fillStyle='#ffcf5a';
    for(const [label,p] of points){
      if(!p)continue;const q=px(p);
      ctx.beginPath();ctx.arc(q.x,q.y,6,0,Math.PI*2);ctx.fill();ctx.fillText(label,q.x+10,q.y-8);
    }
    if(m.wallLeft!==null){ctx.fillText('LEFT BOUNDARY',m.wallLeft/100*canvas.width+5,25)}
    if(m.wallRight!==null){ctx.fillText('RIGHT BOUNDARY',m.wallRight/100*canvas.width-110,25)}
  },

  /* g208 — one place that writes the outcome of the last save, so it cannot be missed. */
  saveNote(text, ok){
    try{
      const el=window.SF.$('calSaveNote');
      if(!el)return;
      el.innerHTML=`<span class="${ok?'ok-text':'danger-text'}">${window.SF.esc(text)}</span>`;
    }catch(e){}
  },

  async saveCalibration(){
    const sf=window.SF,m=this.model,scene=this.scene();

    /* g164 — SAVING AN ANGLED WALL. The homography is the calibration here; a single
       pixels-per-inch would be a lie on a surface whose scale changes across it, so `pixelsPerInch`
       is recorded as the scale AT THE CENTRE and labelled, rather than omitted (older code reads
       that key) or presented as though it held everywhere. */
    if(m.mode==='corners'){
      const sol=this.solveCorners();
      /* g208 — SAVE MUST NEVER LOOK LIKE NOTHING HAPPENED. Kirk: "when i go to save calibration
         after choosing the lens it is not giving me the confirmation that it is saved." An alert
         can be dismissed, missed, or suppressed; a line on the page cannot. Every outcome — solved,
         refused, or failed to persist — now writes to a readout that stays there, so the state of
         the last attempt is always readable rather than remembered. */
      if(!sol||!sol.ok){
        this.saveNote((sol&&sol.reason)||'The wall could not be solved yet.', false);
        return alert((sol&&sol.reason)||'The wall could not be solved yet.');
      }
      const W=window.SFWallPerspective;
      const centre=W.ppiAt(sol,sol.widthInches/2,m.ceilingHeightInches/2)||0;
      scene.wallHeight=m.ceilingHeightInches;
      scene.wallWidth=sol.widthInches;
      scene.calibrated=true;
      scene.productionStatus='Calibrated - Awaiting Approval';
      scene.calibrationLocked=false;
      scene.inLibrary=false;
      scene.calibration={
        mode:'corners',
        corners:m.corners.slice(),
        ceilingHeightInches:m.ceilingHeightInches,
        wallWidthInches:sol.widthInches,
        homography:sol.H3,
        method:sol.method,
        /* g204 — THE SOLVER'S OWN FOCAL LENGTH WAS BEING THROWN AWAY. Only `m.focalPx` — the value
           TYPED OR PICKED BY HAND — was saved. A wall solved by the perspective method computes a
           focal length as part of measuring itself (g163: it has to, to get the width at all), and
           that number was discarded at the moment of saving. So a perfectly solved angled wall
           reached the room designer with no camera, the pose could not be built, and the piece was
           drawn flat — which is exactly what Kirk kept seeing.
           His hand-picked value still wins, because he knows what he shot with; the solver's is the
           fallback. */
        focalPx:m.focalPx||sol.focal||null,
        focalSourceKind:m.focalPx?'chosen':(sol.focal?'solved':''),
        focalSource:m.focalSource||'',
        manualWidth:m.manualWidth||null,
        pixelsPerInch:centre,
        pixelsPerInchNote:'measured at the centre of the wall; the scale changes across an angled wall',
        stageWidthPixels:(this.stagePx()||{}).w||0,
        stageHeightPixels:(this.stagePx()||{}).h||0,
        imageWidthPixels:scene.imageWidthPixels||0,
        imageHeightPixels:scene.imageHeightPixels||0
      };
      /* The wall plane is the four corners themselves, in the same percentage form the square-on
         path uses, so anything already reading wallPlane keeps working. */
      scene.wallPlane={
        bottomLeft:m.corners[0],bottomRight:m.corners[1],
        topRight:m.corners[2],topLeft:m.corners[3]
      };
      scene.wallCenterX=m.corners.reduce((n,p)=>n+p.x,0)/4;
      scene.wallCenterY=m.corners.reduce((n,p)=>n+p.y,0)/4;
      sf.logActivity(`Calibrated angled wall: ${scene.name} (${sol.widthInches.toFixed(1)}" wide, ${sol.method})`);
      const r=await sf.persist();
      if(r&&r.ok===false){
        this.saveNote(r.error||'Calibration could not be saved.', false);
        return alert(r.error||'Calibration could not be saved.');
      }
      this.saveNote(`Saved \u2014 ${sol.widthInches.toFixed(1)} in across, ${sol.method}`
        + (m.focalPx>0?`, lens set`:`, no lens`), true);
      alert(`Saved. The wall measures ${sol.widthInches.toFixed(1)} inches across.\n\nOpening Scene Packs so you can approve and lock the room.`);
      return sf.goTo('Scene Packs');
    }

    const metric=this.metrics();
    if(!scene||!metric)return;
    scene.wallHeight=m.ceilingHeightInches;
    scene.wallWidth=metric.wallWidthInches;
    scene.wallCenterX=(metric.left+metric.right)/2;
    scene.wallCenterY=(metric.topY+metric.bottomY)/2;
    scene.calibrated=true;
    scene.productionStatus='Calibrated - Awaiting Approval';
    scene.calibrationLocked=false;
    scene.inLibrary=false;
    scene.calibration={
      mode:'square',
      floorPoint:m.floorPoint,
      ceilingPoint:m.ceilingPoint,
      ceilingHeightInches:m.ceilingHeightInches,
      pixelsPerInch:metric.ppi,
      wallLeft:metric.left,
      wallRight:metric.right,
      wallTop:metric.topY,
      wallBottom:metric.bottomY,
      imageWidthPixels:scene.imageWidthPixels||0,
      imageHeightPixels:scene.imageHeightPixels||0
    };
    scene.wallPlane={
      topLeft:{x:metric.left,y:metric.topY},
      topRight:{x:metric.right,y:metric.topY},
      bottomRight:{x:metric.right,y:metric.bottomY},
      bottomLeft:{x:metric.left,y:metric.bottomY}
    };
    sf.logActivity(`Calibrated scene: ${scene.name}`);
    const result=await sf.persist();
    if(result&&result.ok===false)return alert(result.error||'Calibration could not be saved.');
    alert('Calibration saved. Opening Scene Packs so you can approve and lock the room.');
    sf.goTo('Scene Packs');
  }
};
