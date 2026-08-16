
async function initStudioFlow(){
  const sf=window.SF;
  try{
    sf.state=sf.normalize(await sf.api.loadData()||sf.defaults());

    // Room libraries and calibrated rooms are permanent user data. Updates never reset them.
    if(sf.state.appVersion!=='StudioFlow 11.6.2'){
      if(sf.state.backupSettings?.automaticBeforeUpdates!==false && sf.api.autoBackup) await sf.api.autoBackup('before-11.6.2-update');
      sf.state.appVersion='StudioFlow 11.6.2';
      sf.state.schemaVersion=8;
      sf.state.errors=[];
      sf.logActivity('Upgraded to StudioFlow 11.6.2');
      await sf.persist();
    }
    window.SFProductTemplates.ensure(sf.state);
    window.SFPricing.ensure();
    sf.currentPage='Home Dashboard';
    sf.buildNavigation();
    sf.initSidebar();
    sf.syncBrand();
    sf.render();
    window.dispatchEvent(new CustomEvent('studioflow-ready'));

    sf.$('topAddArtwork').addEventListener('click',()=>window.SFArtworks.openEditor());
    sf.$('topBackup').addEventListener('click',()=>window.SFSettings.exportBackup());

    window.addEventListener('error',event=>sf.logError(event.error||event.message,'Window'));
    window.addEventListener('unhandledrejection',event=>sf.logError(event.reason,'Promise'));
  }catch(error){
    sf.state=sf.defaults();
    sf.logError(error,'Initialization');
    sf.currentPage='Home Dashboard';
    sf.buildNavigation();
    sf.initSidebar();
    sf.syncBrand();
    sf.render();
    window.dispatchEvent(new CustomEvent('studioflow-ready'));
  }
}
initStudioFlow();
