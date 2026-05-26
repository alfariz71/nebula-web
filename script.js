/* =============================================
   SPACE NEBULA BIRTHDAY — script.js
   Sections:
   1. PARTICLE SYSTEM (Three.js)
   2. HAND TRACKING SYSTEM (MediaPipe)
   3. UI SYSTEM (cursor, hover, click)
   4. QUESTION FLOW
   5. CAMERA SYSTEM
   6. PUZZLE GAME
   7. VICTORY SCENE
   8. AUDIO SYSTEM
   9. APP INIT
   ============================================= */

"use strict";

/* ──────────────────────────────────────────────
   §1  PARTICLE SYSTEM — Three.js Nebula
   ────────────────────────────────────────────── */
const ParticleSystem = (() => {
  let renderer, scene, camera;
  let starField, nebula1, nebula2;
  let raf;

  function init() {
    const canvas = document.getElementById("bg-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x03010a, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 600;

    _buildStars();
    _buildNebula();
    _listen();
    _loop();
  }

  function _buildStars() {
    const count = 2400;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 2000;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 2000;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2000;

      // Mostly white, occasional tinted star
      const t = Math.random();
      col[i * 3]     = t < 0.85 ? 1.0 : (t < 0.93 ? 1.0 : 0.5);
      col[i * 3 + 1] = t < 0.85 ? 1.0 : (t < 0.93 ? 0.6 : 0.5);
      col[i * 3 + 2] = t < 0.85 ? 1.0 : (t < 0.93 ? 1.0 : 1.0);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: false,
    });
    starField = new THREE.Points(geo, mat);
    scene.add(starField);
  }

  function _buildNebula() {
    const _make = (count, colorA, colorB, spread) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const ca = new THREE.Color(colorA);
      const cb = new THREE.Color(colorB);

      for (let i = 0; i < count; i++) {
        const r = Math.random() * spread;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
        pos[i * 3 + 2] = r * Math.cos(phi) - 200;

        const mix = Math.random();
        col[i * 3]     = ca.r + (cb.r - ca.r) * mix;
        col[i * 3 + 1] = ca.g + (cb.g - ca.g) * mix;
        col[i * 3 + 2] = ca.b + (cb.b - ca.b) * mix;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color",    new THREE.BufferAttribute(col, 3));

      const mat = new THREE.PointsMaterial({
        size: 3.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return new THREE.Points(geo, mat);
    };

    nebula1 = _make(700, "#ff6ec7", "#a855f7", 320);
    nebula2 = _make(500, "#a855f7", "#22d3ee", 280);
    nebula2.position.set(150, 80, -50);
    scene.add(nebula1);
    scene.add(nebula2);
  }

  let clock = 0;
  let warpActive = false;
  let warpSpeed = 0;

  function triggerWarp() {
    warpActive = true;
    warpSpeed = 0;
    setTimeout(() => { warpActive = false; warpSpeed = 0; }, 1200);
  }

  function _loop() {
    raf = requestAnimationFrame(_loop);
    clock += 0.004;

    // Gentle rotation
    if (starField) starField.rotation.y = clock * 0.04;
    if (nebula1)   { nebula1.rotation.y = clock * 0.06; nebula1.rotation.x = Math.sin(clock * 0.3) * 0.05; }
    if (nebula2)   { nebula2.rotation.y = -clock * 0.05; nebula2.rotation.z = clock * 0.02; }

    // Warp: speed up z movement
    if (warpActive) {
      warpSpeed = Math.min(warpSpeed + 0.8, 25);
      camera.position.z -= warpSpeed;
      if (camera.position.z < 200) camera.position.z = 600;
    } else {
      camera.position.z += (600 - camera.position.z) * 0.03;
    }

    renderer.render(scene, camera);
  }

  function _listen() {
    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  return { init, triggerWarp };
})();


/* ──────────────────────────────────────────────
   §2  HAND TRACKING SYSTEM — MediaPipe Hands
   ────────────────────────────────────────────── */
const HandTracking = (() => {
  let hands;
  let lastPinch = false;
  let pinchCooldown = false;
  const callbacks = { onMove: null, onPinch: null, onRelease: null };

  // Landmark indices
  const WRIST       = 0;
  const INDEX_TIP   = 8;
  const THUMB_TIP   = 4;
  const MIDDLE_TIP  = 12;
  const RING_TIP    = 16;
  const PINKY_TIP   = 20;
  const INDEX_MCP   = 5;
  const MIDDLE_MCP  = 9;

  async function init(videoEl) {
    if (typeof Hands === "undefined") {
      console.warn("MediaPipe Hands not loaded");
      _fallbackMouse();
      return;
    }

    hands = new Hands({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,     // 0 = fastest
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.55,
    });

    hands.onResults(_onResults);

    const cam = new Camera(videoEl, {
      onFrame: async () => { await hands.send({ image: videoEl }); },
      width: 320, height: 240,
    });

    try {
      await cam.start();
      document.getElementById("cam-status").textContent = "✓ Camera ready — raise your hand!";
    } catch (e) {
      document.getElementById("cam-status").textContent = "⚠ Camera denied. Use mouse/touch.";
      _fallbackMouse();
    }
  }

  function _onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;

    const lm = results.multiHandLandmarks[0];

    // --- Virtual cursor from index finger tip ---
    const ix = (1 - lm[INDEX_TIP].x) * window.innerWidth;   // mirror
    const iy = lm[INDEX_TIP].y * window.innerHeight;
    if (callbacks.onMove) callbacks.onMove(ix, iy);

    // --- Pinch detection: distance index tip to thumb tip ---
    const dx = lm[INDEX_TIP].x - lm[THUMB_TIP].x;
    const dy = lm[INDEX_TIP].y - lm[THUMB_TIP].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const isPinching = dist < 0.07;

    if (isPinching && !lastPinch && !pinchCooldown) {
      lastPinch = true;
      pinchCooldown = true;
      if (callbacks.onPinch) callbacks.onPinch(ix, iy);
      setTimeout(() => { pinchCooldown = false; }, 600);
    } else if (!isPinching && lastPinch) {
      lastPinch = false;
      if (callbacks.onRelease) callbacks.onRelease(ix, iy);
    }

    // Gesture label
    const label = isPinching ? "PINCH ✌" : _classifyGesture(lm);
    document.getElementById("gesture-label").textContent = label;
  }

  function _classifyGesture(lm) {
    // Heuristic: count extended fingers
    const tips = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
    const mcps = [INDEX_MCP, MIDDLE_MCP, MIDDLE_MCP, MIDDLE_MCP];
    let extended = 0;
    for (let i = 0; i < 4; i++) {
      if (lm[tips[i]].y < lm[tips[i] - 2].y) extended++;
    }
    if (extended === 4) return "OPEN PALM ✋";
    if (extended === 1) return "POINTING ☝";
    if (extended === 2) return "PEACE ✌";
    return "IDLE";
  }

  // Fallback: mouse + click
  function _fallbackMouse() {
    document.addEventListener("mousemove", (e) => {
      if (callbacks.onMove) callbacks.onMove(e.clientX, e.clientY);
    });
    document.addEventListener("click", (e) => {
      if (callbacks.onPinch) callbacks.onPinch(e.clientX, e.clientY);
    });
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (callbacks.onMove) callbacks.onMove(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      if (callbacks.onPinch) callbacks.onPinch(t.clientX, t.clientY);
    });
    document.getElementById("cam-status").textContent = "Mouse/touch mode active";
  }

  function on(event, fn) { callbacks[event] = fn; }

  return { init, on };
})();


