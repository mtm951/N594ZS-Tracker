'use strict';
// ---------- V5.12 ENGINE SYSTEM RECORD ----------
// Adds engine identity, component/service life tracking, and bulletin compliance
// directly to Systems -> Engine without hard-coding manufacturer intervals.

(function(){
  if(window.__n594zsEngineSystemInstalled)return;
  window.__n594zsEngineSystemInstalled=true;

  const A=v=>Array.isArray(v)?v:[];
  const T=v=>String(v??'').trim();
  const currentEngineHours=()=>num(db.aircraft?.engineHours);

  const DEFAULT_ENGINE_ITEMS=[
    {title:'Cooling hoses',kind:'Component'},
    {title:'Fuel hoses',kind:'Component'},
    {title:'Oil hoses',kind:'Component'},
    {title:'Oil & filter change',kind:'Service'},
    {title:'Carburetor service / synchronization',kind:'Service'},
    {title:'Throttle / choke adjustment',kind:'Service'}
  ];

  function blankService(src={}){
    return {
      ...src,
      id:src.id||crypto.randomUUID(),
      title:T(src.title)||'Engine service item',
      kind:T(src.kind)||'Service',
      installedDate:src.installedDate||'',
      installedHours:src.installedHours??'',
      lastDate:src.lastDate||'',
      lastHours:src.lastHours??'',
      intervalDays:src.intervalDays??'',
      intervalYears:src.intervalYears??'',
      intervalHours:src.intervalHours??'',
      nextDate:src.nextDate||'',
      nextHours:src.nextHours??'',
      partNumber:src.partNumber||'',
      manufacturer:src.manufacturer||'',
      notes:src.notes||'',
      sourceNotes:src.sourceNotes||'',
      history:A(src.history).map(h=>({id:h.id||crypto.randomUUID(),date:h.date||'',hours:h.hours??'',action:h.action||'Service',notes:h.notes||''}))
    };
  }
  function blankBulletin(src={}){
    return {
      ...src,
      id:src.id||crypto.randomUUID(),
      type:src.type||'Service Bulletin',
      number:src.number||'',
      title:src.title||'',
      revision:src.revision||'',
      issueDate:src.issueDate||'',
      applicability:src.applicability||'Review',
      status:src.status||'Review',
      compliedDate:src.compliedDate||'',
      compliedHours:src.compliedHours??'',
      method:src.method||'',
      notes:src.notes||''
    };
  }
  function engineProgram(){
    db.aircraft.engineProgram=db.aircraft.engineProgram||{};
    const p=db.aircraft.engineProgram;
    p.profile=p.profile||{};
    p.profile.manufacturer=p.profile.manufacturer||'Rotax';
    p.profile.model=p.profile.model||db.aircraft.engine||'912 ULS';
    p.profile.serialNumber=p.profile.serialNumber||'';
    p.profile.manufactureDate=p.profile.manufactureDate||'';
    p.profile.installDate=p.profile.installDate||'';
    p.profile.firstOperationDate=p.profile.firstOperationDate||'';
    p.profile.hoursAtInstall=p.profile.hoursAtInstall??'';
    p.profile.timeSinceNewAtInstall=p.profile.timeSinceNewAtInstall??'';
    p.profile.notes=p.profile.notes||'';
    p.serviceItems=A(p.serviceItems).map(blankService);
    for(const d of DEFAULT_ENGINE_ITEMS){
      if(!p.serviceItems.some(x=>T(x.title).toLowerCase()===d.title.toLowerCase()))p.serviceItems.push(blankService(d));
    }
    p.bulletins=A(p.bulletins).map(blankBulletin);
    return p;
  }

  const normalizeEngineBase=normalizeDB;
  normalizeDB=function(){normalizeEngineBase();engineProgram()};
  normalizeDB();

  function addDays(iso,days){
    if(!iso||!Number(days))return '';
    const d=new Date(iso+'T12:00:00');if(Number.isNaN(d.getTime()))return '';
    d.setDate(d.getDate()+Number(days));return d.toISOString().slice(0,10);
  }
  function addYears(iso,years){
    if(!iso||!Number(years))return '';
    const d=new Date(iso+'T12:00:00');if(Number.isNaN(d.getTime()))return '';
    const month=d.getMonth();
    d.setFullYear(d.getFullYear()+Number(years));
    if(d.getMonth()!==month)d.setDate(0);
    return d.toISOString().slice(0,10);
  }
  function serviceDue(item){
    const now=new Date(),today=now.toISOString().slice(0,10),hours=currentEngineHours();
    const baseDate=item.lastDate||item.installedDate||'';
    const baseHours=item.lastHours!==''?num(item.lastHours):(item.installedHours!==''?num(item.installedHours):null);
    const dueDate=item.nextDate||(num(item.intervalYears)>0?addYears(baseDate,item.intervalYears):addDays(baseDate,item.intervalDays));
    const dueHours=item.nextHours!==''?num(item.nextHours):((baseHours!==null&&num(item.intervalHours)>0)?baseHours+num(item.intervalHours):null);
    let due=false,soon=false,parts=[];
    if(dueDate){
      const dd=new Date(dueDate+'T12:00:00'),days=Math.ceil((dd-now)/86400000);
      if(dueDate<=today){due=true;parts.push('date due')}
      else if(days<=30){soon=true;parts.push(days+' days')}
      else parts.push(dueDate);
    }
    if(dueHours!==null&&Number.isFinite(hours)&&hours>=0){
      const rem=dueHours-hours;
      if(rem<=0){due=true;parts.push('hours due')}
      else if(rem<=10){soon=true;parts.push(rem.toFixed(1)+' hr')}
      else parts.push(dueHours.toFixed(1)+' hr');
    }
    if(due)return {status:'Due',cls:'bad',reason:parts.join(' • ')||'Due'};
    if(soon)return {status:'Due Soon',cls:'warn',reason:parts.join(' • ')};
    if(dueDate||dueHours!==null)return {status:'Scheduled',cls:'good',reason:parts.join(' • ')};
    if(baseDate||baseHours!==null)return {status:'Tracking',cls:'blue',reason:[baseDate,baseHours!==null?baseHours.toFixed(1)+' hr':''].filter(Boolean).join(' • ')};
    return {status:'Not set',cls:'gray',reason:'No date / interval entered'};
  }
  function ageText(date){
    if(!date)return 'Not recorded';
    const d=new Date(date+'T12:00:00'),n=new Date();if(Number.isNaN(d.getTime()))return date;
    let months=(n.getFullYear()-d.getFullYear())*12+(n.getMonth()-d.getMonth());
    if(n.getDate()<d.getDate())months--;
    if(months<1)return '< 1 month';
    if(months<12)return months+' mo';
    const y=Math.floor(months/12),m=months%12;return y+' yr'+(m?' '+m+' mo':'');
  }
  function serviceBaseText(i){
    if(i.kind==='Component'){
      const bits=[];
      if(i.installedDate)bits.push('Installed '+i.installedDate);
      if(i.installedHours!=='')bits.push(num(i.installedHours).toFixed(1)+' hr');
      if(i.installedDate)bits.push(ageText(i.installedDate)+' old');
      return bits.join(' • ')||'Installation date / hours not recorded';
    }
    const bits=[];
    if(i.lastDate)bits.push('Last '+i.lastDate);
    if(i.lastHours!=='')bits.push(num(i.lastHours).toFixed(1)+' hr');
    return bits.join(' • ')||'Last service not recorded';
  }
  function bulletinNeedsAction(b){return ['Review','Applicable'].includes(b.status)}

  function enginePanelHTML(){
    const p=engineProgram(),profile=p.profile;
    const due=p.serviceItems.filter(i=>['Due','Due Soon'].includes(serviceDue(i).status)).length;
    const bulletins=p.bulletins.filter(bulletinNeedsAction).length;
    const serviceRows=p.serviceItems.map(i=>{
      const d=serviceDue(i);
      return `<button class="engine-service-row" onclick="openEngineServiceModal('${esc(i.id)}')">
        <span><b>${esc(i.title)}</b><small>${esc(i.kind)} • ${esc(serviceBaseText(i))}</small></span>
        <span class="engine-service-end"><span class="engine-state ${d.cls}">${esc(d.status)}</span><small>${esc(d.reason)}</small></span>
      </button>`;
    }).join('');
    const bulletinRows=p.bulletins.length?p.bulletins.map(b=>`<button class="engine-bulletin-row" onclick="openEngineBulletinModal('${esc(b.id)}')"><span><b>${esc([b.type,b.number].filter(Boolean).join(' • ')||'Bulletin / instruction')}</b><small>${esc(b.title||b.revision||'No title recorded')}</small></span><span class="engine-state ${bulletinNeedsAction(b)?'warn':b.status==='Complied'?'good':'gray'}">${esc(b.status)}</span></button>`).join(''):'<div class="empty">No bulletin / instruction compliance records yet.</div>';
    return `<div class="card span-12 engine-record-card" id="engineSystemRecord">
      <div class="section-head"><div><div class="engine-kicker">ENGINE RECORD</div><h2>Engine Identity & Service Life</h2><div class="muted small">Serial identity, component age, recurring service and bulletin compliance in one place.</div></div><div class="action-row"><button class="btn secondary" onclick="openEngineProfileModal()">Edit Engine</button><button class="btn primary" onclick="openEngineServiceModal()">+ Service Item</button></div></div>
      <div class="engine-profile-grid">
        <button onclick="openEngineProfileModal()"><span>Engine</span><b>${esc([profile.manufacturer,profile.model].filter(Boolean).join(' ')||'Not recorded')}</b></button>
        <button onclick="openEngineProfileModal()"><span>Serial number</span><b>${esc(profile.serialNumber||'Add serial')}</b></button>
        <button onclick="openEngineProfileModal()"><span>Date manufactured</span><b>${esc(profile.manufactureDate||'Add date')}</b></button>
        <button onclick="openEngineProfileModal()"><span>Installed</span><b>${esc(profile.installDate||'Add date')}</b></button>
        <button onclick="openEngineProfileModal()"><span>Current engine time</span><b>${db.aircraft.engineHours!==''&&db.aircraft.engineHours!=null?esc(num(db.aircraft.engineHours).toFixed(1)+' hr'):'Not recorded'}</b></button>
        <button onclick="openEngineProfileModal()"><span>Service attention</span><b>${due} item${due===1?'':'s'}</b><small>${bulletins} bulletin${bulletins===1?'':'s'} to review</small></button>
      </div>
      <div class="engine-record-grid">
        <div class="engine-subcard"><div class="section-head"><div><h3>Components & Recurring Service</h3><div class="muted tiny">Manufacturer intervals are populated from the current source documents where defined; dates and hours remain editable.</div></div><button class="linkbtn" onclick="openEngineServiceModal()">+ Add</button></div><div class="engine-service-list">${serviceRows}</div></div>
        <div class="engine-subcard"><div class="section-head"><div><h3>Bulletins / Instructions</h3><div class="muted tiny">Track applicability, revision and compliance evidence.</div></div><button class="linkbtn" onclick="openEngineBulletinModal()">+ Add</button></div>${bulletinRows}</div>
      </div>
      <div class="engine-record-note">Service intervals shown here come from the current source documents loaded into the tracker where a fixed interval is defined. Serial-number, installation, fuel-use and aircraft-manufacturer conditions still control where the source calls for them.</div>
    </div>`;
  }
  window.engineSystemPanelHTML=enginePanelHTML;

  function injectEnginePanel(){
    const page=document.getElementById('page-systems');if(!page||document.getElementById('engineSystemRecord'))return;
    const title=T(page.querySelector('.system-title-line h1')?.textContent);
    if(title!=='Engine')return;
    const hero=page.querySelector('.system-detail-hero');if(!hero)return;
    hero.insertAdjacentHTML('afterend',enginePanelHTML());
  }

  window.injectEngineSystemPanel=injectEnginePanel;

  // Rendering is coordinated by the late performance layer; expose only the targeted hook.

  window.openEngineProfileModal=function(){
    const p=engineProgram().profile;
    openModal(`${modalHeader('Engine Identity','Systems → Engine')}<div class="form-grid">
      ${field('Manufacturer','engManufacturer',p.manufacturer)}
      ${field('Model','engModel',p.model)}
      ${field('Serial number','engSerial',p.serialNumber)}
      ${field('Date manufactured','engMfgDate',p.manufactureDate,'date')}
      ${field('Installed date','engInstallDate',p.installDate,'date')}
      ${field('Initial start / first operation date','engFirstOperation',p.firstOperationDate,'date')}
      ${field('Engine hours at install','engInstallHours',p.hoursAtInstall,'number','step="0.1" min="0"')}
      ${field('Time since new at install (if known)','engTsnInstall',p.timeSinceNewAtInstall,'number','step="0.1" min="0"')}
      ${field('Current engine hours','engCurrentHours',db.aircraft.engineHours??'','number','step="0.1" min="0"')}
      ${textareaField('Engine notes / provenance','engNotes',p.notes)}
    </div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveEngineProfile()">Save Engine</button></div>`,true);
  };
  window.saveEngineProfile=function(){
    const p=engineProgram().profile;
    Object.assign(p,{manufacturer:val('engManufacturer'),model:val('engModel'),serialNumber:val('engSerial'),manufactureDate:val('engMfgDate'),installDate:val('engInstallDate'),firstOperationDate:val('engFirstOperation'),hoursAtInstall:val('engInstallHours'),timeSinceNewAtInstall:val('engTsnInstall'),notes:val('engNotes')});
    db.aircraft.engineHours=val('engCurrentHours');
    if(p.model)db.aircraft.engine=[p.manufacturer,p.model].filter(Boolean).join(' ');
    closeModal();saveDB('Engine identity updated.');setTimeout(()=>openSystemDashboard('Engine'),0);
  };

  window.openEngineServiceModal=function(id=''){
    const p=engineProgram(),existing=id?p.serviceItems.find(x=>String(x.id)===String(id)):null,i=existing||blankService();
    const d=serviceDue(i);
    openModal(`${modalHeader(existing?'Edit Engine Service Item':'Add Engine Service Item',existing?d.status:'Track a component or recurring service')}<div class="form-grid">
      ${field('Item','engSvcTitle',i.title)}
      <div><label>Type</label><select id="engSvcKind"><option ${i.kind==='Component'?'selected':''}>Component</option><option ${i.kind==='Service'?'selected':''}>Service</option><option ${i.kind==='Inspection'?'selected':''}>Inspection</option></select></div>
      ${field('Manufacturer / brand','engSvcManufacturer',i.manufacturer)}
      ${field('Part number / spec','engSvcPartNo',i.partNumber)}
      ${field('Installed date','engSvcInstallDate',i.installedDate,'date')}
      ${field('Installed at engine hours','engSvcInstallHours',i.installedHours,'number','step="0.1" min="0"')}
      ${field('Last serviced / replaced date','engSvcLastDate',i.lastDate,'date')}
      ${field('Last serviced / replaced hours','engSvcLastHours',i.lastHours,'number','step="0.1" min="0"')}
      ${field('Calendar interval (days)','engSvcDays',i.intervalDays,'number','min="0"')}
      ${field('Calendar interval (years)','engSvcYears',i.intervalYears,'number','step="1" min="0"')}
      ${field('Hour interval','engSvcHours',i.intervalHours,'number','step="0.1" min="0"')}
      ${field('Next due date (override)','engSvcNextDate',i.nextDate,'date')}
      ${field('Next due hours (override)','engSvcNextHours',i.nextHours,'number','step="0.1" min="0"')}
      ${textareaField('Notes','engSvcNotes',i.notes)}
    </div>${i.sourceNotes?`<div class="notice" style="margin-top:12px"><b>Manufacturer source:</b> ${esc(i.sourceNotes)}</div>`:''}<div class="notice" style="margin-top:12px">Where a fixed manufacturer interval is loaded from a current source document, it is pre-filled here. Changing an interval here is treated as your override and will not be silently replaced by a later source refresh.</div>
    <div class="modal-actions">${existing?`<button class="btn danger" onclick="deleteEngineService('${esc(i.id)}')">Delete</button><button class="btn success" onclick="openEngineServiceComplete('${esc(i.id)}')">Record Service</button>`:''}<button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveEngineService('${esc(i.id)}',${existing?'true':'false'})">Save</button></div>`,true);
  };

  function syncMaintenance(i){
    let m=A(db.maintenance).find(x=>String(x.engineServiceItemId||'')===String(i.id));
    const baseDate=i.lastDate||i.installedDate||'';
    const calculatedYearDue=!i.nextDate&&num(i.intervalYears)>0&&baseDate?addYears(baseDate,i.intervalYears):'';
    const hasDate=!!(i.intervalDays||i.intervalYears||i.nextDate||calculatedYearDue),hasHours=!!(i.intervalHours||i.nextHours);
    const basis=hasDate&&hasHours?'both':hasHours?'hours':'date';
    const sourceText=[i.kind,i.intervalYears?('Manufacturer calendar interval: '+i.intervalYears+' year'+(num(i.intervalYears)===1?'':'s')):'',i.partNumber?'PN '+i.partNumber:'',i.sourceNotes].filter(Boolean).join(' • ');
    const obj={
      ...(m||{}),id:m?.id||nextNumericId(db.maintenance,700),title:i.title,system:'Engine',basis,meter:'engine',
      intervalDays:i.intervalDays,intervalHours:i.intervalHours,lastDate:i.lastDate||i.installedDate,lastHours:i.lastHours!==''?i.lastHours:i.installedHours,
      nextDate:i.nextDate||calculatedYearDue,nextHours:i.nextHours,
      notes:m?.notes??i.notes??'',sourceNotes:sourceText,engineServiceItemId:i.id,rotaxManaged:i.mmlManaged===true||m?.rotaxManaged===true
    };
    const idx=A(db.maintenance).findIndex(x=>String(x.id)===String(obj.id));if(idx>=0)db.maintenance[idx]=obj;else db.maintenance.push(obj);
  }

  window.saveEngineService=function(id,existing){
    const p=engineProgram(),old=existing?p.serviceItems.find(x=>String(x.id)===String(id)):null;
    const obj=blankService({
      ...(old||{}),id:old?.id||id||crypto.randomUUID(),title:val('engSvcTitle'),kind:val('engSvcKind'),
      manufacturer:val('engSvcManufacturer'),partNumber:val('engSvcPartNo'),installedDate:val('engSvcInstallDate'),installedHours:val('engSvcInstallHours'),
      lastDate:val('engSvcLastDate'),lastHours:val('engSvcLastHours'),intervalDays:val('engSvcDays'),intervalYears:val('engSvcYears'),intervalHours:val('engSvcHours'),
      nextDate:val('engSvcNextDate'),nextHours:val('engSvcNextHours'),notes:val('engSvcNotes'),history:A(old?.history)
    });
    const idx=p.serviceItems.findIndex(x=>String(x.id)===String(obj.id));if(idx>=0)p.serviceItems[idx]=obj;else p.serviceItems.push(obj);
    syncMaintenance(obj);closeModal();saveDB('Engine service item saved.');setTimeout(()=>openSystemDashboard('Engine'),0);
  };
  window.deleteEngineService=function(id){
    if(!confirm('Delete this engine service item?'))return;
    const p=engineProgram();p.serviceItems=p.serviceItems.filter(x=>String(x.id)!==String(id));
    db.maintenance=A(db.maintenance).filter(x=>String(x.engineServiceItemId||'')!==String(id));
    closeModal();saveDB('Engine service item deleted.');setTimeout(()=>openSystemDashboard('Engine'),0);
  };

  window.openEngineServiceComplete=function(id){
    const i=engineProgram().serviceItems.find(x=>String(x.id)===String(id));if(!i)return;
    openModal(`${modalHeader('Record Service / Replacement',i.title)}<div class="form-grid">
      ${field('Date','engDoneDate',today(),'date')}
      ${field('Engine hours','engDoneHours',db.aircraft.engineHours??'','number','step="0.1" min="0"')}
      <div><label>Action</label><select id="engDoneAction"><option>Serviced</option><option>Inspected</option><option>Adjusted</option><option>Replaced</option><option>Complied</option><option>Other</option></select></div>
      <div><label style="text-transform:none;letter-spacing:0;display:flex;align-items:center;gap:8px;margin-top:21px"><input id="engDoneLog" type="checkbox" checked style="width:auto"> Add Work Log entry</label></div>
      ${textareaField('Notes / findings / parts used','engDoneNotes','')}
    </div><div class="modal-actions"><button class="btn secondary" onclick="openEngineServiceModal('${esc(i.id)}')">Cancel</button><button class="btn primary" onclick="saveEngineServiceComplete('${esc(i.id)}')">Record</button></div>`,true);
  };
  window.saveEngineServiceComplete=function(id){
    const i=engineProgram().serviceItems.find(x=>String(x.id)===String(id));if(!i)return;
    const date=val('engDoneDate')||today(),hours=val('engDoneHours'),action=val('engDoneAction')||'Serviced',notes=val('engDoneNotes');
    i.lastDate=date;i.lastHours=hours;i.nextDate='';i.nextHours='';
    if(i.kind==='Component'&&action==='Replaced'){i.installedDate=date;i.installedHours=hours}
    i.history.push({id:crypto.randomUUID(),date,hours,action,notes});
    syncMaintenance(i);
    if(document.getElementById('engDoneLog')?.checked){
      db.logs.push({id:uid(),date,airframeHours:'',engineHours:hours,laborHours:'',system:'Engine',projectIds:[],work:action+' — '+i.title,observations:notes,blockers:'',nextStep:'',consumedParts:[],otherCost:'',notes:'Created from Engine service tracker.'});
    }
    closeModal();saveDB('Engine service recorded.');setTimeout(()=>openSystemDashboard('Engine'),0);
  };

  window.openEngineBulletinModal=function(id=''){
    const p=engineProgram(),old=id?p.bulletins.find(x=>String(x.id)===String(id)):null,b=old||blankBulletin();
    openModal(`${modalHeader(old?'Edit Bulletin / Instruction':'Add Bulletin / Instruction','Engine compliance record')}<div class="form-grid">
      <div><label>Type</label><select id="engBulType">${['Service Bulletin','Service Instruction','Service Letter','Airworthiness Directive','Other'].map(x=>`<option ${b.type===x?'selected':''}>${x}</option>`).join('')}</select></div>
      ${field('Number / reference','engBulNumber',b.number)}
      ${field('Title','engBulTitle',b.title)}
      ${field('Revision','engBulRevision',b.revision)}
      ${field('Issue / revision date','engBulIssueDate',b.issueDate,'date')}
      <div><label>Applicability</label><select id="engBulApplicability">${['Review','Applicable','Not Applicable','Unknown'].map(x=>`<option ${b.applicability===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div><label>Status</label><select id="engBulStatus">${['Review','Applicable','Complied','Not Applicable','Superseded'].map(x=>`<option ${b.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
      ${field('Compliance date','engBulDate',b.compliedDate,'date')}
      ${field('Compliance engine hours','engBulHours',b.compliedHours,'number','step="0.1" min="0"')}
      ${field('Method / reference','engBulMethod',b.method)}
      ${textareaField('Notes / applicability rationale / evidence','engBulNotes',b.notes)}
    </div><div class="modal-actions">${old?`<button class="btn danger" onclick="deleteEngineBulletin('${esc(b.id)}')">Delete</button>`:''}<button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveEngineBulletin('${esc(b.id)}',${old?'true':'false'})">Save</button></div>`,true);
  };
  window.saveEngineBulletin=function(id,existing){
    const p=engineProgram(),old=existing?p.bulletins.find(x=>String(x.id)===String(id)):null;
    const obj=blankBulletin({...(old||{}),id:old?.id||id||crypto.randomUUID(),type:val('engBulType'),number:val('engBulNumber'),title:val('engBulTitle'),revision:val('engBulRevision'),issueDate:val('engBulIssueDate'),applicability:val('engBulApplicability'),status:val('engBulStatus'),compliedDate:val('engBulDate'),compliedHours:val('engBulHours'),method:val('engBulMethod'),notes:val('engBulNotes')});
    const idx=p.bulletins.findIndex(x=>String(x.id)===String(obj.id));if(idx>=0)p.bulletins[idx]=obj;else p.bulletins.push(obj);
    closeModal();saveDB('Engine bulletin record saved.');setTimeout(()=>openSystemDashboard('Engine'),0);
  };
  window.deleteEngineBulletin=function(id){
    if(!confirm('Delete this bulletin / instruction record?'))return;
    const p=engineProgram();p.bulletins=p.bulletins.filter(x=>String(x.id)!==String(id));
    closeModal();saveDB('Engine bulletin record deleted.');setTimeout(()=>openSystemDashboard('Engine'),0);
  };

  const style=document.createElement('style');
  style.id='engineSystemRecordStyle';
  style.textContent=`
    .engine-record-card{border-top:3px solid #2d7fd1}.engine-kicker{font-size:9px;letter-spacing:.12em;font-weight:900;color:var(--muted);margin-bottom:3px}
    .engine-profile-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:13px 0}.engine-profile-grid button{appearance:none;border:1px solid #dfe7ed;background:#f7fafc;border-radius:9px;padding:10px;text-align:left;color:inherit;cursor:pointer;min-height:68px}.engine-profile-grid button:hover{background:#eef6fc;border-color:#a9c8e5}.engine-profile-grid span,.engine-profile-grid small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;font-weight:850;letter-spacing:.03em}.engine-profile-grid b{display:block;margin-top:4px;font-size:14px;line-height:1.2}.engine-profile-grid small{text-transform:none;font-weight:650;margin-top:3px}
    .engine-record-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:12px}.engine-subcard{border:1px solid #dfe7ed;border-radius:10px;padding:11px;background:#fff}.engine-subcard h3{margin:0}
    .engine-service-list{display:flex;flex-direction:column}.engine-service-row,.engine-bulletin-row{appearance:none;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;border-bottom:1px solid #edf1f4;background:transparent;padding:10px 2px;text-align:left;color:inherit;cursor:pointer}.engine-service-row:last-child,.engine-bulletin-row:last-child{border-bottom:0}.engine-service-row:hover,.engine-bulletin-row:hover{background:#f7fbfe}.engine-service-row b,.engine-service-row small,.engine-bulletin-row b,.engine-bulletin-row small{display:block}.engine-service-row small,.engine-bulletin-row small{color:var(--muted);font-size:10px;margin-top:3px;line-height:1.3}.engine-service-end{text-align:right;flex:0 0 auto;max-width:42%}.engine-service-end small{margin-top:4px}
    .engine-state{display:inline-block;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:850;white-space:nowrap}.engine-state.good{background:var(--greenbg);color:var(--green)}.engine-state.warn{background:var(--yellowbg);color:var(--yellow)}.engine-state.bad{background:var(--redbg);color:var(--red)}.engine-state.blue{background:var(--blue2);color:var(--blue)}.engine-state.gray{background:var(--graybg);color:var(--muted)}
    .engine-record-note{margin-top:10px;padding:9px 11px;border-radius:8px;background:#f8fafc;border:1px solid #e5ebf0;color:var(--muted);font-size:10px;line-height:1.4}
    @media(max-width:1100px){.engine-profile-grid{grid-template-columns:repeat(3,1fr)}.engine-record-grid{grid-template-columns:1fr}}
    @media(max-width:700px){.engine-profile-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.engine-profile-grid button{min-height:62px;padding:9px}.engine-service-row,.engine-bulletin-row{align-items:flex-start}.engine-service-end{max-width:46%}.engine-record-card .section-head>.action-row{width:100%}.engine-record-card .section-head>.action-row .btn{flex:1}}
  `;
  document.head.appendChild(style);
})();