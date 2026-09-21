'use strict';
// ---------- V5.13 ROTAX 912 INSTALLATION MANUAL REFERENCE PACK ----------
// Source: ROTAX 912 Series Installation Manual, IM-912 / P/N 898644,
// Edition 3 / Revision 0, January 01 2021.
// User has confirmed the supplied ROTAX material is current for this tracker.
// Aircraft-specific installation instructions remain distinct from manufacturer references.

(function(){
  if(window.__n594zsRotaxInstallPackInstalled)return;
  window.__n594zsRotaxInstallPackInstalled=true;

  const A=v=>Array.isArray(v)?v:[];
  const SOURCE='ROTAX 912 Series Installation Manual';
  const REV='Ed. 3 / Rev. 0 • Jan 01 2021';
  const DOC_KEY='rotax-im-912-ed3-r0';
  const manualNote=(section,page,extra='')=>[
    `IM-912 / P/N 898644 • ${section} p.${page}`,
    extra,
    'Current ROTAX manufacturer reference supplied for N594ZS. Use together with the applicable N594ZS/Kitfox installation instructions where aircraft-specific requirements apply.'
  ].filter(Boolean).join(' • ');

  const refs=[
    {id:'rotax-im-e3r0-serial-location',title:'Engine serial-number location',system:'Engine',value:'Ignition cover, left side opposite electric starter',units:'',section:'00-00-00',page:'2',notes:'ROTAX instructs that the engine serial number be provided for inquiries and parts because same-type engines can require different support/spares.'},
    {id:'rotax-im-e3r0-generator',title:'Internal generator output',system:'Electrical',value:'Approx. 250',units:'W AC @ 5800 rpm',section:'24-00-00',page:'5',notes:''},
    {id:'rotax-im-e3r0-reg-voltage',title:'Standard rectifier-regulator output voltage',system:'Electrical',value:'14.2 ± 0.3',units:'V',section:'24-00-00',page:'6',notes:'For the standard external rectifier-regulator used with the internal generator: output from 1000 ± 250 rpm; regulator current limit max. 22 A and component temperature max. 80 °C.'},
    {id:'rotax-im-e3r0-reg-fuse',title:'Standard rectifier-regulator protection',system:'Electrical',value:'25',units:'A slow-blow fuse / CB',section:'24-00-00',page:'7',notes:'For the standard rectifier-regulator/internal-generator installation: 25 A slow-blow protection, main-circuit wire at least 2.5 mm² (14 AWG), capacitor at least 22000 µF / 25 V. The optional external alternator has separate wiring/protection requirements.'},
    {id:'rotax-im-e3r0-fuel-return',title:'Fuel return line',system:'Fuel',value:'Mandatory',units:'',section:'73-00-00',page:'7',notes:'If the ROTAX fuel distributor/regulator is not used, the return restriction must regulate fuel pressure within ROTAX operating limits.'},
    {id:'rotax-im-e3r0-fine-filter',title:'Fuel fine-filter mesh',system:'Fuel',value:'0.1',units:'mm (70–100 µm)',section:'73-00-00',page:'7',notes:'Additional fine filter in the feed line from tank to pumps; accessible for service. Manual warns against plastic filters in the engine compartment and paper filters.'},
    {id:'rotax-im-e3r0-aux-pump-pressure',title:'Auxiliary fuel-pump maximum pressure',system:'Fuel',value:'0.31',units:'bar (4.5 psi)',section:'73-00-00',page:'8',notes:'ROTAX recommends an electrical auxiliary fuel pump; the entire fuel system must remain within specified pressure limits.'},
    {id:'rotax-im-e3r0-pump-flow',title:'Fuel-pump delivery rate',system:'Fuel',value:'Min. 35',units:'L/h (9.25 US gal/h)',section:'73-00-00',page:'9',notes:'Stated for electrical or mechanical fuel pump.'},
    {id:'rotax-im-e3r0-return-orifice',title:'ROTAX fuel-manifold return orifice',system:'Fuel',value:'0.5',units:'mm (0.0197 in)',section:'73-00-00',page:'12',notes:'The manual states this orifice is essential for correct fuel-system operation in the illustrated ROTAX manifold arrangements.'},
    {id:'rotax-im-e3r0-throttle-travel',title:'Throttle actuation travel',system:'Engine',value:'65',units:'mm (2.56 in)',section:'73-00-00',page:'20',notes:'Throttle opens by spring. Two throttles are controlled by separate Bowden cables working synchronously.'},
    {id:'rotax-im-e3r0-throttle-free',title:'Throttle Bowden-cable free travel',system:'Engine',value:'Approx. 1',units:'mm (0.04 in)',section:'73-00-00',page:'22',notes:'Manual also requires positive adjustable idle/full-throttle stops and secure cable sleeves.'},
    {id:'rotax-im-e3r0-radiator-heat',title:'912 S / ULS radiator heat rejection reference',system:'Cooling',value:'Approx. 28',units:'kW',section:'75-00-00',page:'20',notes:'Radiator size/type must be adequate; the manual notes experience with about 500 cm² radiator area when airflow is good.'},
    {id:'rotax-im-e3r0-coolant-flow',title:'Coolant-circuit flow reference',system:'Cooling',value:'Approx. 60',units:'L/min @ 5800 rpm',section:'75-00-00',page:'21',notes:'Manual also lists total engine coolant quantity about 1.5 L (0.4 US gal), depending on the installation.'},
    {id:'rotax-im-e3r0-oil-hose-id',title:'Main oil-system hose minimum ID',system:'Engine',value:'Min. 10',units:'mm (0.39 in)',section:'79-00-00',page:'11',notes:'At -500 mbar and 150 °C oil temperature, oil lines must not collapse.'},
    {id:'rotax-im-e3r0-crankcase-pressure',title:'Crankcase pressure validation limit',system:'Engine',value:'≤ ambient + 0.6',units:'bar (8.7 psi)',section:'79-00-00',page:'8',notes:'Measured at full throttle at 130 °C oil temperature as an installation validation check.'},
    {id:'rotax-im-e3r0-oil-suction-vacuum',title:'Oil-pump suction vacuum validation limit',system:'Engine',value:'Max. 0.3',units:'bar negative (4.35 psi)',section:'79-00-00',page:'9',notes:'Measured at full throttle / takeoff rpm at 130 °C, within 100 mm (4 in.) of the oil-pump suction connector.'},
    {id:'rotax-im-e3r0-oil-tank',title:'ROTAX oil-tank level capacities',system:'Engine',value:'MIN 2.5 / MAX 3.0',units:'L',section:'79-00-00',page:'21',notes:'Manual states the oil tank should be vibration-isolated from the engine and accessible for cap/drain service.'},
    {id:'rotax-im-e3r0-oil-radiator',title:'Oil-radiator area reference',system:'Engine',value:'At least 160',units:'cm² (25 in²)',section:'79-00-00',page:'22',notes:'Experience-based value provided airflow is adequate; oil radiator must not restrict oil flow and should be below the engine oil pump with fittings upward.'},
    {id:'rotax-im-e3r0-exhaust-backpressure',title:'Exhaust back pressure at maximum power',system:'Exhaust',value:'Max. 0.2',units:'bar (2.9 psi)',section:'78-00-00',page:'5',notes:'Measurement location stated as approximately 100 mm (3.94 in.) beyond the exhaust flange.'},
    {id:'rotax-im-e3r0-egt-location',title:'Initial-installation EGT measurement location',system:'Exhaust',value:'Approx. 100',units:'mm (3.93 in) from exhaust flange',section:'78-00-00',page:'9',notes:'The manual says EGT should be measured at initial engine installation and verified during test flights; operating limit is referenced to the current 912 Series Operator’s Manual.'},
    {id:'rotax-im-e3r0-starter-duty',title:'Starter duty cycle',system:'Electrical',value:'Max. 10 sec ON / 2 min cool',units:'',section:'80-00-00',page:'2',notes:'Electric starter housing ambient temperature max. 80 °C (176 °F).'}
  ];

  const trialItems=[
    'Check engine oil, coolant and fuel level',
    'Check throttle and choke controls reach both stops and operate through the correct range',
    'Confirm no tools, foreign objects or loose items remain in the engine compartment',
    'Check propeller security and pitch setting',
    'If equipped with propeller control: verify the control reaches both stops and operates through the correct range',
    'Secure aircraft / chock wheels and secure the propeller area',
    'Perform visual inspection of engine and accessories',
    'Check for leaks',
    'Check engine suspension',
    'Check oil-filter security',
    'Check oil-hose connections are correct',
    'Check oil-system purging is complete',
    'Check required systems and instruments are installed appropriately',
    'Check gauges for accuracy',
    'Check wiring is routed properly and secured',
    'Check exhaust system is secure and free of blockage',
    'Preheat engine when required by cold-weather conditions'
  ];

  function engineEquipmentId(){
    const e=A(db.equipment).find(x=>String(x.system||'')==='Engine'&&/912/i.test([x.name,x.model,x.manufacturer].join(' ')));
    return e?.id||null;
  }
  function installDoc(){
    return A(db.docs).find(d=>d.sourceKey===DOC_KEY)||
           A(db.docs).find(d=>Number(d.id)===301)||
           A(db.docs).find(d=>/912.*installation manual/i.test(d.name||''));
  }

  let lastInstallPackDb=null;
  function persistRotaxInstallPack(){
    try{
      if(typeof persistBrowserData==='function')Promise.resolve(persistBrowserData(db,{quiet:true})).catch(()=>{});
      else localStorage.setItem(DB_KEY,JSON.stringify(db));
    }catch(_e){}
    try{if(typeof queueCloudSave==='function')queueCloudSave()}catch(_e){}
  }
  function ensureRotaxInstallPack(){
    db.settings=db.settings||{};
    if(lastInstallPackDb===db&&db.settings.rotaxInstallManualEd3R0Seeded)return false;
    lastInstallPackDb=db;
    let changed=false;
    const doc=installDoc();
    if(doc){
      if(!doc.revision){doc.revision='Edition 3 / Rev. 0';changed=true}
      if(!doc.issueDate){doc.issueDate='2021-01-01';changed=true}
      if(!doc.rotaxSourceManaged){doc.rotaxSourceManaged=true;changed=true}
      if(!doc.sourceKey){doc.sourceKey=DOC_KEY;changed=true}
      if(!doc.sourceNotes){
        doc.sourceNotes='IM-912 / P/N 898644, Edition 3 / Rev. 0, January 01 2021. ROTAX states the Installation Manual is a general installation guide and should be used with the airframe manufacturer instructions and current applicable ROTAX documentation.';
        changed=true;
      }
    }

    db.specs=A(db.specs);
    // Existing reference records are user-owned once created. Only backfill missing
    // source metadata; never rewrite a value, title, notes, or checklist text.
    for(const r of refs){
      const s=db.specs.find(x=>String(x.id)===r.id);
      if(!s)continue;
      const metadata={
        status:'Current Manufacturer Reference',
        source:SOURCE,
        sourceRevision:`${REV} • ${r.section} p.${r.page}`,
        documentId:doc?.id||null
      };
      for(const [k,v] of Object.entries(metadata)){
        if((s[k]===undefined||s[k]===null||s[k]==='')&&v!==null){s[k]=v;changed=true}
      }
      if(s.rotaxSourceManaged!==true){s.rotaxSourceManaged=true;changed=true}
    }
    db.checklists=A(db.checklists);
    const preTrial=db.checklists.find(x=>x.name==='ROTAX 912 Installation Manual — Pre-Trial-Run Closeout');
    if(preTrial){
      if(!preTrial.documentId&&doc?.id){preTrial.documentId=doc.id;changed=true}
      if(preTrial.rotaxSourceManaged!==true){preTrial.rotaxSourceManaged=true;changed=true}
    }

        if(!db.settings.rotaxInstallManualEd3R0Seeded){
      const eqId=engineEquipmentId(),docId=doc?.id||null;
      for(const r of refs){
        if(db.specs.some(x=>String(x.id)===r.id))continue;
        db.specs.push({
          id:r.id,title:r.title,system:r.system,value:r.value,units:r.units,
          status:'Current Manufacturer Reference',source:SOURCE,sourceRevision:`${REV} • ${r.section} p.${r.page}`,
          sourceUrl:'',documentId:docId,equipmentId:eqId,
          notes:manualNote(r.section,r.page,r.notes),rotaxSourceManaged:true
        });
        changed=true;
      }

      db.checklists=A(db.checklists);
      if(!db.checklists.some(x=>x.name==='ROTAX 912 Installation Manual — Pre-Trial-Run Closeout')){
        db.checklists.push({
          id:crypto.randomUUID(),
          name:'ROTAX 912 Installation Manual — Pre-Trial-Run Closeout',
          purpose:'Source-backed checklist of ROTAX checks before an engine trial run.',
          system:'Engine',
          trigger:'Before first engine run',
          projectId:A(db.projects).find(p=>p.title==='Oil system prime / purge')?.id||null,
          documentId:doc?.id||null,
          notes:'Source: ROTAX 912 Series Installation Manual, IM-912 / P/N 898644, Edition 3 / Rev. 0, Chapter 10-10-00 pages 12–13. ROTAX states this checklist is not exhaustive and directs the user to the applicable Instructions for Continued Airworthiness and Operator’s Manual.',
          items:trialItems.map((text,i)=>({id:i+1,text,done:false,note:''})),
          rotaxSourceManaged:true
        });
        changed=true;
      }
      db.settings.rotaxInstallManualEd3R0Seeded=true;
      changed=true;
    }
    if(changed)persistRotaxInstallPack();
    return changed;
  }

  window.ensureRotaxInstallPack=ensureRotaxInstallPack;

  const renderOpsSpecsRotaxBase=window.renderOpsSpecs;
  if(typeof renderOpsSpecsRotaxBase==='function'){
    window.renderOpsSpecs=function(){
      ensureRotaxInstallPack();
      renderOpsSpecsRotaxBase();
    };
  }

  ensureRotaxInstallPack();
})();