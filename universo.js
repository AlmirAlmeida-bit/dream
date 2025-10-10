// universo.js
// =============================================================
// Mobile:
//  - Ao carregar: planetas dão 1 volta e empilham 50% mais perto do STL (X=-3.5)
//  - Ao "Zerar Órbita": repetem a sequência (volta + empilhar X=-3.5)
//  - Levitação visível ativa após empilhar (painel aberto congela)
// Desktop:
//  - Órbitas circulares + reset suave (mantidos)
// =============================================================

import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================ */
/* 1) Utils: Sprite p/ estrelas */
/* ============================ */
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

/* ============================ */
/* 2) Loading overlay animado   */
/* ============================ */
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

/* ============================ */
/* 3) Cena principal + planetas */
/* ============================ */
const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();

const planetTextures = [
  'IMGS/planet1.jpg',
  'IMGS/planet2.jpg',
  'IMGS/planet3.jpg',
  'IMGS/planet4.jpg',
  'IMGS/planet5.jpg'
];
const planetNames = ['Chamados','Segurança','Boas Praticas','Equipamentos','Acesso ao Escritório'];

const planets = [];
const planetData = [{scale:0.9},{scale:0.75},{scale:0.85},{scale:0.95},{scale:1}];

// Esferas normais (sem achatamento)
for (let i=0;i<planetTextures.length;i++){
  const s = planetData[i].scale;
  const size = (0.45 + Math.random()*0.6) * s;
  const geometry = new THREE.SphereGeometry(size, 32, 32);
  const tex = textureLoader.load(planetTextures[i]);
  const material = new THREE.MeshPhongMaterial({ map: tex, shininess: 20 });
  const planet = new THREE.Mesh(geometry, material);

  planet.userData.index = i+1;

  // Órbita (Desktop)
  const baseDist = 8 + i*2;
  const adjustedRadius = baseDist * 0.5; // seu ajuste atual
  planet.userData.radius = adjustedRadius;
  planet.userData.originalRadius = adjustedRadius;
  planet.userData.angle  = Math.random()*Math.PI*2;
  planet.userData.baseSpeed = 0.001 + i*0.0008;
  planet.userData.speed = planet.userData.baseSpeed;
  planet.userData.isHovered = false;
  planet.userData.originalScale = planet.scale.clone();

  planet.position.set(
    Math.cos(planet.userData.angle)*adjustedRadius,
    Math.sin(planet.userData.angle)*adjustedRadius,
    0
  );

  scene.add(planet);
  planets.push(planet);

  if (i === planetTextures.length-1){
    const ringGeo = new THREE.RingGeometry(size*1.1, size*1.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI/2;
    planet.add(ring);
  }
}

/* Fundo de estrelas */
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
const starMat = new THREE.PointsMaterial({ size: 1.2, map: spriteWhite, transparent:true, depthWrite:false, blending: THREE.AdditiveBlending });
starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions,3));
const starPoints = new THREE.Points(starGeom, starMat);
scene.add(starPoints);

/* ============================ */
/* 4) Camera / Renderer / Luz   */
/* ============================ */
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0,0,20);
const cameraOriginalZ = camera.position.z;
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

/* ============================ */
/* 5) STL central + loading     */
/* ============================ */
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

let responsiveScaleFactor = 1;
let pendingMeshScaleFactor = null;

loaderSTL.load('IMGS/Trestech.stl', geometry=>{
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  if (geometry.isBufferGeometry) geometry.center();
  meshMaterial = new THREE.MeshPhongMaterial({ color: 0x88ccff, shininess:100, transparent:true, opacity:0 });
  mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.scale.set(baseScale*1.5, baseScale*1.5, baseScale*1.5);
  mesh.userData = { originalScale: mesh.scale.clone() };
  mesh.position.set(0,0,0); // CENTRO
  scene.add(mesh);
  meshLoaded = true;
  meshLoadedAt = performance.now();
  if (pendingMeshScaleFactor !== null) {
    mesh.scale.copy(mesh.userData.originalScale.clone().multiplyScalar(pendingMeshScaleFactor));
    pendingMeshScaleFactor = null;
  }
}, undefined, err=>{
  console.error('Erro carregando STL:', err);
  setTimeout(()=> startLoadingFade(), 3000);
});

