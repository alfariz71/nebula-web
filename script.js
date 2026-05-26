// ================================================================
// NEBULA — Hand Tracking + Three.js Galaxy Visual
// Step 7: Hand Tracking (MediaPipe)
// Step 8: Visual Nebula (Three.js particles, saturn, trails, neon)
// ================================================================

// ---- STATE ----
let handData = null; // Data landmark tangan terbaru
let attractors = []; // Titik-titik jari yang menarik partikel

// ================================================================
// STEP 8: THREE.JS NEBULA SETUP
// ================================================================

const nebulaCanvas = document.getElementById('nebulaCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: nebulaCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 80;

// ---- GALAXY PARTICLES ----
const PARTICLE_COUNT = 8000;
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);
const velocities = []; // velocity per partikel
const originalPositions = new Float32Array(PARTICLE_COUNT * 3);

const colorPalette = [
  new THREE.Color(0x00f5ff), // cyan
  new THREE.Color(0xbf00ff), // purple
  new THREE.Color(0xff006e), // pink
  new THREE.Color(0xffffff), // white
  new THREE.Color(0x4488ff), // blue
  new THREE.Color(0xffd700), // gold
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
  // Spiral galaxy distribution
  const arm = Math.floor(Math.random() * 3); // 3 spiral arms
  const angle = (arm / 3) * Math.PI * 2 + Math.random() * 0.5;
  const radius = Math.random() * 60 + 2;
  const spiralAngle = angle + radius * 0.05;
  const spread = (Math.random() - 0.5) * (radius * 0.25);

  const x = Math.cos(spiralAngle) * radius + spread;
  const y = (Math.random() - 0.5) * 8;
  const z = Math.sin(spiralAngle) * radius + spread;

  positions[i * 3]     = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;

  originalPositions[i * 3]     = x;
  originalPositions[i * 3 + 1] = y;
  originalPositions[i * 3 + 2] = z;

  const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
  colors[i * 3]     = col.r;
  colors[i * 3 + 1] = col.g;
  colors[i * 3 + 2] = col.b;

  sizes[i] = Math.random() * 1.5 + 0.3;

  velocities.push({ x: 0, y: 0, z: 0 });
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const particleMat = new THREE.PointsMaterial({
  size: 0.5,
  vertexColors: true,
  transparent: true,
  opacity: 0.85,
  sizeAttenuation: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// ---- SATURN RING ----
const ringGeo = new THREE.TorusGeometry(18, 2.5, 2, 120);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0x4488ff,
  wireframe: true,
  transparent: true,
  opacity: 0.15,
});
const saturn = new THREE.Mesh(ringGeo, ringMat);
saturn.rotation.x = Math.PI / 3;
scene.add(saturn);

// ---- SECOND RING (neon accent) ----
const ring2Geo = new THREE.TorusGeometry(28, 0.5, 2, 180);
const ring2Mat = new THREE.MeshBasicMaterial({
  color: 0xbf00ff,
  wireframe: false,
  transparent: true,
  opacity: 0.3,
});
const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
ring2.rotation.x = Math.PI / 2.2;
scene.add(ring2);

// ---- NEBULA BACKGROUND CLOUDS (flat sprite-like discs) ----
function makeNebulaCloud(x, y, z, color, radius) {
  const geo = new THREE.CircleGeometry(radius, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.035,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = Math.random() * Math.PI;
  scene.add(mesh);
  return mesh;
}

const clouds = [
  makeNebulaCloud(-20, 5, -30, 0xbf00ff, 40),
  makeNebulaCloud(25, -8, -20, 0x00f5ff, 30),
  makeNebulaCloud(0, 0, -40, 0xff006e, 50),
  makeNebulaCloud(-35, 10, -10, 0x4400ff, 25),
];

// ---- NEON TRAILS (lines dari jari) ----
const MAX_TRAILS = 5; // 5 jari
const TRAIL_LENGTH = 40;
const trails = [];

for (let t = 0; t < MAX_TRAILS; t++) {
  const trailPositions = new Float32Array(TRAIL_LENGTH * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

  const trailColors = [
    0xbf00ff, 0x00f5ff, 0xff006e, 0xffd700, 0x39ff14
  ];

  const trailMat = new THREE.LineBasicMaterial({
    color: trailColors[t],
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const line = new THREE.Line(trailGeo, trailMat);
  scene.add(line);

  trails.push({
    line,
    geo: trailGeo,
    positions: trailPositions,
    history: [], // array of {x,y,z}
  });
}

// ---- HELPER: screen coord → 3D world coord ----
function screenTo3D(nx, ny) {
  // nx, ny = 0..1 normalized (MediaPipe output)
  // Flip x karena webcam mirror
  const x = (1 - nx - 0.5) * 120;
  const y = -(ny - 0.5) * 80;
  return { x, y, z: 0 };
}

// ================================================================
// STEP 7: MEDIAPIPE HAND TRACKING SETUP
// ================================================================

const video = document.getElementById('video');
const handCanvas = document.getElementById('handCanvas');
const handCtx = handCanvas.getContext('2d');

const statusEl = document.getElementById('status');
const tipEls = [
  document.getElementById('tip0'),
  document.getElementById('tip1'),
  document.getElementById('tip2'),
  document.getElementById('tip3'),
  document.getElementById('tip4'),
];

// Resize handCanvas sesuai window
function resizeHandCanvas() {
  handCanvas.width  = window.innerWidth;
  handCanvas.height = window.innerHeight;
}
resizeHandCanvas();

// Index landmark ujung jari (MediaPipe): thumb=4, index=8, middle=12, ring=16, pinky=20
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

// Inisialisasi MediaPipe Hands
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
});

hands.onResults(onHandResults);

// Callback: setiap frame hand tracking
function onHandResults(results) {
  // Clear overlay canvas
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  attractors = []; // reset attractor positions

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    statusEl.textContent = `✦ TANGAN TERDETEKSI (${results.multiHandLandmarks.length})`;
    statusEl.className = 'status-hand';

    for (const landmarks of results.multiHandLandmarks) {
      // Gambar skeleton tangan (optional, subtle)
      drawConnectors(handCtx, landmarks, HAND_CONNECTIONS, {
        color: 'rgba(0,245,255,0.2)',
        lineWidth: 1,
      });

      // Ambil ujung 5 jari
      FINGERTIP_INDICES.forEach((idx, i) => {
        const lm = landmarks[idx];
        attractors.push({ x: lm.x, y: lm.y, fingerIndex: i });
      });
    }

    // Update fingertip glow divs
    // Ambil dari tangan pertama saja untuk visual glow
    const firstHand = results.multiHandLandmarks[0];
    FINGERTIP_INDICES.forEach((idx, i) => {
      const lm = firstHand[idx];
      // Flip x (mirror)
      const sx = (1 - lm.x) * window.innerWidth;
      const sy = lm.y * window.innerHeight;
      tipEls[i].style.left  = sx + 'px';
      tipEls[i].style.top   = sy + 'px';
      tipEls[i].style.opacity = '1';
      tipEls[i].classList.add('active');
    });

  } else {
    statusEl.textContent = 'Menunggu tangan...';
    statusEl.className = '';

    // Sembunyikan semua tip glow
    tipEls.forEach(el => {
      el.style.opacity = '0';
      el.classList.remove('active');
    });
  }
}

// Hubungkan webcam ke MediaPipe Camera
const mpCamera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480,
});

