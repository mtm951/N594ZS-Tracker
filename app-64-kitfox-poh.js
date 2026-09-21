// ---------- KITFOX MODEL IV / N594ZS POH SOURCE PACK ----------
(function(){
  if(window.__n594zsKitfoxPohPack)return;
  window.__n594zsKitfoxPohPack=true;

  const A=v=>Array.isArray(v)?v:[], T=v=>String(v??'');
  const blank=v=>v===undefined||v===null||v==='';
  const DOC_ID=1789574858343;
  const DOC_KEY='kitfox-poh-model4-1442-n594zs';
  const SOURCE="Kitfox Model IV Owner's Manual / Pilot's Operating Handbook";
  const SEED_FLAG='kitfoxPohModel4N594zsSeeded';

  const refs=[
    {
      id:'kitfox-poh-v1-gross-weight',
      title:'Maximum gross weight',
      system:'Aircraft',
      value:'1050',
      units:'lb',
      status:'Airframe Limitation (POH)',
      page:'2-2',
      notes:'Operating-limitations value for the Kitfox Model IV airframe.'
    },
    {
      id:'kitfox-poh-v1-vne',
      title:'Never-exceed speed (Vne)',
      system:'Aircraft',
      value:'125',
      units:'mph',
      status:'Airframe Limitation (POH)',
      page:'2-2',
      notes:'POH airspeed limitation: never exceed in glide or dive, smooth air.'
    },
    {
      id:'kitfox-poh-v1-flap-range',
      title:'Flap / flaperon operating range',
      system:'Flight Controls',
      value:'22–75',
      units:'mph',
      status:'Airframe Limitation (POH)',
      page:'2-2',
      notes:'POH flap operating range.'
    },
    {
      id:'kitfox-poh-v1-load-factor',
      title:'Flight load factor — flaps up',
      system:'Aircraft',
      value:'+5.7 / -2.85',
      units:'g',
      status:'Airframe Limitation (POH)',
      page:'2-2',
      notes:'POH operating limitation for flaps up.'
    },
    {
      id:'kitfox-poh-v1-maneuvering-speed',
      title:'Maneuvering speed reference',
      system:'Aircraft',
      value:'80',
      units:'mph',
      status:'POH Reference — Verify Current Aircraft',
      page:'1-5',
      notes:'Model IV performance-table reference. Confirm applicability during the current N594ZS flight-test program.'
    },
    {
      id:'kitfox-poh-v1-best-rate-912',
      title:'Best-rate climb speed — legacy 912 reference',
      system:'Flight Test',
      value:'55–65',
      units:'mph',
      status:'Historical POH Reference — Verify in Flight Test',
      page:'1-5',
      notes:'Generic Model IV Rotax 912-column reference from the scanned POH. That table describes the older 80 hp Rotax 912 configuration, not the current 100 hp 912 ULS / IVO installation. The POH directs each builder to establish actual performance through flight testing.'
    },
    {
      id:'kitfox-poh-v1-best-angle-912',
      title:'Best-angle climb speed — legacy 912 reference',
      system:'Flight Test',
      value:'45',
      units:'mph',
      status:'Historical POH Reference — Verify in Flight Test',
      page:'1-5',
      notes:'Generic Model IV Rotax 912-column reference. Treat as historical until confirmed for the current N594ZS configuration.'
    },
    {
      id:'kitfox-poh-v1-best-glide-912',
      title:'Best-glide speed — legacy 912 reference',
      system:'Flight Test',
      value:'60',
      units:'mph',
      status:'Historical POH Reference — Verify in Flight Test',
      page:'1-5',
      notes:'Generic Model IV Rotax 912-column reference. Treat as historical until confirmed for the current N594ZS configuration.'
    },
    {
      id:'kitfox-poh-v1-flaperon-deflection',
      title:'Maximum flaperon flap deflection',
      system:'Flight Controls',
      value:'25',
      units:'degrees',
      status:'Airframe Reference (POH)',
      page:'4-2',
      notes:'The POH describes the flaperon control range as 0° to 25° and cautions that deflection beyond 25° restricts aileron travel and effectiveness.'
    },
    {
      id:'kitfox-poh-v1-aileron-differential',
      title:'Flaperon aileron differential',
      system:'Flight Controls',
      value:'25 up / 12.5 down',
      units:'degrees',
      status:'Airframe Reference (POH)',
      page:'4-2',
      notes:'POH geometry for the flaperon differential-control system.'
    },
    {
      id:'kitfox-poh-v1-brake-fluid',
      title:'Brake hydraulic fluid specification',
      system:'Landing Gear',
      value:'MIL-H-5606A',
      units:'',
      status:'Airframe Maintenance Reference (POH)',
      page:'4-1',
      notes:'POH specifies MIL SPEC H-5606A brake fluid and warns not to use automotive or silicone brake fluid.'
    }
  ];

  const wingFold={
    id:'kitfox-poh-wing-folding',
    sourceKey:'kitfox-poh-wing-folding',
    name:'Kitfox Model IV POH — Wing Folding Procedure',
    purpose:'Airframe procedure extracted from the N594ZS / S/N 1442 POH.',
    system:'Airframe',
    trigger:'When folding wings',
    sourcePages:'5-4',
    notes:'Source: Kitfox Model IV Owner\'s Manual / Pilot\'s Operating Handbook, p.5-4. WARNING from the POH: do not fold the wing with a full wing tank; fuel may overflow and the added fuel weight puts undue stress on the unsupported wing. Follow current aircraft configuration and condition requirements as well.',
    items:[
      'Chock the wheels.',
      'Release the 9 winged camlocks and remove the turtledeck.',
      'Detach the aileron controls at the flaperon control horns.',
      'Remove the front spar attach pin.',
      'Swing the wing back and secure it with the wing lock-back brace.'
    ]
  };

  const airframePreflight={
    id:'kitfox-poh-airframe-preflight',
    sourceKey:'kitfox-poh-airframe-preflight',
    name:'Kitfox Model IV POH — Airframe Preflight Reference',
    purpose:'Airframe-focused extraction of the POH exterior inspection for use alongside current engine, fuel-system and configuration-specific checklists.',
    system:'Airframe',
    trigger:'Preflight reference — verify current configuration',
    sourcePages:'2-5 through 2-6',
    notes:'Source: Kitfox Model IV Owner\'s Manual / Pilot\'s Operating Handbook, pp.2-5 through 2-6. This tracker checklist intentionally promotes only airframe/control-surface/gear items that remain broadly applicable. Legacy engine/fuel-system-specific POH steps are not represented here as current procedures; use the full POH plus current N594ZS/ROTAX references.',
    items:[
      'Check control stick for free and proper movement of control surfaces (flaperons and elevator).',
      'Inspect rudder pedals for free movement, loose or jammed hardware, cracked bellcranks or other damaged parts, chafed/frayed rudder cables, or excessive play.',
      'Check throttle reverse bellcrank and control cables.',
      'Check radiator for damage or coolant leaks.',
      'Check bungee cord for wear, fraying, or loosening.',
      'Check left main tire for proper inflation and hydraulic lines for leaks.',
      'Check left lift strut to fuselage attach bolt.',
      'Check left front spar clevis pin and safety pin.',
      'Check cowling fasteners for proper installation and security.',
      'Check propeller and spinner for nicks/damage and security.',
      'Check right front spar clevis pin and safety pin.',
      'Check right main tire for proper inflation and hydraulic lines for leaks.',
      'Check right lift strut and attach bolts.',
      'Check right flaperon for freedom of movement.',
      'Check right flaperon control horn, flaperon hinges and flaperons for damage.',
      'Check turtledeck and fasteners.',
      'Check fabric on fuselage top, sides, and belly.',
      'Check vertical and horizontal stabilizers.',
      'Check horizontal stabilizer braces and attach points.',
      'Check rudder and elevator control surfaces for freedom of movement and clevis pin security.',
      'Check rudder cable connections and chain connections to tailwheel.',
      'Check tailwheel.',
      'Check left flaperon control horn, flaperon hinges and flaperons for damage.',
      'Check left flaperon for freedom of movement.',
      'Check left wing tip and left leading edge for damage.'
    ]
  };

  let lastPohDb=null;

  function setIfBlank(obj,key,value){
    if(blank(obj[key])&&!blank(value)){obj[key]=value;return true}
    return false;
  }

  function sourceDoc(){
    db.docs=A(db.docs);
    return db.docs.find(d=>String(d.sourceKey||'')===DOC_KEY)||
      db.docs.find(d=>Number(d.id)===DOC_ID)||
      db.docs.find(d=>/kitfox\s*4.*1442.*poh|kitfox.*1442.*operating handbook/i.test([d.name,d.notes].join(' ')))||null;
  }

  function ensureDoc(){
    let changed=false,d=sourceDoc();
    if(!d){
      d={
        id:DOC_ID,
        name:'Kitfox 4 #1442 POH',
        type:'Pilot Operating Handbook',
        revision:'',
        issueDate:'',
        system:'Aircraft / Flight Test',
        publisher:'Denney Aerocraft Company',
        location:'',
        notes:'N594ZS / Serial 1442 Model IV Owner\'s Manual / Pilot\'s Operating Handbook. Use as the airframe/legacy aircraft source. Engine, propeller, fuel-system and equipment-specific material may be historical where N594ZS has been modified.',
        applicability:'N594ZS / Kitfox Model IV / Serial 1442. Airframe source; verify modified-system applicability against the current N594ZS configuration and current component-manufacturer data.',
        linkedProjectIds:[],
        linkedPartIds:[],
        linkedLogIds:[],
        linkedEquipmentIds:[],
        updates:[],
        sourceKey:DOC_KEY,
        pohSourceManaged:true,
        sourceNotes:'Uploaded scan identifies Model IV, Serial 1442 and registration N594ZS. The aircraft data sheet records the original Rotax 582 installation; the generic 912 performance/specification column is therefore retained only as a historical/reference source for the current modified aircraft.'
      };
      db.docs.push(d);changed=true;
      return {doc:d,changed};
    }
    changed=setIfBlank(d,'sourceKey',DOC_KEY)||changed;
    if(d.pohSourceManaged!==true){d.pohSourceManaged=true;changed=true}
    changed=setIfBlank(d,'applicability','N594ZS / Kitfox Model IV / Serial 1442. Airframe source; verify modified-system applicability against the current N594ZS configuration and current component-manufacturer data.')||changed;
    changed=setIfBlank(d,'sourceNotes','Uploaded scan identifies Model IV, Serial 1442 and registration N594ZS. The aircraft data sheet records the original Rotax 582 installation; the generic 912 performance/specification column is therefore retained only as a historical/reference source for the current modified aircraft.')||changed;
    return {doc:d,changed};
  }

  function ensureSpecs(doc,initial){
    let changed=false;
    db.specs=A(db.specs);
    for(const r of refs){
      let s=db.specs.find(x=>String(x.id)===r.id);
      if(!s){
        if(!initial)continue;
        s={
          id:r.id,title:r.title,system:r.system,value:r.value,units:r.units,status:r.status,
          source:SOURCE,sourceRevision:`N594ZS / S/N 1442 • POH p.${r.page}`,
          sourceUrl:'',documentId:doc?.id||null,equipmentId:null,notes:r.notes,
          sourceKey:r.id,pohSourceManaged:true
        };
        db.specs.push(s);changed=true;continue;
      }
      const metadata={
        source:SOURCE,
        sourceRevision:`N594ZS / S/N 1442 • POH p.${r.page}`,
        documentId:doc?.id||null,
        sourceKey:r.id
      };
      for(const [k,v] of Object.entries(metadata))changed=setIfBlank(s,k,v)||changed;
      if(s.pohSourceManaged!==true){s.pohSourceManaged=true;changed=true}
    }
    return changed;
  }

  function ensureAnnualSource(doc){
    const c=A(db.checklists).find(x=>String(x.id)==='503'||x.name==='Annual Inspection');
    if(!c)return false;
    let changed=false;
    changed=setIfBlank(c,'sourceDocumentId',doc?.id||null)||changed;
    changed=setIfBlank(c,'sourcePages','5-1 through 5-3')||changed;
    changed=setIfBlank(c,'sourceKey','kitfox-poh-annual-inspection')||changed;
    if(c.pohSourceManaged!==true){c.pohSourceManaged=true;changed=true}
    return changed;
  }

  function ensureChecklist(def,doc,initial){
    db.checklists=A(db.checklists);
    let c=db.checklists.find(x=>String(x.sourceKey||'')===def.sourceKey)||
      db.checklists.find(x=>String(x.id)===def.id)||
      db.checklists.find(x=>x.name===def.name);
    if(!c){
      if(!initial)return false;
      c={
        id:def.id,name:def.name,purpose:def.purpose,system:def.system,trigger:def.trigger,
        projectId:null,notes:def.notes,sourcePages:def.sourcePages,documentId:doc?.id||null,
        sourceKey:def.sourceKey,pohSourceManaged:true,
        items:def.items.map((text,i)=>({id:i+1,text,done:false,note:''}))
      };
      db.checklists.push(c);return true;
    }
    let changed=false;
    changed=setIfBlank(c,'sourceKey',def.sourceKey)||changed;
    changed=setIfBlank(c,'documentId',doc?.id||null)||changed;
    changed=setIfBlank(c,'sourcePages',def.sourcePages)||changed;
    if(c.pohSourceManaged!==true){c.pohSourceManaged=true;changed=true}
    return changed;
  }

  function persistNoRender(){
    try{
      if(typeof persistBrowserData==='function')Promise.resolve(persistBrowserData(db,{quiet:true})).catch(()=>{});
      else localStorage.setItem(DB_KEY,JSON.stringify(db));
    }catch(_e){}
    try{if(typeof queueCloudSave==='function')queueCloudSave()}catch(_e){}
  }

  function ensurePack(){
    db.settings=db.settings||{};
    if(lastPohDb===db&&db.settings[SEED_FLAG])return false;
    lastPohDb=db;
    const initial=!db.settings[SEED_FLAG];
    let changed=false;
    const d=ensureDoc();changed=d.changed||changed;
    changed=ensureSpecs(d.doc,initial)||changed;
    changed=ensureAnnualSource(d.doc)||changed;
    changed=ensureChecklist(wingFold,d.doc,initial)||changed;
    changed=ensureChecklist(airframePreflight,d.doc,initial)||changed;
    if(initial){db.settings[SEED_FLAG]=true;changed=true}
    if(changed)persistNoRender();
    return changed;
  }

  window.ensureKitfoxPohPack=ensurePack;
})();