/* ──────────────────────────────────────────────
   §3  UI SYSTEM — cursor, hover detection, click
   ────────────────────────────────────────────── */
const UISystem = (() => {
  const cursor   = document.getElementById("hand-cursor");
  const ripple   = document.getElementById("pinch-ripple");
  let curX = -100, curY = -100;
  let hoveredEl = null;
  const interactiveSelector = ".holo-btn, .answer-btn, .puzzle-tile";

  function init() {
    HandTracking.on("onMove",    _onMove);
    HandTracking.on("onPinch",   _onPinch);
    HandTracking.on("onRelease", _onRelease);
  }

  function _onMove(x, y) {
    curX = x; curY = y;
    cursor.style.left = x + "px";
    cursor.style.top  = y + "px";

    // Hover detection
    const el = document.elementFromPoint(x, y);
    const target = el ? el.closest(interactiveSelector) : null;

    if (target !== hoveredEl) {
      if (hoveredEl) hoveredEl.classList.remove("hovered");
      hoveredEl = target;
      if (hoveredEl) {
        hoveredEl.classList.add("hovered");
        AudioSystem.play("hover");
      }
    }
  }

  function _onPinch(x, y) {
    cursor.classList.add("pinching");

    // Ripple effect
    ripple.style.left = x + "px";
    ripple.style.top  = y + "px";
    ripple.classList.remove("ripple-active");
    void ripple.offsetWidth; // reflow
    ripple.classList.add("ripple-active");

    AudioSystem.play("click");

    // Fire click on hovered element
    if (hoveredEl) {
      hoveredEl.classList.add("pinched");
      hoveredEl.click();
      setTimeout(() => hoveredEl && hoveredEl.classList.remove("pinched"), 300);
    }
  }

  function _onRelease() {
    cursor.classList.remove("pinching");
  }

  function getCursorPos() { return { x: curX, y: curY }; }

  return { init, getCursorPos };
})();


