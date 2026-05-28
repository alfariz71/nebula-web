/* =============================================
   SPACE NEBULA BIRTHDAY — script.js (final rev)
   §1  PARTICLE SYSTEM
   §2  HAND TRACKING
   §3  UI SYSTEM
   §4  QUESTION FLOW + FEEDBACK COMBO
   §5  CAMERA SYSTEM
   §6  PUZZLE GAME (6 tiles, seamless, drag)
   §7  FINAL STORY (cinematic credits roll)
   §8  SCENE MANAGER
   §9  AUDIO SYSTEM
   §10 APP INIT
   ============================================= */
"use strict";

/* ──────────────────────────────────────────────
   §1  PARTICLE SYSTEM — Three.js nebula
   ────────────────────────────────────────────── */
const ParticleSystem = (() => {
  let renderer, scene, camera;
  let starField, nebula1, nebula2;
  let clock = 0, warpActive = false, warpSpeed = 0;

  function init() {
    const canvas = document.getElementById("bg-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x03010a, 1);
    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 600;
    _buildStars(); _buildNebula(); _listen(); _loop();
  }

  function _buildStars() {
    const N = 2200;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random()-.5)*2000;
      pos[i*3+1] = (Math.random()-.5)*2000;
      pos[i*3+2] = (Math.random()-.5)*2000;
      const t = Math.random();
      col[i*3]   = t<.85?1:(t<.93?1:.5);
      col[i*3+1] = t<.85?1:(t<.93?.6:.5);
      col[i*3+2] = 1;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    geo.setAttribute("color",    new THREE.BufferAttribute(col,3));
    starField = new THREE.Points(geo, new THREE.PointsMaterial({
      size:1.7, vertexColors:true, transparent:true, opacity:.8, sizeAttenuation:false
    }));
    scene.add(starField);
  }

  function _buildNebula() {
    const mk = (N,ca,cb,sp) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N*3), col = new Float32Array(N*3);
      const A = new THREE.Color(ca), B = new THREE.Color(cb);
      for (let i=0; i<N; i++) {
        const r=Math.random()*sp, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
        pos[i*3]=r*Math.sin(ph)*Math.cos(th); pos[i*3+1]=r*Math.sin(ph)*Math.sin(th)*.5; pos[i*3+2]=r*Math.cos(ph)-200;
        const m=Math.random();
        col[i*3]=A.r+(B.r-A.r)*m; col[i*3+1]=A.g+(B.g-A.g)*m; col[i*3+2]=A.b+(B.b-A.b)*m;
      }
      geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
      geo.setAttribute("color",   new THREE.BufferAttribute(col,3));
      return new THREE.Points(geo, new THREE.PointsMaterial({
        size:3.2, vertexColors:true, transparent:true, opacity:.32,
        sizeAttenuation:true, blending:THREE.AdditiveBlending, depthWrite:false
      }));
    };
    nebula1 = mk(600,"#ff6ec7","#a855f7",300);
    nebula2 = mk(450,"#a855f7","#22d3ee",260);
    nebula2.position.set(140,70,-50);
    scene.add(nebula1); scene.add(nebula2);
  }

  function triggerWarp() {
    warpActive = true; warpSpeed = 0;
    setTimeout(()=>{ warpActive=false; warpSpeed=0; }, 1200);
  }

  function _loop() {
    requestAnimationFrame(_loop); clock += .004;
    if (starField) starField.rotation.y = clock*.04;
    if (nebula1) { nebula1.rotation.y=clock*.06; nebula1.rotation.x=Math.sin(clock*.3)*.05; }
    if (nebula2) { nebula2.rotation.y=-clock*.05; nebula2.rotation.z=clock*.02; }
    if (warpActive) {
      warpSpeed = Math.min(warpSpeed+.8, 24);
      camera.position.z -= warpSpeed;
      if (camera.position.z < 200) camera.position.z = 600;
    } else {
      camera.position.z += (600-camera.position.z)*.03;
    }
    renderer.render(scene, camera);
  }

  function _listen() {
    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth/window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  return { init, triggerWarp };
})();


/* ──────────────────────────────────────────────
   §2  HAND TRACKING — MediaPipe / mouse fallback
   ────────────────────────────────────────────── */
