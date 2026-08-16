/* StudioFlow 3.4.3d · Clean Frame Assets and Neutral Opposed Inner Shadow
   Centralizes physical sizing, calibrated wall scaling, placement bounds,
   render-plan generation, and runtime diagnostics without changing business data. */
(function(){
  'use strict';

  const sf=window.SF;
  const rd=window.SFRoomDesigner;
  if(!sf||!rd)return;

  const finite=(value,fallback=0)=>{
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  };
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,finite(value,min)));
  const round=(value,places=3)=>{
    const p=10**places;
    return Math.round(finite(value)*p)/p;
  };

  const normalizeModel=model=>{
    const m=model||{};
    m.imageWidth=clamp(m.imageWidth,0.25,240);
    m.imageHeight=clamp(m.imageHeight,0.25,240);
    m.matWidth=clamp(m.matWidth,0,24);
    m.frameWidth=clamp(m.frameWidth,0,12);
    m.floatGap=clamp(m.floatGap,0,6);
    m.depth=clamp(m.depth,0.1,12);
    m.scale=clamp(m.scale||1,0.1,8);
    m.physicalScale=clamp(m.physicalScale??m.scale??1,0.1,8);
    m.rotation=clamp(m.rotation||0,-180,180);
    m.perspectiveX=clamp(m.perspectiveX||0,-45,45);
    m.perspectiveY=clamp(m.perspectiveY||0,-45,45);
    m.zoom=clamp(m.zoom||1,0.25,4);
    m.x=m.x===null||m.x===undefined?null:clamp(m.x,-100,200);
    m.y=m.y===null||m.y===undefined?null:clamp(m.y,-100,200);
    return m;
  };

  const finishedSize=model=>{
    const m=normalizeModel({...model});
    let width=m.imageWidth;
    let height=m.imageHeight;
    if(m.medium==='Framed Print'){
      width+=2*(m.matWidth+m.frameWidth);
      height+=2*(m.matWidth+m.frameWidth);
    }else if(m.medium==='Canvas'&&m.canvasFrame==='floating'){
      width+=2*(m.frameWidth+m.floatGap);
      height+=2*(m.frameWidth+m.floatGap);
    }
    const physicalScale=m.physicalScale;
    width*=physicalScale;
    height*=physicalScale;
    return {width:round(width),height:round(height),w:round(width),h:round(height)};
  };

  const wallGeometry=(scene,room)=>{
    if(!scene||!room)return null;
    const c=scene.calibration||{};
    const left=clamp(c.wallLeft??0,0,100);
    const right=clamp(c.wallRight??100,0,100);
    const top=clamp(c.wallTop??Math.min(c.floorPoint?.y??100,c.ceilingPoint?.y??0),0,100);
    const bottom=clamp(c.wallBottom??Math.max(c.floorPoint?.y??100,c.ceilingPoint?.y??0),0,100);
    const pixelWidth=Math.max(1,(right-left)/100*room.clientWidth);
    const physicalWidth=Math.max(1,finite(scene.wallWidth,144));
    const pixelsPerInch=pixelWidth/physicalWidth;
    return {
      left,right,top,bottom,
      centerX:round((left+right)/2),
      centerY:round((top+bottom)/2),
      pixelWidth:round(pixelWidth),
      physicalWidth:round(physicalWidth),
      pixelsPerInch:round(pixelsPerInch,5)
    };
  };

  const placementBounds=(size,wall,room)=>{
    if(!size||!wall||!room)return null;
    const halfWidthPct=(size.width*wall.pixelsPerInch/room.clientWidth)*50;
    const halfHeightPct=(size.height*wall.pixelsPerInch/room.clientHeight)*50;
    return {
      minX:round(wall.left+halfWidthPct),
      maxX:round(wall.right-halfWidthPct),
      minY:round(wall.top+halfHeightPct),
      maxY:round(wall.bottom-halfHeightPct),
      halfWidthPct:round(halfWidthPct),
      halfHeightPct:round(halfHeightPct),
      fits:halfWidthPct*2<=wall.right-wall.left&&halfHeightPct*2<=wall.bottom-wall.top
    };
  };

  const buildPlan=(model,scene,room)=>{
    const m=normalizeModel(model);
    const size=finishedSize(m);
    const wall=wallGeometry(scene,room);
    const bounds=placementBounds(size,wall,room);
    const pixelWidth=wall?round(size.width*wall.pixelsPerInch):0;
    const pixelHeight=wall?round(size.height*wall.pixelsPerInch):0;
    return {
      version:'3.4.3g',
      medium:m.medium,
      presentation:{
        imageWidth:m.imageWidth,imageHeight:m.imageHeight,
        matWidth:m.medium==='Framed Print'?m.matWidth:0,
        frameWidth:(m.medium==='Framed Print'||(m.medium==='Canvas'&&m.canvasFrame==='floating'))?m.frameWidth:0,
        floatGap:m.medium==='Canvas'&&m.canvasFrame==='floating'?m.floatGap:0,
        finishedWidth:size.width,finishedHeight:size.height,
        pixelWidth,pixelHeight
      },
      wall,bounds,
      placement:{x:m.x,y:m.y,scale:m.physicalScale,rotation:m.rotation,perspectiveX:m.perspectiveX,perspectiveY:m.perspectiveY},
      layers:['cast-shadow','contact-shadow','depth','visible-product','glass','measurements'],
      valid:Boolean(scene&&wall&&pixelWidth>0&&pixelHeight>0)
    };
  };

  window.SFRenderEngine={
    version:'3.4.3g',
    normalizeModel,
    finishedSize,
    wallGeometry,
    placementBounds,
    buildPlan,
    lastPlan:null
  };

  const originalFinished=rd.finishedSize.bind(rd);
  rd.finishedSize=function(){
    try{return finishedSize(this.model)}catch(error){console.warn('Render Engine finished-size fallback',error);return originalFinished();}
  };

  const originalDraw=rd.draw.bind(rd);
  rd.draw=function(){
    normalizeModel(this.model);
    const room=sf.$('rdRoom');
    const scene=this.scene?.();
    const plan=buildPlan(this.model,scene,room);
    window.SFRenderEngine.lastPlan=plan;

    if(plan.bounds&&plan.bounds.fits&&this.model.x!==null&&this.model.y!==null){
      this.model.x=clamp(this.model.x,plan.bounds.minX,plan.bounds.maxX);
      this.model.y=clamp(this.model.y,plan.bounds.minY,plan.bounds.maxY);
    }

    const result=originalDraw();
    requestAnimationFrame(()=>{
      const placed=sf.$('rdPlacedArt');
      if(placed){
        placed.dataset.renderEngine='3.4.3g';
        placed.dataset.finishedWidth=String(plan.presentation.finishedWidth);
        placed.dataset.finishedHeight=String(plan.presentation.finishedHeight);
        placed.dataset.pixelsPerInch=String(plan.wall?.pixelsPerInch||0);
      }
      const layer=sf.$('rdArtworkLayer');
      if(layer)layer.dataset.renderEngine='3.4.3g';
    });
    return result;
  };

  sf.state.appVersion='3.4.3g';
  sf.state.buildName='Physical Scale + Reverse Inner Shadow Repair';
  sf.logActivity?.('Upgraded to StudioFlow 3.4.3g · physical scaling and reverse inner shadow repaired');
  sf.persist?.();
})();
