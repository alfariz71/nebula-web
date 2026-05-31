// ═══════════════════════════════════════════════════════
//  NEBULA BIRTHDAY — Enhanced PC Edition
//  Sound effects · Dual-cursor ring · Scene indicator
//  Progress bar · PC-optimised interactions
// ═══════════════════════════════════════════════════════

// ─── SOUND ENGINE ────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let musicMuted = false;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
}

function playTone(freq, type = 'sine', dur = 0.18, vol = 0.18, delay = 0) {
    try {
        const ac  = getAudioCtx();
        const osc = ac.createOscillator();
        const env = ac.createGain();
        osc.connect(env); env.connect(ac.destination);
        osc.type = type; osc.frequency.value = freq;
        const t = ac.currentTime + delay;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vol, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur + 0.01);
    } catch(e) {}
}

function playChime(baseFreq = 660) {
    [0, 0.09, 0.18].forEach((d, i) => {
        playTone(baseFreq * [1, 1.26, 1.5][i], 'triangle', 0.35, 0.14, d);
    });
}

function playClick() {
    playTone(880, 'sine', 0.08, 0.15);
    playTone(1200, 'triangle', 0.06, 0.08, 0.02);
}

function playSelect() {
    playTone(660, 'sine', 0.12, 0.14);
    playTone(880, 'sine', 0.10, 0.10, 0.06);
    playTone(1100, 'triangle', 0.08, 0.08, 0.12);
}

function playTransition() {
    [0, 0.05, 0.10, 0.15, 0.20].forEach((d, i) => {
        const freqs = [440, 554, 660, 784, 880];
        playTone(freqs[i], 'sine', 0.28, 0.10, d);
    });
}

function playPuzzleSnap() {
    playTone(1046, 'triangle', 0.15, 0.2);
    playTone(1318, 'sine', 0.12, 0.15, 0.06);
}

function playPuzzleComplete() {
    const freqs = [523, 659, 784, 1047, 1319];
    freqs.forEach((f, i) => playTone(f, 'triangle', 0.4, 0.16, i * 0.1));
}

function playStoryAdvance() {
    playTone(528, 'sine', 0.12, 0.09);
}

function playHover() {
    playTone(740, 'sine', 0.05, 0.06);
}

function playCelebration() {
    for (let i = 0; i < 8; i++) {
        const f = 440 * Math.pow(2, Math.random() * 1.5);
        playTone(f, 'triangle', 0.3, 0.12, i * 0.08);
    }
}

// ─── CURSOR RIPPLE ───────────────────────────────────
function spawnRipple(x, y) {
    const r = document.createElement('div');
    r.className = 'sound-ripple';
    r.style.cssText = `left:${x}px;top:${y}px;width:30px;height:30px;`;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
}

// ─── NEBULA CANVAS ───────────────────────────────────
let isFreePlay = false;
const canvas = document.getElementById('nebulaCanvas');
const ctx    = canvas.getContext('2d');
let width, height;
let particles = [];
let extraParticles = [];

// ─── STATE VARS ───────────────────────────────────────
let currentEffect = 'none';
let isPinching    = false;
let lastGesture   = null;
let gestureDebounceTimer = null;
let cursorX = window.innerWidth  / 2;
let cursorY = window.innerHeight / 2;
let targetX = window.innerWidth  / 2;
let targetY = window.innerHeight / 2;
let draggedPiece  = null;
let isGameActive  = false;
let startTime;
let lastHoveredEl = null;

// ─── TRAIL LAYER ─────────────────────────────────────
const trailCanvas = document.createElement('canvas');
trailCanvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;';
document.body.appendChild(trailCanvas);
const tctx = trailCanvas.getContext('2d');

