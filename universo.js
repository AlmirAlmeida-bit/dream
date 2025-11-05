// Dynamic imports will be used inside initUniverse function

/* PATCH MOBILE (Chrome Android)*/
const isChromeAndroid = /Chrome/i.test(navigator.userAgent) && /Android/i.test(navigator.userAgent);

// Initialize Three.js universe on demand
async function initUniverse() {
  // Dynamic imports for Three.js
  const THREE = await import('three');
  const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

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
}, { passive: true });

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
  
  // Mostra o footer junto com o fade
  const footer = document.querySelector('footer');
  if (footer) {
    setTimeout(() => {
      footer.classList.add('show');
    }, 500); // delay de 500ms para sincronizar com o fade
  }
  
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

/*Criação dos 5 primeiros planetas com variação de tamanho FIXA*/
// Variações fixas determinísticas para garantir tamanhos consistentes entre carregamentos
const sizeVariations = [0.1, 0.3, 0.2, 0.4, 0.5]; // valores fixos para cada planeta
for (let i = 0; i < 5; i++) {
  const scale = [0.9, 0.75, 0.85, 0.95, 1][i];
  // Tamanho fixo baseado no índice para garantir consistência entre carregamentos
  const size = (0.45 + sizeVariations[i]) * scale;
  createdSizes.push(size);

  const geom = new THREE.SphereGeometry(size, 32, 32);
  const tex = textureLoader.load(planetTextures[i]);
  const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 20 });
  const planet = new THREE.Mesh(geom, mat);

  planet.userData.index = i + 1;
  planet.userData.angle = Math.random() * Math.PI * 2;
  planet.userData.baseSpeed = 0.001 + i * 0.0008;
  planet.userData.speed = planet.userData.baseSpeed;
  // Salva originalScale como (1,1,1) para garantir consistência - o tamanho vem da geometria
  planet.userData.originalScale = new THREE.Vector3(1, 1, 1);
  // Para comportamento de enxame (desktop)
  planet.userData.minDistance = size * 2.5; // distância mínima entre planetas (2.5x o tamanho)
  planet.userData.radiusOffset = 0; // offset dinâmico para evitar colisões

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
  // Salva originalScale como (1,1,1) para garantir consistência
  p6.userData.originalScale = new THREE.Vector3(1, 1, 1);
  // Para comportamento de enxame (desktop)
  p6.userData.minDistance = avgSize * 2.5; // distância mínima entre planetas
  p6.userData.radiusOffset = 0; // offset dinâmico para evitar colisões

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
  // Salva originalScale como (1,1,1) para garantir consistência
  p7.userData.originalScale = new THREE.Vector3(1, 1, 1);
  // Para comportamento de enxame (desktop)
  p7.userData.minDistance = size * 2.5; // distância mínima entre planetas
  p7.userData.radiusOffset = 0; // offset dinâmico para evitar colisões

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

/* Câmera / Renderer / Luz */
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
const cameraOriginalZ = 20;
camera.position.set(0, 0, cameraOriginalZ);

const renderer = new THREE.WebGLRenderer({ 
  antialias: !isChromeAndroid, // desabilita antialias no Chrome Android para melhor performance
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
// Cap pixel ratio to reduce GPU load on high-DPI displays
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isChromeAndroid ? 1.0 : 1.5));
renderer.shadowMap.enabled = false; // desabilita shadows para melhor performance
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

// Seta de scroll no mobile
const scrollArrow = document.createElement('div');
scrollArrow.id = 'mobile-scroll-arrow';
scrollArrow.innerHTML = '↓';
scrollArrow.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  color: #0088ff;
  font-size: 24px;
  z-index: 101;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
