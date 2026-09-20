'use strict';
// ---------- V5.11 WEIGHT & BALANCE POLISH ----------

(function(){
  if(window.__n594zsWBPolishInstalled)return;
  window.__n594zsWBPolishInstalled=true;

  function burnGal(){return Math.max(0,num(val('wbBurnGal')))}
  function clampBurn(){
    const fuel=Math.max(0,num(val('wbFuelGal'))),burn=Math.min(fuel,burnGal());
    const el=document.getElementById('wbBurnGal');if(el&&num(el.value)!==burn)el.value=burn;
    return burn;
  }
  function setFuel(gal){
    const max=num(wbData().fuelMaxGallons),v=Math.max(0,Math.min(max,num(gal)));
    setControl('wbFuelGal',v);clampBurn();updateWBCalculation();
  }
  window.wbSetFuel=setFuel;

  function currentLoadSnapshot(){
    return {
      pilot:val('wbPilot'),
      passenger:val('wbPassenger'),
      cargo:val('wbCargo'),
      fuel:val('wbFuelGal'),
      burn:val('wbBurnGal')
    };
  }
  function restoreLoadSnapshot(s){
    if(!s)return;
    setControl('wbPilot',s.pilot||0);
    setControl('wbPassenger',s.passenger||0);
    setControl('wbCargo',s.cargo||0);
    setControl('wbFuelGal',s.fuel||0);
    setControl('wbBurnGal',s.burn||0);
    updateWBCalculation();
  }
  window.wbChangeConfiguration=function(id){
    const snap=currentLoadSnapshot();
    wbSelectedConfigId=id;
    renderWeightBalance();
    restoreLoadSnapshot(snap);
  };
  window.wbUseHistoricalEstimate=function(){
    const wb=wbData();
    const historical=wb.configurations.find(x=>x.id==='2018-582'&&wbConfigReady(x))||wb.configurations.find(x=>x.status==='historical'&&wbConfigReady(x));
    if(!historical)return alert('No historical W&B configuration is available.');
    wbChangeConfiguration(historical.id);
  };

  function metric(label,value,sub,onclick){
    return `<button class="wb-top-metric" onclick="${onclick}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub)}</small></button>`;
  }

  function chart(takeoff,landing,c){
    const wb=wbData(),W=620,H=245,p={l:58,r:20,t:24,b:38};
    const f=num(wb.forwardLimit),a=num(wb.aftLimit),g=num(wb.maxGross),pad=Math.max(.7,(a-f)*.12);
    const x0=f-pad,x1=a+pad;
    const low=Math.max(0,Math.min(num(c.emptyWeight)||takeoff.totalWeight,takeoff.totalWeight,landing.totalWeight)-80);
    const y0=Math.floor(low/25)*25,y1=Math.ceil(g*1.04/25)*25;
    const x=v=>p.l+(v-x0)/(x1-x0)*(W-p.l-p.r),y=v=>H-p.b-(v-y0)/(y1-y0)*(H-p.t-p.b);
    const sx=x(f),sw=x(a)-sx,sy=y(g),sh=y(y0)-sy;
    const tGood=takeoff.inWeight&&takeoff.inCg&&!takeoff.fuelOver,lGood=landing.inWeight&&landing.inCg;
    const marks=[];for(let w=Math.ceil(y0/100)*100;w<=y1;w+=100)marks.push(w);
    return `<svg class="wb-envelope-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight and balance envelope">
      <rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${sw.toFixed(1)}" height="${sh.toFixed(1)}" rx="8" class="wb-chart-safe"></rect>
      ${marks.map(w=>`<line x1="${p.l}" x2="${W-p.r}" y1="${y(w).toFixed(1)}" y2="${y(w).toFixed(1)}" class="wb-chart-grid"></line><text x="${p.l-8}" y="${(y(w)+4).toFixed(1)}" text-anchor="end" class="wb-chart-label">${w}</text>`).join('')}
      <line x1="${sx.toFixed(1)}" x2="${sx.toFixed(1)}" y1="${p.t}" y2="${H-p.b}" class="wb-chart-limit"></line>
      <line x1="${(sx+sw).toFixed(1)}" x2="${(sx+sw).toFixed(1)}" y1="${p.t}" y2="${H-p.b}" class="wb-chart-limit"></line>
      <line x1="${p.l}" x2="${W-p.r}" y1="${sy.toFixed(1)}" y2="${sy.toFixed(1)}" class="wb-chart-gross"></line>
      <text x="${sx.toFixed(1)}" y="${H-12}" text-anchor="middle" class="wb-chart-label">${f.toFixed(1)} in</text>
      <text x="${(sx+sw).toFixed(1)}" y="${H-12}" text-anchor="middle" class="wb-chart-label">${a.toFixed(1)} in</text>
      <text x="${W-p.r}" y="${(sy-7).toFixed(1)}" text-anchor="end" class="wb-chart-label">Max gross ${g.toFixed(0)} lb</text>
      ${burnGal()>0?`<line x1="${x(takeoff.cg).toFixed(1)}" y1="${y(takeoff.totalWeight).toFixed(1)}" x2="${x(landing.cg).toFixed(1)}" y2="${y(landing.totalWeight).toFixed(1)}" class="wb-chart-burn-line"></line>`:''}
      <circle cx="${x(takeoff.cg).toFixed(1)}" cy="${y(takeoff.totalWeight).toFixed(1)}" r="7" class="wb-chart-point ${tGood?'good':'bad'}"></circle>
      <text x="${(x(takeoff.cg)+11).toFixed(1)}" y="${(y(takeoff.totalWeight)-9).toFixed(1)}" class="wb-chart-point-label">Takeoff</text>
      ${burnGal()>0?`<circle cx="${x(landing.cg).toFixed(1)}" cy="${y(landing.totalWeight).toFixed(1)}" r="6" class="wb-chart-point landing ${lGood?'good':'bad'}"></circle><text x="${(x(landing.cg)+11).toFixed(1)}" y="${(y(landing.totalWeight)+18).toFixed(1)}" class="wb-chart-point-label">After burn</text>`:''}
      <text x="14" y="${p.t}" class="wb-chart-axis-title">Weight (lb)</text>
      <text x="${W/2}" y="${H-2}" text-anchor="middle" class="wb-chart-axis-title">CG arm (in)</text>
    </svg>`;
  }

  window.renderWeightBalance=function(){
    const page=document.getElementById('page-weightbalance');if(!page)return;
    const wb=wbData();if(!wbSelectedConfigId)wbSelectedConfigId=wb.activeConfigId;
    const c=wbConfig(),ready=wbConfigReady(c);
    const empty=ready?`${Number(c.emptyWeight).toFixed(1)} lb @ ${wbCgForConfig(c).toFixed(2)} in`:'Pending';
    const useful=ready?`${Math.max(0,num(wb.maxGross)-num(c.emptyWeight)).toFixed(1)} lb useful load`:'Current 912 W&B needed';
    page.innerHTML=`<div class="grid wb-page wb-page-polished">
      <div class="card span-12 wb-hero">
        <div class="toolbar wb-toolbar"><div><div class="eyebrow">N594ZS LOADING</div><h1>Weight & Balance</h1><div class="muted">Build a load, preview the CG shift from fuel burn, and keep current and historical configurations together.</div></div><div class="action-row"><button class="btn secondary" onclick="openWBSetup()">Edit Limits / Stations</button><button class="btn secondary" onclick="openWBConfig('${esc(c?.id||'current-912')}')">Edit Empty W&B</button></div></div>
        <div class="wb-top-metrics">
          ${metric('Selected empty W&B',empty,useful,`openWBConfig('${esc(c?.id||'current-912')}')`)}
          ${metric('Max gross',num(wb.maxGross).toFixed(0)+' lb','Tap to edit','openWBSetup()')}
          ${metric('CG limits',num(wb.forwardLimit).toFixed(1)+' – '+num(wb.aftLimit).toFixed(1)+' in','Tap to edit','openWBSetup()')}
          ${metric('Fuel capacity',num(wb.fuelMaxGallons).toFixed(1)+' gal',num(wb.fuelLbsPerGallon).toFixed(1)+' lb/gal','openWBSetup()')}
        </div>
      </div>

      <div class="card span-8 wb-load-card">
        <div class="section-head"><div><h2>Loading</h2><div class="muted small">Results update as you type.</div></div><span class="mini-badge">${esc(c?.label||'Configuration')}</span></div>
        <div class="wb-config-row"><div><label>Empty-aircraft configuration</label><select id="wbCfgSelect" onchange="wbChangeConfiguration(this.value)">${wb.configurations.map(x=>`<option value="${esc(x.id)}" ${c?.id===x.id?'selected':''}>${esc(x.label)}${wbConfigReady(x)?` • ${Number(x.emptyWeight).toFixed(1)} lb / ${wbCgForConfig(x).toFixed(2)} in`:' • pending'}</option>`).join('')}</select></div><button class="icon-btn" onclick="openWBConfig('${esc(c?.id||'')}')">Edit</button></div>
        <div class="wb-load-grid">
          ${field('Pilot (lb)','wbPilot','0','number','min="0" step="0.1" inputmode="decimal" oninput="updateWBCalculation()"')}
          ${field('Passenger (lb)','wbPassenger','0','number','min="0" step="0.1" inputmode="decimal" oninput="updateWBCalculation()"')}
          ${field('Cargo / baggage (lb)','wbCargo','0','number','min="0" step="0.1" inputmode="decimal" oninput="updateWBCalculation()"')}
          ${field(`Takeoff fuel (gal • ${num(wb.fuelLbsPerGallon).toFixed(1)} lb/gal)`,'wbFuelGal','0','number',`min="0" step="0.1" max="${esc(wb.fuelMaxGallons)}" inputmode="decimal" oninput="updateWBCalculation()"`)}
          ${field('Planned fuel burn (gal)','wbBurnGal','0','number',`min="0" step="0.1" max="${esc(wb.fuelMaxGallons)}" inputmode="decimal" oninput="updateWBCalculation()"`)}
        </div>
        <div class="wb-fuel-shortcuts"><span>Fuel shortcuts</span><button onclick="wbSetFuel(0)">Empty</button><button onclick="wbSetFuel(${num(wb.fuelMaxGallons)/2})">½ tank</button><button onclick="wbSetFuel(${num(wb.fuelMaxGallons)})">Full fuel</button></div>
        <div id="wbResults"></div>
        <div class="action-row wb-actions"><button class="btn primary" onclick="saveWBScenario()">Save Scenario</button><button class="btn secondary" onclick="clearWBInputs()">Clear Loading</button></div>
      </div>

      <div class="card span-4 wb-side-card">
        <div class="section-head"><div><h2>Saved Scenarios</h2><div class="muted tiny">Tap one to load it.</div></div><span class="mini-badge">${wb.scenarios.length}</span></div>
        <div id="wbScenarioList">${renderWBScenariosHTML()}</div>
        <details class="wb-source-details"><summary>Data source & assumptions</summary><div class="wb-source-note"><b>Entered baseline:</b> max gross 1,050 lb; CG 10.2–16.0 in; pilot/passenger arm 18.3 in; fuel arm 16.5 in; cargo arm 40.5 in. The 2018 empty condition is historical. The current 912 empty W&B remains pending until the aircraft is weighed.</div></details>
      </div>
    </div>`;
    updateWBCalculation();
  };

  function wbMaxCargoFor(config,values=wbLoadValues()){
    const wb=wbData(),s=wb.stations;if(!wbConfigReady(config))return {max:0,limiter:'empty W&B pending'};
    const fuel=values.fuelGal*num(wb.fuelLbsPerGallon),baseW=num(config.emptyWeight)+values.pilot+values.passenger+fuel;
    const baseM=wbMomentForConfig(config)+values.pilot*num(s.pilot)+values.passenger*num(s.passenger)+fuel*num(s.fuel);
    const gross=Math.max(0,num(wb.maxGross)-baseW);let cg=Infinity;
    if(num(s.cargo)>num(wb.aftLimit))cg=(num(wb.aftLimit)*baseW-baseM)/(num(s.cargo)-num(wb.aftLimit));
    if(!Number.isFinite(cg))cg=gross;cg=Math.max(0,cg);
    return gross<=cg?{max:gross,limiter:'max gross weight'}:{max:cg,limiter:'aft CG limit'};
  }

  window.updateWBCalculation=function(){
    const box=document.getElementById('wbResults');if(!box)return;
    const selected=wbConfig(),wb=wbData();
    let calcConfig=selected,estimateMode=false;
    if(!wbConfigReady(calcConfig)){
      const fallback=wb.configurations.find(x=>x.id==='2018-582'&&wbConfigReady(x))||wb.configurations.find(x=>x.status==='historical'&&wbConfigReady(x));
      if(fallback){calcConfig=fallback;estimateMode=true}
      else{
        box.innerHTML=`<div class="wb-no-config wb-no-config-polished"><div class="wb-pending-icon">!</div><div><b>Loaded CG cannot be calculated yet.</b><span>${esc(selected?.label||'Current configuration')} does not have an empty weight plus empty moment/CG. Those values are required before CG can be computed.</span></div><div class="wb-pending-actions"><button class="btn primary" onclick="openWBConfig('${esc(selected?.id||'current-912')}')">Enter 912 Empty W&B</button></div></div>`;
        return;
      }
    }
    const takeoff=wbCalculate(wbLoadValues(),calcConfig);
    const burn=clampBurn(),fuel=num(val('wbFuelGal'));
    const landing=wbCalculate({...wbLoadValues(),fuelGal:Math.max(0,fuel-burn)},calcConfig);
    const maxCargo=wbMaxCargoFor(calcConfig),remaining=Math.max(0,takeoff.grossMargin);
    const warnings=[];
    if(!takeoff.inWeight)warnings.push(`${Math.abs(takeoff.grossMargin).toFixed(1)} lb over max gross`);
    if(takeoff.fwdMargin<0)warnings.push(`${Math.abs(takeoff.fwdMargin).toFixed(2)} in forward of limit`);
    if(takeoff.aftMargin<0)warnings.push(`${Math.abs(takeoff.aftMargin).toFixed(2)} in aft of limit`);
    if(takeoff.fuelOver)warnings.push(`fuel exceeds ${num(wb.fuelMaxGallons).toFixed(1)} gal capacity`);
    if(burn>0&&(!landing.inWeight||!landing.inCg))warnings.push('after-burn condition outside entered limits');
    const allGood=takeoff.inWeight&&takeoff.inCg&&!takeoff.fuelOver&&landing.inWeight&&landing.inCg;
    const primaryStatus=estimateMode?'<span class="wb-status pending">ESTIMATE USING 2018 / 582 EMPTY W&B</span>':wbStatusHTML(takeoff);
    const basisNote=estimateMode?`Planning estimate only: using ${esc(calcConfig.label||'historical configuration')} (${num(calcConfig.emptyWeight).toFixed(1)} lb @ ${wbCgForConfig(calcConfig).toFixed(2)} in) because the current 912 empty W&B is still pending.`:'Based on the currently entered aircraft data and loading.';
    box.innerHTML=`
      <div class="wb-result-head"><div>${primaryStatus}${burn>0?`<span class="wb-status ${landing.inWeight&&landing.inCg?'good':'bad'}">AFTER BURN ${landing.inWeight&&landing.inCg?'WITHIN':'OUTSIDE'} LIMITS</span>`:''}</div><span class="muted small">${warnings.length?esc(warnings.join(' • ')):basisNote}</span></div>
      ${estimateMode?`<div class="wb-estimate-note"><b>Estimated only.</b> These CG values are mathematically calculated from the known 2018 582 empty W&B, not the current 912 installation. Enter the post-912 empty weight and CG/moment to convert this to a current-aircraft calculation.</div>`:''}
      <div class="wb-metrics wb-metrics-polished">
        <div class="${takeoff.inWeight?'':'bad'}"><span>Takeoff weight</span><b>${takeoff.totalWeight.toFixed(1)} lb</b><small>${takeoff.grossMargin>=0?`${takeoff.grossMargin.toFixed(1)} lb below gross`:`${Math.abs(takeoff.grossMargin).toFixed(1)} lb over gross`}</small></div>
        <div class="${takeoff.inCg?'':'bad'}"><span>Takeoff CG</span><b>${takeoff.cg.toFixed(2)} in</b><small>${takeoff.fwdMargin.toFixed(2)} from fwd • ${takeoff.aftMargin.toFixed(2)} from aft</small></div>
        <div class="${landing.inWeight&&landing.inCg?'':'bad'}"><span>After fuel burn</span><b>${landing.totalWeight.toFixed(1)} lb</b><small>CG ${landing.cg.toFixed(2)} in • ${Math.max(0,fuel-burn).toFixed(1)} gal remaining</small></div>
        <div><span>Remaining capacity</span><b>${remaining.toFixed(1)} lb</b><small>Max cargo now ${maxCargo.max.toFixed(1)} lb • ${esc(maxCargo.limiter)}</small></div>
      </div>
      <div class="wb-envelope-panel">
        <div class="section-head"><div><h3>CG / Weight Envelope</h3><div class="muted tiny">Shaded area = currently entered max gross and CG limits.</div></div><span class="mini-badge ${allGood?'green':'red'}">${allGood?'IN LIMITS':'CHECK LOAD'}</span></div>
        ${chart(takeoff,landing,calcConfig)}
        <div class="wb-chart-legend"><span><i class="takeoff"></i>Takeoff</span>${burn>0?'<span><i class="landing"></i>After burn</span>':''}<span><i class="safe"></i>Entered envelope</span></div>
      </div>`;
  };

  const baseSaveScenario=window.saveWBScenario;
  window.saveWBScenario=function(){
    const before=wbData().scenarios.length;
    baseSaveScenario();
    if(wbData().scenarios.length>before){
      const last=wbData().scenarios[wbData().scenarios.length-1];
      last.burnGal=burnGal();saveDB();
    }
  };

  const baseLoadScenario=window.loadWBScenario;
  window.loadWBScenario=function(id){
    const s=wbData().scenarios.find(x=>x.id===id);
    baseLoadScenario(id);
    setControl('wbBurnGal',s?.burnGal||0);updateWBCalculation();
  };

  window.clearWBInputs=function(){
    ['wbPilot','wbPassenger','wbFuelGal','wbCargo','wbBurnGal'].forEach(id=>setControl(id,0));
    updateWBCalculation();
  };

  const style=document.createElement('style');
  style.id='wbPolishStyle';
  style.textContent=`
    .wb-page-polished .wb-hero{background:linear-gradient(135deg,#fff,#f5f9fc)}
    .wb-toolbar{align-items:flex-start}.wb-toolbar h1{font-size:28px}
    .wb-top-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}
    .wb-top-metric{appearance:none;border:1px solid #dce6ee;background:#fff;border-radius:10px;padding:11px 12px;text-align:left;color:inherit;cursor:pointer;min-height:76px;transition:background .12s,border-color .12s,transform .12s}
    .wb-top-metric:hover{background:#f3f8fc;border-color:#9ebdd4;transform:translateY(-1px)}
    .wb-top-metric span,.wb-top-metric small{display:block}.wb-top-metric span{font-size:9px;text-transform:uppercase;letter-spacing:.04em;font-weight:850;color:#6b7f90}.wb-top-metric b{display:block;font-size:18px;margin:4px 0;color:#17324c}.wb-top-metric small{font-size:10px;color:#7b8b98}
    .wb-load-card{overflow:hidden}.wb-config-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-bottom:12px}.wb-config-row .icon-btn{min-height:36px}
    .wb-load-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
    .wb-fuel-shortcuts{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:10px 0 2px}.wb-fuel-shortcuts>span{font-size:10px;text-transform:uppercase;font-weight:850;color:#6b7f90;margin-right:2px}.wb-fuel-shortcuts button{border:1px solid #d7e2ea;background:#f8fbfd;color:#31516b;border-radius:999px;padding:6px 10px;font-weight:750;cursor:pointer}.wb-fuel-shortcuts button:hover{background:#eef6fc}
    .wb-result-head>div{display:flex;gap:6px;flex-wrap:wrap}.wb-metrics-polished>div{background:#f8fafc}.wb-metrics-polished>div.bad{background:#fff4f3;border-color:#efc8c4}.wb-metrics-polished>div.bad b{color:#9b3834}
    .wb-envelope-panel{margin-top:13px;border:1px solid #dce6ee;border-radius:11px;padding:12px;background:#fff}.wb-envelope-chart{display:block;width:100%;height:auto;max-height:290px}.wb-chart-safe{fill:#e8f6ee;stroke:#9fd0b5;stroke-width:1}.wb-chart-grid{stroke:#e8eef3;stroke-width:1}.wb-chart-limit{stroke:#62a07c;stroke-width:1.2;stroke-dasharray:4 4}.wb-chart-gross{stroke:#c29a43;stroke-width:1.4;stroke-dasharray:5 4}.wb-chart-label,.wb-chart-axis-title,.wb-chart-point-label{font-family:inherit;fill:#698094;font-size:10px}.wb-chart-axis-title{font-weight:800}.wb-chart-point-label{font-weight:800;fill:#294a64}.wb-chart-burn-line{stroke:#7c91a3;stroke-width:2;stroke-dasharray:4 4}.wb-chart-point{stroke:#fff;stroke-width:3}.wb-chart-point.good{fill:#267e50}.wb-chart-point.bad{fill:#b74a45}.wb-chart-point.landing.good{fill:#2d7fd1}.wb-chart-legend{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;font-size:10px;color:#6d8090;margin-top:3px}.wb-chart-legend span{display:flex;align-items:center;gap:5px}.wb-chart-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}.wb-chart-legend i.takeoff{background:#267e50}.wb-chart-legend i.landing{background:#2d7fd1}.wb-chart-legend i.safe{border-radius:3px;background:#e8f6ee;border:1px solid #9fd0b5}
    .wb-source-details{margin-top:14px;border-top:1px solid #e5edf2;padding-top:11px}.wb-source-details summary{cursor:pointer;font-weight:800;color:#49657b}.wb-source-details .wb-source-note{margin-bottom:0}
    .wb-no-config-polished{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center}.wb-no-config-polished span{display:block;margin-top:3px;color:#6e7f8e}.wb-pending-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fff0c7;color:#82590f;font-weight:900;font-size:18px}.wb-pending-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:8px}.wb-estimate-note{margin-top:8px;padding:9px 11px;border-radius:8px;background:#fff9e9;color:#6f5a1a;font-size:10px;line-height:1.4;border:1px solid #ead9a4}
    @media(max-width:1000px){.wb-top-metrics{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:700px){.wb-toolbar .action-row{width:100%}.wb-toolbar .action-row .btn{flex:1}.wb-top-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.wb-top-metric{min-height:67px;padding:9px}.wb-top-metric b{font-size:16px}.wb-load-grid{grid-template-columns:1fr 1fr;gap:9px}.wb-load-grid label{font-size:9px}.wb-load-grid input{font-size:16px}.wb-no-config-polished{grid-template-columns:auto 1fr}.wb-pending-actions{grid-template-columns:1fr}.wb-pending-actions .btn{width:100%}.wb-envelope-panel{padding:9px}}
    @media(max-width:420px){.wb-load-grid{grid-template-columns:1fr}.wb-top-metric span{font-size:8px}.wb-top-metric small{font-size:9px}}
  `;
  document.head.appendChild(style);
})();