// ---------- V5.4.1 ASSISTANT COLLAPSE / COMPACT MODE ----------
// Keeps N594ZS Assistant compact until the user opens it.
(function(){
  if(window.__n594zsAssistantCollapseInstalled)return;
  window.__n594zsAssistantCollapseInstalled=true;

  const KEY='n594zs_assistant_expanded_v1';
  const style=document.createElement('style');
  style.textContent=`
    #n594AssistantCard{transition:padding .18s ease,box-shadow .18s ease}
    #n594AssistantCard .assistant-collapse-toggle{border:1px solid #c9d9e5;background:#fff;color:#23445f;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:850;cursor:pointer;white-space:nowrap}
    #n594AssistantCard .assistant-collapse-toggle:hover{background:#eef7fd}
    #n594AssistantCard.assistant-collapsed{padding:10px 12px;margin-bottom:10px;cursor:pointer}
    #n594AssistantCard.assistant-collapsed .assistant-head{align-items:center}
    #n594AssistantCard.assistant-collapsed .assistant-title .muted{display:none}
    #n594AssistantCard.assistant-collapsed .assistant-orb{width:30px;height:30px;border-radius:9px;font-size:16px}
    #n594AssistantCard.assistant-collapsed .assistant-title h2{font-size:15px}
    #n594AssistantCard.assistant-collapsed .assistant-refresh{display:none}
    #n594AssistantCard.assistant-collapsed .assistant-ask,
    #n594AssistantCard.assistant-collapsed .assistant-prompts,
    #n594AssistantCard.assistant-collapsed .assistant-answer{display:none!important}
    #n594AssistantCard.assistant-collapsed .assistant-summary{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 0}
    #n594AssistantCard.assistant-collapsed .assistant-stat{display:flex;align-items:baseline;gap:4px;width:auto;min-width:0;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.9)}
    #n594AssistantCard.assistant-collapsed .assistant-stat b{font-size:13px;display:inline}
    #n594AssistantCard.assistant-collapsed .assistant-stat span{font-size:9px;display:inline;white-space:nowrap}
    #n594AssistantCard.assistant-expanded .assistant-collapse-toggle::before{content:'▴  '}
    #n594AssistantCard.assistant-collapsed .assistant-collapse-toggle::before{content:'▾  '}
    @media(max-width:760px){
      #n594AssistantCard.assistant-collapsed{padding:9px 10px}
      #n594AssistantCard.assistant-collapsed .assistant-head{gap:8px}
      #n594AssistantCard.assistant-collapsed .assistant-title{gap:7px}
      #n594AssistantCard.assistant-collapsed .assistant-title h2{font-size:14px}
      #n594AssistantCard.assistant-collapsed .assistant-summary{overflow-x:auto;flex-wrap:nowrap;padding-bottom:1px;scrollbar-width:none}
      #n594AssistantCard.assistant-collapsed .assistant-summary::-webkit-scrollbar{display:none}
      #n594AssistantCard.assistant-collapsed .assistant-stat{flex:0 0 auto;padding:4px 7px}
      #n594AssistantCard.assistant-collapsed .assistant-collapse-toggle{padding:6px 9px;font-size:10px}
    }
  `;
  document.head.appendChild(style);

  function savedExpanded(){
    try{return localStorage.getItem(KEY)==='1'}catch(_e){return false}
  }
  function saveExpanded(v){try{localStorage.setItem(KEY,v?'1':'0')}catch(_e){}}

  function applyAssistantCollapse(){
    const card=document.getElementById('n594AssistantCard');
    if(!card)return;
    if(card.dataset.collapseReady==='1')return;
    card.dataset.collapseReady='1';

    const head=card.querySelector('.assistant-head');
    if(head&&!head.querySelector('.assistant-collapse-toggle')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='assistant-collapse-toggle';
      btn.setAttribute('aria-label','Open or collapse N594ZS Assistant');
      head.appendChild(btn);
    }

    const setState=(expanded,remember=true)=>{
      card.classList.toggle('assistant-expanded',expanded);
      card.classList.toggle('assistant-collapsed',!expanded);
      const btn=card.querySelector('.assistant-collapse-toggle');
      if(btn){btn.textContent=expanded?'Collapse':'Open';btn.setAttribute('aria-expanded',String(expanded))}
      if(remember)saveExpanded(expanded);
    };
    setState(savedExpanded(),false);

    card.addEventListener('click',e=>{
      const btn=e.target.closest('.assistant-collapse-toggle');
      if(btn){e.preventDefault();e.stopPropagation();setState(card.classList.contains('assistant-collapsed'));return}
      if(card.classList.contains('assistant-collapsed')){
        // Any deliberate interaction with the compact assistant opens it.
        setState(true);
      }
    });
  }

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){baseRenderDashboard();applyAssistantCollapse()};
  applyAssistantCollapse();

  // The dashboard can be rebuilt by cloud sync or navigation; make compact mode resilient.
  const observer=new MutationObserver(()=>{if(currentPage==='dashboard')applyAssistantCollapse()});
  const dash=document.getElementById('page-dashboard');if(dash)observer.observe(dash,{childList:true});
})();
