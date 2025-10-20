import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* PATCH MOBILE (Chrome Android)*/
const isChromeAndroid = /Chrome/i.test(navigator.userAgent) && /Android/i.test(navigator.userAgent);

/* Utils: sprite circular (estrelas/partículas) + cor média*/
function createCircleSprite(color = '#ffffff', size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size/2, size/2, size*0.05, size/2, size/2, size/2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// (mantido para uso futuro)
function computeTextureAvgColor(texture) {
  try {
    const img = texture.image;
    if (!img) return new THREE.Color(0xffffff);
    const w = Math.min(64, img.width || 64);
    const h = Math.min(64, img.height || 64);
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let r=0, g=0, b=0, count=0;
    for (let i=0; i<data.length; i+=4) {
      r += data[i]; g += data[i+1]; b += data[i+2]; count++;
    }
    r = (r / count) | 0; g = (g / count) | 0; b = (b / count) | 0;
    return new THREE.Color(r/255, g/255, b/255);
  } catch {
    return new THREE.Color(0xffffff);
  }
}

/* Loading: Star Tunnel (hiperespaço) com fade*/
const loadingDiv = document.getElementById('loading');
const loadingScene = new THREE.Scene();
const loadingCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1600);
loadingCamera.position.z = 5;

//Antialias ligado no desktop; desligado no mobile p/ estabilidade
const loadingRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isChromeAndroid });
loadingRenderer.setSize(window.innerWidth, window.innerHeight);
loadingDiv.appendChild(loadingRenderer.domElement);

// Sprite branco reutilizável (também usado no starfield principal)
const spriteWhite = createCircleSprite('#ffffff', 64);

// Parâmetros do túnel
const STAR_COUNT   = isChromeAndroid ? 800 : 2000;
const TUNNEL_MIN_R = 2.0;
const TUNNEL_MAX_R = 10.0;
const TUNNEL_DEPTH = 420;
const HYPER_SPEED  = 3.2;
const SPIRAL_SPEED = 0.002;

const starPositions = new Float32Array(STAR_COUNT * 3);
const starSpeedScale = new Float32Array(STAR_COUNT);

// Distribuição cilíndrica com leve viés para bordas
for (let i = 0; i < STAR_COUNT; i++) {
  const r = Math.sqrt(Math.random()) * (TUNNEL_MAX_R - TUNNEL_MIN_R) + TUNNEL_MIN_R;
  const a = Math.random() * Math.PI * 2;
  const z = -Math.random() * TUNNEL_DEPTH - 5;
  starPositions[i*3]     = Math.cos(a) * r;
  starPositions[i*3 + 1] = Math.sin(a) * r;
  starPositions[i*3 + 2] = z;
  starSpeedScale[i] = 0.7 + Math.random() * 0.6;
}

const loadingGeom = new THREE.BufferGeometry();
loadingGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

