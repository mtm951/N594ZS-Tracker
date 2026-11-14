import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-72-consumption-report.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const context={window:{},Intl,Date,Number,String,Set,Map,Array,Object,RegExp};
vm.runInNewContext(source,context);
const report=context.window.N594ZSConsumptionReport;
assert.ok(report,'consumption report module did not initialize');

const data={
  parts:[{id:5,name:'Oetiker clamp',unit:'ea',system:'Engine'},{id:6,name:'Parker hose',unit:'ft',system:'Cooling'}],
  projects:[
    {id:1,title:'Oil cooler hose',system:'Engine',
     partsUsed:[{partId:5,qty:99,name:'Oetiker clamp'}]},
    {id:2,title:'Second project',system:'Fuel System'}
  ],
  logs:[
    {id:101,date:'2026-10-05',system:'Engine',projectIds:[1],
      work:'Installed hose',consumedParts:[
        {id:1001,partId:5,name:'Oetiker clamp',qty:2,unit:'ea',unitCost:1.6},
        {id:1002,partId:6,name:'Parker hose',qty:3,unit:'ft',unitCost:7}
      ]},
    {id:102,date:'2026-10-06',system:'',projectIds:[1,2],
      work:'Multiple linked projects',consumedParts:[
        {id:1003,partId:5,name:'Oetiker clamp',qty:1,unit:'ea',unitCost:''}
      ]},
    {id:103,date:'2026-10-07',system:'Fuel System',projectIds:[],
      work:'Unassigned',consumedParts:[
        {id:1004,partId:5,name:'Oetiker clamp',qty:4,unit:'ea',unitCost:'2'}
      ]},
    {id:104,date:'2026-09-30',system:'Engine',projectIds:[],consumedParts:[
      {id:1005,partId:5,name:'Oetiker clamp',qty:5,unit:'ea',unitCost:'2'}
    ]},
    {id:105,date:'',system:'Engine',projectIds:[],consumedParts:[
      {id:1006,partId:5,qty:3,unitCost:1}
    ]},
    {id:106,date:'2026-10-07',system:'Engine',projectIds:[],consumedParts:[
      {id:1007,partId:5,qty:'',unitCost:1}
    ]}
  ]
};

const all=report.collect(data,{start:'2026-10-05',end:'2026-10-07',system:'all'});
assert.equal(all.rows.length,4,'should only include actual Work Log consumption within inclusive dates');
assert.equal(all.undated,1,'missing date must be disclosed');
assert.equal(all.invalidQty,1,'zero/malformed quantity must be disclosed');
assert.equal(report.summary(all.rows).logs,3);
assert.equal(report.summary(all.rows).knownCost,32.2);
assert.equal(report.summary(all.rows).missing,1);
assert.equal(report.aggregate(all.rows,'project').find(g=>g.label==='Oil cooler hose').entries.length,2);
assert.equal(report.aggregate(all.rows,'project').find(g=>g.label.includes('Second project')).entries.length,1,
  'multi-project Work Log should appear only once');
const grouped=report.aggregate(all.rows,'part');
assert.equal(grouped.find(g=>g.label==='Oetiker clamp').qty,7,
  'should aggregate only recorded Work Log uses, not project.partsUsed');
assert.equal(grouped.find(g=>g.label==='Oetiker clamp').missing,1,
  'missing historical cost should remain unpriced');
assert.equal(grouped.find(g=>g.label==='Parker hose').qty,3);
assert.equal(report.aggregate(all.rows,'date').length,3);
assert.equal(report.collect(data,{start:'2026-10-05',end:'2026-10-07',system:'Engine'}).rows.length,3,
  'system selection must not use an unrelated Part system when Work Log system is known');
assert.equal(report.collect(data,{start:'2026-10-06',end:'2026-10-06',system:'all'}).rows.length,1,
  'date boundaries should be inclusive');
const formulaCSV=report.csv([{...all.rows[0],name:'=HYPERLINK("bad")'}]);
assert.match(formulaCSV,/^\uFEFF/);
assert.ok(formulaCSV.includes("'=HYPERLINK"),'CSV should neutralize spreadsheet formulas');
assert.ok(!formulaCSV.includes('99'),'project-only used quantity should never appear in CSV');
assert.match(source,/window\.renderOpsReports=/,'report must appear inside existing Aircraft Ops Reports tab');
assert.match(index,/app-72-consumption-report\.js\?v=5\.19\.78/,'new report must be cache-busted and loaded');
console.log('PASS: date-range consumption reporting, grouping, deduplication and safe CSV export');