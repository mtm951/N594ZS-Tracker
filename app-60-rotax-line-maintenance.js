'use strict';
// ---------- V5.15 ROTAX 912 MML LINE MAINTENANCE PROGRAM ----------
// Source: MML-912 / P/N 899196, Edition 04 / Revision 2, June 01 2025.
// User supplied this as the current ROTAX line-maintenance reference for N594ZS.

(function(){
  if(window.__n594zsRotaxLineProgramInstalled)return;
  window.__n594zsRotaxLineProgramInstalled=true;

  const A=v=>Array.isArray(v)?v:[];
  const T=v=>String(v??'').trim();
  const SOURCE='ROTAX 912 Series Maintenance Manual Line';
  const DOCREF='MML-912 / P/N 899196';
  const REV='Ed. 04 / Rev. 2 • June 01 2025';
  const DOC_KEY='rotax-mml-912-ed4-r2';

  function lineProgram(){
    db.aircraft.engineProgram=db.aircraft.engineProgram||{};
    const p=db.aircraft.engineProgram;
    p.profile=p.profile||{};
    p.profile.leadedOver30=p.profile.leadedOver30||'Unknown';
    p.serviceItems=A(p.serviceItems);
    return p;
  }
  function sourceNote(chapter,page,extra=''){
    return [SOURCE,DOCREF,REV,`Ch. ${chapter} p.${page}`,extra].filter(Boolean).join(' • ');
  }
  function addYears(iso,years){
    if(!iso||!Number(years))return '';
    const d=new Date(iso+'T12:00:00');if(Number.isNaN(d.getTime()))return '';
    const m=d.getMonth();d.setFullYear(d.getFullYear()+Number(years));if(d.getMonth()!==m)d.setDate(0);
    return d.toISOString().slice(0,10);
  }
  function numSerial(){
    const raw=T(lineProgram().profile.serialNumber).replace(/\D/g,'');
    return raw?Number(raw):null;
  }
  function tboForSerial(){
    const s=numSerial();
    if(!s)return null;
    if(s<=4427532)return {hours:1200,years:10,label:'≤ S/N 4427532'};
    if(s>=4427533&&s<=6775789)return {hours:1500,years:12,label:'S/N 4427533–6775789'};
    if(s>=6775790&&s<=6787000)return {hours:2000,years:15,label:'S/N 6775790–6787000'};
    if(s>=9569001)return {hours:2000,years:15,label:'S/N 9569001+'};
    return {hours:null,years:null,label:'S/N range requires table review'};
  }
  window.rotax912TboForSerial=tboForSerial;

  let mmlDirty=false;
  function setChanged(obj,key,value){
    if(obj[key]!==value){obj[key]=value;mmlDirty=true}
  }
  function blank(v){return v===undefined||v===null||v===''}
  function sameValue(a,b){return String(a??'')===String(b??'')}
  function adoptSourceValue(obj,field,sourceField,value,_legacy=[]){
    if(value===undefined)return;
    const current=obj[field],previous=obj[sourceField];
    if(previous===undefined){
      // First adoption is deliberately conservative: a nonblank existing value is
      // presumed user-owned unless it already equals the manufacturer value.
      if(blank(current)||sameValue(current,value))setChanged(obj,field,value);
      setChanged(obj,sourceField,value);
      return;
    }
    // Later source revisions may update a visible value only while it still equals
    // the prior manufacturer value. Any user override is left untouched.
    if(blank(current)||sameValue(current,previous))setChanged(obj,field,value);
    setChanged(obj,sourceField,value);
  }

  function ensureDoc(){
    db.docs=A(db.docs);
    let d=db.docs.find(x=>x.sourceKey===DOC_KEY)||
      db.docs.find(x=>/maintenance manual line/i.test(x.name||'')&&/rotax|912/i.test([x.publisher,x.name,x.notes].join(' ')));
    if(d){
      // Existing document records are user-owned. Only fill missing source metadata.
      const defaults={
        revision:'Edition 04 / Revision 2',
        issueDate:'2025-06-01',
        publisher:'BRP-Rotax',
        system:'Engine'
      };
      for(const [k,v] of Object.entries(defaults))if(blank(d[k]))setChanged(d,k,v);
      if(blank(d.rotaxSourceManaged))setChanged(d,'rotaxSourceManaged',true);
      if(blank(d.sourceKey))setChanged(d,'sourceKey',DOC_KEY);
      if(!/MML-912/.test(d.notes||'')&&blank(d.sourceNotes))setChanged(d,'sourceNotes',`${DOCREF}. Current ROTAX line-maintenance reference supplied for N594ZS.`);
      return d;
    }
    const nums=db.docs.map(x=>Number(x.id)).filter(Number.isFinite);
    d={
      id:Math.max(400,...nums)+1,
      name:'ROTAX 912 Series Maintenance Manual Line',
      type:'Engine maintenance manual',
      revision:'Edition 04 / Revision 2',
      issueDate:'2025-06-01',
      system:'Engine',
      publisher:'BRP-Rotax',
      location:'Current manufacturer reference supplied for N594ZS; attach the PDF in Documents for direct in-app file access.',
      notes:`${DOCREF}. Current ROTAX line-maintenance reference for 912 Series. Revision 2 is a complete revision dated June 01 2025.`,
      linkedProjectIds:A(db.projects).filter(p=>['Engine','Fuel','Cooling'].includes(p.system)).map(p=>p.id),
      linkedPartIds:A(db.parts).filter(p=>['Engine','Fuel','Cooling'].includes(p.system)).map(p=>p.id),
      linkedLogIds:[],updates:[],rotaxSourceManaged:true,sourceKey:DOC_KEY
    };
    db.docs.push(d);mmlDirty=true;return d;
  }

  function ensureService(title,defs={}){
    const p=lineProgram();
    let i=p.serviceItems.find(x=>T(x.title).toLowerCase()===title.toLowerCase());
    if(!i){
      i={id:crypto.randomUUID(),title,kind:defs.kind||'Service',installedDate:'',installedHours:'',lastDate:'',lastHours:'',intervalDays:'',intervalYears:'',intervalHours:'',nextDate:'',nextHours:'',partNumber:'',manufacturer:'',notes:'',sourceNotes:'',history:[],mmlManaged:true};
      p.serviceItems.push(i);mmlDirty=true;
    }
    if(blank(i.kind))setChanged(i,'kind',defs.kind||'Service');
    if(blank(i.manufacturer))setChanged(i,'manufacturer',defs.manufacturer||'ROTAX');
    if(i.mmlManaged!==true)setChanged(i,'mmlManaged',true);

    // Manufacturer intervals are tracked separately. If the visible value still
    // equals the previous manufacturer value, it may update. A user-customized
    // value is preserved.
    adoptSourceValue(i,'intervalHours','rotaxSourceIntervalHours',defs.intervalHours,[2,25,50,100,200,400,600,1000]);
    adoptSourceValue(i,'intervalYears','rotaxSourceIntervalYears',defs.intervalYears,[1,5,10,12,15]);
    adoptSourceValue(i,'intervalDays','rotaxSourceIntervalDays',defs.intervalDays,[]);
    adoptSourceValue(i,'nextHours','rotaxSourceNextHours',defs.nextHours,[]);
    if(defs.installedHours!==undefined&&blank(i.installedHours))setChanged(i,'installedHours',defs.installedHours);
    if(defs.notes!==undefined)setChanged(i,'sourceNotes',defs.notes);
    return i;
  }

  function syncMaintenance(i){
    db.maintenance=A(db.maintenance);
    // Never hijack a user-created maintenance record merely because its title matches.
    let m=db.maintenance.find(x=>String(x.engineServiceItemId||'')===String(i.id));
    if(!m){
      m={
        id:nextNumericId(db.maintenance,760),
        title:i.title,system:'Engine',basis:'date',meter:'engine',
        intervalDays:'',intervalHours:'',lastDate:'',lastHours:'',
        nextDate:'',nextHours:'',notes:'',engineServiceItemId:i.id,
        rotaxManaged:true,sourceNotes:i.sourceNotes||''
      };
      db.maintenance.push(m);mmlDirty=true;
    }
    if(blank(m.engineServiceItemId))setChanged(m,'engineServiceItemId',i.id);
    if(m.rotaxManaged!==true)setChanged(m,'rotaxManaged',true);
    if(blank(m.title))setChanged(m,'title',i.title);
    if(blank(m.system))setChanged(m,'system','Engine');
    if(blank(m.meter))setChanged(m,'meter','engine');
    if(i.sourceNotes!==undefined)setChanged(m,'sourceNotes',i.sourceNotes);

    const baseDate=i.lastDate||i.installedDate||'';
    const yearDue=num(i.intervalYears)>0&&baseDate?addYears(baseDate,i.intervalYears):'';
    const hasDate=!!(i.intervalDays||i.intervalYears||i.nextDate||yearDue),hasHours=!!(i.intervalHours||i.nextHours);
    const sourceBasis=hasDate&&hasHours?'both':hasHours?'hours':'date';
    adoptSourceValue(m,'basis','rotaxSourceBasis',sourceBasis,['date','hours','both']);
    adoptSourceValue(m,'intervalDays','rotaxSourceIntervalDays',i.intervalDays||'',[]);
    adoptSourceValue(m,'intervalHours','rotaxSourceIntervalHours',i.intervalHours||'',[2,25,50,100,200,400,600,1000]);
    adoptSourceValue(m,'lastDate','rotaxSourceLastDate',i.lastDate||i.installedDate||'',[]);
    adoptSourceValue(m,'lastHours','rotaxSourceLastHours',i.lastHours!==''?i.lastHours:i.installedHours,[]);
    adoptSourceValue(m,'nextDate','rotaxSourceNextDate',i.nextDate||yearDue||'',[]);
    adoptSourceValue(m,'nextHours','rotaxSourceNextHours',i.nextHours||'',[]);
  }

  function applyIntervals(){
    const p=lineProgram(),leaded=p.profile.leadedOver30;
    const oilHours=leaded==='Yes'?50:100;
    const plugHours=leaded==='Yes'?200:400;
    const diffHours=leaded==='Yes'?100:200;
    const installBase=p.profile.hoursAtInstall!==''?Number(p.profile.hoursAtInstall):null;
    const items=[
      ensureService('Cooling hoses',{kind:'Component',intervalYears:5,notes:sourceNote('05-10-00','7','All rubber cooling-system hoses: replace every 5 years, independent of visual inspection.')}),
      ensureService('Fuel hoses',{kind:'Component',intervalYears:5,notes:sourceNote('05-10-00','7','All rubber fuel-system hoses: replace every 5 years; see current SI-912-022.')}),
      ensureService('Oil hoses',{kind:'Component',intervalYears:5,notes:sourceNote('05-10-00','7','Engine-supply-volume rubber lubrication hoses: 5 years when not covered by the aircraft-manufacturer maintenance schedule.')}),
      ensureService('Fuel pump',{kind:'Component',intervalYears:5,notes:sourceNote('05-10-00','7','Fuel pump replacement every 5 years.')}),
      ensureService('Carburetor diaphragms',{kind:'Component',intervalYears:5,notes:sourceNote('05-10-00','7','Both carburetor diaphragms: replace every 5 years.')}),
      ensureService('Carburetor sockets',{kind:'Component',intervalYears:5,notes:sourceNote('05-10-00','7','Carburetor sockets: replace every 5 years; separate 200-hour inspection also applies.')}),
      ensureService('Oil & filter change',{kind:'Service',intervalHours:oilHours,notes:sourceNote('05-20-00','12-13',`Normal recurring interval 100 hr; oil/filter also at first 25 hr. 50-hr oil/filter change applies when leaded AVGAS is more than 30% of operation. Current tracker fuel-use profile: ${leaded}.`)}),
      ensureService('Carburetor service / synchronization',{kind:'Service',intervalHours:100,notes:sourceNote('05-20-00','13','Mechanical and pneumatic carburetor synchronization at first 25 hr and each 100 hr.')}),
      ensureService('Throttle / choke adjustment',{kind:'Inspection',intervalHours:100,notes:sourceNote('05-20-00','13','Check free movement and full stop-to-stop travel of carburetor actuation at first 25 hr and each 100 hr.')}),
      ensureService('100 hr / annual engine inspection',{kind:'Inspection',intervalHours:100,intervalYears:1,notes:sourceNote('05-20-00','2','100-hour inspection every 100 operating hours or 12 months, whichever comes first. Manual permits ±10 hr interval tolerance and ±2 months for annual inspection; tracker due values remain nominal.')}),
      ensureService('Carburetor 200 hr inspection / float check',{kind:'Inspection',intervalHours:200,notes:sourceNote('05-20-00','13-14','At 200 hr: float-chamber ventilation, carburetor removal/inspection, float weight, and carburetor-socket inspection per schedule.')}),
      ensureService('Differential pressure check',{kind:'Inspection',intervalHours:diffHours,notes:sourceNote('05-20-00','9',`Normal scheduled differential-pressure check at 200 hr. With leaded AVGAS >30%, additional 25/100-hr checks apply. Current tracker fuel-use profile: ${leaded}.`)}),
      ensureService('Spark plug replacement',{kind:'Service',intervalHours:plugHours,notes:sourceNote('05-20-00','10','Normal replacement at 400 hr; 200 hr when leaded AVGAS is more than 30% of operation. Inspect sooner per schedule / condition.')}),
      ensureService('Propeller gearbox friction-torque check',{kind:'Inspection',intervalHours:100,notes:sourceNote('05-20-00','14','Check friction torque in free rotation at first 25 hr and every 100 hr on gearboxes with overload clutch.')}),
      ensureService('Propeller gearbox / overload clutch inspection',{kind:'Inspection',intervalHours:1000,notes:sourceNote('05-20-00','14-15','1000-hr gearbox schedule includes gear-set pitting, overload-clutch tooth wear and overload-clutch inspection. A 600-hr overload-clutch inspection applies only to the specified clutch P/N 996886 without lead drain holes when leaded fuel exceeds 30%.')}),
      ensureService('Air-intake heat-up measurement',{kind:'Inspection',intervalHours:200,notes:sourceNote('05-20-00','15','Measure air-intake heat-up with closed cowling at first 25 hr and 200 hr per schedule.')})
    ];
    if(installBase!==null&&Number.isFinite(installBase)){
      items.push(ensureService('Exhaust fixation retorque — first 2 hr',{kind:'Inspection',installedHours:installBase,nextHours:installBase+2,notes:sourceNote('05-20-00','3','Manufacturer-recommended inspection: re-tighten exhaust fixation on cylinder head after first 2 hr of operation.')}));
    }else{
      items.push(ensureService('Exhaust fixation retorque — first 2 hr',{kind:'Inspection',notes:sourceNote('05-20-00','3','Re-tighten exhaust fixation on cylinder head after first 2 hr of operation. Enter engine hours at installation to calculate the exact due hour.')}));
    }
    items.forEach(syncMaintenance);
  }

  const annualItems=[
    'Review and document applicable Alert Service Bulletins / Service Bulletins and SI-PAC requirements',
    'Remove and inspect spark plugs for condition; replace if defective and confirm genuine ROTAX plugs',
    'Inspect magnetic plug',
    'Remove oil filter, cut it without introducing chips, and inspect filter media for wear / missing material',
    'General visual inspection of engine, cooling air ducts and cylinder cooling fins',
    'Inspect temperature sensors and oil-pressure sensor for secure fit and wear',
    'Inspect engine coolant hoses for leakage, heat hardening, porosity, loose connections, kinks and restrictions',
    'Inspect water-pump leakage bore',
    'Inspect overflow bottle, expansion-tank line, coolant level and vent passage',
    'Inspect oil lines for leakage, heat hardening, porosity, security, kinks and restrictions',
    'Inspect fuel lines for leakage, heat hardening, porosity, security, kinks/restrictions; inspect steel lines for cracks/scuffing',
    'Inspect wiring and connections for secure fit, damage and wear',
    'Inspect engine suspension and fasteners',
    'Inspect applicable airbox / intake arrangement and applicable exhaust system per manufacturer requirements',
    'Change engine oil and install new oil filter',
    'If auxiliary alternator installed, inspect attachment and V-belt tension',
    'Check carburetor idle speed, actuation / full travel, and mechanical + pneumatic synchronization',
    'Check propeller-gearbox friction torque in free rotation where overload clutch is installed',
    'Inspect expansion tank / radiator cap and verify coolant level',
    'Clean engine as required',
    'Check air filter',
    'Verify operating-fluid levels',
    'Perform engine test run to operating temperature; record ignition check / idle as applicable; inspect for leaks and recheck oil filter by hand when cold'
  ];

  function ensureChecklist(doc){
    db.checklists=A(db.checklists);
    if(!db.checklists.some(x=>x.name==='ROTAX 912 — 100 hr / Annual Engine Check')){
      db.checklists.push({
        id:crypto.randomUUID(),name:'ROTAX 912 — 100 hr / Annual Engine Check',
        purpose:'Current ROTAX line-maintenance schedule for the recurring 100-hour / annual engine check.',
        system:'Engine',trigger:'Every 100 engine hr / 12 months',
        projectId:null,
        notes:`Source: ${DOCREF}, ${REV}, Chapter 05-20-00 pages 2 and 9-16. First 25-hour inspection uses the 100-hour check scope. Conditional leaded-fuel and configuration-specific tasks remain subject to the manual.`,
        documentId:doc?.id||null,
        items:annualItems.map((text,i)=>({id:i+1,text,done:false,note:''})),
        rotaxSourceManaged:true
      });
    }
  }

  function tboHTML(){
    const p=lineProgram().profile,t=tboForSerial(),first=p.firstOperationDate||'';
    if(!p.serialNumber)return '<b>Add engine S/N</b><small>TBO is serial-number dependent.</small>';
    if(!t||!t.hours)return '<b>Review TBO table</b><small>'+esc(t?.label||'Serial range not resolved')+'</small>';
    let sub=t.label;
    if(first)sub+=' • calendar due '+addYears(first,t.years);
    return '<b>'+t.hours+' hr / '+t.years+' yr</b><small>'+esc(sub)+'</small>';
  }
  function lineCardHTML(){
    const p=lineProgram(),leaded=p.profile.leadedOver30;
    return `<div class="card span-12 rotax-line-card" id="rotaxLineProgramCard">
      <div class="section-head"><div><div class="engine-kicker">CURRENT ROTAX LINE MAINTENANCE</div><h2>912 ULS Maintenance Program</h2><div class="muted small">${DOCREF} • ${REV}</div></div><div class="action-row"><button class="btn secondary" onclick="openRotaxLineProfile()">Maintenance Profile</button><button class="btn secondary" onclick="openRotaxLineDocument()">Manual Record</button></div></div>
      <div class="rotax-line-grid">
        <button onclick="openEngineServiceByTitle('100 hr / annual engine inspection')"><span>Recurring inspection</span><b>100 hr / 12 mo</b><small>whichever comes first</small></button>
        <button onclick="openEngineServiceByTitle('Cooling hoses')"><span>Rubber parts / fuel pump</span><b>5 years</b><small>source-defined calendar replacement</small></button>
        <button onclick="openEngineServiceByTitle('Carburetor 200 hr inspection / float check')"><span>Carburetor add-on</span><b>200 hr</b><small>inspection / floats / sockets</small></button>
        <button onclick="openEngineServiceByTitle('Propeller gearbox / overload clutch inspection')"><span>Gearbox add-on</span><b>1000 hr</b><small>conditional 600-hr clutch case noted</small></button>
        <button onclick="openRotaxLineProfile()"><span>Leaded AVGAS >30%</span><b>${esc(leaded)}</b><small>${leaded==='Yes'?'50-hr oil / 200-hr plugs applied':leaded==='No'?'100-hr oil / 400-hr plugs applied':'Set profile for conditional intervals'}</small></button>
        <button onclick="openEngineProfileModal()"><span>Engine TBO</span>${tboHTML()}</button>
      </div>
      <div class="engine-record-note">The MML states that operating hours count whenever the engine is running, regardless of load. It also requires the 100-hour inspection every 100 operating hours or 12 months. The first 25-hour inspection uses the 100-hour check scope for newly delivered or overhauled engines.</div>
    </div>`;
  }
  function injectCard(){
    const page=document.getElementById('page-systems');if(!page||document.getElementById('rotaxLineProgramCard'))return;
    const title=T(page.querySelector('.system-title-line h1')?.textContent);if(title!=='Engine')return;
    const engine=document.getElementById('engineSystemRecord');if(engine)engine.insertAdjacentHTML('afterend',lineCardHTML());
  }

  window.openEngineServiceByTitle=function(title){
    const item=lineProgram().serviceItems.find(x=>T(x.title).toLowerCase()===T(title).toLowerCase());
    if(item&&typeof openEngineServiceModal==='function')openEngineServiceModal(item.id);
  };
  window.openRotaxLineProfile=function(){
    const p=lineProgram().profile;
    openModal(`${modalHeader('ROTAX Maintenance Profile','Conditional maintenance inputs')}<div class="form-grid">
      <div><label>Leaded AVGAS more than 30% of operation?</label><select id="rotaxLeadedProfile"><option ${p.leadedOver30==='Unknown'?'selected':''}>Unknown</option><option ${p.leadedOver30==='No'?'selected':''}>No</option><option ${p.leadedOver30==='Yes'?'selected':''}>Yes</option></select></div>
      ${field('Engine serial number','rotaxLineSerial',p.serialNumber||'')}
      ${field('Initial start / first operation date','rotaxLineFirstDate',p.firstOperationDate||'','date')}
      ${field('Engine hours at installation','rotaxLineInstallHours',p.hoursAtInstall??'','number','step="0.1" min="0"')}
    </div><div class="notice" style="margin-top:12px">The MML changes some intervals when leaded AVGAS is more than 30% of operation. TBO is also serial-number dependent. This profile lets the tracker calculate the applicable source interval instead of using a generic value.</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveRotaxLineProfile()">Save Profile</button></div>`,true);
  };
  window.saveRotaxLineProfile=function(){
    const p=lineProgram().profile;
    p.leadedOver30=val('rotaxLeadedProfile')||'Unknown';
    p.serialNumber=val('rotaxLineSerial');
    p.firstOperationDate=val('rotaxLineFirstDate');
    p.hoursAtInstall=val('rotaxLineInstallHours');
    applyIntervals();closeModal();saveDB('ROTAX maintenance profile updated.');setTimeout(()=>openSystemDashboard('Engine'),0);
  };
  window.openRotaxLineDocument=function(){
    const d=ensureDoc();if(d&&typeof openDocumentDetail==='function'){openDocumentDetail(d.id);return}navTo('documents');
  };

  let lastMmlDb=null;
  function persistMmlNoRender(){
    try{
      if(typeof persistBrowserData==='function')Promise.resolve(persistBrowserData(db,{quiet:true})).catch(()=>{});
      else localStorage.setItem(DB_KEY,JSON.stringify(db));
    }catch(_e){}
    try{if(typeof queueCloudSave==='function')queueCloudSave()}catch(_e){}
  }
  function ensureAll(force=false){
    db.settings=db.settings||{};
    if(!force&&lastMmlDb===db&&db.settings.rotaxMmlEd4Rev2Seeded)return false;
    lastMmlDb=db;
    mmlDirty=false;
    const doc=ensureDoc();
    applyIntervals();
    ensureChecklist(doc);
    if(!db.settings.rotaxMmlEd4Rev2Seeded){db.settings.rotaxMmlEd4Rev2Seeded=true;mmlDirty=true}
    if(mmlDirty)persistMmlNoRender();
    return mmlDirty;
  }

  window.ensureRotaxLineProgram=ensureAll;
  window.injectRotaxLineCard=injectCard;

  // Engine-card injection and source initialization are coordinated by app-61-performance.

  const style=document.createElement('style');
  style.id='rotaxLineProgramStyle';
  style.textContent=`
    .rotax-line-card{margin-top:12px;border-top:3px solid #447a57}
    .rotax-line-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:12px}
    .rotax-line-grid button{appearance:none;border:1px solid var(--line);background:#f8fbf9;border-radius:10px;padding:10px 11px;text-align:left;color:var(--ink);cursor:pointer;min-height:82px}
    .rotax-line-grid button:hover{background:#f0f8f3;border-color:#8eb59b}
    .rotax-line-grid span,.rotax-line-grid small{display:block}.rotax-line-grid span{font-size:9px;text-transform:uppercase;letter-spacing:.04em;font-weight:850;color:var(--muted)}.rotax-line-grid b{display:block;font-size:16px;margin:4px 0}.rotax-line-grid small{font-size:9px;line-height:1.3;color:var(--muted)}
    @media(max-width:1100px){.rotax-line-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:700px){.rotax-line-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.rotax-line-grid button{min-height:76px;padding:9px}}
  `;
  document.head.appendChild(style);

  ensureAll();
})();