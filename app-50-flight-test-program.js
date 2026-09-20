'use strict';
// ---------- V5.10 ROTAX 912 CONVERSION FLIGHT-TEST PROGRAM ----------
// Adds structured test context and reusable N594ZS 912-conversion cards.
// Targets intentionally point to applicable source material instead of embedding operating limits.

(function(){
  if(window.__n594zs912FlightProgramInstalled)return;
  window.__n594zs912FlightProgramInstalled=true;

  const A=v=>Array.isArray(v)?v:[];
  const T=v=>String(v??'').trim();
  const J=v=>JSON.stringify(String(v??''));

  function normalizeFlightCardContext(f){
    f.aircraftWeightLb=f.aircraftWeightLb??'';
    f.cgIn=f.cgIn??'';
    f.fuelGal=f.fuelGal??'';
    f.oat=f.oat??'';
    f.wind=f.wind??'';
    f.densityAltitudeFt=f.densityAltitudeFt??'';
    f.propConfig=f.propConfig??'';
    f.testAltitudeFt=f.testAltitudeFt??'';
    f.airportRunway=f.airportRunway??'';
    f.airframeHours=f.airframeHours??'';
    f.engineHoursStart=f.engineHoursStart??'';
    f.engineHoursEnd=f.engineHoursEnd??'';
    f.limitsSource=f.limitsSource||'';
    return f;
  }

  const normalizeFlightProgramBase=normalizeDB;
  normalizeDB=function(){
    normalizeFlightProgramBase();
    A(db.flightCards).forEach(normalizeFlightCardContext);
  };
  normalizeDB();

  const ROTAX_SOURCE='Current applicable Rotax 912 ULS operating / installation / maintenance instructions; verify revision and engine applicability';
  const AIRCRAFT_SOURCE='N594ZS operating limitations, current aircraft records, Kitfox documentation, and pilot-established test plan';
  const PROP_SOURCE='Current applicable IVO propeller instructions and documented installed propeller configuration';

  function point(objective,target='',notes=''){
    return {id:crypto.randomUUID(),objective,target,actual:'',result:'Pending',notes};
  }

  const templates={
    ground:{
      title:'912 Conversion — Ground / Installation Validation',
      conditions:'Aircraft secured for ground testing. Record installed propeller configuration, fuel load, ambient conditions and current engine hours.',
      notes:'Complete applicable installation inspections and manufacturer-required ground checks before flight. Record any discrepancy as a squawk/project before proceeding.',
      items:[
        point('Aircraft configuration and loading recorded',AIRCRAFT_SOURCE),
        point('Oil-system preparation / purge status verified',ROTAX_SOURCE),
        point('Cooling system serviced, purged and leak-free',ROTAX_SOURCE),
        point('Fuel-system leak / flow verification completed',AIRCRAFT_SOURCE,'Include the current header, supply, pump/carb and return configuration.'),
        point('Throttle, choke and engine controls full-travel / security check',ROTAX_SOURCE),
        point('Propeller installation, tracking, hardware and configuration verified',PROP_SOURCE),
        point('Initial start: oil pressure response observed and recorded',ROTAX_SOURCE),
        point('Ignition / run-up behavior recorded',ROTAX_SOURCE),
        point('Static full-power RPM recorded',ROTAX_SOURCE+'; '+PROP_SOURCE),
        point('Fuel pressure through idle, run-up and high-power ground operation recorded',ROTAX_SOURCE),
        point('Oil / coolant temperatures and charging voltage recorded during ground run',ROTAX_SOURCE),
        point('Vibration / unusual noise observations recorded',AIRCRAFT_SOURCE),
        point('Post-run inspection: oil, coolant, fuel leaks / chafe / looseness',AIRCRAFT_SOURCE)
      ]
    },
    first:{
      title:'912 Conversion — First Flight Basic Checkout',
      conditions:'Conservative first-flight configuration. Record loading, weather, runway, engine hours and installed propeller configuration before launch.',
      notes:'Primary objective: engine-installation reliability and basic aircraft controllability. Use pre-established limits, abort criteria and operating area from the applicable sources.',
      items:[
        point('Preflight configuration / loading / test conditions recorded',AIRCRAFT_SOURCE),
        point('Takeoff RPM and acceleration observations recorded',ROTAX_SOURCE+'; '+PROP_SOURCE),
        point('Oil pressure immediately after takeoff power application recorded',ROTAX_SOURCE),
        point('Fuel pressure during takeoff and initial climb recorded',ROTAX_SOURCE),
        point('Oil temperature, coolant / CHT and pressure behavior during initial climb recorded',ROTAX_SOURCE),
        point('Charging voltage / electrical behavior in flight recorded',AIRCRAFT_SOURCE),
        point('Engine smoothness / vibration / throttle response observations',ROTAX_SOURCE),
        point('Basic trim and control-feel observations in level flight',AIRCRAFT_SOURCE),
        point('Conservative cruise engine indications recorded',ROTAX_SOURCE),
        point('Approach / landing engine behavior and idle response recorded',AIRCRAFT_SOURCE),
        point('Post-flight cowling-off inspection completed and findings recorded',AIRCRAFT_SOURCE)
      ]
    },
    repeat:{
      title:'912 Conversion — Repeatability / Second Flight',
      conditions:'Repeat the basic first-flight configuration as closely as practical so engine indications can be compared directly.',
      notes:'Resolve first-flight discrepancies before using this card. The point of this card is repeatability, not expanding the envelope.',
      items:[
        point('Loading and environmental differences from first flight recorded',AIRCRAFT_SOURCE),
        point('Takeoff RPM compared with first flight',ROTAX_SOURCE+'; '+PROP_SOURCE),
        point('Takeoff / climb oil pressure compared with first flight',ROTAX_SOURCE),
        point('Takeoff / climb fuel pressure compared with first flight',ROTAX_SOURCE),
        point('Climb oil / coolant / CHT temperatures compared with first flight',ROTAX_SOURCE),
        point('Cruise RPM / speed / temperatures compared with first flight',ROTAX_SOURCE),
        point('Vibration and engine smoothness compared with first flight',AIRCRAFT_SOURCE),
        point('Approach / landing behavior compared with first flight',AIRCRAFT_SOURCE),
        point('Post-flight inspection findings compared with first flight',AIRCRAFT_SOURCE)
      ]
    },
    cooling:{
      title:'912 Conversion — Cooling / Progressive Climb Validation',
      conditions:'Record OAT, loading, propeller configuration and cooling-system configuration. Use a planned progressive test rather than immediately demanding the longest climb.',
      notes:'Record time-based temperature and pressure data. Stop/level as required by the applicable limits and preflight test plan.',
      items:[
        point('Baseline stabilized indications before takeoff recorded',ROTAX_SOURCE),
        point('Takeoff RPM / climb airspeed / climb power configuration recorded',ROTAX_SOURCE+'; '+PROP_SOURCE),
        point('1-minute climb: oil pressure / oil temp / coolant or CHT / fuel pressure',ROTAX_SOURCE),
        point('2-minute climb: oil pressure / oil temp / coolant or CHT / fuel pressure',ROTAX_SOURCE),
        point('3-minute climb: oil pressure / oil temp / coolant or CHT / fuel pressure',ROTAX_SOURCE),
        point('5-minute or planned endpoint: all engine indications recorded',ROTAX_SOURCE,'Use only if permitted by the test plan and indications remain satisfactory.'),
        point('Level-off temperature recovery time recorded',AIRCRAFT_SOURCE),
        point('Hot-engine fuel pressure and oil pressure behavior recorded',ROTAX_SOURCE),
        point('Post-flight coolant / oil quantity and leak inspection recorded',AIRCRAFT_SOURCE)
      ]
    },
    cruise:{
      title:'912 Conversion — Cruise / Propeller Map',
      conditions:'Stable weather and loading. Record propeller configuration exactly so results remain comparable after any pitch adjustment.',
      notes:'Use discrete stabilized cruise points chosen in advance. Targets/limits must come from current engine/propeller/aircraft references.',
      items:[
        point('Configuration / loading / altitude / OAT recorded',AIRCRAFT_SOURCE),
        point('Low cruise point: RPM / IAS or TAS / GPS groundspeed / fuel flow / temps',ROTAX_SOURCE),
        point('Mid cruise point: RPM / IAS or TAS / GPS groundspeed / fuel flow / temps',ROTAX_SOURCE),
        point('Higher cruise point: RPM / IAS or TAS / GPS groundspeed / fuel flow / temps',ROTAX_SOURCE),
        point('Oil pressure and fuel pressure at each stabilized point recorded',ROTAX_SOURCE),
        point('Vibration / smoothness at each stabilized point recorded',PROP_SOURCE),
        point('Propeller setting judged against takeoff/climb/cruise objectives',PROP_SOURCE),
        point('Best practical normal cruise setting for N594ZS documented',AIRCRAFT_SOURCE)
      ]
    },
    fuel:{
      title:'912 Conversion — Fuel-System Flight Validation',
      conditions:'Record exact fuel quantity, tank/header configuration, pump configuration and ambient conditions before flight.',
      notes:'This card supplements, not replaces, required ground fuel-flow / unusable-fuel testing. Any abnormal pressure or fuel-delivery behavior is a stop condition per the test plan.',
      items:[
        point('Preflight usable-fuel / header / valve / pump configuration recorded',AIRCRAFT_SOURCE),
        point('Fuel pressure at idle / run-up recorded',ROTAX_SOURCE),
        point('Fuel pressure during takeoff recorded',ROTAX_SOURCE),
        point('Fuel pressure during sustained climb recorded',ROTAX_SOURCE),
        point('Fuel pressure in stabilized cruise recorded',ROTAX_SOURCE),
        point('Fuel pressure during normal descent / reduced-power operation recorded',ROTAX_SOURCE),
        point('Fuel quantity used versus elapsed time / expected consumption recorded',AIRCRAFT_SOURCE),
        point('Header / return-system behavior observations recorded',AIRCRAFT_SOURCE),
        point('Post-flight fuel-system leak / vent / line inspection recorded',AIRCRAFT_SOURCE)
      ]
    },
    glide:{
      title:'912 Conversion — Power Reduction / Glide / Landing Configuration',
      conditions:'Conduct only after basic engine reliability is established. Record weight, CG, propeller configuration, altitude and atmospheric conditions.',
      notes:'Purpose is to document normal reduced-power behavior with the new engine/propeller installation, not to explore an unapproved envelope.',
      items:[
        point('Idle / low-power RPM and engine smoothness recorded',ROTAX_SOURCE),
        point('Oil pressure during prolonged reduced-power operation recorded',ROTAX_SOURCE),
        point('Oil / coolant temperature trend during descent recorded',ROTAX_SOURCE),
        point('Normal power-off / low-power glide IAS and descent rate recorded',AIRCRAFT_SOURCE),
        point('Propeller drag / airframe deceleration observations recorded',AIRCRAFT_SOURCE),
        point('Throttle response after planned reduced-power period recorded',ROTAX_SOURCE),
        point('Approach power settings / RPM behavior recorded',AIRCRAFT_SOURCE),
        point('Landing / rollout engine behavior and idle quality recorded',AIRCRAFT_SOURCE)
      ]
    },
    performance:{
      title:'912 Conversion — Takeoff / Climb Performance Baseline',
      conditions:'Use a repeatable runway and record weight, CG, wind, OAT and density altitude. Performance data is aircraft-specific and should not be generalized from one flight.',
      notes:'Build a measured N594ZS baseline under documented conditions. Repeat later at different weights/conditions before treating values as representative.',
      items:[
        point('Weight / CG / fuel / wind / OAT / density altitude recorded',AIRCRAFT_SOURCE),
        point('Takeoff RPM recorded',ROTAX_SOURCE+'; '+PROP_SOURCE),
        point('Ground roll or takeoff distance observation recorded',AIRCRAFT_SOURCE),
        point('Liftoff / initial climb IAS recorded',AIRCRAFT_SOURCE),
        point('Time / altitude points for climb-rate calculation recorded',AIRCRAFT_SOURCE),
        point('Climb RPM and engine temperatures recorded',ROTAX_SOURCE),
        point('Fuel pressure during climb recorded',ROTAX_SOURCE),
        point('Observed climb rate at selected climb IAS recorded',AIRCRAFT_SOURCE),
        point('Performance compared with prior 582 configuration / previous N594ZS records',AIRCRAFT_SOURCE)
      ]
    },
    endurance:{
      title:'912 Conversion — Endurance / Heat-Soak Validation',
      conditions:'Use only after shorter flights demonstrate stable operation. Record loading, weather, propeller configuration and planned cruise setting.',
      notes:'Purpose is to confirm stability over a longer normal operating period and after heat soak.',
      items:[
        point('Preflight fluid quantities / fuel / configuration recorded',AIRCRAFT_SOURCE),
        point('Early-flight stabilized cruise indications recorded',ROTAX_SOURCE),
        point('Mid-flight cruise RPM / temps / pressures / voltage / fuel flow recorded',ROTAX_SOURCE),
        point('Late-flight cruise RPM / temps / pressures / voltage / fuel flow recorded',ROTAX_SOURCE),
        point('Hot restart / heat-soak behavior recorded if part of approved test plan',ROTAX_SOURCE),
        point('Fuel used versus elapsed time recorded',AIRCRAFT_SOURCE),
        point('Any vibration / odor / abnormal indication trend recorded',AIRCRAFT_SOURCE),
        point('Post-flight fluid quantities / leaks / hose / wiring / fastener inspection recorded',AIRCRAFT_SOURCE)
      ]
    }
  };

  window.N594ZS_912_FLIGHT_TEMPLATES=templates;

  function templateCard(key){
    const t=templates[key];if(!t)return null;
    const active=typeof activeConfiguration==='function'?activeConfiguration():null;
    return normalizeFlightCardContext({
      title:t.title,date:today(),status:'Planned',projectId:null,runId:null,
      conditions:t.conditions,notes:t.notes,items:t.items.map(x=>({...x,id:crypto.randomUUID()})),
      aircraftWeightLb:'',cgIn:'',fuelGal:active?.fuelCapacityGal||'',oat:'',wind:'',densityAltitudeFt:'',
      propConfig:'',testAltitudeFt:'',airportRunway:db.aircraft?.base||'',airframeHours:db.aircraft?.airframeHours||'',
      engineHoursStart:db.aircraft?.engineHours||'',engineHoursEnd:'',
      limitsSource:'Verify current N594ZS operating limitations, current applicable Rotax 912 ULS manuals, current IVO instructions, and any applicable FAA flight-test guidance before using this card.'
    });
  }

  window.open912FlightTemplatePicker=function(){
    const order=[
      ['ground','0','Ground / Installation Validation','Before flight: verify the new installation and collect baseline ground data.'],
      ['first','1','First Flight Basic Checkout','Engine reliability, basic controllability and conservative first-flight data.'],
      ['repeat','2','Repeatability / Second Flight','Repeat the basic profile and compare indications.'],
      ['cooling','3','Cooling / Progressive Climb','Build a time-based climb temperature and pressure record.'],
      ['cruise','4','Cruise / Propeller Map','Compare stabilized cruise points and document the installed prop setup.'],
      ['fuel','5','Fuel-System Flight Validation','Record fuel pressure and behavior through normal flight phases.'],
      ['glide','6','Power Reduction / Glide','Document reduced-power, descent and landing behavior.'],
      ['performance','7','Takeoff / Climb Performance','Build an N594ZS performance baseline under known conditions.'],
      ['endurance','8','Endurance / Heat-Soak','Confirm stable indications over a longer normal operating period.']
    ];
    openModal(`${modalHeader('912 Conversion Test Cards','Choose a structured N594ZS test card. Nothing is saved until you save the card.')}
      <div class="flight-template-grid">${order.map(([key,no,title,desc])=>`<button class="flight-template-card" onclick="new912FlightCard('${key}')"><span class="flight-template-no">${no}</span><span><b>${esc(title)}</b><small>${esc(desc)}</small></span><span class="flight-template-arrow">›</span></button>`).join('')}</div>
      <div class="notice" style="margin-top:12px">Targets deliberately cite source categories instead of hard-coded limits. Confirm the current applicable operating limitations and manufacturer documentation for N594ZS before using a card.</div>
      <div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button></div>`,true);
  };

  window.new912FlightCard=function(key){
    const f=templateCard(key);if(!f)return;
    openFlightCardModal(null,f);
  };

  function contextFields(f){
    return `<div class="flight-context-head full"><b>Test Context</b><span>Record enough configuration/environment detail to make the result repeatable.</span></div>
      ${field('Aircraft weight (lb)','fcWeight',f.aircraftWeightLb)}
      ${field('CG (in)','fcCg',f.cgIn)}
      ${field('Fuel (gal)','fcFuel',f.fuelGal)}
      ${field('OAT','fcOat',f.oat)}
      ${field('Wind','fcWind',f.wind)}
      ${field('Density altitude (ft)','fcDA',f.densityAltitudeFt)}
      ${field('Propeller configuration / pitch','fcPropConfig',f.propConfig)}
      ${field('Test altitude / block (ft)','fcTestAltitude',f.testAltitudeFt)}
      ${field('Airport / runway','fcAirport',f.airportRunway)}
      ${field('Airframe hours','fcAfHours',f.airframeHours)}
      ${field('Engine hours start','fcEngStart',f.engineHoursStart)}
      ${field('Engine hours end','fcEngEnd',f.engineHoursEnd)}
      ${textareaField('Limits / source references','fcLimitsSource',f.limitsSource)}`;
  }

  openFlightCardModal=function(id=null,prefill=null){
    const existing=id?db.flightCards.find(x=>String(x.id)===String(id)):null;
    const f=normalizeFlightCardContext(existing||prefill||{title:'',date:today(),status:'Planned',projectId:null,runId:null,conditions:'',notes:'',items:[]});
    if(!f)return;
    openModal(`${modalHeader(id?'Edit Flight-Test Card':'New Flight-Test Card')}
      <div class="form-grid">
        ${field('Card title','fcTitle',f.title)}
        ${field('Date','fcDate',f.date,'date')}
        <div><label>Status</label><select id="fcStatus">${['Planned','Ready','In Progress','Completed','Aborted'].map(x=>`<option ${f.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
        <div><label>Linked project</label><select id="fcProject">${projectOptions(f.projectId)}</select></div>
        ${contextFields(f)}
        ${textareaField('Conditions / configuration notes','fcConditions',f.conditions)}
        ${textareaField('Card notes / stop criteria / follow-up','fcNotes',f.notes)}
      </div>
      <div class="modal-actions">${id?`<button class="danger" onclick="deleteFlightCard('${esc(f.id)}')">Move to Trash</button>`:''}<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveFlightCard('${esc(f.id||'')}')">Save Card</button></div>`,true);
  };

  saveFlightCard=function(id){
    const old=id?db.flightCards.find(x=>String(x.id)===String(id)):null;
    const obj=normalizeFlightCardContext({
      ...(old||{}),id:old?.id||crypto.randomUUID(),
      title:val('fcTitle').trim()||'Flight-test card',date:val('fcDate')||today(),status:val('fcStatus')||'Planned',
      projectId:selectedNumber('fcProject'),runId:old?.runId||null,
      aircraftWeightLb:val('fcWeight'),cgIn:val('fcCg'),fuelGal:val('fcFuel'),oat:val('fcOat'),wind:val('fcWind'),
      densityAltitudeFt:val('fcDA'),propConfig:val('fcPropConfig'),testAltitudeFt:val('fcTestAltitude'),airportRunway:val('fcAirport'),
      airframeHours:val('fcAfHours'),engineHoursStart:val('fcEngStart'),engineHoursEnd:val('fcEngEnd'),limitsSource:val('fcLimitsSource'),
      conditions:val('fcConditions'),notes:val('fcNotes'),items:A(old?.items)
    });
    if(old)Object.assign(old,obj);else db.flightCards.push(obj);
    closeModal();saveDB('Flight-test card saved.');setOpsTab('flightcards');
  };

  function contextSummary(f){
    const rows=[
      ['Weight',f.aircraftWeightLb?f.aircraftWeightLb+' lb':'—'],['CG',f.cgIn?f.cgIn+' in':'—'],
      ['Fuel',f.fuelGal?f.fuelGal+' gal':'—'],['OAT',f.oat||'—'],['Wind',f.wind||'—'],
      ['Density altitude',f.densityAltitudeFt?f.densityAltitudeFt+' ft':'—'],['Prop config',f.propConfig||'—'],
      ['Test altitude',f.testAltitudeFt?f.testAltitudeFt+' ft':'—'],['Airport / runway',f.airportRunway||'—'],
      ['Airframe hours',f.airframeHours||'—'],['Engine start',f.engineHoursStart||'—'],['Engine end',f.engineHoursEnd||'—']
    ];
    return `<div class="flight-context-grid">${rows.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  }

  renderOpsFlightCards=function(){
    const box=document.getElementById('opsContent');if(!box)return;
    const rows=[...db.flightCards].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    box.innerHTML=`<div class="ops-panel">
      <div class="toolbar"><div><h2>Flight-Test Cards</h2><div class="muted">Structured test cards with repeatable aircraft/environment context, source references and linked Runs / Tests.</div></div>
        <div class="action-row"><button class="primary" onclick="open912FlightTemplatePicker()">+ 912 Conversion Template</button><button class="secondary" onclick="newFirstFlightCard()">+ Generic First Flight</button><button class="secondary" onclick="openFlightCardModal()">+ Blank Card</button></div>
      </div>
      <div class="danger-note">Organizational / data-recording aid only. Establish procedures, limitations, test area, abort criteria and target values from the current applicable sources for N594ZS.</div>
      <div class="flight-program-strip"><b>912 Conversion Program</b><span>Ground validation → first flight → repeatability → cooling → cruise/prop → fuel → reduced power → performance → endurance</span></div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Card</th><th>Status</th><th>Test points</th><th>Context</th><th>Linked run</th><th></th></tr></thead><tbody>
        ${rows.map(f=>{normalizeFlightCardContext(f);const ctx=[f.aircraftWeightLb&&f.aircraftWeightLb+' lb',f.fuelGal&&f.fuelGal+' gal',f.oat&&'OAT '+f.oat].filter(Boolean).join(' • ');return `<tr class="click-row" onclick="openFlightCardDetail('${esc(f.id)}')"><td>${esc(f.date||'—')}</td><td><b>${esc(f.title)}</b><div class="task-note">${esc(f.conditions||f.notes||'')}</div></td><td>${pill(f.status)}</td><td>${f.items.filter(x=>x.result!=='Pending').length}/${f.items.length}</td><td>${esc(ctx||'—')}</td><td>${f.runId?`<button class="linkbtn" onclick="event.stopPropagation();openRunDetail(${Number(f.runId)})">Run #${esc(f.runId)}</button>`:'—'}</td><td><button class="icon-btn" onclick="event.stopPropagation();openFlightCardModal('${esc(f.id)}')">Edit</button></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">No flight-test cards yet.</td></tr>'}
      </tbody></table></div></div>`;
  };

  openFlightCardDetail=function(id){
    const f=db.flightCards.find(x=>String(x.id)===String(id));if(!f)return;normalizeFlightCardContext(f);
    currentDetail={type:'flightcard',id};const pr=f.projectId?projectById(Number(f.projectId)):null,run=f.runId?db.runs.find(r=>Number(r.id)===Number(f.runId)):null;
    openModal(`${modalHeader(f.title,`${f.date} • ${f.status}`)}
      <div class="detail-card"><div class="section-tools"><h3>Test Context</h3><button class="icon-btn" onclick="openFlightCardModal('${esc(f.id)}')">Edit</button></div>${contextSummary(f)}
        ${f.limitsSource?`<div class="detail-section"><label>Limits / source references</label><div class="detail-text">${esc(f.limitsSource)}</div></div>`:''}
      </div>
      <div class="detail-card"><div class="section-tools"><h3>Test Points</h3><button class="primary" onclick="editFlightCardItem('${esc(f.id)}')">+ Add Test Point</button></div>
        ${f.items.length?`<div class="table-wrap"><table><thead><tr><th>Objective</th><th>Target / source</th><th>Actual</th><th>Result</th><th></th></tr></thead><tbody>${f.items.map(x=>`<tr><td><b>${esc(x.objective)}</b><div class="task-note">${esc(x.notes||'')}</div></td><td>${esc(x.target||'—')}</td><td>${esc(x.actual||'—')}</td><td>${pill(x.result)}</td><td><button class="icon-btn" onclick="editFlightCardItem('${esc(f.id)}','${esc(x.id)}')">Edit</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No test points yet.</div>'}
      </div>
      <div class="detail-grid"><div>
        <div class="detail-card"><h3>Conditions / notes</h3><div class="detail-text">${esc(f.conditions||'No conditions recorded.')}</div><div class="detail-section"><label>Notes / stop criteria / follow-up</label><div class="detail-text">${esc(f.notes||'No notes.')}</div></div></div>
        <div class="detail-card"><div class="section-tools"><h3>Photos / Files</h3><button class="icon-btn" onclick="chooseAttachments('flightcard','${esc(f.id)}')">+ Upload</button></div><div id="attachments-flightcard-${esc(f.id)}"></div></div>
      </div><div>
        <div class="detail-card"><h3>Links</h3>${pr?`<div class="kv click-row" onclick="openProjectDetail(${pr.id})"><span>Project</span><b>${esc(pr.title)}</b></div>`:'<div class="kv"><span>Project</span><b>Not linked</b></div>'}
          ${run?`<div class="kv click-row" onclick="openRunDetail(${run.id})"><span>Run / test</span><b>${esc(run.date)} • ${esc(run.type)}</b></div>`:'<div class="kv"><span>Run / test</span><b>Not linked</b></div>'}
          <div class="action-row" style="margin-top:10px"><button class="secondary" onclick="openFlightCardModal('${esc(f.id)}')">Edit Card</button>${!run?`<button class="primary" onclick="createRunFromFlightCard('${esc(f.id)}')">Create Flight-Test Run</button>`:''}</div>
        </div>
      </div></div>`,true);
    renderAttachments('flightcard',id);
  };

  const createRunFromFlightCardBase=createRunFromFlightCard;
  createRunFromFlightCard=function(cardId){
    const f=db.flightCards.find(x=>String(x.id)===String(cardId));if(!f)return;
    createRunFromFlightCardBase(cardId);
    const run=f.runId?db.runs.find(r=>Number(r.id)===Number(f.runId)):null;
    if(run){
      if(f.engineHoursStart)run.tachStart=f.engineHoursStart;
      run.notes=[run.notes,
        ['Weight '+f.aircraftWeightLb+' lb', 'CG '+f.cgIn+' in', 'Fuel '+f.fuelGal+' gal', 'OAT '+f.oat, 'DA '+f.densityAltitudeFt+' ft', 'Prop '+f.propConfig].filter(x=>!/ (?:lb|in|gal|ft)$/.test(x)&&!x.endsWith('Prop ')).join(' • ')
      ].filter(Boolean).join('\n');
      saveDB();
    }
  };

  const style=document.createElement('style');
  style.id='n594zsFlightProgramStyle';
  style.textContent=`
    .flight-template-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .flight-template-card{appearance:none;display:grid;grid-template-columns:34px minmax(0,1fr) 18px;gap:10px;align-items:center;text-align:left;border:1px solid var(--line);border-radius:10px;background:#fff;padding:12px;color:var(--text);cursor:pointer}
    .flight-template-card:hover{background:#f7fbff;border-color:#aacce9}.flight-template-card span:nth-child(2){display:flex;flex-direction:column;gap:3px}.flight-template-card small{color:var(--muted);line-height:1.3}
    .flight-template-no{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:var(--blue2);color:var(--blue);font-weight:850}.flight-template-arrow{font-size:20px;color:var(--muted)}
    .flight-context-head{margin:8px 0 0;padding-top:10px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:2px}.flight-context-head span{font-size:11px;color:var(--muted)}
    .flight-context-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.flight-context-grid>div{border:1px solid var(--line);border-radius:8px;padding:9px;background:#f8fafc}.flight-context-grid span{display:block;font-size:10px;color:var(--muted)}.flight-context-grid b{display:block;margin-top:2px}
    .flight-program-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:#f8fafc}.flight-program-strip span{font-size:11px;color:var(--muted)}
    @media(max-width:760px){.flight-template-grid{grid-template-columns:1fr}.flight-context-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
})();
