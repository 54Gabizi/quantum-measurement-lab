import {probabilities,normalize} from './quantum.mjs';
import {project,unproject,trackball} from './geometry.mjs';
import {createExperiment,setAxis,clearResults} from './experiment.mjs';
import {createRunner} from './runner.mjs';
import {copy} from './i18n.mjs';
import {initializePrimer} from './primer.mjs';
import {createTour,startTour,exitTour,noteRunStart,noteRunCompletion,assessChallenge,outcomeLabels} from './tour.mjs';
const state=createExperiment();
const tour=createTour();
let tourRunId=null,challenge={active:false,movedAxis:false,viewMoved:false,feedback:'',success:false};
const lang='en';
let runProgress=null;
const recent=[[],[]];
const reduced=typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
const t=key=>copy[lang][key];
const $=id=>document.getElementById(id), svg=$('sphere');
const NS='http://www.w3.org/2000/svg',R=171,CX=300,CY=235;
let drag=null;
const fmt=x=>(Math.abs(x)<.0005?0:x).toFixed(2);
const pct=x=>`${Number((x*100).toFixed(1))}%`;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function element(name,attrs,text){const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function pos(v,scale=1){const p=project(v,state.camera);return [CX+R*p[0]*scale,CY-R*p[1]*scale,p[2]];}
function line(group,a,b,attrs){group.append(element('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],...attrs}));}
function arrow(group,v,color,width=2){const p=pos(v);line(group,[CX,CY],p,{stroke:color,'stroke-width':width});const dx=p[0]-CX,dy=p[1]-CY,l=Math.hypot(dx,dy);if(l>8){const ux=dx/l,uy=dy/l;group.append(element('path',{d:`M${p[0]},${p[1]} L${p[0]-ux*10-uy*4},${p[1]-uy*10+ux*4} L${p[0]-ux*10+uy*4},${p[1]-uy*10-ux*4} Z`,fill:color}));}return p;}
function drawSphere(){
 const grid=$('grid'),coordinates=$('coordinates'),vectors=$('vectors'),labels=$('labels'),handles=$('handles');
 for(const e of [grid,coordinates,vectors,labels,handles])e.replaceChildren();
 const circles=[];for(const z of [-.66,-.33,0,.33,.66]){const rr=Math.sqrt(1-z*z);circles.push(t=>[rr*Math.cos(t),rr*Math.sin(t),z]);}for(let i=0;i<6;i++){const a=i*Math.PI/6;circles.push(t=>[Math.cos(t)*Math.cos(a),Math.cos(t)*Math.sin(a),Math.sin(t)]);}
 for(const circle of circles){let prev=null;for(let j=0;j<=72;j++){const p=pos(circle(j*Math.PI/36));if(prev)line(grid,prev,p,{stroke:p[2]<0?'#1e3342':'#2c4a5c','stroke-width':.6,opacity:p[2]<0?.4:.7});prev=p;}}
 for(const [v,name] of [[[1,0,0],'X'],[[0,1,0],'Y'],[[0,0,1],'Z']]){line(coordinates,pos(v.map(x=>-x),1.13),pos(v,1.13),{stroke:'#4d6271','stroke-width':1,'stroke-dasharray':'3 5'});const p=pos(v,1.23);labels.append(element('text',{x:p[0],y:p[1],fill:'#91a8b8','text-anchor':'middle'},name));}
 const sorted=[{v:[1,0,0],c:'#9baeff',label:'A'},{v:[-1,0,0],c:'#e8ac71',label:'B'}].sort((a,b)=>project(a.v,state.camera)[2]-project(b.v,state.camera)[2]);
 for(const {v,c,label} of sorted){const p=arrow(vectors,v,c,2.5);vectors.append(element('circle',{cx:p[0],cy:p[1],r:5,fill:c}));labels.append(element('text',{x:p[0]+(p[0]>=CX?13:-13),y:p[1]+19,fill:c,'text-anchor':p[0]>=CX?'start':'end'},label));}
 line(vectors,pos(state.axis.map(x=>-x)),pos(state.axis),{stroke:'#62e6dd','stroke-width':2,'stroke-dasharray':'5 5',opacity:.85});
 const hitRadius=Math.max(22,22*600/Math.max(1,svg.getBoundingClientRect().width));
 for(const sign of [-1,1]){const p=pos(state.axis.map(x=>x*sign));handles.append(element('circle',{cx:p[0],cy:p[1],r:17,fill:'#62e6dd',opacity:.08,'pointer-events':'none'}));handles.append(element('circle',{cx:p[0],cy:p[1],r:8,fill:sign===1?'#62e6dd':'#0b2027',stroke:'#62e6dd','stroke-width':2,'pointer-events':'none'}));handles.append(element('circle',{cx:p[0],cy:p[1],r:hitRadius,fill:'transparent',class:'axis-handle','data-sign':sign,'aria-label':sign===1?'Positive measurement-axis drag handle':'Negative measurement-axis drag handle'}));labels.append(element('text',{x:p[0]+14,y:p[1]-13,fill:'#62e6dd'},sign===1?'1':'2'));}
}
function renderResults(){
 const names=outcomeLabels(state.axis),resultNames=[names.first,names.second];
 $('readout-note').textContent=names.first.includes('readout')?'Along Z, each outcome is read as a classical 0 or 1. Reversing the axis reverses the Result 1 / Result 2 mapping.':'Result 1 and Result 2 name this measurement’s outcomes. The Z direction maps them to the familiar classical readouts 0 and 1.';
 const total=state.counts[0][0]+state.counts[0][1];$('trial-count').textContent=total.toLocaleString();
 for(let i=0;i<2;i++){
  const p=probabilities([i===0?1:-1,0,0],state.axis);$('bar-'+i).style.width=pct(p[0]);
  for(let j=0;j<2;j++){$(`prob-${i}-${j}`).textContent=pct(p[j]);$(`label-${i}-${j}`).textContent=resultNames[j];$(`detector-label-${i}-${j}`).textContent=resultNames[j];$(`mobile-detector-label-${i}-${j}`).textContent=resultNames[j];}
  const c=state.counts[i];for(let j=0;j<2;j++)$(`mobile-count-${i}-${j}`).textContent=`${c[j]} · ${total?pct(c[j]/total):'—'}`;$('observed-'+i).textContent=total?`${t('result1')}: ${c[0]} (${pct(c[0]/total)}) · ${t('result2')}: ${c[1]} (${pct(c[1]/total)})`:t('empty');
  $('observed-bar-'+i).style.width=total?pct(c[0]/total):'0%';$('last-'+i).textContent=state.last[i]===null?t('empty'):t('last')+resultNames[state.last[i]];
 }
 const d=Math.abs(state.axis[0]),key=d>1-1e-8?'certain':d<.0001?'same':'partial';
 $('insight-title').textContent=t(key+'Title');$('insight-copy').textContent=t(key+'Copy');
}
function render(){
 drawSphere();$('axis-readout').textContent=`(${state.axis.map(fmt).join(', ')})`;
 const polar=Math.acos(Math.max(-1,Math.min(1,state.axis[2])))*180/Math.PI;
 let azimuth=Math.atan2(state.axis[1],state.axis[0])*180/Math.PI;if(Math.abs(state.axis[0])+Math.abs(state.axis[1])<1e-9)azimuth=Number($('azimuth').value);
 $('polar').value=Math.round(polar);$('azimuth').value=Math.round(azimuth);$('polar-output').textContent=`${Math.round(polar)}°`;$('azimuth-output').textContent=`${Math.round(azimuth)}°`;
 $('preset-x').setAttribute('aria-pressed',Math.abs(state.axis[0]-1)<1e-8);$('preset-z').setAttribute('aria-pressed',Math.abs(state.axis[2]-1)<1e-8);renderResults();
}
function clearParticles(){for(let i=0;i<2;i++){recent[i]=[];$('particle-overlay').replaceChildren();for(let j=0;j<2;j++)$(`dots-${i}-${j}`).replaceChildren();}}
function showParticles(last){
 for(let i=0;i<2;i++){
  recent[i].push(last[i]);if(recent[i].length>100)recent[i].shift();
  for(let j=0;j<2;j++){const dots=$(`dots-${i}-${j}`);dots.replaceChildren();for(const result of recent[i])if(result===j){const dot=document.createElement('i');dot.className='result-dot';dots.append(dot);}}

 }
}
function launchParticles(shot){
 const overlay=$('particle-overlay');
 if(reduced.matches){$('flight-note').textContent=t('reduced');return 0;}
 const box=svg.getBoundingClientRect();
 const source={x:box.left+box.width*.5,y:box.top+box.height*CY/460};
 const targets=shot.last.map((result,i)=>{const targetId=window.innerWidth<=780?`mobile-detector-${i}-${result}`:`detector-${i}-${result}`;const b=$(targetId).getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+Math.min(30,b.height/2)};});
 const visible=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=8&&p.x<=window.innerWidth-8&&p.y>=8&&p.y<=window.innerHeight-8;
 if(!visible(source)||targets.some(p=>!visible(p))){$('flight-note').textContent=t('offscreen');return 0;}
 $('flight-note').textContent='';
 for(let i=0;i<2;i++){
  const particle=document.createElement('i');particle.className='sphere-particle';particle.setAttribute('data-preparation',i===0?'A':'B');particle.setAttribute('data-outcome',shot.last[i]);
  for(const [key,value]of Object.entries({'--from-x':source.x+'px','--from-y':source.y+'px','--to-x':targets[i].x+'px','--to-y':targets[i].y+'px','--particle-color':i===0?'#9baeff':'#e8ac71'}))particle.style.setProperty(key,value);
  particle.addEventListener('animationend',()=>particle.remove());overlay.append(particle);
 }
 return 350;
}
function displayProgress(){if(!runProgress)return;$('status').textContent=runProgress.running?`${t('running')} ${runProgress.completed} / ${runProgress.total} · ${t('countWord')}`:runProgress.cancelled?t('stopped'):`${t('completed')} · ${runProgress.completed} ${t('countWord')}`;}
const runner=createRunner({state,interval:65,onPrepare:launchParticles,onShot:shot=>{runProgress={running:true,completed:shot.index,total:shot.total};showParticles(shot.last);renderResults();if(shot.index%10===0||shot.total===1){displayProgress();renderGuide();}},onStatus:status=>{runProgress=status;if(status.running){tourRunId=noteRunStart(tour,{axis:state.axis,total:status.total});}else{noteRunCompletion(tour,{runId:tourRunId,axis:state.axis,completed:status.completed,total:status.total,cancelled:status.cancelled});tourRunId=null;}if(!status.running)$('particle-overlay').replaceChildren();$('measure-one').disabled=status.running;$('measure-batch').disabled=status.running;$('mobile-one').disabled=status.running;$('mobile-batch').disabled=status.running;$('stop-run').hidden=!status.running;$('mobile-stop').hidden=!status.running;for(let i=0;i<2;i++)$('stage-'+i).classList.toggle('running',status.running);displayProgress();renderGuide();}});
function changeAxis(n){const next=normalize(n);if(next.some((x,i)=>Math.abs(x-state.axis[i])>1e-12)){runner.cancel();setAxis(state,next);if(challenge.active){challenge.movedAxis=true;challenge.success=false;challenge.feedback='Direction changed. Measure at least once, then check whether the theoretical outcomes separate A and B.';}clearParticles();runProgress=null;$('status').textContent=t('changed');}render();renderGuide();}
$('preset-x').addEventListener('click',()=>changeAxis([1,0,0]));$('preset-z').addEventListener('click',()=>changeAxis([0,0,1]));
for(const [id,n]of [['measure-one',1],['measure-batch',100],['mobile-one',1],['mobile-batch',100]])$(id).addEventListener('click',()=>runner.start(n));
for(const id of ['stop-run','mobile-stop'])$(id).addEventListener('click',()=>{runner.cancel();$('particle-overlay').replaceChildren();});
$('clear-results').addEventListener('click',()=>{runner.cancel();clearResults(state);clearParticles();runProgress=null;render();$('status').textContent=t('cleared');if(challenge.active){challenge.success=false;challenge.feedback='Results cleared. Measure at this direction again before checking.';renderGuide();}});
$('reset-view').addEventListener('click',()=>{state.camera={yaw:-.45,pitch:.25};drawSphere();if(!runner.isRunning())$('status').textContent=t('viewReset');});
for(const id of ['polar','azimuth'])$(id).addEventListener('input',()=>{const a=Number($('polar').value)*Math.PI/180,p=Number($('azimuth').value)*Math.PI/180;changeAxis([Math.sin(a)*Math.cos(p),Math.sin(a)*Math.sin(p),Math.cos(a)]);});
function pointer(e){const b=svg.getBoundingClientRect();return [(e.clientX-b.left)/b.width*600,(e.clientY-b.top)/b.height*460];}
function spherePoint(p,hemisphere=1){const v=trackball((p[0]-CX)/R,(CY-p[1])/R);return [v[0],v[1],v[2]*hemisphere];}
function rotateBetween(v,a,b){const c=Math.max(-1,Math.min(1,dot(a,b))),k=cross(a,b),s=Math.hypot(...k);if(s<1e-9){if(c>=0)return v;const seed=Math.abs(a[0])<.8?[1,0,0]:[0,1,0];const u=normalize(cross(a,seed)),uv=dot(u,v);return normalize(v.map((x,i)=>2*u[i]*uv-x));}const u=k.map(x=>x/s),uv=dot(u,v),uxv=cross(u,v);return normalize(v.map((x,i)=>x*c+uxv[i]*s+u[i]*uv*(1-c)));}
svg.addEventListener('pointerdown',e=>{if(e.button!==0||drag)return;const p=pointer(e);const sign=Number(e.target.getAttribute('data-sign'));drag={id:e.pointerId,type:sign?'axis':'view',sign:sign||1,hemisphere:project(state.axis,state.camera)[2]*(sign||1)<0?-1:1,last:p};svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');$('gesture-hint').textContent=t(drag.type==='axis'?'dragAxis':'dragView');e.preventDefault();});
svg.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=pointer(e),last=drag.last;drag.last=p;if(drag.type==='view'){state.camera.yaw-=(p[0]-last[0])*.008;state.camera.pitch=Math.max(-1.4,Math.min(1.4,state.camera.pitch+(p[1]-last[1])*.008));drawSphere();if(challenge.active){challenge.viewMoved=true;challenge.feedback='Only the viewpoint moved. The measurement direction, probabilities, and results are unchanged.';renderGuide();}}else{const a=spherePoint(last,drag.hemisphere),b=spherePoint(p,drag.hemisphere),v=project(state.axis,state.camera);changeAxis(unproject(rotateBetween(v,a,b),state.camera));}e.preventDefault();});
function endDrag(e){if(!drag||drag.id!==e.pointerId)return;drag=null;svg.classList.remove('dragging');if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);$('gesture-hint').textContent=t('hint');}
svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);svg.addEventListener('lostpointercapture',endDrag);
function applyEnglish(){document.documentElement.lang='en';for(const e of document.querySelectorAll('[data-i18n]'))e.textContent=t(e.getAttribute('data-i18n'));$('gesture-hint').textContent=t('hint');render();$('status').textContent=t('ready');}
function viewportChanged(){if(runner.isRunning()){runner.cancel();$('particle-overlay').replaceChildren();$('status').textContent=t('viewportStopped');}}
applyEnglish();window.addEventListener('resize',()=>{viewportChanged();drawSphere();});window.addEventListener('scroll',viewportChanged,{passive:true});

if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{if(document.hidden)viewportChanged();});