/* ──────────────────────────────────────────────
   §4  QUESTION FLOW
   ────────────────────────────────────────────── */
const QuestionFlow = (() => {
  let currentQ = 0;
  let answers = [];

  const questions = [
    {
      q: "🌟 Di mana kamu biasanya menemukan ketenangan terbesar?",
      opts: ["Di bawah sinar matahari", "Di keramaian kota", "Di bawah bintang malam", "Di tengah alam hijau"]
    },
    {
      q: "🎂 Apa harapan terbesarmu di ulang tahun ini?",
      opts: ["Kesehatan & kebahagiaan", "Petualangan baru", "Cinta yang tulus", "Mimpi yang terwujud"]
    },
    {
      q: "🌸 Kamu adalah...",
      opts: ["Bintang yang bersinar", "Bulan yang menenangkan", "Aurora yang memukau", "Nebula yang misterius"]
    },
    {
      q: "💫 Warna apa yang paling menggambarkan jiwamu?",
      opts: ["Pink cerah & penuh cinta", "Ungu misterius & bijak", "Cyan tenang & dalam", "Emas hangat & bercahaya"]
    },
    {
      q: "🚀 Jika kamu bisa pergi ke mana saja di galaksi ini, kamu akan...",
      opts: ["Tinggal di bintang terjauh", "Surfing nebula bersama", "Membuat rumah di bulan", "Menjelajahi black hole"]
    },
  ];

  function start() {
    currentQ = 0;
    answers = [];
    _showQuestion(0);
  }

  function _showQuestion(idx) {
    if (idx >= questions.length) {
      _finishQuestions();
      return;
    }

    const q = questions[idx];
    const total = questions.length;

    document.getElementById("q-number").textContent =
      String(idx + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");

    // Animate question in
    const qBox = document.getElementById("question-box");
    qBox.style.animation = "none";
    void qBox.offsetWidth;
    qBox.style.animation = "fade-up 0.6s ease forwards";
    document.getElementById("question-text").textContent = q.q;

    const container = document.getElementById("answers-container");
    container.innerHTML = "";

    const letters = ["A", "B", "C", "D"];
    q.opts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "answer-btn";
      btn.dataset.letter = letters[i];
      btn.innerHTML = `<span class="answer-text">${opt}</span>`;
      btn.style.animationDelay = `${0.1 * i + 0.3}s`;
      btn.style.animation = "fade-up 0.5s ease both";
      btn.style.opacity = "0";
      btn.onclick = () => _selectAnswer(i, opt);
      container.appendChild(btn);
    });
  }

  function _selectAnswer(idx, text) {
    answers.push(text);

    // Visual feedback
    const btns = document.querySelectorAll(".answer-btn");
    btns.forEach(b => b.style.pointerEvents = "none");
    btns[idx].classList.add("selected");

    AudioSystem.play("select");

    setTimeout(() => {
      currentQ++;
      SceneManager.warpTransition(() => _showQuestion(currentQ));
    }, 800);
  }

  function _finishQuestions() {
    SceneManager.warpTransition(() => {
      SceneManager.showScene("scene-puzzle");
      CameraSystem.init();
    });
  }

  return { start };
})();