const loadingMat = new THREE.PointsMaterial({
  size: 0.11,
  map: spriteWhite,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const starTunnel = new THREE.Points(loadingGeom, loadingMat);
loadingScene.add(starTunnel);

// Animação do túnel
let spiralAngle = 0;
(function animateLoading() {
  requestAnimationFrame(animateLoading);
  const arr = loadingGeom.attributes.position.array;

  for (let i = 0; i < STAR_COUNT; i++) {
    const idxZ = i * 3 + 2;
    arr[idxZ] += HYPER_SPEED * starSpeedScale[i];
    if (arr[idxZ] > 8) {
      arr[idxZ] = -TUNNEL_DEPTH - Math.random() * 120;
      const r = Math.sqrt(Math.random()) * (TUNNEL_MAX_R - TUNNEL_MIN_R) + TUNNEL_MIN_R;
      const a = Math.random() * Math.PI * 2;
      arr[i*3]     = Math.cos(a) * r;
      arr[i*3 + 1] = Math.sin(a) * r;
      starSpeedScale[i] = 0.7 + Math.random() * 0.6;
    }
  }

  spiralAngle += SPIRAL_SPEED;
  starTunnel.rotation.z = spiralAngle;

  loadingGeom.attributes.position.needsUpdate = true;
  loadingRenderer.render(loadingScene, loadingCamera);
})();

// Resize do loading
window.addEventListener('resize', () => {
  loadingCamera.aspect = window.innerWidth / window.innerHeight;
  loadingCamera.updateProjectionMatrix();
  loadingRenderer.setSize(window.innerWidth, window.innerHeight);
});

/*Fade compartilhado com a cena principal*/
let meshLoaded = false;
let meshLoadedAt = 0;
const fadeDelayAfterLoad = 3000;   // aguarda 3s após o STL carregar
const loadingFadeDuration = 2000;  // duração do fade do overlay
let fadeStarted = false;
let fadeStartTime = 0;

function startLoadingFade() {
  if (fadeStarted) return;
  fadeStarted = true;
  fadeStartTime = performance.now();
  loadingDiv.style.transition = `opacity ${loadingFadeDuration}ms ease`;
  loadingDiv.style.opacity = '0';
  setTimeout(() => {
    if (loadingDiv.parentNode) loadingDiv.remove();
  }, loadingFadeDuration + 50);
}

// Fallback: some após 10s mesmo se STL demorar
setTimeout(() => {
  if (!meshLoaded && !fadeStarted) startLoadingFade();
}, 10000);



/* Cena principal e texturas*/
const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();

// Texturas dos planetas (6 originais + 1 novo com planet6.webp)
const planetTextures = [
  'IMGS/planet1.webp',
  'IMGS/planet2.webp',
  'IMGS/planet3.webp',
  'IMGS/planet4.webp',
  'IMGS/planet5.webp',
  'IMGS/planet7.webp', 
  'IMGS/planet6.webp'  
];

// Nomes dos planetas
const planetNames = [
  'Chamados',
  'Segurança',
  'Boas Praticas',
  'Equipamentos',
  'Acesso ao Escritório',
  'Novidades',
  'Biblioteca de Recursos' 
];

const planets = [];
const createdSizes = [];

/*Criação dos 5 primeiros planetas com variação de tamanho*/
for (let i = 0; i < 5; i++) {
  const scale = [0.9, 0.75, 0.85, 0.95, 1][i];
  const size = (0.45 + Math.random() * 0.6) * scale;
  createdSizes.push(size);

  const geom = new THREE.SphereGeometry(size, 32, 32);
  const tex = textureLoader.load(planetTextures[i]);
  const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 20 });
  const planet = new THREE.Mesh(geom, mat);

  planet.userData.index = i + 1;
  planet.userData.angle = Math.random() * Math.PI * 2;
  planet.userData.baseSpeed = 0.001 + i * 0.0008;
  planet.userData.speed = planet.userData.baseSpeed;
  planet.userData.originalScale = planet.scale.clone();

  const baseDist = 8 + i * 2;
  const adjustedRadius = baseDist * 0.5;
  planet.userData.radius = adjustedRadius;
  planet.userData.originalRadius = adjustedRadius;
  planet.position.set(
    Math.cos(planet.userData.angle) * adjustedRadius,
    Math.sin(planet.userData.angle) * adjustedRadius,
    0
  );

  scene.add(planet);
  planets.push(planet);
}

/* 6º planeta – Novidades (tamanho médio, com anel)*/
const avgSize = createdSizes.reduce((a, b) => a + b, 0) / createdSizes.length;
{
  const i = 5;
  const geom = new THREE.SphereGeometry(avgSize, 32, 32);
  const tex = textureLoader.load(planetTextures[i]);
  const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 20 });
  const p6 = new THREE.Mesh(geom, mat);

  p6.userData.index = i + 1; // 6
  p6.userData.angle = Math.random() * Math.PI * 2;
  p6.userData.baseSpeed = 0.0029;
  p6.userData.speed = p6.userData.baseSpeed;
  p6.userData.originalScale = p6.scale.clone();

  const baseDist = 8 + i * 2;
  const adjustedRadius = baseDist * 0.5;
  p6.userData.radius = adjustedRadius;
  p6.userData.originalRadius = adjustedRadius;
  p6.position.set(
    Math.cos(p6.userData.angle) * adjustedRadius,
    Math.sin(p6.userData.angle) * adjustedRadius,
    0
  );

  // Anel no Novidades
  const ringGeo = new THREE.RingGeometry(avgSize * 1.1, avgSize * 1.6, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  p6.add(ring);

  scene.add(p6);
  planets.push(p6);
}