const HandTracking = (() => {
  let hands, lastPinch=false, pinchCD=false;
  const cbs = { onMove:null, onPinch:null, onRelease:null };
  const IT=8, TT=4, MT=12, RT=16, PT=20;

  async function init(videoEl) {
    if (typeof Hands === "undefined") { _mouse(); return; }
    hands = new Hands({ locateFile: f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    hands.setOptions({ maxNumHands:2, modelComplexity:0, minDetectionConfidence:.65, minTrackingConfidence:.55 });
    hands.onResults(_res);
    const cam = new Camera(videoEl, {
      onFrame: async () => { await hands.send({ image: videoEl }); },
      width:320, height:240,
    });
    try {
      await cam.start();
      document.getElementById("cam-status").textContent = "✓ Camera aktif — angkat tangan!";
    } catch(e) {
      document.getElementById("cam-status").textContent = "⚠ Camera denied. Pakai mouse/touch.";
      _mouse();
    }
  }

  function _res(r) {
    if (!r.multiHandLandmarks || !r.multiHandLandmarks.length) return;
    const lm = r.multiHandLandmarks[0];
    const ix = (1-lm[IT].x)*window.innerWidth, iy = lm[IT].y*window.innerHeight;
    if (cbs.onMove) cbs.onMove(ix, iy);
    const dx=lm[IT].x-lm[TT].x, dy=lm[IT].y-lm[TT].y;
    const pin = Math.sqrt(dx*dx+dy*dy) < .07;
    if (pin && !lastPinch && !pinchCD) {
      lastPinch=true; pinchCD=true;
      if (cbs.onPinch) cbs.onPinch(ix, iy);
      setTimeout(()=>pinchCD=false, 650);
    } else if (!pin && lastPinch) {
      lastPinch=false; if (cbs.onRelease) cbs.onRelease(ix, iy);
    }
    const tips=[IT,MT,RT,PT]; let ext=0;
    for (let i=0;i<4;i++) if (lm[tips[i]].y<lm[tips[i]-2].y) ext++;
    document.getElementById("gesture-label").textContent =
      pin?"PINCH 👌":ext===4?"OPEN PALM ✋":ext===1?"POINTING ☝":ext===2?"PEACE ✌":"IDLE";
  }

  function _mouse() {
    document.addEventListener("mousemove", e=>{ if(cbs.onMove) cbs.onMove(e.clientX,e.clientY); });
    document.addEventListener("click",     e=>{ if(cbs.onPinch) cbs.onPinch(e.clientX,e.clientY); });
    document.addEventListener("touchmove", e=>{ const t=e.touches[0]; if(cbs.onMove) cbs.onMove(t.clientX,t.clientY); },{passive:true});
    document.addEventListener("touchend",  e=>{ const t=e.changedTouches[0]; if(cbs.onPinch) cbs.onPinch(t.clientX,t.clientY); });
    document.getElementById("cam-status").textContent = "Mouse / touch mode";
    document.getElementById("gesture-label").textContent = "MOUSE MODE";
  }

  function on(ev, fn) { cbs[ev]=fn; }
  return { init, on };
})();


/* ──────────────────────────────────────────────
   §3  UI SYSTEM — cursor, hover, pinch-click
   ────────────────────────────────────────────── */
const UISystem = (() => {
  const cursor = document.getElementById("hand-cursor");
  const ripple = document.getElementById("pinch-ripple");
  const SEL = ".holo-btn,.answer-btn,.puzzle-tile,.story-next-btn";
  let hov = null;

  function init() {
    HandTracking.on("onMove",    _mv);
    HandTracking.on("onPinch",   _pn);
    HandTracking.on("onRelease", ()=>cursor.classList.remove("pinching"));
  }

  function _mv(x,y) {
    cursor.style.left = x+"px"; cursor.style.top = y+"px";
    const el = document.elementFromPoint(x,y);
    const t  = el ? el.closest(SEL) : null;
    if (t !== hov) {
      if (hov) hov.classList.remove("hovered");
      hov = t;
      if (hov) { hov.classList.add("hovered"); AudioSystem.play("hover"); }
    }
  }

  function _pn(x,y) {
    cursor.classList.add("pinching");
    ripple.style.left=x+"px"; ripple.style.top=y+"px";
    ripple.classList.remove("ripple-active"); void ripple.offsetWidth;
    ripple.classList.add("ripple-active");
    AudioSystem.play("click");
    if (hov) {
      hov.classList.add("pinched"); hov.click();
      setTimeout(()=>hov&&hov.classList.remove("pinched"), 260);
    }
  }

  return { init };
})();


/* ──────────────────────────────────────────────
   §4  QUESTION FLOW + FEEDBACK COMBO
   Stores ALL 4 answers → builds ONE combo paragraph
   ────────────────────────────────────────────── */
const QuestionFlow = (() => {
  let qi = 0;
  const mem = {};   // { key: chosenOptionText }

  /* ── 4 QUESTIONS — each answer has its own fb snippet ── */
  const QS = [
    {
      key: "ketenangan",
      q: "🌟 Di mana kamu biasanya menemukan ketenangan terbesar?",
      opts: [
        "Di bawah langit malam yang sunyi",
        "Di tengah keramaian kota",
        "Di alam bebas — hutan, gunung, laut",
        "Di rumah bersama orang tersayang",
      ],
      fb: [
        "kamu tipe yang nemu tenangnya di bawah langit malam... yang pasti aesthetic banget sih 🌙✨",
        "ternyata keramaian itu justru tempat kamu nemu diri sendiri — unik, tapi makes sense 🌆",
        "alam bebas — jiwa bebas emang susah dijinakkin, dan itu hal yang bagus 🌿",
        "rumah dan orang-orang tersayang, yang paling penting emang itu 🏡",
      ],
    },
    {
      key: "harapan",
      q: "🎂 Apa harapan terbesarmu di ulang tahun ini?",
      opts: [
        "Kesehatan & kebahagiaan selalu",
        "Petualangan baru yang belum pernah ada",
        "Mimpi-mimpi yang akhirnya terwujud",
        "Ketenangan & hidup yang lebih damai",
      ],
      fb: [
        "semoga kesehatan & kebahagiaan beneran selalu nemenin kamu ya, bukan cuma di hari ini 🌻",
        "petualangan baru — semoga yang kamu bayangkan beneran kejadian dalam waktu deket ✈️",
        "mimpi yang terwujud adalah hal yang paling worth it diperjuangin, semoga beneran kejadian 💫",
        "ketenangan & hidup damai... itu doa yang dalam banget, semoga dikabulin 🌊",
      ],
    },
    {
      key: "tempat",
      q: "✈️ Kalau bisa pergi ke mana saja, kamu paling ingin ke mana?",
      opts: [
        "Kota-kota tua Eropa yang tenang",
        "Jepang — musim semi atau musim dingin",
        "Alam bebas — gunung, pantai, hutan",
        "Tetap di sini, tapi versi yang lebih damai",
      ],
      fb: [
        "Eropa yang tenang, cobblestone dan kopi pagi — semoga beneran kesana suatu hari 🏛️",
        "Jepang!! semoga musim semi atau musim dinginnya beneran kamu rasain langsung ya 🌸",
        "kabur sebentar ke alam bebas, siapa yang ga mau coba — semoga bisa 🏔️",
        "versi yang lebih damai dari tempat yang sama... itu doa yang bagus banget 💙",
      ],
    },
    {
      key: "galaksi",
      q: "🚀 Kalau bisa hidup di mana saja di galaksi ini, kamu pilih...",
      opts: [
        "Planet baru yang sunyi & damai",
        "Surfing nebula tanpa tujuan",
        "Bikin rumah kecil di bulan",
        "Kembali ke bumi — lebih dari cukup",
      ],
      fb: [
        "planet sunyi & damai — kamu emang butuh ruang sendiri kadang-kadang, dan itu valid 🌑",
        "surfing nebula tanpa tujuan... free spirit mode ON, vibes banget 😌✨",
        "rumah di bulan! oke nanti kabarin ya, siapa tau aku jadi tetangga sebelah 🚀😂",
        "kembali ke bumi — setuju sih, bumi aja udah cukup ajaib kok 🌍",
      ],
    },
  ];

  /* ── FEEDBACK COMBO BUILDER ──
     Collects one fb snippet per question → weaves into
     one flowing personal paragraph ── */
  function _buildCombo() {
    const snippets = QS.map(q => {
      const idx = q.opts.findIndex(o => o === mem[q.key]);
      return idx >= 0 ? q.fb[idx] : null;
    }).filter(Boolean);

    // Opening line
    const openers = [
      "oke jadi dari jawaban kamu tadi...",
      "hmm, jadi kesimpulan sementaranya adalah...",
      "berdasarkan jawaban kamu barusan —",
    ];
    const opener = openers[Math.floor(Math.random() * openers.length)];

    // Weave snippets into one paragraph with connectors
    const connectors = ["\n\nterus,\n", "\n\ndan ", "\n\nohh iya, ", "\n\n"];
    let body = "";
    snippets.forEach((s, i) => {
      if (i === 0) body += s;
      else body += connectors[Math.min(i-1, connectors.length-1)] + s;
    });

    // Closing
    const closings = [
      "\n\nsemoga hari ini jadi awal dari hal-hal baik yang kamu harapan itu tadi ✨",
      "\n\npokoknya, semoga semua yang kamu minta dikabulin ya — amin 🌌",
      "\n\nyah, begitulah kamu — dan itu cukup spesial 😄✨",
    ];
    const closing = closings[Math.floor(Math.random() * closings.length)];

    return opener + "\n\n" + body + closing;
  }

  function start() {
    qi = 0;
    Object.keys(mem).forEach(k => delete mem[k]);
    _show(0);
  }

  function _show(idx) {
    if (idx >= QS.length) { _finish(); return; }
    const q = QS[idx];
    document.getElementById("q-number").textContent =
      String(idx+1).padStart(2,"0") + " / " + String(QS.length).padStart(2,"0");

    const box = document.getElementById("question-box");
    box.style.animation = "none"; void box.offsetWidth;
    box.style.animation = "fade-up .6s ease forwards";
    document.getElementById("question-text").textContent = q.q;

    const con = document.getElementById("answers-container");
    con.innerHTML = "";
    const L = ["A","B","C","D"];
    q.opts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "answer-btn"; btn.dataset.letter = L[i];
      btn.innerHTML = `<span class="answer-text">${opt}</span>`;
      btn.style.opacity = "0";
      btn.style.animation = `fade-up .5s ease ${.1*i+.3}s both`;
      btn.onclick = () => _sel(q.key, opt, i);
      con.appendChild(btn);
    });
  }

  function _sel(key, text, idx) {
    mem[key] = text;
    document.querySelectorAll(".answer-btn").forEach(b => b.style.pointerEvents="none");
    document.querySelectorAll(".answer-btn")[idx].classList.add("selected");
    AudioSystem.play("select");
    setTimeout(() => { qi++; SceneManager.warpTransition(() => _show(qi)); }, 750);
  }

  function _finish() {
    // Build combo and show feedback scene
    SceneManager.warpTransition(() => {
      SceneManager.showScene("scene-feedback");
      const combo = _buildCombo();
      const el = document.getElementById("feedback-text");
      el.style.opacity = "0"; el.textContent = combo;
      void el.offsetWidth;
      el.style.transition = "opacity .9s ease";
      setTimeout(() => el.style.opacity = "1", 350);

      const btn = document.getElementById("btn-feedback-continue");
      btn.onclick = () => {
        SceneManager.warpTransition(() => {
          SceneManager.showScene("scene-puzzle");
          CameraSystem.init();
        });
      };
    });
  }

  return { start };
})();