/* ──────────────────────────────────────────────
   §5  CAMERA SYSTEM — capture for puzzle
   ────────────────────────────────────────────── */
const CameraSystem = (() => {
  let stream = null;
  let captureReady = false;
  let bothHandsPinching = false;

  async function init() {
    const video = document.getElementById("capture-video");

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      video.srcObject = stream;
      await video.play();
      captureReady = true;
      _listenForCapture();
    } catch (e) {
      // Use a placeholder gradient image as fallback
      captureReady = false;
      _usePlaceholder();
    }
  }

  function _listenForCapture() {
    // Listen for pinch gesture on capture frame
    HandTracking.on("onPinch", (x, y) => {
      if (!captureReady) return;
      const viewport = document.getElementById("capture-viewport");
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      // Pinch anywhere on screen triggers capture for simplicity
      _doCapture();
    });
  }

  function _doCapture() {
    if (!captureReady) { _usePlaceholder(); return; }
    const video   = document.getElementById("capture-video");
    const canvas  = document.getElementById("capture-canvas");
    canvas.width  = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -320, 0, 320, 240);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    captureReady = false;
    if (stream) { stream.getTracks().forEach(t => t.stop()); }

    AudioSystem.play("capture");
    PuzzleGame.start(dataUrl);
  }

  function _usePlaceholder() {
    // Create a colourful canvas placeholder
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 320, 240);
    grad.addColorStop(0,   "#ff6ec7");
    grad.addColorStop(0.5, "#a855f7");
    grad.addColorStop(1,   "#22d3ee");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*320, Math.random()*240, Math.random()*20+2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px Orbitron, monospace";
    ctx.textAlign = "center";
    ctx.fillText("HBD MEYSAA 🎂", 160, 120);
    PuzzleGame.start(canvas.toDataURL());
  }

  return { init };
})();


/* ──────────────────────────────────────────────
   §6  PUZZLE GAME
   ────────────────────────────────────────────── */
