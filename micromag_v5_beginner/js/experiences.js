/* Expériences d'entrée : modèles pédagogiques autonomes, non substituts à OOMMF.
   Les modes micromagnétiques avancés restent dans sims_film.js / engine/. */

class FilingExperience extends SimBase {
  constructor(host, p) { super(host,p); this.x = 0.5; this.y = 0.5; this.obs = {}; }
  update() {}
  tap(x,y) { const c = document.getElementById('view'); this.x = Math.min(.85, Math.max(.15,x/c._w)); this.y = Math.min(.83, Math.max(.17,y/c._h)); }
  reset() { this.x=.5; this.y=.5; }
  action(id) { if (id==='reset') this.reset(); }
  field(x,y) {
    const a=this.p.angle*Math.PI/180, mx=Math.cos(a), my=Math.sin(a), dx=x-this.x,dy=y-this.y;
    const r2=dx*dx+dy*dy+.006, r=Math.sqrt(r2), dot=mx*dx+my*dy, inv=Math.pow(r,-5);
    const k=.00065*this.p.power;
    return [k*(3*dot*dx-r2*mx)*inv+this.p.Bx, k*(3*dot*dy-r2*my)*inv+this.p.By];
  }
  draw(ctx,W,H) {
    ctx.fillStyle='#111d2b'; ctx.fillRect(0,0,W,H);
    const nX=Math.max(16,Math.round(W/19)), nY=Math.max(14,Math.round(H/19));
    for(let j=0;j<nY;j++) for(let i=0;i<nX;i++) {
      const x=(i+.5)/nX, y=(j+.5)/nY, dx=x-this.x,dy=y-this.y;
      if(Math.hypot(dx,dy)<.115) continue;
      const b=this.field(x,y), a=Math.atan2(b[1],b[0]), m=Math.hypot(...b), sz= Math.min(10,3+Math.log1p(m)*2.5);
      ctx.save(); ctx.translate(x*W,y*H);ctx.rotate(a);ctx.strokeStyle=`rgba(229,237,226,${Math.min(.95,.36+Math.log1p(m)*.22)})`;
      ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(-sz/2,0);ctx.lineTo(sz/2,0);ctx.stroke();ctx.restore();
    }
    const a=this.p.angle*Math.PI/180;
    ctx.save(); ctx.translate(this.x*W,this.y*H);ctx.rotate(a);const mw=Math.min(W,H)*.23,mh=Math.min(W,H)*.065;
    ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=15;ctx.fillStyle='#cc695d';ctx.fillRect(-mw/2,-mh/2,mw/2,mh);ctx.fillStyle='#6b9ecc';ctx.fillRect(0,-mh/2,mw/2,mh);ctx.shadowBlur=0;
    ctx.font='bold 12px system-ui';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('N',-mw/4,4);ctx.fillText('S',mw/4,4);ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.65)';ctx.font='12px system-ui';ctx.fillText('Touche la surface pour déplacer l’aimant',14,H-15);
  }
  hud(){return [['Modèle','Champ dipolaire simplifié'],['Limaille','Visualisation virtuelle']];}
  drawPlots(p1,p2){p1.begin('Direction du champ',0,1,0,1,'x / L','y / L');p2.begin('Intensité relative',0,1,0,1,'x / L','relative');}
}