function startLoadingFade(){
  if (fadeStarted) return;
  fadeStarted = true;
  fadeStartTime = performance.now();
  loadingDiv.style.transition = `opacity ${loadingFadeDuration}ms ease`;
  loadingDiv.style.opacity = '0';
  setTimeout(()=> { 
    if (loadingDiv.parentNode) loadingDiv.remove(); 
    const galaxiaBtnLocal = document.getElementById('galaxia-btn');
    if (galaxiaBtnLocal) galaxiaBtnLocal.classList.add('show');
  }, loadingFadeDuration + 50);
}
setTimeout(()=> {
  if (!meshLoaded && !fadeStarted) startLoadingFade();
}, 10000);

/* ============================ */
/* 6) Painel + conteúdos        */
/* ============================ */
const panel = document.createElement('div');
panel.className = 'planet-panel';
document.body.appendChild(panel);

const closeButton = document.createElement('button');
closeButton.textContent = 'Fechar';
panel.appendChild(closeButton);

const panelContent = document.createElement('div');
panel.appendChild(panelContent);

function openPanel(){ panel.classList.add('open'); panelOpen = true; }
function closePanel(){ 
  panel.classList.remove('open'); 
  panelOpen = false; 

  // ✅ Reinicia qualquer vídeo do painel (YouTube iframe)
  const iframes = panelContent.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    const src = iframe.src;
    iframe.src = src; // reseta o vídeo
  });
}

closeButton.onclick = closePanel;

const planetDivs = [
  document.getElementById('planet-1'),
  document.getElementById('planet-2'),
  document.getElementById('planet-3'),
  document.getElementById('planet-4'),
  document.getElementById('planet-5')
];
const libraryDiv = document.getElementById('biblioteca-recursos');

/* ============================ */
/* 7) Raycaster + Tipping       */
/* ============================ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const tipping = document.getElementById('tipping');
let tippingFullText = '';
let tippingCurrent = '';
let tippingIndex = 0;
let tippingLastTime = 0;
const tippingSpeed = 80;

function startTipping(text){
  tippingFullText = text || '';
  tippingCurrent = '';
  tippingIndex = 0;
  tippingLastTime = performance.now();
  tipping.style.opacity = '1';
  tipping.style.transform = 'translateY(0px)';
}
function hideTipping(){
  tipping.style.opacity = '0';
  tipping.style.transform = 'translateY(20px)';
}

/* ============================ */
/* 8) Responsivo Desktop/Mobile */
/* ============================ */
let isMobileStackMode = false;     // <= 768px
let isHalfStackMode   = false;     // empilhar 50% mais perto (X=-3.5) após intro/reset

// Intro (mobile): 1 volta + stack final
let hasRunMobileIntro = false;
const mobileLapDuration   = 2800;
const mobileStackDuration = 900;
let mobileIntro = {
  active:false,
  phase:'idle', // 'lap' | 'stacking' | 'idle'
  t0:0,
  baseAngles:[],
  orbitR:[],
  fromPos:[],
  toPos:[]
};

// Posição de empilhamento (X muda conforme isHalfStackMode)
function getStackPos(i){
  const x = isHalfStackMode ? -5.8 : -4.1; // <<<<<< 50% mais perto quando ativo
  const y = 7 - i*3.2;
  return new THREE.Vector3(x, y, 0);
}

function layoutMobileStack(){
  planets.forEach((p, i)=>{
    const t = getStackPos(i);
    p.position.set(t.x, t.y, t.z);
  });
}

function layoutDesktopOrbit(){
  planets.forEach(p=>{
    const r = p.userData.radius;
    p.position.set(
      Math.cos(p.userData.angle)*r,
      Math.sin(p.userData.angle)*r,
      0
    );
  });
}

// Dispara a intro (mobile): 1 volta e depois empilha
function startMobileIntro(){
  if (!isMobileStackMode) return;
  mobileIntro.active = true;
  mobileIntro.phase  = 'lap';
  mobileIntro.t0     = performance.now();

  mobileIntro.baseAngles = planets.map(()=> Math.random()*Math.PI*2);
  mobileIntro.orbitR = planets.map((_,i)=> 6 + i*0.7);

  // começa já na órbita
  planets.forEach((p,i)=>{
    const a = mobileIntro.baseAngles[i];
    const r = mobileIntro.orbitR[i];
    p.position.set(Math.cos(a)*r, Math.sin(a)*r, 0);
  });
}

// suavização
function smoothstep(x){ return x<=0?0 : x>=1?1 : x*x*(3-2*x); }

