const fs=require('fs'),vm=require('vm');const d=__dirname+'/../js/';
for (const f of ['util.js','engine/fft.js','engine/film_llg.js']) vm.runInThisContext(fs.readFileSync(d+f,'utf8'),{filename:f});
function test(D) {
  const nx=32,ny=32,c=new FilmCore(nx,ny,3e-9,{});
  c.Ms=580e3;c.A=15e-12;c.Kc=600e3;c.D=D;c.alpha.fill(0.4);
  c.mx.fill(0);c.my.fill(0);c.mz.fill(1);c.prepare();
  for(let k=0;k<600;k++)c.step(c.dt,k*c.dt);
  const mid=16, l=mid*nx, r=mid*nx+31, cen=mid*nx+mid, bot=mid,top=(ny-1)*nx+mid;
  const tup=[c.mx[l],c.mx[r],c.my[bot],c.my[top],c.mz[cen]];
  return tup.map(x=>+x.toFixed(4));
}
const no=test(0),dmi=test(3.5e-3);
console.log('sans D',no,'avec D',dmi);
if(no.some((v,i)=>Math.abs(v-(i===4?1:0))>1e-8)) throw Error('D=0 must remain uniform');
if(!(dmi[0]>0.01 && dmi[1]<-0.01 && dmi[2]>0.01 && dmi[3]<-0.01 && dmi[4]>0.98))throw Error('unexpected DMI edge canting');
console.log('Edge condition: test passed');
