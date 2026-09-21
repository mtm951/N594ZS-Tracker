'use strict';

const APP_VERSION='5.16.3';
const DB_KEY='n594zs_v3';
const OLD_DB_KEY='n594zs_v2';
const NAV=[
  ['dashboard','Dashboard'],['aircraft','Aircraft'],['projects','Projects'],['parts','Parts'],['orders','Orders'],
  ['documents','Documents'],['checklists','Checklists'],['logbook','Work Log'],['settings','Settings']
];

const SEED={
  version:3,
  systems:[],
  aircraft:{
    tail:'N594ZS',model:'Kitfox Model 4-1050',engine:'Rotax 912 ULS',hp:'100',gross:'1050',
    emptyWeight:'',emptyCg:'',airframeHours:'',engineHours:'',annualDate:'',
    status:'PROJECT / NOT RETURNED TO SERVICE',serial:'',base:'20N',notes:'',photo:''
  },
  projects:[
    {id:101,title:'Finish remaining fuel-return hard-line work',system:'Fuel',priority:'High',status:'Open',trigger:'Before engine start',percent:70,
      summary:'Complete the remaining return-line tubing and final routing.',plan:'Finish the remaining tube/flare work, verify support and routing, and inspect the complete return path before engine operation.',nextStep:'Finish and inspect the remaining hard-line connection.',blockers:'',
      partsUsed:[{id:1001,partId:203,name:'Andair return-line check valve',qty:1,unit:'ea',unitCost:'',notes:'Installed in return path; verify final orientation and system behavior.'}],updates:[]},
    {id:102,title:'Oil system prime / purge',system:'Engine',priority:'High',status:'Open',trigger:'Before first engine start',percent:0,
      summary:'Prepare the Rotax oil system before initial engine operation.',plan:'Use the applicable current Rotax procedure and record completion.',nextStep:'Complete oil-system preparation before first start.',blockers:'',partsUsed:[],updates:[]},
    {id:103,title:'Mount / finish tires and wheels',system:'Landing Gear',priority:'Medium',status:'Open',trigger:'Before ground testing',percent:20,
      summary:'Complete the wheel/tire portion of the landing-gear work.',plan:'Finish installation and inspect hardware, brakes, clearances, and condition.',nextStep:'Complete wheel/tire installation.',blockers:'',partsUsed:[],updates:[]},
    {id:104,title:'Resolve airspeed indicator issue',system:'Avionics / Instruments',priority:'High',status:'Open',trigger:'Before flight',percent:0,
      summary:'The airspeed indication is not presently trusted.',plan:'Troubleshoot the instrument and pitot/static system, correct the fault, then verify operation.',nextStep:'Isolate whether the fault is the indicator or the pitot/static system.',blockers:'',partsUsed:[],updates:[]},
    {id:105,title:'Repair fabric tear',system:'Fabric / Airframe',priority:'High',status:'In Progress',trigger:'Before flight',percent:35,
      summary:'Repair the fabric damage near the pushrod area.',plan:'Complete the repair using the applicable fabric-system process, then inspect and finish the repaired area.',nextStep:'Complete the permanent fabric repair and finish work.',blockers:'',partsUsed:[],updates:[]},
    {id:106,title:'Final propeller hardware / torque / locking inspection',system:'Propeller',priority:'High',status:'Open',trigger:'Before engine run',percent:0,
      summary:'Finalize and document the propeller mounting hardware configuration.',plan:'Verify hardware, locking method, torque, and installation against the applicable propeller and engine documentation.',nextStep:'Confirm final hardware stack and torque specification.',blockers:'',partsUsed:[],updates:[]},
    {id:107,title:'Final fuel-system inspection and flow verification',system:'Fuel',priority:'High',status:'Open',trigger:'Before flight',percent:45,
      summary:'Close out the complete 912 fuel-system installation.',plan:'Inspect shutoff operation, routing, support, leaks, return path, usable-fuel assumptions, and applicable flow verification.',nextStep:'Finish remaining return-line work, then inspect the system end-to-end.',blockers:'Fuel-return hard-line completion is still open.',partsUsed:[],updates:[]},
    {id:108,title:'Final coolant fill, purge and leak check',system:'Cooling',priority:'Medium',status:'Open',trigger:'Before engine run',percent:35,
      summary:'Complete cooling-system servicing and final inspection.',plan:'Service the system and inspect hose/fitting clearances, clamps, and leaks.',nextStep:'Complete final fill/purge and leak inspection.',blockers:'',partsUsed:[],updates:[]},
    {id:109,title:'Electrical system final inspection',system:'Electrical',priority:'High',status:'In Progress',trigger:'Before engine run',percent:80,
      summary:'Final review of the reworked aircraft electrical system.',plan:'Verify central ground, individual circuit protection, strain relief, chafe protection, charging/starter wiring, and avionics operation.',nextStep:'Perform a final circuit-by-circuit inspection and functional check.',blockers:'',partsUsed:[],updates:[]},
    {id:110,title:'Document new weight & balance after 912 installation',system:'Records / W&B',priority:'High',status:'Open',trigger:'Before return to service',percent:0,
      summary:'Establish the completed aircraft empty weight and CG.',plan:'Weigh the airplane in completed configuration and update the aircraft weight-and-balance record.',nextStep:'Finish the configuration, then weigh the aircraft.',blockers:'Aircraft configuration must be complete first.',partsUsed:[],updates:[]},
    {id:111,title:'ADS-B Out / transponder configuration decision',system:'Avionics / Instruments',priority:'Low',status:'Open',trigger:'Optional / mission dependent',percent:10,
      summary:'Choose the final surveillance equipment configuration.',plan:'Compare airspace needs, safety benefit, installation complexity, cost, and privacy preferences.',nextStep:'Decide whether ADS-B Out is part of the immediate return-to-flight scope.',blockers:'',partsUsed:[],updates:[]},
    {id:112,title:'Headset jack relocation',system:'Avionics / Instruments',priority:'Low',status:'Done',trigger:'Completed',percent:100,
      summary:'Relocate headset jacks behind the seat.',plan:'Completed.',nextStep:'Functional check during final electrical inspection.',blockers:'',partsUsed:[],updates:[{id:1201,date:'2026-09-10',text:'Jacks relocated behind the seat to reduce wires across the dash/lap area.'}]},
    {id:113,title:'Install Rotax 912 ULS engine',system:'Engine',priority:'High',status:'Done',trigger:'Completed',percent:100,
      summary:'Core engine conversion from the previous powerplant to the Rotax 912 ULS.',plan:'Core installation completed; related systems are tracked as separate closeout projects.',nextStep:'Close remaining engine-start and return-to-service items.',blockers:'',partsUsed:[{id:1301,partId:201,name:'Rotax 912 ULS engine',qty:1,unit:'ea',unitCost:5500,notes:'Acquisition cost recorded from project notes.'}],updates:[]},
    {id:114,title:'Replace aircraft wiring / add central ground and individual fuses',system:'Electrical',priority:'High',status:'Done',trigger:'Completed',percent:100,
      summary:'Major electrical-system rework.',plan:'Completed; final inspection remains tracked separately.',nextStep:'Final electrical-system inspection.',blockers:'',partsUsed:[],updates:[]},
    {id:115,title:'Replace fuel lines and add header / return system',system:'Fuel',priority:'High',status:'In Progress',trigger:'Before engine start',percent:85,
      summary:'Reconfigure the aircraft fuel system for the 912 installation.',plan:'Major installation is complete; remaining return-line completion and final system verification are tracked separately.',nextStep:'Close the remaining return-line and verification items.',blockers:'Remaining hard-line work.',partsUsed:[],updates:[]},
    {id:116,title:'Custom 321 stainless exhaust installation',system:'Exhaust',priority:'Medium',status:'Done',trigger:'Completed',percent:100,
      summary:'Install the ceramic-coated 321 stainless exhaust system.',plan:'Completed.',nextStep:'Inspect clearances and fasteners during final engine-bay inspection.',blockers:'',partsUsed:[{id:1601,partId:202,name:'321 stainless ceramic-coated exhaust',qty:1,unit:'ea',unitCost:3600,notes:'Project cost recorded.'}],updates:[]}
  ],
  parts:[
    {id:201,name:'Rotax 912 ULS engine',partNo:'',system:'Engine',unit:'ea',stockQty:0,minQty:0,status:'Installed',vendor:'',url:'',unitCost:5500,location:'Installed',purchaseDate:'',notes:'Engine acquired for the conversion.',linkedProjectIds:[113],updates:[]},
    {id:202,name:'321 stainless ceramic-coated exhaust',partNo:'',system:'Exhaust',unit:'ea',stockQty:0,minQty:0,status:'Installed',vendor:'',url:'',unitCost:3600,location:'Installed',purchaseDate:'',notes:'Custom exhaust system.',linkedProjectIds:[116],updates:[]},
    {id:203,name:'Andair return-line check valve',partNo:'',system:'Fuel',unit:'ea',stockQty:0,minQty:0,status:'Installed',vendor:'Andair',url:'',unitCost:'',location:'Installed',purchaseDate:'',notes:'0.4 psi cracking pressure. Track final orientation and system verification.',linkedProjectIds:[101,107,115],updates:[]},
    {id:204,name:'5/16 in 3003-O aluminum fuel tubing',partNo:'',system:'Fuel',unit:'ft',stockQty:'',minQty:'',status:'On Hand',vendor:'',url:'',unitCost:'',location:'Shop',purchaseDate:'',notes:'Fuel hard-line material.',linkedProjectIds:[101,107,115],updates:[]},
    {id:205,name:'AN-5 fuel-system fittings',partNo:'',system:'Fuel',unit:'ea',stockQty:'',minQty:'',status:'On Hand',vendor:'',url:'',unitCost:'',location:'Shop',purchaseDate:'',notes:'Adapters/fittings used throughout the final fuel routing.',linkedProjectIds:[101,107,115],updates:[]},
    {id:206,name:'ETX680 battery',partNo:'ETX680',system:'Electrical',unit:'ea',stockQty:0,minQty:0,status:'Installed',vendor:'EarthX',url:'',unitCost:'',location:'Installed',purchaseDate:'',notes:'Installed in place of the previous PC680.',linkedProjectIds:[109,114],updates:[]},
    {id:207,name:'Poly-Fiber repair materials',partNo:'',system:'Fabric / Airframe',unit:'lot',stockQty:1,minQty:0,status:'Verify',vendor:'',url:'',unitCost:'',location:'Shop',purchaseDate:'',notes:'Confirm suitability and shelf life of each material before use.',linkedProjectIds:[105],updates:[]}
  ],
  orders:[],
  logs:[
    {id:401,date:'2026-09-10',airframeHours:'',engineHours:'',laborHours:'',system:'Avionics / Instruments',projectIds:[112,109],work:'Relocated headset jacks behind the seat to clean up cockpit wiring.',observations:'',blockers:'',nextStep:'Functional check during final electrical inspection.',consumedParts:[],otherCost:'',notes:''},
    {id:402,date:'2026-09-07',airframeHours:'',engineHours:'',laborHours:'',system:'Fuel',projectIds:[101,107,115],work:'Worked on Rotax return-line routing to the header tank and check-valve/restrictor arrangement.',observations:'',blockers:'Remaining hard-line completion.',nextStep:'Finish remaining hard-line work and perform final inspection / verification.',consumedParts:[],otherCost:'',notes:''},
    {id:403,date:'2026-09-03',airframeHours:'',engineHours:'',laborHours:'',system:'Project',projectIds:[],work:'Reviewed the major 912-conversion punch list and marked many completed items.',observations:'',blockers:'',nextStep:'Close remaining engine-start, landing-gear, instrument, and fabric items.',consumedParts:[],otherCost:'',notes:''}
  ],
  docs:[
    {id:301,name:'Rotax 912 ULS Installation Manual',type:'Engine manual',revision:'',issueDate:'',system:'Engine',publisher:'Rotax',location:'Add current revision / link',notes:'Use the current applicable revision.',linkedProjectIds:[102,108,109,113],linkedPartIds:[201],linkedLogIds:[],updates:[]},
    {id:302,name:'Rotax 912 ULS Maintenance Manuals',type:'Engine manual',revision:'',issueDate:'',system:'Engine',publisher:'Rotax',location:'Add current revisions / links',notes:'Keep the current applicable maintenance references here.',linkedProjectIds:[102,113],linkedPartIds:[201],linkedLogIds:[],updates:[]},
    {id:303,name:'Kitfox Model 4 documentation',type:'Airframe manual / drawings',revision:'',issueDate:'',system:'Airframe',publisher:'Kitfox',location:'Add manual / drawings location',notes:'',linkedProjectIds:[103,105,110],linkedPartIds:[],linkedLogIds:[],updates:[]},
    {id:304,name:'N594ZS Weight & Balance',type:'Aircraft record',revision:'',issueDate:'',system:'Records / W&B',publisher:'',location:'Replace with post-conversion W&B when completed',notes:'',linkedProjectIds:[110],linkedPartIds:[],linkedLogIds:[],updates:[]},
    {id:305,name:'N594ZS Wiring Diagram',type:'As-built diagram',revision:'',issueDate:'',system:'Electrical',publisher:'',location:'Create / update final as-built diagram',notes:'Document the final wiring configuration.',linkedProjectIds:[109,114],linkedPartIds:[],linkedLogIds:[],updates:[]},
    {id:306,name:'N594ZS Fuel System Schematic',type:'As-built diagram',revision:'',issueDate:'',system:'Fuel',publisher:'',location:'Create / update final as-built schematic',notes:'Document tank, header, shutoff, supply, return, restrictor/check-valve arrangement and firewall routing.',linkedProjectIds:[101,107,115],linkedPartIds:[203,204,205],linkedLogIds:[402],updates:[]}
  ],
  checklists:[
    {id:501,name:'First Engine Run Readiness',purpose:'Organize the remaining items before the first engine run.',system:'Engine',trigger:'Before first engine run',projectId:102,notes:'Project checklist only; use the applicable manufacturer procedures and required inspections.',items:[
      {id:1,text:'Oil-system preparation completed using current applicable procedure',done:false,note:''},
      {id:2,text:'Fuel system complete and leak / flow verification addressed',done:false,note:''},
      {id:3,text:'Cooling system serviced and inspected',done:false,note:''},
      {id:4,text:'Propeller installation and hardware verified',done:false,note:''},
      {id:5,text:'Electrical-system final inspection complete',done:false,note:''}
    ]},
    {id:502,name:'Return-to-Flight Punch List',purpose:'High-level closeout list for the completed conversion.',system:'Aircraft',trigger:'Before return to flight',projectId:null,notes:'This is an organizational checklist, not an airworthiness determination.',items:[
      {id:1,text:'Fabric repair complete and inspected',done:false,note:''},
      {id:2,text:'Airspeed / pitot-static issue resolved',done:false,note:''},
      {id:3,text:'Weight & balance updated',done:false,note:''},
      {id:4,text:'Required maintenance / aircraft records completed',done:false,note:''},
      {id:5,text:'Final ground and engine checks completed satisfactorily',done:false,note:''}
    ]}
  ],
  settings:{currency:'USD',ownerNote:'',showCosts:true,repositoryUrl:''}
};

const clone=x=>JSON.parse(JSON.stringify(x));
const uid=()=>Date.now()+Math.floor(Math.random()*100000);
const today=()=>new Date().toISOString().slice(0,10);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const arr=v=>Array.isArray(v)?v:[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const isURL=v=>/^https?:\/\//i.test(v||'');
const val=id=>document.getElementById(id)?.value?.trim()??'';
const checked=id=>!!document.getElementById(id)?.checked;
const selectedNumber=id=>{const v=val(id);return v?Number(v):null};
const unique=a=>[...new Set(a)];
const projectById=id=>db.projects.find(x=>x.id===Number(id));
const partById=id=>db.parts.find(x=>x.id===Number(id));
const orderById=id=>db.orders.find(x=>x.id===Number(id));
const logById=id=>db.logs.find(x=>x.id===Number(id));
const docById=id=>db.docs.find(x=>x.id===Number(id));
const checklistById=id=>db.checklists.find(x=>String(x.id)===String(id));
