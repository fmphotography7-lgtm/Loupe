/* StudioFlow 12.1.2 · Single Shadow + Scene Placeholder Repair */
(function(){
 const sf=window.SF;if(!sf)return;
 sf.state.appVersion='12.1.2';
 // Normalize legacy AI frame aliases so oak never falls back to black.
 const normalize=v=>({oak:'light-oak','light oak':'light-oak','light-oak':'light-oak',black:'black',white:'white',walnut:'walnut',grey:'light-grey',gray:'light-grey','light grey':'light-grey','light-grey':'light-grey','brushed metal':'brushed-metal','brushed-metal':'brushed-metal'}[String(v||'').trim().toLowerCase()]||String(v||'black').trim().toLowerCase());
 if(window.SFAIArtCreation){
   const original=window.SFAIArtCreation.normalizeFrameColor?.bind(window.SFAIArtCreation);
   window.SFAIArtCreation.normalizeFrameColor=v=>normalize(original?original(v):v);
 }
 if(window.SFRoomDesigner?.model)window.SFRoomDesigner.model.frameColor=normalize(window.SFRoomDesigner.model.frameColor);
 sf.persist?.();
 sf.logActivity?.('Upgraded to StudioFlow 12.1.2 · single shadow, AI frame handoff, and reusable Scene Pack placeholders');
})();