/* ──────────────────────────────────────────────
   §5  CAMERA SYSTEM
   ────────────────────────────────────────────── */
const CameraSystem = (() => {
  let stream=null, ready=false, used=false;

  async function init() {
    const vid = document.getElementById("capture-video");
    const btn = document.getElementById("btn-capture");
    if (btn) btn.onclick = () => _capture();

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video:{width:330,height:220}, audio:false });
      vid.srcObject = stream; await vid.play(); ready = true;
      HandTracking.on("onPinch", () => {
        if (!used && ready && document.getElementById("puzzle-intro").style.display !== "none")
          _capture();
      });
    } catch(e) { ready=false; _placeholder(); }
  }

  function _capture() {
    if (used) return; used = true;
    if (!ready) { _placeholder(); return; }
    const vid = document.getElementById("capture-video");
    const cvs = document.getElementById("capture-canvas");
    cvs.width=330; cvs.height=220;
    const ctx = cvs.getContext("2d");
    ctx.save(); ctx.scale(-1,1); ctx.drawImage(vid,-330,0,330,220); ctx.restore();
    if (stream) stream.getTracks().forEach(t=>t.stop());
    AudioSystem.play("capture");
    PuzzleGame.start(cvs.toDataURL("image/jpeg",.88));
  }

  function _placeholder() {
    used = true;
    const cvs = document.createElement("canvas"); cvs.width=330; cvs.height=220;
    const ctx = cvs.getContext("2d");
    const g = ctx.createLinearGradient(0,0,330,220);
    g.addColorStop(0,"#ff6ec7"); g.addColorStop(.5,"#a855f7"); g.addColorStop(1,"#22d3ee");
    ctx.fillStyle=g; ctx.fillRect(0,0,330,220);
    ctx.fillStyle="rgba(255,255,255,.12)";
    for (let i=0;i<30;i++) {
      ctx.beginPath(); ctx.arc(Math.random()*330,Math.random()*220,Math.random()*16+2,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle="#fff"; ctx.font="bold 19px Orbitron,monospace"; ctx.textAlign="center";
    ctx.fillText("HBD MEYSAA 🎂",165,110);
    PuzzleGame.start(cvs.toDataURL());
  }

  return { init };
})();