function resize() {
    width  = canvas.width  = trailCanvas.width  = window.innerWidth;
    height = canvas.height = trailCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ─── SHAKA IMAGE ─────────────────────────────────────
let shakaReady = false, shakaImg = null;

// ═══════════════════════════════════════════════════
//  PARTICLE CLASS
// ═══════════════════════════════════════════════════
class Particle {
    constructor(index) {
        const phi = (1 + Math.sqrt(5)) / 2;
        this.x  = ((index * phi * width)  % width  + width)  % width;
        this.y  = ((index * phi * height) % height + height) % height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.hue        = 290 + Math.random() * 70;
        this.size       = Math.random() * 1.6 + 0.5;
        this.alpha      = Math.random() * 0.35 + 0.12;
        this.twinkle    = Math.random() * Math.PI * 2;
        this.tx = this.x; this.ty = this.y;
        this.targetSize  = this.size;
        this.targetAlpha = this.alpha;
        this.targetHue   = this.hue;
        this.index = index;
        this.angle = Math.random() * Math.PI * 2;
        this.orbitR = 50 + Math.pow(Math.random(), 0.55) * Math.min(width, height) * 0.44;
        this.armId  = index % 3;
        this.photoR = 255; this.photoG = 130; this.photoB = 200;
        this.hasPhotoColor = false;
        this.homeX = this.x; this.homeY = this.y;
    }

    update(now) {
        const ef = isFreePlay ? currentEffect : 'none';

        if (ef === 'name' || ef === 'shaka') {
            const fx = (this.tx - this.x) * 0.018;
            const fy = (this.ty - this.y) * 0.018;
            this.vx = (this.vx + fx) * 0.78;
            this.vy = (this.vy + fy) * 0.78;
        } else if (ef === 'blackhole') {
            const dx = cursorX - this.x, dy = cursorY - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy) + 1;
            const pull = Math.min(5.5, 1100 / (dist * dist));
            const swirl = 1.4 / Math.sqrt(dist);
            this.vx += (dx/dist)*pull  + (-dy/dist)*swirl;
            this.vy += (dy/dist)*pull  + ( dx/dist)*swirl;
            this.vx *= 0.86; this.vy *= 0.86;
            if (dist < 7) {
                const ang = Math.random() * Math.PI * 2;
                const r   = 180 + Math.random() * Math.min(width, height) * 0.38;
                this.x = cursorX + Math.cos(ang)*r;
                this.y = cursorY + Math.sin(ang)*r;
                this.vx = 0; this.vy = 0;
            }
        } else if (ef === 'galaxy') {
            const sf = 0.003 + (1/(this.orbitR+1))*0.28;
            this.angle += sf;
            const cx = width/2, cy = height/2;
            const arm = this.armId * (Math.PI*2/3);
            const sa  = arm + this.angle + this.orbitR*0.004;
            const ox  = cx + Math.cos(sa)*this.orbitR;
            const oy  = cy + Math.sin(sa)*this.orbitR*0.36;
            this.vx = (this.vx + (ox-this.x)*0.009)*0.90;
            this.vy = (this.vy + (oy-this.y)*0.009)*0.90;
        } else if (ef === 'trail') {
            const dx = cursorX-this.x, dy = cursorY-this.y;
            const dist = Math.sqrt(dx*dx+dy*dy)+1;
            if (dist < 160) {
                const force = (160-dist)/160;
                this.vx -= (dx/dist)*force*5.5;
                this.vy -= (dy/dist)*force*5.5;
            }
            this.vx += (this.homeX-this.x)*0.0025;
            this.vy += (this.homeY-this.y)*0.0025;
            this.vx *= 0.91; this.vy *= 0.91;
        } else {
            this.vx += (Math.random()-0.5)*0.03;
            this.vy += (Math.random()-0.5)*0.03;
            this.vx *= 0.985; this.vy *= 0.985;
        }

        this.x += this.vx; this.y += this.vy;
        const buf = 24;
        if (this.x < -buf)         this.x = width+buf;
        if (this.x > width+buf)    this.x = -buf;
        if (this.y < -buf)         this.y = height+buf;
        if (this.y > height+buf)   this.y = -buf;

        this.size  += (this.targetSize  - this.size)  * 0.055;
        this.alpha += (this.targetAlpha - this.alpha) * 0.055;
        this.hue   += (this.targetHue   - this.hue)   * 0.055;
    }

    draw(now) {
        const tw = 0.78 + Math.sin(now*0.0025 + this.twinkle)*0.22;
        const a  = Math.max(0, Math.min(1, this.alpha * tw));
        if (a < 0.012 || this.size < 0.08) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        if (this.hasPhotoColor) {
            const { photoR: r, photoG: g, photoB: b } = this;
            ctx.globalAlpha = a * 0.18;
            const grd = ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.size*3.5);
            grd.addColorStop(0,   `rgba(${r},${g},${b},1)`);
            grd.addColorStop(0.5, `rgba(${r},${Math.round(g*0.55)},${b},0.35)`);
            grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
            ctx.beginPath(); ctx.arc(this.x,this.y,this.size*3.5,0,Math.PI*2);
            ctx.fillStyle = grd; ctx.fill();
            ctx.globalAlpha = a;
            ctx.beginPath(); ctx.arc(this.x,this.y,this.size*0.55,0,Math.PI*2);
            ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
        } else {
            const isBH = isFreePlay && currentEffect==='blackhole';
            const gm = isBH ? 3.2 : 4.5, cm = isBH ? 0.45 : 0.65;
            ctx.globalAlpha = a*0.20;
            const grd = ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.size*gm);
            grd.addColorStop(0,    `hsla(${this.hue},92%,80%,1)`);
            grd.addColorStop(0.45, `hsla(${this.hue},80%,62%,0.5)`);
            grd.addColorStop(1,    `hsla(${this.hue},70%,50%,0)`);
            ctx.beginPath(); ctx.arc(this.x,this.y,this.size*gm,0,Math.PI*2);
            ctx.fillStyle = grd; ctx.fill();
            ctx.globalAlpha = a;
            ctx.beginPath(); ctx.arc(this.x,this.y,this.size*cm,0,Math.PI*2);
            ctx.fillStyle = `hsl(${this.hue},96%,90%)`; ctx.fill();
        }
        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════
//  EXTRA PARTICLE CLASS
// ═══════════════════════════════════════════════════
class ExtraParticle {
    constructor(tx,ty,isPhoto,r,g,b) {
        this.x  = Math.random()*width; this.y = Math.random()*height;
        this.vx = (Math.random()-0.5)*2; this.vy = (Math.random()-0.5)*2;
        this.tx = tx; this.ty = ty;
        this.isPhoto = isPhoto; this.r=r; this.g=g; this.b=b;
        this.size = 0.6+Math.random()*0.9; this.alpha = 0;
        this.targetAlpha = 0.7+Math.random()*0.3;
        this.hue    = isPhoto ? 300+Math.random()*50 : 285+Math.random()*80;
        this.twinkle= Math.random()*Math.PI*2;
    }
    update() {
        const fx=(this.tx-this.x)*0.016, fy=(this.ty-this.y)*0.016;
        this.vx=(this.vx+fx)*0.80; this.vy=(this.vy+fy)*0.80;
        this.x+=this.vx; this.y+=this.vy;
        this.alpha+=(this.targetAlpha-this.alpha)*0.055;
    }
    draw(now) {
        const tw=0.8+Math.sin(now*0.003+this.twinkle)*0.2;
        const a=Math.max(0,Math.min(1,this.alpha*tw));
        if (a<0.01) return;
        ctx.save(); ctx.globalCompositeOperation='lighter';
        if (this.isPhoto) {
            const isPink=(this.hue>315);
            const rc=isPink?255:240, gc=isPink?100:230, bc=isPink?180:240;
            ctx.globalAlpha=a*0.15;
            const grd=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.size*3);
            grd.addColorStop(0,`rgba(${rc},${gc},${bc},1)`);
            grd.addColorStop(1,`rgba(${rc},${gc},${bc},0)`);
            ctx.beginPath(); ctx.arc(this.x,this.y,this.size*3,0,Math.PI*2);
            ctx.fillStyle=grd; ctx.fill();
            ctx.globalAlpha=a;
            ctx.beginPath(); ctx.arc(this.x,this.y,this.size*0.6,0,Math.PI*2);
            ctx.fillStyle=`rgba(${rc},${gc},${bc},1)`; ctx.fill();
        } else {
            ctx.globalAlpha=a*0.12;
            const grd=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.size*3);
            grd.addColorStop(0,`hsla(${this.hue},90%,85%,1)`);
            grd.addColorStop(1,`hsla(${this.hue},70%,55%,0)`);
            ctx.beginPath(); ctx.arc(this.x,this.y,this.size*3,0,Math.PI*2);
            ctx.fillStyle=grd; ctx.fill();
            ctx.globalAlpha=a;
            ctx.beginPath(); ctx.arc(this.x,this.y,this.size*0.6,0,Math.PI*2);
            ctx.fillStyle=`hsl(${this.hue},95%,92%)`; ctx.fill();
        }
        ctx.restore();
    }
}