/* 7º planeta – Biblioteca de Recursos (mesmo comportamento dos demais */
{
  const i = 6; // sétimo
  const size = avgSize; // usa o mesmo médio pra consistência
  const geom = new THREE.SphereGeometry(size, 32, 32);
  const tex = textureLoader.load(planetTextures[i]); // IMGS/planet6.webp
  const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 20 });
  const p7 = new THREE.Mesh(geom, mat);

  p7.userData.index = i + 1; // 7
  p7.userData.angle = Math.random() * Math.PI * 2;
  p7.userData.baseSpeed = 0.0018; // velocidade similar aos demais
  p7.userData.speed = p7.userData.baseSpeed;
  p7.userData.originalScale = p7.scale.clone();

  const baseDist = 8 + i * 2;
  const adjustedRadius = baseDist * 0.5;
  p7.userData.radius = adjustedRadius;
  p7.userData.originalRadius = adjustedRadius;
  p7.position.set(
    Math.cos(p7.userData.angle) * adjustedRadius,
    Math.sin(p7.userData.angle) * adjustedRadius,
    0
  );

  scene.add(p7);
  planets.push(p7);
}

/* Fundo de estrelas denso (duas camadas) — mobile reduzido */
function createStarField(count, range) {
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * range;
    pos[i*3+1] = (Math.random() - 0.5) * range;
    pos[i*3+2] = (Math.random() - 0.5) * range;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.15,
    map: spriteWhite,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Points(geom, mat);
}

// NOVOS VALORES — muito mais leves no Chrome Android
const STARFIELD_NEAR_COUNT = isChromeAndroid ? 800 : 12000;
const STARFIELD_FAR_COUNT  = isChromeAndroid ? 500 : 10000;

const starFieldNear = createStarField(STARFIELD_NEAR_COUNT, 2000);
const starFieldFar  = createStarField(STARFIELD_FAR_COUNT, 8000);
starFieldFar.userData.animate = () => { starFieldFar.rotation.y += 0.0001; };

scene.add(starFieldNear);
scene.add(starFieldFar);

/* ✅ MOBILE: esconder starfield principal (fundo preto) */
const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
if (isMobileViewport) {
  starFieldNear.visible = false;
  starFieldFar.visible  = false;
}


/* Câmera / Renderer / Luz */
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
const cameraOriginalZ = 20;
camera.position.set(0, 0, cameraOriginalZ);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x404040));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* STL central (logo) */
const loaderSTL = new STLLoader();
let mesh = null;
let meshMaterial = null;
let baseScale = 0.04;
let responsiveScaleFactor = 1;
let pendingMeshScaleFactor = null;

loaderSTL.load('IMGS/Trestech.stl', geometry => {
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  if (geometry.isBufferGeometry) geometry.center();

  meshMaterial = new THREE.MeshPhongMaterial({ color: 0x88ccff, shininess: 100, transparent: true, opacity: 0 });
  mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.scale.set(baseScale * 1.5, baseScale * 1.5, baseScale * 1.5);
  mesh.userData = { originalScale: mesh.scale.clone() };
  scene.add(mesh);

  meshLoaded = true;
  meshLoadedAt = performance.now();

  if (pendingMeshScaleFactor !== null) {
    mesh.scale.copy(mesh.userData.originalScale.clone().multiplyScalar(pendingMeshScaleFactor));
    pendingMeshScaleFactor = null;
  }
}, undefined, () => setTimeout(() => startLoadingFade(), 3000));