/* ──────────────────────────────────────────────
   §6  PUZZLE GAME
   - 6 tiles (3 cols × 2 rows)
   - gap: 0  → seamless photo
   - tile borders: thin rgba outline only
   - click/pinch to grab → click/pinch target to swap
   ────────────────────────────────────────────── */
const PuzzleGame = (() => {
  const COLS=3, ROWS=2, TOTAL=6;
  const TW=110, TH=82;   // tile pixel size
  let tiles=[], grabbed=null, solved=false, t0=0;

  function start(img) {
    document.getElementById("puzzle-intro").style.display = "none";
    document.getElementById("puzzle-game").style.display  = "block";

    const board = document.getElementById("puzzle-board");
    // No gap — seamless image
    board.style.gridTemplateColumns = `repeat(${COLS},${TW}px)`;
    board.style.gridTemplateRows    = `repeat(${ROWS},${TH}px)`;
    board.style.gap = "0";
    board.innerHTML = ""; tiles = [];

    const order = _shuffle([...Array(TOTAL).keys()]);
    order.forEach((ci, si) => {
      const div = document.createElement("div");
      div.className = "puzzle-tile";
      const c=ci%COLS, r=Math.floor(ci/COLS);
      div.style.width  = TW+"px";
      div.style.height = TH+"px";
      div.style.backgroundImage    = `url(${img})`;
      div.style.backgroundSize     = `${COLS*TW}px ${ROWS*TH}px`;
      div.style.backgroundPosition = `-${c*TW}px -${r*TH}px`;
      const t = { el:div, ci, si }; tiles.push(t); board.appendChild(div);
      div.addEventListener("click", () => _click(t));
    });

    solved=false; t0=Date.now();
    _listenGesture();
  }

  function _click(t) {
    if (solved) return;
    if (!grabbed) {
      grabbed=t; t.el.classList.add("grabbed"); AudioSystem.play("hover");
    } else {
      if (grabbed===t) { t.el.classList.remove("grabbed"); grabbed=null; return; }
      _swap(grabbed,t); grabbed.el.classList.remove("grabbed"); grabbed=null;
      AudioSystem.play("click"); _check();
    }
  }

  function _listenGesture() {
    HandTracking.on("onPinch", (x,y) => {
      if (solved) return;
      if (document.getElementById("puzzle-game").style.display === "none") return;
      const el = document.elementFromPoint(x,y); if (!el) return;
      const t = tiles.find(t => t.el===el || t.el.contains(el));
      if (t) _click(t);
    });
  }

  function _swap(a,b) {
    const board = document.getElementById("puzzle-board");
    const ch = [...board.children];
    const ia=ch.indexOf(a.el), ib=ch.indexOf(b.el);
    if (ia<ib) { board.insertBefore(a.el,b.el.nextSibling); board.insertBefore(b.el,ch[ia]); }
    else       { board.insertBefore(b.el,a.el.nextSibling); board.insertBefore(a.el,ch[ib]); }
    const tmp=a.si; a.si=b.si; b.si=tmp;
  }

  function _check() {
    const board = document.getElementById("puzzle-board");
    const ch = [...board.children];
    // Solved when every tile is in its correct position (correctIdx === slot position)
    if (!tiles.every(t => ch.indexOf(t.el) === t.ci)) return;
    solved = true;
    tiles.forEach(t => t.el.classList.add("correct"));
    AudioSystem.play("victory");
    const elapsed = (Date.now()-t0)/1000;
    const msg = elapsed < 60 ? "wahh cepet juga kamu 😭✨" : "wkwk lama juga ya 😭";
    setTimeout(() => FinalStory.start(msg), 1100);
  }

  function _shuffle(arr) {
    // Fisher-Yates, guarantee not already solved
    do {
      for (let i=arr.length-1; i>0; i--) {
        const j=~~(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];
      }
    } while (arr.every((v,i)=>v===i));
    return arr;
  }

  return { start };
})();


