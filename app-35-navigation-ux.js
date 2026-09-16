// ---------- V5.0.2 GLOBAL NAVIGATION / MODAL UX ----------
// Framework-level close/back controls so individual views cannot omit them.
(function(){
  if(window.__n594zsNavigationUxInstalled)return;
  window.__n594zsNavigationUxInstalled=true;

  const style=document.createElement('style');
  style.textContent=`
    #trackerModalClose{
      position:fixed;top:12px;right:12px;z-index:140;width:46px;height:46px;
      display:none;align-items:center;justify-content:center;border:1px solid #c7d4de;
      border-radius:999px;background:#fff;color:#17324c;font-size:24px;font-weight:900;
      line-height:1;box-shadow:0 6px 24px rgba(0,0,0,.28);cursor:pointer;
    }
    #modal.open #trackerModalClose{display:flex}
    #trackerModalClose:active{transform:scale(.96)}
    #trackerBackBtn{
      position:fixed;left:12px;bottom:12px;z-index:72;display:flex;align-items:center;gap:7px;
      min-height:42px;padding:8px 13px;border:1px solid #c5d4df;border-radius:999px;
      background:#fff;color:#17324c;font-weight:850;box-shadow:0 5px 20px rgba(23,50,76,.2);
      cursor:pointer;
    }
    #trackerBackBtn[disabled]{opacity:.42;cursor:default;box-shadow:none}
    #trackerBackBtn:not([disabled]):active{transform:scale(.98)}
    @media(max-width:760px){
      #trackerModalClose{top:10px;right:10px;width:44px;height:44px;font-size:23px}
      #trackerBackBtn{left:10px;bottom:10px;min-height:42px;padding:8px 12px}
      .modal{padding:8px}
      .modal-box{max-height:96vh;padding-top:58px}
      .modal-head{margin-top:-42px;padding-right:50px}
    }
  `;
  document.head.appendChild(style);

  const modal=document.getElementById('modal');
  if(modal&&!document.getElementById('trackerModalClose')){
    const x=document.createElement('button');
    x.id='trackerModalClose';
    x.type='button';
    x.setAttribute('aria-label','Close popup');
    x.setAttribute('title','Close');
    x.textContent='×';
    x.addEventListener('click',()=>closeModal());
    modal.appendChild(x);
  }

  const back=document.createElement('button');
  back.id='trackerBackBtn';
  back.type='button';
  back.innerHTML='<span aria-hidden="true">←</span><span>Back</span>';
  back.setAttribute('aria-label','Go back to previous tracker screen');
  document.body.appendChild(back);

  const pageHistory=[];
  let goingBack=false;
  const navToBase=navTo;

  function validPage(id){return !!document.getElementById('page-'+id)}
  function updateBack(){
    const popupOpen=modal?.classList.contains('open');
    const hasHistory=pageHistory.some(validPage);
    back.disabled=!popupOpen&&!hasHistory;
    back.title=popupOpen?'Close current popup':(hasHistory?'Previous tracker screen':'No previous tracker screen');
  }

  navTo=function(page){
    const from=currentPage;
    if(!goingBack&&from&&from!==page&&validPage(from)){
      if(pageHistory[pageHistory.length-1]!==from)pageHistory.push(from);
      if(pageHistory.length>60)pageHistory.shift();
    }
    navToBase(page);
    updateBack();
  };

  window.trackerBack=function(){
    if(modal?.classList.contains('open')){
      closeModal();
      updateBack();
      return;
    }
    let target=null;
    while(pageHistory.length&&!target){const p=pageHistory.pop();if(validPage(p)&&p!==currentPage)target=p;}
    if(!target){updateBack();return;}
    goingBack=true;
    try{navTo(target)}finally{goingBack=false;updateBack()}
  };
  back.addEventListener('click',window.trackerBack);

  const openModalBase=openModal;
  openModal=function(html,wide=false){openModalBase(html,wide);updateBack()};
  const closeModalBase=closeModal;
  closeModal=function(){closeModalBase();updateBack()};

  // Android/browser hardware Back: close an open tracker popup before leaving the app.
  window.addEventListener('popstate',()=>{
    if(modal?.classList.contains('open'))closeModal();
  });

  // Re-run after renders that replace page content.
  new MutationObserver(updateBack).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  updateBack();
})();
