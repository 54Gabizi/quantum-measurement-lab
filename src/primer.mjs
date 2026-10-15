import { probabilities, sample } from './quantum.mjs';

export function createPrimerState(){return {step:0,bit:0,phase:1,last:null};}
export function flipBit(state){state.bit=1-state.bit;return state.bit;}
export function flipPhase(state){state.phase=-state.phase;state.last=null;return state.phase;}
export function primerProbabilities(state,axis='Z'){
 if(axis!=='X'&&axis!=='Z')throw new RangeError('Primer axis must be X or Z.');
 return probabilities([state.phase,0,0],axis==='Z'?[0,0,1]:[1,0,0]);
}
export function measureFreshPrimer(state,rng=Math.random){state.last=sample(primerProbabilities(state),rng);return state.last;}

/** Independent teaching state. Only explicit bridge buttons touch the main lab. */
export function initializePrimer({document:doc=globalThis.document,onCompare=()=>{},onLayoutChange=()=>{}}={}){
 const state=createPrimerState(),$=id=>doc.getElementById(id);
 function render(){
  for(let i=0;i<3;i++){$(`primer-panel-${i}`).hidden=i!==state.step;$(`primer-step-${i}`).setAttribute('aria-pressed',i===state.step);}
  for(let i=0;i<2;i++){$(`primer-bit-${i}`).classList.toggle('active',state.bit===i);$(`primer-bit-${i}`).setAttribute('aria-label',`Bit ${i}${state.bit===i?' selected':''}`);}
  $('primer-bit-readout').textContent=`Current value: ${state.bit}. Read it: ${state.bit}.`;
  $('primer-phase-arrow').className=`amplitude-arrow ${state.phase===1?'positive':'negative'}`;
  $('primer-amplitude-value').textContent=state.phase===1?'+1/√2':'−1/√2';
  $('primer-phase-readout').textContent=state.phase===1?'A · arrows aligned · relative phase 0':'B · arrows opposed · relative phase π';
  $('primer-selected-prep').textContent=`Fresh preparation ${state.phase===1?'A':'B'}`;
  $('primer-single-result').textContent=state.last===null?'—':String(state.last);
 }
 function go(step){onLayoutChange();state.step=step;render();const control=$(`primer-step-${step}`);if(typeof control.focus==='function')control.focus({preventScroll:true});}
 for(let i=0;i<3;i++)$(`primer-step-${i}`).addEventListener('click',()=>go(i));
 $('primer-next-0').addEventListener('click',()=>go(1));$('primer-next-1').addEventListener('click',()=>go(2));
 $('primer-flip-bit').addEventListener('click',()=>{flipBit(state);render();});
 $('primer-flip-phase').addEventListener('click',()=>{flipPhase(state);render();});
 $('primer-measure').addEventListener('click',()=>{measureFreshPrimer(state);render();});
 for(const axis of ['Z','X'])$('primer-try-'+axis.toLowerCase()).addEventListener('click',()=>{onLayoutChange();$('qubit-primer').open=false;onCompare(axis);});
 $('qubit-primer').addEventListener('toggle',onLayoutChange);
 render();return state;
}
