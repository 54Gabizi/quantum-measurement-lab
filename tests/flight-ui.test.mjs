// Deterministic DOM/clock double, not a rendered browser test.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
class E{constructor(){this.attrs={};this.children=[];this.handlers={};this.style={setProperty(k,v){this[k]=v;}};this.textContent='';this.value='0';this.classList={add(){},remove(){},toggle(){}};this.rect={left:0,top:0,width:600,height:460};}setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}remove(){}addEventListener(k,f){(this.handlers[k]??=[]).push(f);}fire(k){for(const f of this.handlers[k]??[])f({target:this});}getBoundingClientRect(){return this.rect;}}
test('flights use live sphere/bucket viewport coordinates and update counts only on arrival',async()=>{
 const nodes=Object.fromEntries([...readFileSync(new URL('../index.html',import.meta.url),'utf8').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new E()]));
 const old={document:globalThis.document,window:globalThis.window,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};let now=0,id=0;const tasks=new Map(),handlers={};
 globalThis.setTimeout=(fn,delay)=>{tasks.set(++id,{fn,due:now+delay});return id;};globalThis.clearTimeout=id=>tasks.delete(id);
 const tick=()=>{const [id,t]=[...tasks].sort((a,b)=>a[1].due-b[1].due)[0];tasks.delete(id);now=t.due;t.fn();};
 globalThis.document={documentElement:{},querySelectorAll:()=>[],getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},createElement:()=>new E(),createElementNS:()=>new E()};
 const media={matches:false};globalThis.window={innerWidth:1200,innerHeight:1000,matchMedia:()=>media,addEventListener:(k,f)=>handlers[k]=f};
 nodes.sphere.rect={left:100,top:100,width:600,height:460};for(let i=0;i<2;i++)for(let j=0;j<2;j++)nodes[`detector-${i}-${j}`].rect={left:100+i*500+j*180,top:700,width:160,height:100};
 try{
  await import('../src/app.mjs?flight-test');nodes['preset-x'].fire('click');nodes['measure-one'].fire('click');tick();
  assert.equal(nodes['trial-count'].textContent,'0');assert.equal(nodes['particle-overlay'].children.length,2);
  const [a,b]=nodes['particle-overlay'].children;assert.equal(a.style['--from-x'],'400px');assert.equal(a.style['--from-y'],'335px');assert.equal(a.style['--to-x'],'180px');assert.equal(a.style['--to-y'],'730px');assert.equal(b.style['--to-x'],'860px');assert.equal(a.getAttribute('data-preparation'),'A');assert.equal(b.getAttribute('data-outcome'),'1');
  tick();assert.equal(nodes['trial-count'].textContent,'1');
  nodes['measure-batch'].fire('click');tick();const escaped=[...tasks.values()].map(t=>t.fn);handlers.scroll();for(const fn of escaped)fn();assert.equal(nodes['trial-count'].textContent,'1');assert.equal(nodes['particle-overlay'].children.length,0);assert.match(nodes.status.textContent,/View changed/);
  // Shift and scale the complete viewport: source and destination are recomputed.
  nodes.sphere.rect={left:20,top:20,width:280,height:280*460/600};nodes['mobile-detector-0-0'].rect={left:20,top:400,width:120,height:100};nodes['mobile-detector-1-1'].rect={left:160,top:400,width:120,height:100};window.innerWidth=360;window.innerHeight=800;
  nodes['measure-one'].fire('click');tick();assert.equal(nodes['particle-overlay'].children[0].style['--from-x'],'160px');assert.equal(nodes['particle-overlay'].children[0].style['--to-x'],'80px');tick();assert.equal(nodes['trial-count'].textContent,'2');
  // Offscreen and reduced-motion modes count immediately, with no flight buildup.
  nodes['particle-overlay'].replaceChildren();nodes.sphere.rect.top=-1000;nodes['measure-one'].fire('click');tick();assert.equal(nodes['trial-count'].textContent,'3');assert.equal(nodes['particle-overlay'].children.length,0);assert.match(nodes['flight-note'].textContent,/Off-screen/);
  media.matches=true;nodes['measure-one'].fire('click');tick();assert.equal(nodes['trial-count'].textContent,'4');assert.match(nodes['flight-note'].textContent,/Reduced motion/);assert.equal(nodes['particle-overlay'].children.length,0);
 }finally{Object.assign(globalThis,old);}
});