// ─── INIT ────────────────────────────────────────────
function initParticles() {
    particles = [];
    const count = Math.min(1600, Math.max(700, Math.floor((width*height)/6500)));
    for (let i=0; i<count; i++) particles.push(new Particle(i));
    particles.forEach(p => { p.tx=p.x; p.ty=p.y; p.homeX=p.x; p.homeY=p.y; });
    updateParticleBadge();
}

function clearExtraParticles() { extraParticles = []; }

function updateParticleBadge() {
    const b = document.getElementById('particle-badge');
    if (b) b.textContent = `${particles.length + extraParticles.length} particles`;
}

// ─── ANIMATE ─────────────────────────────────────────
function animate() {
    const now = performance.now();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = isFreePlay ? 0.10 : 0.16;
    ctx.fillStyle   = '#030309';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle   = 'white';
    for (let i=0; i<6; i++) {
        ctx.beginPath();
        ctx.arc(Math.random()*width, Math.random()*height, Math.random()*0.7, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    particles.forEach(p => { p.update(now); p.draw(now); });
    if (extraParticles.length > 0) extraParticles.forEach(p => { p.update(); p.draw(now); });

    if (isFreePlay && currentEffect==='trail') {
        drawTrailGlow();
    } else if (!isFreePlay || (currentEffect!=='name' && currentEffect!=='shaka')) {
        tctx.clearRect(0, 0, width, height);
    }

    requestAnimationFrame(animate);
}

initParticles();
animate();

// ═══════════════════════════════════════════════════
//  MODE SETTERS
// ═══════════════════════════════════════════════════

function setModeNameTargets() {
    clearExtraParticles();
    const img = new Image();
    img.src = '/assets/text.png';
    const apply = (img) => {
        const scaleT = Math.min(width/img.width, height/img.height) * 0.90;
        const W = Math.round(img.width*scaleT), H = Math.round(img.height*scaleT);
        const offX = Math.round((width-W)/2), offY = Math.round((height-H)/2);
        const off = document.createElement('canvas');
        off.width=W; off.height=H;
        const octx = off.getContext('2d'); octx.drawImage(img,0,0,W,H);
        const d = octx.getImageData(0,0,W,H).data;
        const pts = [];
        for (let py=0; py<H; py+=2) for (let px=0; px<W; px+=2) {
            const idx=(py*W+px)*4;
            if (d[idx+3]>40 || (d[idx]+d[idx+1]+d[idx+2])/3>30) pts.push({x:offX+px,y:offY+py});
        }
        if (!pts.length) return;
        for (let i=pts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pts[i],pts[j]]=[pts[j],pts[i]];}
        particles.forEach((p,i)=>{
            const pt=pts[i%pts.length];
            p.tx=pt.x+(Math.random()-0.5)*1.5; p.ty=pt.y+(Math.random()-0.5)*1.5;
            p.targetSize=0.6+Math.random()*1.0; p.targetAlpha=0.70+Math.random()*0.30;
            p.targetHue=285+Math.random()*80; p.hasPhotoColor=false;
        });
        const ec=particles.length*2;
        for(let i=0;i<ec;i++){
            const pt=pts[i%pts.length];
            const ep=new ExtraParticle(pt.x+(Math.random()-0.5)*1.5,pt.y+(Math.random()-0.5)*1.5,false,0,0,0);
            ep.size=0.4+Math.random()*0.8; ep.targetAlpha=0.75+Math.random()*0.25; ep.hue=270+Math.random()*100;
            extraParticles.push(ep);
        }
        let fa=0;
        const fi=setInterval(()=>{
            fa+=0.012; if(fa>=1){clearInterval(fi);fa=1;}
            tctx.clearRect(0,0,width,height); tctx.save();
            tctx.globalCompositeOperation='lighter';
            tctx.globalAlpha=0.20*fa; tctx.filter='blur(8px) saturate(2) hue-rotate(270deg)';
            tctx.drawImage(img,offX,offY,W,H);
            tctx.globalAlpha=0.15*fa; tctx.filter='blur(2px) saturate(3) hue-rotate(270deg)';
            tctx.drawImage(img,offX,offY,W,H); tctx.restore();
        },16);
    };
    img.complete ? apply(img) : (img.onload=()=>apply(img));
}

function setModeShakaTargets() {
    clearExtraParticles();
    if (!shakaReady || !shakaImg) { setModeNoneTargets(); return; }
    const maxH=Math.min(height*0.95,height);
    const scale=maxH/shakaImg.height, W=Math.round(shakaImg.width*scale), H=Math.round(shakaImg.height*scale);
    const offX=Math.round((width-W)/2), offY=Math.round((height-H)/2);
    const off=document.createElement('canvas'); off.width=W; off.height=H;
    const octx=off.getContext('2d'); octx.drawImage(shakaImg,0,0,W,H);
    const d=octx.getImageData(0,0,W,H).data;
    const allPts=[];
    for(let py=0;py<H;py+=2)for(let px=0;px<W;px+=2){
        const idx=(py*W+px)*4, r=d[idx],g=d[idx+1],b=d[idx+2];
        if((r+g+b)/3>18) allPts.push({x:offX+px,y:offY+py,r,g,b,br:(r+g+b)/3});
    }
    if(!allPts.length){setModeNoneTargets();return;}
    for(let i=allPts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[allPts[i],allPts[j]]=[allPts[j],allPts[i]];}
    particles.forEach((p,i)=>{
        const pt=allPts[i%allPts.length];
        p.tx=pt.x+(Math.random()-0.5)*1.5; p.ty=pt.y+(Math.random()-0.5)*1.5;
        p.photoR=Math.min(255,Math.round(pt.r*1.1+20));
        p.photoG=Math.min(255,Math.round(pt.g*0.68+8));
        p.photoB=Math.min(255,Math.round(pt.b*1.1+40));
        p.hasPhotoColor=true; p.targetSize=0.5+(pt.br/255)*1.1; p.targetAlpha=0.60+(pt.br/255)*0.40;
    });
    const ec=particles.length*4;
    for(let i=0;i<ec;i++){
        const pt=allPts[i%allPts.length];
        const ep=new ExtraParticle(pt.x+(Math.random()-0.5)*1.5,pt.y+(Math.random()-0.5)*1.5,true,pt.r,pt.g,pt.b);
        ep.hue=Math.random()>0.5?305+Math.random()*25:275+Math.random()*25;
        ep.size=0.3+(pt.br/255)*0.8; ep.targetAlpha=0.65+Math.random()*0.35;
        extraParticles.push(ep);
    }
    let fa=0;
    const fi=setInterval(()=>{
        fa+=0.01; if(fa>=1){clearInterval(fi);fa=1;}
        tctx.clearRect(0,0,width,height); tctx.save();
        tctx.globalCompositeOperation='lighter';
        tctx.globalAlpha=0.22*fa; tctx.filter='blur(6px) saturate(2) hue-rotate(20deg)';
        tctx.drawImage(shakaImg,offX,offY,W,H);
        tctx.filter='blur(2px) saturate(3) hue-rotate(20deg)';
        tctx.globalAlpha=0.14*fa; tctx.drawImage(shakaImg,offX,offY,W,H); tctx.restore();
    },16);
}

function setModeBlackholeTargets() {
    clearExtraParticles();
    particles.forEach(p=>{p.targetSize=0.5+Math.random()*0.9;p.targetAlpha=0.35+Math.random()*0.45;p.targetHue=265+Math.random()*65;p.hasPhotoColor=false;});
}

function setModeGalaxyTargets() {
    clearExtraParticles();
    particles.forEach((p,i)=>{
        p.orbitR=35+Math.pow(Math.random(),0.5)*Math.min(width,height)*0.46;
        p.armId=i%3; p.targetSize=0.7+Math.random()*1.6;
        p.targetAlpha=0.32+Math.random()*0.58; p.targetHue=275+Math.random()*85; p.hasPhotoColor=false;
    });
}

function setModeTrailTargets() {
    clearExtraParticles();
    particles.forEach(p=>{
        p.homeX=p.x; p.homeY=p.y;
        p.targetSize=1.4+Math.random()*2.0; p.targetAlpha=0.55+Math.random()*0.45;
        p.targetHue=285+Math.random()*80; p.hasPhotoColor=false;
    });
}

function setModeNoneTargets() {
    clearExtraParticles();
    particles.forEach(p=>{
        p.tx=Math.random()*width; p.ty=Math.random()*height;
        p.targetSize=Math.random()*1.6+0.5; p.targetAlpha=Math.random()*0.35+0.12;
        p.targetHue=290+Math.random()*70; p.hasPhotoColor=false;
    });
}

// ─── TRAIL GLOW ──────────────────────────────────────
function drawTrailGlow() {
    tctx.fillStyle='rgba(3,3,9,0.16)'; tctx.fillRect(0,0,width,height);
    particles.forEach(p=>{
        const speed=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
        if(speed<0.8)return;
        const intensity=Math.min(1,speed/6), sz=p.size*3*intensity;
        const g=tctx.createRadialGradient(p.x,p.y,0,p.x,p.y,sz*5);
        g.addColorStop(0,`rgba(255,200,255,${intensity*0.9})`);
        g.addColorStop(0.3,`rgba(220,80,200,${intensity*0.5})`);
        g.addColorStop(0.7,`rgba(140,20,210,${intensity*0.2})`);
        g.addColorStop(1,'rgba(0,0,0,0)');
        tctx.beginPath(); tctx.arc(p.x,p.y,sz*5,0,Math.PI*2);
        tctx.fillStyle=g; tctx.fill();
        tctx.beginPath(); tctx.arc(p.x,p.y,sz*0.4,0,Math.PI*2);
        tctx.fillStyle=`rgba(255,240,255,${intensity*0.95})`; tctx.fill();
    });
    const g2=tctx.createRadialGradient(cursorX,cursorY,0,cursorX,cursorY,55);
    g2.addColorStop(0,'rgba(255,180,255,0.65)'); g2.addColorStop(0.4,'rgba(200,60,200,0.2)'); g2.addColorStop(1,'rgba(0,0,0,0)');
    tctx.beginPath(); tctx.arc(cursorX,cursorY,55,0,Math.PI*2); tctx.fillStyle=g2; tctx.fill();
}

// ─── SHAKA LOADER ────────────────────────────────────
function loadShakaImage() {
    shakaImg = new Image(); shakaImg.crossOrigin='anonymous'; shakaImg.src='/assets/foto.png';
    shakaImg.onload = () => { shakaReady=true; };
    shakaImg.onerror = () => { shakaReady=false; };
}

// ═══════════════════════════════════════════════════
//  SCENE MANAGER
// ═══════════════════════════════════════════════════
const SCENES = ['permission','opening','questions','puzzle','story','ending'];
let currentScene = 0;

function setScene(index) {
    currentScene = index;
    // Update progress bar
    const pct = Math.round((index / (SCENES.length - 1)) * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    // Update scene dots
    document.querySelectorAll('.scene-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
        dot.classList.toggle('done',   i < index);
    });
}

// ═══════════════════════════════════════════════════
//  QUESTIONS STATE
// ═══════════════════════════════════════════════════
const STATE = {
    currentQuestionIndex: 0,
    answers: [],
    questions: [
        {
            text: "Mey.. kamu kalau cape, biasanya kemana?",
            options: [
                "Rebahan di kamar sendiri, scrolling, atau main game maybe",
                "Di luar rumah, udara bebas dan langit luas",
                "Tetap di keramaian, tapi pikiran terbang jauh",
                "Di mana pun, asal ada musik yang pas"
            ]
        },
        {
            text: "Kalau tahun ini dikasih satu wish yg pasti terkabul, kamu pilih apa?",
            options: [
                "Lebih tenang, lebih ikhlas, lebih sabar dari sebelumnya",
                "Satu mimpi yng udh lama ingin di wujudkan",
                "Dikelilingi orang-orang yang beneran peduli",
                "Jalan-jalan ke tempat yang udah lama pengen didatangi"
            ]
        },
        {
            text: " Oke Mey, Kalau bisa tinggal di mana saja di dunia ini, kamu mau di mana?",
            options: [
                "Kota yang sepi tapi estetik, ada kafe di tiap sudut",
                "Desa yang damai, dekat alam dan hamparan hijau",
                "Pantai, dekat ombak dan sunset tiap hari",
                "Di bulan. Atau luar angkasa sekalian dah 🚀"
            ]
        },
        {
            text: "Hal kecil apa yang paling sering bikin kamu bahagia?",
            options: [
                "Mainan sama kucing",
                "Chat dari seseorang yang lagi kamu pikirin",
                "Lihat langit yang warnanya keterlaluan bagus",
                "Playlist yang rasanya dibuat khusus buat mood kamu"
            ]
        }
    ]
};

// ─── ELEMENT REFS ─────────────────────────────────────
const cursor          = document.getElementById('custom-cursor');
const cursorRing      = document.getElementById('cursor-ring');
const permissionPopup = document.getElementById('permission-popup');
const allowBtn        = document.getElementById('allow-camera-btn');
const videoElement    = document.getElementById('webcam');
const questionContainer = document.getElementById('question-container');
const questionText    = document.getElementById('question-text');
const optionsContainer  = document.getElementById('options-container');
const bgMusic         = document.getElementById('bg-music');

// ─── PERMISSION → OPENING ────────────────────────────
allowBtn.addEventListener('click', () => {
    playClick();
    permissionPopup.style.opacity='0';
    permissionPopup.style.transition='opacity 0.6s ease';
    setTimeout(()=>{ permissionPopup.style.display='none'; },600);
    startCamera();
    showOpeningScene();
});

function showOpeningScene() {
    setScene(1);
    const os = document.getElementById('opening-scene');
    if (!os) { showNextQuestion(); return; }
    os.classList.remove('hidden');
    os.style.opacity='0'; os.style.transition='opacity 1s ease';
    setTimeout(()=>{ os.style.opacity='1'; },50);

    // Play arrival chime
    setTimeout(()=> playChime(523), 600);

    function proceed() {
        playTransition();
        os.style.opacity='0';
        setTimeout(()=>{
            os.classList.add('hidden');
            os.style.opacity=''; os.style.transition='';
            showNextQuestion();
        }, 1000);
    }

    const startBtn = document.getElementById('opening-start-btn');
    if (startBtn) startBtn.addEventListener('click', proceed);
    setTimeout(()=>{ if (!os.classList.contains('hidden')) proceed(); }, 18000);
}

// ─── QUESTION FLOW ───────────────────────────────────
function showNextQuestion() {
    setScene(2);
    if (STATE.currentQuestionIndex >= STATE.questions.length) {
        finishQuestions(); return;
    }
    const q = STATE.questions[STATE.currentQuestionIndex];
    questionContainer.classList.remove('hidden');
    questionContainer.style.opacity='0';
    questionContainer.style.transition='opacity 0.6s ease';

    setTimeout(()=>{
        // Question number
        const qn = document.getElementById('question-number');
        if (qn) qn.textContent = `${STATE.currentQuestionIndex+1} / ${STATE.questions.length}`;

        questionText.textContent = q.text;
        optionsContainer.innerHTML = '';
        q.options.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.dataset.index = index;
            btn.style.animationDelay = `${index * 0.08}s`;
            btn.style.animation = 'fadeInUp 0.5s ease both';
            btn.style.animationDelay = `${index * 0.09}s`;
            btn.addEventListener('click', () => selectOption(index));
            optionsContainer.appendChild(btn);
        });
        questionContainer.style.opacity='1';
        playChime(440 + STATE.currentQuestionIndex * 44);
    }, 400);
}

