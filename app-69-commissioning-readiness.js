// ---------- V5.19.58 COMMISSIONING READINESS ----------
// Item-level commissioning gates layered onto the existing Project Readiness page.
// These are workflow gates only; they are not airworthiness or return-to-service approvals.

(function(){
  if(window.__n594zsCommissioningReadinessInstalled)return;
  window.__n594zsCommissioningReadinessInstalled=true;

  const GATES=[
    {id:'first-start',label:'First Start',badge:'Before First Start',icon:'🔥',note:'Installation and system prerequisites that must be resolved before the first engine start.'},
    {id:'full-power',label:'Full-Power Ground Run',badge:'Before Full-Power',icon:'🧪',note:'Cumulative gate: First Start prerequisites plus initial-run checks required before a full-power ground run.'},
    {id:'flight',label:'Flight Release',badge:'Before Flight',icon:'🛫',note:'Cumulative master gate: every commissioning item, post-run closeout, final W&B, records and actual operating-limitations review.'}
  ];
  const GATE_ORDER=Object.fromEntries(GATES.map((g,i)=>[g.id,i]));
  const PACK_ORDER=[
    '82d7854b-4268-43cd-b04e-9b94ad793b81',
    'rotax912-oil-purge-first-start',
    'c7c96b1e-56e0-40c5-b33c-ce6984a8f12d',
    'n594zs-fuel-system-commissioning',
    'n594zs-earthx-electrical-commissioning',
    'n594zs-ivo-ultralight-prop-closeout',
    'n594zs-custom-exhaust-closeout',
    'n594zs-postrun-flight-release-closeout'
  ];
  const E=v=>typeof esc==='function'?esc(v):String(v??'');
  const A=v=>Array.isArray(v)?v:[];
  const gateDef=id=>GATES.find(g=>g.id===id)||GATES[0];
  const gateRank=id=>Object.prototype.hasOwnProperty.call(GATE_ORDER,id)?GATE_ORDER[id]:99;

  function commissioningPacks(){
    const order=new Map(PACK_ORDER.map((id,i)=>[String(id),i]));
    return A(db?.checklists).filter(c=>c?.commissioningReadinessPack)
      .sort((a,b)=>(order.get(String(a.id))??999)-(order.get(String(b.id))??999)||String(a.name||'').localeCompare(String(b.name||'')));
  }
  function commissioningFlatItems(){
    return commissioningPacks().flatMap(c=>A(c.items).map((item,index)=>({checklist:c,item,index})));
  }
  function commissioningOverallInfo(){
    const rows=commissioningFlatItems();
    const done=rows.filter(x=>!!x.item.done).length;
    return {total:rows.length,done,open:rows.length-done,pct:rows.length?Math.round(done/rows.length*100):0};
  }
  function commissioningGateInfo(gateId){
    const target=gateRank(gateId);
    const packs=commissioningPacks();
    const rows=[];
    let total=0,done=0;
    for(const checklist of packs){
      const relevant=A(checklist.items).filter(i=>gateRank(i.requiredBefore)<=target);
      if(!relevant.length)continue;
      const completed=relevant.filter(i=>!!i.done);
      const open=relevant.filter(i=>!i.done);
      total+=relevant.length;done+=completed.length;
      rows.push({
        checklist,
        items:relevant,
        total:relevant.length,
        done:completed.length,
        open,
        pct:relevant.length?Math.round(completed.length/relevant.length*100):0,
        next:open[0]||null
      });
    }
    return {
      gate:gateDef(gateId),total,done,open:total-done,
      pct:total?Math.round(done/total*100):0,
      clear:total>0&&done===total,rows
    };
  }
  function commissioningNextGate(){
    return GATES.map(g=>commissioningGateInfo(g.id)).find(x=>!x.clear)||commissioningGateInfo('flight');
  }
  function commissioningGateDependency(gateId){
    const idx=gateRank(gateId);
    if(idx<=0)return null;
    const prior=commissioningGateInfo(GATES[idx-1].id);
    return prior.clear?null:prior;
  }
  function gateStatusText(info){
    if(info.clear)return 'READY';
    const dep=commissioningGateDependency(info.gate.id);
    return dep?'WAITING ON '+dep.gate.label.toUpperCase():'BLOCKED';
  }
  function gateCard(info){
    const dep=commissioningGateDependency(info.gate.id);
    return `<button class="commissioning-gate-card ${info.clear?'is-clear':'is-blocked'}" data-commissioning-gate="${E(info.gate.id)}">
      <div class="commissioning-gate-top"><span class="commissioning-gate-icon">${info.gate.icon}</span><span class="mini-badge ${info.clear?'good':'warn'}">${E(gateStatusText(info))}</span></div>
      <b>${E(info.gate.label)}</b>
      <div class="commissioning-count"><strong>${info.done}/${info.total}</strong><span>${info.open} open</span></div>
      <div class="progress"><div style="width:${info.pct}%"></div></div>
      <small>${dep?`Requires ${E(dep.gate.label)} gate first • `:''}${info.pct}% complete</small>
      <span class="commissioning-view-cue">View requirements →</span>
    </button>`;
  }
  function requirementGateLabel(gate){
    return {'first-start':'First Start','full-power':'Full-Power','flight':'Flight'}[String(gate||'')]||String(gate||'Requirement');
  }
  function inlineJsString(value){
    return E(JSON.stringify(String(value)));
  }
  function commissioningChecklistItem(checklist,itemId){
    return A(checklist?.items).find(item=>String(item.id)===String(itemId))||null;
  }
  function commissioningRequirementProject(checklist){
    if(checklist?.projectId===null||checklist?.projectId===undefined||checklist?.projectId==='')return null;
    return typeof projectById==='function'?projectById(checklist.projectId):null;
  }
  function commissioningRequirementSourceDoc(checklist,item){
    if(typeof checklistItemSourceDoc==='function')return checklistItemSourceDoc(checklist,item);
    const id=item?.sourceDocumentId||checklist?.sourceDocumentId||checklist?.documentId||null;
    return id!==null&&id!==undefined&&typeof docById==='function'?docById(id):null;
  }
  function commissioningRequirementState(item){
    if(item?.done)return {label:'Complete',tone:'good',reason:'Requirement is checked complete in its source checklist.'};
    const inspection=String(item?.inspectionStatus||'').trim().toLowerCase();
    const review=String(item?.reviewStatus||'').trim().toLowerCase();
    if(inspection==='finding'||item?.findingSquawkId||item?.findingId)
      return {label:'Finding open',tone:'warn',reason:'A finding is recorded against this requirement and it is not complete.'};
    if(review==='needs attention')
      return {label:'Needs attention',tone:'warn',reason:'This requirement is marked Needs Attention in its source checklist.'};
    if(item?.sourceGap)
      return {label:'Source review required',tone:'warn',reason:'The source checklist identifies a source gap that still requires review.'};
    return {label:'Pending verification',tone:'warn',reason:'Not yet checked complete in the source checklist.'};
  }
  function gateRequirementHtml(checklist,item){
    const state=commissioningRequirementState(item);
    const done=!!item?.done,label=requirementGateLabel(item?.requiredBefore);
    const doc=commissioningRequirementSourceDoc(checklist,item);
    const project=commissioningRequirementProject(checklist);
    const cid=inlineJsString(checklist.id),iid=inlineJsString(item.id);
    const sourceExpected=!!(item?.sourceDocumentId||checklist?.sourceDocumentId||checklist?.documentId);
    return `<div class="commissioning-requirement-row ${done?'is-done':'is-open'}">
      <button type="button" class="commissioning-requirement-open" onclick="openChecklistDetailAtItem(${cid},${iid})" title="Open this exact requirement in its checklist">
        <span class="commissioning-requirement-status" aria-label="${done?'Complete':'Open'}">${done?'✓':'○'}</span>
        <span class="commissioning-requirement-main">
          <span class="commissioning-requirement-text">${E(item?.text||'Untitled requirement')}</span>
          <span class="commissioning-requirement-why"><b>${E(state.label)}</b><span>${E(state.reason)}</span></span>
          ${item?.moreInfo?`<span class="commissioning-requirement-detail">${E(item.moreInfo)}</span>`:''}
          ${item?.note?`<span class="commissioning-requirement-detail"><b>Review note:</b> ${E(item.note)}</span>`:''}
          <span class="task-meta">
            <span class="mini-badge ${state.tone}">${E(state.label)}</span>
            <span class="mini-badge">${E(label)}</span>
            ${item?.group?`<span class="mini-badge">${E(item.group)}</span>`:''}
            ${doc?`<span class="mini-badge">${E(doc.name)}</span>`:sourceExpected?'<span class="mini-badge warn">Source record missing</span>':''}
            ${item?.sourcePage?`<span class="mini-badge">${E(item.sourcePage)}</span>`:''}
            ${project?`<span class="mini-badge ${project.status==='Done'?'good':'warn'}">Project: ${E(project.status||'Open')}</span>`:''}
          </span>
          <span class="commissioning-open-cue">Open requirement →</span>
        </span>
      </button>
      <div class="commissioning-requirement-actions">
        ${doc?`<button type="button" class="secondary" onclick="event.stopPropagation();openCommissioningRequirementSource(${cid},${iid})">Source</button>`:''}
        ${project?`<button type="button" class="secondary" onclick="event.stopPropagation();openProjectDetail(${Number(project.id)})">Project</button>`:''}
      </div>
    </div>`;
  }
  function gateChecklistDetailsHtml(row,index){
    const openCount=row.open.length;
    return `<details class="commissioning-requirement-pack" ${index<2?'open':''}>
      <summary>
        <span><b>${E(row.checklist.name)}</b><small>${openCount?openCount+' open':'All requirements complete'}</small></span>
        <strong>${row.done}/${row.total}</strong>
      </summary>
      <div class="commissioning-requirement-items">${row.items.map(item=>gateRequirementHtml(row.checklist,item)).join('')}</div>
      <div class="commissioning-requirement-pack-actions">
        <button class="secondary" data-commissioning-checklist="${E(String(row.checklist.id))}" onclick="openChecklistDetail('${E(String(row.checklist.id))}')">Open checklist</button>
      </div>
    </details>`;
  }

  window.openCommissioningRequirementSource=async function(checklistId,itemId){
    const checklist=commissioningPacks().find(c=>String(c.id)===String(checklistId));
    const item=commissioningChecklistItem(checklist,itemId);
    if(!checklist||!item)return false;
    const doc=commissioningRequirementSourceDoc(checklist,item);
    if(!doc){
      if(typeof toast==='function')toast('Source document record could not be found.','bad');
      return false;
    }
    if(typeof openSourceReference==='function')
      return openSourceReference(doc,item.sourcePage||'',{fallbackToDocument:true});
    if(typeof openDocumentDetail==='function'){openDocumentDetail(doc.id);return true}
    return false;
  };

  function bindCommissioningButtons(root=document){
    root?.querySelectorAll?.('[data-commissioning-gate]').forEach(el=>{
      if(el.dataset.commissioningBound)return;
      el.dataset.commissioningBound='1';
      el.addEventListener('click',()=>openCommissioningGate(el.dataset.commissioningGate));
    });
    root?.querySelectorAll?.('[data-commissioning-checklist]').forEach(el=>{
      if(el.hasAttribute('onclick')||el.dataset.commissioningBound)return;
      el.dataset.commissioningBound='1';
      el.addEventListener('click',()=>openChecklistDetail(el.dataset.commissioningChecklist));
    });
    root?.querySelectorAll?.('[data-commissioning-readiness]').forEach(el=>{
      if(el.dataset.commissioningBound)return;
      el.dataset.commissioningBound='1';
      el.addEventListener('click',()=>openCommissioningReadiness());
    });
    root?.querySelectorAll?.('[data-commissioning-expand]').forEach(el=>{
      if(el.dataset.commissioningBound)return;
      el.dataset.commissioningBound='1';
      el.addEventListener('click',()=>root.querySelectorAll('.commissioning-requirement-pack').forEach(d=>d.open=true));
    });
    root?.querySelectorAll?.('[data-commissioning-collapse]').forEach(el=>{
      if(el.dataset.commissioningBound)return;
      el.dataset.commissioningBound='1';
      el.addEventListener('click',()=>root.querySelectorAll('.commissioning-requirement-pack').forEach(d=>d.open=false));
    });
  }

  window.commissioningPacks=commissioningPacks;
  window.commissioningOverallInfo=commissioningOverallInfo;
  window.commissioningGateInfo=commissioningGateInfo;

  window.openCommissioningGate=function(gateId){
    const info=commissioningGateInfo(gateId),dep=commissioningGateDependency(gateId);
    const nextRow=info.rows.find(r=>r.open.length),nextItem=nextRow?.next||null;
    const nextAction=nextItem
      ?`<button class="primary" onclick="openChecklistDetailAtItem(${inlineJsString(nextRow.checklist.id)},${inlineJsString(nextItem.id)})">Open next requirement</button>`
      :'';
    const recorderAction=gateId==='first-start'&&info.clear&&typeof openFirstStartRecorder==='function'
      ?'<button class="primary" onclick="openFirstStartRecorder()">Start / Resume First Start Recorder</button>'
      :'';
    const html=`${modalHeader(info.gate.label+' Gate',info.done+'/'+info.total+' required items complete • '+info.open+' open')}
      <div class="${info.clear?'notice':'danger-note'}"><b>${info.clear?'Gate requirements complete.':'Gate not clear.'}</b><br>
        ${E(info.gate.note)}
        ${dep?`<div style="margin-top:6px"><b>Dependency:</b> ${E(dep.gate.label)} is still open (${dep.open} item${dep.open===1?'':'s'} remaining).</div>`:''}
      </div>
      <div class="commissioning-gate-modal-summary">
        <div><span>Progress</span><b>${info.pct}%</b></div>
        <div><span>Complete</span><b>${info.done}</b></div>
        <div><span>Open</span><b>${info.open}</b></div>
        <div><span>Packs involved</span><b>${info.rows.length}</b></div>
      </div>
      ${nextItem?`<div class="commissioning-next-blocker">
        <div><span>Next open requirement</span><b>${E(nextItem.text||'Untitled requirement')}</b><small>${E(nextRow.checklist.name)}</small></div>
        ${nextAction}
      </div>`:''}
      <div class="commissioning-requirements-head">
        <div><b>Requirements in this gate</b><small>Grouped by checklist • ${info.total} cumulative requirement${info.total===1?'':'s'}</small></div>
        <div class="commissioning-requirements-tools">
          <button class="secondary" data-commissioning-expand="all">Expand all</button>
          <button class="secondary" data-commissioning-collapse="all">Collapse all</button>
        </div>
      </div>
      <div class="commissioning-requirement-pack-list">
        ${info.rows.map((r,index)=>gateChecklistDetailsHtml(r,index)).join('')||'<div class="empty">No commissioning requirements are assigned to this gate.</div>'}
      </div>
      <div class="modal-actions"><button class="secondary" data-commissioning-readiness>Readiness Overview</button><button class="secondary" onclick="navTo('checklists');closeModal()">All Checklists</button>${recorderAction}<button class="secondary" onclick="closeModal()">Close</button></div>`;
    openModal(html,true);
    bindCommissioningButtons(document.getElementById('modalBox'));
  };

  window.openCommissioningReadiness=function(){
    if(typeof goToTrackerPageFromModal==='function')return goToTrackerPageFromModal('readiness');
    closeModal?.();
    navTo('readiness');
    return true;
  };

  function commissioningReadinessPanel(){
    const overall=commissioningOverallInfo();
    if(!overall.total)return '';
    const infos=GATES.map(g=>commissioningGateInfo(g.id));
    const next=infos.find(x=>!x.clear)||infos[infos.length-1];
    const nextRow=next.rows.find(r=>r.open.length),nextItem=nextRow?.next||null;
    return `<div class="card commissioning-readiness-panel" id="commissioningReadinessPanel">
      <div class="section-head commissioning-head">
        <div>
          <div class="eyebrow">912 CONVERSION COMMISSIONING</div>
          <h2>Commissioning Readiness</h2>
          <div class="muted">Live checklist gates for First Start, Full-Power Ground Run and Flight Release. These are workflow gates, not airworthiness approvals.</div>
        </div>
        <div class="commissioning-overall"><b>${overall.done}/${overall.total}</b><span>complete • ${overall.pct}%</span></div>
      </div>
      <div class="progress commissioning-overall-progress"><div style="width:${overall.pct}%"></div></div>
      <div class="commissioning-gate-grid">${infos.map(gateCard).join('')}</div>
      <div class="commissioning-next">
        <div><span>Next gate</span><b>${E(next.gate.label)}</b><small>${next.clear?'All commissioning gates are complete.':next.open+' blocking item'+(next.open===1?'':'s')+' remain.'}</small>
          ${nextItem?`<small class="commissioning-next-item"><b>Next:</b> ${E(nextItem.text||'Untitled requirement')} • ${E(nextRow.checklist.name)}</small>`:''}
        </div>
        ${nextItem?`<button class="primary" onclick="openChecklistDetailAtItem(${inlineJsString(nextRow.checklist.id)},${inlineJsString(nextItem.id)})">Open next requirement</button>`:''}
      </div>
    </div>`;
  }

  function injectCommissioningReadiness(){
    const page=document.getElementById('page-readiness');if(!page)return;
    page.querySelector('#commissioningReadinessPanel')?.remove();
    const html=commissioningReadinessPanel();if(!html)return;
    const holder=document.createElement('div');holder.innerHTML=html;
    const panel=holder.firstElementChild;
    const hero=page.querySelector('.readiness-hero');
    if(hero)hero.insertAdjacentElement('afterend',panel);else page.prepend(panel);
    bindCommissioningButtons(panel);
  }

  function injectDashboardCommissioning(){
    const page=document.getElementById('page-dashboard');if(!page)return;
    page.querySelector('#dashboardCommissioningReadiness')?.remove();
    const overall=commissioningOverallInfo();if(!overall.total)return;
    const start=commissioningGateInfo('first-start');
    const ground=commissioningGateInfo('full-power');
    const flight=commissioningGateInfo('flight');
    const card=document.createElement('div');
    card.id='dashboardCommissioningReadiness';
    card.className='card dashboard-commissioning-readiness';
    card.innerHTML=`<div class="dashboard-commissioning-main" data-commissioning-readiness>
        <span>912 Commissioning</span><b>${overall.done}/${overall.total}</b><small>${overall.pct}% complete</small>
      </div>
      <button data-commissioning-gate="first-start"><span>First Start</span><b>${start.open?start.open+' open':'READY'}</b></button>
      <button data-commissioning-gate="full-power"><span>Full-Power</span><b>${ground.open?ground.open+' open':'READY'}</b></button>
      <button data-commissioning-gate="flight"><span>Flight Release</span><b>${flight.open?flight.open+' open':'READY'}</b></button>`;
    page.prepend(card);
    bindCommissioningButtons(card);
  }

  const baseReadiness=window.renderReadiness;
  window.renderReadiness=function(...args){
    const out=baseReadiness?.apply(this,args);
    injectCommissioningReadiness();
    return out;
  };
  const baseDashboard=window.renderDashboard;
  window.renderDashboard=function(...args){
    const out=baseDashboard?.apply(this,args);
    injectDashboardCommissioning();
    return out;
  };

  const style=document.createElement('style');
  style.id='commissioningReadinessStyles';
  style.textContent=`
    .commissioning-readiness-panel{margin-bottom:16px}
    .commissioning-head{align-items:flex-start;gap:18px}
    .commissioning-overall{min-width:120px;text-align:right;display:flex;flex-direction:column}
    .commissioning-overall b{font-size:1.55rem;line-height:1.05}
    .commissioning-overall span{font-size:.78rem;color:var(--muted)}
    .commissioning-overall-progress{margin:12px 0 14px}
    .commissioning-gate-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .commissioning-gate-card{border:1px solid var(--border);border-radius:12px;background:var(--card);padding:13px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:7px}
    .commissioning-gate-card:hover{box-shadow:0 3px 12px rgba(0,0,0,.08)}
    .commissioning-gate-card.is-clear{border-color:var(--good,#6c9)}
    .commissioning-gate-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .commissioning-gate-icon{font-size:1.2rem}
    .commissioning-count{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
    .commissioning-count strong{font-size:1.2rem}
    .commissioning-count span,.commissioning-gate-card small{font-size:.75rem;color:var(--muted)}
    .commissioning-view-cue{font-size:.74rem;font-weight:700;color:var(--accent,#1261a0);margin-top:2px}
    .commissioning-next{margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px}
    .commissioning-next>div{display:flex;flex-direction:column}
    .commissioning-next span,.commissioning-next small{font-size:.75rem;color:var(--muted)}
    .commissioning-gate-modal-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
    .commissioning-gate-modal-summary>div{border:1px solid var(--border);border-radius:9px;padding:9px;display:flex;flex-direction:column}
    .commissioning-gate-modal-summary span{font-size:.72rem;color:var(--muted)}
    .commissioning-gate-modal-summary b{font-size:1.15rem}
    .commissioning-pack-list{display:flex;flex-direction:column;gap:7px}
    .commissioning-pack-row{width:100%;border:1px solid var(--border);border-radius:10px;background:var(--card);padding:10px 11px;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer}
    .commissioning-pack-row.has-open{border-left:4px solid var(--warn,#d99a31)}
    .commissioning-pack-row.is-complete{opacity:.78}
    .commissioning-pack-main{display:flex;flex-direction:column;min-width:0}
    .commissioning-pack-main small{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:650px}
    .commissioning-pack-end{min-width:95px;text-align:right;display:flex;flex-direction:column;gap:4px}
    .commissioning-requirements-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 8px}
    .commissioning-requirements-head>div:first-child{display:flex;flex-direction:column}
    .commissioning-requirements-head small{font-size:.74rem;color:var(--muted)}
    .commissioning-requirements-tools{display:flex;gap:6px;flex-wrap:wrap}
    .commissioning-requirement-pack-list{display:flex;flex-direction:column;gap:8px}
    .commissioning-requirement-pack{border:1px solid var(--border);border-radius:10px;background:var(--card);overflow:hidden}
    .commissioning-requirement-pack>summary{cursor:pointer;list-style:none;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .commissioning-requirement-pack>summary::-webkit-details-marker{display:none}
    .commissioning-requirement-pack>summary>span{display:flex;flex-direction:column;min-width:0}
    .commissioning-requirement-pack>summary small{font-size:.73rem;color:var(--muted)}
    .commissioning-requirement-items{border-top:1px solid var(--border)}
    .commissioning-requirement-row{display:flex;align-items:flex-start;gap:9px;padding:9px 12px;border-bottom:1px solid var(--border)}
    .commissioning-requirement-row:last-child{border-bottom:0}
    .commissioning-requirement-row.is-done{opacity:.68}
    .commissioning-requirement-status{font-size:1rem;line-height:1.3;min-width:18px;text-align:center;font-weight:800}
    .commissioning-requirement-row.is-done .commissioning-requirement-status{color:var(--good,#27864a)}
    .commissioning-requirement-row.is-open .commissioning-requirement-status{color:var(--warn,#b7791f)}
    .commissioning-requirement-main{display:flex;flex-direction:column;gap:5px;min-width:0}
    .commissioning-requirement-text{font-size:.86rem;line-height:1.35}
    .commissioning-requirement-pack-actions{padding:9px 12px;border-top:1px solid var(--border);display:flex;justify-content:flex-end}
    .dashboard-commissioning-readiness{display:grid;grid-template-columns:1.35fr repeat(3,1fr);gap:8px;padding:9px;margin-bottom:10px}
    .dashboard-commissioning-readiness>button,.dashboard-commissioning-main{border:0;background:transparent;border-radius:9px;padding:8px 10px;text-align:left;cursor:pointer;display:flex;flex-direction:column}
    .dashboard-commissioning-readiness>button:hover,.dashboard-commissioning-main:hover{background:var(--soft,#f5f7f8)}
    .dashboard-commissioning-readiness span,.dashboard-commissioning-readiness small{font-size:.72rem;color:var(--muted)}
    .dashboard-commissioning-readiness b{font-size:.98rem}
    @media(max-width:800px){
      .commissioning-gate-grid{grid-template-columns:1fr}
      .commissioning-next{align-items:stretch;flex-direction:column}
      .commissioning-gate-modal-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
      .dashboard-commissioning-readiness{grid-template-columns:1fr 1fr}
      .commissioning-pack-row{align-items:flex-start}
      .commissioning-pack-main small{white-space:normal}
      .commissioning-requirements-head{align-items:stretch;flex-direction:column}
      .commissioning-requirements-tools button{flex:1 1 auto}
      .commissioning-requirement-pack>summary{align-items:flex-start}
    }
  `;
  document.head.appendChild(style);
})();