class CurieExperience extends SimBase {
  constructor(h,p){super(h,p);this.NX=44;this.NY=32;this.spins=new Int8Array(this.NX*this.NY);this.baseT=p.T;this.shakeCount=0;this.obs={};this.reset();}
  reset(){this.spins.fill(1);this.t=0;this.shakeCount=0;this.obs={m:1};}
  action(id){if(id==='reset')this.reset();if(id==='shake')this.phoneShake();}
  phoneShake(){this.shakeCount++;this.p.T=Math.min(4.5,Math.max(this.p.T,2.9));this.host.setParamUI('T',this.p.T);this.host.toast('Secousse : température virtuelle augmentée (le téléphone ne chauffe pas l’échantillon).');}
  onParam(id,v){if(id==='T')this.baseT=v;}
  setPhoneShake(){this.phoneShake();}
  update(dt,speed){const nx=this.NX,ny=this.NY,s=this.spins,T=Math.max(.1,this.p.T);
    for(let k=0;k<Math.min(4000,Math.round(750*speed));k++){
      const i=(Math.random()*nx)|0, j=(Math.random()*ny)|0, q=i+j*nx, m=s[q], nb=s[(i+1)%nx+j*nx]+s[(i+nx-1)%nx+j*nx]+s[i+((j+1)%ny)*nx]+s[i+((j+ny-1)%ny)*nx];
      const de=2*m*(nb+this.p.H);
      if(de<=0||Math.random()<Math.exp(-de/T))s[q]=-m;
    }
    let mag=0;for(let q=0;q<s.length;q++)mag+=s[q];this.obs={m:mag/s.length};this.t+=dt;
  }
  draw(ctx,W,H){ctx.fillStyle='#142134';ctx.fillRect(0,0,W,H);const cw=W/this.NX,ch=H/this.NY;
    for(let j=0;j<this.NY;j++)for(let i=0;i<this.NX;i++){ctx.fillStyle=this.spins[i+j*this.NX]>0?'#e7a176':'#679cc6';ctx.fillRect(i*cw,j*ch,Math.ceil(cw),Math.ceil(ch));}
    ctx.fillStyle='rgba(14,24,38,.82)';ctx.fillRect(12,H-42,Math.min(W-24,310),29);ctx.fillStyle='#fff';ctx.font='13px system-ui';ctx.fillText('Spins Ising 2D • température en J/kB',20,H-23);
  }
  hud(){return [['T / (J/kB)',this.p.T.toFixed(2)],['|m|',Math.abs(this.obs.m||0).toFixed(2)],['Tc théorique, H=0','≈ 2,269']];}
  drawPlots(p1,p2){p1.begin('Aimantation instantanée',0,1,-1,1,'','m');p2.begin('Modèle d’Ising 2D',0,1,0,1,'','');}
}

class BarkhausenExperience extends SimBase {
  constructor(h,p){super(h,p);this.nx=38;this.ny=24;this.s=new Int8Array(this.nx*this.ny);this.rng=new Float32Array(this.s.length);this.t=0;this.history=[];this.reset();}
  reset(){this.s.fill(-1);for(let i=0;i<this.rng.length;i++)this.rng[i]=(Math.random()+Math.random()+Math.random()-1.5)*2;this.p.H=-3;this.host.setParamUI('H',-3);this.history=[];this.obs={m:-1,aval:0};}
  onParam(id){if(id==='H'||id==='J'||id==='disorder')this.relax();}
  action(id){if(id==='reset')this.reset();if(id==='step'){this.p.H=Math.min(3,this.p.H+.14);this.host.setParamUI('H',this.p.H);this.relax();}}
  relax(){let flips=0;const H=this.p.H,J=this.p.J,dis=this.p.disorder,N=this.s.length;
    // relaxation monotone ascendante d’un RFIM athermique : tous les spins instables
    // sont retournés un à un jusqu’à l’état localement stable (ordre aléatoire).
    for(let pass=0;pass<30;pass++){
      let changed=false;
      for(let t=0;t<N;t++){
        const x=(Math.random()*this.nx)|0,y=(Math.random()*this.ny)|0,q=x+y*this.nx;
        const m=this.s[q];let sum=0;
        if(x>0)sum+=this.s[q-1];if(x<this.nx-1)sum+=this.s[q+1];
        if(y>0)sum+=this.s[q-this.nx];if(y<this.ny-1)sum+=this.s[q+this.nx];
        if(m*(H+J*sum+dis*this.rng[q])<0){this.s[q]=-m;flips++;changed=true;}
      }
      if(!changed)break;
    }
    let m=0;for(const spin of this.s)m+=spin;
    this.obs={m:m/N,aval:flips};this.history.push({H,m:this.obs.m,aval:flips});if(this.history.length>180)this.history.shift();
  }
  update(dt,speed){this.t+=dt;if(this.p.auto){const next=this.p.H+.18*dt*speed;if(next>3){this.reset();return;}this.p.H=next;this.host.setParamUI('H',next);this.relax();}}
  draw(ctx,W,H){ctx.fillStyle='#162238';ctx.fillRect(0,0,W,H);const cw=W/this.nx,ch=H/this.ny;
    for(let j=0;j<this.ny;j++)for(let i=0;i<this.nx;i++){ctx.fillStyle=this.s[i+j*this.nx]>0?'#e1ae77':'#668ab4';ctx.fillRect(i*cw,j*ch,Math.ceil(cw),Math.ceil(ch));}
    ctx.fillStyle='rgba(15,25,40,.86)';ctx.fillRect(10,H-36,Math.min(W-20,290),27);ctx.fillStyle='#fff';ctx.font='13px system-ui';ctx.fillText('Modèle RFIM athermique 2D',19,H-18);
  }
  hud(){return [['Champ réduit H',this.p.H.toFixed(2)],['Aimantation m',(this.obs.m||0).toFixed(2)],['Spins retournés',this.obs.aval||0]];}
  drawPlots(p1,p2){p1.begin('Cycle M(H)',-3,3,-1,1,'H (réduit)','m');p2.begin('Avalanches',-3,3,0,Math.max(1,...this.history.map(q=>q.aval)),'H (réduit)','N');if(this.history.length>1){p1.line(this.history.map(q=>q.H),this.history.map(q=>q.m),'#a97848',2);p2.line(this.history.map(q=>q.H),this.history.map(q=>q.aval),'#4a87ab',2);}}
}

