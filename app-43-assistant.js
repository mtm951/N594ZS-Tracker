// ---------- V5.4 N594ZS DATA-AWARE ASSISTANT ----------
// Deterministic assistant derived from tracker records. It does not make an
// airworthiness determination and never invents maintenance requirements.
(function(){
  if(window.__n594zsAssistantInstalled)return;
  window.__n594zsAssistantInstalled=true;

  const style=document.createElement('style');
  style.textContent=`
    .assistant-card{margin-bottom:14px;border:1px solid #cddde9;background:linear-gradient(135deg,#f8fcff 0%,#eef7fd 100%);overflow:hidden}
    .assistant-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
    .assistant-title{display:flex;align-items:center;gap:10px}.assistant-orb{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#173f68;color:#fff;font-size:20px;box-shadow:0 5px 14px rgba(23,63,104,.18)}
    .assistant-title h2{margin:0}.assistant-title .muted{margin-top:2px}
    .assistant-refresh{white-space:nowrap}
    .assistant-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
    .assistant-stat{border:1px solid #d8e5ee;border-radius:10px;background:#fff;padding:10px;text-align:left;cursor:pointer;color:#17324c}
    .assistant-stat:hover{background:#f7fbfe}.assistant-stat b{display:block;font-size:21px}.assistant-stat span{font-size:11px;color:#6e7f8e;font-weight:750}
    .assistant-ask{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:10px}.assistant-ask input{min-height:44px;background:#fff}
    .assistant-prompts{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.assistant-prompt{border:1px solid #c9d9e5;background:#fff;color:#23445f;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer}.assistant-prompt:hover{background:#eef7fd}
    .assistant-answer{margin-top:12px;border-top:1px solid #d8e5ee;padding-top:12px}.assistant-answer-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.assistant-answer-head h3{margin:0}
    .assistant-list{display:grid;gap:7px}.assistant-item{width:100%;border:1px solid #dce6ed;border-radius:9px;background:#fff;padding:10px;text-align:left;color:#17324c;cursor:pointer}.assistant-item:hover{background:#f8fbfd}.assistant-item-static{cursor:default}.assistant-item-static:hover{background:#fff}
    .assistant-item-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.assistant-item b{font-size:13px}.assistant-reason{margin-top:4px;font-size:11px;color:#6e7f8e;line-height:1.4}.assistant-tag{display:inline-block;margin-right:5px;margin-top:4px;padding:2px 6px;border-radius:999px;background:#edf4f8;color:#526d80;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.03em}
    .assistant-good{color:#21754a}.assistant-warn{color:#9a6818}.assistant-bad{color:#9b403b}.assistant-empty{padding:13px;border:1px dashed #ccd9e2;border-radius:9px;background:#fff;color:#6d7d89;font-size:12px}
    .assistant-foot{margin-top:9px;font-size:10px;color:#7b8994;line-height:1.4}
    @media(max-width:760px){.assistant-head{align-items:center}.assistant-summary{grid-template-columns:repeat(2,1fr)}.assistant-ask{grid-template-columns:1fr}.assistant-ask button{width:100%}.assistant-prompt{font-size:10px;padding:7px 9px}.assistant-item-head{display:block}.assistant-item-head>span{display:block;margin-top:4px}}
  `;
  document.head.appendChild(style);

  function A(){return typeof arr==='function'?arr:((x)=>Array.isArray(x)?x:[])}
  function n(v){return typeof num==='function'?num(v):(Number(v)||0)}
  function text(v){return String(v??'').trim()}
  function lower(v){return text(v).toLowerCase()}
  function aEsc(v){return typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function lists(){const aa=A();return {projects:aa(db.projects),parts:aa(db.parts),orders:aa(db.orders),logs:aa(db.logs),squawks:aa(db.squawks),purchases:aa(db.purchases),specs:aa(db.specs),inspections:aa(db.inspections),checklists:aa(db.checklists)}}
  function isOpenProject(p){return p&&p.status!=='Done'}
  function isBlockedProject(p){return p&&(p.status==='Blocked'||!!text(p.blockers))}
  function openOrders(){const {orders}=lists();return orders.filter(o=>typeof isClosedOrder==='function'?!isClosedOrder(o):!['Received','Cancelled'].includes(o.status))}
  function freeQty(part){try{return typeof partFreeQty==='function'?partFreeQty(part):(typeof partAvailable==='function'?partAvailable(part):part.stockQty===''?null:n(part.stockQty))}catch(_e){return null}}
  function reservationInfo(p){
    const aa=A(),rows=aa(p?.plannedParts);if(!rows.length)return {count:0,shortages:[],covered:true};
    const shortages=[];
    rows.forEach(r=>{const part=typeof partById==='function'?partById(Number(r.partId)):null;if(!part){shortages.push({reservation:r,part:null,reason:'Part record missing'});return}const f=freeQty(part);if(f!==null&&f<0)shortages.push({reservation:r,part,reason:`Overall reservations exceed stock by ${Math.abs(f)} ${part.unit||r.unit||'ea'}`})});
    return {count:rows.length,shortages,covered:shortages.length===0};
  }
  function projectScore(p){
    let s=0;if(p.priority==='High')s+=100;else if(p.priority==='Medium')s+=50;if(p.status==='In Progress')s+=24;if(text(p.nextStep))s+=20;if(/before|first engine|ground|flight/i.test(`${p.trigger||''} ${p.phase||''}`))s+=12;const r=reservationInfo(p);if(r.count&&r.covered)s+=14;if(!r.count)s+=3;return s;
  }
  function readyCandidates(){
    const {projects}=lists();return projects.filter(isOpenProject).filter(p=>!isBlockedProject(p)).filter(p=>reservationInfo(p).covered).sort((a,b)=>projectScore(b)-projectScore(a));
  }
  function attentionState(){
    const {projects,parts,purchases,specs,inspections,squawks}=lists();
    const blocked=projects.filter(isOpenProject).filter(isBlockedProject);
    const shortages=parts.filter(p=>{const f=freeQty(p);return f!==null&&f<0});
    const noLocation=parts.filter(p=>{let q=null;try{q=typeof partPhysicalOnHand==='function'?partPhysicalOnHand(p):(typeof partAvailable==='function'?partAvailable(p):p.stockQty)}catch(_e){q=p.stockQty}return n(q)>0&&!text(p.location)});
    const unknownPurchases=purchases.filter(p=>!text(p.disposition)||p.disposition==='Unknown');
    const unverified=specs.filter(s=>s.status==='Needs Verification'||/verify/i.test(s.status||''));
    let failedInspections=0;inspections.forEach(i=>{failedInspections+=A()(i.items).filter(x=>x.result==='Fail').length});
    const criticalSquawks=squawks.filter(s=>s.status!=='Resolved'&&['Grounded','Before Flight'].includes(s.severity));
    return {blocked,shortages,noLocation,unknownPurchases,unverified,failedInspections,criticalSquawks};
  }
  function attentionCount(){const a=attentionState();return a.blocked.length+a.shortages.length+a.unknownPurchases.length+a.unverified.length+a.failedInspections+a.criticalSquawks.length}
  function assistantState(){const {projects}=lists();return {ready:readyCandidates(),blocked:projects.filter(isOpenProject).filter(isBlockedProject),orders:openOrders(),attention:attentionState()}}

  function badge(t,cls=''){return `<span class="assistant-tag ${cls}">${aEsc(t)}</span>`}
  function buttonItem(kind,id,title,reason,right='',tags=[]){return `<button class="assistant-item" data-assist-kind="${aEsc(kind)}" data-assist-id="${aEsc(String(id))}"><div class="assistant-item-head"><b>${aEsc(title)}</b>${right?`<span>${aEsc(right)}</span>`:''}</div><div class="assistant-reason">${aEsc(reason)}</div>${tags.map(t=>badge(t)).join('')}</button>`}
  function staticItem(title,reason,right='',tags=[]){return `<div class="assistant-item assistant-item-static"><div class="assistant-item-head"><b>${aEsc(title)}</b>${right?`<span>${aEsc(right)}</span>`:''}</div><div class="assistant-reason">${aEsc(reason)}</div>${tags.map(t=>badge(t)).join('')}</div>`}
  function actionItem(action,title,reason,right='',tags=[]){return `<button class="assistant-item" data-assist-action="${aEsc(action)}"><div class="assistant-item-head"><b>${aEsc(title)}</b>${right?`<span>${aEsc(right)}</span>`:''}</div><div class="assistant-reason">${aEsc(reason)}</div>${tags.map(t=>badge(t)).join('')}</button>`}
  function empty(msg){return `<div class="assistant-empty">${aEsc(msg)}</div>`}

  function assistantToday(){
    const rows=readyCandidates().slice(0,6);
    if(!rows.length)return {title:'What should I work on today?',html:empty('No clearly unblocked project candidates are recorded right now. Check blockers or add a next step to an open project.')};
    return {title:'Best work candidates right now',html:`<div class="assistant-list">${rows.map(p=>{const r=reservationInfo(p);const why=[p.priority?`${p.priority} priority`:'',p.status==='In Progress'?'already in progress':'',text(p.nextStep)?`Next: ${p.nextStep}`:'No next step written',r.count?(r.covered?'reserved parts covered':'parts shortage'):'no reserved-part shortage recorded'].filter(Boolean).join(' • ');return buttonItem('project',p.id,p.title,why,p.system||'',r.count&&r.covered?['parts covered']:[])}).join('')}</div>`};
  }
  function assistantEngine(){
    const {projects,squawks}=lists();
    const target=projects.find(p=>isOpenProject(p)&&/first engine run|first.*ground test|engine run.*ground/i.test(p.title||''));
    const gates=projects.filter(p=>isOpenProject(p)&&p!==target&&/before.*engine|before.*ground|first engine|engine run|ground test|pre.?run/i.test(`${p.trigger||''} ${p.phase||''} ${p.title||''}`));
    const critical=squawks.filter(s=>s.status!=='Resolved'&&['Grounded','Before Flight'].includes(s.severity));
    let html='';
    if(target)html+=`<div class="assistant-list">${buttonItem('project',target.id,target.title,text(target.nextStep)?`Current next step: ${target.nextStep}`:'This is the recorded first-run / ground-test target.',target.status||'')}</div>`;
    html+=`<div class="assistant-reason" style="margin:9px 0 6px"><b>Recorded prerequisite/gate items</b></div>`;
    html+=gates.length?`<div class="assistant-list">${gates.slice(0,10).map(p=>buttonItem('project',p.id,p.title,text(p.blockers)||text(p.nextStep)||text(p.trigger)||'Open item associated with engine/ground-test gating.',p.status||'',isBlockedProject(p)?['blocked']:[])).join('')}</div>`:empty('No separate open projects are explicitly tagged in the tracker as engine-run/ground-test prerequisites.');
    if(critical.length){html+=`<div class="assistant-reason" style="margin:10px 0 6px"><b>Critical open squawks</b></div><div class="assistant-list">${critical.slice(0,8).map(s=>buttonItem('squawk',s.id,s.title||s.description||'Squawk',s.notes||s.description||'Open critical squawk.',s.severity||'',['critical'])).join('')}</div>`}
    return {title:'What is between N594ZS and first engine run?',html};
  }
  function assistantWaiting(){
    const rows=openOrders();if(!rows.length)return {title:'What am I waiting for?',html:empty('No open orders are recorded. If something is physically on order but absent here, add it so the assistant can track it.')};
    return {title:'Open / waiting orders',html:`<div class="assistant-list">${rows.slice(0,12).map(o=>buttonItem('order',o.id,o.item||'Order item',[o.vendor,o.tracking?`Tracking ${o.tracking}`:'',o.eta?`ETA ${o.eta}`:''].filter(Boolean).join(' • ')||'Open order',o.status||'',o.projectId?['linked project']:[])).join('')}</div>`};
  }
  function assistantAttention(){
    const a=attentionState(),chunks=[];
    if(a.blocked.length)chunks.push(actionItem('blocked-projects',`${a.blocked.length} blocked / held-up project${a.blocked.length===1?'':'s'}`,'Open the blocked-project list and jump straight to a project.','', ['projects']));
    if(a.shortages.length)chunks.push(...a.shortages.slice(0,5).map(p=>buttonItem('part',p.id,p.name,`Reservations exceed available stock. Free quantity: ${freeQty(p)} ${p.unit||'ea'}.`,'',['shortage'])));
    if(a.criticalSquawks.length)chunks.push(...a.criticalSquawks.slice(0,5).map(s=>buttonItem('squawk',s.id,s.title||s.description||'Critical squawk',s.notes||s.description||'Open critical squawk.',s.severity||'', ['critical'])));
    if(a.unknownPurchases.length)chunks.push(actionItem('unknown-purchases',`${a.unknownPurchases.length} purchase${a.unknownPurchases.length===1?'':'s'} need reconciliation`,'Open the unresolved purchase list.','',['purchases']));
    if(a.unverified.length)chunks.push(actionItem('unverified-specs',`${a.unverified.length} spec${a.unverified.length===1?'':'s'} need verification`,'Open Specs / Setup in Aircraft Ops.','',['ops']));
    if(a.failedInspections)chunks.push(actionItem('failed-inspections',`${a.failedInspections} failed inspection finding${a.failedInspections===1?'':'s'}`,'Open the Inspections workspace in Aircraft Ops.','',['inspection']));
    if(a.noLocation.length)chunks.push(actionItem('missing-locations',`${a.noLocation.length} on-hand part${a.noLocation.length===1?'':'s'} have no storage location`,'Open a searchable list and add storage locations where useful.','',['data quality']));
    return {title:'What needs attention?',html:chunks.length?`<div class="assistant-list">${chunks.join('')}</div>`:empty('Nothing obvious is flagged by the tracker right now.')};
  }
  function assistantRecent(){
    const {logs,purchases,projects,parts}=lists(),events=[];
    logs.forEach(l=>{if(l.date)events.push({date:l.date,kind:'log',id:l.id,title:l.work||'Work entry',reason:`${l.system||'General'} work log`})});
    purchases.forEach(p=>{if(p.shipDate)events.push({date:p.shipDate,kind:'purchase',id:p.id,title:p.description||p.pn||'Purchase',reason:`${p.vendor||'Vendor'}${p.disposition?` • ${p.disposition}`:''}`})});
    projects.forEach(p=>A()(p.updates).forEach(u=>{if(u.date)events.push({date:u.date,kind:'project',id:p.id,title:p.title,reason:u.text||'Project update'})}));
    parts.forEach(p=>A()(p.updates).forEach(u=>{if(u.date)events.push({date:u.date,kind:'part',id:p.id,title:p.name,reason:u.text||'Part update'})}));
    events.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    return {title:'What changed recently?',html:events.length?`<div class="assistant-list">${events.slice(0,10).map(e=>buttonItem(e.kind,e.id,e.title,e.reason,e.date,[e.kind])).join('')}</div>`:empty('No dated recent work, purchase, project-update, or part-update records were found.')};
  }
  function assistantInventory(){
    const {parts}=lists();const shortages=parts.filter(p=>{const f=freeQty(p);return f!==null&&f<0});const low=parts.filter(p=>{const f=freeQty(p);return f!==null&&p.minQty!==''&&f<=n(p.minQty)&&f>=0}).sort((a,b)=>freeQty(a)-freeQty(b));
    let html='';if(shortages.length)html+=`<div class="assistant-reason" style="margin-bottom:6px"><b>Reservation shortages</b></div><div class="assistant-list">${shortages.slice(0,8).map(p=>buttonItem('part',p.id,p.name,`Free after reservations: ${freeQty(p)} ${p.unit||'ea'}.`,'',['shortage'])).join('')}</div>`;
    if(low.length)html+=`<div class="assistant-reason" style="margin:10px 0 6px"><b>At / below reorder level</b></div><div class="assistant-list">${low.slice(0,8).map(p=>buttonItem('part',p.id,p.name,`Free ${freeQty(p)} ${p.unit||'ea'} • reorder level ${p.minQty} ${p.unit||'ea'}.`,p.system||'', ['low stock'])).join('')}</div>`;
    if(!shortages.length&&!low.length)html=empty('No reservation shortages or parts at/below their recorded reorder levels.');
    return {title:'Inventory watch',html};
  }
  function assistantMissing(){
    const a=attentionState();const {projects,parts}=lists();const noNext=projects.filter(isOpenProject).filter(p=>!text(p.nextStep));const noPN=parts.filter(p=>!text(p.partNo));const chunks=[];
    if(a.noLocation.length)chunks.push(actionItem('missing-locations',`${a.noLocation.length} on-hand parts missing storage location`,'Open a searchable list and add bin/shelf/location where useful.'));
    if(noNext.length)chunks.push(actionItem('missing-next-steps',`${noNext.length} open projects missing a next step`,'Open the projects that need a next step.'));
    if(noPN.length)chunks.push(actionItem('missing-part-numbers',`${noPN.length} parts/materials without a part number/spec`,'Open a searchable list; some consumables legitimately will not have one.'));
    if(a.unverified.length)chunks.push(actionItem('unverified-specs',`${a.unverified.length} specs marked Needs Verification`,'Open Specs / Setup in Aircraft Ops.'));
    if(a.unknownPurchases.length)chunks.push(actionItem('unknown-purchases',`${a.unknownPurchases.length} purchases not reconciled`,'Open the unresolved purchase list and set Installed, Consumed, On Hand, Returned, Sold, etc.'));
    return {title:'Data-quality opportunities',html:chunks.length?`<div class="assistant-list">${chunks.join('')}</div>`:empty('The tracker does not currently see obvious data-quality gaps in these categories.')};
  }
  function assistantBlocked(){
    const {projects}=lists();const rows=projects.filter(isOpenProject).filter(isBlockedProject);return {title:'Blocked / held-up work',html:rows.length?`<div class="assistant-list">${rows.map(p=>buttonItem('project',p.id,p.title,text(p.blockers)||'Marked Blocked.',p.priority||'', ['blocked'])).join('')}</div>`:empty('No projects currently have a blocker recorded.')};
  }

  const answers={today:assistantToday,engine:assistantEngine,waiting:assistantWaiting,attention:assistantAttention,recent:assistantRecent,inventory:assistantInventory,missing:assistantMissing,blocked:assistantBlocked};
  function setAnswer(key){const fn=answers[key]||answers.today,res=fn();const box=document.getElementById('n594AssistantAnswer');if(!box)return;box.innerHTML=`<div class="assistant-answer-head"><h3>${aEsc(res.title)}</h3><button class="linkbtn" data-assist-question="${aEsc(key)}">Refresh</button></div>${res.html}<div class="assistant-foot">Assistant answers are derived from records in this tracker. They are organizational guidance only—not maintenance instructions, an inspection, an airworthiness determination, or return-to-service authorization.</div>`}
  window.n594AssistantAsk=function(raw){
    const q=lower(raw||document.getElementById('n594AssistantInput')?.value);let key='today';
    if(/first.*engine|engine.*run|ground.*test|first.*start/.test(q))key='engine';
    else if(/wait|order|shipping|eta|arriv/.test(q))key='waiting';
    else if(/changed|recent|week|latest|did i do/.test(q))key='recent';
    else if(/missing|quality|clean|incomplete|verify/.test(q))key='missing';
    else if(/inventory|stock|low|short|reorder/.test(q))key='inventory';
    else if(/block|held|stuck/.test(q))key='blocked';
    else if(/attention|problem|issue|wrong/.test(q))key='attention';
    else if(/today|next|work on|can i do|what should/.test(q))key='today';
    setAnswer(key);
  };

  function renderAssistant(){
    const page=document.getElementById('page-dashboard');if(!page)return;const existing=document.getElementById('n594AssistantCard');if(existing)existing.remove();
    const s=assistantState();const card=document.createElement('div');card.className='card assistant-card';card.id='n594AssistantCard';
    card.innerHTML=`<div class="assistant-head"><div class="assistant-title"><div class="assistant-orb">✦</div><div><h2>N594ZS Assistant</h2><div class="muted">A live briefing from your tracker data</div></div></div><button class="icon-btn assistant-refresh" data-assist-question="today">Refresh</button></div>
      <div class="assistant-summary">
        <button class="assistant-stat" data-assist-question="today"><b>${s.ready.length}</b><span>work candidates</span></button>
        <button class="assistant-stat" data-assist-question="blocked"><b>${s.blocked.length}</b><span>blocked / held up</span></button>
        <button class="assistant-stat" data-assist-question="waiting"><b>${s.orders.length}</b><span>open orders</span></button>
        <button class="assistant-stat" data-assist-question="attention"><b>${attentionCount()}</b><span>attention flags</span></button>
      </div>
      <div class="assistant-ask"><input id="n594AssistantInput" type="search" autocomplete="off" placeholder="Ask: What should I work on today?" aria-label="Ask N594ZS Assistant"><button class="btn primary" id="n594AssistantAskBtn">Ask</button></div>
      <div class="assistant-prompts"><button class="assistant-prompt" data-assist-question="today">What should I work on?</button><button class="assistant-prompt" data-assist-question="engine">What blocks first engine run?</button><button class="assistant-prompt" data-assist-question="waiting">What am I waiting for?</button><button class="assistant-prompt" data-assist-question="recent">What changed recently?</button><button class="assistant-prompt" data-assist-question="missing">What data is missing?</button></div>
      <div class="assistant-answer" id="n594AssistantAnswer"></div>`;
    page.insertAdjacentElement('afterbegin',card);setAnswer('today');
  }

  function openAttentionList(action){
    const {projects,parts}=lists();
    let title='',rows=[],kind='project',placeholder='Search…';
    if(action==='blocked-projects'){title='Blocked / Held-Up Projects';rows=projects.filter(isOpenProject).filter(isBlockedProject);kind='project';placeholder='Search blocked projects…'}
    else if(action==='missing-locations'){title='On-Hand Parts Missing Storage Location';rows=parts.filter(p=>{let q=null;try{q=typeof partPhysicalOnHand==='function'?partPhysicalOnHand(p):(typeof partAvailable==='function'?partAvailable(p):p.stockQty)}catch(_e){q=p.stockQty}return n(q)>0&&!text(p.location)});kind='part';placeholder='Search part, PN, system, vendor…'}
    else if(action==='missing-next-steps'){title='Open Projects Missing a Next Step';rows=projects.filter(isOpenProject).filter(p=>!text(p.nextStep));kind='project';placeholder='Search projects…'}
    else if(action==='missing-part-numbers'){title='Parts / Materials Missing a Part Number';rows=parts.filter(p=>!text(p.partNo));kind='part';placeholder='Search part, system, vendor…'}
    else return;
    const modalId='assistantActionListBody';
    openModal(modalHeader(title,rows.length+' record'+(rows.length===1?'':'s'))+`<div class="controls" style="margin:8px 0 12px"><input id="assistantActionSearch" type="search" placeholder="${aEsc(placeholder)}"></div><div id="${modalId}"></div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Close</button></div>`,true);
    const render=()=>{
      const q=lower(document.getElementById('assistantActionSearch')?.value);
      const filtered=rows.filter(x=>!q||lower([x.title,x.name,x.partNo,x.system,x.vendor,x.blockers,x.nextStep].join(' ')).includes(q));
      const box=document.getElementById(modalId);if(!box)return;
      box.innerHTML=`<div class="assistant-list">${filtered.map(x=>kind==='project'
        ?buttonItem('project',x.id,x.title,text(x.blockers)||text(x.nextStep)||'Open project',x.system||'',isBlockedProject(x)?['blocked']:[])
        :buttonItem('part',x.id,x.name||x.partNo||'Part',[x.partNo,x.system,x.vendor].filter(Boolean).join(' • ')||'Part / material',x.stockQty!==''?`${x.stockQty} ${x.unit||'ea'}`:'',['data quality'])
      ).join('')||empty('No matching records.')}</div>`;
    };
    document.getElementById('assistantActionSearch')?.addEventListener('input',render);
    render();
  }
  function openAssistantAction(action){
    if(['blocked-projects','missing-locations','missing-next-steps','missing-part-numbers'].includes(action))return openAttentionList(action);
    if(action==='unknown-purchases'){if(typeof openPurchaseMetricDrilldown==='function')return openPurchaseMetricDrilldown('unknown');if(typeof navTo==='function')return navTo('purchases')}
    if(action==='unverified-specs'){if(typeof navTo==='function')navTo('ops');if(typeof setOpsTab==='function')setTimeout(()=>setOpsTab('specs'),0);return}
    if(action==='failed-inspections'){if(typeof navTo==='function')navTo('ops');if(typeof setOpsTab==='function')setTimeout(()=>setOpsTab('inspections'),0);return}
  }

  function openEntity(kind,id){
    const numeric=/^\d+(?:\.\d+)?$/.test(String(id))?Number(id):id;
    try{
      if(kind==='project'&&typeof openProjectDetail==='function')return openProjectDetail(numeric);
      if(kind==='part'&&typeof openPartDetail==='function')return openPartDetail(numeric);
      if(kind==='order'&&typeof openOrderDetail==='function')return openOrderDetail(numeric);
      if(kind==='log'&&typeof openLogDetail==='function')return openLogDetail(numeric);
      if(kind==='squawk'&&typeof openSquawkDetail==='function')return openSquawkDetail(numeric);
      if(kind==='purchase'){if(typeof navTo==='function')navTo('purchases');return}
    }catch(e){console.warn('Assistant could not open entity',kind,id,e)}
  }
  document.addEventListener('click',e=>{
    const q=e.target.closest?.('[data-assist-question]');if(q){e.preventDefault();setAnswer(q.dataset.assistQuestion);return}
    const action=e.target.closest?.('[data-assist-action]');if(action){e.preventDefault();openAssistantAction(action.dataset.assistAction);return}
    const item=e.target.closest?.('[data-assist-kind][data-assist-id]');if(item){e.preventDefault();openEntity(item.dataset.assistKind,item.dataset.assistId);return}
    if(e.target.closest?.('#n594AssistantAskBtn')){e.preventDefault();window.n594AssistantAsk()}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='n594AssistantInput'){e.preventDefault();window.n594AssistantAsk(e.target.value)}});

  const dashboardBase=renderDashboard;
  renderDashboard=function(){dashboardBase();renderAssistant()};
  if(currentPage==='dashboard')renderAssistant();
})();
