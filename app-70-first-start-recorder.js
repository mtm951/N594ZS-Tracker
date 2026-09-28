'use strict';
// ---------- V5.19.54 FIRST START / GROUND RUN RECORDER ----------
// Structured commissioning session built on Runs/Tests + source-backed checklist + Squawks + Work Log.

(function(){
  if(window.__n594zsFirstStartRecorderInstalled)return;
  window.__n594zsFirstStartRecorderInstalled=true;

  const FIRST_START_CHECKLIST_ID='c7c96b1e-56e0-40c5-b33c-ce6984a8f12d';
  const ENGINE_PROJECT_ID=102;
  const DRAFT_PREFIX='n594zs_commissioning_run_draft_';
  let previewRun=null;
  let recorderTimer=null;
  let draftTimer=null;

  const A=v=>Array.isArray(v)?v:[];
  const E=v=>typeof esc==='function'?esc(v):String(v??'');
  const nowISO=()=>new Date().toISOString();
  const numeric=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
  const sameId=(a,b)=>String(a??'')===String(b??'');
  const runById=id=>A(db?.runs).find(r=>sameId(r.id,id))||null;
  const checklist=()=>typeof checklistById==='function'?checklistById(FIRST_START_CHECKLIST_ID):null;
  const sessionOf=run=>run?.commissioningRun||null;
  const isFinal=run=>['Completed','Aborted'].includes(sessionOf(run)?.status);
  const isActive=run=>!!sessionOf(run)&&sessionOf(run).kind==='first-start'&&!isFinal(run);
  const stepSourceDoc=item=>item?.sourceDocumentId&&typeof docById==='function'?docById(item.sourceDocumentId):null;

  function activeRun(){return A(db?.runs).find(r=>isActive(r))||null}
  function runNumber(){
    const nums=A(db?.runs).map(r=>Number(sessionOf(r)?.runNumber)).filter(Number.isFinite);
    return (nums.length?Math.max(...nums):0)+1;
  }
  function sequenceItems(){return A(checklist()?.items).filter(i=>i.requiredBefore!=='first-start')}
  function initialSteps(){
    return sequenceItems().map(i=>({
      checklistId:FIRST_START_CHECKLIST_ID,itemId:String(i.id),text:i.text||'',
      status:i.done?'complete':'pending',completedAt:i.done?'prior':'',findingSquawkId:null,
      note:'',measurement:null
    }));
  }
  function startGate(){return typeof commissioningGateInfo==='function'?commissioningGateInfo('first-start'):null}
  function nextOpenIndex(run,from=0){
    const steps=A(sessionOf(run)?.steps);
    if(!steps.length)return 0;
    for(let offset=0;offset<steps.length;offset++){
      const i=(Math.max(0,from)+offset)%steps.length;
      if(steps[i]?.status!=='complete')return i;
    }
    return Math.min(Math.max(0,from),steps.length-1);
  }
  function currentStep(run){
    const s=sessionOf(run),steps=A(s?.steps);
    if(!steps.length)return null;
    const idx=Math.max(0,Math.min(steps.length-1,Number(s.currentIndex)||0));
    return {result:steps[idx],index:idx,item:A(checklist()?.items).find(i=>sameId(i.id,steps[idx].itemId))||null};
  }
  function draftKey(id){return DRAFT_PREFIX+String(id)}
  function readDraft(id){try{return JSON.parse(localStorage.getItem(draftKey(id))||'{}')||{}}catch(_e){return{}}}
  function writeDraft(id,value){try{localStorage.setItem(draftKey(id),JSON.stringify(value||{}))}catch(_e){}}
  function clearDraft(id){try{localStorage.removeItem(draftKey(id))}catch(_e){}}
  function value(id){const el=document.getElementById(id);return el?String(el.value??'').trim():''}
  function recorderFields(run){return {...(sessionOf(run)?.currentReadings||{}),...readDraft(run.id)}}
  function collectFields(){
    return {
      rpm:value('crRpm'),oilPressure:value('crOilP'),oilTemp:value('crOilT'),
      coolantTemp:value('crCoolantT'),cht:value('crCht'),fuelPressure:value('crFuelP'),
      busVoltage:value('crBusV'),ignitionDropA:value('crIgnA'),ignitionDropB:value('crIgnB'),
      idleRpm:value('crIdleRpm'),staticRpm:value('crStaticRpm'),
      tachStart:value('crTachStart'),tachEnd:value('crTachEnd'),note:value('crStepNote')
    };
  }
  function hasMeasurement(m){
    return ['rpm','oilPressure','oilTemp','coolantTemp','cht','fuelPressure','busVoltage',
      'ignitionDropA','ignitionDropB','idleRpm','staticRpm'].some(k=>String(m?.[k]??'').trim()!=='');
  }
  function measurementSnapshot(m,label='Reading'){return {id:uid(),at:nowISO(),label,...m,note:m.note||''}}
  function updateAggregate(run,m){
    const max=(field,val)=>{const n=numeric(val);if(n===null)return;const p=numeric(run[field]);if(p===null||n>p)run[field]=String(n)};
    const min=(field,val)=>{const n=numeric(val);if(n===null)return;const p=numeric(run[field]);if(p===null||n<p)run[field]=String(n)};
    max('rpmMax',m.rpm);min('oilPressureMin',m.oilPressure);max('oilTempMax',m.oilTemp);
    max('coolantTempMax',m.coolantTemp);max('chtMax',m.cht);
    min('fuelPressureMin',m.fuelPressure);max('fuelPressureMax',m.fuelPressure);
    min('busVoltageMin',m.busVoltage);max('busVoltageMax',m.busVoltage);
    if(m.ignitionDropA!=='')run.ignitionDropA=m.ignitionDropA;
    if(m.ignitionDropB!=='')run.ignitionDropB=m.ignitionDropB;
    if(m.idleRpm!=='')run.idleRpm=m.idleRpm;
    if(m.staticRpm!=='')run.staticRpm=m.staticRpm;
    if(m.tachStart!=='')run.tachStart=m.tachStart;
    if(m.tachEnd!=='')run.tachEnd=m.tachEnd;
  }
  function applyReadingToDraft(runDraft,m,label=null){
    runDraft.commissioningRun=runDraft.commissioningRun||{};
    runDraft.commissioningRun.currentReadings={...m,note:''};
    if(hasMeasurement(m)){
      const snap=measurementSnapshot(m,label||'Recorder reading');
      runDraft.commissioningRun.measurements=A(runDraft.commissioningRun.measurements);
      runDraft.commissioningRun.measurements.push(snap);
      updateAggregate(runDraft,m);
      return snap;
    }
    if(m.tachStart!=='')runDraft.tachStart=m.tachStart;
    if(m.tachEnd!=='')runDraft.tachEnd=m.tachEnd;
    return null;
  }
  function elapsedSeconds(start,end=Date.now()){
    const t=Date.parse(start||'');return Number.isFinite(t)?Math.max(0,(Number(end)-t)/1000):0;
  }
  function fmtElapsed(sec){
    sec=Math.max(0,Math.floor(Number(sec)||0));
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return h?String(h)+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):
      String(m)+':'+String(s).padStart(2,'0');
  }
  function engineDurationMin(run,endAt=null){
    const s=sessionOf(run);if(!s?.engineStartedAt)return '';
    const end=endAt?Date.parse(endAt):(s.engineStoppedAt?Date.parse(s.engineStoppedAt):Date.now());
    return String(Math.max(0,Math.round(elapsedSeconds(s.engineStartedAt,end)/6)/10));
  }
  function findingIds(run){
    const s=sessionOf(run);
    return [...new Set([
      ...A(s?.steps).map(x=>x.findingSquawkId).filter(Boolean),
      ...A(s?.findingSquawkIds).filter(Boolean)
    ])];
  }
  function unresolvedStepCount(run){return A(sessionOf(run)?.steps).filter(s=>s.status!=='complete').length}

  function setRecorderSaveState(text,kind=''){
    const el=document.getElementById('crSaveState');if(!el)return;
    el.textContent=text||'';el.classList.toggle('has-unsaved',kind==='unsaved');el.classList.toggle('is-saved',kind==='saved');
  }
  window.queueCommissioningDraftSave=function(runId){
    if(String(runId)==='preview')return;
    setRecorderSaveState('Unsaved changes • kept locally on this device','unsaved');
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>writeDraft(runId,collectFields()),120);
  };

  window.saveCommissioningProgress=function(runId){
    const run=runById(runId);if(!run||isFinal(run))return;
    const m=collectFields(),cur=currentStep(run),at=nowISO();
    try{
      trackerStore.update('run',run.id,draft=>{
        const cr=draft.commissioningRun= draft.commissioningRun||{};
        cr.currentReadings={...m};
        cr.lastSavedAt=at;
        const step=A(cr.steps).find(x=>sameId(x.itemId,cur?.result?.itemId));
        if(step&&step.status!=='complete')step.note=m.note||'';
        if(m.tachStart!=='')draft.tachStart=m.tachStart;
        if(m.tachEnd!=='')draft.tachEnd=m.tachEnd;
      },{message:'Commissioning progress saved.'});
      clearDraft(run.id);
      setRecorderSaveState('Saved to Run/Test ✓','saved');
    }catch(error){alert('Progress was not saved: '+(error?.message||String(error)))}
  };

  window.saveCommissioningMeasurement=function(runId){
    const run=runById(runId);if(!run||isFinal(run))return;
    const m=collectFields();
    if(!hasMeasurement(m)&&m.tachStart===''&&m.tachEnd==='')return alert('Enter at least one reading first.');
    try{
      trackerStore.update('run',run.id,draft=>{applyReadingToDraft(draft,m,'Manual snapshot')},{message:'Commissioning reading saved.'});
      clearDraft(run.id);openFirstStartRunRecorder(run.id);
    }catch(error){alert('Reading was not saved: '+(error?.message||String(error)))}
  };

  window.startCommissioningEngineTimer=function(runId){
    const run=runById(runId);if(!run||isFinal(run)||sessionOf(run)?.engineStartedAt)return;
    try{
      trackerStore.update('run',run.id,draft=>{
        draft.commissioningRun.engineStartedAt=nowISO();draft.commissioningRun.status='Running';
        draft.commissioningRun.oilPressureConfirmedAt='';draft.commissioningRun.oilPressureSeconds='';
      },{message:'Engine-start time recorded.'});
      openFirstStartRunRecorder(run.id);
    }catch(error){alert('Engine-start time was not saved: '+(error?.message||String(error)))}
  };

  window.confirmCommissioningOilPressure=function(runId){
    const run=runById(runId);if(!run||isFinal(run))return;
    const s=sessionOf(run);if(!s?.engineStartedAt)return alert('Press Engine Started at the moment the engine begins running first.');
    const at=nowISO(),seconds=Math.round(elapsedSeconds(s.engineStartedAt,Date.parse(at))*10)/10,m=collectFields();
    try{
      trackerStore.update('run',run.id,draft=>{
        draft.commissioningRun.oilPressureConfirmedAt=at;draft.commissioningRun.oilPressureSeconds=seconds;
        if(m.oilPressure!=='')updateAggregate(draft,m);draft.commissioningRun.currentReadings={...m,note:''};
      },{message:'Oil-pressure confirmation time recorded.'});
      clearDraft(run.id);openFirstStartRunRecorder(run.id);
    }catch(error){alert('Oil-pressure confirmation was not saved: '+(error?.message||String(error)))}
  };

  window.stopCommissioningEngineTimer=function(runId){
    const run=runById(runId);if(!run||isFinal(run))return;
    const s=sessionOf(run);if(!s?.engineStartedAt)return alert('Engine-start time has not been recorded.');
    if(s.engineStoppedAt)return;
    const stopped=nowISO(),m=collectFields();
    try{
      trackerStore.update('run',run.id,draft=>{
        applyReadingToDraft(draft,m,'Shutdown reading');draft.commissioningRun.engineStoppedAt=stopped;
        draft.commissioningRun.status='Post-Run';draft.durationMin=engineDurationMin(draft,stopped);
      },{message:'Engine-stop time recorded.'});
      clearDraft(run.id);openFirstStartRunRecorder(run.id);
    }catch(error){alert('Engine-stop time was not saved: '+(error?.message||String(error)))}
  };

  window.moveCommissioningRecorder=function(runId,delta){
    const run=String(runId)==='preview'?previewRun:runById(runId);if(!run)return;
    const steps=A(sessionOf(run)?.steps);if(!steps.length)return;
    const next=Math.max(0,Math.min(steps.length-1,(Number(sessionOf(run).currentIndex)||0)+Number(delta||0)));
    if(String(runId)==='preview'){previewRun.commissioningRun.currentIndex=next;renderRecorder(previewRun,true);return}
    writeDraft(run.id,collectFields());
    trackerStore.update('run',run.id,draft=>{draft.commissioningRun.currentIndex=next},{message:''});
    openFirstStartRunRecorder(run.id);
  };

  window.completeCommissioningStep=function(runId){
    const run=runById(runId);if(!run||isFinal(run))return;
    const cur=currentStep(run);if(!cur?.item)return alert('Current checklist step could not be found.');
    const m=collectFields(),at=nowISO();
    try{
      trackerStore.batch(tx=>{
        tx.update('run',run.id,draft=>{
          const s=draft.commissioningRun,step=A(s.steps).find(x=>sameId(x.itemId,cur.result.itemId));
          const snap=applyReadingToDraft(draft,m,'Step complete');
          if(step){step.status='complete';step.completedAt=at;step.note=m.note||'';step.measurement=snap}
          s.currentIndex=nextOpenIndex(draft,Math.min(cur.index+1,A(s.steps).length-1));
        });
        tx.update('checklist',FIRST_START_CHECKLIST_ID,draft=>{
          const item=A(draft.items).find(x=>sameId(x.id,cur.result.itemId));if(item)item.done=true;
        });
      },{message:'Commissioning step completed.'});
      clearDraft(run.id);openFirstStartRunRecorder(run.id);
    }catch(error){alert('Step was not safely saved: '+(error?.message||String(error)))}
  };

  window.recordCommissioningFinding=function(runId){
    const run=runById(runId);if(!run||isFinal(run))return;
    const cur=currentStep(run);if(!cur?.item)return;
    const m=collectFields(),note=String(m.note||'').trim();if(!note)return alert('Describe the finding in the step note first.');
    const sid=typeof nextNumericId==='function'?nextNumericId(db.squawks,800):uid(),at=nowISO();
    const squawk={
      id:sid,title:'Run #'+sessionOf(run).runNumber+' finding — '+String(cur.item.text||'Commissioning step').slice(0,90),
      system:'Engine',severity:'Before Flight',status:'Open',discoveredDate:run.date||today(),
      airframeHours:db.aircraft?.airframeHours||'',engineHours:m.tachEnd||m.tachStart||run.tachEnd||run.tachStart||db.aircraft?.engineHours||'',
      description:note+'\\n\\nChecklist step: '+cur.item.text,
      action:'Resolve the finding and re-verify the affected commissioning requirement before continuing to the applicable readiness gate.',
      resolution:'',projectId:ENGINE_PROJECT_ID,resolvedDate:'',sourceRunId:run.id,
      checklistId:FIRST_START_CHECKLIST_ID,checklistItemId:String(cur.item.id)
    };
    try{
      trackerStore.batch(tx=>{
        tx.write('squawk',sid,squawk);
        tx.update('run',run.id,draft=>{
          const s=draft.commissioningRun,step=A(s.steps).find(x=>sameId(x.itemId,cur.result.itemId));
          const snap=applyReadingToDraft(draft,m,'Finding');
          if(step){step.status='finding';step.completedAt=at;step.note=note;step.findingSquawkId=sid;step.measurement=snap}
          s.findingSquawkIds=A(s.findingSquawkIds);if(!s.findingSquawkIds.includes(sid))s.findingSquawkIds.push(sid);
          s.currentIndex=Math.min(cur.index+1,A(s.steps).length-1);draft.outcome='Follow-up Needed';
        });
        tx.update('checklist',FIRST_START_CHECKLIST_ID,draft=>{
          const item=A(draft.items).find(x=>sameId(x.id,cur.result.itemId));if(item)item.done=false;
        });
      },{message:'Commissioning finding and squawk recorded.'});
      clearDraft(run.id);openFirstStartRunRecorder(run.id);
    }catch(error){alert('Finding was not safely recorded: '+(error?.message||String(error)))}
  };

  function workLogFor(run,outcome,reason=''){
    const s=sessionOf(run),findings=findingIds(run),open=unresolvedStepCount(run);
    const obs=[
      'Commissioning Run #'+s.runNumber+' — '+outcome,
      run.durationMin!==''?'Engine run duration: '+run.durationMin+' min':'',
      run.rpmMax!==''?'Max RPM: '+run.rpmMax:'',
      run.oilPressureMin!==''?'Minimum oil pressure recorded: '+run.oilPressureMin+' psi':'',
      run.oilTempMax!==''?'Maximum oil temperature recorded: '+run.oilTempMax+' °F':'',
      run.coolantTempMax!==''?'Maximum coolant temperature recorded: '+run.coolantTempMax+' °F':'',
      run.chtMax!==''?'Maximum CHT recorded: '+run.chtMax+' °F':'',
      (run.fuelPressureMin!==''||run.fuelPressureMax!=='')?'Fuel pressure range: '+(run.fuelPressureMin||'—')+'–'+(run.fuelPressureMax||'—')+' psi':'',
      (run.busVoltageMin!==''||run.busVoltageMax!=='')?'Bus voltage range: '+(run.busVoltageMin||'—')+'–'+(run.busVoltageMax||'—')+' V':'',
      run.ignitionDropA!==''?'Ignition A drop: '+run.ignitionDropA+' rpm':'',
      run.ignitionDropB!==''?'Ignition B drop: '+run.ignitionDropB+' rpm':'',
      run.staticRpm!==''?'Static RPM: '+run.staticRpm:'',
      s.oilPressureSeconds!==''?'Oil-pressure confirmation: '+s.oilPressureSeconds+' sec (recorder cue '+(s.postPurgeFirstStart?'5':'10')+' sec)':'',
      reason?'Session note: '+reason:''
    ].filter(Boolean).join('\\n');
    return {
      id:uid(),date:run.date||today(),airframeHours:db.aircraft?.airframeHours||'',
      engineHours:run.tachEnd||run.tachStart||db.aircraft?.engineHours||'',laborHours:'',
      system:'Engine',projectIds:A(run.projectIds).length?A(run.projectIds):[ENGINE_PROJECT_ID],
      work:'ROTAX 912 ULS — First Start / Initial Ground Run — Run #'+s.runNumber,
      observations:obs,blockers:findings.length?findings.length+' commissioning finding(s) remain open.':'',
      nextStep:open?'Resolve remaining commissioning steps/findings before the next readiness gate.':'Continue with remaining post-run / Flight Release closeout.',
      otherCost:'',notes:'Structured Run/Test #'+run.id+' contains the step-by-step recorder history and measurement snapshots.',
      consumedParts:[],origin:'commissioning-run',sourceRunId:run.id
    };
  }

  function finalizeRun(runId,status,reason=''){
    const run=runById(runId);if(!run||isFinal(run))return;
    const s=sessionOf(run);
    if(status==='Completed'&&s.engineStartedAt&&!s.engineStoppedAt)return alert('Record Engine Stopped before finishing the session.');
    const at=nowISO(),m=collectFields();
    const basis=structuredClone(run);updateAggregate(basis,m);if(m.tachStart!=='')basis.tachStart=m.tachStart;if(m.tachEnd!=='')basis.tachEnd=m.tachEnd;
    const findings=findingIds(run),open=unresolvedStepCount(run);
    const outcome=status==='Aborted'?'Aborted':(findings.length||open?'Follow-up Needed':'Satisfactory');
    const logRecord=workLogFor({...basis,commissioningRun:{...s,status}},outcome,reason);
    try{
      trackerStore.batch(tx=>{
        if(!s.workLogId)tx.write('log',logRecord.id,logRecord);
        tx.update('run',run.id,draft=>{
          applyReadingToDraft(draft,m,status==='Aborted'?'Abort reading':'Final reading');
          const cr=draft.commissioningRun;cr.status=status;cr.endedAt=at;cr.finalNote=reason||m.note||'';
          if(!cr.engineStoppedAt&&cr.engineStartedAt)cr.engineStoppedAt=at;
          if(cr.engineStartedAt)draft.durationMin=engineDurationMin(draft,cr.engineStoppedAt||at);
          if(!cr.workLogId)cr.workLogId=logRecord.id;
          draft.outcome=outcome;
          draft.observations='Guided commissioning Run #'+cr.runNumber+' — '+outcome+'. '+A(cr.steps).filter(x=>x.status==='complete').length+'/'+A(cr.steps).length+' guided steps complete.';
          draft.notes=cr.finalNote||draft.notes||'';
        });
      },{message:status==='Aborted'?'Commissioning run aborted and Work Log saved.':'Commissioning run finished and Work Log saved.'});
      clearDraft(run.id);stopRecorderTimer();openRunDetail(run.id);
    }catch(error){alert('The session was not safely finalized: '+(error?.message||String(error)))}
  }

  window.abortCommissioningRun=function(runId){
    const run=runById(runId);if(!run||isFinal(run))return;
    const cur=currentStep(run),m=collectFields(),reason=String(m.note||'').trim();
    if(!reason)return alert('Describe why the run is being aborted in the step note first.');
    if(!confirm('Abort this commissioning run and create an unresolved Before Flight squawk?'))return;
    const sid=typeof nextNumericId==='function'?nextNumericId(db.squawks,800):uid();
    const squawk={
      id:sid,title:'Aborted commissioning Run #'+sessionOf(run).runNumber+' — '+String(cur?.item?.text||'First-start session').slice(0,90),
      system:'Engine',severity:'Before Flight',status:'Open',discoveredDate:run.date||today(),
      airframeHours:db.aircraft?.airframeHours||'',engineHours:m.tachEnd||m.tachStart||run.tachEnd||run.tachStart||db.aircraft?.engineHours||'',
      description:reason+(cur?.item?'\\n\\nCurrent step: '+cur.item.text:''),
      action:'Resolve the abort reason and re-establish the applicable commissioning gate before continuing.',
      resolution:'',projectId:ENGINE_PROJECT_ID,resolvedDate:'',sourceRunId:run.id,
      checklistId:FIRST_START_CHECKLIST_ID,checklistItemId:String(cur?.item?.id||'')
    };
    const at=nowISO();
    try{
      trackerStore.batch(tx=>{
        tx.write('squawk',sid,squawk);
        tx.update('run',run.id,draft=>{
          applyReadingToDraft(draft,m,'Abort reading');
          const cr=draft.commissioningRun;cr.status='Aborted';cr.endedAt=at;cr.finalNote=reason;
          cr.findingSquawkIds=A(cr.findingSquawkIds);if(!cr.findingSquawkIds.includes(sid))cr.findingSquawkIds.push(sid);
          if(!cr.engineStoppedAt&&cr.engineStartedAt)cr.engineStoppedAt=at;
          if(cr.engineStartedAt)draft.durationMin=engineDurationMin(draft,cr.engineStoppedAt);
          draft.outcome='Aborted';draft.observations='Guided commissioning Run #'+cr.runNumber+' aborted. Reason: '+reason;draft.notes=reason;
          if(!cr.workLogId){
            const basis=structuredClone(draft),log=workLogFor(basis,'Aborted',reason);
            tx.write('log',log.id,log);cr.workLogId=log.id;
          }
        });
      },{message:'Commissioning run aborted; squawk and Work Log recorded.'});
      clearDraft(run.id);stopRecorderTimer();openRunDetail(run.id);
    }catch(error){alert('Abort record was not safely saved: '+(error?.message||String(error)))}
  };

  window.finishCommissioningRun=function(runId){
    const run=runById(runId);if(!run||isFinal(run))return;
    const open=unresolvedStepCount(run);
    if(open&&!confirm('This session still has '+open+' incomplete guided step'+(open===1?'':'s')+'. Finish it as Follow-up Needed anyway?'))return;
    finalizeRun(run.id,'Completed',String(collectFields().note||'').trim());
  };

  window.openCommissioningSource=function(runId){
    const run=String(runId)==='preview'?previewRun:runById(runId),cur=currentStep(run),doc=stepSourceDoc(cur?.item);
    if(doc)openDocumentDetail(doc.id);
  };
  window.addCommissioningPhoto=runId=>chooseAttachments('run',runId);

  function recorderStatus(run){
    const s=sessionOf(run);
    if(s.status==='Preview')return 'PREVIEW';
    if(s.status==='Aborted')return 'ABORTED';
    if(s.status==='Completed')return run.outcome==='Satisfactory'?'COMPLETE':'FOLLOW-UP';
    if(s.status==='Post-Run')return 'POST-RUN';
    if(s.engineStartedAt)return 'ENGINE RUNNING';
    return 'SETUP';
  }
  function readingField(label,id,val,unit='',step='any',disabled=false){
    return '<label class="commissioning-reading"><span>'+E(label)+(unit?' <small>'+E(unit)+'</small>':'')+'</span><input id="'+id+'" type="number" step="'+step+'" value="'+E(val||'')+'" '+(disabled?'disabled':'oninput="queueCommissioningDraftSave(currentRecorderRunId())"')+'></label>';
  }
  window.currentRecorderRunId=function(){return document.getElementById('commissioningRecorder')?.dataset?.runId||''};

  function renderRecorder(run,preview=false){
    const s=sessionOf(run),cur=currentStep(run),steps=A(s?.steps),fields=recorderFields(run);
    if(!s||!cur)return alert('Recorder session has no guided steps.');
    const completed=steps.filter(x=>x.status==='complete').length,findings=steps.filter(x=>x.status==='finding').length;
    const final=isFinal(run),readonly=preview||final,source=stepSourceDoc(cur.item);
    const engineStarted=!!s.engineStartedAt,engineStopped=!!s.engineStoppedAt,oilConfirmed=!!s.oilPressureConfirmedAt;
    openModal(`${modalHeader('First Start / Ground Run — '+(preview?'Preview':'Run #'+s.runNumber),recorderStatus(run))}
      <div id="commissioningRecorder" data-run-id="${E(String(run.id))}" class="commissioning-recorder">
        ${preview?'<div class="notice"><b>Preview only.</b> Nothing here will create a Run/Test, change a checklist, or create a squawk.</div>':''}
        <div class="commissioning-recorder-top">
          <div><span>Guided steps</span><b>${completed}/${steps.length}</b><small>${findings} finding${findings===1?'':'s'}</small></div>
          <div><span>Session</span><b id="crSessionTimer">0:00</b><small>elapsed</small></div>
          <div><span>Engine</span><b id="crEngineTimer">${engineStarted?(engineStopped?fmtElapsed(elapsedSeconds(s.engineStartedAt,Date.parse(s.engineStoppedAt))):'0:00'):'—'}</b><small>${engineStopped?'stopped':engineStarted?'running':'not started'}</small></div>
          <div><span>Oil pressure</span><b id="crOilTimer">${oilConfirmed?E(String(s.oilPressureSeconds))+' sec':engineStarted?'0.0 sec':'—'}</b><small>${s.postPurgeFirstStart?'post-purge cue 5 sec':'general cue 10 sec'}</small></div>
        </div>
        <div class="commissioning-engine-actions">
          ${!preview&&!final&&!engineStarted?'<button class="danger" onclick="startCommissioningEngineTimer('+run.id+')">ENGINE STARTED — START TIMER</button>':''}
          ${!preview&&!final&&engineStarted&&!oilConfirmed?'<button class="primary" onclick="confirmCommissioningOilPressure('+run.id+')">Oil Pressure Confirmed</button>':''}
          ${!preview&&!final&&engineStarted&&!engineStopped?'<button class="secondary" onclick="stopCommissioningEngineTimer('+run.id+')">Engine Stopped</button>':''}
          ${!preview&&!final?'<button class="secondary" onclick="saveCommissioningMeasurement('+run.id+')">Log Reading</button>':''}
          ${!preview?'<button class="secondary" onclick="addCommissioningPhoto('+run.id+')">Photo / File</button>':''}
        </div>
        <div class="commissioning-readings">
          ${readingField('RPM','crRpm',fields.rpm,'rpm','1',readonly)}
          ${readingField('Oil pressure','crOilP',fields.oilPressure,'psi','0.1',readonly)}
          ${readingField('Oil temp','crOilT',fields.oilTemp,'°F','1',readonly)}
          ${readingField('Coolant','crCoolantT',fields.coolantTemp,'°F','1',readonly)}
          ${readingField('CHT','crCht',fields.cht,'°F','1',readonly)}
          ${readingField('Fuel pressure','crFuelP',fields.fuelPressure,'psi','0.1',readonly)}
          ${readingField('Bus voltage','crBusV',fields.busVoltage,'V','0.1',readonly)}
          ${readingField('Ignition A drop','crIgnA',fields.ignitionDropA,'rpm','1',readonly)}
          ${readingField('Ignition B drop','crIgnB',fields.ignitionDropB,'rpm','1',readonly)}
          ${readingField('Idle RPM','crIdleRpm',fields.idleRpm,'rpm','1',readonly)}
          ${readingField('Static RPM','crStaticRpm',fields.staticRpm,'rpm','1',readonly)}
          ${readingField('ENG hr start','crTachStart',fields.tachStart||run.tachStart,'hr','0.1',readonly)}
          ${readingField('ENG hr end','crTachEnd',fields.tachEnd||run.tachEnd,'hr','0.1',readonly)}
        </div>
        <div class="commissioning-current-step ${cur.result.status==='finding'?'has-finding':cur.result.status==='complete'?'is-complete':''}">
          <div class="commissioning-step-kicker">STEP ${cur.index+1} OF ${steps.length} • ${E(cur.item?.group||'Commissioning')}</div>
          <h2>${E(cur.item?.text||cur.result.text)}</h2>
          <div class="task-meta">
            ${cur.item?.requiredBefore?'<span class="mini-badge warn">'+E(typeof checklistReadinessGateLabel==='function'?checklistReadinessGateLabel(cur.item.requiredBefore):cur.item.requiredBefore)+'</span>':''}
            ${source?'<span class="mini-badge">'+E(source.name)+'</span>':''}
            ${cur.item?.sourcePage?'<span class="mini-badge">'+E(cur.item.sourcePage)+'</span>':''}
            ${cur.result.status==='complete'?'<span class="mini-badge good">Complete</span>':''}
            ${cur.result.status==='finding'?'<span class="mini-badge warn">Finding recorded</span>':''}
          </div>
          ${cur.item?.moreInfo?'<div class="commissioning-step-info">'+E(cur.item.moreInfo)+'</div>':''}
          <label class="commissioning-step-note"><span>Step note / finding / observation</span><textarea id="crStepNote" ${readonly?'disabled':''} oninput="queueCommissioningDraftSave(currentRecorderRunId())">${E(fields.note||cur.result.note||'')}</textarea></label>
          <div class="commissioning-step-actions">
            <button class="secondary" onclick="moveCommissioningRecorder('${E(String(run.id))}',-1)" ${cur.index<=0?'disabled':''}>← Previous</button>
            ${source?`<button class="secondary" onclick="openCommissioningSource('${E(String(run.id))}')">Source</button>`:''}
            ${!readonly?'<button class="warning" onclick="recordCommissioningFinding('+run.id+')">Finding</button><button class="success" onclick="completeCommissioningStep('+run.id+')">Complete & Next</button>':''}
            <button class="secondary" onclick="moveCommissioningRecorder('${E(String(run.id))}',1)" ${cur.index>=steps.length-1?'disabled':''}>Next →</button>
          </div>
        </div>
        ${final?'<div class="notice"><b>Session '+E(s.status)+'.</b> Outcome: '+E(run.outcome||'—')+(s.workLogId?' • Work Log #'+E(String(s.workLogId)):'')+'</div>':''}
        <div class="tiny muted">Recorder timing is a workflow aid, not a substitute for observing the engine indications and following the applicable manufacturer/aircraft procedure.</div>
        <div class="commissioning-recorder-footer">
          <div class="commissioning-save-status">
            <b id="crSaveState" class="${preview?'is-preview':Object.keys(readDraft(run.id)).length?'has-unsaved':'is-saved'}">${preview?'Preview • nothing is saved':Object.keys(readDraft(run.id)).length?'Unsaved changes • kept locally on this device':'Saved to Run/Test ✓'}</b>
            <small>${preview?'Preview never writes tracker data. In a real run, Save Progress durably saves the current fields and step note.':final?'This session is finalized.':'Save Progress does not complete the step. Log Reading creates a timestamped measurement snapshot.'}</small>
          </div>
          <div class="commissioning-footer-actions">
            ${!preview&&!final?'<button class="danger" onclick="abortCommissioningRun('+run.id+')">Abort Run</button><button class="secondary" onclick="finishCommissioningRun('+run.id+')">Finish Session</button>':''}
            ${preview?'<button class="primary" disabled title="Available only after a real commissioning Run/Test is created">Save Progress — real run only</button>':!final?'<button class="primary" onclick="saveCommissioningProgress('+run.id+')">Save Progress</button>':''}
          </div>
        </div>
      </div>`,true);
    startRecorderTimer(run,preview);
  }

  function stopRecorderTimer(){if(recorderTimer){clearInterval(recorderTimer);recorderTimer=null}}
  function startRecorderTimer(run,preview=false){
    stopRecorderTimer();
    const tick=()=>{
      const box=document.getElementById('commissioningRecorder');if(!box){stopRecorderTimer();return}
      const s=sessionOf(preview?previewRun:runById(run.id));if(!s)return;
      const sess=document.getElementById('crSessionTimer');if(sess)sess.textContent=fmtElapsed(elapsedSeconds(s.startedAt||nowISO()));
      const eng=document.getElementById('crEngineTimer');
      if(eng&&s.engineStartedAt)eng.textContent=fmtElapsed(elapsedSeconds(s.engineStartedAt,s.engineStoppedAt?Date.parse(s.engineStoppedAt):Date.now()));
      const oil=document.getElementById('crOilTimer');
      if(oil&&s.engineStartedAt){
        if(s.oilPressureConfirmedAt){oil.textContent=String(s.oilPressureSeconds)+' sec';oil.classList.remove('limit-exceeded')}
        else if(!s.engineStoppedAt){const sec=elapsedSeconds(s.engineStartedAt);oil.textContent=sec.toFixed(1)+' sec';oil.classList.toggle('limit-exceeded',sec>(s.postPurgeFirstStart?5:10))}
      }
    };
    tick();if(!preview&&!isFinal(run))recorderTimer=setInterval(tick,250);
  }

  window.openFirstStartRunRecorder=function(runId){const run=runById(runId);if(!run)return alert('Commissioning run could not be found.');renderRecorder(run,false)};
  window.openFirstStartRecorderPreview=function(){
    const steps=initialSteps(),at=nowISO();
    previewRun={
      id:'preview',date:today(),type:'Engine Run',projectIds:[ENGINE_PROJECT_ID],tachStart:db.aircraft?.engineHours||'',
      tachEnd:'',rpmMax:'',oilPressureMin:'',oilTempMax:'',coolantTempMax:'',chtMax:'',fuelPressureMin:'',fuelPressureMax:'',
      outcome:'Follow-up Needed',observations:'',notes:'',
      commissioningRun:{kind:'first-start',runNumber:1,status:'Preview',startedAt:at,currentIndex:0,steps,
        postPurgeFirstStart:true,engineStartedAt:'',engineStoppedAt:'',oilPressureConfirmedAt:'',oilPressureSeconds:'',
        measurements:[],currentReadings:{},findingSquawkIds:[]}
    };
    renderRecorder(previewRun,true);
  };

  window.openFirstStartRecorder=function(){
    const active=activeRun();if(active)return openFirstStartRunRecorder(active.id);
    const gate=startGate();
    if(!gate?.clear){
      return openModal(`${modalHeader('First Start Recorder','First Start gate is not clear')}
        <div class="danger-note"><b>${E(String(gate?.open??'—'))} First Start requirement${gate?.open===1?'':'s'} still open.</b><br>The recorder will not create a real engine-run session until the First Start gate is complete.</div>
        <div class="detail-card"><h3>What you can do now</h3><p class="muted">Review the blockers, or preview the guided recorder without saving data or changing checklist status.</p></div>
        <div class="modal-actions"><button class="secondary" onclick="openFirstStartRecorderPreview()">Preview Recorder</button><button class="primary" onclick="openCommissioningGate('first-start')">Review First Start Blockers</button></div>`,true);
    }
    const purge=typeof checklistById==='function'?checklistById('rotax912-oil-purge-first-start'):null;
    const purgeDone=A(purge?.items).length>0&&A(purge.items).every(i=>!!i.done),n=runNumber();
    openModal(`${modalHeader('Start First Start / Ground Run','Create durable commissioning Run #'+n)}
      <div class="notice"><b>First Start gate is clear.</b> Starting creates a Run/Test record immediately so progress survives refreshes and device changes.</div>
      <div class="form-grid">
        ${field('Engine hours / tach start','crStartTach',db.aircraft?.engineHours||'','number','step="0.1" min="0"')}
        <label class="focus-toggle full"><input id="crPostPurge" type="checkbox" ${purgeDone?'checked':''}> <span>This is the first engine start immediately following the oil-system purge. Use the 5-second oil-pressure cue.</span></label>
        ${textareaField('Session setup note / ambient conditions','crStartNote','')}
      </div>
      <div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="createFirstStartRun()">Create Run #${n}</button></div>`,true);
  };

  window.createFirstStartRun=function(){
    const gate=startGate();if(!gate?.clear)return openFirstStartRecorder();
    if(activeRun())return openFirstStartRunRecorder(activeRun().id);
    const n=runNumber(),id=typeof nextNumericId==='function'?nextNumericId(db.runs,900):uid(),at=nowISO();
    const tach=value('crStartTach'),note=value('crStartNote'),post=!!document.getElementById('crPostPurge')?.checked;
    const run={
      id,date:today(),type:'Engine Run',durationMin:'',tachStart:tach,tachEnd:'',rpmMax:'',oilPressureMin:'',
      oilTempMax:'',coolantTempMax:'',chtMax:'',fuelPressureMin:'',fuelPressureMax:'',busVoltageMin:'',busVoltageMax:'',
      ignitionDropA:'',ignitionDropB:'',idleRpm:'',staticRpm:'',outcome:'Follow-up Needed',
      observations:'Guided commissioning Run #'+n+' in progress.',notes:note,projectIds:[ENGINE_PROJECT_ID],
      commissioningRun:{
        kind:'first-start',runNumber:n,status:'Setup',startedAt:at,endedAt:'',currentIndex:0,steps:initialSteps(),
        postPurgeFirstStart:post,engineStartedAt:'',engineStoppedAt:'',oilPressureConfirmedAt:'',oilPressureSeconds:'',
        measurements:[],currentReadings:{tachStart:tach,note:''},findingSquawkIds:[],workLogId:null,finalNote:''
      }
    };
    try{trackerStore.write('run',id,run,{message:'Commissioning Run #'+n+' started.'});closeModal();openFirstStartRunRecorder(id)}
    catch(error){alert('Commissioning run was not created: '+(error?.message||String(error)))}
  };

  function injectRecorderActions(){
    const panel=document.getElementById('commissioningReadinessPanel');if(!panel)return;
    panel.querySelector('.commissioning-recorder-entry')?.remove();
    const active=activeRun(),gate=startGate(),row=document.createElement('div');row.className='commissioning-recorder-entry';
    row.innerHTML=active?
      '<div><span>Guided run recorder</span><b>Run #'+E(String(sessionOf(active).runNumber))+' — '+E(recorderStatus(active))+'</b><small>Durable session in Runs / Tests</small></div><button class="primary" onclick="openFirstStartRunRecorder('+active.id+')">Resume Recorder</button>':
      '<div><span>Guided run recorder</span><b>'+(gate?.clear?'Ready to start':'Waiting on First Start gate')+'</b><small>'+(gate?.clear?'Create a durable guided engine-run session.':E(String(gate?.open??'—'))+' First Start blocker'+(gate?.open===1?'':'s')+' remain.')+'</small></div>'+
      '<div class="action-row"><button class="secondary" onclick="openFirstStartRecorderPreview()">Preview Recorder</button><button class="'+(gate?.clear?'primary':'secondary')+'" onclick="openFirstStartRecorder()">'+(gate?.clear?'Start First Run':'Review / Start')+'</button></div>';
    panel.appendChild(row);
  }
  const baseReadiness=window.renderReadiness;
  window.renderReadiness=function(...args){const out=baseReadiness?.apply(this,args);injectRecorderActions();return out};

  const baseRunDetail=window.openRunDetail;
  window.openRunDetail=function(id){
    baseRunDetail?.(id);
    const run=runById(id),s=sessionOf(run);if(!s)return;
    queueMicrotask(()=>{
      const box=document.getElementById('modalBox');if(!box)return;
      const card=document.createElement('div');card.className='notice';card.style.marginBottom='12px';
      card.innerHTML='<b>Guided commissioning Run #'+E(String(s.runNumber))+'</b><br>'+E(s.status)+' • '+A(s.steps).filter(x=>x.status==='complete').length+'/'+A(s.steps).length+' guided steps complete'+(findingIds(run).length?' • '+findingIds(run).length+' finding(s)':'')+
        '<div class="action-row" style="margin-top:8px"><button class="primary" onclick="openFirstStartRunRecorder('+run.id+')">'+(isFinal(run)?'View Guided Session':'Resume Guided Session')+'</button>'+
        (s.workLogId?'<button class="secondary" onclick="openLogDetail('+s.workLogId+')">Open Work Log</button>':'')+'</div>';
      box.prepend(card);
    });
  };

  const baseReopenDetail=window.reopenDetail;
  window.reopenDetail=function(type,id){const run=type==='run'?runById(id):null;if(run&&isActive(run))return openFirstStartRunRecorder(run.id);return baseReopenDetail?.(type,id)};

  const style=document.createElement('style');
  style.id='firstStartRecorderStyles';
  style.textContent=`
    .commissioning-recorder{display:flex;flex-direction:column;gap:12px}
    .commissioning-recorder-top{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .commissioning-recorder-top>div{border:1px solid var(--border);border-radius:10px;padding:9px;display:flex;flex-direction:column}
    .commissioning-recorder-top span,.commissioning-recorder-top small{font-size:.72rem;color:var(--muted)}
    .commissioning-recorder-top b{font-size:1.15rem}
    #crOilTimer.limit-exceeded{color:#b42318}
    .commissioning-engine-actions{display:flex;gap:8px;flex-wrap:wrap;position:sticky;top:0;z-index:10;background:var(--panel,#fff);padding:8px 0}
    .commissioning-recorder-footer{position:sticky;bottom:0;z-index:15;display:flex;align-items:center;justify-content:space-between;gap:14px;margin:2px -15px -15px;padding:12px 15px;background:var(--panel,#fff);border-top:1px solid var(--border);box-shadow:0 -6px 18px rgba(0,0,0,.08)}
    .commissioning-save-status{display:flex;flex-direction:column;gap:2px;min-width:0}
    .commissioning-save-status b{font-size:.82rem}
    .commissioning-save-status small{font-size:.72rem;color:var(--muted)}
    .commissioning-save-status .has-unsaved{color:#9a6700}
    .commissioning-save-status .is-saved{color:#1a7f37}
    .commissioning-save-status .is-preview{color:var(--muted)}
    .commissioning-footer-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
    .commissioning-readings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .commissioning-reading{display:flex;flex-direction:column;gap:4px;margin:0}
    .commissioning-reading span{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .commissioning-reading small{font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted)}
    .commissioning-current-step{border:2px solid var(--border);border-radius:14px;padding:15px}
    .commissioning-current-step.is-complete{border-color:var(--good,#6c9)}
    .commissioning-current-step.has-finding{border-color:var(--warn,#d99a31)}
    .commissioning-step-kicker{font-size:.72rem;font-weight:800;color:var(--muted);letter-spacing:.05em}
    .commissioning-current-step h2{font-size:1.12rem;margin:6px 0 8px}
    .commissioning-step-info{margin:9px 0;padding:9px;border-radius:9px;background:var(--soft,#f5f7f8);font-size:.86rem}
    .commissioning-step-note{display:flex;flex-direction:column;gap:5px;margin-top:10px}
    .commissioning-step-note span{font-size:.75rem;font-weight:700}
    .commissioning-step-note textarea{min-height:70px}
    .commissioning-step-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .commissioning-recorder-entry{margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
    .commissioning-recorder-entry>div:first-child{display:flex;flex-direction:column}
    .commissioning-recorder-entry span,.commissioning-recorder-entry small{font-size:.74rem;color:var(--muted)}
    @media(max-width:800px){
      .commissioning-recorder-top{grid-template-columns:repeat(2,minmax(0,1fr))}
      .commissioning-readings{grid-template-columns:repeat(2,minmax(0,1fr))}
      .commissioning-recorder-entry{align-items:stretch;flex-direction:column}
      .commissioning-recorder-footer{align-items:stretch;flex-direction:column;margin-left:-15px;margin-right:-15px}
      .commissioning-footer-actions{width:100%}
      .commissioning-footer-actions button{flex:1 1 auto}
      .commissioning-footer-actions .primary{margin-left:auto}
    }
  `;
  document.head.appendChild(style);
})();