/* Base de Tooltip (DOM)*/
const tipping = document.getElementById('tipping');
let tippingFullText = '';
let tippingCurrent = '';
let tippingIndex = 0;
let tippingLastTime = 0;
const tippingSpeed = 80;

function startTipping(text) {
  if (isChromeAndroid) return;
  tippingFullText = text || '';
  tippingCurrent = '';
  tippingIndex = 0;
  tippingLastTime = performance.now();
  tipping.style.opacity = '1';
  tipping.style.transform = 'translateY(0px)';
}

function hideTipping() {
  if (isChromeAndroid) return;
  tipping.style.opacity = '0';
  tipping.style.transform = 'translateY(20px)';
}

/*Painel de conteúdo (DOM) */
const panel = document.createElement('div');
panel.className = 'planet-panel';
document.body.appendChild(panel);

const closeButton = document.createElement('button');
closeButton.textContent = 'Fechar';
panel.appendChild(closeButton);

const panelContent = document.createElement('div');
panel.appendChild(panelContent);

function openPanel() { 
  panel.classList.add('open'); 
  panelOpen = true; 
  requestAnimationFrame(checkLogoHologramVisibility);
}
function closePanel() { 
  panel.classList.remove('open'); 
  panel.classList.remove('show-logo');
  panelOpen = false;
  panelContent.querySelectorAll('iframe').forEach(iframe => { iframe.src = iframe.src; });
}
closeButton.onclick = closePanel;

// Mapeamento dos DIVs HTML
const planetDivs = [
  document.getElementById('planet-1'),
  document.getElementById('planet-2'),
  document.getElementById('planet-3'),
  document.getElementById('planet-4'),
  document.getElementById('planet-5'),
  document.getElementById('planet-6'), 
  document.getElementById('planet-7')  
];

let panelOpen = false;

/* Raycaster*/
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function intersectAtClient(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(planets);
}

function showPlanetPanelByIndex(index) {
  planetDivs.forEach(d => d && (d.style.display = 'none'));
  const div = planetDivs[index];
  if (div) {
    div.style.display = 'block';
    panelContent.innerHTML = '';
    panelContent.appendChild(div);
    openPanel();
  }
}

/* Responsividade Desktop / Mobile*/
let isMobileStackMode = false;
let isHalfStackMode = false;

let hasRunMobileIntro = false;
const mobileLapDuration = 2800;
const mobileStackDuration = 900;

// EASING "Apple Smooth"
function appleEase(t) { return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t))); }

let mobileIntro = {
  active: false,
  phase: 'idle',
  t0: 0,
  baseAngles: [],
  orbitR: [],
  fromPos: [],
  toPos: []
};

// posição do empilhamento (x fixo, y decrescente)
function stackPosByRank(rank) {
  const x = isHalfStackMode ? -5.8 : -4.1;
  const y = 7 - rank * 3.2;
  return new THREE.Vector3(x, y, 0);
}

// EMPILHAMENTO CUSTOM (7º planeta no topo, depois Chamados…)
function layoutMobileStack() {
  const order = planets.length === 7 ? [6,0,1,2,3,4,5] : planets.map((_, i) => i);
  order.forEach((pIndex, rank) => {
    const p = planets[pIndex];
    const t = stackPosByRank(rank);
    p.position.set(t.x, t.y, t.z);
  });
}

function layoutDesktopOrbit() {
  planets.forEach(p => {
    const r = p.userData.radius;
    p.position.set(
      Math.cos(p.userData.angle) * r,
      Math.sin(p.userData.angle) * r,
      0
    );
  });
}

function startMobileIntro() {
  if (!isMobileStackMode) return;
  mobileIntro.active = true;
  mobileIntro.phase = 'lap';
  mobileIntro.t0 = performance.now();

  mobileIntro.baseAngles = planets.map(() => Math.random() * Math.PI * 2);
  mobileIntro.orbitR = planets.map((_, i) => 6 + i * 0.7);

  planets.forEach((p, i) => {
    const a = mobileIntro.baseAngles[i];
    const r = mobileIntro.orbitR[i];
    p.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
  });
}

