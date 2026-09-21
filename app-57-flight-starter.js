'use strict';
// ---------- V5.12.2 FLIGHT-TEST STARTER PROGRAM ----------
// Seeds a conservative, editable 912-conversion starter card set once, then
// renders the Flight Cards workspace using the normal tracker card records.

(function(){
  if(window.__n594zsFlightStarterInstalled)return;
  window.__n594zsFlightStarterInstalled=true;

  const A=v=>Array.isArray(v)?v:[];
  const point=(objective,target='',notes='')=>({id:crypto.randomUUID(),objective,target,actual:'',result:'Pending',notes});
  const ROTAX='Current applicable Rotax 912 ULS documentation / limits for this engine and installation';
  const AIRCRAFT='N594ZS operating limitations, aircraft records, and pilot-established flight-test plan';
  const PROP='Current applicable IVO propeller instructions and installed propeller configuration';

  const starterDefs=[
    {
      title:'0 — 912 Ground / Installation Validation',
      conditions:'Complete before flight. Record installed configuration, fuel load, ambient conditions and engine hours.',
      notes:'Ground validation / discrepancy capture before the first flight.',
      items:[
        point('Oil-system preparation / purge status verified',ROTAX),
        point('Cooling system serviced, purged and leak-free',ROTAX),
        point('Fuel-system leak and delivery / flow verification completed',AIRCRAFT),
        point('Throttle, choke and engine controls full-travel / security check',ROTAX),
        point('Propeller installation, tracking, hardware and configuration verified',PROP),
        point('Initial start oil-pressure response recorded',ROTAX),
        point('Ignition / run-up behavior recorded',ROTAX),
        point('Static full-power RPM recorded',ROTAX+'; '+PROP),
        point('Fuel pressure through idle, run-up and high-power ground operation recorded',ROTAX),
        point('Oil / coolant temperatures and charging voltage recorded during ground run',ROTAX),
        point('Post-run inspection for oil, coolant, fuel leaks, chafe and looseness',AIRCRAFT)
      ]
    },
    {
      title:'1 — 912 First Flight Basic Checkout',
      conditions:'Conservative first-flight configuration. Record loading, weather, runway, engine hours and propeller configuration.',
      notes:'Primary objective is basic engine-installation reliability and aircraft controllability. Use pre-established limits and abort criteria.',
      items:[
        point('Preflight configuration / loading / test conditions recorded',AIRCRAFT),
        point('Takeoff RPM and acceleration observations recorded',ROTAX+'; '+PROP),
        point('Oil pressure immediately after takeoff power application recorded',ROTAX),
        point('Fuel pressure during takeoff and initial climb recorded',ROTAX),
        point('Oil temperature and coolant / CHT behavior during initial climb recorded',ROTAX),
        point('Charging voltage / electrical behavior in flight recorded',AIRCRAFT),
        point('Engine smoothness / vibration / throttle response observations recorded',ROTAX),
        point('Basic trim and control-feel observations in level flight',AIRCRAFT),
        point('Conservative cruise engine indications recorded',ROTAX),
        point('Approach / landing engine behavior recorded',AIRCRAFT),
        point('Post-flight cowling-off inspection completed',AIRCRAFT)
      ]
    },
    {
      title:'2 — 912 Repeatability / Second Flight',
      conditions:'Repeat the basic first-flight configuration as closely as practical after resolving any discrepancies.',
      notes:'The purpose is repeatability, not envelope expansion.',
      items:[
        point('Loading and environmental differences from first flight recorded',AIRCRAFT),
        point('Takeoff RPM compared with first flight',ROTAX+'; '+PROP),
        point('Takeoff / climb oil pressure compared with first flight',ROTAX),
        point('Takeoff / climb fuel pressure compared with first flight',ROTAX),
        point('Climb oil / coolant / CHT temperatures compared with first flight',ROTAX),
        point('Cruise RPM / speed / temperatures compared with first flight',ROTAX),
        point('Vibration and engine smoothness compared with first flight',AIRCRAFT),
        point('Approach / landing behavior compared with first flight',AIRCRAFT),
        point('Post-flight inspection findings recorded',AIRCRAFT)
      ]
    },
    {
      title:'3 — 912 Cooling / Progressive Climb Validation',
      conditions:'Record OAT, loading, propeller and cooling-system configuration. Use a planned progressive climb test.',
      notes:'Record time-based temperature and pressure data; use current applicable limits and stop criteria.',
      items:[
        point('Baseline stabilized indications before takeoff recorded',ROTAX),
        point('Takeoff RPM / climb airspeed / climb power configuration recorded',ROTAX+'; '+PROP),
        point('1-minute climb: oil pressure / oil temp / coolant or CHT / fuel pressure',ROTAX),
        point('2-minute climb: oil pressure / oil temp / coolant or CHT / fuel pressure',ROTAX),
        point('3-minute climb: oil pressure / oil temp / coolant or CHT / fuel pressure',ROTAX),
        point('Planned endpoint: all engine indications recorded',ROTAX),
        point('Level-off temperature recovery time recorded',AIRCRAFT),
        point('Hot-engine fuel pressure and oil pressure behavior recorded',ROTAX),
        point('Post-flight coolant / oil quantity and leak inspection recorded',AIRCRAFT)
      ]
    },
    {
      title:'4 — 912 Cruise / Propeller Map',
      conditions:'Stable weather and loading. Record propeller configuration exactly so results remain comparable.',
      notes:'Use discrete stabilized cruise points selected in advance.',
      items:[
        point('Configuration / loading / altitude / OAT recorded',AIRCRAFT),
        point('Low cruise point: RPM / IAS or TAS / GPS speed / fuel flow / temps',ROTAX),
        point('Mid cruise point: RPM / IAS or TAS / GPS speed / fuel flow / temps',ROTAX),
        point('Higher cruise point: RPM / IAS or TAS / GPS speed / fuel flow / temps',ROTAX),
        point('Oil pressure and fuel pressure at each stabilized point recorded',ROTAX),
        point('Vibration / smoothness at each stabilized point recorded',PROP),
        point('Propeller setting compared with takeoff / climb / cruise objectives',PROP),
        point('Preferred normal cruise setting documented',AIRCRAFT)
      ]
    },
    {
      title:'5 — 912 Fuel-System Flight Validation',
      conditions:'Record exact fuel quantity, tank/header configuration, pump configuration and ambient conditions.',
      notes:'Supplements required ground fuel-system testing; abnormal delivery or pressure behavior requires follow-up.',
      items:[
        point('Preflight usable-fuel / header / valve / pump configuration recorded',AIRCRAFT),
        point('Fuel pressure at idle / run-up recorded',ROTAX),
        point('Fuel pressure during takeoff recorded',ROTAX),
        point('Fuel pressure during sustained climb recorded',ROTAX),
        point('Fuel pressure in stabilized cruise recorded',ROTAX),
        point('Fuel pressure during normal descent / reduced-power operation recorded',ROTAX),
        point('Fuel quantity used versus elapsed time recorded',AIRCRAFT),
        point('Header / return-system behavior observations recorded',AIRCRAFT),
        point('Post-flight fuel-system leak / vent / line inspection recorded',AIRCRAFT)
      ]
    },
    {
      title:'6 — 912 Power Reduction / Glide / Landing',
      conditions:'Conduct after basic engine reliability is established. Record loading, propeller configuration and atmospheric conditions.',
      notes:'Documents normal reduced-power behavior with the new engine / propeller installation.',
      items:[
        point('Idle / low-power RPM and engine smoothness recorded',ROTAX),
        point('Oil pressure during prolonged reduced-power operation recorded',ROTAX),
        point('Oil / coolant temperature trend during descent recorded',ROTAX),
        point('Normal low-power glide IAS and descent rate recorded',AIRCRAFT),
        point('Propeller drag / airframe deceleration observations recorded',AIRCRAFT),
        point('Throttle response after planned reduced-power period recorded',ROTAX),
        point('Approach power settings / RPM behavior recorded',AIRCRAFT),
        point('Landing / rollout engine behavior and idle quality recorded',AIRCRAFT)
      ]
    },
    {
      title:'7 — 912 Takeoff / Climb Performance Baseline',
      conditions:'Use repeatable conditions and record weight, CG, wind, OAT and density altitude.',
      notes:'Build a measured N594ZS baseline under documented conditions.',
      items:[
        point('Weight / CG / fuel / wind / OAT / density altitude recorded',AIRCRAFT),
        point('Takeoff RPM recorded',ROTAX+'; '+PROP),
        point('Ground roll or takeoff-distance observation recorded',AIRCRAFT),
        point('Liftoff / initial climb IAS recorded',AIRCRAFT),
        point('Time / altitude points for climb-rate calculation recorded',AIRCRAFT),
        point('Climb RPM and engine temperatures recorded',ROTAX),
        point('Fuel pressure during climb recorded',ROTAX),
        point('Observed climb rate at selected climb IAS recorded',AIRCRAFT),
        point('Results compared with previous N594ZS records',AIRCRAFT)
      ]
    },
    {
      title:'8 — 912 Endurance / Heat-Soak Validation',
      conditions:'Use after shorter flights demonstrate stable operation. Record loading, weather, propeller configuration and cruise setting.',
      notes:'Confirms stable indications over a longer normal operating period.',
      items:[
        point('Preflight fluid quantities / fuel / configuration recorded',AIRCRAFT),
        point('Early-flight stabilized cruise indications recorded',ROTAX),
        point('Mid-flight cruise RPM / temps / pressures / voltage / fuel flow recorded',ROTAX),
        point('Late-flight cruise RPM / temps / pressures / voltage / fuel flow recorded',ROTAX),
        point('Hot restart / heat-soak behavior recorded if included in the test plan',ROTAX),
        point('Fuel used versus elapsed time recorded',AIRCRAFT),
        point('Any vibration / odor / abnormal indication trend recorded',AIRCRAFT),
        point('Post-flight fluid quantities / leaks / hose / wiring / fastener inspection recorded',AIRCRAFT)
      ]
    }
  ];

  function makeStarter(def){
    return {
      id:crypto.randomUUID(),title:def.title,date:'',status:'Planned',projectId:null,runId:null,
      conditions:def.conditions,notes:def.notes,items:def.items.map(x=>({...x,id:crypto.randomUUID()})),
      starter912:true
    };
  }

  function ensureStarterCards(){
    db.settings=db.settings||{};
    // If the cloud workspace is genuinely empty, always seed it. Do not let a
    // stale "already seeded" flag suppress the cards after cloud state replaces
    // an earlier local render.
    if(A(db.flightCards).length){
      db.settings.flightTestStarter912V1=true;
      return false;
    }
    db.flightCards=starterDefs.map(makeStarter);
    db.settings.flightTestStarter912V1=true;
    saveDB('912 conversion starter flight-test cards added.');
    return true;
  }

  window.add912StarterFlightCards=function(){
    const existing=new Set(A(db.flightCards).map(x=>String(x.title||'').replace(/^\d+\s*[—-]\s*/,'').toLowerCase()));
    let added=0;
    for(const d of starterDefs){
      const key=d.title.replace(/^\d+\s*[—-]\s*/,'').toLowerCase();
      if(existing.has(key))continue;
      db.flightCards.push(makeStarter(d));added++;
    }
    db.settings=db.settings||{};db.settings.flightTestStarter912V1=true;
    saveDB(added?added+' starter flight-test card'+(added===1?'':'s')+' added.':'Starter cards are already present.');
    setOpsTab('flightcards');
  };

  window.renderFlightCardsStarter=function(){
    const box=document.getElementById('opsContent');if(!box)return;
    ensureStarterCards();
    const rows=[...A(db.flightCards)].sort((a,b)=>{
      const an=String(a.title||'').match(/^(\d+)/),bn=String(b.title||'').match(/^(\d+)/);
      if(an&&bn)return Number(an[1])-Number(bn[1]);
      if(an)return -1;if(bn)return 1;
      return String(b.date||'').localeCompare(String(a.date||''));
    });
    box.innerHTML=`<div class="ops-panel">
      <div class="toolbar"><div><h2>Flight-Test Cards</h2><div class="muted">A starter 912-conversion test sequence you can edit, add to, link to Runs / Tests, or replace with your own cards.</div></div>
        <div class="action-row"><button class="secondary" onclick="add912StarterFlightCards()">Restore 912 Starter Cards</button><button class="primary" onclick="openFlightCardModal()">+ Blank Card</button></div>
      </div>
      <div class="danger-note">Organizational / data-recording aid only. Establish procedures, operating limits, test area, abort criteria and target values from the current applicable sources for N594ZS.</div>
      <div class="flight-program-strip"><b>912 Conversion Program</b><span>Ground validation → first flight → repeatability → cooling → cruise / prop → fuel → reduced power → performance → endurance</span></div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Seq.</th><th>Card</th><th>Status</th><th>Test points</th><th>Linked run</th><th></th></tr></thead><tbody>
        ${rows.map(f=>{const m=String(f.title||'').match(/^(\d+)/);return `<tr class="click-row" onclick="openFlightCardDetail('${esc(f.id)}')"><td><b>${m?esc(m[1]):'—'}</b></td><td><b>${esc(f.title)}</b><div class="task-note">${esc(f.conditions||f.notes||'')}</div></td><td>${pill(f.status)}</td><td>${A(f.items).filter(x=>x.result!=='Pending').length}/${A(f.items).length}</td><td>${f.runId?`<button class="linkbtn" onclick="event.stopPropagation();openRunDetail(${Number(f.runId)})">Run #${esc(f.runId)}</button>`:'—'}</td><td><button class="icon-btn" onclick="event.stopPropagation();openFlightCardModal('${esc(f.id)}')">Edit</button></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">No flight-test cards yet.</td></tr>'}
      </tbody></table></div>
    </div>`;
  };

  // Keep compatibility with the legacy Ops renderer, but Aircraft Ops stable
  // also calls renderFlightCardsStarter explicitly so this cannot be shadowed
  // by an older function declaration.
  window.renderOpsFlightCards=window.renderFlightCardsStarter;

  const style=document.createElement('style');
  style.id='flightStarterProgramStyle';
  style.textContent=`
    .flight-program-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:#f8fafc}
    .flight-program-strip span{font-size:11px;color:var(--muted)}
    .flight-target-source{max-width:520px;min-width:260px;font-size:12px;line-height:1.35;color:var(--muted);overflow-wrap:anywhere}
    @media(max-width:760px){.flight-target-source{min-width:220px;max-width:320px}}
  `;
  document.head.appendChild(style);
})();