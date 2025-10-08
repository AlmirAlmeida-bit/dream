// universo.js
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
  const size = (0.45 + Math.random()*0.6) * s;
  const geometry = new THREE.SphereGeometry(size, 32, 32);
  const tex = textureLoader.load(planetTextures[i]);
  const material = new THREE.MeshPhongMaterial({ map: tex, shininess: 20 });
  const planet = new THREE.Mesh(geometry, material);
  planet.userData.index = i+1;
  const baseDist = 8 + i*2;
  const adjustedRadius = baseDist * 0.8;
  planet.userData.radius = adjustedRadius;
  planet.userData.originalRadius = adjustedRadius;
  planet.userData.angle  = Math.random()*Math.PI*2;
  planet.userData.baseSpeed = 0.001 + i*0.0008;
  planet.userData.speed = planet.userData.baseSpeed;
  planet.userData.isHovered = false;
  planet.userData.originalScale = planet.scale.clone();
  planet.position.set(
    Math.cos(planet.userData.angle)*adjustedRadius,
    Math.sin(planet.userData.angle)*adjustedRadius*0.5,
    Math.sin(planet.userData.angle)*adjustedRadius*0.5
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

/* ----- estrelas principais (fundo padrão) ----- */
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

// variáveis para responsividade
let responsiveScaleFactor = 1;
let pendingMeshScaleFactor = null;

loaderSTL.load('IMGS/Trestech.stl', geometry=>{
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  if (geometry.isBufferGeometry) geometry.center();
  meshMaterial = new THREE.MeshPhongMaterial({ color: 0x88ccff, shininess:100, transparent:true, opacity:0 });
  mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.scale.set(baseScale*1.5, baseScale*1.5, baseScale*1.5);
  mesh.userData = { originalScale: mesh.scale.clone() };
  mesh.position.set(0,0,0);
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

/* ------------------ Raycaster / mouse / UI ------------------ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (e)=>{
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

/* painel lateral */
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

/* ----- Conteúdo Biblioteca de Recursos (criado via JS) ----- */
const libraryDiv = document.createElement('div');
libraryDiv.id = 'library';
libraryDiv.style.display = 'none';
libraryDiv.innerHTML = `
  <h2>Biblioteca de Recursos.</h2>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec efficitur elit vitae augue vehicula cursus. Nam dignissim dolor ut velit bibendum dignissim. Aenean convallis vulputate eros vel gravida. Quisque a ante vitae ligula dapibus aliquet. Donec ac nisi at tellus congue scelerisque. Nunc nec posuere sem. Aenean justo urna, egestas at lobortis quis, gravida et nunc. Vestibulum dolor ante, elementum ornare nisl a, imperdiet posuere lacus. Etiam vel quam metus. Fusce vestibulum magna felis, nec placerat augue convallis ac. Aenean tincidunt justo vel velit commodo, at egestas est dictum.</p>
`;
document.body.appendChild(libraryDiv);

/* click em planetas abre painel */
document.addEventListener('click', (event)=>{
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(planets);
  if (intersects.length > 0) {
    const index = intersects[0].object.userData.index - 1;
    // esconde tudo
    planetDivs.forEach(d=> d && (d.style.display = 'none'));
    libraryDiv.style.display = 'none';
    // mostra o selecionado
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

/* ------------------ Rewind ------------------ */
let rewindStartTime = null;
const rewindDuration = 3000;
const rewindData = planets.map(()=>({ startAngle:0, endAngle:0 }));
let isRewinding = false;

const resetButton = document.getElementById('reset-orbit');
resetButton.addEventListener('click', ()=>{
  rewindStartTime = performance.now();
  isRewinding = true;
  const baseShift = Math.random()*Math.PI*2;
  const spacing = (Math.PI*2) / planets.length;
  planets.forEach((p, i)=>{
    rewindData[i].startAngle = p.userData.angle;
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

  setTimeout(()=> { 
    if (loadingDiv.parentNode) loadingDiv.remove(); 
    // mostra botão galaxia após fade
    const galaxiaBtnLocal = document.getElementById('galaxia-btn');
    if (galaxiaBtnLocal) galaxiaBtnLocal.classList.add('show');
  }, loadingFadeDuration + 50);
}

/* fallback caso mesh falhe carregar */
setTimeout(()=> {
  if (!meshLoaded && !fadeStarted) startLoadingFade();
}, 10000);

/* ------------------ RESPONSIVE ------------------ */
function applyResponsiveScale() {
  const width = window.innerWidth;
  let scaleFactor = 1;
  if (width < 480) scaleFactor = 0.5;
  else if (width < 768) scaleFactor = 0.7;
  else if (width < 1024) scaleFactor = 0.85;
  else scaleFactor = 1;

  scaleFactor = Math.max(0.35, scaleFactor);
  responsiveScaleFactor = scaleFactor;

  if (mesh && mesh.userData && mesh.userData.originalScale) {
    mesh.scale.copy(mesh.userData.originalScale.clone().multiplyScalar(scaleFactor));
  } else {
    pendingMeshScaleFactor = scaleFactor;
  }

  planets.forEach(p=>{
    if (p.userData.originalScale) {
      p.scale.copy(p.userData.originalScale.clone().multiplyScalar(scaleFactor));
    }
    if (typeof p.userData.originalRadius !== 'undefined') {
      p.userData.radius = p.userData.originalRadius * scaleFactor;
    }
  });

  if (scaleFactor < 1) {
    camera.position.set(camera.position.x, camera.position.y, cameraOriginalZ / scaleFactor);
  } else {
    camera.position.set(camera.position.x, camera.position.y, cameraOriginalZ);
  }
  camera.updateProjectionMatrix();
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

/* ------------------ FUNDO PADRÃO: Starscape (paralaxe suave) ------------------ */
let currentBgIndex = 0; // deixamos por compatibilidade, mas não há troca via Galáxia
const bgGroup = new THREE.Group();
scene.add(bgGroup);

// apenas um fundo ativo (estrelas profundas)
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

/* ------------------ Tooltip do botão Galáxia (igual aos planetas) ------------------ */
const galaxiaBtn = document.getElementById('galaxia-btn');
let buttonTooltipVisible = false;

function positionTooltipAtButton() {
  const el = galaxiaBtn;
  const tip = tipping;
  if (!el || !tip) return;
  const rect = el.getBoundingClientRect();
  const px = rect.left + rect.width + 10;  // à direita do botão
  const py = rect.top + rect.height/2 - 10;
  tip.style.left = `${px}px`;
  tip.style.top  = `${py}px`;
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
    tipping.style.opacity = '0';
    tipping.style.transform = 'translateY(20px)';
  });

  // clique abre a aba "Biblioteca de Recursos" no painel
  galaxiaBtn.addEventListener('click', ()=>{
    // esconder outras
    planetDivs.forEach(d=> d && (d.style.display = 'none'));
    // mostrar biblioteca
    libraryDiv.style.display = 'block';
    panelContent.innerHTML = '';
    panelContent.appendChild(libraryDiv);
    panel.classList.add('open');
  });
}

/* ------------------ ANIMAÇÃO ------------------ */
function animate(){
  requestAnimationFrame(animate);
  controls.update();

  if (mesh) mesh.rotation.y += 0.005;

  if (meshLoaded && !fadeStarted){
    if (performance.now() - meshLoadedAt >= fadeDelayAfterLoad) startLoadingFade();
  }
  if (fadeStarted && meshMaterial){
    const t = Math.min(1, (performance.now() - fadeStartTime) / loadingFadeDuration);
    meshMaterial.opacity = t;
  }

  // hover tooltip para planetas
  raycaster.setFromCamera(mouse, camera);
  const hoverIntersects = raycaster.intersectObjects(planets);
  planets.forEach(p => p.userData.isHovered = false);
  if (hoverIntersects.length > 0){
    const obj = hoverIntersects[0].object;
    obj.userData.isHovered = true;
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
    // só esconde se não estiver sobre o botão com tooltip
    if (!buttonTooltipVisible){
      tipping.style.opacity = '0';
      tipping.style.transform = 'translateY(20px)';
    }
  }

  if (tippingFullText && tippingIndex < tippingFullText.length && (performance.now() - tippingLastTime) > tippingSpeed){
    tippingCurrent += tippingFullText[tippingIndex];
    tipping.textContent = tippingCurrent;
    tippingIndex++;
    tippingLastTime = performance.now();
  }

  const panelLeftX = window.innerWidth - panel.offsetWidth;

  // órbitas
  if (isRewinding){
    const t = Math.min(1, (performance.now() - rewindStartTime) / rewindDuration);
    planets.forEach((p, i)=>{
      p.userData.angle = THREE.MathUtils.lerp(rewindData[i].startAngle, rewindData[i].endAngle, t);
      const r = p.userData.radius;
      p.position.set(Math.cos(p.userData.angle)*r, Math.sin(p.userData.angle)*r*0.5, Math.sin(p.userData.angle)*r*0.5);
      if (p.position.x > panelLeftX - 0.5) p.position.x = panelLeftX - 0.5;
    });
    if (t >= 1) isRewinding = false;
  } else {
    planets.forEach(p=>{
      const target = p.userData.isHovered ? p.userData.baseSpeed * 0.02 : p.userData.baseSpeed;
      p.userData.speed = THREE.MathUtils.lerp(p.userData.speed, target, 0.08);
      p.userData.angle += p.userData.speed;
      const r = p.userData.radius;
      p.position.set(Math.cos(p.userData.angle)*r, Math.sin(p.userData.angle)*r*0.5, Math.sin(p.userData.angle)*r*0.5);
      if (p.position.x > panelLeftX - 0.5) p.position.x = panelLeftX - 0.5;
      const scaleF = p.userData.isHovered ? responsiveScaleFactor*1.3 : responsiveScaleFactor;
      p.scale.copy(p.userData.originalScale.clone().multiplyScalar(scaleF));
    });
  }

  // anima fundo ativo (estrelas)
  if (backgrounds.length) {
    const active = backgrounds[currentBgIndex];
    if (active && active.userData && typeof active.userData.animate === 'function') {
      active.userData.animate();
    }
  }

  renderer.render(scene, camera);
}
animate();