`;
document.body.appendChild(scrollArrow);

function openPanel() { 
  panel.classList.add('open'); 
  panelOpen = true; 
  requestAnimationFrame(checkLogoHologramVisibility);
  // Atualiza controles para desabilitar interações no desktop
  updateControlsForMode();
  
  // Verifica se precisa mostrar seta de scroll (apenas no mobile)
  if (isMobileStackMode) {
    // Aguarda um frame para o painel estar completamente renderizado
    setTimeout(() => {
      checkScrollArrow();
    }, 100);
  }
}

// Event listener para scroll (removido e recriado a cada abertura)
let scrollArrowHandler = null;

function checkScrollArrow() {
  if (!isMobileStackMode) {
    scrollArrow.style.opacity = '0';
    return;
  }
  
  // Remove listener anterior se existir
  if (scrollArrowHandler) {
    panel.removeEventListener('scroll', scrollArrowHandler);
    scrollArrowHandler = null;
  }
  
  // Verifica se há scroll necessário
  const hasScroll = panel.scrollHeight > panel.clientHeight;
  
  if (hasScroll) {
    // Mostra seta se houver scroll
    scrollArrow.style.opacity = '1';
    
    // Cria novo handler para scroll
    scrollArrowHandler = () => {
      const isAtBottom = panel.scrollHeight - panel.scrollTop <= panel.clientHeight + 10;
      if (isAtBottom) {
        scrollArrow.style.opacity = '0';
      } else {
        scrollArrow.style.opacity = '1';
      }
    };
    
    // Adiciona listener para esconder seta quando rola até o final
    panel.addEventListener('scroll', scrollArrowHandler);
  } else {
    // Esconde seta se não houver scroll
    scrollArrow.style.opacity = '0';
  }
}
function closePanel() { 
  panel.classList.remove('open'); 
  panel.classList.remove('show-logo');
  panelOpen = false;
  panelContent.querySelectorAll('iframe').forEach(iframe => { iframe.src = iframe.src; });
  
  // Esconde seta ao fechar painel e remove listener
  scrollArrow.style.opacity = '0';
  if (scrollArrowHandler) {
    panel.removeEventListener('scroll', scrollArrowHandler);
    scrollArrowHandler = null;
  }
  
  // Retoma a ciranda quando o painel é fechado no mobile
  if (isMobileStackMode && mobileIntro.phase === 'idle') {
    mobileIntro.cirandaPaused = false;
  }
  
  // Atualiza controles para reabilitar interações no desktop
  updateControlsForMode();
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
const mobileLineDuration = 1500; // duração para entrar em fila
const mobileCirandaDuration = 2000; // duração para começar a ciranda
const mobileResetOpenDuration = 1000; // duração para abrir no reset
const mobileResetRotateDuration = 2000; // duração da rotação no reset
const mobileResetReturnDuration = 1500; // duração do retorno no reset

// EASING otimizado para melhor performance
function appleEase(t) { 
  const clamped = Math.min(1, Math.max(0, t));
  return 0.5 - 0.5 * Math.cos(Math.PI * clamped);
}

// EASING mais suave para retorno (ease-out quartic)
function smoothEaseOut(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 4);
}

// EASING extremamente suave para retorno (ease-out quintic + exponential)
function ultraSmoothEaseOut(t) {
  const clamped = Math.min(1, Math.max(0, t));
  // Combina quintic com exponential para desaceleração muito gradual
  const quintic = 1 - Math.pow(1 - clamped, 5);
  const exponential = 1 - Math.pow(2, -10 * clamped);
  return (quintic * 0.6 + exponential * 0.4); // mistura dos dois
}

// EASING suave para entrada (ease-in-out cubic)
function smoothEaseInOut(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 
    ? 4 * clamped * clamped * clamped 
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

let mobileIntro = {
  active: false,
  phase: 'idle', // 'line', 'ciranda', 'idle', 'reset'
  t0: 0,
  baseAngles: [], // posições finais no círculo
  initialPositions: [], // posições iniciais dos planetas
  queuePositions: [], // posições na fila inicial
  queueDistribution: [], // distribuição aleatória (esquerda/direita) para cada planeta
  cirandaRadius: 6, // raio da ciranda
  cirandaSpeed: 0.002, // velocidade da ciranda
  cirandaAngle: 0, // ângulo atual da ciranda
  cirandaStartAngles: [], // ângulos salvos para o reset
  cirandaPaused: false, // flag para pausar a ciranda quando planeta é tocado
  nameLabels: [] // elementos DOM para nomes dos planetas no mobile
};

// posição do empilhamento (x fixo, y decrescente) - MANTIDO PARA COMPATIBILIDADE
function stackPosByRank(rank) {
  const x = isHalfStackMode ? -5.8 : -4.1;
  const y = 7 - rank * 3.2;
  return new THREE.Vector3(x, y, 0);
}

// NOVO: Posicionamento em círculo ao redor do STL para mobile
function layoutMobileCircular() {
  const centerX = 0; // centro do STL
  const centerY = 0;
  const centerZ = 0;
  const radius = 6; // raio menor para ficar mais próximo do STL
  
  planets.forEach((planet, index) => {
    // Distribui os planetas uniformemente em um círculo
    const angle = (index / planets.length) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const z = centerZ;
    
    planet.position.set(x, y, z);
  });
}

// EMPILHAMENTO CUSTOM (7º planeta no topo, depois Chamados…) - MANTIDO PARA COMPATIBILIDADE
function layoutMobileStack() {
  // ordem de exibição no stack (índices do array planets):
  // 6 = novo planeta (Biblioteca), 0..5 = restantes na ordem original
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
  mobileIntro.phase = 'line'; // começa entrando em fila
  mobileIntro.t0 = performance.now();

  // Salva posições iniciais dos planetas (onde estão agora)
  mobileIntro.initialPositions = planets.map(p => p.position.clone());

  // Distribuição aleatória: 3 na esquerda e 4 na direita, ou 4 na esquerda e 3 na direita
  const leftCount = Math.random() < 0.5 ? 3 : 4; // aleatório: 3 ou 4
  const rightCount = planets.length - leftCount; // o restante vai para o outro lado
  
  // Cria array de índices e embaralha
  const indices = planets.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  // Define quais planetas vão para esquerda e quais para direita
  const leftIndices = indices.slice(0, leftCount);
  const rightIndices = indices.slice(leftCount);
  
  // Cria array de distribuição (true = esquerda, false = direita)
  mobileIntro.queueDistribution = planets.map((_, i) => leftIndices.includes(i));
  
  // Posições finais da fila: distribuição aleatória entre esquerda e direita
  // Calcula espaçamento baseado na quantidade de planetas em cada lado para centralização
  const leftSpacing = leftCount === 3 ? 3.5 : 2.5; // maior espaçamento para 3 planetas
  const rightSpacing = rightCount === 3 ? 3.5 : 2.5; // maior espaçamento para 3 planetas
  
  // Calcula offset Y para centralizar verticalmente
  const leftTotalHeight = (leftCount - 1) * (leftCount === 3 ? 3.5 : 2.5);
  const rightTotalHeight = (rightCount - 1) * (rightCount === 3 ? 3.5 : 2.5);
  const leftStartY = 6 - (leftTotalHeight / 2); // centraliza verticalmente
  const rightStartY = 6 - (rightTotalHeight / 2); // centraliza verticalmente
  
  mobileIntro.queuePositions = planets.map((p, i) => {
    const isLeft = mobileIntro.queueDistribution[i];
    const sideIndex = isLeft 
      ? leftIndices.indexOf(i) 
      : rightIndices.indexOf(i);
    
    const x = isLeft ? -5 : 5; // esquerda: -5, direita: 5
    const spacing = isLeft ? leftSpacing : rightSpacing;
    const startY = isLeft ? leftStartY : rightStartY;
    const y = startY - sideIndex * spacing; // fila vertical centralizada
    return new THREE.Vector3(x, y, 0);
  });
  
  // Posições finais: círculo para a ciranda
  mobileIntro.baseAngles = planets.map((_, i) => (i / planets.length) * Math.PI * 2);
  mobileIntro.cirandaAngle = 0;
}

// Função para reset no mobile: abre, gira e volta para fila
// Cria labels de nomes dos planetas no mobile
function createMobilePlanetLabels() {
  if (!isMobileStackMode) return;
  
  // Remove labels existentes
  mobileIntro.nameLabels.forEach(label => {
    if (label && label.parentNode) {
      label.parentNode.removeChild(label);
    }
  });
  mobileIntro.nameLabels = [];
  
  // Cria container para os labels
  let labelsContainer = document.getElementById('mobile-planet-labels');
  if (!labelsContainer) {
    labelsContainer = document.createElement('div');
    labelsContainer.id = 'mobile-planet-labels';
    labelsContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;
    document.body.appendChild(labelsContainer);
  }
  
  // Cria label para cada planeta
  planets.forEach((planet, index) => {
    const label = document.createElement('div');
    label.className = 'mobile-planet-label';
    
    // Quebra nomes com mais de duas palavras em exatamente duas linhas
    const name = planetNames[index];
    const words = name.split(' ');
    
    const isMultiLine = words.length > 2;
    
    if (isMultiLine) {
      // Divide em exatamente duas linhas: primeira palavra em cima, resto embaixo
      const firstLine = words[0];
      const secondLine = words.slice(1).join(' ');
      label.innerHTML = `<div style="display: block; line-height: 1.2;">${firstLine}</div><div style="display: block; line-height: 1.2;">${secondLine}</div>`;
    } else {
      label.textContent = name;
    }
    
    label.style.cssText = `
      position: absolute;
      color: #0088ff;
      font-family: 'Montserrat', sans-serif;
      font-size: 12px;
      font-weight: 300;
      text-align: center;
      line-height: ${isMultiLine ? '1.2' : '1.3'};
      white-space: ${isMultiLine ? 'normal' : 'nowrap'};
      text-shadow: 0 2px 4px rgba(0,0,0,0.8);
      opacity: 0;
      transform: scale(0) translateX(-50%);
      transform-origin: center center;
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
      width: ${isMultiLine ? '120px' : 'max-content'};
      max-width: 120px;
      word-wrap: break-word;
      box-sizing: border-box;
    `;
    labelsContainer.appendChild(label);
    mobileIntro.nameLabels.push(label);
    planet.userData.nameLabel = label;
    planet.userData.zoomScale = 1.0; // escala inicial
  });
}

// Atualiza posições dos labels seguindo os planetas
function updateMobilePlanetLabels() {
  if (!isMobileStackMode || !mobileIntro.nameLabels || mobileIntro.nameLabels.length === 0) return;
  
  planets.forEach((planet, index) => {
    const label = mobileIntro.nameLabels[index];
    if (!label) return;
    
    // Projeta posição 3D do planeta para coordenadas de tela
    planet.updateMatrixWorld(true); // Garante matriz atualizada
    const vec = new THREE.Vector3().setFromMatrixPosition(planet.matrixWorld);
    vec.project(camera);
    
    const px = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const py = (-(vec.y) * 0.5 + 0.5) * window.innerHeight;
    
    // Posiciona label abaixo do planeta (offset Y positivo)
    // Usa left e top fixos, transform apenas para scale e centralização
    // Sempre usa translateX(-50%) para centralizar horizontalmente
    const zoomScale = planet.userData.zoomScale || 1;
    label.style.left = `${px}px`;
    label.style.top = `${py + 40}px`; // 40px abaixo do planeta
    label.style.transform = `translateX(-50%) translateY(0) scale(${zoomScale})`;
    label.style.transformOrigin = 'center center';
  });
}

function startMobileReset() {
  if (!isMobileStackMode) return;
  mobileIntro.active = true;
  mobileIntro.phase = 'reset'; // fase de reset
  mobileIntro.t0 = performance.now();
  
  // Salva ângulos atuais dos planetas na ciranda
  mobileIntro.cirandaStartAngles = planets.map((p, i) => {
    const pos = p.position;
    return Math.atan2(pos.y, pos.x); // ângulo atual de cada planeta
  });
  
  // Cria nova distribuição aleatória para o reset (3 e 4, ou 4 e 3)
  const leftCount = Math.random() < 0.5 ? 3 : 4; // aleatório: 3 ou 4
  const rightCount = planets.length - leftCount; // o restante vai para o outro lado
  
  // Cria array de índices e embaralha
  const indices = planets.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  // Define quais planetas vão para esquerda e quais para direita
  const leftIndices = indices.slice(0, leftCount);
  const rightIndices = indices.slice(leftCount);
  
  // Cria array de distribuição (true = esquerda, false = direita)
  mobileIntro.queueDistribution = planets.map((_, i) => leftIndices.includes(i));
  
  // Atualiza posições da fila com nova distribuição aleatória
  // Calcula espaçamento baseado na quantidade de planetas em cada lado para centralização
  const leftSpacing = leftCount === 3 ? 3.5 : 2.5; // maior espaçamento para 3 planetas
  const rightSpacing = rightCount === 3 ? 3.5 : 2.5; // maior espaçamento para 3 planetas
  
  // Calcula offset Y para centralizar verticalmente
  const leftTotalHeight = (leftCount - 1) * (leftCount === 3 ? 3.5 : 2.5);
  const rightTotalHeight = (rightCount - 1) * (rightCount === 3 ? 3.5 : 2.5);
  const leftStartY = 6 - (leftTotalHeight / 2); // centraliza verticalmente
  const rightStartY = 6 - (rightTotalHeight / 2); // centraliza verticalmente
  
  mobileIntro.queuePositions = planets.map((p, i) => {
    const isLeft = mobileIntro.queueDistribution[i];
    const sideIndex = isLeft 
      ? leftIndices.indexOf(i) 
      : rightIndices.indexOf(i);
    
    const x = isLeft ? -5 : 5; // esquerda: -5, direita: 5
    const spacing = isLeft ? leftSpacing : rightSpacing;
    const startY = isLeft ? leftStartY : rightStartY;
    const y = startY - sideIndex * spacing; // fila vertical centralizada
    return new THREE.Vector3(x, y, 0);
  });
}

function applyResponsiveScale() {
  // Garante que pega a largura mais confiável para evitar variações durante carregamento
  // Usa o maior valor entre innerWidth e clientWidth para evitar valores muito pequenos
  const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
  
  // Garante um valor mínimo para evitar problemas durante carregamento
  const safeWidth = width > 0 ? width : 768;
  
  let scaleFactor = 1;
  if (safeWidth < 480) scaleFactor = 0.55;
  else if (safeWidth < 768) scaleFactor = 0.7;
  else if (safeWidth < 1024) scaleFactor = 0.9;

  scaleFactor = Math.max(0.4, scaleFactor);
  const isMobile = safeWidth <= 768;

  // No mobile, garante um scaleFactor fixo e consistente para evitar variações
  // Usa um valor baseado na largura da tela, mas normalizado para evitar flutuações
  let mobileScaleFactor = scaleFactor;
  if (isMobile) {
    // Normaliza o scaleFactor para mobile garantindo consistência
    // Usa breakpoints fixos para evitar variações entre carregamentos
    if (safeWidth < 480) {
      mobileScaleFactor = 0.55; // fixo para telas pequenas
    } else {
      mobileScaleFactor = 0.7; // fixo para telas médias mobile
    }
    // Garante que o mobileScaleFactor seja sempre o mesmo para a mesma largura
    // Arredonda para evitar imprecisões de ponto flutuante
    mobileScaleFactor = Math.round(mobileScaleFactor * 1000) / 1000; // arredonda para 3 casas decimais
  }

  // STL Scaling
  if (mesh && mesh.userData?.originalScale) {
    const mobileBoost = isMobile ? 1.5 : 1.0;
    const finalScale = isMobile ? mobileScaleFactor * mobileBoost : scaleFactor * mobileBoost;
    mesh.scale.copy(mesh.userData.originalScale.clone().multiplyScalar(finalScale));
  } else {
    pendingMeshScaleFactor = isMobile ? (mobileScaleFactor * 1.3) : (scaleFactor * 1.0);
  }

  // Planets scaling - garante que originalScale esteja definido
  planets.forEach(p => {
    // Garante que originalScale esteja sempre definido como (1,1,1) antes de aplicar scaling
    // Isso garante que o tamanho base venha da geometria, não de escalas anteriores
    if (!p.userData.originalScale) {
      p.userData.originalScale = new THREE.Vector3(1, 1, 1);
    }
    
    // Sempre reseta para originalScale (1,1,1) antes de aplicar novo scaling para garantir consistência
    p.userData.originalScale.set(1, 1, 1);
    
    if (p.userData.originalScale) {
      const mobilePlanetBoost = isMobile ? 1.74 : 1.0; // 1.45 * 1.20 = aumento de 20% no mobile
      // Se está em animação de zoom, não sobrescreve o zoom
      const zoomScale = (isMobile && p.userData.zoomScale !== undefined) ? p.userData.zoomScale : 1.0;
      const finalPlanetScale = isMobile ? (mobileScaleFactor * mobilePlanetBoost * zoomScale) : (scaleFactor * mobilePlanetBoost);
      // Garante precisão ao aplicar o scale - sempre parte de (1,1,1)
      p.scale.copy(p.userData.originalScale.clone().multiplyScalar(finalPlanetScale));
    }
    if (typeof p.userData.originalRadius !== 'undefined') {
      const finalRadiusScale = isMobile ? mobileScaleFactor : scaleFactor;
      p.userData.radius = p.userData.originalRadius * finalRadiusScale;
    }
  });

  // Camera - usa mobileScaleFactor no mobile para consistência
  const cameraScale = isMobile ? mobileScaleFactor : scaleFactor;
  camera.position.z = cameraScale < 1 ? (cameraOriginalZ / cameraScale) : cameraOriginalZ;
  camera.updateProjectionMatrix();

  const shouldStack = isMobile;
  if (shouldStack !== isMobileStackMode) {
    isMobileStackMode = shouldStack;
    if (isMobileStackMode) {
      isHalfStackMode = false;
      layoutMobileCircular(); // MUDANÇA: usar layout circular em vez de empilhamento
      // Cria labels de nomes dos planetas no mobile
      createMobilePlanetLabels();
      if (!hasRunMobileIntro) {
        startMobileIntro();
        hasRunMobileIntro = true;
      }
    } else {
      layoutDesktopOrbit();
      // Remove labels quando sair do mobile
      if (mobileIntro.nameLabels && mobileIntro.nameLabels.length > 0) {
        const labelsContainer = document.getElementById('mobile-planet-labels');
        if (labelsContainer) labelsContainer.remove();
        mobileIntro.nameLabels = [];
      }
    }
  } else {
    if (isMobileStackMode) {
      layoutMobileCircular(); // MUDANÇA: usar layout circular em vez de empilhamento
      // Garante que labels existem
      if (!mobileIntro.nameLabels || mobileIntro.nameLabels.length === 0) {
        createMobilePlanetLabels();
      }
    } else {
      layoutDesktopOrbit();
    }
  }

  updateControlsForMode();
}
applyResponsiveScale();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyResponsiveScale();
}, { passive: true });

/* Interações Desktop*/
window.addEventListener('click', (event) => {
  // Desabilita interações quando painel está aberto (apenas no desktop)
  if (panelOpen && !isMobileStackMode) return;
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
    // Pausa a ciranda quando um planeta é tocado (apenas no mobile)
    if (isMobileStackMode && mobileIntro.phase === 'idle') {
      mobileIntro.cirandaPaused = true;
    }
    
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
  if (hit.length > 0) {
    showPlanetPanelByIndex(hit[0].object.userData.index - 1);
    // Mantém pausado enquanto o painel está aberto
  } else {
    // Se não tocou em nenhum planeta, retoma a ciranda (se não estiver com painel aberto)
    if (isMobileStackMode && !panelOpen && mobileIntro.phase === 'idle') {
      mobileIntro.cirandaPaused = false;
    }
  }
}, { passive: true });

/*Hover Desktop (com frenagem)*/
function updateHoverTooltip() {
  if (isChromeAndroid) return;

  // No desktop, desabilita hover quando painel está aberto
  if (isMobileStackMode) {
    // Mobile: usa a lógica original
  if (panelOpen || mobileIntro.active) {
    document.body.style.cursor = 'default';
    hideTipping();
    return;
    }
  } else {
    // Desktop: bloqueia completamente quando painel está aberto
    if (panelOpen) {
      document.body.style.cursor = 'default';
      hideTipping();
      // Restaura velocidades dos planetas ao normal (remove frenagem)
      planets.forEach(p => {
        p.userData.speed = p.userData.baseSpeed;
      });
      return;
    }
    if (mobileIntro.active) {
      document.body.style.cursor = 'default';
      hideTipping();
      return;
    }
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
    // Restaura velocidades quando não há hover
    planets.forEach(p => {
      if (p.userData.speed !== p.userData.baseSpeed) {
        p.userData.speed = THREE.MathUtils.lerp(p.userData.speed, p.userData.baseSpeed, 0.1);
      }
    });
  }
}
window.addEventListener('mousemove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}, { passive: true });

/*Reset de Órbita (com easing Apple Smooth)*/
let rewindStartTime = null;
const rewindDuration = 1800;
let isRewinding = false;
const rewindData = planets.map(() => ({ startAngle: 0, endAngle: 0 }));

document.getElementById('reset-orbit').addEventListener('click', () => {
  closePanel();
  if (isMobileStackMode) {
    // Para mobile, inicia rotação aleatória seguida de retorno flutuante
    startMobileReset();
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
    // Desktop: desabilita controles quando painel está aberto
    if (panelOpen) {
      controls.enabled = false;
      controls.enableZoom = false;
      controls.enableRotate = false;
      controls.enablePan = false;
  } else {
    controls.enabled = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    }
    renderer.domElement.style.touchAction = '';
  }
}

// Interação do STL no mobile (arrastar = rotacionar X/Y) — COM FLUIDEZ
const stlDrag = { 
  active: false, 
  lastX: 0, 
  lastY: 0,
  targetRotationX: 0,
  targetRotationY: 0,
  currentRotationX: 0,
  currentRotationY: 0
};
const STL_DRAG_SENS = 0.0045; // Sensibilidade aumentada para mais fluidez

function onStlTouchStart(e) {
  if (!isMobileStackMode || !mesh) return;
  if (!e.touches || e.touches.length === 0) return;
  const t = e.touches[0];
  stlDrag.active = true;
  stlDrag.lastX = t.clientX;
  stlDrag.lastY = t.clientY;
  // Inicializa as rotações alvo com a rotação atual
  stlDrag.targetRotationX = mesh.rotation.x;
  stlDrag.targetRotationY = mesh.rotation.y;
  stlDrag.currentRotationX = mesh.rotation.x;
  stlDrag.currentRotationY = mesh.rotation.y;
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
  
  // Atualiza rotações alvo (mais fluido)
  stlDrag.targetRotationY += dx * STL_DRAG_SENS;
  stlDrag.targetRotationX += dy * STL_DRAG_SENS;
  
  // Limita inclinação X
  const maxTilt = Math.PI / 2.5;
  stlDrag.targetRotationX = Math.max(-maxTilt, Math.min(maxTilt, stlDrag.targetRotationX));
  
  // Aplica suavização imediata para fluidez
  const smoothFactor = 0.3; // quanto maior, mais direto (0.3 = suave e fluido)
  stlDrag.currentRotationX += (stlDrag.targetRotationX - stlDrag.currentRotationX) * smoothFactor;
  stlDrag.currentRotationY += (stlDrag.targetRotationY - stlDrag.currentRotationY) * smoothFactor;
  
  mesh.rotation.x = stlDrag.currentRotationX;
  mesh.rotation.y = stlDrag.currentRotationY;
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

  // STL: gira sozinho sempre (apenas quando não está sendo arrastado no mobile)
  if (mesh) {
    if (isMobileStackMode && stlDrag.active) {
      // Durante o arrasto, não gira automaticamente - apenas segue o movimento do usuário
      // Continua suavizando a rotação se necessário
      const smoothFactor = 0.15;
      stlDrag.currentRotationX += (stlDrag.targetRotationX - stlDrag.currentRotationX) * smoothFactor;
      stlDrag.currentRotationY += (stlDrag.targetRotationY - stlDrag.currentRotationY) * smoothFactor;
      mesh.rotation.x = stlDrag.currentRotationX;
      mesh.rotation.y = stlDrag.currentRotationY;
    } else {
      // Rotação automática quando não está sendo arrastado
      mesh.rotation.y += 0.005;
    }
  }

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
      if (mobileIntro.phase === 'line') {
        // FASE 1: Planetas entram em fila
        const t = Math.min(1, (now - mobileIntro.t0) / mobileLineDuration);
        const te = appleEase(t);
        
        planets.forEach((p, i) => {
          const startPos = mobileIntro.initialPositions[i];
          const targetPos = mobileIntro.queuePositions[i];
          
          // Interpola da posição inicial para a fila
          p.position.lerpVectors(startPos, targetPos, te);
        });
        
        if (t >= 1) {
          mobileIntro.phase = 'ciranda';
          mobileIntro.t0 = now;
        }
      } else if (mobileIntro.phase === 'ciranda') {
        // FASE 2: Transição da fila para o círculo da ciranda - ZOOM IN (nomes aparecem)
        const t = Math.min(1, (now - mobileIntro.t0) / mobileCirandaDuration);
        const te = appleEase(t);
        const radius = mobileIntro.cirandaRadius;
        
        // Zoom in: de 0.85 para 1.0 (planetas voltam ao normal, nomes aparecem)
        const planetZoomScale = 0.85 + (0.15 * te); // 0.85 -> 1.0
        
        // Calcula mobileScale atual
        const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
        const safeWidth = width > 0 ? width : 768;
        const currentMobileScale = safeWidth < 480 ? 0.55 : 0.7;
        
        planets.forEach((p, i) => {
          const queuePos = mobileIntro.queuePositions[i];
          const baseAngle = mobileIntro.baseAngles[i];
          const circleX = Math.cos(baseAngle) * radius;
          const circleY = Math.sin(baseAngle) * radius;
          
          // Interpola da fila para o círculo
          const x = queuePos.x + (circleX - queuePos.x) * te;
          const y = queuePos.y + (circleY - queuePos.y) * te;
          p.position.set(x, y, 0);
          
          // Aplica zoom in no planeta (de 0.85 para 1.0)
          p.userData.zoomScale = planetZoomScale;
          const baseScale = p.userData.originalScale || new THREE.Vector3(1, 1, 1);
          p.scale.copy(baseScale.clone().multiplyScalar(planetZoomScale * (currentMobileScale * 1.74)));
          
          // Mostra nome (apenas opacity muda)
          const label = mobileIntro.nameLabels[i];
          if (label) {
            label.style.opacity = String(te); // fade in: 0 -> 1
            label.style.transform = `translateX(-50%) translateY(0) scale(1)`;
            label.style.transformOrigin = 'center center';
          }
        });
        
        if (t >= 1) {
          mobileIntro.active = false;
          mobileIntro.phase = 'idle';
          // Garante zoom final de 1.0
          planets.forEach((p, i) => {
            p.userData.zoomScale = 1.0;
            const baseScale = p.userData.originalScale || new THREE.Vector3(1, 1, 1);
            const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
            const safeWidth = width > 0 ? width : 768;
            const currentMobileScale = safeWidth < 480 ? 0.55 : 0.7;
            p.scale.copy(baseScale.clone().multiplyScalar(currentMobileScale * 1.74));
            const label = mobileIntro.nameLabels[i];
            if (label) {
              label.style.opacity = '1';
              label.style.transform = `translateX(-50%) translateY(0) scale(1)`;
              label.style.transformOrigin = 'center center';
            }
          });
        }
      } else if (mobileIntro.phase === 'reset') {
        // Reset: abre, gira e volta para fila
        const elapsed = now - mobileIntro.t0;
        const radius = mobileIntro.cirandaRadius;
        
        if (elapsed < mobileResetOpenDuration) {
          // FASE 1: Abrir (expandir o círculo) - apenas nomes desaparecem
          const t = elapsed / mobileResetOpenDuration;
        const te = appleEase(t);
          const expandedRadius = radius * 1.5; // expande 50%
          
          // Planetas mantêm tamanho quase normal (zoom mínimo de 0.85)
          const planetZoomScale = 1.0 - (0.15 * te); // 1.0 -> 0.85 (redução leve)
          
          // Calcula mobileScale atual
          const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
          const safeWidth = width > 0 ? width : 768;
          const currentMobileScale = safeWidth < 480 ? 0.55 : 0.7;
        
        planets.forEach((p, i) => {
            const startAngle = mobileIntro.cirandaStartAngles[i];
            const currentRadius = radius + (expandedRadius - radius) * te;
            const x = Math.cos(startAngle) * currentRadius;
            const y = Math.sin(startAngle) * currentRadius;
            p.position.set(x, y, 0);
            
            // Aplica zoom leve no planeta (não fica muito pequeno)
            p.userData.zoomScale = planetZoomScale;
            const baseScale = p.userData.originalScale || new THREE.Vector3(1, 1, 1);
            p.scale.copy(baseScale.clone().multiplyScalar(planetZoomScale * (currentMobileScale * 1.74)));
            
            // Esconde apenas o nome (opacity vai para 0)
            const label = mobileIntro.nameLabels[i];
            if (label) {
              label.style.opacity = String(1 - te); // fade out: 1 -> 0
              label.style.transform = `translateX(-50%) translateY(0) scale(1)`;
              label.style.transformOrigin = 'center center';
            }
          });
        } else if (elapsed < mobileResetOpenDuration + mobileResetRotateDuration) {
          // FASE 2: Girar (rotação completa) - planetas mantêm tamanho, nomes escondidos
          const t = (elapsed - mobileResetOpenDuration) / mobileResetRotateDuration;
          const te = appleEase(t);
          const rotationAngle = te * Math.PI * 2; // uma volta completa
          const expandedRadius = radius * 1.5;
          const planetZoomScale = 0.85; // mantém tamanho quase normal
          
          // Calcula mobileScale atual
          const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
          const safeWidth = width > 0 ? width : 768;
          const currentMobileScale = safeWidth < 480 ? 0.55 : 0.7;
          
          planets.forEach((p, i) => {
            const startAngle = mobileIntro.cirandaStartAngles[i];
            const currentAngle = startAngle + rotationAngle;
            const x = Math.cos(currentAngle) * expandedRadius;
            const y = Math.sin(currentAngle) * expandedRadius;
            p.position.set(x, y, 0);
            
            // Mantém tamanho quase normal
            p.userData.zoomScale = planetZoomScale;
            const baseScale = p.userData.originalScale || new THREE.Vector3(1, 1, 1);
            p.scale.copy(baseScale.clone().multiplyScalar(planetZoomScale * (currentMobileScale * 1.74)));
            
            // Nome continua escondido
            const label = mobileIntro.nameLabels[i];
            if (label) {
              label.style.opacity = '0';
              label.style.transform = `translateX(-50%) translateY(0) scale(1)`;
              label.style.transformOrigin = 'center center';
            }
          });
        } else if (elapsed < mobileResetOpenDuration + mobileResetRotateDuration + mobileResetReturnDuration) {
          // FASE 3: Voltar para fila - planetas mantêm tamanho, nomes escondidos
          const t = (elapsed - mobileResetOpenDuration - mobileResetRotateDuration) / mobileResetReturnDuration;
          const te = appleEase(t);
          const planetZoomScale = 0.85; // mantém tamanho quase normal durante retorno
          
          // Calcula mobileScale atual
          const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
          const safeWidth = width > 0 ? width : 768;
          const currentMobileScale = safeWidth < 480 ? 0.55 : 0.7;
          
          planets.forEach((p, i) => {
            const currentPos = p.position.clone();
            const targetPos = mobileIntro.queuePositions[i];
            p.position.lerpVectors(currentPos, targetPos, te);
            
            // Mantém tamanho quase normal durante retorno
            p.userData.zoomScale = planetZoomScale;
            const baseScale = p.userData.originalScale || new THREE.Vector3(1, 1, 1);
            p.scale.copy(baseScale.clone().multiplyScalar(planetZoomScale * (currentMobileScale * 1.74)));
            
            // Nome continua escondido
            const label = mobileIntro.nameLabels[i];
            if (label) {
              label.style.opacity = '0';
              label.style.transform = `translateX(-50%) translateY(0) scale(1)`;
              label.style.transformOrigin = 'center center';
            }
          });
        } else {
          // Reset completo - volta para fila e reinicia a ciranda
          planets.forEach((p, i) => {
            p.position.copy(mobileIntro.queuePositions[i]);
          });
          // Reinicia a ciranda automaticamente
          mobileIntro.phase = 'ciranda';
          mobileIntro.t0 = now;
          mobileIntro.cirandaAngle = 0;
        }
      }
    } else {
      // Estado idle: Ciranda contínua ao redor do STL
      if (!panelOpen) {
        const radius = mobileIntro.cirandaRadius;
        
        // Garante que baseAngles está definido
        if (!mobileIntro.baseAngles || mobileIntro.baseAngles.length === 0) {
          mobileIntro.baseAngles = planets.map((_, i) => (i / planets.length) * Math.PI * 2);
        }
        
        // Atualiza o ângulo da ciranda (rotação contínua) apenas se não estiver pausado
        if (!mobileIntro.cirandaPaused) {
          mobileIntro.cirandaAngle += mobileIntro.cirandaSpeed;
          if (mobileIntro.cirandaAngle > Math.PI * 2) mobileIntro.cirandaAngle -= Math.PI * 2;
        }
        
        // Posiciona os planetas na ciranda (mesmo se pausado, mantém na posição atual)
        // Zoom in completo (1.0) quando em idle
        planets.forEach((p, index) => {
          const baseAngle = mobileIntro.baseAngles[index];
          const currentAngle = baseAngle + mobileIntro.cirandaAngle;
          const x = Math.cos(currentAngle) * radius;
          const y = Math.sin(currentAngle) * radius;
          p.position.set(x, y, 0);
          
          // Garante zoom in completo (1.0) em idle
          if (p.userData.zoomScale !== 1.0) {
            p.userData.zoomScale = 1.0;
            const baseScale = p.userData.originalScale || new THREE.Vector3(1, 1, 1);
            const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
            const safeWidth = width > 0 ? width : 768;
            const currentMobileScale = safeWidth < 480 ? 0.55 : 0.7;
            p.scale.copy(baseScale.clone().multiplyScalar(currentMobileScale * 1.74));
          }
          
          // Garante nome visível em idle
          const label = mobileIntro.nameLabels[index];
          if (label && label.style.opacity !== '1') {
            label.style.opacity = '1';
            label.style.transform = `translateX(-50%) translateY(0) scale(1)`;
            label.style.transformOrigin = 'center center';
          }
        });
      } else {
        // Se o painel está aberto, também pausa a ciranda
        mobileIntro.cirandaPaused = true;
      }
    }
  } else {
    // Desktop: órbitas (com easing na volta do reset)
    if (isRewinding) {
      const t = Math.min(1, (now - rewindStartTime) / rewindDuration);
      const e = appleEase(t);
      
      // Calcula posições orbitais base
      planets.forEach((p, i) => {
        p.userData.angle = THREE.MathUtils.lerp(rewindData[i].startAngle, rewindData[i].endAngle, e);
        const r = p.userData.radius;
        const baseX = Math.cos(p.userData.angle) * r;
        const baseY = Math.sin(p.userData.angle) * r;
        p.position.set(baseX, baseY, 0);
      });
      
      // Aplica comportamento de enxame mesmo durante o reset
      planets.forEach((p, i) => {
        let totalRepulsionX = 0;
        let totalRepulsionY = 0;
        
        planets.forEach((other, j) => {
          if (i === j) return;
          
          const dx = p.position.x - other.position.x;
          const dy = p.position.y - other.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const minDist = (p.userData.minDistance || 0) + (other.userData.minDistance || 0);
          
          if (distance > 0 && distance < minDist) {
            const force = (minDist - distance) / minDist;
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            
            totalRepulsionX += normalizedX * force * 0.15;
            totalRepulsionY += normalizedY * force * 0.15;
          }
        });
        
        // Aplica repulsão
        p.position.x += totalRepulsionX;
        p.position.y += totalRepulsionY;
      });
      
      if (t >= 1) isRewinding = false;
    } else {
      // Comportamento de enxame: evita colisões entre planetas
      planets.forEach((p, i) => {
        // Calcula repulsão de outros planetas
        let totalRepulsionX = 0;
        let totalRepulsionY = 0;
        
        planets.forEach((other, j) => {
          if (i === j) return; // não compara com ele mesmo
          
          const dx = p.position.x - other.position.x;
          const dy = p.position.y - other.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Distância mínima combinada
          const minDist = (p.userData.minDistance || 0) + (other.userData.minDistance || 0);
          
          if (distance > 0 && distance < minDist) {
            // Força de repulsão (inversamente proporcional à distância)
            const force = (minDist - distance) / minDist;
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            
            totalRepulsionX += normalizedX * force * 0.15; // força suave
            totalRepulsionY += normalizedY * force * 0.15;
          }
        });
        
        // Aplica o movimento orbital normal
        const target = p.userData.baseSpeed;
        p.userData.speed = THREE.MathUtils.lerp(p.userData.speed, target, 0.08);
        p.userData.angle += p.userData.speed;
        
        // Calcula posição orbital base
        const baseRadius = p.userData.radius;
        const baseX = Math.cos(p.userData.angle) * baseRadius;
        const baseY = Math.sin(p.userData.angle) * baseRadius;
        
        // Aplica repulsão para evitar colisões
        const finalX = baseX + totalRepulsionX;
        const finalY = baseY + totalRepulsionY;
        
        p.position.set(finalX, finalY, 0);
      });
    }
  }

  updateHoverTooltip();

  // Atualiza posições dos labels de nomes no mobile
  if (isMobileStackMode) {
    updateMobilePlanetLabels();
  }

  if (starFieldFar?.userData?.animate) starFieldFar.userData.animate();

  renderer.render(scene, camera);
}
  animate();

} // End of initUniverse function

// Initialize universe after DOM is ready, with a small delay to prioritize initial paint
document.addEventListener('DOMContentLoaded', () => {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    console.log('Reduced motion preference detected, skipping 3D animations');
    return;
  }
  
  // Small delay to allow initial paint to complete
  setTimeout(() => {
    initUniverse().catch(console.error);
  }, 500);
});