const PuzzleGame = (() => {
  const COLS = 4, ROWS = 3;
  const TOTAL = COLS * ROWS;
  let tiles = [];       // { el, correctIdx, currentIdx }
  let grabbedTile = null;
  let timerInterval = null;
  let timeLeft = 60;
  let solved = false;

  function start(imageDataUrl) {
    // Switch UI
    document.getElementById("puzzle-intro").style.display = "none";
    document.getElementById("puzzle-game").style.display  = "block";

    const board = document.getElementById("puzzle-board");
    board.style.gridTemplateColumns = `repeat(${COLS}, 80px)`;
    board.style.gridTemplateRows    = `repeat(${ROWS}, 80px)`;
    board.innerHTML = "";

    // Build shuffled tile order
    const order = _shuffle([...Array(TOTAL).keys()]);
    tiles = [];

    order.forEach((correctIdx, currentIdx) => {
      const tile = document.createElement("div");
      tile.className = "puzzle-tile";

      // Slice background position
      const col = correctIdx % COLS;
      const row = Math.floor(correctIdx / COLS);
      tile.style.backgroundImage = `url(${imageDataUrl})`;
      tile.style.backgroundSize  = `${COLS * 80}px ${ROWS * 80}px`;
      tile.style.backgroundPosition = `-${col * 80}px -${row * 80}px`;

      const tileObj = { el: tile, correctIdx, currentIdx };
      tiles.push(tileObj);
      board.appendChild(tile);

      tile.addEventListener("click", () => _handleTileClick(tileObj));
    });

    _startTimer();
    _listenGesturePuzzle();
    _checkSolved(); // In case already solved (rare)
  }

  function _handleTileClick(tileObj) {
    if (solved) return;

    if (!grabbedTile) {
      // Pick up
      grabbedTile = tileObj;
      tileObj.el.classList.add("grabbed");
      AudioSystem.play("hover");
    } else {
      // Swap with grabbed
      if (grabbedTile === tileObj) {
        grabbedTile.el.classList.remove("grabbed");
        grabbedTile = null;
        return;
      }
      _swapTiles(grabbedTile, tileObj);
      grabbedTile.el.classList.remove("grabbed");
      grabbedTile = null;
      AudioSystem.play("click");
      _checkSolved();
    }
  }

  function _listenGesturePuzzle() {
    HandTracking.on("onPinch", (x, y) => {
      if (solved) return;
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      const tileObj = tiles.find(t => t.el === el);
      if (tileObj) _handleTileClick(tileObj);
    });
  }

  function _swapTiles(a, b) {
    const board = document.getElementById("puzzle-board");
    const children = [...board.children];
    const idxA = children.indexOf(a.el);
    const idxB = children.indexOf(b.el);

    // DOM swap
    if (idxA < idxB) {
      board.insertBefore(a.el, b.el.nextSibling);
      board.insertBefore(b.el, children[idxA]);
    } else {
      board.insertBefore(b.el, a.el.nextSibling);
      board.insertBefore(a.el, children[idxB]);
    }

    // Update currentIdx
    const tmp = a.currentIdx;
    a.currentIdx = b.currentIdx;
    b.currentIdx = tmp;
  }

  function _checkSolved() {
    const board = document.getElementById("puzzle-board");
    const children = [...board.children];
    const isSolved = tiles.every(t => {
      const pos = children.indexOf(t.el);
      return pos === t.correctIdx;
    });

    if (isSolved) {
      solved = true;
      clearInterval(timerInterval);

      // Highlight all tiles
      tiles.forEach(t => {
        t.el.classList.add("correct");
      });

      AudioSystem.play("victory");
      setTimeout(() => SceneManager.showVictory(), 1200);
    }
  }

  function _startTimer() {
    timeLeft = 60;
    solved = false;
    const display = document.getElementById("timer-val");
    display.textContent = timeLeft;

    timerInterval = setInterval(() => {
      timeLeft--;
      display.textContent = timeLeft;
      if (timeLeft <= 10) display.style.color = "#ff6ec7";
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (!solved) _timeUp();
      }
    }, 1000);
  }

  function _timeUp() {
    // Shuffle tiles as penalty, reset timer
    const board = document.getElementById("puzzle-board");
    const children = [...board.children];
    const shuffledOrder = _shuffle([...Array(TOTAL).keys()]);
    shuffledOrder.forEach(i => board.appendChild(children[i]));
    tiles.forEach((t, i) => { t.currentIdx = shuffledOrder.indexOf(i); });

    timeLeft = 60;
    document.getElementById("timer-val").style.color = "";
    _startTimer();
    AudioSystem.play("click");
  }

  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  return { start };
})();


/* ──────────────────────────────────────────────
   §7  SCENE MANAGER
   ────────────────────────────────────────────── */
