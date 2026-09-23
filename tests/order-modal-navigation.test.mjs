import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-35-navigation-ux.js',import.meta.url),'utf8');

function createHarness(){
  const listeners={popstate:[],click:[],focusin:[],input:[],keydown:[]};
  const tasks=new Map(),backEvents=[];
  let nextTimer=0;
  const elements=new Map();
  function makeElement(id=''){
    const classes=new Set();
    return {
      id,style:{},dataset:{},textContent:'',innerHTML:'',disabled:false,onclick:null,
      classList:{
        add:k=>classes.add(k),
        remove:k=>classes.delete(k),
        contains:k=>classes.has(k),
        toggle(k,force){const state=force===undefined?!classes.has(k):!!force;if(state)classes.add(k);else classes.delete(k);return state}
      },
      setAttribute(){},
      contains(el){return !!el?._inModal},
      querySelector(sel){return sel==='[data-receipt-editor]'&&this.innerHTML.includes('data-receipt-editor')?{}:null},
      appendChild(node){if(node.id)elements.set(node.id,node)}
    };
  }
  const modal=makeElement('modal');
  elements.set('modal',modal);
  const doc={
    head:makeElement(),body:makeElement(),
    createElement:()=>makeElement(),
    getElementById(id){return elements.get(id)||(id.startsWith('page-')?makeElement(id):null)},
    activeElement:null,
    addEventListener(type,fn){(listeners[type]??=[]).push(fn)}
  };
  const stack=[null];
  let index=0;
  const history={
    state:null,
    replaceState(s){stack[index]=s;this.state=s},
    pushState(s){stack.splice(index+1);stack.push(s);index=stack.length-1;this.state=s},
    back(){
      if(index<1)return;
      const next=index-1;
      // Browser history.back() is asynchronous: the new popup may open
      // before popstate is dispatched.
      backEvents.push(()=>{
        index=next;this.state=stack[index];
        for(const fn of listeners.popstate)fn({state:this.state});
      });
    }
  };
  const ctx={
    console,document:doc,history,currentPage:'dashboard',
    navigator:{standalone:false},MutationObserver:class{observe(){}},
    setTimeout(fn){const id=++nextTimer;tasks.set(id,fn);return id},
    clearTimeout(id){tasks.delete(id)},
    addEventListener(type,fn){(listeners[type]??=[]).push(fn)},
    matchMedia:()=>({matches:false}),
    navTo:()=>{},
    openModal(html){modal.innerHTML=html;modal.classList.add('open')},
    closeModal(){modal.classList.remove('open')}
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(source,ctx,{filename:'app-35-navigation-ux.js'});
  const flushTimers=()=>{for(const [id,fn] of [...tasks]){if(!tasks.has(id))continue;tasks.delete(id);fn()}};
  const flushBack=()=>{while(backEvents.length)backEvents.shift()()};
  function dispatchDocument(type,target,properties={}){
    const e={target,...properties,prevented:false,stopped:false,
      preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};
    for(const fn of listeners[type]||[]){fn(e);if(e.stopped)break}
    return e;
  }
  return {ctx,modal,history,flushTimers,flushBack,tasks,backEvents,dispatchDocument};
}

// Reproduce the reported disappearance: saving the new order closes one popup
// and starts history.back(); before popstate arrives, Receive opens another.
// The old popup's history event MUST NOT dismiss the active receipt form.
{
  const h=createHarness();
  h.ctx.openModal('New order');
  h.ctx.closeModal();
  h.flushTimers();
  assert.equal(h.backEvents.length,1);
  h.ctx.openModal('Receive 2 into Inventory');
  h.flushBack();
  assert.equal(h.modal.classList.contains('open'),true,'delayed popstate closed the receipt modal');
  assert.equal(h.modal.innerHTML,'Receive 2 into Inventory');
  assert.equal(h.history.state.n594zsKind,'modal','restored popup lost its Back history state');
  h.ctx.trackerBack();
  h.flushBack();
  assert.equal(h.modal.classList.contains('open'),false,'user Back did not close the receipt popup');
}

// Opening the receipt popup BEFORE the close timer fires should cancel
// the old timer entirely, and the popup should remain open.
{
  const h=createHarness();
  h.ctx.openModal('New order');
  h.ctx.closeModal();
  h.ctx.openModal('Receipt');
  h.flushTimers();
  h.flushBack();
  assert.equal(h.modal.classList.contains('open'),true);
  assert.equal(h.history.state.n594zsKind,'modal');
}

// Normal explicit browser/phone Back must still close an ordinary popup.
{
  const h=createHarness();
  h.ctx.openModal('Receipt');
  h.ctx.trackerBack();
  h.flushBack();
  assert.equal(h.modal.classList.contains('open'),false);
  assert.equal(h.history.state.n594zsKind,'page');
}

// Closing without opening a replacement still removes the modal history entry.
{
  const h=createHarness();
  h.ctx.openModal('New order');
  h.ctx.closeModal();
  h.flushTimers();
  h.flushBack();
  assert.equal(h.modal.classList.contains('open'),false);
  assert.equal(h.history.state.n594zsKind,'page');
}

// Editing a mobile receiving quantity must not let a stray backdrop tap
// discard the form. A deliberate X/Cancel remains available.
{
  const h=createHarness();
  h.ctx.openModal('Receive Order Item <div data-receipt-editor="single"><input id="orReceiveQty" value="4"></div>');
  const input={tagName:'INPUT',_inModal:true,blur(){h.ctx.document.activeElement=null}};
  h.ctx.document.activeElement=input;
  h.ctx.document.addEventListener('click',e=>{if(e.target===h.modal)h.ctx.closeModal()});
  const e=h.dispatchDocument('click',h.modal);
  assert.equal(e.prevented,true);
  assert.equal(e.stopped,true);
  assert.equal(h.modal.classList.contains('open'),true,'backdrop dismissed unsaved receipt form');

  // The legacy Escape handlers should not close the receipt when the numeric
  // input is focused (e.g., the phone keyboard dismisses the editor).
  h.ctx.document.addEventListener('keydown',e=>{if(e.key==='Escape')h.ctx.closeModal()});
  const escape=h.dispatchDocument('keydown',input,{key:'Escape'});
  assert.equal(escape.stopped,true);
  assert.equal(h.modal.classList.contains('open'),true);
  assert.equal(h.ctx.document.activeElement,null,'Escape did not blur quantity editor');
}

// A popstate arriving while editing a quantity can be triggered by the
// mobile keyboard or an old browser-history entry. Preserve the receipt,
// but still honor an explicit in-app Back button click.
{
  const h=createHarness();
  h.ctx.openModal('Receive 4 <div data-receipt-editor="single"><input id="orReceiveQty"></div>');
  const input={tagName:'INPUT',_inModal:true,blur(){h.ctx.document.activeElement=null}};
  h.ctx.document.activeElement=input;
  h.dispatchDocument('focusin',input);
  h.dispatchDocument('input',input);
  h.history.back();
  h.flushBack();
  assert.equal(h.modal.classList.contains('open'),true,'unsolicited popstate closed quantity editor');
  assert.equal(h.history.state.n594zsKind,'modal','receipt lost Back history after keyboard event');
  h.ctx.trackerBack();
  h.flushBack();
  assert.equal(h.modal.classList.contains('open'),false,'explicit in-app Back was blocked');
}

// The same backdrop gesture on an ordinary non-receipt detail should retain
// normal behavior, so the guard is limited to receiving forms.
{
  const h=createHarness();
  h.ctx.openModal('Regular order details');
  h.ctx.document.addEventListener('click',e=>{if(e.target===h.modal)h.ctx.closeModal()});
  const e=h.dispatchDocument('click',h.modal);
  assert.equal(e.stopped,false);
  assert.equal(h.modal.classList.contains('open'),false);
}

console.log('order receipt popup navigation race regression tests passed');
