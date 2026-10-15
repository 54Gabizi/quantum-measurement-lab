import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createPrimerState,flipBit,flipPhase,primerProbabilities,measureFreshPrimer,initializePrimer} from '../src/primer.mjs';
test('primer bit has a definite reversible value; phase only changes the selected quantum preparation',()=>{
 const s=createPrimerState();assert.equal(s.bit,0);flipBit(s);assert.equal(s.bit,1);flipBit(s);assert.equal(s.bit,0);
 assert.deepEqual(primerProbabilities(s,'Z'),[.5,.5]);assert.deepEqual(primerProbabilities(s,'X'),[1,0]);
 flipPhase(s);assert.equal(s.bit,0);assert.equal(s.phase,-1);assert.deepEqual(primerProbabilities(s,'Z'),[.5,.5]);assert.deepEqual(primerProbabilities(s,'X'),[0,1]);
 flipPhase(s);assert.deepEqual(primerProbabilities(s,'X'),[1,0]);assert.throws(()=>primerProbabilities(s,'Y'),/X or Z/);
});
test('every primer click re-prepares before a single Z measurement',()=>{
 const s=createPrimerState();assert.equal(measureFreshPrimer(s,()=>.1),0);assert.equal(measureFreshPrimer(s,()=>.9),1);
 assert.equal(s.phase,1);assert.deepEqual(primerProbabilities(s),[.5,.5]);flipPhase(s);assert.equal(s.last,null);assert.equal(measureFreshPrimer(s,()=>.1),0);
});
test('primer controls stay independent; only explicit bridge buttons select the main measurement',()=>{
 class E{constructor(){this.handlers={};this.attrs={};this.classList={toggle(){}};this.textContent='';this.hidden=false;this.open=true;}addEventListener(k,f){this.handlers[k]=f;}setAttribute(k,v){this.attrs[k]=v;}click(){this.handlers.click();}}
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');const nodes=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new E()]));const calls=[];let layout=0;
 const s=initializePrimer({document:{getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];}},onCompare:axis=>calls.push(axis),onLayoutChange:()=>layout++});
 assert.equal(nodes['primer-panel-0'].hidden,false);assert.equal(nodes['primer-panel-1'].hidden,true);
 nodes['primer-flip-bit'].click();assert.equal(s.bit,1);nodes['primer-next-0'].click();assert.equal(s.step,1);assert.equal(nodes['primer-panel-1'].hidden,false);
 nodes['primer-flip-phase'].click();assert.equal(nodes['primer-amplitude-value'].textContent,'−1/√2');assert.match(nodes['primer-phase-arrow'].className,/negative/);
 nodes['primer-next-1'].click();assert.equal(s.step,2);assert.match(nodes['primer-selected-prep'].textContent,/B/);nodes['primer-measure'].click();assert.match(nodes['primer-single-result'].textContent,/^[01]$/);assert.deepEqual(calls,[]);
 nodes['primer-try-x'].click();assert.deepEqual(calls,['X']);assert.equal(nodes['qubit-primer'].open,false);nodes['primer-try-z'].click();assert.deepEqual(calls,['X','Z']);assert.ok(layout>=4);
});
test('primer content preserves one-result and no-speedup boundaries with primary sources',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/one outcome/);assert.match(html,/not all the answers/);assert.match(html,/does not demonstrate a computational speedup/);assert.match(html,/not two particles/);assert.match(html,/Every click here prepares a fresh qubit/);assert.match(html,/quantum.cloud.ibm.com/);assert.match(html,/RQWpF2Gb-gU/);
});