$('direction-details').addEventListener('toggle',viewportChanged);

initializePrimer({onLayoutChange:viewportChanged,onCompare:axis=>{changeAxis(axis==='X'?[1,0,0]:[0,0,1]);if(typeof svg.scrollIntoView==='function')svg.scrollIntoView({block:'center',behavior:'instant'});$('status').textContent=axis==='X'?'X reveals the phase difference: A and B give opposite results.':'Z gives the same 50/50 probabilities for A and B. Try a measurement.';}});

function renderGuide(){
 const focused=document.activeElement;
 const active=tour.active,step=tour.step,busy=runner.isRunning();
 const show={start:!active,z:active&&step==='z',x:active&&step==='x','begin-challenge':active&&step==='done'&&!challenge.active,check:active&&challenge.active,retry:active&&challenge.active,exit:active};
 for(const [key,visible]of Object.entries(show))$('guide-'+key).hidden=!visible;
 $('guide-z').disabled=busy;$('guide-x').disabled=busy;$('guide-check').disabled=busy;
 for(const [key,current,complete]of [['z',active&&step==='z',active&&['x','done'].includes(step)],['x',active&&step==='x',active&&step==='done'],['challenge',active&&step==='done',challenge.success]]){const e=$('guide-path-'+key);e.classList.toggle('current',current);e.classList.toggle('complete',complete);}
 let title='Can one measurement tell two preparations apart?',body='Measure 100 freshly prepared particles from A and B in Z, compare them in X, then find a distinguishing direction yourself.',feedback='The guide is optional. Exit keeps your current setting, results, and any run in progress.';
 if(active&&step==='z'){title='1 · Start with the same odds in Z.';body='Set Z and open the experiment, then press Play 100 beside the sphere. Theory predicts 50/50 for both; a finite sample may look uneven.';feedback='A matching histogram is not proof that the states are identical. Wait for all 100 arrivals to continue.';}
 if(active&&step==='x'){title='2 · Change the measurement, keep the preparations.';body='Set X, then press Play 100 beside the sphere. Ideal theory predicts opposite, certain outcomes for A and B.';feedback='Your Z run finished. The difference comes from the measurement direction, not a new preparation.';}
 if(active&&step==='done'){title=challenge.active?'3 · Find a direction that reliably separates A and B.':'Two measurements, two different stories.';body=challenge.active?'A and B stay fixed. Adjust the cyan measurement axis, measure at least once, then check. Either orientation of a distinguishing axis counts.':'Z has the same theoretical probabilities for both; X has opposite deterministic outcomes. The theory explains the contrast, not the sample size.';feedback=challenge.active?challenge.feedback:'Now test yourself: start the challenge at Z and find a direction that distinguishes the two preparations.';}
 if(active&&['z','x'].includes(step)&&busy)feedback=tour.run?.eligible?`${runProgress.completed} / 100 arrivals completed. The guide advances only when this entire run finishes.`:'This run does not match the current step. You can explore freely, then run the requested 100-trial comparison.';
 $('guide-title').textContent=title;$('guide-copy').textContent=body;$('guide-feedback').textContent=feedback;$('guide-mode').textContent=active?'GUIDED EXPERIMENT':'OPTIONAL GUIDED EXPERIMENT';
 let labHint='Free experiment: choose a direction and play 100 trials.',labAction='Start guide';
 if(active&&step==='z'){labHint=busy?(tour.run?.eligible?`Guide 1 · ${runProgress.completed}/100 arrived. Finish the Z comparison.`:'Free run: it will not advance the guide. Next, set Z and play 100.'):'Guide 1 · Set Z, then press Play 100. Expect similar odds, with sampling noise.';labAction='Set Z';}
 if(active&&step==='x'){labHint=busy?(tour.run?.eligible?`Guide 2 · ${runProgress.completed}/100 arrived. Finish the X comparison.`:'Free run: it will not advance the guide. Next, set X and play 100.'):'Guide 2 · Set X, then press Play 100. The preparations stay unchanged.';labAction='Set X';}
 if(active&&step==='done'){labHint='Z hid the difference; X revealed it. Ready for a short challenge?';labAction='Challenge';}
 if(active&&challenge.active){labHint=challenge.success?'Correct: an exact distinguishing axis, verified with actual measurements.':challenge.viewMoved&&!challenge.movedAxis?'Camera motion only changes the view. Move the cyan measurement axis.':'Challenge: move the axis, measure at least once, then Check.';labAction='Check';}
 $('lab-guide-hint').textContent=labHint;$('lab-guide-action').textContent=labAction;$('lab-guide-action').disabled=busy&&active;$('lab-guide-exit').hidden=!active;
 if(focused&&Object.values(show).some(Boolean)&&Object.keys(show).some(key=>$('guide-'+key)===focused&&!show[key])){const next=Object.keys(show).find(key=>show[key]&&key!=='exit');if(next&&typeof $('guide-'+next).focus==='function')$('guide-'+next).focus({preventScroll:true});}

}
$('guide-start').addEventListener('click',()=>{startTour(tour);challenge={active:false,movedAxis:false,viewMoved:false,feedback:'',success:false};renderGuide();});
function openGuideAxis(axis){if(runner.isRunning())return;changeAxis(axis==='Z'?[0,0,1]:[1,0,0]);if(typeof svg.scrollIntoView==='function')svg.scrollIntoView({block:'center',behavior:'instant'});const play=$(window.innerWidth<=780?'mobile-batch':'measure-batch');if(typeof play.focus==='function')play.focus({preventScroll:true});$('status').textContent=`${axis} selected. Press Play 100 in the experiment to complete this guide step.`;}
for(const axis of ['Z','X'])$('guide-'+axis.toLowerCase()).addEventListener('click',()=>openGuideAxis(axis));
function beginChallenge(){runner.cancel();challenge.active=false;changeAxis([0,0,1]);clearResults(state);clearParticles();runProgress=null;challenge={active:true,movedAxis:false,viewMoved:false,success:false,feedback:'Starting at Z with empty statistics. Move the measurement axis; moving the camera alone will not change the odds.'};render();renderGuide();$('status').textContent='Challenge reset to Z. Preparations A and B are unchanged.';}
$('guide-begin-challenge').addEventListener('click',beginChallenge);$('guide-retry').addEventListener('click',beginChallenge);
function checkChallenge(){if(!challenge.active||runner.isRunning())return;const verdict=assessChallenge(state.axis,{measuredTrials:state.counts[0][0]+state.counts[0][1]});challenge.success=challenge.movedAxis&&verdict.success;if(challenge.success)challenge.feedback='You found it: theory gives opposite, certain outcomes, and you tested this direction. The preparations stayed fixed.';else if(!challenge.movedAxis)challenge.feedback=challenge.viewMoved?'Only the view changed. Move the cyan measurement axis, not the camera, then measure.':'The measurement axis has not changed from Z. Move the cyan handle, then measure.';else if(!verdict.axisAligned)challenge.feedback='Not yet. A lucky finite sample or rounded 100% display is not proof. Perfect separation needs an exact distinguishing axis; use the precise direction controls if needed.';else challenge.feedback='This direction has opposite, certain theoretical outcomes. Measure at least one fresh trial per preparation, then check again.';renderGuide();$('lab-guide-hint').textContent=challenge.feedback;}
$('guide-check').addEventListener('click',checkChallenge);
$('guide-exit').addEventListener('click',()=>{exitTour(tour);challenge.active=false;challenge.success=false;renderGuide();if(typeof $('guide-start').focus==='function')$('guide-start').focus({preventScroll:true});});
renderGuide();

$('lab-guide-action').addEventListener('click',()=>{if(!tour.active){startTour(tour);challenge={active:false,movedAxis:false,viewMoved:false,feedback:'',success:false};renderGuide();}else if(challenge.active)checkChallenge();else if(tour.step==='done')beginChallenge();else if(!runner.isRunning())changeAxis(tour.step==='z'?[0,0,1]:[1,0,0]);});

$('lab-guide-exit').addEventListener('click',()=>{exitTour(tour);challenge.active=false;challenge.success=false;renderGuide();if(typeof $('lab-guide-action').focus==='function')$('lab-guide-action').focus({preventScroll:true});});
