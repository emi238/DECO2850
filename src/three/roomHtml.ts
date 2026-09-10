// Builds a self-contained HTML page that renders the generated 3D room with
// three.js inside a WebView. Kept dependency-light: three.js loads from a CDN,
// touch orbit/zoom is hand-rolled, and the risk card is plain HTML/CSS so the
// whole scene is one string with no native 3D module (works in Expo Go).

import type { Scene3D } from './scene';

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

export function buildRoomHtml(scene: Scene3D): string {
  const json = JSON.stringify(scene).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { height:100%; background:#0f1115; overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; -webkit-user-select:none; user-select:none; }
  canvas { display:block; touch-action:none; }
  .hidden { display:none !important; }
  #banner { position:fixed; top:0; left:0; right:0; padding:104px 16px 16px;
    background:linear-gradient(#0f1115ee 55%,#0f111500); color:#f4f5f7; z-index:5; pointer-events:none; }
  .brow { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .pill { padding:5px 12px; border-radius:999px; font-size:13px; font-weight:700; color:#fff; }
  .score { font-size:22px; font-weight:800; color:#f4f5f7; }
  .scoremax { font-size:13px; color:#7c828c; font-weight:600; }
  .bsummary { color:#aeb4be; font-size:12px; margin-top:6px; line-height:17px; max-width:640px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pet { display:inline-block; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16);
    color:#f4f5f7; font-size:12px; font-weight:600; padding:5px 10px; border-radius:999px; margin:4px 6px 0 0; }
  #hint { position:fixed; bottom:18px; left:0; right:0; text-align:center; color:#aeb4be; font-size:12px;
    z-index:4; transition:opacity .6s; pointer-events:none; }
  #card { position:fixed; left:12px; right:12px; bottom:14px; z-index:6;
    background:rgba(23,26,32,0.96); border:1px solid rgba(255,255,255,0.16); border-radius:18px; overflow:hidden;
    box-shadow:0 12px 40px rgba(0,0,0,0.5); }
  .bar { height:5px; width:100%; }
  .cardbody { padding:16px; }
  .cardhead { display:flex; align-items:flex-start; gap:12px; }
  .cnum { flex:none; width:26px; height:26px; border-radius:13px; color:#fff; font-weight:800; font-size:13px;
    display:flex; align-items:center; justify-content:center; margin-top:2px; }
  .ctitle { color:#f4f5f7; font-size:18px; font-weight:700; }
  .cmeta { color:#aeb4be; font-size:11px; margin-top:3px; text-transform:capitalize; }
  .cclose { margin-left:auto; color:#aeb4be; font-size:24px; line-height:24px; padding:0 4px; }
  .lead { color:#f4f5f7; font-weight:700; font-size:11px; }
  .cwhy { color:#aeb4be; font-size:13px; line-height:19px; margin-top:12px; }
  .cfix { color:#f4f5f7; font-size:13px; line-height:19px; margin-top:10px; padding:8px 12px; border-radius:10px;
    background:rgba(255,255,255,0.05); border-left:3px solid; }
  #err { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:32px;
    color:#aeb4be; font-size:15px; text-align:center; z-index:9; }
</style>
</head>
<body>
<div id="banner">
  <div class="brow" id="brow"></div>
  <div class="bsummary" id="bsummary"></div>
</div>
<div id="hint">Drag to look around · pinch to zoom · tap a marker</div>
<div id="card" class="hidden">
  <div class="bar" id="cbar"></div>
  <div class="cardbody">
    <div class="cardhead">
      <span class="cnum" id="cnum"></span>
      <div><div class="ctitle" id="ctitle"></div><div class="cmeta" id="cmeta"></div></div>
      <span class="cclose" id="cclose">&times;</span>
    </div>
    <div class="cwhy" id="cwhy"></div>
    <div class="cfix" id="cfix"></div>
  </div>
</div>
<div id="err" class="hidden">Couldn't load the 3D view. Check the internet connection and try again.</div>
<script src="${THREE_CDN}"></script>
<script>
window.__SCENE__ = ${json};
function post(o){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
window.onerror = function(m){ post({ type:'error', message:String(m) }); document.getElementById('err').classList.remove('hidden'); };
(function(){
  if (typeof THREE === 'undefined') { document.getElementById('err').classList.remove('hidden'); post({type:'error',message:'three failed to load'}); return; }
  var S = window.__SCENE__;
  var SEV = { low:'#5FB07E', medium:'#E6A93C', high:'#E5643C' };
  var ACCENT = '#E5643C';
  var VLABEL = { well_suited:'Well suited', suitable_with_changes:'Suitable with changes', poorly_suited:'Poorly suited' };
  var VCOLOR = { well_suited:'#5FB07E', suitable_with_changes:'#E6A93C', poorly_suited:'#E5643C' };

  // ---- banner ----
  var brow = document.getElementById('brow');
  if (S.verdict) {
    var pill = document.createElement('span'); pill.className='pill'; pill.style.background=VCOLOR[S.verdict]||ACCENT; pill.textContent=VLABEL[S.verdict]||S.verdict; brow.appendChild(pill);
    if (S.score!=null){ var sc=document.createElement('span'); sc.className='score'; sc.innerHTML=S.score+'<span class=\\'scoremax\\'>/100</span>'; brow.appendChild(sc); }
  } else if (S.recommended && S.recommended.length) {
    S.recommended.forEach(function(p){ var e=document.createElement('span'); e.className='pet'; e.textContent=p.species+(p.breed?(' · '+p.breed):''); brow.appendChild(e); });
  }
  document.getElementById('bsummary').textContent = S.summary || '';

  // ---- three basics ----
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1115');
  scene.fog = new THREE.Fog('#0f1115', 13, 24);
  var camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 100);
  var renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2b3340, 1.0));
  var dir = new THREE.DirectionalLight(0xffffff, 0.75); dir.position.set(5,9,6); scene.add(dir);

  // ---- room shell ----
  var W=S.room.W, D=S.room.D, H=S.room.H;
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(W,D), new THREE.MeshStandardMaterial({ color:'#c8bca9', roughness:0.97 }));
  floor.rotation.x = -Math.PI/2; scene.add(floor);
  var wallMat = new THREE.MeshStandardMaterial({ color:'#e7e0d3', roughness:1, side:THREE.DoubleSide });
  var back = new THREE.Mesh(new THREE.PlaneGeometry(W,H), wallMat); back.position.set(0,H/2,-D/2); scene.add(back);
  var lft = new THREE.Mesh(new THREE.PlaneGeometry(D,H), wallMat); lft.rotation.y=Math.PI/2; lft.position.set(-W/2,H/2,0); scene.add(lft);
  var rgt = new THREE.Mesh(new THREE.PlaneGeometry(D,H), wallMat); rgt.rotation.y=-Math.PI/2; rgt.position.set(W/2,H/2,0); scene.add(rgt);

  // ---- furniture ----
  S.furniture.forEach(function(f){
    var geo = new THREE.BoxGeometry(f.size[0], f.size[1], f.size[2]);
    var mat = new THREE.MeshStandardMaterial({ color:f.color, roughness:0.7, metalness:0.05 });
    if (f.highlight){ mat.emissive = new THREE.Color(ACCENT); mat.emissiveIntensity = 0.28; }
    var m = new THREE.Mesh(geo, mat); m.position.set(f.pos[0], f.pos[1], f.pos[2]); scene.add(m);
    if (f.highlight){
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color:ACCENT }));
      edges.position.copy(m.position); scene.add(edges);
    }
  });

  // ---- markers ----
  function numberSprite(n, color){
    var c=document.createElement('canvas'); c.width=128; c.height=128; var g=c.getContext('2d');
    g.fillStyle=color; g.beginPath(); g.arc(64,64,52,0,7); g.fill();
    g.lineWidth=9; g.strokeStyle='#ffffff'; g.stroke();
    g.fillStyle='#ffffff'; g.font='bold 66px -apple-system,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(n),64,70);
    var tex=new THREE.CanvasTexture(c); var mat=new THREE.SpriteMaterial({ map:tex, depthTest:false });
    var s=new THREE.Sprite(mat); s.scale.set(0.5,0.5,0.5); return s;
  }
  var markerMeshes=[];
  S.markers.forEach(function(mk, i){
    var grp=new THREE.Group();
    var sph=new THREE.Mesh(new THREE.SphereGeometry(0.15,20,20),
      new THREE.MeshStandardMaterial({ color:SEV[mk.severity]||ACCENT, emissive:SEV[mk.severity]||ACCENT, emissiveIntensity:0.55 }));
    grp.add(sph);
    var spr=numberSprite(mk.number, SEV[mk.severity]||ACCENT); spr.position.set(0,0.33,0); grp.add(spr);
    grp.position.set(mk.pos[0], mk.pos[1], mk.pos[2]);
    grp.userData = { mk:mk, base:mk.pos[1], i:i };
    scene.add(grp);
    markerMeshes.push({ grp:grp, sph:sph });
  });

  // ---- orbit camera ----
  var target = new THREE.Vector3(0, 1.0, 0);
  var r=9.2, theta=0.55, phi=1.12, auto=true;
  function updateCam(){
    camera.position.set(
      target.x + r*Math.sin(phi)*Math.sin(theta),
      target.y + r*Math.cos(phi),
      target.z + r*Math.sin(phi)*Math.cos(theta));
    camera.lookAt(target);
  }
  updateCam();

  var el = renderer.domElement;
  var dragging=false, lastX=0, lastY=0, moved=0, pinchStart=0, startR=0;
  function down(x,y){ dragging=true; auto=false; lastX=x; lastY=y; moved=0; hideHint(); }
  function move(x,y){ if(!dragging) return; var dx=x-lastX, dy=y-lastY; lastX=x; lastY=y; moved+=Math.abs(dx)+Math.abs(dy);
    theta-=dx*0.006; phi-=dy*0.006; phi=Math.max(0.28,Math.min(1.45,phi)); updateCam(); }
  function up(x,y){ if(moved<9){ tap(x,y); } dragging=false; }
  function dist(e){ var a=e.touches[0], b=e.touches[1]; return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); }

  el.addEventListener('touchstart', function(e){ if(e.touches.length===1){ down(e.touches[0].clientX,e.touches[0].clientY); }
    else if(e.touches.length===2){ dragging=false; auto=false; pinchStart=dist(e); startR=r; } }, {passive:true});
  el.addEventListener('touchmove', function(e){ if(e.touches.length===1){ move(e.touches[0].clientX,e.touches[0].clientY); }
    else if(e.touches.length===2 && pinchStart>0){ r=startR*(pinchStart/dist(e)); r=Math.max(3.8,Math.min(15,r)); updateCam(); } }, {passive:true});
  el.addEventListener('touchend', function(e){ if(e.touches.length===0){ var t=e.changedTouches[0]; up(t.clientX,t.clientY); } });
  el.addEventListener('mousedown', function(e){ down(e.clientX,e.clientY); });
  window.addEventListener('mousemove', function(e){ move(e.clientX,e.clientY); });
  window.addEventListener('mouseup', function(e){ up(e.clientX,e.clientY); });
  el.addEventListener('wheel', function(e){ auto=false; r*=(1+Math.sign(e.deltaY)*0.08); r=Math.max(3.8,Math.min(15,r)); updateCam(); }, {passive:true});

  // ---- tap -> raycast -> risk card ----
  var ray=new THREE.Raycaster(); var v=new THREE.Vector2(); var selected=null;
  function tap(x,y){
    var rect=el.getBoundingClientRect();
    v.x=((x-rect.left)/rect.width)*2-1; v.y=-((y-rect.top)/rect.height)*2+1;
    ray.setFromCamera(v, camera);
    var hits=ray.intersectObjects(markerMeshes.map(function(m){ return m.sph; }));
    if(hits.length){ select(hits[0].object.parent.userData.mk); } else { deselect(); }
  }
  var card=document.getElementById('card');
  function select(mk){
    selected=mk;
    document.getElementById('cbar').style.background = SEV[mk.severity]||ACCENT;
    var num=document.getElementById('cnum'); num.textContent=mk.number; num.style.background=SEV[mk.severity]||ACCENT;
    document.getElementById('ctitle').textContent=mk.title;
    document.getElementById('cmeta').textContent = mk.categoryLabel+' · '+mk.severity.toUpperCase()+' · risk to '+mk.risk_to;
    document.getElementById('cwhy').innerHTML = '<span class="lead">WHY IT MATTERS </span>'+esc(mk.why);
    var fix=document.getElementById('cfix'); fix.innerHTML='<span class="lead">FIX </span>'+esc(mk.fix); fix.style.borderLeftColor=SEV[mk.severity]||ACCENT;
    card.classList.remove('hidden');
    markerMeshes.forEach(function(m){ m.sph.scale.setScalar(m.grp.userData.mk.id===mk.id?1.6:1); });
  }
  function deselect(){ selected=null; card.classList.add('hidden'); markerMeshes.forEach(function(m){ m.sph.scale.setScalar(1); }); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  document.getElementById('cclose').addEventListener('click', deselect);

  var hint=document.getElementById('hint'); var hintTimer=setTimeout(hideHint, 5000);
  function hideHint(){ if(hint){ hint.style.opacity=0; } }

  window.addEventListener('resize', function(){
    camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  var t=0;
  function animate(){
    requestAnimationFrame(animate); t+=0.016;
    if(auto){ theta+=0.0016; updateCam(); }
    for(var i=0;i<markerMeshes.length;i++){ var g=markerMeshes[i].grp; g.position.y=g.userData.base+Math.sin(t*2+i)*0.05; }
    renderer.render(scene, camera);
  }
  animate();
  post({ type:'ready', markers: S.markers.length });
})();
</script>
</body>
</html>`;
}
