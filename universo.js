

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

/* ------------------ util: cria sprite circular ------------------ */
function createCircleSprite(color = '#ffffff', size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size/2, size/2, size*0.05, size/2, size/2, size/2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------ Loading (overlay) ------------------ */
const loadingDiv = document.getElementById('loading');
const loadingScene = new THREE.Scene();
const loadingCamera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
loadingCamera.position.z = 5;
const loadingRenderer = new THREE.WebGLRenderer({ alpha:true, antialias:true });
loadingRenderer.setSize(window.innerWidth, window.innerHeight);
loadingDiv.appendChild(loadingRenderer.domElement);

const spriteWhite = createCircleSprite('#ffffff', 64);
const spriteCyan  = createCircleSprite('#00ffff', 64);

function createLoadingLayer(count, sprite, speed, size=0.12, minR=6, maxR=30) {
  const positions = new Float32Array(count*3);
  const speeds = new Float32Array(count);
  for (let i=0;i<count;i++){
    let radius = Math.sqrt(Math.random()) * maxR;
    if (radius < minR) radius = minR + Math.random()*(maxR-minR);
    const angle = Math.random()*Math.PI*2;
    positions[i*3]   = Math.cos(angle)*radius;
    positions[i*3+1] = Math.sin(angle)*radius;
    positions[i*3+2] = -Math.random()*200;
    speeds[i] = (Math.random()*0.6 + 0.7) * speed;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const m = new THREE.PointsMaterial({ size, map: sprite, transparent:true, depthWrite:false, blending: THREE.AdditiveBlending });
  return { points: new THREE.Points(g,m), speeds };
}

const loadingLayers = [
  createLoadingLayer(900, spriteWhite, 2.0, 0.12, 6, 30),
  createLoadingLayer(450, spriteCyan, 1.2, 0.14, 8, 30),
  createLoadingLayer(300, spriteCyan, 0.6, 0.09, 10, 60)
];
loadingLayers.forEach(l=>loadingScene.add(l.points));

(function animateLoading(){
  requestAnimationFrame(animateLoading);
  loadingLayers.forEach(layer=>{
    const arr = layer.points.geometry.attributes.position.array;
    const n = arr.length/3;
    for(let i=0;i<n;i++){
      const idx=i*3+2;
      arr[idx] += layer.speeds[i];
      if (arr[idx] > 5) arr[idx] = -200 - Math.random()*50;
    }
    layer.points.geometry.attributes.position.needsUpdate = true;
  });
  loadingRenderer.render(loadingScene, loadingCamera);
})();

window.addEventListener('resize', ()=>{
  loadingCamera.aspect = window.innerWidth/window.innerHeight;
  loadingCamera.updateProjectionMatrix();
  loadingRenderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------ Cena principal ------------------ */
const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();

// textures (use seus caminhos)
const planetTextures = [
  'IMGS/planet1.jpg',
  'IMGS/planet2.jpg',
  'IMGS/planet3.jpg',
  'IMGS/planet4.jpg',
  'IMGS/planet5.jpg'
];
const planetNames = ['Chamados','Segurança','Boas Praticas','Equipamentos','Acesso ao Escritório'];

/* planetas */
const planets = [];
const planetData = [{scale:0.9},{scale:0.75},{scale:0.85},{scale:0.95},{scale:1}];

for (let i=0;i<planetTextures.length;i++){
  const s = planetData[i].scale;
  const size = (0.45 + Math.random()*0.6) * s; // variação de tamanho
  const geometry = new THREE.SphereGeometry(size, 32, 32);
  const tex = textureLoader.load(planetTextures[i]);
  const material = new THREE.MeshPhongMaterial({ map: tex, shininess: 20 });
  const planet = new THREE.Mesh(geometry, material);
  planet.userData.index = i+1;
  // distância radial (mantém diferenciação por índice)
  const baseDist = 8 + i*2;
  const adjustedRadius = baseDist * 0.8;
  planet.userData.radius = adjustedRadius;
  planet.userData.angle  = Math.random()*Math.PI*2;
  // cada planeta tem uma velocidade base distinta
  planet.userData.baseSpeed = 0.001 + i*0.0008;
  planet.userData.speed = planet.userData.baseSpeed;
  planet.userData.isHovered = false;
  // pos inicial
  planet.position.set(Math.cos(planet.userData.angle)*adjustedRadius, Math.sin(planet.userData.angle)*adjustedRadius*0.5, Math.sin(planet.userData.angle)*adjustedRadius*0.5);
  scene.add(planet);
  planets.push(planet);

  // opcional: anel para o último (como no seu código)
  if (i === planetTextures.length-1){
    const ringGeo = new THREE.RingGeometry(size*1.1, size*1.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI/2;
    planet.add(ring);
  }
}

/* ----- estrelas principais (garantir visibilidade) ----- */
const mainStarCount = 6000;
const starPositions = new Float32Array(mainStarCount*3);
for (let i=0;i<mainStarCount;i++){
  const radius = (Math.random()*1.0 + 0.5) * 800;
  const angle = Math.random()*Math.PI*2;
  starPositions[i*3]   = Math.cos(angle)*radius;
  starPositions[i*3+1] = Math.sin(angle)*radius;
  starPositions[i*3+2] = (Math.random()-0.5)*2000;
}
const starGeom = new THREE.BufferGeometry();
starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions,3));
const starMat = new THREE.PointsMaterial({ size: 1.2, map: spriteWhite, transparent:true, depthWrite:false, blending: THREE.AdditiveBlending });
const starPoints = new THREE.Points(starGeom, starMat);
scene.add(starPoints);

/* ------------------ renderer / camera / controls ------------------ */
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0,0,20);
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x404040));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5,5,5);
scene.add(light);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

