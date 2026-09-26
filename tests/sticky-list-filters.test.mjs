import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run real app-05 project/parts renderers against a fake DOM and a shared
// browser-tab session store. No cloud data is accessed or written.
const src=fs.readFileSync(new URL('../app-05-views.js',import.meta.url),'utf8');
const saved=new Map();
function harness(){
  const nodes=new Map();
  const ids={
    projects:['projectSearch','projectStatus','projectSystem','projectPriority','projectRows'],
    parts:['partSearch','partSystem','partStatus','partInventory','partRows']
  };
  function element(id='',tagName='DIV'){
    const el={id,tagName,value:'',options:[],_html:'',style:{},dataset:{},
      set innerHTML(html){
        this._html=html;
        if(this.id!=='page-projects'&&this.id!=='page-parts')return;
        const page=this.id.slice(5);
        for(const key of ids[page])nodes.delete(key);
        for(const key of ids[page]){
          const isSelect=/(Status|System|Priority|Inventory)$/.test(key);
          const control=element(key,isSelect?'SELECT':key.endsWith('Rows')?'TBODY':'INPUT');
          if(isSelect){
            const match=new RegExp('<select id="'+key+'"[^>]*>([\\s\\S]*?)<\\/select>').exec(html);
            if(match){
              for(const option of match[1].matchAll(/<option([^>]*)>([^<]*)<\/option>/g)){
                const value=/\bvalue="([^"]*)"/.exec(option[1]);
                control.options.push({value:value?value[1]:option[2]});
              }
            }
          }
          nodes.set(key,control);
        }
      },
      get innerHTML(){return this._html},
      setAttribute(){},querySelector(){return null}
    };
    return el;
  }
  nodes.set('page-projects',element('page-projects'));
  nodes.set('page-parts',element('page-parts'));
  const document={
    getElementById:id=>nodes.get(id)||null,
    createElement:tag=>element('',tag.toUpperCase()),
    head:{appendChild(el){if(el.id)nodes.set(el.id,el)}},
    querySelectorAll:()=>[]
  };
  const db={
    settings:{showCosts:true},
    projects:[
      {id:1,title:'Completed wiring',system:'Electrical',status:'Done',priority:'High',
        percent:100,summary:'Completed',plan:'',nextStep:'',blockers:'',trigger:'',
        partsUsed:[]},
      {id:2,title:'Fuel pump installation',system:'Fuel',status:'Open',priority:'Medium',
        percent:25,summary:'Pending',plan:'',nextStep:'',blockers:'',trigger:'',
        partsUsed:[]}
    ],
    parts:[
      {id:10,name:'Fuse block',partNo:'A',system:'Electrical',status:'Installed',
        vendor:'Amazon',stockQty:1,unitCost:15,unit:'ea',notes:'',location:''},
      {id:11,name:'Hose',partNo:'B',system:'Fuel',status:'On Hand',
        vendor:'Aircraft Spruce',stockQty:2,unitCost:7,unit:'ea',notes:'',location:''}
    ],
    orders:[],logs:[],docs:[],checklists:[],aircraft:{},invoices:[],purchases:[]
  };
  const context={window:null,sessionStorage:{
    getItem:key=>saved.get(key)||null,
    setItem:(key,val)=>saved.set(key,val)
  },document,console,db,Intl,Map,Set,Array,Number,String,Date,JSON,
  val:id=>String(nodes.get(id)?.value||''),
  num:x=>Number(x)||0,esc:x=>String(x??''),pill:x=>String(x),
  partAvailable:p=>p.stockQty,partConsumedQty:()=>0,partOnOrderQty:()=>0,
  fmtMoney:v=>'$'+Number(v).toFixed(2),projectCost:()=>0,
  orderLinkedToProject:()=>false,isClosedOrder:()=>false,
  navTo(page){if(page==='projects')context.renderProjects()},
  projectName:()=>'',currentPage:'projects',
  SEED:{},renderDashboard:()=>{},renderAircraft:()=>{},renderOrders:()=>{},
  renderDocuments:()=>{},renderChecklists:()=>{},renderLogbook:()=>{},renderSettings:()=>{},
  renderNav:()=>{}
  };
  context.window=context;
  context.systemNames=()=>['Electrical','Fuel'];
  vm.createContext(context);
  vm.runInContext(src,context,{filename:'app-05-views.js'});
  return {ctx:context,db,nodes};
}
const h=harness();
h.ctx.renderProjects();
assert.equal(h.nodes.get('projectStatus').value,'');
h.nodes.get('projectStatus').value='Done';
h.nodes.get('projectSearch').value='wiring';
h.nodes.get('projectSystem').value='Electrical';
h.ctx.renderProjectRows();
assert.match(h.nodes.get('projectRows').innerHTML,/Completed wiring/);
assert.doesNotMatch(h.nodes.get('projectRows').innerHTML,/Fuel pump/);
// Simulate cloud render on tab visibility return: DOM replaced, saved controls restored.
h.ctx.renderProjects();
assert.equal(h.nodes.get('projectStatus').value,'Done');
assert.equal(h.nodes.get('projectSearch').value,'wiring');
assert.equal(h.nodes.get('projectSystem').value,'Electrical');
assert.doesNotMatch(h.nodes.get('projectRows').innerHTML,/Fuel pump/);
// Navigating to Parts and back must not clear Projects.
h.ctx.renderParts();
h.nodes.get('partSystem').value='Fuel';
h.nodes.get('partStatus').value='On Hand';
h.ctx.renderPartRows();
h.ctx.renderProjects();
assert.equal(h.nodes.get('projectStatus').value,'Done');
h.ctx.renderParts();
assert.equal(h.nodes.get('partSystem').value,'Fuel');
assert.equal(h.nodes.get('partStatus').value,'On Hand');
// An intentional dashboard "Active projects" link SHOULD override the saved status.
h.ctx.openProjectsView({status:'Active'});
assert.equal(h.nodes.get('projectStatus').value,'Active');
assert.match(h.nodes.get('projectRows').innerHTML,/Fuel pump installation/);
assert.doesNotMatch(h.nodes.get('projectRows').innerHTML,/Completed wiring/);
// Reboot into a fresh JavaScript VM with the same browser-tab sessionStorage.
const reloaded=harness();
reloaded.ctx.renderProjects();
reloaded.ctx.renderParts();
assert.equal(reloaded.nodes.get('projectStatus').value,'Active');
assert.equal(reloaded.nodes.get('partStatus').value,'On Hand');
assert.equal(reloaded.nodes.get('partSystem').value,'Fuel');
assert.equal(reloaded.nodes.get('partRows').innerHTML.includes('Fuse block'),false);
assert.equal(reloaded.nodes.get('partRows').innerHTML.includes('Hose'),true);
console.log('PASS: production Projects/Parts filter controls survive cloud re-render, navigation and same-tab reload; intentional Active link overrides restored filters.');