function selectOption(index) {
    const btns = document.querySelectorAll('.option-btn');
    btns[index].classList.add('selected');
    playSelect();
    spawnRipple(cursorX, cursorY);
    STATE.answers.push(STATE.questions[STATE.currentQuestionIndex].options[index]);

    setTimeout(()=>{
        questionContainer.style.opacity='0';
        setTimeout(()=>{
            STATE.currentQuestionIndex++;
            showNextQuestion();
        }, 700);
    }, 500);
}

// ─── FEEDBACK MAPPING ────────────────────────────────
const FEEDBACK_MAPPING = {
    "Rebahan di kamar sendiri, scrolling, atau main game maybe":
        "ternyata kamu tipe yang butuh 'me time' maksimal ya di kamar ✨",
    "Di luar rumah, udara bebas dan langit luas":
        "jiwa petualang kamu emang nggak bisa bohong, sukanya hirup udara bebas 🪐",
    "Tetap di keramaian, tapi pikiran terbang jauh":
        "pinter banget ya kamu, tetep tenang di tengah rame padahal pikirannya udah kemana-mana 😂",
    "Di mana pun, asal ada musik yang pas":
        "emang bener, playlist yang pas itu obat paling ampuh buat segalanya 🎵",
    "Lebih tenang, lebih ikhlas, lebih sabar dari sebelumnya":
        "semoga tahun ini hati kamu beneran seadem yang kamu mau ya 😭",
    "Satu mimpi yng udh lama ingin di wujudkan":
        "aku doain hal yang kamu tunda itu bisa segera kejadian tahun ini ✨",
    "Dikelilingi orang-orang yang beneran peduli":
        "semoga kamu selalu nemu orang-orang yang sayang sama kamu tulus apa adanya ✨",
    "Jalan-jalan ke tempat yang udah lama pengen didatangi":
        "pokoknya semua list destinasi kamu harus kecentang satu-satu ya! 🚀",
    "Kota yang sepi tapi estetik, ada kafe di tiap sudut":
        "kalau nanti beneran tinggal di kota estetik itu, jangan lupa ajak aku ngopi ya 😂",
    "Desa yang damai, dekat alam dan hamparan hijau":
        "bayangin kamu bangun tidur langsung liat ijo-ijo, pasti tenang banget hidupnya ✨",
    "Pantai, dekat ombak dan sunset tiap hari":
        "hidup di pinggir pantai emang impian banget, tiap sore dapet sunset gratis 🌅",
    "Di bulan. Atau luar angkasa sekalian dah🚀":
        "kalau jadi pindah ke bulan kabarin ya, siapa tau aku jadi tetangga sebelah 🚀😂",
    "Mainan sama kucing":
        "pantesan hatinya lembut, ternyata pawrent sejati ya 🐱",
    "Chat dari seseorang yang lagi kamu pikirin":
        "semoga notif dari 'dia' selalu muncul di waktu yang paling pas ✨",
    "Langit yang warnanya keterlaluan bagus":
        "semoga setiap hari langitnya selalu kasih warna yang bikin kamu senyum 😭",
    "Playlist yang rasanya dibuat khusus buat mood kamu":
        "semoga telinga kamu selalu dimanjain sama lagu-lagu yang ngertiin kamu ✨"
};

