// Test reproductible du préréglage rapide (Node.js, ~quelques secondes).
// Ne simule aucun laser réel. Q est une approximation différentielle.
const fs=require('fs'),vm=require('vm');
const d=__dirname+'/../js/';
global.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})})})};
for(const f of ['util.js','engine/fft.js','engine/film_llg.js','sim_base.js','viz.js','sims_macro.js','sandbox.js']) vm.runInThisContext(fs.readFileSync(d+f,'utf8'),{filename:f});
const p={...SANDBOX_MATERIALS.sky,sensorGain:0};
const s=new SandboxSim({setParamUI:()=>{}},p);
s.action('laser');
for(let i=0;i<35000;i++){s.core.step(s.core.dt,s.t);s.t+=s.core.dt;}
s.afterFrame();
let count=0,minimum=1;for(const z of s.core.mz){if(z<0)count++;if(z<minimum)minimum=z;}
console.log('t(ns)=',+(s.t*1e9).toFixed(3),'Q=',+s.Q.toFixed(4),'mz_min=',+minimum.toFixed(4),'cells_mz<0=',count);
if(!(s.t>3.5e-9 && s.Q<-.7 && minimum<-.8 && count>10))throw Error('Graine effondrée ou charge insuffisante.');