const SceneManager = (() => {
  let currentScene = "scene-opening";

  function showScene(id) {
    const prev = document.getElementById(currentScene);
    const next = document.getElementById(id);

    if (prev) { prev.classList.remove("active"); prev.style.pointerEvents = "none"; }
    if (next) { next.classList.add("active"); next.style.pointerEvents = "all"; }
    currentScene = id;
  }

  function warpTransition(callback) {
    const overlay = document.getElementById("warp-overlay");
    ParticleSystem.triggerWarp();
    overlay.classList.add("warp-in");
    setTimeout(() => {
      if (callback) callback();
      overlay.classList.remove("warp-in");
      overlay.classList.add("warp-out");
      setTimeout(() => overlay.classList.remove("warp-out"), 600);
    }, 500);
  }

  function showVictory() {
    warpTransition(() => {
      showScene("scene-victory");
      _spawnConfetti();
      AudioSystem.play("victory");
    });
  }

  function _spawnConfetti() {
    const container = document.getElementById("confetti-container");
    const colors = ["#ff6ec7", "#a855f7", "#22d3ee", "#fbbf24", "#fff"];
    for (let i = 0; i < 80; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = (Math.random() * 2 + 2) + "s";
      piece.style.animationDelay    = (Math.random() * 2) + "s";
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      container.appendChild(piece);
    }
  }

  return { showScene, warpTransition, showVictory };
})();


/* ──────────────────────────────────────────────
   §8  AUDIO SYSTEM
   ────────────────────────────────────────────── */
const AudioSystem = (() => {
  let ctx = null;
  let ambientStarted = false;

  function _ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  }

  function play(type) {
    try {
      _ensureCtx();
      switch (type) {
        case "hover":   _tone(660, 0.04, "sine",    0.03); break;
        case "click":   _tone(880, 0.08, "sine",    0.08); break;
        case "select":  _chord([523, 659, 784],     0.12); break;
        case "capture": _tone(1047, 0.15, "sine",   0.2);  break;
        case "victory": _victory();                         break;
      }
    } catch (_) {}
  }

  function _tone(freq, gain, type, dur) {
    const osc = ctx.createOscillator();
    const gn  = ctx.createGain();
    osc.connect(gn); gn.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gn.gain.setValueAtTime(gain, ctx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }

  function _chord(freqs, gain) {
    freqs.forEach((f, i) => {
      setTimeout(() => _tone(f, gain, "sine", 0.3), i * 60);
    });
  }

  function _victory() {
    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) => {
      setTimeout(() => _tone(f, 0.15, "sine", 0.4), i * 150);
    });
  }

  function startAmbient() {
    if (ambientStarted) return;
    ambientStarted = true;
    try {
      _ensureCtx();
      // Low drone
      const osc = ctx.createOscillator();
      const gn  = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 200;
      osc.connect(filter); filter.connect(gn); gn.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.value = 55;
      gn.gain.value = 0.03;
      osc.start();
    } catch (_) {}
  }

  return { play, startAmbient };
})();


/* ──────────────────────────────────────────────
   §9  APP INIT
   ────────────────────────────────────────────── */
(async () => {
  // 1. Start Three.js background
  ParticleSystem.init();

  // 2. Init UI system (sets up cursor tracking)
  UISystem.init();

  // 3. Start hand tracking with webcam
  const videoEl = document.getElementById("webcam-video");
  await HandTracking.init(videoEl);

  // 4. Wire start button
  window.startJourney = () => {
    AudioSystem.startAmbient();
    SceneManager.warpTransition(() => {
      SceneManager.showScene("scene-questions");
      QuestionFlow.start();
    });
  };

  // 5. Auto-start for keyboard shortcut (dev shortcut)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      window.startJourney && window.startJourney();
    }
    if (e.key === "p") {
      SceneManager.warpTransition(() => {
        SceneManager.showScene("scene-puzzle");
        CameraSystem.init();
      });
    }
    if (e.key === "v") {
      SceneManager.showVictory();
    }
  });

  console.log(
    "%c🌌 HBD MEYSAA — Space Nebula Experience",
    "color: #ff6ec7; font-size: 18px; font-weight: bold;"
  );
  console.log("%cKeys: Enter=Start | P=Puzzle | V=Victory", "color: #a855f7");
})();