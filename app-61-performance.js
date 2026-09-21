'use strict';
// ---------- V5.15.2 LAZY PAGE RENDERING / PERFORMANCE ----------
// The original tracker re-rendered every page on every save/cloud refresh.
// As the data model grew, that became increasingly expensive. This layer keeps
// the same public APIs but renders only the page the user is actually viewing.

(function(){
  if(window.__n594zsLazyRenderingInstalled)return;
  window.__n594zsLazyRenderingInstalled=true;

  const legacyFullRender=renderAll;
  const navBase=navTo;
  let rendering=false;
  let initTimer=null;

  const PAGE_RENDERERS={
    dashboard:['renderDashboard'],
    aircraft:['renderAircraft'],
    systems:['renderSystems'],
    equipment:['renderEquipment'],
    weightbalance:['renderWeightBalance'],
    ops:['renderOps'],
    readiness:['renderReadiness'],
    projects:['renderProjects'],
    parts:['renderParts'],
    orders:['renderOrders'],
    purchases:['renderPurchases'],
    squawks:['renderSquawks'],
    maintenance:['renderMaintenance'],
    files:['renderFiles'],
    documents:['renderDocuments'],
    checklists:['renderChecklists'],
    runs:['renderRuns'],
    logbook:['renderLogbook'],
    search:['renderSearchPage'],
    activity:['renderActivity'],
    access:['renderAccess'],
    trash:['renderTrash'],
    system:['renderSystem'],
    settings:['renderSettings']
  };

  function activatePage(page){
    currentPage=page;
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    document.getElementById('page-'+page)?.classList.add('active');
    if(typeof renderNav==='function')renderNav();
  }

  function systemsPostRender(){
    try{if(typeof window.injectEngineSystemPanel==='function')window.injectEngineSystemPanel()}catch(e){console.warn('Engine panel post-render failed',e)}
    try{if(typeof window.injectRotaxOperatorCard==='function')window.injectRotaxOperatorCard()}catch(e){console.warn('Rotax operator post-render failed',e)}
    try{if(typeof window.injectRotaxLineCard==='function')window.injectRotaxLineCard()}catch(e){console.warn('Rotax line-maintenance post-render failed',e)}
  }

  function scheduleDataInitializers(){
    clearTimeout(initTimer);
    initTimer=setTimeout(()=>{
      try{if(typeof window.ensureRotaxInstallPack==='function')window.ensureRotaxInstallPack()}catch(e){console.warn('Rotax install init failed',e)}
      try{if(typeof window.ensureRotaxOperatorPack==='function')window.ensureRotaxOperatorPack()}catch(e){console.warn('Rotax operator init failed',e)}
      try{if(typeof window.ensureRotaxLineProgram==='function')window.ensureRotaxLineProgram(false)}catch(e){console.warn('Rotax line init failed',e)}
    },25);
  }

  function callPageRenderer(page){
    const names=PAGE_RENDERERS[page]||[];
    for(const name of names){
      const fn=window[name];
      if(typeof fn!=='function')continue;
      const started=performance.now();
      try{
        fn();
      }catch(e){
        console.error('[N594ZS] page render failed',page,e);
        if(page==='ops'&&typeof renderOpsFallback==='function'){
          try{renderOpsFallback(e)}catch(_e){}
          return true;
        }
        try{toast('Could not render '+page+': '+(e?.message||e),'bad')}catch(_e){}
        return false;
      }
      const elapsed=performance.now()-started;
      if(elapsed>80)console.debug('[N594ZS] slow page render',page,Math.round(elapsed)+'ms');
      if(page==='systems')systemsPostRender();
      return true;
    }
    return false;
  }

  window.renderCurrentTrackerPage=function(page=currentPage){
    const p=page||'dashboard';
    activatePage(p);
    if(callPageRenderer(p))return true;

    return false;
  };

  renderAll=function(){
    if(rendering)return;
    rendering=true;
    try{
      const page=currentPage||'dashboard';
      activatePage(page);
      if(!callPageRenderer(page)){
        // Unknown extension page: preserve compatibility rather than leave it blank.
        legacyFullRender();
      }
    }finally{
      rendering=false;
      scheduleDataInitializers();
    }
  };

  navTo=function(page){
    const target=page||'dashboard';
    // Preserve navigation history and other non-render side effects from earlier modules.
    navBase(target);

    // Access retains its specialized auth-aware core flow.
    if(target==='access'){
      scheduleDataInitializers();
      return;
    }

    // Render the destination exactly once through the central page registry.
    callPageRenderer(target);
    activatePage(target);
    scheduleDataInitializers();
  };
})();