/* ------------------ STL loader (objeto central) ------------------ */
const loaderSTL = new STLLoader();
let mesh = null;
let meshMaterial = null;
let baseScale = 0.04;
let meshLoaded = false;
let meshLoadedAt = 0;
const fadeDelayAfterLoad = 3000;
const loadingFadeDuration = 2000;
let fadeStarted = false;
let fadeStartTime = 0;

loaderSTL.load('IMGS/Trestech.stl', geometry=>{
  try {
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    if (geometry.isBufferGeometry) geometry.center();
  } catch(e) { /* ignore */ }
  meshMaterial = new THREE.MeshPhongMaterial({ color: 0x88ccff, shininess:100, transparent:true, opacity:0 });
  mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.scale.set(baseScale*1.5, baseScale*1.5, baseScale*1.5);
  mesh.position.set(0,0,0);
  scene.add(mesh);
  meshLoaded = true;
  meshLoadedAt = performance.now();
}, undefined, err=>{
  console.error('Erro carregando STL:', err);
  // fallback para não bloquear a UI
  setTimeout(()=> startLoadingFade(), 3000);
});

/* ------------------ Raycaster / mouse / UI ------------------ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (e)=>{
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

/* painel lateral (mantive o comportamento existente) */
const panel = document.createElement('div');
panel.className = 'planet-panel';
document.body.appendChild(panel);
const closeButton = document.createElement('button');
closeButton.textContent = 'Fechar';
closeButton.onclick = ()=> panel.classList.remove('open');
panel.appendChild(closeButton);
const panelContent = document.createElement('div');
panel.appendChild(panelContent);

const planetDivs = [
  document.getElementById('planet-1'),
  document.getElementById('planet-2'),
  document.getElementById('planet-3'),
  document.getElementById('planet-4'),
  document.getElementById('planet-5')
];

document.addEventListener('click', (event)=>{
  // raycast para abrir painel
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(planets);
  if (intersects.length > 0) {
    const index = intersects[0].object.userData.index - 1;
    planetDivs.forEach(d=> d && (d.style.display = 'none'));
    if (planetDivs[index]) {
      planetDivs[index].style.display = 'block';
      panelContent.innerHTML = '';
      panelContent.appendChild(planetDivs[index]);
      panel.classList.add('open');
    }
  }
});

/* tipping (efeito de digitação) */
const tipping = document.getElementById('tipping');
let tippingFullText = '';
let tippingCurrent = '';
let tippingIndex = 0;
let tippingLastTime = 0;
const tippingSpeed = 80;
function startTipping(text){
  tippingFullText = text;
  tippingCurrent = '';
  tippingIndex = 0;
  tippingLastTime = performance.now();
  tipping.style.opacity = '1';
  tipping.style.transform = 'translateY(0px)';
}

/* ------------------ Rewind (Zerar Órbita) suave com posições distintas ------------------ */
let rewindStartTime = null;
const rewindDuration = 3000; // ms
const rewindData = planets.map(()=>({ startAngle:0, endAngle:0 }));
let isRewinding = false;

const resetButton = document.getElementById('reset-orbit');
resetButton.addEventListener('click', ()=>{
  // iniciar rewind
  rewindStartTime = performance.now();
  isRewinding = true;
  // base shift random para espalhar os planetas de forma ordenada
  const baseShift = Math.random()*Math.PI*2;
  const spacing = (Math.PI*2) / planets.length;
  planets.forEach((p, i)=>{
    rewindData[i].startAngle = p.userData.angle;
    // garanto espaçamento + pequeno jitter para naturalidade
    const jitter = (Math.random() - 0.5) * (spacing * 0.2);
    rewindData[i].endAngle = baseShift + i*spacing + jitter;
  });
  panel.classList.remove('open');
});

/* ------------------ fade remover loading ------------------ */
function startLoadingFade(){
  if (fadeStarted) return;
  fadeStarted = true;
  fadeStartTime = performance.now();
  loadingDiv.style.transition = `opacity ${loadingFadeDuration}ms ease`;
  loadingDiv.style.opacity = '0';
  setTimeout(()=> { if (loadingDiv.parentNode) loadingDiv.remove(); }, loadingFadeDuration + 50);
}