function applyResponsiveScale() {
  const width = window.innerWidth;
  let scaleFactor = 1;
  if (width < 480) scaleFactor = 0.55;
  else if (width < 768) scaleFactor = 0.7;
  else if (width < 1024) scaleFactor = 0.9;

  scaleFactor = Math.max(0.4, scaleFactor);
  const isMobile = width <= 768;

  // STL Scaling
  if (mesh && mesh.userData?.originalScale) {
    const mobileBoost = isMobile ? 1.5 : 1.0;
    mesh.scale.copy(mesh.userData.originalScale.clone().multiplyScalar(scaleFactor * mobileBoost));
  } else {
    pendingMeshScaleFactor = scaleFactor * (isMobile ? 1.3 : 1.0);
  }

  // Planets scaling
  planets.forEach(p => {
    if (p.userData.originalScale) {
      const mobilePlanetBoost = isMobile ? 1.45 : 1.0;
      p.scale.copy(p.userData.originalScale.clone().multiplyScalar(scaleFactor * mobilePlanetBoost));
    }
    if (typeof p.userData.originalRadius !== 'undefined') {
      p.userData.radius = p.userData.originalRadius * scaleFactor;
    }
  });

  // Camera
  camera.position.z = scaleFactor < 1 ? (cameraOriginalZ / scaleFactor) : cameraOriginalZ;
  camera.updateProjectionMatrix();

  const shouldStack = isMobile;
  if (shouldStack !== isMobileStackMode) {
    isMobileStackMode = shouldStack;
    if (isMobileStackMode) {
      isHalfStackMode = false;
      layoutMobileStack();
      if (!hasRunMobileIntro) {
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

  updateControlsForMode();
}
applyResponsiveScale();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyResponsiveScale();
});

/* Interações Desktop*/
window.addEventListener('click', (event) => {
  if (panelOpen) return;
  if (mobileIntro.active) return;
  const isUI = event.target.closest('.btn') || event.target.closest('.planet-panel');
  if (isUI) return;
  const hit = intersectAtClient(event.clientX, event.clientY);
  if (hit.length > 0) showPlanetPanelByIndex(hit[0].object.userData.index - 1);
});

/* Interações Mobile — tooltip desativado no Chrome Android */
window.addEventListener('touchstart', (ev) => {
  if (!ev.touches || ev.touches.length === 0) return;
  if (panelOpen) return;
  if (mobileIntro.active) return;

  const t = ev.touches[0];
  const hit = intersectAtClient(t.clientX, t.clientY);
  if (hit.length > 0) {
    if (!isChromeAndroid) {
      const obj = hit[0].object;
      const name = planetNames[obj.userData.index - 1];
      const vec = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
      vec.project(camera);
      const px = (vec.x * 0.5 + 0.5) * window.innerWidth;
      const py = (-(vec.y) * 0.5 + 0.5) * window.innerHeight;

      tipping.style.left = `${px - 20}px`;
      tipping.style.top = `${py - 60}px`;
      startTipping(name);
      setTimeout(() => hideTipping(), 1000);
    }
  }
}, { passive: true });

window.addEventListener('touchend', (ev) => {
  if (panelOpen) return;
  if (mobileIntro.active) return;
  const t = ev.changedTouches?.[0];
  if (!t) return;
  const hit = intersectAtClient(t.clientX, t.clientY);
  if (hit.length > 0) showPlanetPanelByIndex(hit[0].object.userData.index - 1);
}, { passive: true });

/*Hover Desktop (com frenagem)*/
function updateHoverTooltip() {
  if (isChromeAndroid) return;

  if (panelOpen || mobileIntro.active) {
    document.body.style.cursor = 'default';
    hideTipping();
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const intersect = raycaster.intersectObjects(planets);

  if (intersect.length > 0) {
    const obj = intersect[0].object;
    obj.userData.speed = obj.userData.baseSpeed * 0.05; // Frenagem ao hover

    const vec = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
    vec.project(camera);
    const px = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const py = (-(vec.y) * 0.5 + 0.5) * window.innerHeight;

    document.body.style.cursor = 'pointer';
    tipping.style.left = `${px + 10}px`;
    tipping.style.top = `${py - 30}px`;

    const name = planetNames[obj.userData.index - 1];
    if (tippingFullText !== name) startTipping(name);
  } else {
    document.body.style.cursor = 'default';
    hideTipping();
  }
}
window.addEventListener('mousemove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

/*Reset de Órbita (com easing Apple Smooth)*/
let rewindStartTime = null;
const rewindDuration = 1800;
let isRewinding = false;
const rewindData = planets.map(() => ({ startAngle: 0, endAngle: 0 }));

document.getElementById('reset-orbit').addEventListener('click', () => {
  closePanel();
  if (isMobileStackMode) {
    isHalfStackMode = true;
    startMobileIntro();
    return;
  }
  // Desktop
  rewindStartTime = performance.now();
  isRewinding = true;
  const baseShift = Math.random() * Math.PI * 2;
  const spacing = (Math.PI * 2) / planets.length;
  planets.forEach((p, i) => {
    rewindData[i].startAngle = p.userData.angle;
    const jitter = (Math.random() - 0.5) * (spacing * 0.2);
    rewindData[i].endAngle = baseShift + i * spacing + jitter;
  });
});

/*BLOQUEIO DE CONTROLES NO MOBILE + ROTAÇÃO DO STL (sem inércia)*/
function updateControlsForMode() {
  if (isMobileStackMode) {
    controls.enabled = false;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
    renderer.domElement.style.touchAction = 'none';
  } else {
    controls.enabled = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    renderer.domElement.style.touchAction = '';
  }
}

// Interação do STL no mobile (arrastar = rotacionar X/Y) — SEM INÉRCIA
const stlDrag = { active: false, lastX: 0, lastY: 0 };
const STL_DRAG_SENS = 0.0020;

function onStlTouchStart(e) {
  if (!isMobileStackMode || !mesh) return;
  if (!e.touches || e.touches.length === 0) return;
  const t = e.touches[0];
  stlDrag.active = true;
  stlDrag.lastX = t.clientX;
  stlDrag.lastY = t.clientY;
}
function onStlTouchMove(e) {
  if (!isMobileStackMode || !mesh) return;
  if (!stlDrag.active) return;
  if (!e.touches || e.touches.length === 0) return;
  e.preventDefault();
  const t = e.touches[0];
  const dx = t.clientX - stlDrag.lastX;
  const dy = t.clientY - stlDrag.lastY;
  stlDrag.lastX = t.clientX;
  stlDrag.lastY = t.clientY;
  mesh.rotation.y += dx * STL_DRAG_SENS;
  mesh.rotation.x += dy * STL_DRAG_SENS;
  const maxTilt = Math.PI / 2.5;
  mesh.rotation.x = Math.max(-maxTilt, Math.min(maxTilt, mesh.rotation.x));
}
function onStlTouchEnd() {
  if (!isMobileStackMode) return;
  stlDrag.active = false;
}
renderer.domElement.addEventListener('touchstart', onStlTouchStart, { passive: false });
renderer.domElement.addEventListener('touchmove',  onStlTouchMove,  { passive: false });
renderer.domElement.addEventListener('touchend',   onStlTouchEnd,   { passive: true  });

/* ============================================================
   Logo holográfico: visibilidade por scroll (>=85%)

function checkLogoHologramVisibility() {
  if (!panelOpen) {
    panel.classList.remove('show-logo');
    return;
  }
  const scrollPos = panel.scrollTop + panel.clientHeight;
  const threshold = panel.scrollHeight * 0.85;
  if (scrollPos >= threshold) {
    panel.classList.add('show-logo');
  } else {
    panel.classList.remove('show-logo');
  }
}
panel.addEventListener('scroll', checkLogoHologramVisibility);  */

/*Loop de Animação*/
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // STL: gira sozinho sempre
  if (mesh) mesh.rotation.y += 0.005;

  // Fade do loading
  if (meshLoaded && !fadeStarted) {
    if (performance.now() - meshLoadedAt >= fadeDelayAfterLoad) startLoadingFade();
  }
  if (fadeStarted && meshMaterial) {
    const t = Math.min(1, (performance.now() - fadeStartTime) / loadingFadeDuration);
    meshMaterial.opacity = t;
  }

  // typing do tipping (desktop)
  if (!isChromeAndroid && tippingFullText && tippingIndex < tippingFullText.length && performance.now() - tippingLastTime > tippingSpeed) {
    tippingCurrent += tippingFullText[tippingIndex];
    tipping.textContent = tippingCurrent;
    tippingIndex++;
    tippingLastTime = performance.now();
  }

  const now = performance.now();

  if (isMobileStackMode) {
    if (mobileIntro.active) {
      if (mobileIntro.phase === 'lap') {
        const t = Math.min(1, (now - mobileIntro.t0) / mobileLapDuration);
        const te = appleEase(t);
        planets.forEach((p, i) => {
          const a = mobileIntro.baseAngles[i] + te * Math.PI * 2;
          const r = mobileIntro.orbitR[i];
          p.position.set(Math.cos(a)*r, Math.sin(a)*r, 0);
        });
        if (t >= 1) {
          mobileIntro.phase = 'stacking';
          mobileIntro.t0 = now;
          mobileIntro.fromPos = planets.map(p => p.position.clone());

          // destino do empilhamento respeitando ordem customizada
          isHalfStackMode = true;
          const order = planets.length === 7 ? [6,0,1,2,3,4,5] : planets.map((_, i) => i);
          mobileIntro.toPos = order.map((_, rank) => stackPosByRank(rank));
        }
      } else if (mobileIntro.phase === 'stacking') {
        const u = Math.min(1, (now - mobileIntro.t0) / mobileStackDuration);
        const ue = appleEase(u);

        // precisamos aplicar a ordem customizada aqui também
        const order = planets.length === 7 ? [6,0,1,2,3,4,5] : planets.map((_, i) => i);
        order.forEach((pIndex, rank) => {
          const p = planets[pIndex];
          const from = mobileIntro.fromPos[pIndex];
          const to   = mobileIntro.toPos[rank];
          p.position.lerpVectors(from, to, ue);
        });

        if (u >= 1) {
          mobileIntro.active = false;
          mobileIntro.phase = 'idle';
          layoutMobileStack();
        }
      }
    } else {
      // Levitação suave no mobile
      if (!panelOpen) {
        const time = now * 0.001;
        const order = planets.length === 7 ? [6,0,1,2,3,4,5] : planets.map((_, i) => i);
        order.forEach((pIndex, rank) => {
          const p = planets[pIndex];
          const amp = 0.45, freq = 0.9, phase = rank * 0.8;
          const baseY = 7 - rank * 3.2;
          p.position.y = baseY + Math.sin(time * freq + phase) * amp;
        });
      }
    }
  } else {
    // Desktop: órbitas (com easing na volta do reset)
    if (isRewinding) {
      const t = Math.min(1, (now - rewindStartTime) / rewindDuration);
      const e = appleEase(t);
      planets.forEach((p, i) => {
        p.userData.angle = THREE.MathUtils.lerp(rewindData[i].startAngle, rewindData[i].endAngle, e);
        const r = p.userData.radius;
        p.position.set(Math.cos(p.userData.angle) * r, Math.sin(p.userData.angle) * r, 0);
      });
      if (t >= 1) isRewinding = false;
    } else {
      planets.forEach(p => {
        const target = p.userData.baseSpeed;
        p.userData.speed = THREE.MathUtils.lerp(p.userData.speed, target, 0.08);
        p.userData.angle += p.userData.speed;
        const r = p.userData.radius;
        p.position.set(Math.cos(p.userData.angle) * r, Math.sin(p.userData.angle) * r, 0);
      });
    }
  }

  updateHoverTooltip();

  if (starFieldFar?.userData?.animate) starFieldFar.userData.animate();

  renderer.render(scene, camera);
}
animate();
