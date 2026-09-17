// ---------- V5.2.3 MOBILE MODAL VIEWPORT ----------
// Keeps the top of every popup visible on phones/PWA mode, even when the
// on-screen keyboard changes the visual viewport. The modal header stays
// pinned while the form content scrolls underneath it.
(function(){
  if(window.__n594zsMobileModalViewportInstalled)return;
  window.__n594zsMobileModalViewportInstalled=true;

  const style=document.createElement('style');
  style.textContent=`
    @media(max-width:760px){
      .modal{
        position:fixed!important;
        z-index:900!important;
        left:0!important;
        right:0!important;
        top:var(--n594zs-vv-top,0px)!important;
        bottom:auto!important;
        height:var(--n594zs-vv-height,100dvh)!important;
        min-height:0!important;
        align-items:flex-start!important;
        justify-content:center!important;
        padding:8px 7px 8px!important;
        overflow:hidden!important;
      }
      .modal-box,
      .modal-box.wide{
        width:100%!important;
        max-width:100%!important;
        max-height:calc(var(--n594zs-vv-height,100dvh) - 16px)!important;
        min-height:0!important;
        overflow-y:auto!important;
        overscroll-behavior:contain;
        -webkit-overflow-scrolling:touch;
        scroll-padding-top:78px;
        padding:0 16px 20px!important;
        border-radius:14px!important;
      }
      .modal-head{
        position:sticky!important;
        top:0!important;
        z-index:45!important;
        margin:0 -16px 14px!important;
        padding:15px 62px 13px 16px!important;
        background:#fff!important;
        border-bottom:1px solid #e4ebf0!important;
        border-radius:14px 14px 0 0;
        box-shadow:0 4px 12px rgba(23,50,76,.08);
      }
      .modal-head .modal-title{padding-right:4px}
      #trackerModalClose{
        z-index:1100!important;
        top:calc(var(--n594zs-vv-top,0px) + 12px)!important;
        right:12px!important;
      }
      body:has(.modal.open){overflow:hidden}
    }
  `;
  document.head.appendChild(style);

  const root=document.documentElement;
  const modal=document.getElementById('modal');
  const box=document.getElementById('modalBox');

  function syncVisualViewport(){
    const vv=window.visualViewport;
    const top=vv?vv.offsetTop:0;
    const height=vv?vv.height:window.innerHeight;
    root.style.setProperty('--n594zs-vv-top',Math.max(0,Math.round(top))+'px');
    root.style.setProperty('--n594zs-vv-height',Math.max(240,Math.round(height))+'px');
  }

  syncVisualViewport();
  window.addEventListener('resize',syncVisualViewport,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(syncVisualViewport,50),{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',syncVisualViewport,{passive:true});
    window.visualViewport.addEventListener('scroll',syncVisualViewport,{passive:true});
  }

  // app-35 already owns modal history/back behavior. Wrap its open function only
  // to reset new popups to their true top and then let keyboard focus scroll the
  // form content while the sticky header remains visible.
  const openModalViewportBase=openModal;
  openModal=function(html,wide=false){
    openModalViewportBase(html,wide);
    syncVisualViewport();
    requestAnimationFrame(()=>{
      if(!box)return;
      box.scrollTop=0;
      const head=box.querySelector('.modal-head');
      if(head)head.scrollIntoView({block:'start',inline:'nearest'});
    });
  };

  // If the keyboard opens while a popup is already displayed, keep the modal
  // container aligned with the visible viewport rather than the layout viewport.
  if(modal){
    new MutationObserver(()=>{if(modal.classList.contains('open'))syncVisualViewport()})
      .observe(modal,{attributes:true,attributeFilter:['class']});
  }
})();
