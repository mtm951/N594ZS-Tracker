'use strict';
// ---------- V5.13 ROTAX 912 INSTALLATION MANUAL REFERENCE PACK ----------
// Source: ROTAX 912 Series Installation Manual, IM-912 / P/N 898644,
// Edition 3 / Revision 0, January 01 2021.
// Values are source-backed reference entries, not a claim that this 2021 revision
// is the latest or that every item applies unchanged to N594ZS.

(function(){
  if(window.__n594zsRotaxInstallPackInstalled)return;
  window.__n594zsRotaxInstallPackInstalled=true;

  const A=v=>Array.isArray(v)?v:[];
  const SOURCE='ROTAX 912 Series Installation Manual';
  const REV='Ed. 3 / Rev. 0 • Jan 01 2021';
  const manualNote=(section,page,extra='')=>[
    `IM-912 / P/N 898644 • ${section} p.${page}`,
    extra,
    'Verified to the uploaded 2021 manual. Confirm applicability against the latest ROTAX documentation and the N594ZS/Kitfox installation before maintenance or operation.'
  ].filter(Boolean).join(' • ');

  const refs=[
    {id:'rotax-im-e3r0-serial-location',title:'Engine serial-number location',system:'Engine',value:'Ignition cover, left side opposite electric starter',units:'',section:'00-00-00',page:'2',notes:'ROTAX instructs that the engine serial number be provided for inquiries and parts because same-type engines can require different support/spares.'},
    {id:'rotax-im-e3r0-generator',title:'Internal generator output',system:'Electrical',value:'Approx. 250',units:'W AC @ 5800 rpm',section:'24-00-00',page:'5',notes:''},
    {id:'rotax-im-e3r0-reg-voltage',title:'Rectifier-regulator output voltage',system:'Electrical',value:'14.2 ± 0.3',units:'V',section:'24-00-00',page:'6',notes:'Manual states this output from 1000 ± 250 rpm; regulator current limit max. 22 A and component temperature max. 80 °C.'},
    {id:'rotax-im-e3r0-reg-fuse',title:'Rectifier-regulator protection',system:'Electrical',value:'25',units:'A slow-blow fuse / CB',section:'24-00-00',page:'7',notes:'Manual also specifies main-circuit wire size at least 2.5 mm² (14 AWG) and capacitor at least 22000 µF / 25 V for the standard rectifier-regulator installation.'},
    {id:'rotax-im-e3r0-fuel-return',title:'Fuel return line',system:'Fuel',value:'Mandatory',units:'',section:'73-00-00',page:'7',notes:'If the ROTAX fuel distributor/regulator is not used, the return restriction must regulate fuel pressure within ROTAX operating limits.'},
    {id:'rotax-im-e3r0-fine-filter',title:'Fuel fine-filter mesh',system:'Fuel',value:'0.1',units:'mm (70–100 µm)',section:'73-00-00',page:'7',notes:'Additional fine filter in the feed line from tank to pumps; accessible for service. Manual warns against plastic filters in the engine compartment and paper filters.'},
    {id:'rotax-im-e3r0-aux-pump-pressure',title:'Auxiliary fuel-pump maximum pressure',system:'Fuel',value:'0.31',units:'bar (4.5 psi)',section:'73-00-00',page:'8',notes:'ROTAX recommends an electrical auxiliary fuel pump; the entire fuel system must remain within specified pressure limits.'},
    {id:'rotax-im-e3r0-pump-flow',title:'Fuel-pump delivery rate',system:'Fuel',value:'Min. 35',units:'L/h (9.25 US gal/h)',section:'73-00-00',page:'9',notes:'Stated for electrical or mechanical fuel pump.'},
    {id:'rotax-im-e3r0-return-orifice',title:'ROTAX fuel-manifold return orifice',system:'Fuel',value:'0.5',units:'mm (0.0197 in)',section:'73-00-00',page:'12',notes:'The manual states this orifice is essential for correct fuel-system operation in the illustrated ROTAX manifold arrangements.'},
    {id:'rotax-im-e3r0-throttle-travel',title:'Throttle actuation travel',system:'Engine Controls',value:'65',units:'mm (2.56 in)',section:'73-00-00',page:'20',notes:'Throttle opens by spring. Two throttles are controlled by separate Bowden cables working synchronously.'},
    {id:'rotax-im-e3r0-throttle-free',title:'Throttle Bowden-cable free travel',system:'Engine Controls',value:'Approx. 1',units:'mm (0.04 in)',section:'73-00-00',page:'22',notes:'Manual also requires positive adjustable idle/full-throttle stops and secure cable sleeves.'},
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
    return A(db.docs).find(d=>Number(d.id)===301)||A(db.docs).find(d=>/912.*installation manual/i.test(d.name||''));
  }

  function ensureRotaxInstallPack(){
    db.settings=db.settings||{};
    let changed=false;
    const doc=installDoc();
    if(doc){
      if(!doc.revision){doc.revision='Edition 3 / Rev. 0';changed=true}
      if(!doc.issueDate){doc.issueDate='2021-01-01';changed=true}
      if(!/IM-912/.test(doc.notes||'')){
        doc.notes=[doc.notes,'Uploaded source: IM-912 / P/N 898644, Edition 3 / Rev. 0, January 01 2021. ROTAX states the Installation Manual is a general installation guide and should be used with the airframe manufacturer instructions and current applicable ROTAX documentation.'].filter(Boolean).join(' ');
        changed=true;
      }
    }

    db.specs=A(db.specs);
    if(!db.settings.rotaxInstallManualEd3R0Seeded){
      const eqId=engineEquipmentId(),docId=doc?.id||null;
      for(const r of refs){
        if(db.specs.some(x=>String(x.id)===r.id))continue;
        db.specs.push({
          id:r.id,title:r.title,system:r.system,value:r.value,units:r.units,
          status:'Needs Verification',source:SOURCE,sourceRevision:`${REV} • ${r.section} p.${r.page}`,
          sourceUrl:'',documentId:docId,equipmentId:eqId,
          notes:manualNote(r.section,r.page,r.notes)
        });
        changed=true;
      }

      db.checklists=A(db.checklists);
      if(!db.checklists.some(x=>x.name==='ROTAX 912 Installation Manual — Pre-Trial-Run Closeout')){
        db.checklists.push({
          id:crypto.randomUUID(),
          name:'ROTAX 912 Installation Manual — Pre-Trial-Run Closeout',
          purpose:'Source-backed closeout of the Installation Manual checks before an engine trial run.',
          system:'Engine',
          trigger:'Before first engine run',
          projectId:A(db.projects).find(p=>p.title==='Oil system prime / purge')?.id||null,
          notes:'Source: ROTAX 912 Series Installation Manual, IM-912, Edition 3 / Rev. 0, Chapter 10-10-00 pages 12–13. The manual explicitly says this checklist is not exhaustive and points to the latest Operator’s Manual / Instructions for Continued Airworthiness.',
          items:trialItems.map((text,i)=>({id:i+1,text,done:false,note:''}))
        });
        changed=true;
      }
      db.settings.rotaxInstallManualEd3R0Seeded=true;
      changed=true;
    }
    if(changed)saveDB('ROTAX Installation Manual references loaded.');
    return changed;
  }

  window.ensureRotaxInstallPack=ensureRotaxInstallPack;

  const renderAllRotaxBase=renderAll;
  renderAll=function(){
    ensureRotaxInstallPack();
    renderAllRotaxBase();
  };

  const renderOpsSpecsRotaxBase=window.renderOpsSpecs;
  if(typeof renderOpsSpecsRotaxBase==='function'){
    window.renderOpsSpecs=function(){
      ensureRotaxInstallPack();
      renderOpsSpecsRotaxBase();
    };
  }

  ensureRotaxInstallPack();
})();