/* ──────────────────────────────────────────────
   §7  FINAL STORY — cinematic credits roll

   DESIGN:
   - Text is NEVER removed; each beat APPENDS a new line
   - #credits-track slides upward so the newest line
     settles near the lower-third of the viewport
   - Sentences ending "..." → auto-advance (no button)
     with dynamic delay based on text length
   - Other sentences → show ↓ NEXT button
   ────────────────────────────────────────────── */
const FinalStory = (() => {

  /*
    type:
      "auto"    → auto-advance after dynamic delay (no button needed)
      "btn"     → show ↓ NEXT button; user must tap
      "victory" → show ↓ NEXT; tapping goes to victory scene
  */
  const BEATS = [
    { text:"Hay meysaa...",                                                                                       type:"auto"    },
    { text:"HBD YA.. semoga hal-hal baik selalu datang ke kamu, dan",                                            type:"btn"     },
    { text:"apa yang kamu usahakan bisa tercapai ...",                                                           type:"auto"    },
    { text:"aminn",                                                                                               type:"btn"     },
    { text:"Ohh iyaa mey...",                                                                                     type:"auto"    },
    { text:"Aku juga minta maaf kalau selama ini pernah ada sikap atau...",                                      type:"auto"    },
    { text:"kata2ku yang bikin kamu ga nyaman, sengaja maupun ga sengaja..",                                     type:"auto"    },
    { text:"kado itu bukan punya maksud apapun kok, cuma bentuk ucapan aja..",                                   type:"auto"    },
    { text:"dan",                                                                                                 type:"btn"     },
    { text:"tenang aja, aku udah ngga ngejer kamu lagi, tapii..",                                                type:"auto"    },
    { text:"insyaallah :v",                                                                                       type:"btn"     },
    { text:"Aku cuma pengen semuanya tetep baik tanpa ada rasa gaenak satu sama lain...\nOnce again, HBD YAA!!,, jaga diri baek-baek ✨", type:"victory" },
  ];

  let beatIdx = 0;
  let trackY  = 0;   // cumulative upward translation of #credits-track (px)
  let speedMsg = "";

  /* ── Dynamic delay for auto-advance:
       ~400ms per word + 1500ms bonus for trailing dots
       clamped 3s–7s ── */
  function _delay(text) {
    const words = text.trim().split(/\s+/).length;
    const base  = Math.max(3000, words * 420);
    const bonus = (text.endsWith("...")||text.endsWith("..")) ? 1500 : 0;
    return Math.min(base + bonus, 7000);
  }

  /* ── Line CSS class helper ── */
  function _cls(text) {
    if (text === "aminn")                             return "credit-line accent";
    if (text === "dan")                               return "credit-line muted";
    if (text.includes(":v"))                          return "credit-line accent";
    if (text.includes("Once again")||text.includes("HBD YAA"))
                                                      return "credit-line emphasis";
    return "credit-line";
  }

  /* ── Entry point ── */
  function start(msg) {
    speedMsg=msg; beatIdx=0; trackY=0;
    SceneManager.warpTransition(() => {
      SceneManager.showScene("scene-story");
      _showResultMsg();
    });
  }

  /* ── Step 1: show puzzle speed result message ── */
  function _showResultMsg() {
    const el = document.getElementById("puzzle-result-msg");
    el.textContent = speedMsg;
    setTimeout(()=>el.classList.add("visible"), 300);
    setTimeout(()=>{
      el.classList.remove("visible");
      setTimeout(_showPopup, 600);
    }, 2600);
  }

  /* ── Step 2: "Bentar sekali lagi..." popup ── */
  function _showPopup() {
    const pop = document.getElementById("story-popup");
    pop.style.display="block"; pop.style.opacity="0";
    pop.style.transition="opacity .8s ease";
    void pop.offsetWidth; pop.style.opacity="1";
    setTimeout(()=>{
      pop.style.opacity="0";
      setTimeout(()=>{ pop.style.display="none"; _startCredits(); }, 800);
    }, 2300);
  }

  /* ── Step 3: begin credits roll ── */
  function _startCredits() {
    const credits = document.getElementById("story-credits");
    credits.style.display = "flex";
    // Clear any previous content
    document.getElementById("credits-track").innerHTML = "";
    trackY = 0;
    _renderBeat(0);
  }

  /* ── Render one beat (appends line, scrolls track up) ── */
  function _renderBeat(idx) {
    if (idx >= BEATS.length) { SceneManager.showVictory(); return; }
    const beat = BEATS[idx];
    const track = document.getElementById("credits-track");
    const btn   = document.getElementById("story-next-btn");
    btn.style.display = "none";

    /* -- Append new credit line -- */
    const line = document.createElement("p");
    line.className = _cls(beat.text);
    line.textContent = beat.text;
    line.style.whiteSpace = "pre-line";
    track.appendChild(line);

    /* -- Fade in after next paint -- */
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      line.classList.add("vis");
      AudioSystem.play("story_line");
    }));

    /* -- Scroll track upward --
       Each line is ~52px tall; multi-line beats get extra height.
       We translate the track so the newest line sits near the
       lower-third of #credits-viewport. */
    const lineH = beat.text.includes("\n") ? 110 : 56;
    trackY += lineH;
    // Small delay so the text fades in before scrolling
    setTimeout(() => {
      track.style.transform = `translateY(-${trackY}px)`;
    }, 300);

    /* -- After line settles, decide auto or manual -- */
    if (beat.type === "auto") {
      const delay = _delay(beat.text);
      setTimeout(() => { beatIdx=idx+1; _renderBeat(beatIdx); }, delay + 300);

    } else {
      // btn or victory — show NEXT after text is readable
      setTimeout(() => {
        btn.style.display = "flex";
        btn.onclick = () => {
          btn.style.display = "none";
          beatIdx = idx+1;
          if (beat.type === "victory") SceneManager.showVictory();
          else _renderBeat(beatIdx);
        };
      }, 900);
    }
  }

  return { start };
})();


