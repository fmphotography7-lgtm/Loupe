window.SFWebsiteManager = {
  pageMap: {
    'Website Dashboard':'dashboard',
    'Website Artwork':'artworks',
    'Product Generator':'generator',
    'Update Manager':'updates',
    'Website Pricing':'pricing',
    'Sales':'sales',
    'Website Galleries':'galleries',
    'Client Placement':'clientplacement',
    'Product Health':'health',
    'Migration':'migration',
    'Backup & Restore':'backup'
  },
  iframe:null,
  render(){
    const sf=window.SF;
    const target=this.pageMap[sf.currentPage]||'dashboard';
    sf.$('workspace').innerHTML=`<div class="website-manager-host"><iframe id="websiteManagerFrame" class="website-manager-frame" src="website-manager.html?embed=1&page=${encodeURIComponent(target)}" title="StudioFlow Website Manager"></iframe></div>`;
    this.iframe=sf.$('websiteManagerFrame');
    this.iframe.addEventListener('load',()=>this.activate(sf.currentPage));
  },
  activate(pageName){
    const frame=this.iframe||window.SF.$('websiteManagerFrame');
    if(!frame)return;
    try{
      const doc=frame.contentDocument;
      if(doc&&!doc.getElementById('sf-electron-bridge-style')){
        const style=doc.createElement('style');
        style.id='sf-electron-bridge-style';
        style.textContent=`
          html,body{height:100%!important;overflow:hidden!important}
          .desktop-app{grid-template-columns:1fr!important;height:100vh!important;min-height:0!important}
          .sidebar{display:none!important}
          .desktop-main{height:100vh!important}
          .workspace-header{display:none!important}
          .desktop-content{height:100vh!important;grid-template-columns:minmax(0,1fr) 310px!important}
          .workspace{padding:18px 20px 44px!important;background:#292e34!important;color:#f3f6f8!important}.pricing-legacy-theme{max-width:none!important}.pricing-legacy-theme .tablewrap{max-height:calc(100vh - 190px)!important;overflow:auto!important}
          @media(max-width:1150px){.desktop-content{grid-template-columns:1fr!important}.inspector{display:none!important}}
        `;
        doc.head.appendChild(style);
      }
      const page=this.pageMap[pageName]||'dashboard';
      if(frame.contentWindow&&typeof frame.contentWindow.showPage==='function') frame.contentWindow.showPage(page);
      if(frame.contentWindow&&typeof frame.contentWindow.getStudioFlowArtworkCatalog==='function'){
        const records=frame.contentWindow.getStudioFlowArtworkCatalog();
        try{localStorage.setItem('studioflow-website-artworks-bridge',JSON.stringify(records||[]))}catch{}
      }
    }catch(error){
      window.SF.logError(error,'Website Manager bridge');
    }
  }
};
