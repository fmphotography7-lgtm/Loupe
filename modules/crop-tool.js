window.SFCropTool={
  ratioIndex:0, portrait:false, guide:'thirds', spiralFlip:0, box:null, imgEl:null, natW:0, natH:0, lastUrl:'', lastName:'',
  ratios:[
    {label:'3:2 · 16×24 · 24×36 · 36×48',w:3,h:2},
    {label:'4:3',w:4,h:3},
    {label:'9 × 13',w:13,h:9},
    {label:'11 × 14',w:14,h:11},
    {label:'12 × 18',w:18,h:12},
    {label:'13 × 19',w:19,h:13},
    {label:'17 × 25',w:25,h:17},
    {label:'20 × 40',w:40,h:20},
    {label:'20 × 60',w:60,h:20},
    {label:'30 × 60',w:60,h:30}
  ],
  guides:[['none','None'],['thirds','Thirds'],['grid','Grid'],['fifths','Fifths'],['diagonal','Diagonal'],['triangle','Triangle'],['golden','Golden ratio'],['spiral','Golden spiral']],
  currentRatio(){const r=this.ratios[this.ratioIndex]||this.ratios[0];return this.portrait?{w:r.h,h:r.w,label:r.label}:{w:r.w,h:r.h,label:r.label}},
  render(){
    const sf=window.SF;
    sf.$('workspace').innerHTML=`<div class="page-stack crop-tool">
      <div class="card"><div class="toolbar"><div><h2>Crop &amp; Ratio Preview</h2><p class="muted">Non-destructive — nothing is saved or changed. Load an image and try print ratios and composition guides to see how it crops.</p></div>
      <div class="row-actions"><label class="button primary">Load Image<input id="cropFile" type="file" accept="image/*" style="display:none"></label><button class="button secondary" id="cropCenter">Center crop</button></div></div>
      <div class="crop-orient" id="cropOrient"><button data-orient="landscape" class="${this.portrait?'':'active'}">▭ Landscape</button><button data-orient="portrait" class="${this.portrait?'active':''}">▯ Portrait</button></div>
      <div class="crop-ratios" id="cropRatios">${this.ratios.map((r,i)=>`<button data-ratio="${i}" class="${i===this.ratioIndex?'active':''}">${sf.esc(r.label)}</button>`).join('')}<button data-ratio="custom" class="crop-custom">＋ Custom size</button></div>
      <div class="crop-guides" id="cropGuides"><span class="crop-guides-label">Overlay:</span>${this.guides.map(([id,l])=>`<button data-guide="${id}" class="${id===this.guide?'active':''}">${l}</button>`).join('')}<button id="cropSpiralFlip" class="crop-spiral-flip" title="Cycle golden spiral through 4 orientations">↻ Spiral orientation</button></div></div>
      <div class="card"><div class="crop-workarea">
        <div class="crop-stage" id="cropStage"><div class="crop-empty" id="cropEmpty">Load an image to begin</div></div>
        <div class="crop-side"><h3>Cropped result</h3><div class="crop-preview-wrap"><canvas id="cropPreview" class="crop-preview-canvas"></canvas></div><p class="muted" id="cropInfo">No image loaded.</p></div>
      </div></div></div>`;
    sf.$('cropFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;this.load(URL.createObjectURL(f),f.name)};
    sf.$('cropCenter').onclick=()=>{this.resetBox();this.drawBox();this.updatePreview()};
    document.querySelectorAll('[data-orient]').forEach(b=>b.onclick=()=>{this.portrait=b.dataset.orient==='portrait';document.querySelectorAll('[data-orient]').forEach(x=>x.classList.toggle('active',x===b));this.resetBox();this.drawBox();this.paintGuide();this.updatePreview()});
    document.querySelectorAll('[data-ratio]').forEach(b=>b.onclick=async()=>{
      /* g147: was prompt(), which Electron does not implement — the button did nothing at all. */
      if(b.dataset.ratio==='custom'){const v=await sf.askText('Custom print size','Size or ratio','','e.g. 24 x 36 or 3:2','Either a print size in inches or a plain ratio. The longer number is taken as the long edge.');const m=v.match(/(\d+(?:\.\d+)?)\s*[x×:\s]\s*(\d+(?:\.\d+)?)/i);if(!m)return;let a=Number(m[1]),c=Number(m[2]);if(!a||!c)return;const w=Math.max(a,c),h=Math.min(a,c);this.ratios.push({label:`${a} × ${c}`,w,h});this.ratioIndex=this.ratios.length-1;this.portrait=(c>a);this.render();return}
      this.ratioIndex=+b.dataset.ratio;document.querySelectorAll('[data-ratio]').forEach(x=>x.classList.toggle('active',x===b));this.resetBox();this.drawBox();this.paintGuide();this.updatePreview();
    });
    document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>{this.guide=b.dataset.guide;document.querySelectorAll('[data-guide]').forEach(x=>x.classList.toggle('active',x===b));this.paintGuide()});
    sf.$('cropSpiralFlip').onclick=()=>{this.spiralFlip=(this.spiralFlip+1)%4;if(this.guide!=='spiral'){this.guide='spiral';document.querySelectorAll('[data-guide]').forEach(x=>x.classList.toggle('active',x.dataset.guide==='spiral'))}this.paintGuide()};
    if(this.lastUrl)this.load(this.lastUrl,this.lastName,true);
  },
  load(url,name,keepBox){
    const sf=window.SF,stage=sf.$('cropStage');if(!stage)return;this.lastUrl=url;this.lastName=name||'';
    stage.innerHTML=`<div class="crop-image-hold" id="cropHold"><img id="cropImg" alt="" draggable="false"><div class="crop-overlay" id="cropOverlay"><div class="crop-shade" id="cropShade"></div><div class="crop-box" id="cropBox"><svg class="crop-guide-svg" id="cropGuideSvg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><i class="crop-handle nw" data-h="nw"></i><i class="crop-handle ne" data-h="ne"></i><i class="crop-handle sw" data-h="sw"></i><i class="crop-handle se" data-h="se"></i></div></div></div>`;
    const img=sf.$('cropImg');this.imgEl=img;if(!keepBox)this.box=null;
    img.onload=()=>{this.natW=img.naturalWidth;this.natH=img.naturalHeight;if(!this.box)this.resetBox();this.drawBox();this.paintGuide();this.updatePreview();this.bind()};
    img.src=url;
  },
  dispRect(){const img=this.imgEl;return img?{w:img.clientWidth,h:img.clientHeight}:null},
  resetBox(){const d=this.dispRect();if(!d||!d.w)return;const r=this.currentRatio(),imgAR=d.w/d.h,boxAR=r.w/r.h;let fw,fh;if(boxAR>imgAR){fw=1;fh=imgAR/boxAR}else{fh=1;fw=boxAR/imgAR}fw*=0.9;fh*=0.9;this.box={x:(1-fw)/2,y:(1-fh)/2,w:fw,h:fh}},
  drawBox(){const sf=window.SF,box=sf.$('cropBox'),shade=sf.$('cropShade'),d=this.dispRect();if(!box||!d||!this.box)return;const L=this.box.x*d.w,T=this.box.y*d.h,W=this.box.w*d.w,H=this.box.h*d.h;box.style.left=L+'px';box.style.top=T+'px';box.style.width=W+'px';box.style.height=H+'px';if(shade)shade.style.clipPath=`polygon(0 0,100% 0,100% 100%,0 100%,0 ${T}px,${L}px ${T}px,${L}px ${T+H}px,${L+W}px ${T+H}px,${L+W}px ${T}px,0 ${T}px)`},
  paintGuide(){const sf=window.SF,svg=sf.$('cropGuideSvg');if(!svg)return;svg.innerHTML=this.guideSVG(this.guide)},
  guideSVG(type){
    const V=xs=>xs.map(x=>`M${x} 0L${x} 100`).join('');const H=ys=>ys.map(y=>`M0 ${y}L100 ${y}`).join('');
    const dense=()=>{const a=[];for(let i=5;i<100;i+=5)a.push(i);return a};
    const halo=d=>`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".42" stroke-width="1.6" vector-effect="non-scaling-stroke"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="0.75" vector-effect="non-scaling-stroke"/>`;
    if(type==='thirds')return halo(V([33.333,66.667])+H([33.333,66.667]));
    if(type==='grid')return halo(V(dense())+H(dense()));
    if(type==='fifths')return halo(V([20,40,60,80])+H([20,40,60,80]));
    const _r=this.currentRatio(),ar=_r.w/_r.h;
    if(type==='diagonal'){let d;if(ar<=1){const a=(ar*100).toFixed(2),b=((1-ar)*100).toFixed(2);d=`M0 0L100 ${a}M100 0L0 ${a}M0 100L100 ${b}M100 100L0 ${b}`;}else{const a=(100/ar).toFixed(2),b=(100-100/ar).toFixed(2);d=`M0 0L${a} 100M100 0L${b} 100M0 100L${a} 0M100 100L${b} 0`;}return halo(d);}
    if(type==='triangle'){const k=ar*ar/(ar*ar+1),f1=(k*100).toFixed(2),f2=((1-k)*100).toFixed(2);return halo(`M0 0L100 100M100 0L${f1} ${f1}M0 100L${f2} ${f2}`);}
    if(type==='golden')return halo(V([38.2,61.8])+H([38.2,61.8]));
    if(type==='spiral'){const sp=this.spiralPath(),tf=this.spiralTransform();return `<g transform="${tf}"><path d="${sp}" fill="none" stroke="#000" stroke-opacity=".42" stroke-width="1.8" vector-effect="non-scaling-stroke"/><path d="${sp}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="0.9" vector-effect="non-scaling-stroke"/></g>`+halo(V([38.2,61.8])+H([38.2,61.8])).replace(/stroke-opacity="\.85"/,'stroke-opacity=".22"').replace(/stroke-opacity="\.42"/,'stroke-opacity=".18"');}
    return '';
  },
  spiralTransform(){return ['','translate(100 0) scale(-1 1)','translate(0 100) scale(1 -1)','translate(100 100) scale(-1 -1)'][this.spiralFlip||0]||''},
  spiralPath(){const phi=1.618033988749895,b=Math.log(phi)/(Math.PI/2),pts=[];for(let deg=-760;deg<=170;deg+=5){const th=deg*Math.PI/180,r=Math.exp(b*th);pts.push([Math.cos(th)*r,Math.sin(th)*r])}let mnX=1e9,mxX=-1e9,mnY=1e9,mxY=-1e9;for(const[x,y]of pts){mnX=Math.min(mnX,x);mxX=Math.max(mxX,x);mnY=Math.min(mnY,y);mxY=Math.max(mxY,y)}const sw=mxX-mnX,sh=mxY-mnY,sc=Math.min(96/sw,96/sh),ox=(100-sw*sc)/2-mnX*sc,oy=(100-sh*sc)/2-mnY*sc;return 'M'+pts.map(([x,y])=>`${(x*sc+ox).toFixed(2)} ${(y*sc+oy).toFixed(2)}`).join('L')},
  bind(){
    const sf=window.SF,overlay=sf.$('cropOverlay'),box=sf.$('cropBox');if(!overlay||!box)return;
    const d=()=>this.dispRect();let mode=null,sx=0,sy=0,start=null;
    const toFrac=(dx,dy)=>{const r=d();return{fx:dx/r.w,fy:dy/r.h}};
    const down=(e,m)=>{mode=m;sx=e.clientX;sy=e.clientY;start={...this.box};box.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopPropagation()};
    box.addEventListener('pointerdown',e=>{if(e.target.classList.contains('crop-handle'))return;down(e,'move')});
    box.querySelectorAll('.crop-handle').forEach(hn=>hn.addEventListener('pointerdown',e=>down(e,'r-'+hn.dataset.h)));
    const move=e=>{if(!mode)return;const {fx,fy}=toFrac(e.clientX-sx,e.clientY-sy);
      if(mode==='move'){this.box={...start,x:Math.max(0,Math.min(start.x+fx,1-start.w)),y:Math.max(0,Math.min(start.y+fy,1-start.h))}}
      else{const r=this.currentRatio(),rect=d();let x=start.x,y=start.y,w=start.w,h=start.h;
        if(mode.includes('e'))w=Math.max(0.05,start.w+fx);
        if(mode.includes('w')){w=Math.max(0.05,start.w-fx);x=start.x+start.w-w}
        let pxW=w*rect.w,pxH=pxW*(r.h/r.w);h=pxH/rect.h;
        if(mode.includes('n'))y=start.y+start.h-h;
        if(x<0)x=0;if(y<0)y=0;if(x+w>1)w=1-x;if(y+h>1){h=1-y;const nW=(h*rect.h)*(r.w/r.h);w=nW/rect.w}
        this.box={x,y,w,h}}
      this.drawBox();this.updatePreview()};
    const up=e=>{mode=null;try{box.releasePointerCapture?.(e.pointerId)}catch{}};
    overlay.addEventListener('pointermove',move);overlay.addEventListener('pointerup',up);overlay.addEventListener('pointercancel',up);
    if(this._rez)window.removeEventListener('resize',this._rez);window.addEventListener('resize',this._rez=()=>{this.drawBox();this.updatePreview()});
  },
  updatePreview(){const sf=window.SF,cv=sf.$('cropPreview'),info=sf.$('cropInfo');if(!cv||!this.imgEl||!this.box)return;const cx=Math.round(this.box.x*this.natW),cy=Math.round(this.box.y*this.natH),cw=Math.max(1,Math.round(this.box.w*this.natW)),ch=Math.max(1,Math.round(this.box.h*this.natH)),scale=Math.min(1,360/cw);cv.width=Math.max(1,Math.round(cw*scale));cv.height=Math.max(1,Math.round(ch*scale));const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);try{ctx.drawImage(this.imgEl,cx,cy,cw,ch,0,0,cv.width,cv.height)}catch{}const r=this.currentRatio();if(info)info.textContent=`${r.label} · ${this.portrait?'portrait':'landscape'} · crop ${cw} × ${ch}px of ${this.natW} × ${this.natH}px original`}
};
