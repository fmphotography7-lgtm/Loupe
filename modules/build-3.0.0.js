/* StudioFlow 3.0.0 · Physical Presentation Engine */
(function(){
 const sf=window.SF;if(!sf)return;
 sf.state.appVersion='3.0.0';
 const rd=window.SFRoomDesigner;
 if(rd?.model){Object.assign(rd.model,{mountGap:rd.model.mountGap??15,contactOpacity:rd.model.contactOpacity??82,contactWidth:rd.model.contactWidth??2,edgeOcclusion:rd.model.edgeOcclusion??55,ambientBounce:rd.model.ambientBounce!==false,wallColorBleed:rd.model.wallColorBleed!==false});}
 sf.persist?.();
 sf.logActivity?.('Upgraded to StudioFlow 3.0.0 · Physical Presentation Engine with canvas, metal, and framed-print depth');
})();