/* ──────────────────────────────────────────────
   §8  SCENE MANAGER
   ────────────────────────────────────────────── */
const SceneManager = (() => {
  let cur = "scene-opening";

  function showScene(id) {
    const p = document.getElementById(cur);
    const n = document.getElementById(id);
    if (p) { p.classList.remove("active"); p.style.pointerEvents="none"; }
    if (n) { n.classList.add("active");    n.style.pointerEvents="all"; }
    cur = id;
  }

  function warpTransition(cb) {
    const ov = document.getElementById("warp-overlay");
    ParticleSystem.triggerWarp();
    ov.classList.add("warp-in");
    setTimeout(() => {
      if (cb) cb();
      ov.classList.remove("warp-in"); ov.classList.add("warp-out");
      setTimeout(()=>ov.classList.remove("warp-out"), 600);
    }, 480);
  }

  function showVictory() {
    warpTransition(() => {
      showScene("scene-victory");
      _confetti(); AudioSystem.play("victory");
    });
  }

  function _confetti() {
    const c = document.getElementById("confetti-container");
    const cols = ["#ff6ec7","#a855f7","#22d3ee","#fbbf24","#fff"];
    for (let i=0;i<70;i++) {
      const p = document.createElement("div"); p.className="confetti-piece";
      p.style.left=Math.random()*100+"%";
      p.style.background=cols[~~(Math.random()*cols.length)];
      p.style.animationDuration=(Math.random()*2+2)+"s";
      p.style.animationDelay=(Math.random()*2)+"s";
      p.style.transform=`rotate(${Math.random()*360}deg)`;
      c.appendChild(p);
    }
  }

  return { showScene, warpTransition, showVictory };
})();


