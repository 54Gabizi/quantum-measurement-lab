// Source-level event integration with a minimal DOM double. This is NOT browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
class Element {
 constructor(){this.attrs={};this.children=[];this.handlers={};this.style={setProperty(k,v){this[k]=v;}};this.value='0';this.textContent='';this.capture=null;this.classList={add(){},remove(){},toggle(){}};}
 setAttribute(k,v){this.attrs[k]=String(v);} getAttribute(k){return this.attrs[k]??null;}
 remove(){}
 append(...e){this.children.push(...e);} replaceChildren(...e){this.children=e;}
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
 fire(name,extra={}){for(const fn of this.handlers[name]??[])fn({target:this,button:0,pointerId:1,clientX:300,clientY:235,preventDefault(){},...extra});}
 setPointerCapture(id){this.capture=id;} hasPointerCapture(id){return this.capture===id;} releasePointerCapture(){this.capture=null;}
 getBoundingClientRect(){return {left:0,top:0,width:600,height:460};}
}
test('app event wiring preserves camera invariance, resets directions, and recovers canceled drags (DOM double)',async()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const previous=globalThis.document,previousWindow=globalThis.window,oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;const timers=new Map();let tid=0;globalThis.setTimeout=fn=>{timers.set(++tid,fn);return tid;};globalThis.clearTimeout=id=>timers.delete(id);const tick=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();};const flush=()=>{let guard=0;while(timers.size){assert.ok(++guard<1000);tick();}};globalThis.window={innerWidth:0,innerHeight:0,addEventListener(){},matchMedia:()=>({matches:false})};globalThis.document={documentElement:{lang:''},querySelectorAll:()=>[],getElementById:id=>{assert.ok(elements[id],`Missing DOM ID ${id}`);return elements[id];},createElementNS:()=>new Element(),createElement:()=>new Element(),createTextNode:text=>({textContent:text})};
 try{
  await import('../src/app.mjs');
  assert.equal(elements['prob-0-0'].textContent,'50%');
  elements['preset-x'].fire('click');elements['measure-batch'].fire('click');assert.equal(elements['measure-one'].disabled,true);elements['measure-batch'].fire('click');flush();
  assert.equal(elements['trial-count'].textContent,'100');assert.equal(elements['prob-0-0'].textContent,'100%');assert.equal(elements['prob-1-0'].textContent,'0%');
  assert.match(elements['observed-0'].textContent,/100/);assert.match(elements['observed-1'].textContent,/100/);
  elements['preset-x'].fire('click');assert.equal(elements['trial-count'].textContent,'100');
  elements['measure-one'].fire('click');flush();assert.equal(elements['trial-count'].textContent,'101');
  const svg=elements.sphere;svg.fire('pointerdown',{clientX:300,clientY:300});svg.fire('pointermove',{clientX:340,clientY:310});svg.fire('pointercancel');
  assert.equal(svg.capture,null);assert.equal(elements['trial-count'].textContent,'101');assert.equal(elements['prob-0-0'].textContent,'100%');
  elements['reset-view'].fire('click');assert.equal(elements['trial-count'].textContent,'101');
  const handle=elements.handles.children.find(e=>e.getAttribute('data-sign')==='1');assert.ok(handle);
  const x=Number(handle.getAttribute('cx')),y=Number(handle.getAttribute('cy'));
  svg.fire('pointerdown',{target:handle,clientX:x,clientY:y});svg.fire('pointermove',{clientX:x-45,clientY:y+30});svg.fire('pointerup');
  assert.equal(elements['trial-count'].textContent,'0');assert.notEqual(elements['prob-0-0'].textContent,'100%');assert.equal(svg.capture,null);
  elements['measure-batch'].fire('click');elements['polar'].value='90';elements['azimuth'].value='90';elements['polar'].fire('input');
  assert.equal(elements['trial-count'].textContent,'0');assert.equal(elements['prob-0-0'].textContent,'50%');
  elements['measure-one'].fire('click');elements['clear-results'].fire('click');assert.equal(elements['trial-count'].textContent,'0');
  elements['preset-z'].fire('click');assert.equal(elements['prob-1-0'].textContent,'50%');
  // Cancel a partial batch on a changed axis; even escaped stale callbacks do nothing.
  elements['measure-batch'].fire('click');tick();tick();const escaped=[...timers.values()][0];
  elements['preset-x'].fire('click');assert.equal(elements['trial-count'].textContent,'0');escaped();assert.equal(elements['trial-count'].textContent,'0');
  elements['measure-batch'].fire('click');tick();elements['stop-run'].fire('click');assert.equal(elements['trial-count'].textContent,'1');flush();assert.equal(elements['trial-count'].textContent,'1');
  assert.equal(globalThis.document.documentElement.lang,'en');assert.equal(elements['trial-count'].textContent,'1');
  // A coalesced pointer move between antipodal rim points must rotate by pi.
  elements['reset-view'].fire('click');
  svg.fire('pointerdown',{clientX:300,clientY:300});svg.fire('pointermove',{clientX:243.75,clientY:268.75});svg.fire('pointerup');
  elements['preset-x'].fire('click');elements['measure-one'].fire('click');flush();
  const rim=elements.handles.children.find(e=>e.getAttribute('data-sign')==='1');
  svg.fire('pointerdown',{target:rim,clientX:471,clientY:235});svg.fire('pointermove',{clientX:129,clientY:235});svg.fire('pointerup');
  assert.equal(elements['prob-0-0'].textContent,'0%');assert.equal(elements['trial-count'].textContent,'0');
  // The grabbed rear endpoint follows the pointer rather than reflecting it.
  elements['polar'].value='90';elements['azimuth'].value='90';elements['polar'].fire('input');
  const rear=elements.handles.children.find(e=>e.getAttribute('data-sign')==='1');
  svg.fire('pointerdown',{target:rear,clientX:300,clientY:235});svg.fire('pointermove',{clientX:330,clientY:235});svg.fire('pointerup');
  const movedRear=elements.handles.children.find(e=>e.getAttribute('data-sign')==='1');
  assert.ok(Math.abs(Number(movedRear.getAttribute('cx'))-330)<1e-6);
  // SVG-unit hit radius compensates for a narrow CSS viewport.
  svg.getBoundingClientRect=()=>({left:0,top:0,width:280,height:280*460/600});
  elements['reset-view'].fire('click');
  const mobileHandle=elements.handles.children.find(e=>e.getAttribute('data-sign')==='1');
  assert.ok(Number(mobileHandle.getAttribute('r'))*2*280/600>=44);

 }finally{globalThis.document=previous;globalThis.window=previousWindow;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