function applyResponsiveScale() {
  const width = window.innerWidth;
  let scaleFactor = 1;
  if (width < 480) scaleFactor = 0.55;
  else if (width < 768) scaleFactor = 0.7;
  else if (width < 1024) scaleFactor = 0.9;
  else scaleFactor = 1;

  scaleFactor = Math.max(0.4, scaleFactor);
  responsiveScaleFactor = scaleFactor;

  const isMobile = width <= 768;

  // Escala STL (mobile +30%)
  if (mesh && mesh.userData?.originalScale) {
    const mobileBoost = isMobile ? 1.3 : 1.0;
    const meshScale = mesh.userData.originalScale.clone().multiplyScalar(scaleFactor * mobileBoost);
    mesh.scale.copy(meshScale);
  } else {
    pendingMeshScaleFactor = scaleFactor * (isMobile ? 1.3 : 1.0);
  }

  // Escala planetas (mobile +25%)
  planets.forEach(p=>{
    if (p.userData.originalScale) {
      const mobilePlanetBoost = isMobile ? 1.25 : 1.0;
      const s = p.userData.originalScale.clone().multiplyScalar(scaleFactor * mobilePlanetBoost);
      p.scale.copy(s);
    }
    if (typeof p.userData.originalRadius !== 'undefined') {
      p.userData.radius = p.userData.originalRadius * scaleFactor;
    }
  });

  // câmera
  if (scaleFactor < 1) camera.position.set(camera.position.x, camera.position.y, cameraOriginalZ / scaleFactor);
  else camera.position.set(camera.position.x, camera.position.y, cameraOriginalZ);
  camera.updateProjectionMatrix();

  // alterna layout e dispara intro uma única vez ao entrar no mobile
  const shouldStack = isMobile;
  if (shouldStack !== isMobileStackMode){
    isMobileStackMode = shouldStack;
    if (isMobileStackMode){
      // ao entrar no mobile, empilha (pré-intro) ainda com -7.1
      isHalfStackMode = false;
      layoutMobileStack();
      if (!hasRunMobileIntro){
        startMobileIntro();
        hasRunMobileIntro = true;
      }
    } else {
      layoutDesktopOrbit();
    }
  } else {
    if (isMobileStackMode) layoutMobileStack();
    else layoutDesktopOrbit();
  }
}
applyResponsiveScale();

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  loadingCamera.aspect = window.innerWidth/window.innerHeight;
  loadingCamera.updateProjectionMatrix();
  loadingRenderer.setSize(window.innerWidth, window.innerHeight);
  applyResponsiveScale();
});

/* ============================ */
/* 9) Interações / Painel       */
/* ============================ */
let panelOpen = false;

function intersectAtClient(clientX, clientY){
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(planets);
}

function showPlanetPanelByIndex(index){
  planetDivs.forEach(d=> d && (d.style.display = 'none'));
  if (libraryDiv) libraryDiv.style.display = 'none';
  const div = planetDivs[index];
  if (div) {
    div.style.display = 'block';
    panelContent.innerHTML = '';
    panelContent.appendChild(div);
    openPanel();
  }
}

window.addEventListener('click', (event)=>{
  if (panelOpen) return; // painel aberto anula
  if (mobileIntro.active) return; // durante intro, não abre
  const isUI = event.target.closest('.btn') || event.target.closest('#galaxia-btn') || event.target.closest('.planet-panel');
  if (isUI) return;
  const hit = intersectAtClient(event.clientX, event.clientY);
  if (hit.length > 0){
    const index = hit[0].object.userData.index - 1;
    showPlanetPanelByIndex(index);
  }
});

// Touch
window.addEventListener('touchstart', (ev)=>{
  if (!ev.touches || ev.touches.length === 0) return;
  if (panelOpen) return;
  if (mobileIntro.active) return;
  const t = ev.touches[0];
  const hit = intersectAtClient(t.clientX, t.clientY);
  if (hit.length > 0){
    const name = planetNames[hit[0].object.userData.index - 1];
    tipping.style.left = `${t.clientX + 12}px`;
    tipping.style.top  = `${t.clientY - 24}px`;
    startTipping(name);
    setTimeout(()=> hideTipping(), 750);
  } else {
    hideTipping();
  }
},{passive:true});