class DiskExperience extends SimBase {
  constructor(h,p){super(h,p);this.nx=12;this.ny=5;this.bits=new Int8Array(60);this.hc=new Float32Array(60);this.reset();}
  reset(){for(let i=0;i<60;i++){this.hc[i]=.6+Math.random()*.8;this.bits[i]=Math.random()>.5?1:-1;}this.obs={lost:0};}
  update(){}
  onParam(id){if(id==='H'){let lost=0;for(let i=0;i<60;i++){if(Math.abs(this.p.H)>=this.hc[i]&&this.bits[i]!==Math.sign(this.p.H)){this.bits[i]=Math.sign(this.p.H);lost++;}}this.obs={lost};}}
  action(id){if(id==='write')this.reset();if(id==='erase'){this.p.H=2;this.host.setParamUI('H',2);this.onParam('H');}}
  tap(x,y){const c=document.getElementById('view'),i=Math.floor(x/c._w*12),j=Math.floor(y/c._h*5);if(i>=0&&i<12&&j>=0&&j<5)this.bits[i+j*12]*=-1;}
  draw(ctx,W,H){ctx.fillStyle='#112033';ctx.fillRect(0,0,W,H);const gap=3,cw=W/12,ch=H/5;
    for(let j=0;j<5;j++)for(let i=0;i<12;i++){const bit=this.bits[i+j*12],x=i*cw,y=j*ch;
      ctx.fillStyle=bit>0?'#d2a06e':'#699fc2';ctx.fillRect(x+gap,y+gap,cw-2*gap,ch-2*gap);ctx.fillStyle='#13253a';ctx.textAlign='center';ctx.font='bold '+Math.min(19,ch*.46)+'px system-ui';ctx.fillText(bit>0?'↑':'↓',x+cw/2,y+ch*.62);
    }
  }
  hud(){return [['Champ réduit',this.p.H.toFixed(2)],['Bits changés (dernier réglage)',this.obs.lost||0],['Modèle','Seuils indépendants']];}
  drawPlots(p1,p2){p1.begin('Mémoire : état rémanent',0,1,0,1,'','');p2.begin('Seuils de retournement',0,1,0,1,'','');}
}

class PocketMagnetometer extends SimBase {
  constructor(h,p){super(h,p);this.mag=null;this.read=null;this.status='Appuie sur Mesurer';this.hist=[];this.obs={};}
  update(){}
  async action(id){if(id==='stop'){this.leave();this.status='Mesure arrêtée';return;}
    if(id==='compass'){this.host.open('compass','lab');return;}
    if(id!=='measure')return;
    if(!window.isSecureContext){this.status='HTTPS ou localhost requis';return;}
    if(!('Magnetometer' in window)){this.status='API Magnetometer indisponible dans ce navigateur';return;}
    try{
      this.leave();const magnet=new window.Magnetometer({frequency:10});this.mag=magnet;
      magnet.addEventListener('reading',()=>{if(this.mag!==magnet)return;this.read=[magnet.x,magnet.y,magnet.z];this.obs={norm:Math.hypot(...this.read)};this.hist.push(this.obs.norm);if(this.hist.length>120)this.hist.shift();this.status='Mesure active';});
      magnet.addEventListener('error',(e)=>{this.status='Capteur inaccessible : '+(e.error&&e.error.name||'accès refusé');this.leave();});
      magnet.start();this.status='Autorisation / capteur en cours…';
    }catch(e){this.status='Erreur : '+e.message;this.leave();}
  }
  leave(){if(this.mag){try{this.mag.stop();}catch(e){}this.mag=null;}}
  draw(ctx,W,H){ctx.fillStyle='#102036';ctx.fillRect(0,0,W,H);const cx=W/2,cy=H/2,r=Math.min(W,H)*.28;
    ctx.strokeStyle='rgba(203,221,229,.2)';ctx.lineWidth=2;for(let k=1;k<=3;k++){ctx.beginPath();ctx.arc(cx,cy,r*k/3,0,2*Math.PI);ctx.stroke();}
    ctx.strokeStyle='#a0b7c9';ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke();
    if(this.read){const a=Math.atan2(this.read[1],this.read[0]),L=r*Math.min(1,this.obs.norm/100);ctx.strokeStyle='#ec9b6d';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*L,cy-Math.sin(a)*L);ctx.stroke();}
    ctx.fillStyle='#eaf1f8';ctx.textAlign='center';ctx.font='14px system-ui';ctx.fillText(this.status,cx,H-33);
  }
  hud(){return [['Norme du champ',this.read?this.obs.norm.toFixed(1)+' µT':'—'],['Mesure',this.read?'Réelle, si capteur autorisé':'Non disponible']];}
  drawPlots(p1,p2){p1.begin('Historique du module',0,Math.max(10,this.hist.length),0,Math.max(80,...this.hist),'échantillon','µT');if(this.hist.length>1)p1.line(this.hist.map((_,i)=>i),this.hist,'#5799c4',2);p2.begin('Mesure tridimensionnelle',0,1,0,1,'','');}
}

