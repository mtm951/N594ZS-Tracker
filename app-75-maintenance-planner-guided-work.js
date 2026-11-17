'use strict';
// N594ZS v5.19.82 — Maintenance Planner + Guided Work Sessions.
// Readiness advice is organizational ONLY; it never authorizes engine start, test, or flight.
// Guided notes and project-step completion are saved in one canonical project transaction.
// Checklist verification, Work Logs, Squawks, and parts consumption remain explicit workflows.
(function(){
  if(window.N594ZSMaintenancePlanner)return;
  const A=x=>Array.isArray(x)?x:[];
  const S=x=>String(x==null?'':x);
  const E=x=>S(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const N=x=>Number.isFinite(Number(x))?Number(x):0;
  const eq=(a,b)=>S(a)===S(b);
  const isDone=p=>['Done','Complete','Cancelled'].includes(S(p?.status));
  const idString=id=>S(id);
  const priorityScore=p=>({High:0,Medium:1,Low:2}[p.priority]??3);
  const phaseScore=p=>({build:0,'engine-start':1,ground:2,flight:3,rts:4,later:5}[p.phase]??5);
  const dateNow=()=>new Date().toISOString();
  const getProject=id=>A(db.projects).find(p=>eq(p.id,id));
  const getChecklist=id=>A(db.checklists).find(c=>eq(c.id,id));
  const getPart=id=>A(db.parts).find(p=>eq(p.id,id));
  const steps=p=>A(p.steps).slice().sort((a,b)=>N(a.order)-N(b.order)||S(a.id).localeCompare(S(b.id)));
  const linkedChecks=(p,data)=>A(data.checklists).filter(c=>eq(c.projectId,p.id));
  const activeSession=p=>A(p?.guidedWorkSessions).slice().reverse().find(s=>s.status==='active'||s.status==='paused');
  function cards(p,data){
    const own=steps(p);
    if(own.length)return own.map(s=>({key:'project:'+S(s.id),kind:'project',id:s.id,text:S(s.text||'Task'),
      note:S(s.note),done:!!s.done,estimatedMinutes:s.estimatedMinutes??null,source:'Project task',sourcePage:null,checklistId:null}));
    const cs=linkedChecks(p,data);
    const result=[];
    for(const c of cs){
      for(const item of A(c.items)){
        result.push({key:'checklist:'+S(c.id)+':'+S(item.id),kind:'checklist',id:item.id,checklistId:c.id,
          text:S(item.text||'Checklist requirement'),note:S(item.note),done:!!item.done,estimatedMinutes:item.estimatedMinutes??null,
          source:S(c.name),sourcePage:item.sourcePage??null,sourceDocumentId:item.sourceDocumentId||c.sourceDocumentId||null});
      }
    }
    if(result.length)return result;
    return [{key:'planning',kind:'planning',id:'planning',text:S(p.nextStep||p.plan||p.summary||'Review the project and define the next action.'),
      note:'No explicit project steps or linked checklist items exist. Add them in the Project editor for a real guided checklist.',
      done:false,source:'Project next-step note',sourcePage:null,checklistId:null}];
  }
  function nextCard(p,data){
    const items=cards(p,data),session=activeSession(p);
    // A session can record review of a source requirement, but only the source
    // Checklist can verify it. Prefer the next not-yet-reviewed card for planning.
    return items.find(c=>!c.done&&session?.cards?.[c.key]?.status!=='completed')||
      items.find(c=>!c.done)||items[0];
  }
  function timeHint(card,p){
    const explicit=Number(card?.estimatedMinutes||p?.plannerMinutes||0);
    if(Number.isFinite(explicit)&&explicit>0)return {minutes:explicit,source:'user estimate'};
    const text=S(card?.text).toLowerCase();
    if(/\b(replace|repair|install|assemble|fabric|purge|weigh|ground run|flight|first start)\b/.test(text))
      return {minutes:90,source:'rough planning allowance'};
    if(/\b(inspect|check|verify|measure|calibrat|test|connect|wire|route|crimp)\b/.test(text))
      return {minutes:45,source:'rough planning allowance'};
    return {minutes:25,source:'rough planning allowance'};
  }
  function safeCommissioningGate(phase){
    if(typeof window.commissioningGateInfo!=='function')return null;
    try{return window.commissioningGateInfo(phase)}catch(e){console.warn('Planner could not read commissioning gate',e);return null}
  }
  function criticalGate(p){
    const name=(S(p.title)+' '+S(p.trigger)).toLowerCase();
    if(/first\s*(engine\s*)?(start|run)|initial\s*(engine\s*)?(run|start)/.test(name)||
       /\bfirst engine run\b/.test(name)){
      const gate=safeCommissioningGate('first-start');
      if(!gate||!gate.clear)return {blocked:true,label:gate?
        'First Start commissioning requirements still open ('+gate.open+')':'First Start commissioning gate cannot be verified'};
    }
    if(/first[\s-]*flight|return[\s-]*to[\s-]*flight readiness/.test(name)){
      const gate=safeCommissioningGate('flight');
      if(!gate||!gate.clear)return {blocked:true,label:gate?
        'Flight commissioning requirements still open ('+gate.open+')':'Flight commissioning gate cannot be verified'};
    }
    return null;
  }
  function partShortages(p,data,metrics){
    const result=[];
    const plans=A(p.plannedParts);
    const combined=new Map();
    for(const item of plans){
      if(!item?.partId)continue;
      const id=S(item.partId);combined.set(id,(combined.get(id)||0)+Math.max(0,N(item.qty)));
    }
    for(const [id,required] of combined){
      const part=A(data.parts).find(x=>eq(x.id,id));
      if(!part){result.push('Linked planned part is missing (#'+id+')');continue;}
      const physical=metrics?.onHand?metrics.onHand(part):
        typeof partAvailable==='function'?partAvailable(part):null;
      const allReserved=metrics?.reserved?metrics.reserved(part):
        typeof partReservedQty==='function'?partReservedQty(part.id):required;
      if(physical===null||physical===undefined||!Number.isFinite(Number(physical))){
        result.push('Stock count unverified: '+S(part.name));continue;
      }
      // The project's own reservation belongs to this work. Subtract only OTHER
      // projects' reservations before comparing with the quantity this job needs.
      const availableForProject=Number(physical)-Math.max(0,N(allReserved)-required);
      if(availableForProject+0.000001<required)result.push('Insufficient available '+S(part.name)+
        ' ('+availableForProject+' for '+required+' '+S(part.unit||'ea')+')');
    }
    return result;
  }
  function projectAssessment(p,data,metrics){
    const blockers=[];
    const depNames=A(p.dependsOnIds).map(id=>A(data.projects).find(x=>eq(x.id,id)))
      .filter(dep=>dep&&!isDone(dep)).map(dep=>S(dep.title));
    if(depNames.length)blockers.push('Waiting for: '+depNames.join(', '));
    if(S(p.blockers).trim())blockers.push('Recorded blocker: '+S(p.blockers).trim());
    const unresolved=A(data.orders).filter(o=>eq(o.projectId,p.id)||A(o.linkedProjectIds).some(id=>eq(id,p.id)))
      .filter(o=>['Need to Order','Backordered'].includes(o.status));
    if(unresolved.length)blockers.push('Parts not yet available: '+unresolved.map(o=>S(o.item)).slice(0,3).join(', '));
    blockers.push(...partShortages(p,data,metrics));
    const latest=activeSession(p);
    if(latest&&Object.values(latest.cards||{}).some(x=>x.status==='finding'))
      blockers.push('Guided work session contains an unresolved finding');
    const gate=criticalGate(p);
    if(gate)blockers.push(gate.label);
    const card=nextCard(p,data),estimate=timeHint(card,p);
    return {project:p,blockers,gateBlocked:!!gate,actionable:blockers.length===0,
      next:card,estimate,steps:cards(p,data).length,done:steps(p).filter(x=>x.done).length,
      inProgress:!!latest,rank:(p.focusToday?-60:0)+priorityScore(p)*18+
        phaseScore(p)*4+(blockers.length?75:0)+(latest?-10:0)};
  }
  function collect(data,metrics){
    return A(data.projects).filter(p=>!isDone(p)).map(p=>projectAssessment(p,data,metrics));
  }
  function recommend(data,minutes,metrics){
    const budget=Number(minutes)||60;
    const all=collect(data,metrics);
    all.sort((a,b)=>{
      if(a.actionable!==b.actionable)return a.actionable?-1:1;
      if(a.inProgress!==b.inProgress)return a.inProgress?-1:1;
      const fitA=a.estimate.minutes<=budget?0:1,fitB=b.estimate.minutes<=budget?0:1;
      if(fitA!==fitB)return fitA-fitB;
      return a.rank-b.rank||a.project.title.localeCompare(b.project.title);
    });
    return {ready:all.filter(x=>x.actionable),blocked:all.filter(x=>!x.actionable),all,budget};
  }
  function metrics(){return {
    onHand:p=>typeof partAvailable==='function'?partAvailable(p):null,
    reserved:p=>typeof partReservedQty==='function'?partReservedQty(p.id):0
  }}
  let budget=60,showBlocked=false;
  let current=null;
  function cardRows(items,blocked){
    if(!items.length)return '<div class="empty">No '+(blocked?'blocked':'actionable')+' projects in this group.</div>';
    return items.map((a,i)=>{
      const p=a.project,remaining=steps(p).filter(s=>!s.done).length;
      return '<article class="mp-project'+(blocked?' mp-is-blocked':'')+'">'+
        '<div class="mp-project-title"><div><small>'+E(p.phase||'Build')+' · '+E(p.system||'General')+
        ' · '+E(p.priority||'No priority')+'</small><h3>'+E(p.title)+'</h3></div>'+
        '<span class="mp-status">'+(blocked?'Waiting / Review':a.inProgress?'Session in progress':'Available to plan')+'</span></div>'+
        '<p class="mp-next"><b>Next:</b> '+E(a.next.text)+'</p>'+
        '<div class="mp-project-meta"><span>Planning allowance: '+a.estimate.minutes+' min <em>('+E(a.estimate.source)+')</em></span>'+
        '<span>'+remaining+' open project tasks</span></div>'+
        (a.blockers.length?'<div class="mp-blockers">'+a.blockers.map(b=>'<div>• '+E(b)+'</div>').join('')+'</div>':'')+
        '<div class="mp-project-actions">'+
          (!a.gateBlocked?'<button class="primary" data-mp-start="'+E(p.id)+'">'+
          (a.inProgress?'Resume Guided Work':'Start Guided Work')+'</button>':'')+
          '<button class="secondary" data-mp-project="'+E(p.id)+'">Open Project</button>'+
          (a.gateBlocked?'<button class="secondary" data-mp-readiness="true">Review Commissioning Readiness</button>':'')+
        '</div></article>';
    }).join('');
  }
  function renderPlanner(){
    const root=document.getElementById('page-planner');if(!root)return;
    const data=recommend(db,budget,metrics());
    const ready=data.ready,blocked=data.blocked,fit=ready.filter(x=>x.estimate.minutes<=budget);
    root.innerHTML='<div class="card mp-shell"><div class="toolbar"><div>'+
      '<div class="ops-eyebrow">N594ZS · MAINTENANCE WORKSPACE</div>'+
      '<h1>Maintenance Planner</h1><p class="muted">Choose a work window, review actual dependencies and materials, then start a guided session.</p>'+
      '</div><button class="secondary" data-mp-refresh="true">Refresh suggestions</button></div>'+
      '<div class="mp-controls"><div><b>Time available at the airport</b><span>Rough allowances help sort tasks; not approved job times.</span></div>'+
      '<div class="mp-budget" role="group" aria-label="Available work time">'+
      [[30,'30 min'],[60,'1 hour'],[180,'3+ hours']].map(x=>
        '<button type="button" data-mp-budget="'+x[0]+'" class="'+(budget===x[0]?'active':'')+'">'+x[1]+'</button>').join('')+
      '</div></div>'+
      '<div class="mp-stats"><div><span>Unblocked projects</span><b>'+ready.length+'</b></div>'+
      '<div><span>Within planning window</span><b>'+fit.length+'</b></div>'+
      '<div><span>Waiting / blocked</span><b>'+blocked.length+'</b></div></div>'+
      '<div class="notice mp-safety"><b>Planning only — not an airworthiness determination.</b> '+
      'A suggested task does not approve a ground run or flight. Follow current applicable manuals, inspect conditions, and clear all commissioning prerequisites. '+
      'Blockers and saved project status may be stale; review actual aircraft condition before work.</div>'+
      '<div class="mp-section-head"><h2>Recommended next work</h2><small>Ordered by readiness, saved priority, current session, and rough fit</small></div>'+
      '<div class="mp-cards">'+cardRows(ready,false)+'</div>'+
      '<div class="mp-section-head"><h2>Waiting / blocked work</h2>'+
      '<button class="secondary" data-mp-blocked="true">'+(showBlocked?'Hide':'Show')+' '+blocked.length+' projects</button></div>'+
      (showBlocked?'<div class="mp-cards">'+cardRows(blocked,true)+'</div>':
        '<div class="muted small">Open this section to see dependencies, recorded blockers, parts shortages and readiness gates.</div>')+
      '</div>';
    root.querySelectorAll('[data-mp-budget]').forEach(b=>b.addEventListener('click',()=>{
      budget=Number(b.getAttribute('data-mp-budget'));renderPlanner();
    }));
    root.querySelector('[data-mp-refresh]')?.addEventListener('click',renderPlanner);
    root.querySelector('[data-mp-blocked]')?.addEventListener('click',()=>{showBlocked=!showBlocked;renderPlanner()});
    root.querySelectorAll('[data-mp-start]').forEach(b=>b.addEventListener('click',()=>start(b.getAttribute('data-mp-start'))));
    root.querySelectorAll('[data-mp-project]').forEach(b=>b.addEventListener('click',()=>openProjectDetail(Number(b.getAttribute('data-mp-project')))));
    root.querySelectorAll('[data-mp-readiness]').forEach(b=>b.addEventListener('click',()=>{
      if(typeof navTo==='function')navTo('readiness');
    }));
  }
  function canWriteProject(id){
    if(typeof canCloudEdit==='function'&&!canCloudEdit()){alert('Viewer access is read-only.');return false}
    if(typeof blockPendingProjectEdit==='function'&&blockPendingProjectEdit(id))return false;
    if(window.atomicReceiptOutbox?.isPendingRecord?.('project',id)){
      alert('A pending inventory transaction has locked this project. Finish its safe sync before editing.');return false;
    }
    return true;
  }
  function writeProject(id,mutation,message){
    if(!canWriteProject(id))return false;
    if(typeof trackerStore?.update!=='function')return alert('Project transaction store is unavailable.');
    try{
      trackerStore.update('project',id,draft=>{mutation(draft);},{message:message||'Guided work session saved.'});
      return true;
    }catch(e){
      console.error('Guided project save failed',e);
      alert('Progress was not saved safely: '+S(e.message||e)+'. Review sync status before retrying.');
      return false;
    }
  }
  const findSession=(p,id)=>A(p?.guidedWorkSessions).find(s=>eq(s.id,id));
  function start(id){
    const p=getProject(id);if(!p)return alert('The project is not available.');
    const assessment=projectAssessment(p,db,metrics());
    if(assessment.gateBlocked)return alert('Commissioning prerequisite gate is not clear. Review Readiness before this operation. No guided operational session was started.');
    const prior=activeSession(p);
    if(prior){current={id:p.id,sessionId:prior.id};return showSession(true);}
    if(!canWriteProject(p.id))return;
    const newId=uid(),entries=cards(p,db);
    const session={id:newId,status:'active',startedAt:dateNow(),updatedAt:dateNow(),
      cursor:Math.max(0,entries.findIndex(c=>!c.done)),cards:{},summary:'',nextActions:''};
    if(!writeProject(p.id,draft=>{
      draft.guidedWorkSessions=A(draft.guidedWorkSessions);
      if(draft.guidedWorkSessions.some(s=>s.status==='active'||s.status==='paused'))throw Error('Another active guided session was just created.');
      draft.guidedWorkSessions.push(session);
    },'Guided session started.'))return;
    current={id:p.id,sessionId:newId};
    showSession(true);
  }
  function sessionContext(){
    if(!current)return null;
    const p=getProject(current.id),s=findSession(p,current.sessionId);
    if(!p||!s)return null;
    return {p,s,cards:cards(p,db)};
  }
  function sessionRoot(){return document.getElementById('guidedWorkSessionRoot')}
  function sessionMarkup(ctx){
    const {p,s,cards:items}=ctx;
    const idx=Math.max(0,Math.min(items.length-1,N(s.cursor)));
    const card=items[idx];
    const entry=s.cards?.[card.key]||{};
    const finished=items.filter(c=>c.done||s.cards?.[c.key]?.status==='completed').length;
    const assessment=projectAssessment(p,db,metrics());
    const source=card.kind==='checklist'?
      '<p class="mp-source">Source checklist: <b>'+E(card.source)+'</b>'+
      (card.sourcePage!==null?' · source page '+E(card.sourcePage):'')+
      '. Recording this card does NOT mark the source checklist verified.</p>':
      '<p class="mp-source">Source: '+E(card.source)+'. '+(card.kind==='project'?
      'Completing this card explicitly checks off this project task.':'This planning note is not a source-backed procedure.')+'</p>';
    const warning=assessment.blockers.length?
      '<div class="warning"><b>Review outstanding blockers before physical work.</b><div>'+
      assessment.blockers.map(E).join(' • ')+'</div></div>':'';
    const notes=E(entry.notes??''),reading=E(entry.reading??''),unit=E(entry.unit??'');
    const status=entry.status==='finding'?'Finding recorded':
      card.done||entry.status==='completed'?'Completed / recorded':'Not completed';
    return '<div class="mp-session-head"><div><small>PROJECT · '+E(p.system||'General')+
      '</small><h2>'+E(p.title)+'</h2></div><span class="mp-progress">'+finished+' / '+items.length+' reviewed</span></div>'+
      '<div class="mp-session-track"><div style="width:'+(100*finished/Math.max(1,items.length))+'%"></div></div>'+
      warning+
      '<div class="mp-session-controls"><span>Card '+(idx+1)+' of '+items.length+'</span>'+
      '<select id="mpStepJump" aria-label="Jump to work card">'+items.map((item,i)=>
        '<option value="'+i+'" '+(i===idx?'selected':'')+'>'+E((i+1)+'. '+item.text.slice(0,78))+'</option>').join('')+'</select></div>'+
      '<article class="mp-session-card"><div class="mp-session-status">'+E(status)+'</div>'+
      '<h3>'+E(card.text)+'</h3>'+
      (card.note?'<div class="mp-step-note">'+E(card.note)+'</div>':'')+
      source+
      '<label>Measurements / readings (optional)<input id="mpReading" type="text" value="'+reading+
      '" placeholder="Actual measured value, not a target"></label>'+
      '<label>Units / condition (optional)<input id="mpUnits" value="'+unit+
      '" placeholder="psi, Ω, in., temperature, test condition…"></label>'+
      '<label>Work notes, observations, and source details<textarea id="mpWorkNote" rows="4" '+
      'placeholder="Record what you actually did, findings, measurements, and any manual reference.">'+notes+'</textarea></label>'+
      (entry.status==='finding'?'<div class="mp-finding">This card has an unresolved finding. Use “Resolve finding” only once the issue is corrected or tracked in the proper Squawk.</div>':'')+
      '<div class="mp-work-actions"><button type="button" class="secondary" data-gws-action="save">Save Progress</button>'+
      '<button type="button" class="secondary" data-gws-action="flag">Flag Finding</button>'+
      (entry.status==='finding'?'<button type="button" class="secondary" data-gws-action="resolve">Resolve Finding</button>':'')+
      (card.kind==='checklist'?
        '<button type="button" class="primary" data-gws-action="review">Record & Next (not verified)</button>':
        '<button type="button" class="primary" data-gws-action="complete">'+(card.kind==='project'?'Complete Task & Next':'Record & Next')+'</button>')+
      '</div></article>'+
      '<div class="mp-session-nav"><button type="button" class="secondary" data-gws-action="previous" '+
      (idx===0?'disabled':'')+'>Previous</button>'+
      '<button type="button" class="secondary" data-gws-action="next" '+(idx===items.length-1?'disabled':'')+
      '>Save & Next</button></div>'+
      '<div class="mp-session-foot"><div><b>Session records</b><p>Source checklists and inspections remain separate; no parts are deducted by this session. '+
      'To document actual work, prepare a Work Log and add consumed parts in the normal atomic workflow.</p></div>'+
      '<div class="mp-session-foot-actions">'+
      (card.kind==='checklist'?'<button type="button" class="secondary" data-gws-action="source">Open Source Checklist</button>':'')+
      linkedChecks(p,db).map(c=>'<button type="button" class="secondary" data-gws-checklist="'+E(c.id)+'">Source: '+E(c.name)+'</button>').join('')+
      '<button type="button" class="secondary" data-gws-action="worklog">Prepare Work Log</button>'+
      '<button type="button" class="secondary" data-gws-action="pause">Pause Session</button>'+
      '<button type="button" class="secondary" data-gws-action="finish">Finish Session</button></div></div>';
  }
  function showSession(initial){
    const ctx=sessionContext();if(!ctx)return alert('Session could not be found in the cloud-backed project.');
    if(initial||!sessionRoot()){
      openModal(modalHeader('Guided Work Session',ctx.p.title)+
        '<div id="guidedWorkSessionRoot" class="mp-guided"></div>',true);
      const root=sessionRoot();if(!root)return;
      root.addEventListener('click',onSessionClick);
      root.addEventListener('change',event=>{
        if(event.target.id==='mpStepJump')persist('jump',Number(event.target.value));
      });
    }
    const root=sessionRoot();if(root){root.innerHTML=sessionMarkup(ctx);}
  }
  function inputState(){
    return {notes:S(document.getElementById('mpWorkNote')?.value),
      reading:S(document.getElementById('mpReading')?.value),
      unit:S(document.getElementById('mpUnits')?.value)};
  }
  function persist(action,jumpIndex){
    const ctx=sessionContext();if(!ctx)return false;
    const idx=Math.max(0,Math.min(ctx.cards.length-1,N(ctx.s.cursor))),card=ctx.cards[idx],inputs=inputState();
    const old=ctx.s.cards?.[card.key]||{},beforeStatus=old.status||'';
    if(action==='complete'&&card.kind==='checklist')return alert('Source checklist completion must be signed off in its own verification flow.');
    if(action==='resolve'&&beforeStatus!=='finding')return false;
    if((action==='complete'||action==='review')&&beforeStatus==='finding'&&
       !confirm('Resolve this recorded finding and continue? This does not close a Squawk or verify an inspection.'))return false;
    const newStatus=action==='flag'?'finding':action==='complete'||action==='review'?'completed':
      action==='resolve'?'open':beforeStatus||'open';
    let cursor=idx;
    if(action==='next'||action==='complete'||action==='review')cursor=Math.min(ctx.cards.length-1,idx+1);
    if(action==='previous')cursor=Math.max(0,idx-1);
    if(action==='jump')cursor=Math.max(0,Math.min(ctx.cards.length-1,jumpIndex));
    const updated=writeProject(ctx.p.id,draft=>{
      const session=findSession(draft,ctx.s.id);
      if(!session||!['active','paused'].includes(session.status))throw Error('Session changed or was closed.');
      session.cards=session.cards||{};
      session.cards[card.key]={...session.cards[card.key],...inputs,status:newStatus,updatedAt:dateNow()};
      session.cursor=cursor;session.status='active';session.updatedAt=dateNow();
      if(action==='complete'&&card.kind==='project'){
        const item=A(draft.steps).find(x=>eq(x.id,card.id));
        if(item)item.done=true;
        if(typeof syncProjectProgressFromSteps==='function')syncProjectProgressFromSteps(draft);
      }
    },action==='flag'?'Finding recorded; follow-up required.':'Guided work progress saved.');
    if(updated)showSession(false);
    return updated;
  }
  function prepareLog(){
    if(!persist('save'))return;
    const ctx=sessionContext();if(!ctx)return;
    if(typeof openLogModal!=='function')return alert('Work Log editor is unavailable.');
    openLogModal(null,Number(ctx.p.id));
    const entries=Object.entries(ctx.s.cards||{}).filter(([,v])=>
      v.status==='completed'||v.status==='finding'||S(v.notes||v.reading).trim());
    const map=new Map(ctx.cards.map(c=>[c.key,c.text]));
    const summary=entries.filter(([,v])=>v.status==='completed')
      .map(([key])=>'- '+S(map.get(key)||key)).join('\n');
    const readings=entries.map(([key,v])=>{
      const body=[S(v.reading).trim()+(v.unit?' '+S(v.unit):''),S(v.notes).trim()].filter(Boolean).join(' — ');
      return body?S(map.get(key)||key)+': '+body:'';
    }).filter(Boolean).join('\n');
    const findings=entries.filter(([,v])=>v.status==='finding').map(([key])=>
      S(map.get(key)||key)).join('; ');
    const work=document.getElementById('lgWork');if(work&&!work.value)work.value=
      'Guided maintenance session: '+ctx.p.title+(summary?'\n'+summary:'\nReview documented task cards.');
    const obs=document.getElementById('lgObservations');if(obs&&!obs.value)obs.value=readings;
    const blocker=document.getElementById('lgBlockers');if(blocker&&!blocker.value)blocker.value=findings;
    const next=document.getElementById('lgNext');if(next&&!next.value)next.value=
      ctx.cards.find(c=>!c.done)?.text||S(ctx.p.nextStep);
    const note=document.getElementById('lgNotes');if(note&&!note.value)note.value=
      'Prepared from guided session '+S(ctx.s.id)+'. Verify all content; enter actual labor hours, attach records/photos, and add parts consumed through the standard Work Log transaction controls. No inventory was deducted by this draft.';
  }
  function sourceChecklist(){
    const ctx=sessionContext();if(!ctx)return;
    const card=ctx.cards[Math.max(0,Math.min(ctx.cards.length-1,N(ctx.s.cursor)))];
    if(card?.kind!=='checklist')return;
    if(!persist('save'))return;
    if(typeof openChecklistDetailAtItem==='function')return openChecklistDetailAtItem(card.checklistId,card.id);
    if(typeof openChecklistDetail==='function')return openChecklistDetail(card.checklistId);
    alert('Checklist editor is unavailable.');
  }
  function closeSession(action){
    if(!persist('save'))return;
    const ctx=sessionContext();if(!ctx)return;
    if(action==='finish'&&!confirm('Finish this guided session? This does NOT complete the project, approve flight, sign off inspections, or create a Work Log.'))return;
    const okay=writeProject(ctx.p.id,draft=>{
      const s=findSession(draft,ctx.s.id);
      if(!s)throw Error('Session not found.');
      s.status=action==='finish'?'finished':'paused';
      s.updatedAt=dateNow();
      if(action==='finish')s.finishedAt=dateNow();
    },action==='finish'?'Guided session finished; source tasks and Work Log remain separate.':'Guided session paused.');
    if(okay){current=null;closeModal();if(typeof renderMaintenancePlanner==='function'&&
      document.getElementById('page-planner')?.classList.contains('active'))renderMaintenancePlanner();}
  }
  function onSessionClick(event){
    const checklistButton=event.target.closest('[data-gws-checklist]');
    if(checklistButton){
      if(!persist('save'))return;
      const id=checklistButton.getAttribute('data-gws-checklist');
      if(typeof openChecklistDetail==='function')return openChecklistDetail(id);
      return alert('Source Checklist editor unavailable.');
    }
    const b=event.target.closest('[data-gws-action]');if(!b)return;
    const action=b.getAttribute('data-gws-action');
    if(action==='worklog')return prepareLog();
    if(action==='source')return sourceChecklist();
    if(action==='pause'||action==='finish')return closeSession(action);
    return persist(action);
  }
  function injectProjectAction(id){
    const box=document.getElementById('modalBox'),p=getProject(id);
    if(!box||!p||box.querySelector('[data-guided-project-action]'))return;
    const bar=box.querySelector('.modal-head');if(!bar)return;
    const btn=document.createElement('button');btn.type='button';btn.className='icon-btn';
    btn.dataset.guidedProjectAction='1';btn.textContent=activeSession(p)?'Resume guided work':'Guided work';
    btn.title='Open sequential work cards for this project';
    btn.addEventListener('click',()=>start(p.id));
    const close=bar.querySelector('[data-modal-close]')||bar.querySelector('button:last-child');
    if(close)bar.insertBefore(btn,close);else bar.appendChild(btn);
  }
  const projectBase=window.openProjectDetail;
  if(typeof projectBase==='function'){
    window.openProjectDetail=function(id){
      const result=projectBase.apply(this,arguments);
      injectProjectAction(id);return result;
    };
  }
  const dashboardBase=window.renderDashboard;
  if(typeof dashboardBase==='function'){
    window.renderDashboard=function(){
      const out=dashboardBase.apply(this,arguments);
      const quick=document.querySelector('#page-dashboard .quick-grid');
      if(quick&&!quick.querySelector('[data-maintenance-planner]')){
        const b=document.createElement('button');b.type='button';b.className='quick';
        b.dataset.maintenancePlanner='1';
        b.innerHTML='<span class="qicon">🛠️</span>Maintenance Planner';
        b.addEventListener('click',()=>navTo('planner'));quick.appendChild(b);
      }
      return out;
    };
  }
  const style=document.createElement('style');style.textContent=
    '.mp-shell{padding:20px}.mp-controls{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-top:16px}'+
    '.mp-controls span,.mp-controls b{display:block}.mp-controls span{font-size:11px;color:var(--muted);margin-top:5px}'+
    '.mp-budget{display:flex;gap:6px;flex-wrap:wrap}.mp-budget button{padding:10px 14px;border:1px solid var(--border);border-radius:9px;background:var(--soft);font-weight:700;cursor:pointer}'+
    '.mp-budget button.active{background:var(--accent,#1261a0);color:#fff;border-color:var(--accent,#1261a0)}'+
    '.mp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}'+
    '.mp-stats>div{padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--soft)}'+
    '.mp-stats span,.mp-stats b{display:block}.mp-stats span{font-size:11px;color:var(--muted)}.mp-stats b{font-size:24px;margin-top:5px}'+
    '.mp-safety{margin:13px 0}.mp-section-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin:18px 0 9px}'+
    '.mp-section-head h2{font-size:19px;margin:0}.mp-section-head small{color:var(--muted);font-size:11px}'+
    '.mp-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:12px}'+
    '.mp-project{padding:14px;border:1px solid var(--border);border-radius:12px;min-width:0;background:var(--card,#fff)}'+
    '.mp-project-title{display:flex;justify-content:space-between;gap:10px;align-items:start;flex-wrap:wrap}'+
    '.mp-project-title h3{font-size:15px;line-height:1.35;margin:5px 0}.mp-project-title small{color:var(--muted);font-size:10px}'+
    '.mp-status{font-size:10px;font-weight:700;color:var(--accent,#1261a0)}.mp-is-blocked .mp-status{color:#ac650b}'+
    '.mp-next{font-size:12px;line-height:1.6;margin:10px 0}.mp-project-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--muted)}'+
    '.mp-project-meta em{font-style:normal}.mp-blockers{font-size:11px;color:#a45a16;padding:10px;margin:10px 0;background:#fff6e8;border-radius:8px;line-height:1.5}'+
    '.mp-project-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.mp-project-actions button{min-height:39px}'+
    '.mp-guided{max-width:930px}.mp-session-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start}'+
    '.mp-session-head h2{font-size:18px;margin:5px 0 11px}.mp-session-head small,.mp-progress{font-size:11px;color:var(--muted)}'+
    '.mp-session-track{height:7px;border-radius:9px;background:var(--border);overflow:hidden;margin-bottom:12px}'+
    '.mp-session-track>div{height:100%;background:var(--accent,#1261a0)}'+
    '.mp-session-controls{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:13px 0}'+
    '.mp-session-controls span{font-size:11px;font-weight:700}.mp-session-controls select{max-width:70%;min-height:41px}'+
    '.mp-session-card{border:1px solid var(--border);border-radius:13px;padding:17px;background:var(--soft)}'+
    '.mp-session-card h3{font-size:16px;line-height:1.45}.mp-session-status,.mp-source{font-size:11px;color:var(--muted)}'+
    '.mp-step-note{padding:10px;font-size:12px;border-left:3px solid var(--accent,#1261a0);margin:10px 0;line-height:1.5}'+
    '.mp-session-card label{display:grid;gap:6px;font-size:12px;font-weight:700;margin:12px 0}'+
    '.mp-session-card input,.mp-session-card textarea{min-width:0;width:100%;box-sizing:border-box;min-height:41px}'+
    '.mp-work-actions,.mp-session-nav,.mp-session-foot-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}'+
    '.mp-work-actions button,.mp-session-nav button,.mp-session-foot-actions button{min-height:42px}'+
    '.mp-session-nav{justify-content:space-between}.mp-finding{padding:10px;background:#fff4df;color:#925700;border-radius:8px;font-size:11px}'+
    '.mp-session-foot{padding:14px;margin-top:15px;border-top:1px solid var(--border)}'+
    '.mp-session-foot b{font-size:12px}.mp-session-foot p{font-size:11px;line-height:1.5;color:var(--muted)}'+
    '@media(max-width:650px){.mp-shell{padding:13px}.mp-stats{gap:6px}.mp-stats>div{padding:8px}.mp-stats b{font-size:20px}'+
    '.mp-session-controls{flex-wrap:wrap}.mp-session-controls select{max-width:100%;width:100%}'+
    '.mp-work-actions button{flex:1 1 46%}.mp-session-foot-actions button{flex:1 1 46%}}';
  document.head.appendChild(style);
  window.renderMaintenancePlanner=renderPlanner;
  window.N594ZSMaintenancePlanner=Object.freeze({collect,recommend,cards,partShortages,criticalGate,
    start,render:renderPlanner,resume:id=>start(id),getActiveSession:activeSession});
})();