mpCamera.start().then(() => {
  statusEl.textContent = 'Kamera aktif — menunggu tangan...';
  statusEl.className = 'status-ok';
}).catch(err => {
  statusEl.textContent = 'Gagal akses kamera: ' + err.message;
});

// ================================================================
// ANIMATION LOOP
// ================================================================

let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.005;

  // ---- Rotasi galaxy ----
  particles.rotation.y += 0.001;
  saturn.rotation.z    += 0.003;
  ring2.rotation.y     += 0.002;
  ring2.rotation.z     += 0.001;

  // ---- Pulse nebula clouds ----
  clouds.forEach((c, i) => {
    c.material.opacity = 0.025 + Math.sin(time * 0.7 + i) * 0.015;
  });

  // ---- Partikel attracted ke jari ----
  const posAttr = particleGeo.attributes.position;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let px = posAttr.getX(i);
    let py = posAttr.getY(i);
    let pz = posAttr.getZ(i);

    // Drift balik ke posisi asli (spring force)
    const ox = originalPositions[i * 3];
    const oy = originalPositions[i * 3 + 1];
    const oz = originalPositions[i * 3 + 2];

    velocities[i].x += (ox - px) * 0.002;
    velocities[i].y += (oy - py) * 0.002;
    velocities[i].z += (oz - pz) * 0.002;

    // Force dari setiap attractor (ujung jari)
    for (const att of attractors) {
      const world = screenTo3D(att.x, att.y);
      const dx = world.x - px;
      const dy = world.y - py;
      const dz = world.z - pz;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.1;

      if (dist < 35) {
        const force = (35 - dist) / 35 * 0.08;
        velocities[i].x += (dx / dist) * force;
        velocities[i].y += (dy / dist) * force;
        velocities[i].z += (dz / dist) * force;
      }
    }

    // Damping
    velocities[i].x *= 0.95;
    velocities[i].y *= 0.95;
    velocities[i].z *= 0.95;

    posAttr.setXYZ(i,
      px + velocities[i].x,
      py + velocities[i].y,
      pz + velocities[i].z,
    );
  }
  posAttr.needsUpdate = true;

  // ---- Update neon trails per jari ----
  FINGERTIP_INDICES.forEach((_, i) => {
    const trail = trails[i];
    const att = attractors[i]; // mungkin undefined kalau tangan tidak terdeteksi

    if (att) {
      const world = screenTo3D(att.x, att.y);
      trail.history.unshift({ x: world.x, y: world.y, z: world.z });
      if (trail.history.length > TRAIL_LENGTH) trail.history.pop();
    } else {
      // Fade: geser history keluar
      if (trail.history.length > 0) trail.history.pop();
    }

    // Tulis ke buffer
    for (let t = 0; t < TRAIL_LENGTH; t++) {
      if (t < trail.history.length) {
        trail.positions[t * 3]     = trail.history[t].x;
        trail.positions[t * 3 + 1] = trail.history[t].y;
        trail.positions[t * 3 + 2] = trail.history[t].z;
      } else {
        // Titik kosong di ujung trail
        const last = trail.history[trail.history.length - 1];
        if (last) {
          trail.positions[t * 3]     = last.x;
          trail.positions[t * 3 + 1] = last.y;
          trail.positions[t * 3 + 2] = last.z;
        }
      }
    }
    trail.geo.attributes.position.needsUpdate = true;
    trail.line.material.opacity = att ? 0.7 : Math.max(0, trail.line.material.opacity - 0.05);
  });

  renderer.render(scene, camera);
}

animate();

// ================================================================
// RESIZE HANDLER
// ================================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeHandCanvas();
});