window.addEventListener('touchend', (ev)=>{
  if (panelOpen) return;
  if (mobileIntro.active) return;
  const t = ev.changedTouches?.[0];
  if (!t) return;
  const hit = intersectAtClient(t.clientX, t.clientY);
  if (hit.length > 0){
    const index = hit[0].object.userData.index - 1;
    showPlanetPanelByIndex(index);
  }
},{passive:true});

/* ============================ */
/* 10) Botão Galáxia            */
/* ============================ */
const galaxiaBtn = document.getElementById('galaxia-btn');
let buttonTooltipVisible = false;

function positionTooltipAtButton() {
  if (!galaxiaBtn || !tipping) return;
  const rect = galaxiaBtn.getBoundingClientRect();
  const px = rect.left + rect.width + 10;
  const py = rect.top + rect.height/2 - 10;
  tipping.style.left = `${px}px`;
  tipping.style.top  = `${py}px`;
}

if (galaxiaBtn) {
  galaxiaBtn.addEventListener('mouseenter', ()=>{
    buttonTooltipVisible = true;
    startTipping('Biblioteca de Recursos');
    positionTooltipAtButton();
  });
  galaxiaBtn.addEventListener('mousemove', positionTooltipAtButton);
  galaxiaBtn.addEventListener('mouseleave', ()=>{
    buttonTooltipVisible = false;
    hideTipping();
  });

  galaxiaBtn.addEventListener('click', ()=>{
    planetDivs.forEach(d=> d && (d.style.display = 'none'));
    if (libraryDiv){
      libraryDiv.style.display = 'block';
      panelContent.innerHTML = '';
      panelContent.appendChild(libraryDiv);
      openPanel();
    }
  });
}

/* ============================ */
/* 11) Reset de órbita          */
/* ============================ */
let rewindStartTime = null;
const rewindDuration = 1800;
const rewindData = planets.map(()=>({ startAngle:0, endAngle:0 }));
let isRewinding = false;

const resetButton = document.getElementById('reset-orbit');
resetButton.addEventListener('click', ()=>{
  closePanel(); // fecha painel

  if (isMobileStackMode){
    // MOBILE: repetir (volta + stack) e deixar 50% mais perto
    isHalfStackMode = true;   // <<<<<< garante X=-3.5 no fim
    startMobileIntro();
    return;
  }

  // DESKTOP: rewind suave (mantido)
  rewindStartTime = performance.now();
  isRewinding = true;
  const baseShift = Math.random()*Math.PI*2;
  const spacing = (Math.PI*2) / planets.length;
  planets.forEach((p, i)=>{
    rewindData[i].startAngle = p.userData.angle;
    const jitter = (Math.random() - 0.5) * (spacing * 0.2);
    rewindData[i].endAngle = baseShift + i*spacing + jitter;
  });
});