/* ──────────────────────────────────────────────
   §9  AUDIO SYSTEM — Web Audio API tones
   ────────────────────────────────────────────── */
const AudioSystem = (() => {
  let C=null, amb=false;

  function _ctx() {
    if (!C) C = new (window.AudioContext||window.webkitAudioContext)();
    if (C.state==="suspended") C.resume();
    return C;
  }

  function play(type) {
    try {
      const c=_ctx();
      if (type==="hover")      _t(c,660,.03,"sine",.04);
      else if (type==="click") _t(c,880,.07,"sine",.08);
      else if (type==="select")     _ch(c,[523,659,784],.1);
      else if (type==="capture")    _t(c,1047,.14,"sine",.22);
      else if (type==="story_line") _t(c,528,.04,"sine",.18);
      else if (type==="victory")    _v(c);
    } catch(_){}
  }

  function _t(c,f,g,tp,d) {
    const o=c.createOscillator(), n=c.createGain();
    o.connect(n); n.connect(c.destination);
    o.type=tp; o.frequency.setValueAtTime(f,c.currentTime);
    n.gain.setValueAtTime(g,c.currentTime);
    n.gain.exponentialRampToValueAtTime(.001,c.currentTime+d);
    o.start(); o.stop(c.currentTime+d);
  }
  function _ch(c,fs,g) { fs.forEach((f,i)=>setTimeout(()=>_t(c,f,g,"sine",.3),i*65)); }
  function _v(c) { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>_t(c,f,.14,"sine",.4),i*140)); }

  function startAmbient() {
    if (amb) return; amb=true;
    try {
      const c=_ctx(), o=c.createOscillator(), n=c.createGain(), f=c.createBiquadFilter();
      f.type="lowpass"; f.frequency.value=180;
      o.connect(f); f.connect(n); n.connect(c.destination);
      o.type="sawtooth"; o.frequency.value=55; n.gain.value=.024; o.start();
    } catch(_){}
  }

  return { play, startAmbient };
})();


