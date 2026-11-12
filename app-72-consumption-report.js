'use strict';
// v5.19.75 — read-only, date-range Parts & Consumables report.
// Source of truth: dated Work Log consumedParts only. Never add project.partsUsed,
// purchases, or inventory reservations to these totals: they can represent the
// same physical consumption and would otherwise double count it.
(function(){
  if(window.N594ZSConsumptionReport)return;

  const A = value=>Array.isArray(value)?value:[];
  const str = value=>String(value==null?'':value);
  const html = value=>str(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const cash = value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
  const pad = n=>String(n).padStart(2,'0');
  const localDate = date=>date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate());
  const dateOnly = value=>str(value).slice(0,10);
  const validDate = value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T12:00:00').getTime());
  const norm = value=>str(value).trim().toLowerCase();

  function collect(data, options){
    const parts = new Map(A(data&&data.parts).map(p=>[str(p.id),p]));
    const projects = new Map(A(data&&data.projects).map(p=>[str(p.id),p]));
    const start = options&&options.start||'0000-01-01';
    const end = options&&options.end||'9999-12-31';
    const requestedSystem = options&&options.system||'all';
    const result = {rows:[],undated:0,invalidQty:0,source:'Work Log consumedParts'};
    for(const log of A(data&&data.logs)){
      const items = A(log.consumedParts);
      if(!items.length)continue;
      const date = dateOnly(log.date);
      if(!validDate(date)){result.undated+=items.length;continue;}
      if(date<start||date>end)continue;
      const linked = A(log.projectIds).map(id=>projects.get(str(id))).filter(Boolean);
      const projectNames = linked.map(p=>str(p.title||'Unnamed project'));
      const projectIds = A(log.projectIds).map(str).sort();
      const projectName = projectNames.length?projectNames.join(' / '):'Unassigned';
      const uniqueProjectSystems = [...new Set(linked.map(p=>str(p.system).trim()).filter(Boolean))];
      for(let index=0;index<items.length;index++){
        const item=items[index]||{};
        const qty=Number(item.qty);
        if(!Number.isFinite(qty)||qty===0){result.invalidQty++;continue;}
        const part = parts.get(str(item.partId));
        const system=str(log.system).trim()||(uniqueProjectSystems.length===1?uniqueProjectSystems[0]:'')||str(part&&part.system).trim()||'Unassigned';
        if(requestedSystem!=='all'&&system!==requestedSystem)continue;
        const name=str(item.name||part&&part.name||'Unnamed part / material');
        const unit=str(item.unit||part&&part.unit||'ea');
        const rawCost=item.unitCost;
        const priced=rawCost!==''&&rawCost!==null&&rawCost!==undefined&&Number.isFinite(Number(rawCost));
        const unitCost=priced?Number(rawCost):null;
        const logId=str(log.id);
        result.rows.push({
          date,system,project:projectName,projectKey:projectIds.length?projectIds.join('|'):'unassigned',
          partId:str(item.partId),name,unit,qty,unitCost,
          extendedCost:priced?qty*unitCost:null,costKnown:priced,
          logId,logWork:str(log.work),itemId:str(item.id||index),
          notes:str(item.notes)
        });
      }
    }
    result.rows.sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name)||a.logId.localeCompare(b.logId));
    return result;
  }

  function aggregate(rows, mode){
    const kind=['part','project','date'].includes(mode)?mode:'part';
    const groups=new Map();
    for(const row of A(rows)){
      const key=kind==='date'?'date|'+row.date:kind==='project'?'project|'+row.projectKey:
        'part|'+(row.partId?'id:'+row.partId:'name:'+norm(row.name))+'|'+norm(row.unit);
      let group=groups.get(key);
      if(!group){
        group={key,label:kind==='date'?row.date:kind==='project'?row.project:row.name,
          unit:kind==='part'?row.unit:'',qty:0,cost:0,missing:0,entries:[]};
        groups.set(key,group);
      }
      group.entries.push(row);
      if(kind==='part')group.qty+=row.qty;
      if(row.costKnown)group.cost+=row.extendedCost;
      else group.missing++;
    }
    return [...groups.values()].sort((a,b)=>kind==='date'?b.label.localeCompare(a.label):a.label.localeCompare(b.label));
  }

  const summary = rows=>({
    entries:rows.length,
    logs:new Set(rows.map(r=>r.logId)).size,
    knownCost:rows.reduce((s,r)=>s+(r.costKnown?r.extendedCost:0),0),
    missing:rows.filter(r=>!r.costKnown).length
  });

  // Prefix spreadsheet formula-like text to prevent execution on CSV open.
  function cell(value,textual=true){
    let valueString=str(value);
    if(textual&&/^[\s]*[=+@-]/.test(valueString))valueString="'"+valueString;
    return '"'+valueString.replace(/"/g,'""')+'"';
  }
  function csv(rows){
    const head=['Date','System','Project','Part / Consumable','Part ID','Quantity','Unit','Unit Cost (recorded)','Extended Cost (recorded)','Work Log ID','Work Performed','Notes'];
    const data=A(rows).map(r=>[
      cell(r.date),cell(r.system),cell(r.project),cell(r.name),cell(r.partId),
      cell(r.qty,false),cell(r.unit),cell(r.costKnown?r.unitCost:'',false),
      cell(r.costKnown?r.extendedCost:'',false),cell(r.logId),cell(r.logWork),cell(r.notes)
    ].join(','));
    return '\uFEFF'+[head.map(v=>cell(v)).join(','),...data].join('\r\n')+'\r\n';
  }

  let last={rows:[],groups:[],options:null,skipped:null};
  function readOptions(){
    const root=document.getElementById('consumptionReportPanel');
    const find=id=>root&&root.querySelector('#'+id);
    return {start:find('crStart')?.value||'',end:find('crEnd')?.value||'',
      system:find('crSystem')?.value||'all',group:find('crGroup')?.value||'part'};
  }
  function costLabel(total,missing){
    return (missing&&total===0?'No priced entries':cash(total))+
      (missing?' ('+missing+' unpriced)':'');
  }
  function run(){
    const box=document.getElementById('consumptionReportResults');
    if(!box)return;
    const opts=readOptions();
    if((opts.start&&!validDate(opts.start))||(opts.end&&!validDate(opts.end))||
       (opts.start&&opts.end&&opts.start>opts.end)){
      box.innerHTML='<div class="notice">Choose a valid date range; the start must be on or before the end.</div>';
      last={rows:[],groups:[],options:null,skipped:null};return;
    }
    const found=collect(db,opts),groups=aggregate(found.rows,opts.group),s=summary(found.rows);
    last={rows:found.rows,groups,options:opts,skipped:found};
    const quantityLabel=opts.group==='part'?'Quantity used':'Entries';
    box.innerHTML=
      '<div class="report-summary">'+
      '<div><span>Consumption entries</span><b>'+s.entries+'</b></div>'+
      '<div><span>Work Logs</span><b>'+s.logs+'</b></div>'+
      '<div><span>Known material cost</span><b>'+html(cash(s.knownCost))+'</b></div>'+
      '<div><span>Unpriced entries</span><b>'+s.missing+'</b></div></div>'+
      '<div class="tiny muted" style="margin:10px 0">Date is the Work Log date. Only Work Log consumed items count; no purchases, reservations or Project Parts Used are added. '+
      'Cost totals include recorded unit costs only'+(s.missing?'; '+s.missing+' entries lack a recorded cost.':'')+
      (found.undated?' '+found.undated+' undated consumption items are excluded.':'')+
      (found.invalidQty?' '+found.invalidQty+' items with invalid/zero quantities are excluded.':'')+
      '</div>'+
      '<div class="table-wrap"><table><thead><tr><th>'+html(opts.group==='part'?'Part / Consumable':opts.group==='date'?'Date':'Project')+
      '</th><th>'+quantityLabel+'</th><th>Work Logs</th><th>Known cost</th><th></th></tr></thead><tbody>'+
      (groups.map((g,i)=>'<tr class="click-row" tabindex="0" data-cr-group="'+i+'">'+
        '<td><b>'+html(g.label)+'</b></td>'+
        '<td>'+html(opts.group==='part'?String(Number(g.qty.toFixed(6)))+' '+g.unit:String(g.entries.length))+'</td>'+
        '<td>'+new Set(g.entries.map(e=>e.logId)).size+'</td>'+
        '<td>'+html(costLabel(g.cost,g.missing))+'</td>'+
        '<td><button class="icon-btn" data-cr-group="'+i+'" type="button">Details</button></td></tr>').join('')||
      '<tr><td colspan="5" class="empty">No Work Log consumption matches this date range and system.</td></tr>')+
      '</tbody></table></div>';
    box.querySelectorAll('[data-cr-group]').forEach(el=>{
      el.addEventListener('click',ev=>{ev.stopPropagation();openGroup(Number(el.dataset.crGroup));});
      if(el.tagName==='TR')el.addEventListener('keydown',ev=>{
        if(ev.target!==el)return;
        if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openGroup(Number(el.dataset.crGroup));}
      });
    });
  }

  function openGroup(index){
    const group=last.groups[index];if(!group)return;
    const rows=group.entries;
    const body='<div class="tiny muted">'+rows.length+' consumption entry/entries; '+html(costLabel(group.cost,group.missing))+
      '. Open a Work Log to review the original consumption record.</div>'+
      '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Part</th><th>Qty</th><th>Project</th><th>Cost</th><th></th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+html(r.date)+'</td><td><b>'+html(r.name)+'</b></td>'+
        '<td>'+html(r.qty+' '+r.unit)+'</td><td>'+html(r.project)+'</td>'+
        '<td>'+html(r.costKnown?cash(r.extendedCost):'Not recorded')+'</td>'+
        '<td><button type="button" class="linkbtn" data-cr-log="'+html(r.logId)+'">Open Work Log</button></td></tr>').join('')+
      '</tbody></table></div>';
    openModal(modalHeader('Consumption details',group.label)+body,true);
    document.querySelectorAll('#modalBox [data-cr-log]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.getAttribute('data-cr-log');
      if(typeof openLogDetail==='function')openLogDetail(id);
    }));
  }

  function exportCSV(){
    if(!last.options)run();
    if(!last.options)return;
    const text=csv(last.rows),blob=new Blob([text],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;
    a.download='N594ZS-consumables-'+(last.options.start||'all')+'-to-'+(last.options.end||'all')+'.csv';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function printReport(){
    if(!last.options)run();
    if(!last.options)return;
    const opts=last.options,groups=last.groups,s=summary(last.rows);
    const header='<tr><th>Date</th><th>Part / consumable</th><th>Quantity</th><th>System</th><th>Project</th><th>Recorded cost</th><th>Work Log ID</th></tr>';
    const detail=last.rows.map(r=>'<tr><td>'+html(r.date)+'</td><td>'+html(r.name)+'</td><td>'+html(r.qty+' '+r.unit)+
      '</td><td>'+html(r.system)+'</td><td>'+html(r.project)+'</td><td>'+
      html(r.costKnown?cash(r.extendedCost):'Not recorded')+'</td><td>'+html(r.logId)+'</td></tr>').join('');
    const gRows=groups.map(g=>'<tr><td>'+html(g.label)+'</td><td>'+html(opts.group==='part'?String(g.qty)+' '+g.unit:g.entries.length+' entries')+
      '</td><td>'+new Set(g.entries.map(r=>r.logId)).size+'</td><td>'+html(costLabel(g.cost,g.missing))+'</td></tr>').join('');
    const markup='<!doctype html><html><head><meta charset="utf-8"><title>N594ZS Parts & Consumables</title>'+
      '<style>@page{size:Letter;margin:.6in}body{font:10pt Arial,sans-serif;color:#17212b}h1{font-size:19pt}h2{font-size:12pt;margin-top:24px}'+
      'table{border-collapse:collapse;width:100%;font-size:9pt}th,td{border:1px solid #ccd3db;padding:5px;text-align:left;overflow-wrap:anywhere}'+
      'th{background:#edf2f6}tr{break-inside:avoid}.muted{color:#596777;font-size:9pt}.small{font-size:8pt}</style></head><body>'+
      '<h1>N594ZS — Parts & Consumables Used</h1><p>Work Log dates: '+html(opts.start||'Any')+' through '+html(opts.end||'Any')+
      ' | System: '+html(opts.system==='all'?'All':opts.system)+' | Grouped by: '+html(opts.group)+'</p>'+
      '<p><b>'+s.entries+' consumption entries</b> across '+s.logs+' Work Logs. Known material cost: <b>'+html(cash(s.knownCost))+
      '</b>. Unpriced entries: '+s.missing+'.</p>'+
      '<h2>Grouped totals</h2><table><thead><tr><th>Group</th><th>Quantity / Entries</th><th>Work Logs</th><th>Known cost</th></tr></thead><tbody>'+gRows+'</tbody></table>'+
      '<h2>Individual consumption records</h2><table><thead>'+header+'</thead><tbody>'+detail+'</tbody></table>'+
      '<p class="muted">Source: Work Log consumed items only. Project Parts Used, orders and purchases are not added. Costs without a recorded unit price are excluded from the known subtotal. '+
      (last.skipped&&last.skipped.undated?'Undated items excluded: '+last.skipped.undated+'. ':'')+
      'This is an inventory-usage summary, not a certification of aircraft maintenance.</p></body></html>';
    const popup=window.open('','_blank');
    if(!popup)return alert('Allow pop-ups to print or save the usage report as a PDF.');
    popup.document.open();popup.document.write(markup);popup.document.close();
    popup.addEventListener('load',()=>setTimeout(()=>{popup.focus();popup.print();},200));
  }

  function mount(){
    const root=document.getElementById('opsContent');
    if(!root||document.getElementById('consumptionReportPanel'))return;
    const now=new Date(),earlier=new Date(now.getFullYear(),now.getMonth(),now.getDate()-30);
    const systems=[...new Set(collect(db,{}).rows.map(r=>r.system))].sort((a,b)=>a.localeCompare(b));
    const panel=document.createElement('div');
    panel.id='consumptionReportPanel';panel.className='ops-panel';
    panel.style.marginTop='16px';
    panel.innerHTML='<div class="toolbar"><div><h2>Parts & Consumables Used</h2>'+
      '<div class="muted">Date-range usage report from actual Work Log consumption. Group, review, print or export.</div></div></div>'+
      '<div class="report-controls" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">'+
      '<label>From <input id="crStart" type="date" value="'+localDate(earlier)+'"></label>'+
      '<label>Through <input id="crEnd" type="date" value="'+localDate(now)+'"></label>'+
      '<label>System <select id="crSystem"><option value="all">All systems</option>'+
      systems.map(s=>'<option value="'+html(s)+'">'+html(s)+'</option>').join('')+'</select></label>'+
      '<label>Group by <select id="crGroup"><option value="part">Part / Consumable</option>'+
      '<option value="project">Project</option><option value="date">Date used</option></select></label>'+
      '<button class="primary" id="crRun" type="button">Generate Report</button>'+
      '<button class="secondary" id="crCSV" type="button">Export CSV</button>'+
      '<button class="secondary" id="crPrint" type="button">Print / Save PDF</button></div>'+
      '<div id="consumptionReportResults"></div>';
    root.appendChild(panel);
    panel.querySelector('#crRun').addEventListener('click',run);
    panel.querySelector('#crCSV').addEventListener('click',()=>{run();exportCSV();});
    panel.querySelector('#crPrint').addEventListener('click',()=>{run();printReport();});
    ['crStart','crEnd','crSystem','crGroup'].forEach(id=>panel.querySelector('#'+id).addEventListener('change',run));
    run();
  }

  const original=window.renderOpsReports;
  window.renderOpsReports=function(){
    if(typeof original==='function')original.apply(this,arguments);
    mount();
  };
  window.N594ZSConsumptionReport=Object.freeze({collect,aggregate,summary,csv,mount});
})();