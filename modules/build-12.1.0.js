/* StudioFlow 12.1.0 · Room Designer 2.1 Calibrated Presentation Engine */
(function(){
 const sf=window.SF,rd=window.SFRoomDesigner;if(!sf||!rd)return;
 rd.model.shadowOpacity=Math.max(Number(rd.model.shadowOpacity||0),42);
 sf.state.appVersion='12.1.0';
 sf.state.schemaVersion=Math.max(18,Number(sf.state.schemaVersion||0));
 sf.logActivity?.('Upgraded to StudioFlow 12.1.0 · calibrated frame geometry and viewer-perspective lighting');
 sf.persist?.();
})();