/* ============================ */
/* 12) Hover desktop + tipping  */
/* ============================ */
function updateHoverTooltip(){
  if (panelOpen || mobileIntro.active) {
    planets.forEach(p=> p.userData.isHovered = false);
    document.body.style.cursor = 'default';
    if (!buttonTooltipVisible) hideTipping();
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const hoverIntersects = raycaster.intersectObjects(planets);
  planets.forEach(p => p.userData.isHovered = false);

  if (hoverIntersects.length > 0){
    const obj = hoverIntersects[0].object;
    obj.userData.isHovered = true;

    const vec = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
    vec.project(camera);
    const px = (vec.x*0.5 + 0.5) * window.innerWidth;
    const py = (-vec.y*0.5 + 0.5) * window.innerHeight;

    document.body.style.cursor = 'pointer';
    tipping.style.left = `${px + 10}px`;
    tipping.style.top  = `${py - 30}px`;

    const desired = planetNames[obj.userData.index - 1];
    if (tippingFullText !== desired) startTipping(desired);
  } else {
    document.body.style.cursor = 'default';
    if (!buttonTooltipVisible) hideTipping();
  }
}
window.addEventListener('mousemove', (e)=>{
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

/* ============================ */
/* 13) Fundo animado            */
/* ============================ */
const bgGroup = new THREE.Group();
scene.add(bgGroup);
function createDeepSpaceStars(count = 6000) {
  const positions = new Float32Array(count*3);
  for (let i=0;i<count;i++){
    positions[i*3]   = (Math.random()-0.5)*9000;
    positions[i*3+1] = (Math.random()-0.5)*9000;
    positions[i*3+2] = (Math.random()-0.5)*9000;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const mat = new THREE.PointsMaterial({
    size: 1.1,
    map: spriteWhite,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(geom, mat);
  stars.userData.animate = ()=>{ stars.rotation.y += 0.00015; };
  return stars;
}
const backgrounds = [ createDeepSpaceStars() ];
bgGroup.add(backgrounds[0]);

/* ============================ */
/* 14) Loop de animação         */
/* ============================ */
function animate(){
  requestAnimationFrame(animate);
  controls.update();

  if (mesh) mesh.rotation.y += 0.005; // STL sempre visível

  if (meshLoaded && !fadeStarted){
    if (performance.now() - meshLoadedAt >= fadeDelayAfterLoad) startLoadingFade();
  }
  if (fadeStarted && meshMaterial){
    const t = Math.min(1, (performance.now() - fadeStartTime) / loadingFadeDuration);
    meshMaterial.opacity = t;
  }

  // typing do tipping
  if (tippingFullText && tippingIndex < tippingFullText.length && (performance.now() - tippingLastTime) > tippingSpeed){
    tippingCurrent += tippingFullText[tippingIndex];
    tipping.textContent = tippingCurrent;
    tippingIndex++;
    tippingLastTime = performance.now();
  }

  const now = performance.now();

  if (isMobileStackMode){
    // INTRO: 1 volta + empilhar (X depende de isHalfStackMode)
    if (mobileIntro.active){
      if (mobileIntro.phase === 'lap'){
        const t = Math.min(1, (now - mobileIntro.t0) / mobileLapDuration);
        planets.forEach((p, i)=>{
          const a = mobileIntro.baseAngles[i] + t * Math.PI*2; // 1 volta
          const r = mobileIntro.orbitR[i];
          p.position.set(Math.cos(a)*r, Math.sin(a)*r, 0);
        });
        if (t >= 1){
          mobileIntro.phase = 'stacking';
          mobileIntro.t0 = now;
          mobileIntro.fromPos = planets.map(p=> p.position.clone());
          // Ativa stack 50% mais perto ao final das sequências
          isHalfStackMode = true; // <<<<<< após a volta, vamos empilhar em X=-3.5
          mobileIntro.toPos   = planets.map((_,i)=> getStackPos(i));
        }
      } else if (mobileIntro.phase === 'stacking'){
        const u = smoothstep(Math.min(1, (now - mobileIntro.t0) / mobileStackDuration));
        planets.forEach((p, i)=>{
          const from = mobileIntro.fromPos[i];
          const to   = mobileIntro.toPos[i];
          p.position.lerpVectors(from, to, u);
        });
        if (u >= 1){
          mobileIntro.active = false;
          mobileIntro.phase  = 'idle';
          layoutMobileStack(); // trava posição final precisa (X=-3.5)
        }
      }
    } else {
      // MOBILE normal: levitação visível se painel fechado
      if (!panelOpen){
        const time = now * 0.001;
        planets.forEach((p, i)=>{
          const amp = 0.45, freq = 0.9, phase = i*0.8;
          // usa o Y do stack atual (X já está em -3.5)
          const baseY = 7 - i*3.2;
          p.position.y = baseY + Math.sin(time*freq + phase) * amp;
        });
      }
    }
  } else {
    // DESKTOP: órbitas / rewind
    if (isRewinding){
      const t = Math.min(1, (now - rewindStartTime) / rewindDuration);
      planets.forEach((p, i)=>{
        p.userData.angle = THREE.MathUtils.lerp(rewindData[i].startAngle, rewindData[i].endAngle, t);
        const r = p.userData.radius;
        p.position.set(Math.cos(p.userData.angle)*r, Math.sin(p.userData.angle)*r, 0);
      });
      if (t >= 1) isRewinding = false;
    } else {
      planets.forEach(p=>{
        const target = p.userData.isHovered ? p.userData.baseSpeed * 0.02 : p.userData.baseSpeed;
        p.userData.speed = THREE.MathUtils.lerp(p.userData.speed, target, 0.08);
        p.userData.angle += p.userData.speed;
        const r = p.userData.radius;
        p.position.set(Math.cos(p.userData.angle)*r, Math.sin(p.userData.angle)*r, 0);
      });
    }
  }

  updateHoverTooltip();

  const active = backgrounds[0];
  if (active?.userData?.animate) active.userData.animate();

  renderer.render(scene, camera);
}
animate();
