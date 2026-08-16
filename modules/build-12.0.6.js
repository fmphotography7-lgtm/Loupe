/* StudioFlow 12.0.6 · Artwork Presentation Geometry Repair */
(function(){
 const sf=window.SF;if(!sf)return;
 function verify(){
  const placed=sf.$('rdPlacedArt'), visible=placed?.querySelector('.rd-visible-product'), image=placed?.querySelector('.rd-art-image');
  if(!placed||!visible)return;
  const r=placed.getBoundingClientRect(),v=visible.getBoundingClientRect();
  if(v.height<Math.max(20,r.height*.75)||v.width<Math.max(20,r.width*.75)){
   Object.assign(visible.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'block'});
  }
  if(image){image.style.opacity='1';image.style.visibility='visible';}
 }
 if(window.SFRoomDesigner){
  const rd=window.SFRoomDesigner, baseDraw=rd.draw.bind(rd);
  rd.draw=function(){const result=baseDraw();requestAnimationFrame(verify);return result;};
 }
 sf.state.appVersion='12.0.6';sf.state.schemaVersion=Math.max(15,Number(sf.state.schemaVersion||0));
 sf.logActivity?.('Upgraded to StudioFlow 12.0.6 · artwork presentation geometry repaired');
 sf.persist?.();
})();