function finishQuestions() {
    questionContainer.style.opacity='0';
    setTimeout(()=>{
        const feedbackParts = STATE.answers.map(ans => FEEDBACK_MAPPING[ans] || ans);
        const part1 = `${feedbackParts[0]} dan ${feedbackParts[1]}.`;
        const part2 = `${feedbackParts[2]}, dan ya... ${feedbackParts[3]}.`;
        questionContainer.innerHTML = `
            <div class="hologram-card feedback-scene">
                <div class="feedback-content">
                    <p class="feedback-text fade-in-up" style="animation-delay:0.5s">${part1}</p>
                    <p class="feedback-text fade-in-up" style="animation-delay:3s">${part2}</p>
                    <p class="feedback-text highlight fade-in-up" style="animation-delay:5.5s">
                        apapun itu, aku cuma pengen kamu bahagia terus meyy... ✨
                    </p>
                </div>
                <button id="next-to-puzzle" class="fade-in" style="animation-delay:8s;margin-top:30px;">Lanjut &nbsp;→</button>
            </div>`;
        questionContainer.style.opacity='1';
        setTimeout(() => playChime(587), 500);
        setTimeout(() => playChime(659), 3000);
        setTimeout(() => playChime(784), 5500);
        document.getElementById('next-to-puzzle').addEventListener('click', ()=>{
            playTransition();
            initPuzzleGame();
        });
    }, 800);
}