/* ──────────────────────────────────────────────
   §10  APP INIT
   ────────────────────────────────────────────── */
(async () => {
  ParticleSystem.init();
  UISystem.init();

  const vid = document.getElementById("webcam-video");
  await HandTracking.init(vid);

  window.startJourney = () => {
    AudioSystem.startAmbient();
    SceneManager.warpTransition(() => {
      SceneManager.showScene("scene-questions");
      QuestionFlow.start();
    });
  };

  /* Dev shortcuts */
  document.addEventListener("keydown", e => {
    if (e.key==="Enter") window.startJourney && window.startJourney();
    if (e.key==="q") {
      SceneManager.warpTransition(()=>{ SceneManager.showScene("scene-questions"); QuestionFlow.start(); });
    }
    if (e.key==="f") {
      SceneManager.warpTransition(()=>{
        SceneManager.showScene("scene-feedback");
        const el=document.getElementById("feedback-text");
        el.textContent="[test feedback]\n\nokay jadi dari jawaban kamu tadi...\n\nkamu tipe yang tenangnya di bawah langit malam... aesthetic banget sih 🌙✨\n\nsemoga Jepang beneran kejadian ya 🌸\n\ndan rumah di bulan? oke nanti kabarin, siapa tau aku jadi tetangga sebelah 🚀😂\n\nsemoga semuanya baik-baik aja buat kamu ✨";
        el.style.opacity="1";
        document.getElementById("btn-feedback-continue").onclick=()=>{
          SceneManager.warpTransition(()=>{ SceneManager.showScene("scene-puzzle"); CameraSystem.init(); });
        };
      });
    }
    if (e.key==="p") {
      SceneManager.warpTransition(()=>{ SceneManager.showScene("scene-puzzle"); CameraSystem.init(); });
    }
    if (e.key==="s") FinalStory.start("wahh cepet juga kamu 😭✨");
    if (e.key==="v") SceneManager.showVictory();
  });

  console.log("%c🌌 HBD MEYSAA — Space Nebula (final rev)", "color:#ff6ec7;font-size:16px;font-weight:bold;");
  console.log("%cKeys: Enter=Start · Q=Questions · F=Feedback · P=Puzzle · S=Story · V=Victory", "color:#a855f7");
})();