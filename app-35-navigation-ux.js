// ---------- V5.2.2 MOBILE / PWA NAVIGATION UX ----------
// Treat tracker pages and popups as real browser-history states so hardware Back,
// browser Back, PWA Back and edge-swipe gestures all do the intuitive thing.
(function(){
  if(window.__n594zsNavigationUxInstalled)return;
  window.__n594zsNavigationUxInstalled=true;

  const style=document.createElement('style');
  style.textContent=`
    #trackerModalClose{
      position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);right:calc(env(safe-area-inset-right,0px) + 10px);
      z-index:1000;width:50px;height:50px;display:none;align-items:center;justify-content:center;
      border:1px solid #c7d4de;border-radius:999px;background:#fff;color:#17324c;
      font-size:27px;font-weight:900;line-height:1;box-shadow:0 7px 28px rgba(0,0,0,.32);
      cursor:pointer;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
    }
    #trackerModalClose.visible{display:flex!important}
    #trackerModalClose:active{transform:scale(.95)}
    #trackerBackBtn{
      position:fixed;left:calc(env(safe-area-inset-left,0px) + 12px);bottom:calc(env(safe-area-inset-bottom,0px) + 12px);
      z-index:72;display:flex;align-items:center;gap:7px;min-height:44px;padding:9px 14px;
      border:1px solid #c5d4df;border-radius:999px;background:#fff;color:#17324c;font-weight:850;
      box-shadow:0 5px 20px rgba(23,50,76,.2);cursor:pointer;touch-action:manipulation;
    }
    #trackerBackBtn[disabled]{opacity:.42;cursor:default;box-shadow:none}
    #trackerBackBtn:not([disabled]):active{transform:scale(.98)}
    @media(max-width:760px){
      #trackerModalClose{width:52px;height:52px;font-size:28px;top:calc(env(safe-area-inset-top,0px) + 8px);right:calc(env(safe-area-inset-right,0px) + 8px)}
      #trackerBackBtn{left:calc(env(safe-area-inset-left,0px) + 9px);bottom:calc(env(safe-area-inset-bottom,0px) + 9px);min-height:44px;padding:9px 13px}
      .modal{padding:calc(env(safe-area-inset-top,0px) + 7px) 7px calc(env(safe-area-inset-bottom,0px) + 7px)}
      .modal-box{max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 14px);padding-top:62px}
      .modal-head{margin-top:-45px;padding-right:54px}
    }
  `;
  document.head.appendChild(style);

  const modal=document.getElementById('modal');
  let floatingClose=document.getElementById('trackerModalClose');
  if(!floatingClose){
    floatingClose=document.createElement('button');
    floatingClose.id='trackerModalClose';floatingClose.type='button';floatingClose.textContent='×';
    floatingClose.setAttribute('aria-label','Close popup');floatingClose.setAttribute('title','Close');
  }
  // Keep the universal X outside the modal stacking context so a full-screen mobile modal can never cover it.
  document.body.appendChild(floatingClose);

  let back=document.getElementById('trackerBackBtn');
  if(!back){
    back=document.createElement('button');back.id='trackerBackBtn';back.type='button';
    back.innerHTML='<span aria-hidden="true">←</span><span>Back</span>';
    back.setAttribute('aria-label','Go back to previous tracker screen');document.body.appendChild(back);
  }

  const pageHistory=[];
  let historyHandling=false;
  let closeHistoryTimer=null;
  let modalOpenSerial=0;
  let pendingProgrammaticBackSerial=null;
  let explicitModalBackRequested=false;
  let receiptLastEditAt=0;
  let modalEditorBaselines=new WeakMap();
  let modifiedEditors=new Set();
  let depth=Number(history.state?.n594zsDepth||0);
  const navToBase=navTo;
  const openModalBase=openModal;
  const closeModalBase=closeModal;

  function validPage(id){return !!id&&!!document.getElementById('page-'+id)}
  function popupOpen(){return !!modal?.classList.contains('open')}
  function trackerState(kind,page=currentPage,d=depth){return {n594zs:true,n594zsKind:kind,n594zsPage:page,n594zsDepth:d}}
  function stateIsModal(){return history.state?.n594zs===true&&history.state?.n594zsKind==='modal'}
  function receiptOpen(){return popupOpen()&&!!modal.querySelector('[data-receipt-editor]')}
  function receiptInput(t){
    return receiptOpen()&&!!t&&modal.contains(t)&&/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName||'');
  }
  function receiptEditing(){
    return receiptInput(document.activeElement)||receiptOpen()&&receiptLastEditAt>0&&Date.now()-receiptLastEditAt<3000;
  }
  // Every editor is protected, not just the receiving-quantity form. Tracking
  // starts when an actual input is focused/changed, avoiding false dirty
  // prompts for read-only detail windows and auto-populated form defaults.
  function isModalEditor(el){
    return popupOpen()&&!!el&&modal.contains(el)&&!el.disabled&&!el.readOnly&&
      (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName||'')||el.isContentEditable===true)&&
      String(el.type||'').toLowerCase()!=='file';
  }
  function editorValue(el){
    if(el.isContentEditable)return String(el.textContent||'');
    if(el.type==='checkbox'||el.type==='radio')return !!el.checked;
    if(el.multiple&&el.selectedOptions)return [...el.selectedOptions].map(x=>x.value).join('\\u001f');
    return String(el.value??'');
  }
  function rememberEditor(el){
    if(isModalEditor(el)&&!modalEditorBaselines.has(el))
      modalEditorBaselines.set(el,editorValue(el));
  }
  function updateEditorDirty(el){
    if(!isModalEditor(el))return;
    rememberEditor(el);
    if(editorValue(el)!==modalEditorBaselines.get(el))modifiedEditors.add(el);
    else modifiedEditors.delete(el);
    if(receiptInput(el))receiptLastEditAt=Date.now();
  }
  function resetModalEditors(){
    modalEditorBaselines=new WeakMap();
    modifiedEditors=new Set();
    receiptLastEditAt=0;
  }
  function hasUnsavedModalEdits(){return popupOpen()&&modifiedEditors.size>0}
  function confirmDiscardModalEdits(){
    return !hasUnsavedModalEdits()||window.confirm('Discard unsaved changes in this window?');
  }
  window.n594zsModalHasUnsavedEdits=hasUnsavedModalEdits;
  function restoreActiveModalHistory(){
    if(!stateIsModal())history.pushState(trackerState('modal',currentPage,depth),'');
    updateControls();
  }
  function updateControls(){
    const popup=popupOpen();
    floatingClose.classList.toggle('visible',popup);
    const canHistoryBack=Number(history.state?.n594zsDepth||0)>0;
    const hasInternal=pageHistory.some(validPage);
    back.disabled=!popup&&!canHistoryBack&&!hasInternal;
    back.title=popup?'Close current popup':((canHistoryBack||hasInternal)?'Previous tracker screen':'No previous tracker screen');
  }

  // Establish a tracker root state without changing the URL.
  if(!history.state?.n594zs){history.replaceState(trackerState('page',currentPage,0),'');depth=0}
  else if(validPage(history.state.n594zsPage))depth=Number(history.state.n594zsDepth||0);

  navTo=function(page){
    const from=currentPage;
    if(!historyHandling&&from&&from!==page&&validPage(from)){
      if(pageHistory[pageHistory.length-1]!==from)pageHistory.push(from);
      if(pageHistory.length>80)pageHistory.shift();
      depth=Number(history.state?.n594zsDepth??depth)+1;
      history.pushState(trackerState('page',page,depth),'');
    }
    navToBase(page);
    updateControls();
  };

  openModal=function(html,wide=false){
    clearTimeout(closeHistoryTimer);
    openModalBase(html,wide);
    resetModalEditors();
    modalOpenSerial++;
    if(!historyHandling&&!stateIsModal())history.pushState(trackerState('modal',currentPage,depth),'');
    updateControls();
  };

  closeModal=function(){
    closeModalBase();
    resetModalEditors();
    updateControls();
    // A normal programmatic close can immediately open another modal. Wait one turn;
    // only remove the modal history state if the popup genuinely stayed closed.
    clearTimeout(closeHistoryTimer);
    closeHistoryTimer=setTimeout(()=>{
      if(!historyHandling&&!popupOpen()&&stateIsModal()){
        // history.back() dispatches popstate asynchronously. A newer popup
        // can open before that event arrives; never close that newer popup.
        pendingProgrammaticBackSerial=modalOpenSerial;
        history.back();
      }
    },0);
  };

  function closeFromHistory(){
    historyHandling=true;
    try{closeModalBase();resetModalEditors()}finally{historyHandling=false;updateControls()}
  }

  window.trackerBack=function(){
    if(popupOpen()){
      if(!confirmDiscardModalEdits())return;
      if(stateIsModal()){
        explicitModalBackRequested=true;
        history.back();
      }else closeModal();
      return;
    }
    if(Number(history.state?.n594zsDepth||0)>0){history.back();return;}
    let target=null;
    while(pageHistory.length&&!target){const p=pageHistory.pop();if(validPage(p)&&p!==currentPage)target=p;}
    if(!target){updateControls();return;}
    historyHandling=true;
    try{navTo(target)}finally{historyHandling=false;updateControls()}
  };

  back.onclick=window.trackerBack;
  floatingClose.onclick=()=>window.trackerBack();

  // Backdrop clicks never close a popup. Scrolling and mobile keyboard
  // resizing can otherwise discard a long Project, Purchase or Order form.
  document.addEventListener('click',e=>{
    if(e.target!==modal||!popupOpen())return;
    e.preventDefault();e.stopImmediatePropagation();
    if(isModalEditor(document.activeElement))document.activeElement.blur?.();
  },true);
  document.addEventListener('focusin',e=>{
    rememberEditor(e.target);
    if(receiptInput(e.target))receiptLastEditAt=Date.now();
  },true);
  document.addEventListener('input',e=>updateEditorDirty(e.target),true);
  document.addEventListener('change',e=>updateEditorDirty(e.target),true);
  // The first Escape while typing closes the keyboard/editor, NOT the form.
  // A second Escape or explicit X/Back uses the unsaved-changes safeguard.
  // Capture prevents the duplicate legacy Escape listeners from bypassing it.
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!popupOpen())return;
    e.preventDefault();e.stopImmediatePropagation();
    if(isModalEditor(document.activeElement))document.activeElement.blur?.();
    else window.trackerBack();
  },true);
  // Explicit Cancel/Close buttons may call closeModal() directly, bypassing
  // trackerBack(). Protect entered data while preserving save-success closes.
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('button[onclick]');
    if(!btn||!popupOpen()||btn.hasAttribute?.('data-modal-close'))return;
    const code=String(btn.getAttribute?.('onclick')||'').trim();
    if(!/^closeModal\(\);?$/.test(code))return;
    if(!confirmDiscardModalEdits()){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);

  // Intercept the small X buttons inside modal headers too, so all close buttons use the same history behavior.
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-modal-close]');
    if(!btn||!popupOpen())return;
    e.preventDefault();e.stopImmediatePropagation();window.trackerBack();
  },true);

  // Hardware/browser/PWA Back and native mobile back gestures arrive here.
  window.addEventListener('popstate',e=>{
    clearTimeout(closeHistoryTimer);
    const st=e.state;
    const explicitBack=explicitModalBackRequested;
    explicitModalBackRequested=false;
    const programmaticBackSerial=pendingProgrammaticBackSerial;
    pendingProgrammaticBackSerial=null;
    if(popupOpen()&&programmaticBackSerial!==null&&modalOpenSerial>programmaticBackSerial){
      // A popup opened while the previous popup's delayed history.back() was
      // in flight (commonly: save a new order, then immediately receive it).
      // The popstate belongs to the old popup, not the current receipt form.
      if(!stateIsModal())history.pushState(trackerState('modal',currentPage,depth),'');
      updateControls();
      return;
    }
    if(popupOpen()){
      // Only a deliberate Back should dismiss a receipt that is being edited.
      // Unsolicited popstate (including a phone keyboard/browser interaction)
      // must not throw away the entered quantity. Restore one modal state.
      if(!explicitBack&&(isModalEditor(document.activeElement)||receiptEditing())){
        if(isModalEditor(document.activeElement))document.activeElement.blur?.();
        restoreActiveModalHistory();
        return;
      }
      if(!explicitBack&&!confirmDiscardModalEdits()){
        restoreActiveModalHistory();
        return;
      }
      closeFromHistory();
      if(st?.n594zs)depth=Number(st.n594zsDepth||0);
      return;
    }
    // Skip a stale modal history entry left behind by a synchronous close -> page navigation transition.
    if(st?.n594zs&&st.n594zsKind==='modal'){
      depth=Number(st.n594zsDepth||0);history.back();return;
    }
    if(st?.n594zs&&st.n594zsKind==='page'&&validPage(st.n594zsPage)){
      depth=Number(st.n594zsDepth||0);
      historyHandling=true;
      try{navTo(st.n594zsPage)}finally{historyHandling=false;updateControls()}
      return;
    }
    updateControls();
  });

  // Installed PWAs do not consistently provide the browser's native edge-swipe UI.
  // Add a conservative left-edge swipe-right gesture there; regular mobile browsers retain their native gesture.
  const standalone=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
  if(standalone&&'ontouchstart' in window){
    let sx=0,sy=0,started=0,tracking=false;
    window.addEventListener('touchstart',e=>{
      if(e.touches.length!==1)return;const t=e.touches[0];
      tracking=t.clientX<=34;sx=t.clientX;sy=t.clientY;started=Date.now();
    },{passive:true});
    window.addEventListener('touchend',e=>{
      if(!tracking||!e.changedTouches.length)return;tracking=false;const t=e.changedTouches[0];
      const dx=t.clientX-sx,dy=t.clientY-sy,dt=Date.now()-started;
      if(dx>=75&&Math.abs(dy)<=70&&dx>Math.abs(dy)*1.25&&dt<800)window.trackerBack();
    },{passive:true});
  }

  new MutationObserver(updateControls).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  updateControls();
})();