/* fallback caso mesh falhe carregar */
setTimeout(()=> {
  if (!meshLoaded && !fadeStarted) startLoadingFade();
}, 10000);

/* ------------------ ANIMAÇÃO ------------------ */
function animate(){
  requestAnimationFrame(animate);
  controls.update();

  // rotaciona mesh central
  if (mesh) mesh.rotation.y += 0.005;

  // terminar loading quando mesh ok + delay
  if (meshLoaded && !fadeStarted){
    if (performance.now() - meshLoadedAt >= fadeDelayAfterLoad) startLoadingFade();
  }
  if (fadeStarted && meshMaterial){
    const t = Math.min(1, (performance.now() - fadeStartTime) / loadingFadeDuration);
    meshMaterial.opacity = t;
  }

  // raycast hover
  raycaster.setFromCamera(mouse, camera);
  const hoverIntersects = raycaster.intersectObjects(planets);
  // reset hover flags
  planets.forEach(p => p.userData.isHovered = false);
  if (hoverIntersects.length > 0){
    const obj = hoverIntersects[0].object;
    obj.userData.isHovered = true;
    // tipping position (projeta posição do planeta para tela)
    const vec = new THREE.Vector3();
    vec.setFromMatrixPosition(obj.matrixWorld);
    vec.project(camera);
    const px = (vec.x*0.5 + 0.5) * window.innerWidth;
    const py = (-vec.y*0.5 + 0.5) * window.innerHeight;
    document.body.style.cursor = 'pointer';
    tipping.style.left = `${px + 10}px`;
    tipping.style.top  = `${py - 30}px`;
    if (tippingFullText !== planetNames[obj.userData.index - 1]) {
      startTipping(planetNames[obj.userData.index - 1]);
    }
  } else {
    document.body.style.cursor = 'default';
    tipping.style.opacity = '0';
    tipping.style.transform = 'translateY(20px)';
  }

  // animate tipping typing
  if (tippingFullText && tippingIndex < tippingFullText.length && (performance.now() - tippingLastTime) > tippingSpeed){
    tippingCurrent += tippingFullText[tippingIndex];
    tipping.textContent = tippingCurrent;
    tippingIndex++;
    tippingLastTime = performance.now();
  }

  // painel limite (impedir planetas atravessarem o espaço do painel)
  const panelLeftX = window.innerWidth - panel.offsetWidth;

  // se estiver rewinding, interpolar ângulos
  if (isRewinding){
    const t = Math.min(1, (performance.now() - rewindStartTime) / rewindDuration);
    planets.forEach((p, i)=>{
      p.userData.angle = THREE.MathUtils.lerp(rewindData[i].startAngle, rewindData[i].endAngle, t);
      const r = p.userData.radius;
      p.position.set(Math.cos(p.userData.angle)*r, Math.sin(p.userData.angle)*r*0.5, Math.sin(p.userData.angle)*r*0.5);
      // bloquear X caso painel ativo
      if (p.position.x > panelLeftX - 0.5) p.position.x = panelLeftX - 0.5;
    });
    if (t >= 1) isRewinding = false;
  } else {
    // órbita normal com slowdown ao hover
    planets.forEach(p=>{
      // target speed: reduz muito quando hover sobre ESSE planeta
      const target = p.userData.isHovered ? p.userData.baseSpeed * 0.02 : p.userData.baseSpeed;
      p.userData.speed = THREE.MathUtils.lerp(p.userData.speed, target, 0.08);
      p.userData.angle += p.userData.speed;

      const r = p.userData.radius;
      p.position.set(Math.cos(p.userData.angle)*r, Math.sin(p.userData.angle)*r*0.5, Math.sin(p.userData.angle)*r*0.5);

      // evitar invadir área do painel
      if (p.position.x > panelLeftX - 0.5) p.position.x = panelLeftX - 0.5;
    });
    // colisão simples por repulsão angular mínima (evita sobreposição imediata)
    // calculei ângulos e, se dois estiverem muito próximos angularmente, empurro levemente
    const minAngularSeparation = 0.08; // radians -> ajustável
    for (let a=0;a<planets.length;a++){
      for (let b=a+1;b<planets.length;b++){
        const pa = planets[a], pb = planets[b];
        const da = pa.userData.angle, db = pb.userData.angle;
        let delta = Math.atan2(Math.sin(db-da), Math.cos(db-da)); // diferença entre -PI..PI
        if (Math.abs(delta) < minAngularSeparation){
          const push = (minAngularSeparation - Math.abs(delta)) * 0.02;
          // empurra em direções opostas
          pa.userData.angle -= push;
          pb.userData.angle += push;
        }
      }
    }
  }

  renderer.render(scene, camera);
}
animate();

/* ---------- resize handlers ---------- */
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  loadingCamera.aspect = window.innerWidth/window.innerHeight;
  loadingCamera.updateProjectionMatrix();
  loadingRenderer.setSize(window.innerWidth, window.innerHeight);
});
