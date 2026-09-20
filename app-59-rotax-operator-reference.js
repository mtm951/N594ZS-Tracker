'use strict';
// ---------- V5.14 ROTAX 912 ULS OPERATOR MANUAL REFERENCE PACK ----------
// Source reviewed from user-supplied ROTAX 912 Series Operators Manual:
// OM-912 / P/N 899649, Edition 3, mixed effective pages through Rev. 1 (Apr 01 2013).
// This pack deliberately labels the values as reference / needs verification because
// ROTAX says references are to the latest edition unless stated otherwise.

(function(){
  if(window.__n594zsRotaxOperatorPackInstalled)return;
  window.__n594zsRotaxOperatorPackInstalled=true;

  const A=v=>Array.isArray(v)?v:[];
  const SOURCE='ROTAX 912 Series Operators Manual';
  const DOCREF='OM-912 / P/N 899649';
  const REV='Edition 3 • LEP Rev. 1 • Apr 01 2013';
  const CURRENT_CAUTION='Uploaded manual is an older edition. Verify against the latest ROTAX documentation and the N594ZS/Kitfox operating limitations before using a value operationally.';

  const refs=[
    {id:'rotax-om-e3-uls-takeoff-power',title:'912 ULS takeoff power',system:'Engine',value:'100 hp @ 5800 rpm',units:'max. 5 min',page:'2-5',notes:'73.5 kW at 5800 rpm.'},
    {id:'rotax-om-e3-uls-max-continuous',title:'912 ULS maximum continuous power',system:'Engine',value:'90 hp @ 5500 rpm',units:'',page:'2-5',notes:'69 kW at 5500 rpm.'},
    {id:'rotax-om-e3-uls-idle-min',title:'912 ULS minimum idle speed',system:'Engine',value:'1400',units:'rpm',page:'2-5',notes:''},
    {id:'rotax-om-e3-uls-oil-pressure',title:'912 ULS oil-pressure operating reference',system:'Engine',value:'Normal 2.0–5.0',units:'bar (29–73 psi) above 3500 rpm',page:'2-5',notes:'Minimum 0.8 bar (12 psi) below 3500 rpm. Maximum 7 bar (102 psi) is admissible only for a short period at cold start.'},
    {id:'rotax-om-e3-uls-oil-temperature',title:'912 ULS oil-temperature operating reference',system:'Engine',value:'50–130',units:'°C (120–266 °F)',page:'2-5',notes:'Normal operating temperature approximately 90–110 °C (190–230 °F).'},
    {id:'rotax-om-e3-uls-egt-max',title:'912 ULS maximum EGT',system:'Exhaust',value:'880',units:'°C (1616 °F)',page:'2-5',notes:''},
    {id:'rotax-om-e3-uls-coolant-max',title:'912 ULS conventional-coolant maximum',system:'Cooling',value:'120',units:'°C (248 °F)',page:'2-6',notes:'Coolant exit temperature. Manual calls for permanent monitoring of coolant and cylinder-head temperature with conventional coolant.'},
    {id:'rotax-om-e3-uls-cht-max',title:'912 ULS cylinder-head temperature maximum',system:'Cooling',value:'135',units:'°C (275 °F)',page:'2-6',notes:'Stated for conventional and waterless coolant in this manual edition.'},
    {id:'rotax-om-e3-uls-fuel-pressure',title:'912 ULS fuel-pressure operating reference',system:'Fuel',value:'0.15–0.4',units:'bar (2.2–5.8 psi)',page:'2-7',notes:'The manual shows 0.5 bar (7.26 psi) maximum only for the specified fuel pump from S/N 11.0036. Pump applicability must be confirmed.'},
    {id:'rotax-om-e3-uls-bank-angle',title:'912 ULS maximum bank-angle deviation reference',system:'Engine',value:'40',units:'degrees',page:'2-7',notes:'Manual notes the dry-sump lubrication system warrants lubrication up to this value.'},
    {id:'rotax-om-e3-uls-fuel-octane',title:'912 ULS minimum fuel knock resistance',system:'Fuel',value:'RON 95 / AKI 91',units:'minimum',page:'2-9',notes:'AVGAS 100LL is listed as usable, with the manual noting greater valve-seat stress and increased deposits/lead sediment. Selection is referred to current SI-912-016.'},
    {id:'rotax-om-e3-uls-oil-spec',title:'912 lubricant specification reference',system:'Engine',value:'API SG or higher',units:'',page:'2-10',notes:'Manual calls for oils with gear additives such as high-performance 4-stroke motorcycle oils; friction-modifier oils are unsuitable for the overload clutch. Selection is referred to current SI-912-016.'},
    {id:'rotax-om-e3-uls-oil-consumption',title:'912 maximum oil-consumption reference',system:'Engine',value:'0.06',units:'L/h (0.13 liq pt/h)',page:'2-10',notes:''},
    {id:'rotax-om-e3-uls-oil-level-range',title:'912 oil-tank dipstick range',system:'Engine',value:'0.45',units:'L between MIN and MAX',page:'3-6',notes:'Manual says oil level should be in the upper half between 50% and MAX and never below MIN; for long flights add to MAX.'},
    {id:'rotax-om-e3-uls-start-oil-pressure',title:'Oil-pressure response after engine start',system:'Engine',value:'Rise within 10 sec',units:'',page:'3-7',notes:'Increase engine speed only after a steady oil-pressure reading above 2 bar (30 psi). At low oil temperature continue monitoring for a pressure drop caused by suction-line resistance.'},
    {id:'rotax-om-e3-uls-starter-duty',title:'Starter duty cycle — Operator Manual',system:'Electrical',value:'Max. 10 sec ON / 2 min cool',units:'',page:'3-7',notes:'Do not actuate the starter while the engine is running.'},
    {id:'rotax-om-e3-uls-warmup',title:'912 warm-up reference',system:'Engine',value:'2000 rpm ~2 min, then 2500 rpm',units:'until oil reaches 50 °C / 120 °F',page:'3-9',notes:'Check temperatures and pressures during warm-up.'},
    {id:'rotax-om-e3-uls-ignition-check',title:'912 ignition-check reference',system:'Electrical',value:'4000',units:'rpm engine speed',page:'3-9',notes:'Maximum drop with one ignition circuit off: 300 rpm. Maximum difference between circuit A and B drops: 115 rpm.'},
    {id:'rotax-om-e3-uls-cooldown',title:'High-temperature shutdown cooling run',system:'Engine',value:'At least 2',units:'minutes',page:'3-10',notes:'Manual states normal descent/taxi cooling is usually sufficient; at increased operating temperatures perform at least a 2-minute cooling run.'},
    {id:'rotax-om-e3-uls-daily-oil-temp',title:'Oil temperature for moisture evaporation',system:'Engine',value:'Reach 100',units:'°C (212 °F) at least once daily',page:'3-10',notes:'Manual advises avoiding operation below the normal oil-temperature range because condensation adversely affects oil quality.'},
    {id:'rotax-om-e3-uls-takeoff-fuel',title:'912 ULS takeoff fuel-consumption reference',system:'Fuel',value:'27.0',units:'L/h (7.1 US gal/h)',page:'1-14',notes:'Reference consumption at takeoff performance.'},
    {id:'rotax-om-e3-uls-maxcont-fuel',title:'912 ULS max-continuous fuel-consumption reference',system:'Fuel',value:'25.0',units:'L/h (6.6 US gal/h)',page:'1-14',notes:'Reference consumption at maximum continuous performance.'},
    {id:'rotax-om-e3-uls-75pct-fuel',title:'912 ULS 75% fuel-consumption reference',system:'Fuel',value:'18.5',units:'L/h (4.9 US gal/h)',page:'1-14',notes:'Reference consumption at 75% continuous performance.'},
    {id:'rotax-om-e3-uls-performance-75',title:'912 ULS 75% variable-pitch reference',system:'Engine',value:'5000 rpm / 68 hp / 26 inHg',units:'',page:'5-6',notes:'From the manual variable-pitch-propeller performance table; do not assume applicability to the currently installed propeller configuration.'},
    {id:'rotax-om-e3-uls-performance-65',title:'912 ULS 65% variable-pitch reference',system:'Engine',value:'4800 rpm / 60 hp / 26 inHg',units:'',page:'5-6',notes:'From the manual variable-pitch-propeller performance table; do not assume applicability to the currently installed propeller configuration.'},
    {id:'rotax-om-e3-uls-performance-55',title:'912 ULS 55% variable-pitch reference',system:'Engine',value:'4300 rpm / 50 hp / 24 inHg',units:'',page:'5-6',notes:'From the manual variable-pitch-propeller performance table; do not assume applicability to the currently installed propeller configuration.'},
    {id:'rotax-om-e3-uls-engine-weight-cfg2',title:'912 ULS dry engine weight — configuration 2',system:'Engine',value:'58.3',units:'kg (128 lb)',page:'6-2',notes:'Manual definition includes electric starter, carburetors, internal generator, ignition unit and oil tank; excludes exhaust, radiator and airbox.'},
    {id:'rotax-om-e3-uls-gear-ratio',title:'912 ULS gearbox reduction ratio',system:'Propeller',value:'2.43:1',units:'crankshaft : propeller shaft',page:'7-8',notes:''}
  ];

  const dailyItems=[
    'Cold engine: ignition OFF before moving the propeller; secure the aircraft and have the cockpit occupied by a competent person',
    'Check coolant level in expansion tank; replenish to bottom of filler neck as required',
    'Check overflow-bottle coolant level between MIN and MAX',
    'Turn propeller by hand in normal direction several times; note odd noises, excessive resistance and normal compression',
    'If equipped with overload clutch, check approximately 30° of free propeller rotation before crankshaft rotation',
    'Verify free movement of throttle cable and starting carburetor / choke through the complete range from the cockpit',
    'Inspect exhaust system for damage, leakage and general condition',
    'Check for oil, coolant and fuel leaks before flight; rectify before flight if found',
    'Check oil level using the ROTAX oil-return / gurgle procedure; keep level in upper half of dipstick range'
  ];

  const startItems=[
    'Fuel valve — OPEN',
    'Starting carburetor / choke — ACTIVATE when required; warm engine starts without choke',
    'Throttle — IDLE (manual cautions against opening beyond about 10% for starting)',
    'Master switch — ON',
    'Ignition — BOTH circuits ON',
    'Starter — maximum 10 seconds per attempt; allow 2 minutes cooling before another attempt',
    'After start, adjust throttle for smooth running at approximately 2500 rpm',
    'Verify oil pressure rises within 10 seconds',
    'Do not increase engine speed until oil pressure is steady above 2 bar / 30 psi',
    'Starting carburetor / choke — DEACTIVATE',
    'Warm at approximately 2000 rpm for about 2 minutes',
    'Continue around 2500 rpm until oil temperature reaches 50 °C / 120 °F',
    'Check temperatures and pressures',
    'If conducting the run-up check, ignition check is at 4000 rpm in this manual edition',
    'Ignition-circuit drop — not more than 300 rpm on either circuit',
    'Difference between A and B ignition drops — not more than 115 rpm',
    'After a full-load ground test, allow a short cooling run before shutdown'
  ];

  function numericDocId(){
    const nums=A(db.docs).map(x=>Number(x.id)).filter(Number.isFinite);
    return Math.max(300,...nums)+1;
  }
  function engineEquipmentId(){
    const e=A(db.equipment).find(x=>String(x.system||'')==='Engine'&&/912/i.test([x.name,x.model,x.manufacturer].join(' ')));
    return e?.id||null;
  }
  function operatorDoc(){
    return A(db.docs).find(d=>/912.*operator.?s manual/i.test(d.name||''))||
           A(db.docs).find(d=>/operator.?s manual/i.test(d.name||'')&&/rotax/i.test([d.publisher,d.notes,d.name].join(' ')));
  }
  function ensureOperatorDocument(){
    let d=operatorDoc();
    if(d)return d;
    d={
      id:numericDocId(),
      name:'ROTAX 912 Series Operators Manual',
      type:'Engine manual',
      revision:'Edition 3 / LEP Rev. 1',
      issueDate:'2013-04-01',
      system:'Engine',
      publisher:'BRP-Powertrain / ROTAX',
      location:'User-supplied reference reviewed for tracker data; attach a current PDF in Documents for in-app file access.',
      notes:'OM-912 / P/N 899649. This uploaded manual contains mixed effective pages through Rev. 1 dated April 01 2013. ROTAX states that references are to the latest edition unless otherwise stated. Treat this record as historical/reference until current applicability is confirmed.',
      linkedProjectIds:A(db.projects).filter(p=>p.system==='Engine'||p.system==='Fuel'||p.system==='Cooling').map(p=>p.id),
      linkedPartIds:A(db.parts).filter(p=>p.system==='Engine').map(p=>p.id),
      linkedLogIds:[],
      updates:[]
    };
    db.docs.push(d);
    return d;
  }
  const noteFor=r=>[
    DOCREF,
    `${REV} • p.${r.page}`,
    r.notes||'',
    CURRENT_CAUTION
  ].filter(Boolean).join(' • ');

  function ensureReferences(){
    db.settings=db.settings||{};
    let changed=false;
    db.specs=A(db.specs);
    db.docs=A(db.docs);
    db.checklists=A(db.checklists);
    const beforeDocs=db.docs.length;
    const doc=ensureOperatorDocument();
    if(db.docs.length!==beforeDocs)changed=true;
    const eqId=engineEquipmentId();

    if(!db.settings.rotaxOperatorManualEd3Seeded){
      for(const r of refs){
        if(db.specs.some(x=>String(x.id)===r.id))continue;
        db.specs.push({
          id:r.id,title:r.title,system:r.system,value:r.value,units:r.units,
          status:'Needs Verification',source:SOURCE,
          sourceRevision:`${DOCREF} • ${REV} • p.${r.page}`,
          sourceUrl:'',documentId:doc.id,equipmentId:eqId,notes:noteFor(r)
        });
        changed=true;
      }

      if(!db.checklists.some(x=>x.name==='ROTAX 912 Operator Manual — Daily / Preflight Reference')){
        db.checklists.push({
          id:crypto.randomUUID(),
          name:'ROTAX 912 Operator Manual — Daily / Preflight Reference',
          purpose:'Source-backed daily / preflight reference from the uploaded 912 Series Operator Manual.',
          system:'Engine',
          trigger:'Daily / before flight',
          projectId:null,
          notes:'Source: OM-912 / P/N 899649, Edition 3, Chapters 3.1–3.3 (pages 3-2 through 3-6). Historical/reference copy only; verify against the latest applicable ROTAX documentation and N594ZS operating limitations.',
          items:dailyItems.map((text,i)=>({id:i+1,text,done:false,note:''}))
        });
        changed=true;
      }
      if(!db.checklists.some(x=>x.name==='ROTAX 912 Operator Manual — Start / Warm-up / Run-up Reference')){
        db.checklists.push({
          id:crypto.randomUUID(),
          name:'ROTAX 912 Operator Manual — Start / Warm-up / Run-up Reference',
          purpose:'Source-backed engine start, warm-up and ignition-check reference from the uploaded manual.',
          system:'Engine',
          trigger:'Engine start / ground run',
          projectId:A(db.projects).find(p=>p.title==='Oil system prime / purge')?.id||null,
          notes:'Source: OM-912 / P/N 899649, Edition 3, pages 3-7 through 3-9. Historical/reference copy only. Confirm current procedures, limits and aircraft-specific requirements before use.',
          items:startItems.map((text,i)=>({id:i+1,text,done:false,note:''}))
        });
        changed=true;
      }
      db.settings.rotaxOperatorManualEd3Seeded=true;
      changed=true;
    }

    changed=annotateStarterCards()||changed;

    if(changed){
      saveDB('ROTAX Operator Manual references loaded.');
      [700,1800,4000].forEach(ms=>setTimeout(()=>{
        try{if(typeof queueCloudSave==='function')queueCloudSave()}catch(_e){}
      },ms));
    }
    return changed;
  }

  function targetAdd(x,ref){
    if(!x||!ref)return false;
    const t=String(x.target||'');
    if(!t.includes('Current applicable Rotax 912 ULS documentation'))return false;
    if(t.includes('Uploaded OM-912 reference:'))return false;
    x.target=t+` • Uploaded OM-912 reference: ${ref} — VERIFY CURRENT APPLICABILITY`;
    return true;
  }
  function annotateStarterCards(){
    let changed=false;
    for(const f of A(db.flightCards).filter(x=>x.starter912)){
      for(const x of A(f.items)){
        const o=String(x.objective||'').toLowerCase();
        let ref='';
        if(/initial start oil-pressure|oil pressure immediately after/.test(o))ref='oil pressure should rise within 10 sec; do not increase RPM until steady >2 bar (p.3-7)';
        else if(/ignition|run-up/.test(o))ref='ignition check at 4000 rpm; max drop 300 rpm; max A/B drop difference 115 rpm (p.3-9)';
        else if(/takeoff rpm/.test(o))ref='5800 rpm takeoff limit, max 5 min (p.2-5)';
        else if(/fuel pressure/.test(o))ref='0.15–0.4 bar / 2.2–5.8 psi; 0.5 bar max only for specified later pump S/N (p.2-7)';
        else if(/oil.*temp|temp.*oil|oil \/ coolant|oil \/ coolant \/ cht/.test(o))ref='oil 50–130 °C, normal approx. 90–110 °C (p.2-5); conventional-coolant max 120 °C and CHT max 135 °C (p.2-6)';
        else if(/climb.*temperatures|engine indications/.test(o))ref='5800 rpm max 5 min; oil pressure/temp, coolant/CHT and EGT limits stored in Specs / Setup from OM-912';
        if(ref&&targetAdd(x,ref))changed=true;
      }
    }
    return changed;
  }

  function specButton(id,label,value,sub=''){
    return `<button class="rotax-limit-tile" onclick="openSpecDetail('${esc(id)}')"><span>${esc(label)}</span><b>${esc(value)}</b>${sub?`<small>${esc(sub)}</small>`:''}</button>`;
  }
  function operatorLimitsHTML(){
    const p=db.aircraft?.engineProgram?.profile||{};
    return `<div class="card span-12 rotax-operator-card" id="rotaxOperatorReferenceCard">
      <div class="section-head">
        <div><div class="engine-kicker">ROTAX OPERATOR REFERENCE</div><h2>912 ULS Operating Reference</h2>
          <div class="muted small">Source-backed values from the uploaded ${esc(DOCREF)}. Each tile opens its stored source/reference record.</div>
        </div>
        <div class="action-row"><span class="mini-badge">Ed. 3 / 2013 reference</span><button class="btn secondary" onclick="openRotaxOperatorDocument()">Manual Record</button></div>
      </div>
      ${!p.serialNumber?`<button class="rotax-serial-callout" onclick="openEngineProfileModal()"><b>Add engine serial number</b><span>Serial identity helps determine which revisions, fuel-pump notes and bulletins apply to this engine.</span></button>`:''}
      <div class="rotax-limit-grid">
        ${specButton('rotax-om-e3-uls-takeoff-power','Takeoff','5800 RPM','100 hp • max 5 min')}
        ${specButton('rotax-om-e3-uls-max-continuous','Max continuous','5500 RPM','90 hp')}
        ${specButton('rotax-om-e3-uls-oil-pressure','Oil pressure','2.0–5.0 bar','normal above 3500 rpm')}
        ${specButton('rotax-om-e3-uls-oil-temperature','Oil temperature','50–130 °C','normal ~90–110 °C')}
        ${specButton('rotax-om-e3-uls-fuel-pressure','Fuel pressure','0.15–0.4 bar','2.2–5.8 psi')}
        ${specButton('rotax-om-e3-uls-coolant-max','Coolant max','120 °C','conventional coolant')}
        ${specButton('rotax-om-e3-uls-cht-max','CHT max','135 °C','275 °F')}
        ${specButton('rotax-om-e3-uls-egt-max','EGT max','880 °C','1616 °F')}
      </div>
      <details class="rotax-reference-details"><summary>Normal-operation & performance references</summary>
        <div class="rotax-reference-detail-grid">
          <div><span>Warm-up</span><b>2000 rpm ~2 min → 2500 rpm until oil 50 °C</b></div>
          <div><span>Ignition check</span><b>4000 rpm • max drop 300 • max A/B difference 115</b></div>
          <div><span>Minimum fuel</span><b>RON 95 / AKI 91</b></div>
          <div><span>75% fuel reference</span><b>18.5 L/h / 4.9 GPH</b></div>
          <div><span>75% variable-pitch table</span><b>5000 rpm • 68 hp • 26 inHg</b></div>
          <div><span>Gear ratio</span><b>2.43 : 1</b></div>
        </div>
      </details>
      <div class="engine-record-note"><b>Reference status:</b> Needs verification. This uploaded Operator Manual contains effective pages through April 2013. It is useful for building the tracker, but it is not being treated as proof that these are the latest limits for your serial number / installation.</div>
    </div>`;
  }
  function injectOperatorCard(){
    const page=document.getElementById('page-systems');if(!page||document.getElementById('rotaxOperatorReferenceCard'))return;
    const title=String(page.querySelector('.system-title-line h1')?.textContent||'').trim();
    if(title!=='Engine')return;
    const engine=document.getElementById('engineSystemRecord');
    if(engine)engine.insertAdjacentHTML('afterend',operatorLimitsHTML());
  }

  window.openRotaxOperatorDocument=function(){
    const d=operatorDoc();
    if(d&&typeof openDocumentDetail==='function'){openDocumentDetail(d.id);return}
    navTo('documents');
  };

  const oldOpenSystem=window.openSystemDashboard;
  window.openSystemDashboard=function(n){oldOpenSystem(n);ensureReferences();injectOperatorCard()};

  const oldRenderAll=renderAll;
  renderAll=function(){ensureReferences();oldRenderAll();injectOperatorCard()};

  const style=document.createElement('style');
  style.id='rotaxOperatorReferenceStyle';
  style.textContent=`
    .rotax-operator-card{margin-top:12px}
    .rotax-limit-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
    .rotax-limit-tile{appearance:none;text-align:left;border:1px solid var(--line);background:#f8fbfd;border-radius:11px;padding:11px 12px;min-height:84px;color:var(--ink);cursor:pointer}
    .rotax-limit-tile:hover{border-color:#8fbddd;background:#f3f9fd}
    .rotax-limit-tile span{display:block;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
    .rotax-limit-tile b{display:block;font-size:18px;line-height:1.15}
    .rotax-limit-tile small{display:block;color:var(--muted);font-size:10px;margin-top:4px}
    .rotax-serial-callout{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:1px solid #f0c36a;background:#fffaf0;border-radius:10px;padding:10px 12px;margin-top:10px;cursor:pointer}
    .rotax-serial-callout span{color:var(--muted);font-size:11px}
    .rotax-reference-details{margin-top:10px;border:1px solid var(--line);border-radius:10px;background:#fff}
    .rotax-reference-details summary{cursor:pointer;padding:10px 12px;font-weight:800}
    .rotax-reference-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line);border-top:1px solid var(--line)}
    .rotax-reference-detail-grid div{background:#fff;padding:10px 12px}
    .rotax-reference-detail-grid span{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:800;margin-bottom:3px}
    .rotax-reference-detail-grid b{font-size:12px;line-height:1.3}
    @media(max-width:900px){.rotax-limit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rotax-reference-detail-grid{grid-template-columns:1fr 1fr}}
    @media(max-width:560px){.rotax-limit-grid{grid-template-columns:1fr 1fr}.rotax-limit-tile{min-height:76px;padding:10px}.rotax-limit-tile b{font-size:16px}.rotax-reference-detail-grid{grid-template-columns:1fr}.rotax-serial-callout{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);

  ensureReferences();
})();