const EXPERIENCE_MODELS=[
  {id:'filings',pack:'experiences',icon:'✳',name:'La limaille de fer',tagline:'Dessine un champ invisible',intro:'Une limaille virtuelle s’oriente selon un champ dipolaire calculé. Déplace l’aimant du doigt et ajoute un champ uniforme. Il ne s’agit pas d’une simulation de grains ferromagnétiques en interaction.',
   params:[{id:'angle',label:'Orientation de l’aimant',unit:'°',min:0,max:180,step:5,value:0},{id:'power',label:'Moment dipolaire relatif',min:.2,max:3,step:.1,value:1,digits:1},{id:'Bx',label:'Champ externe Bx relatif',min:-3,max:3,step:.1,value:0,digits:1},{id:'By',label:'Champ externe By relatif',min:-3,max:3,step:.1,value:0,digits:1}],buttons:[{id:'reset',label:'Recentrer'}],whatIf:[{label:'Tourner de 90°',set:{angle:90}},{label:'Champ externe latéral',set:{Bx:2}}],observe:['Le dipôle produit des lignes de champ fermées ; la limaille s’aligne localement sur la direction du champ.','Le dessin des grains est une représentation, sans interaction mécanique entre particules.'],why:'<p>À distance du dipôle, le champ varie comme 1/r³. Les segments représentent uniquement la direction locale du champ calculé.</p>',ub:{classes:['Champ dipolaire analytique'],text:'Les simulations micromagnétiques avancées utilisent un champ magnétostatique calculé sur toute la géométrie.'},challenges:[],create:(h,d)=>new FilingExperience(h,d)},
  {id:'pocket',pack:'experiences',icon:'◉',name:'Magnétomètre de poche',tagline:'Mesure réelle si le navigateur l’autorise',intro:'Mesurer le module du champ magnétique avec un capteur compatible, uniquement après ton autorisation. L’orientation du téléphone et la mesure magnétique sont des fonctions distinctes.',params:[],buttons:[{id:'measure',label:'Démarrer la mesure'},{id:'stop',label:'Arrêter'},{id:'compass',label:'Explorer la boussole simulée'}],whatIf:[],observe:['La mesure réelle nécessite un téléphone, un navigateur compatible, HTTPS et une autorisation.','La plupart des navigateurs ne proposent pas l’API Magnetometer. Aucune valeur artificielle n’est présentée comme une mesure réelle.'],why:'<p>Le module du champ est calculé par B=√(Bx²+By²+Bz²). L’API Magnetometer est expérimentale et peut être bloquée.</p>',ub:{classes:['Generic Sensor API'],text:'API navigateur, pas un composant de la LLG.'},challenges:[],create:(h,d)=>new PocketMagnetometer(h,d)},
  {id:'curie',pack:'experiences',icon:'♨',name:'Température de Curie',tagline:'Ordre et fluctuations des spins',intro:'Un modèle d’Ising ferromagnétique bidimensionnel montre comment l’ordre disparaît lorsque T augmente. Une secousse du téléphone peut augmenter symboliquement la température virtuelle.',params:[{id:'T',label:'Température réduite T/(J/kB)',min:.5,max:4.5,step:.1,value:1.5,digits:1,help:'Le modèle Ising 2D sur réseau carré a Tc≈2,269 (champ nul, limite thermodynamique). Ici, les fluctuations sont fortes près de Tc.'},{id:'H',label:'Champ réduit H/J',min:-1,max:1,step:.05,value:0,digits:2}],buttons:[{id:'shake',label:'Secousse virtuelle : augmenter T'},{id:'reset',label:'Réinitialiser les spins'}],whatIf:[{label:'Sous Tc',set:{T:1.2}},{label:'Au-dessus de Tc',set:{T:3.3}}],observe:['Sous Tc, des domaines orientés apparaissent ; au-dessus, les spins sont fortement désordonnés.','Le nombre de spins est fini : la transition est arrondie. Secouer un téléphone ne chauffe pas un matériau réel.'],why:'<p>Le modèle d’Ising 2D applique une énergie E=−JΣsᵢsⱼ−HΣsᵢ. Les probabilités de retournement suivent Metropolis. Ce n’est pas une dynamique LLG ni un modèle quantitatif de température de Curie d’un matériau.</p>',ub:{classes:['Ising 2D','Monte Carlo Metropolis'],text:'Démonstration de mécanique statistique, distincte de la micromagnétique continue.'},challenges:[],create:(h,d)=>new CurieExperience(h,d)},
  {id:'barkhausen',pack:'experiences',icon:'≋',name:'Bruit de Barkhausen',tagline:'Avalanches de renversements',intro:'Des spins à seuils de désordre se retournent par avalanches lorsque le champ augmente. On utilise ici un modèle d’Ising à champ aléatoire, athermique et dimensionnellement réduit.',params:[{id:'H',label:'Champ réduit H',min:-3,max:3,step:.05,value:-3,digits:2},{id:'J',label:'Couplage J',min:0,max:1,step:.05,value:.45,digits:2},{id:'disorder',label:'Désordre local',min:.05,max:2,step:.05,value:.8,digits:2},{id:'auto',label:'Balayage automatique',type:'check',value:false}],buttons:[{id:'step',label:'Avancer le champ +0,14'},{id:'reset',label:'Recommencer'}],whatIf:[{label:'Désordre fort',set:{disorder:1.8}},{label:'Désordre faible',set:{disorder:.2}}],observe:['Un renversement local peut déstabiliser ses voisins et déclencher une avalanche.','Le modèle est un RFIM 2D simplifié, pas la signature expérimentale sonore des parois mobiles.'],why:'<p>Un spin sᵢ devient instable si sᵢ(H+JΣsⱼ+hᵢ)&lt;0. Les champs aléatoires figés hᵢ modélisent des hétérogénéités et entraînent des événements discontinus.</p>',ub:{classes:['Random-field Ising model'],text:'Approche statistique qualitative, sans champ démagnétisant micromagnétique explicite.'},challenges:[],create:(h,d)=>new BarkhausenExperience(h,d)},
  {id:'harddisk',pack:'experiences',icon:'▦',name:'Le disque dur qui oublie',tagline:'Écrire, conserver, effacer',intro:'Une grille de bits magnétiques idéalisés conserve son état puis se retourne lorsque le champ franchit des seuils de coercivité. Ce n’est pas un modèle d’enregistrement industriel.',params:[{id:'H',label:'Champ réduit',min:-2,max:2,step:.1,value:0,digits:1}],buttons:[{id:'write',label:'Réécrire des bits'},{id:'erase',label:'Appliquer un champ d’effacement'}],whatIf:[{label:'Champ nul : mémoire',set:{H:0}},{label:'Champ fort négatif',set:{H:-2}}],observe:['Au champ nul, les bits conservent leur orientation : c’est une caricature de la rémanence.','Un champ suffisamment fort peut retourner les bits ; les seuils ne représentent pas une géométrie réelle ni les champs dipolaires.'],why:'<p>Chaque bit possède un seuil de retournement aléatoire. Le modèle illustre le principe de coercivité et la rémanence, sans résolution de la LLG ni mécanisme de lecture des disques actuels.</p>',ub:{classes:['Modèle de seuils'],text:'Pour un modèle réaliste, inclure les couplages d’échange et démagnétisants, l’anisotropie et la structure granulaire.'},challenges:[],create:(h,d)=>new DiskExperience(h,d)}
];