// ─── PUZZLE GAME ─────────────────────────────────────
const puzzleContainer = document.getElementById('puzzle-container');
const puzzleBoard     = document.getElementById('puzzle-board');
const puzzleTutorial  = document.getElementById('puzzle-tutorial');
const startPuzzleBtn  = document.getElementById('start-puzzle-btn');
const captureCanvas   = document.getElementById('capture-canvas');
let puzzlePieces = [];

function initPuzzleGame() {
    setScene(3);
    questionContainer.classList.add('hidden');
    puzzleContainer.classList.remove('hidden');
    puzzleTutorial.classList.remove('hidden');
    playChime(440);
}

startPuzzleBtn.addEventListener('click', ()=>{
    playClick();
    puzzleTutorial.classList.add('hidden');
    captureAndStartPuzzle();
    camera.start();
});

function captureAndStartPuzzle() {
    const pctx = captureCanvas.getContext('2d');
    captureCanvas.width=660; captureCanvas.height=440;
    pctx.translate(660,0); pctx.scale(-1,1);
    pctx.drawImage(videoElement,0,0,660,440);
    requestAnimationFrame(()=>{ pctx.drawImage(videoElement,0,0,660,440); });
    const imageData = captureCanvas.toDataURL('image/jpeg');
    createPuzzlePieces(imageData);
    startTime=Date.now(); isGameActive=true;
    playChime(523);
}

function createPuzzlePieces(imageSrc) {
    puzzleBoard.innerHTML='';
    puzzlePieces=[];
    const rows=2, cols=3, pw=660/cols, ph=440/rows;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
        const piece=document.createElement('div');
        piece.className='puzzle-piece';
        piece.style.width=`${pw}px`; piece.style.height=`${ph}px`;
        piece.style.backgroundImage=`url(${imageSrc})`;
        piece.style.backgroundSize='660px 440px';
        piece.style.backgroundPosition=`-${c*pw}px -${r*ph}px`;
        const pObj={element:piece,targetX:c*pw,targetY:r*ph,
                    currentX:Math.random()*(window.innerWidth-pw),
                    currentY:Math.random()*(window.innerHeight-ph),
                    id:r*cols+c};
        updatePiecePosition(pObj);
        puzzleBoard.appendChild(piece);
        puzzlePieces.push(pObj);
    }
    scramblePieces();
}

function updatePiecePosition(p) {
    p.element.style.left=`${p.currentX}px`;
    p.element.style.top=`${p.currentY}px`;
}

function scramblePieces() {
    puzzlePieces.forEach(p=>{
        p.currentX=Math.random()*400; p.currentY=Math.random()*300;
        updatePiecePosition(p);
    });
}

function checkSnap(piece) {
    const dx=piece.targetX-piece.currentX, dy=piece.targetY-piece.currentY;
    if(Math.sqrt(dx*dx+dy*dy)<60) {
        piece.currentX=piece.targetX; piece.currentY=piece.targetY;
        updatePiecePosition(piece);
        piece.element.classList.add('correct');
        piece.locked=true;
        piece.element.style.zIndex='1';
        piece.element.style.transition='box-shadow 0.3s ease';
        playPuzzleSnap();
        spawnRipple(cursorX, cursorY);
    }
}

function checkWin() {
    if(puzzlePieces.every(p=>p.element.classList.contains('correct')) && isGameActive) {
        isGameActive=false;
        playPuzzleComplete();
        finishPuzzle();
    }
}

function finishPuzzle() {
    const duration=(Date.now()-startTime)/1000;
    const message=duration<60?"wahh cepet juga kamu 😭✨":"wkwk lumayan lama juga 😭";
    setTimeout(()=>{
        puzzleBoard.style.opacity='0.45'; puzzleBoard.style.transition='opacity 2s ease';
        const feedback=document.createElement('div');
        feedback.className='hologram-card fade-in';
        feedback.style.cssText='position:absolute;z-index:1000;';
        feedback.innerHTML=`
            <h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;font-weight:400;margin-bottom:16px;">Puzzle Selesai! ✨</h2>
            <p style="margin:20px 0;font-size:1.05rem;color:rgba(255,200,225,0.85)">${message}</p>
            <p style="font-size:0.75rem;opacity:0.4;letter-spacing:0.1em">Waktu: ${duration.toFixed(1)} detik</p>
            <button id="next-to-story" class="story-btn fade-in">Lanjut →</button>`;
        puzzleContainer.appendChild(feedback);
        document.getElementById('next-to-story').addEventListener('click', ()=>{
            playTransition();
            startStorytelling();
        });
    }, 1200);
}

// ─── STORYTELLING ────────────────────────────────────
const storyContainer = document.getElementById('story-container');
const storyScroll    = document.getElementById('story-scroll');

const STORY_LINES = [
    "Hay meysaa...",
    "HBD YA.. semoga hal-hal baik selalu datang ke kamu, dan",
    "apa yang kamu usahakan bisa tercapai ...",
    "aminn",
    "Ohh iyaa mey...",
    "Aku juga minta maaf kalau selama ini pernah ada sikap atau...",
    "kata2ku yang bikin kamu ga nyaman, sengaja maupun ga sengaja",
    "kado itu bukan punya maksud apapun kok, cuma bentuk ucapan aja",
    "dan...",
    "tenang aja, aku udah ngga ngejer kamu lagi, tapii...",
    "insyaallah :v",
    "Aku cuma pengen semuanya tetep baik tanpa ada rasa gaenak satu sama lain."
];

let currentLineIndex=-1, isStoryActive=false, autoNextTimer=null, isAutoTyping=false, canManualNext=false;

function startStorytelling() {
    setScene(4);
    puzzleContainer.classList.add('hidden');
    storyContainer.classList.remove('hidden');
    isStoryActive=true;
    bgMusic.volume=0.45;
    bgMusic.play().catch(()=>{});
    setTimeout(()=> nextStoryLine(), 400);
}

function nextStoryLine() {
    if(!isStoryActive) return;
    if(autoNextTimer) clearTimeout(autoNextTimer);
    currentLineIndex++;
    if(currentLineIndex>=STORY_LINES.length){finishStory();return;}

    const lineText=STORY_LINES[currentLineIndex];
    document.querySelectorAll('.story-line').forEach(l=>l.classList.add('scrolled'));

    const lineEl=document.createElement('div');
    lineEl.className='story-line';
    lineEl.textContent=lineText;
    storyScroll.appendChild(lineEl);
    storyScroll.style.transform=`translateY(-${currentLineIndex*65}px)`;
    setTimeout(()=>lineEl.classList.add('active'),100);
    playStoryAdvance();

    if(lineText.endsWith('...')){
        canManualNext=false; isAutoTyping=true;
        autoNextTimer=setTimeout(()=>{isAutoTyping=false;nextStoryLine();},4000);
    } else {
        canManualNext=true; isAutoTyping=false;
    }
}

function finishStory() {
    isStoryActive=false;
    playCelebration();
    setTimeout(()=>{
        storyContainer.style.opacity='0'; storyContainer.style.transition='opacity 3s ease';
        setTimeout(showFinalEnding, 3000);
    }, 4000);
}

// ─── FINAL ENDING & FREEPLAY ─────────────────────────
const finalEnding      = document.getElementById('final-ending');
const freeplayPopup    = document.getElementById('freeplay-popup');
const startFreeplayBtn = document.getElementById('start-freeplay-btn');

function showFinalEnding() {
    setScene(5);
    storyContainer.classList.add('hidden');
    finalEnding.classList.remove('hidden');
    finalEnding.style.opacity='0'; finalEnding.style.transition='opacity 2s ease';
    setTimeout(()=>{ finalEnding.style.opacity='1'; },50);
    playChime(784);
    setTimeout(()=>{ freeplayPopup.classList.remove('hidden'); freeplayPopup.classList.add('fade-in'); playChime(659); }, 8000);
}

startFreeplayBtn.addEventListener('click',()=>{
    playTransition();
    freeplayPopup.classList.add('hidden');
    finalEnding.classList.add('hidden');
    isFreePlay=true;
    const tips=document.getElementById('freeplay-tips');
    if(tips){tips.classList.remove('hidden');tips.style.opacity='1';}
    const pb=document.getElementById('particle-badge');
    if(pb){pb.classList.add('visible');updateParticleBadge();}
    loadShakaImage();
});

// ─── VOLUME BUTTON ───────────────────────────────────
document.getElementById('volume-btn').addEventListener('click',()=>{
    musicMuted=!musicMuted;
    bgMusic.muted=musicMuted;
    document.getElementById('volume-btn').textContent=musicMuted?'♪':'♫';
    playClick();
});

// ─── HAND TRACKING / CAMERA ──────────────────────────
let hands, camera;

function startCamera() {
    hands=new Hands({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:0.7,minTrackingConfidence:0.7});
    hands.onResults(onResults);
    camera=new Camera(videoElement,{
        onFrame:async()=>{await hands.send({image:videoElement});},
        width:640,height:480
    });
    camera.start();
}

const lerp=(s,e,a)=>(1-a)*s+a*e;

function onResults(results) {
    if(!results.multiHandLandmarks||!results.multiHandLandmarks.length) return;
    const lm=results.multiHandLandmarks[0];
    targetX=(1-lm[8].x)*window.innerWidth;
    targetY=lm[8].y*window.innerHeight;
    detectGestures(lm);
}

// ─── GESTURE DETECTION ───────────────────────────────
function detectGestures(lm) {
    const thumbTip=lm[4],indexTip=lm[8],middleTip=lm[12],ringTip=lm[16],pinkyTip=lm[20];
    const indexExt=indexTip.y<lm[6].y;
    const middleExt=middleTip.y<lm[10].y;
    const ringExt=ringTip.y<lm[14].y;
    const pinkyExt=pinkyTip.y<lm[18].y;

    if(isFreePlay) {
        let newEffect='none';
        if     (indexExt&&middleExt&&!ringExt&&!pinkyExt) newEffect='name';
        else if(indexExt&&middleExt&&ringExt&&pinkyExt)   newEffect='galaxy';
        else if(!indexExt&&!middleExt&&!ringExt&&pinkyExt)newEffect='shaka';
        else if(indexExt&&!middleExt&&!ringExt&&!pinkyExt)newEffect='trail';
        else if(!indexExt&&!middleExt&&!ringExt&&!pinkyExt)newEffect='blackhole';

        if(newEffect!==currentEffect) {
            currentEffect=newEffect;
            tctx.clearRect(0,0,width,height);
            if     (currentEffect==='name')      setModeNameTargets();
            else if(currentEffect==='shaka')     setModeShakaTargets();
            else if(currentEffect==='blackhole') setModeBlackholeTargets();
            else if(currentEffect==='galaxy')    setModeGalaxyTargets();
            else if(currentEffect==='trail')     setModeTrailTargets();
            else                                  setModeNoneTargets();
            updateParticleBadge();
        }
    }

    // Pinch
    const pinchDist=Math.hypot(indexTip.x-thumbTip.x,indexTip.y-thumbTip.y);
    if(pinchDist<0.09) {
        if(!isPinching){isPinching=true;cursor.classList.add('clicking');cursorRing.classList.add('clicking');triggerGesture('click');}
    } else {
        if(isPinching){isPinching=false;cursor.classList.remove('clicking');cursorRing.classList.remove('clicking');}
    }

    // Back gesture
    if(indexExt&&middleTip.y>lm[10].y&&indexTip.x>lm[5].x+0.1) debounceGesture('back');

    // Puzzle drag
    if(isPinching&&draggedPiece) {
        const mx=(targetX-cursorX)*1.8, my=(targetY-cursorY)*1.8;
        draggedPiece.currentX+=mx*0.2; draggedPiece.currentY+=my*0.2;
        updatePiecePosition(draggedPiece);
    } else if(!isPinching&&draggedPiece) {
        checkSnap(draggedPiece);
        draggedPiece.element.classList.remove('dragging');
        draggedPiece=null; checkWin();
    }
}

function debounceGesture(gesture) {
    if(lastGesture===gesture) return;
    if(gestureDebounceTimer) clearTimeout(gestureDebounceTimer);
    gestureDebounceTimer=setTimeout(()=>{
        triggerGesture(gesture); lastGesture=gesture;
        setTimeout(()=>{lastGesture=null;},1000);
    },150);
}

function triggerGesture(type) {
    if(isAutoTyping) return;
    if(type==='click') {
        if(isStoryActive&&canManualNext){nextStoryLine();return;}
        const hovered=document.querySelector(
            '.option-btn.hovered,#next-to-puzzle.hovered,#start-puzzle-btn.hovered,'+
            '#next-to-story.hovered,#start-freeplay-btn.hovered,#opening-start-btn.hovered,'+
            '#allow-camera-btn.hovered,#volume-btn.hovered'
        );
        if(hovered){hovered.click();return;}
        if(isGameActive&&!draggedPiece) {
            const els=document.elementsFromPoint(cursorX,cursorY);
            const pieceEl=els.find(el=>el.classList.contains('puzzle-piece'));
            if(pieceEl){
                draggedPiece=puzzlePieces.find(p=>p.element===pieceEl);
                if(draggedPiece&&draggedPiece.locked){draggedPiece=null;return;}
                if(draggedPiece) draggedPiece.element.classList.add('dragging');
            }
        }
    }
}

// ─── CURSOR UPDATE (smooth ring lag) ─────────────────
let ringX = window.innerWidth/2, ringY = window.innerHeight/2;

function updateCursor() {
    cursorX=lerp(cursorX,targetX,0.18);
    cursorY=lerp(cursorY,targetY,0.18);
    ringX  =lerp(ringX,  targetX,0.10);
    ringY  =lerp(ringY,  targetY,0.10);

    cursor.style.left   = `${cursorX}px`;
    cursor.style.top    = `${cursorY}px`;
    cursorRing.style.left = `${ringX}px`;
    cursorRing.style.top  = `${ringY}px`;

    // Hover detection
    const els = document.elementsFromPoint(cursorX, cursorY);
    const HOVER_SEL = '.option-btn,#next-to-puzzle,#start-puzzle-btn,#next-to-story,#start-freeplay-btn,#opening-start-btn,#allow-camera-btn,#volume-btn,#start-freeplay-btn';
    const hit = els.find(el => el.matches && el.matches(HOVER_SEL));

    if (hit !== lastHoveredEl) {
        if (hit) playHover();
        lastHoveredEl = hit;
    }

    document.querySelectorAll(
        '.option-btn,#next-to-puzzle,#start-puzzle-btn,#next-to-story,#start-freeplay-btn,#opening-start-btn,#allow-camera-btn,#volume-btn'
    ).forEach(btn => {
        btn.classList.toggle('hovered', btn === hit);
    });

    // Ring size on hover
    if (hit) {
        cursorRing.classList.add('hovering');
    } else {
        cursorRing.classList.remove('hovering');
    }

    requestAnimationFrame(updateCursor);
}

updateCursor();

// ─── MOUSE FALLBACK (for development) ────────────────
document.addEventListener('mousemove', e => {
    targetX = e.clientX; targetY = e.clientY;
});

document.addEventListener('mousedown', () => {
    cursor.classList.add('clicking'); cursorRing.classList.add('clicking');
    playClick(); spawnRipple(cursorX, cursorY);
});

document.addEventListener('mouseup', () => {
    cursor.classList.remove('clicking'); cursorRing.classList.remove('clicking');
});

// ─── KEYBOARD SHORTCUTS ──────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
        if (isStoryActive && canManualNext) { nextStoryLine(); return; }
        const hovered = document.querySelector('.hovered');
        if (hovered) hovered.click();
    }
    if (e.key === 'm' || e.key === 'M') {
        document.getElementById('volume-btn').click();
    }
});