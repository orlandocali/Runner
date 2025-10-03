import { Storage } from './storage.js';
import * as physics from './physics.js';
import { initController, Keys } from './controller.js';

// Simple runner game using canvas. Saves highscores and supports custom billboards via Storage helpers.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let width = canvas.clientWidth || window.innerWidth;
let height = canvas.clientHeight || window.innerHeight;

// UI elements
const scoreEl = document.getElementById('score');
const distEl = document.getElementById('distance');
const jumpBtn = document.getElementById('jump-btn');
const scoresBtn = document.getElementById('scores-btn');
const scoresPanel = document.getElementById('scores-panel');
const scoresList = document.getElementById('scores-list');
const closeScores = document.getElementById('close-scores');
const clearScores = document.getElementById('clear-scores');
const gameOverPanel = document.getElementById('game-over');
const finalScore = document.getElementById('final-score');
const saveNameInput = document.getElementById('save-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const startBtn = document.getElementById('start-btn');
// scores table controls
const scoresTbody = document.getElementById('scores-tbody');
const scoresFind = document.getElementById('scores-find');
const scoresFindBtn = document.getElementById('scores-find-btn');
const scoresPrev = document.getElementById('scores-prev');
const scoresNext = document.getElementById('scores-next');
const sortNameBtn = document.getElementById('sort-name');
const sortPointsBtn = document.getElementById('sort-points');
const sortDistanceBtn = document.getElementById('sort-distance');

let scoresPageSize = 6;
let scoresPage = 0;
let scoresListCached = [];
let scoresSort = { key: 'score', dir: 1 }; // default: points desc then distance desc

// use shared Keys object from controller.js
const keys = window.Keys || {};
let running = false;
let score = 0;
let distance = 0;
// physics state is in physics.js; use window.player and window.groundY
let player = window.player || { x:120, y: Math.round(height * 0.72) - 64, w:44, h:64, vy:0, onGround:true };
let groundY = window.groundY || Math.round(height * 0.72);
// tuned physics: lower gravity for longer airtime but small initial impulse so peak stays below billboards
let obstacles = [];
let coins = [];
let lastSpawn = 0;
let startTime = 0;
let billboardLeft = null, billboardCenter = null, billboardRight = null;
let backgroundImg = null;
// user-configurable settings (defaults)
let cfgBillboardOffset = Storage.getSetting('billboardOffset') || 80; // px from top
let cfgObstacleSpeed = Storage.getSetting('obstacleSpeed') || 160; // px/sec
let cfgWidthScale = Storage.getSetting('widthScale') || false; // bool: scale physics by width instead of height

function resizeCanvas(){
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  // set internal resolution for crispness
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  width = w; height = h;
  // notify physics module about resize so it can recalc scales
  if(window.resizePhysics) window.resizePhysics(w, h);
  // refresh local references
  player = window.player || player;
  groundY = window.groundY || Math.round(height * 0.72);
  // reload settings in case they changed via config modal
  cfgBillboardOffset = Storage.getSetting('billboardOffset') || cfgBillboardOffset;
  cfgObstacleSpeed = Storage.getSetting('obstacleSpeed') || cfgObstacleSpeed;
  cfgWidthScale = Storage.getSetting('widthScale') || cfgWidthScale;
  // ensure billboards remain visible and do not overlap player area: store computed billboard Y in window
  const bbW = Math.max(160, Math.round(width * 0.19));
  const bbH = Math.max(80, Math.round(height * 0.17));
  const margin = (width - (bbW * 3)) / 4;
  const defaultBbY = Math.max(8, Math.min(Math.round(height * 0.3), cfgBillboardOffset));
  // compute a max billboard Y that still allows a reasonable jump height
  const safety = 20; // pixels between jumper peak and billboard bottom used elsewhere (increased for safety)
  // minimum allowed jump we want to guarantee (px) -- scale with viewport but keep a baseline
  const minAllowedJump = Math.max(110, Math.round(height * 0.16));
  // billboardBottom must be <= groundY - player.h - safety - minAllowedJump
  const maxBbY = Math.max(8, Math.round((groundY - player.h - safety - minAllowedJump) - bbH));
  let finalBbY = Math.min(defaultBbY, maxBbY);
  // ensure billboards are below the top overlay (menu/buttons)
  try{
    const topOverlay = document.getElementById('top-overlay');
    const wrapRect = document.getElementById('game-wrap').getBoundingClientRect();
    if(topOverlay && wrapRect){
      const topRect = topOverlay.getBoundingClientRect();
      const minY = Math.max(8, Math.round(topRect.bottom - wrapRect.top + 6));
      finalBbY = Math.max(finalBbY, minY);
    }
  }catch(e){ /* ignore */ }
  window._billboardY = finalBbY;
}
window.addEventListener('resize', resizeCanvas);

// Defensive fallbacks: if physics.js didn't load for any reason, provide minimal implementations
if(!window.applyPhysics){
  window.applyPhysics = function(dt){
    try{
      const p = window.player || player;
      const gscale = window.physicsScale || (height / 720);
      const gravityLocal = 0.12 * gscale;
      p.vy += gravityLocal * (dt / 16);
      p.y += p.vy * (dt / 16);
      const gy = window.groundY || groundY;
      if(p.y >= gy - p.h){ p.y = gy - p.h; p.vy = 0; p.onGround = true; }
      window.player = p;
    }catch(e){ console.error('fallback applyPhysics error', e); }
  };
}
if(!window.jump){
  window.jump = function(){
    const p = window.player || player;
    if(p.onGround){ p.vy = -6.0 * (window.physicsScale || (width/1280)); p.onGround = false; }
    window.player = p;
  };
}
if(!window.rectOverlap){
  window.rectOverlap = function(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; };
}
if(!window.circleRectOverlap){
  window.circleRectOverlap = function(circle, rect){ const cx = circle.x; const cy = circle.y; const rx = rect.x; const ry = rect.y; const rw = rect.w; const rh = rect.h; const closestX = Math.max(rx, Math.min(cx, rx+rw)); const closestY = Math.max(ry, Math.min(cy, ry+rh)); const dx = cx-closestX; const dy = cy-closestY; return (dx*dx+dy*dy) < (circle.r*circle.r); };
}

// load billboards images
function loadBillboards(){
  const l = Storage.getBillboard('left');
  const c = Storage.getBillboard('center');
  const r = Storage.getBillboard('right');
  const b = Storage.getBackground();
  billboardLeft = new Image(); billboardCenter = new Image(); billboardRight = new Image();
  if(l){ billboardLeft.src = l; } else { billboardLeft = null; }
  if(c){ billboardCenter.src = c; } else { billboardCenter = null; }
  if(r){ billboardRight.src = r; } else { billboardRight = null; }
  if(b){ backgroundImg = new Image(); backgroundImg.src = b; } else { backgroundImg = null; }
}
loadBillboards();
window.addEventListener('billboards-changed', ()=>{ loadBillboards(); });
window.addEventListener('background-changed', ()=>{ loadBillboards(); });

// simple login
// no login; saveNameInput will be empty by default
saveNameInput.value = '';

// controller.js will install event listeners; initialize it after canvas is ready

function startGame(){ running = true; score=0; distance=0; obstacles=[]; coins=[]; lastSpawn=0; startTime = performance.now(); gameOverPanel.classList.add('hidden');
  player.x = Math.round(width * 0.09);
  player.y = groundY - player.h;
  // update Start button to show Restart while running
  if(startBtn) startBtn.textContent = 'Restart';
}

startBtn.addEventListener('click', ()=>{ if(!running) startGame(); else { /* if running, restart */ startGame(); } });
if(jumpBtn) jumpBtn.addEventListener('click', ()=>{ jump(); });

// delegate jump to physics module, using configured jump height
function jump(){
  const phys = window._physics;
  // read desired jump height from settings; we'll scale it by viewport so small screens are not underpowered
  let desired = parseInt(Storage.getSetting('jumpHeight') || window._cfg_jumpHeight || 120, 10);
  // compute the same physics scale used by physics module: height/720 (or width-based if enabled)
  const physScale = (cfgWidthScale ? (width / 720) : (height / 720));
  // If the physics scale is smaller than 1 (smaller viewport), increase desired jump height by 1/physScale
  // so initial velocity sqrt(2*g*h) remains consistent across sizes (v0 = sqrt(2 * (g0*physScale) * (h*(1/physScale))) => same)
  if(physScale > 0 && physScale < 1){ desired = Math.round(desired / physScale); }
  // cap desired to not reach billboard bottom; i.e., max jump peak should be below billboard top
  const bbY = (window._billboardY !== undefined) ? window._billboardY : Math.round(height * 0.3);
  const bbH = Math.max(80, Math.round(height * 0.17));
  const billboardBottom = bbY + bbH;
  const safety = 12; // pixels between jumper peak and billboard bottom
  // allowed jump height must satisfy: peakY = groundY - player.h - h <= billboardBottom - safety
  // rearranged: h <= (groundY - player.h) - (billboardBottom + safety)
  const allowed = Math.max(8, (groundY - player.h) - (billboardBottom + safety));
  if(desired > allowed) desired = allowed;
  if(phys && phys.jump) phys.jump(desired);
  else if(window.jump) window.jump();
}

// expose a stable game-level jump handler that enforces caps and is usable by controller
window.performJump = function(){ jump(); };

function spawnObstacle(now){
  // obstacle spacing control (percentage): lower -> easier -> larger spacing
  const spacingPct = Storage.getSetting('obstacleSpacing');
  const pct = (typeof spacingPct === 'number') ? spacingPct : 50;
  // map pct(0..100) -> minIntervalMs roughly 2400..600 (lower pct => larger interval)
  const minIntervalMs = 600 + (100 - pct) * 18; // 600..2400
  if(now - lastSpawn < minIntervalMs) return;
  lastSpawn = now + Math.random()*Math.max(200, minIntervalMs * 0.4) - 200;
  const type = Math.random()<0.7? 'rock' : 'box';
  const x = width + Math.max(160, Math.round(width * 0.18));
  const obsY = groundY - 28; // sit on ground
  // keep obstacle sizes roughly consistent but avoid scaling speed with width
  const scale = Math.max(1, width / 1280);
  if(type==='rock') obstacles.push({x, y:obsY, w:48*scale, h:36*scale, type}); else obstacles.push({x, y:obsY, w:52*scale, h:52*scale, type});
  if(Math.random()<0.45){ coins.push({x:x+140, y:player.y + player.h - 36, r:12, collected:false}); }
}

function update(dt){ if(!running) return; // physics
  // apply physics integration from physics module (dt in ms -> seconds)
  const phys = window._physics;
  if(phys && phys.applyPhysics){ phys.applyPhysics(dt/1000); }
  // refresh local refs from physics module if present
  if(phys && phys.getPlayer) player = phys.getPlayer();
  if(phys && phys.getGroundY) groundY = phys.getGroundY();
  // move obstacles — use configured base speed, with a small ramp by distance
  const baseSpeed = cfgObstacleSpeed || 160;
  const ramp = 1 + Math.min(1.2, distance / 2000); // up to ~2.2x over long play
  const speed = Math.round(baseSpeed * ramp);
  for(let o of obstacles){ o.x -= speed * dt/1000; }
  obstacles = obstacles.filter(o=>o.x+o.w > -50);
  for(let c of coins){ c.x -= speed * dt/1000; }
  coins = coins.filter(c=>c.x > -50 && !c.collected);
  // collisions
  for(let i=0;i<obstacles.length;i++){ const o=obstacles[i]; const overl = (window.rectOverlap ? window.rectOverlap(player,o) : rectOverlap(player,o)); if(overl){ gameOver(); return; } }
 for(let c of coins){ const coll = (window.circleRectOverlap ? window.circleRectOverlap(c, player) : circleRectOverlap(c, player)); if(coll){ score += 100; c.collected=true; } }
  // update score/distance
  const elapsed = performance.now() - startTime; distance = Math.floor(elapsed/100); scoreEl.textContent = score; distEl.textContent = distance;
    // position debug box so it sits directly above the Start button (centered)
    try{
      const dbg = document.getElementById('debug-box');
      const controls = document.getElementById('bottom-controls');
      const wrap = document.getElementById('game-wrap');
      if(dbg && controls && wrap && dbg.style.display !== 'none'){
        const wrapRect = wrap.getBoundingClientRect();
        const ctrlRect = controls.getBoundingClientRect();
        // center debug box over the controls center
        const leftLocal = Math.round(ctrlRect.left - wrapRect.left + (ctrlRect.width/2) - (dbg.offsetWidth/2));
        const dbgH = dbg.offsetHeight || 140;
        let topLocal = Math.round(ctrlRect.top - wrapRect.top - dbgH - 8);
        if(topLocal < 6) topLocal = 6;
        dbg.style.left = leftLocal + 'px';
        dbg.style.top = topLocal + 'px';
        dbg.style.bottom = 'auto';
        dbg.style.transform = 'none';
      }
    }catch(e){ /* ignore */ }
  // occasionally spawn
  spawnObstacle(performance.now());
}


function gameOver(){ running=false; finalScore.textContent = score; // show Bulma modal
  gameOverPanel.classList.add('is-active'); saveNameInput.value = '';
    if(startBtn) startBtn.textContent = 'Start';
}

saveScoreBtn.addEventListener('click', ()=>{
  const name = (saveNameInput.value||'Anonymous').trim();
  const entry = { name, score, distance, when: new Date().toISOString() };
  Storage.saveHighScore(entry);
  // open scores and show the saved entry
  loadScores();
  scoresPanel.classList.add('is-active');
  // find index of the saved entry in sorted list
  // match by name+score to be tolerant about timestamps
  const idx = scoresListCached.findIndex(s => s.name===entry.name && s.score===entry.score);
  if(idx>=0){ scoresPage = Math.floor(idx / scoresPageSize); renderScoresPage(); // highlight
    // add a short highlight via DOM
    setTimeout(()=>{
      const rows = scoresTbody.querySelectorAll('tr');
      rows.forEach(r=>r.classList.remove('is-selected'));
      const localIdx = idx - scoresPage * scoresPageSize;
      const tr = scoresTbody.children[localIdx]; if(tr){ tr.classList.add('is-selected'); tr.classList.add('highlight');
        // remove highlight after animation duration
        setTimeout(()=>{ tr.classList.remove('highlight'); }, 2600);
      }
    },50);
  }
  gameOverPanel.classList.remove('is-active');
});

// close Game Over modal
const closeGameover = document.getElementById('close-gameover');
if(closeGameover) closeGameover.addEventListener('click', ()=>{ gameOverPanel.classList.remove('is-active'); });

// scores panel
scoresBtn.addEventListener('click', ()=>{ loadScores(); scoresPanel.classList.add('is-active'); });
closeScores.addEventListener('click', ()=>{ scoresPanel.classList.remove('is-active'); });
clearScores.addEventListener('click', ()=>{
  // require admin auth before clearing
  if(window.requireAdminAuth){ window.requireAdminAuth(()=>{ if(confirm('Clear all saved high scores?')){ Storage.clearHighScores(); loadScores(); } }); }
  else { if(confirm('Clear all saved high scores?')){ Storage.clearHighScores(); loadScores(); } }
});

function loadScores(){
  scoresListCached = Storage.getHighScores();
  // default sort already enforced by storage; apply any additional sorting
  // show top 10 in the table
  scoresPageSize = 10;
  applySort();
  scoresPage = 0;
  renderScoresPage();
}

function applySort(){
  if(!scoresListCached) scoresListCached = [];
  const key = scoresSort.key;
  const dir = scoresSort.dir;
  scoresListCached.sort((a,b)=>{
    if(key === 'name') return dir * a.name.localeCompare(b.name);
    if(key === 'score'){
      if(b.score !== a.score) return dir * (b.score - a.score);
      return dir * ((b.distance||0) - (a.distance||0));
    }
    if(key === 'distance'){
      if((b.distance||0) !== (a.distance||0)) return dir * ((b.distance||0) - (a.distance||0));
      return dir * (b.score - a.score);
    }
    return 0;
  });
}

function renderScoresPage(){
  const list = scoresListCached || [];
  const start = scoresPage * scoresPageSize;
  const pageItems = list.slice(start, start + scoresPageSize);
  scoresTbody.innerHTML = '';
  // canonical ranking (points desc, distance desc)
  const canonical = Storage.getHighScores();
  for(let i=0;i<pageItems.length;i++){
    const s = pageItems[i];
    const tr = document.createElement('tr');
    const posTd = document.createElement('td');
    // find canonical position (1-based)
    const canonIdx = canonical.findIndex(c => c.name===s.name && c.score===s.score && c.when===s.when);
    posTd.textContent = (canonIdx>=0) ? (canonIdx + 1) : (start + i + 1);
    const nameTd = document.createElement('td'); nameTd.textContent = s.name;
    const ptsTd = document.createElement('td'); ptsTd.textContent = s.score;
    const distTd = document.createElement('td'); distTd.textContent = s.distance || 0;
    tr.appendChild(posTd); tr.appendChild(nameTd); tr.appendChild(ptsTd); tr.appendChild(distTd);
    scoresTbody.appendChild(tr);
  }
}

// pagination
if(scoresPrev) scoresPrev.addEventListener('click', ()=>{ if(scoresPage>0){ scoresPage--; renderScoresPage(); } });
if(scoresNext) scoresNext.addEventListener('click', ()=>{ const maxPage = Math.floor((scoresListCached.length-1)/scoresPageSize); if(scoresPage<maxPage){ scoresPage++; renderScoresPage(); } });

// sorting
if(sortNameBtn) sortNameBtn.addEventListener('click', ()=>{ scoresSort = { key:'name', dir: scoresSort.key==='name' ? -scoresSort.dir : 1 }; applySort(); renderScoresPage(); });
if(sortPointsBtn) sortPointsBtn.addEventListener('click', ()=>{ scoresSort = { key:'score', dir: scoresSort.key==='score' ? -scoresSort.dir : -1 }; applySort(); renderScoresPage(); });
if(sortDistanceBtn) sortDistanceBtn.addEventListener('click', ()=>{ scoresSort = { key:'distance', dir: scoresSort.key==='distance' ? -scoresSort.dir : -1 }; applySort(); renderScoresPage(); });

// find
if(scoresFindBtn) scoresFindBtn.addEventListener('click', ()=>{ const q = (scoresFind.value||'').toLowerCase().trim(); if(!q){ loadScores(); return; } scoresListCached = Storage.getHighScores().filter(s=>s.name && s.name.toLowerCase().includes(q)); applySort(); scoresPage=0; renderScoresPage(); });

// draw
let last = performance.now();
function loop(now){ try{ const dt = now - last; last = now; update(dt); render(); } catch(e){ console.error('Game loop error', e); } finally{ requestAnimationFrame(loop); } }
requestAnimationFrame(loop);

function render(){ // background
 ctx.clearRect(0,0,width,height);
 // background (custom or default sky)
 if(backgroundImg){ try{ ctx.drawImage(backgroundImg, 0, 0, width, height); }catch(e){ ctx.fillStyle='#cbeef2'; ctx.fillRect(0,0,width, height); } }
 else {
  // sky
  ctx.fillStyle='#cbeef2'; ctx.fillRect(0,0,width, height);
  // clouds
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(150,80,60,30,0,0,Math.PI*2); ctx.ellipse(200,80,40,22,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(600,60,70,36,0,0,Math.PI*2); ctx.fill();
 }
  // billboards (three), spaced evenly and moved slightly higher
  const bbW = Math.max(160, Math.round(width * 0.19)), bbH = Math.max(80, Math.round(height * 0.17)); const margin = (width - (bbW * 3)) / 4;
  const bx1 = margin; const bx2 = margin * 2 + bbW; const bx3 = margin * 3 + bbW * 2;
  // use configured billboard offset (px from top). Clamp to reasonable bounds and use precomputed clamped value from resize
  const bbY = (window._billboardY !== undefined) ? window._billboardY : Math.max(8, Math.min(Math.round(height * 0.3), cfgBillboardOffset));
  drawBillboard(bx1, bbY, bbW, bbH, billboardLeft);
  drawBillboard(bx2, bbY, bbW, bbH, billboardCenter);
  drawBillboard(bx3, bbY, bbW, bbH, billboardRight);
  // ground
  ctx.fillStyle='#d3e39f'; ctx.fillRect(0, groundY, width, height - groundY);
  // path
  ctx.fillStyle='#b8855a'; ctx.fillRect(0, groundY - 40, width, 40);
  // flowers (moved down a bit relative to new ground)
  // continuous left-scrolling flower pattern that repeats seamlessly
  const t = performance.now() / 1000; // seconds
  const scrollSpeed = 30; // px per second
  const spacing = Math.max(60, Math.round(width * 0.06));
  const repeatWidth = spacing * 6; // pattern repeat width (enough to cover)
  const base = (t * scrollSpeed) % repeatWidth; // continuous offset
  const fy = groundY + Math.round((height - groundY) * 0.18);
  // draw flowers across an extended range so wrapping is invisible
  for(let x = -repeatWidth; x < width + repeatWidth; x += spacing){
    const rx = x - base;
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(rx, fy, Math.max(4, Math.round(width*0.008)), 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'yellow'; ctx.beginPath(); ctx.arc(rx, fy, Math.max(2, Math.round(width*0.004)), 0, Math.PI*2); ctx.fill();
  }
  // obstacles
  for(let o of obstacles){ if(o.type==='rock'){ ctx.fillStyle='#666'; ctx.beginPath(); ctx.ellipse(o.x+o.w/2, o.y+o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2); ctx.fill(); } else { ctx.fillStyle='#b04'; ctx.fillRect(o.x,o.y,o.w,o.h); ctx.fillStyle='green'; ctx.fillRect(o.x+Math.max(6, o.w*0.15), o.y - Math.max(12, o.h*0.3), o.w - Math.max(12, o.w*0.3), Math.max(12, o.h*0.4)); } }
 // coins
 for(let c of coins){ ctx.fillStyle='gold'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle='orange'; ctx.fillText('G', c.x-4, c.y+4); }
 // player
 ctx.fillStyle='#8b2e6b'; ctx.fillRect(player.x, player.y, player.w, player.h);
 // UI overlays handled elsewhere
  // update debug box if present
  try{
    const phys = window._physics;
    const tel = (phys && phys.getTelemetry) ? phys.getTelemetry() : {};
  const dbgG = document.getElementById('dbg-g');
  const dbgY = document.getElementById('dbg-y');
  const dbgVy = document.getElementById('dbg-vy');
  if(dbgG && phys && phys.getGravityPx) dbgG.textContent = phys.getGravityPx().toFixed(0);
  if(dbgY) dbgY.textContent = (tel.y||0).toFixed(0);
  if(dbgVy) dbgVy.textContent = (tel.vy||0).toFixed(2);
    // live values from settings
  const dbgJh = document.getElementById('dbg-jh');
  const dbgOs = document.getElementById('dbg-os');
  const dbgOg = document.getElementById('dbg-og');
  // show the configured jump height; but the runtime jump may be scaled depending on viewport
  if(dbgJh) dbgJh.textContent = (Storage.getSetting('jumpHeight') || window._cfg_jumpHeight || 120);
    if(dbgOs) dbgOs.textContent = (Storage.getSetting('obstacleSpeed') || cfgObstacleSpeed);
    if(dbgOg) dbgOg.textContent = (Storage.getSetting('obstacleSpacing') || 50);
  }catch(e){ /* ignore */ }

  // setup draggable behavior once (attach to header) and restore saved position
  try{
    const dbg = document.getElementById('debug-box');
    const header = dbg ? dbg.querySelector('.dbg-header') : null;
    if(dbg){
      // restore saved position (if any)
      const savedX = parseInt(localStorage.getItem('dbg:x'));
      const savedY = parseInt(localStorage.getItem('dbg:y'));
      if(!isNaN(savedX) && !isNaN(savedY)){
        // clamp restored coords to current wrap bounds so small screens don't place it offscreen
        const wrapRect = document.getElementById('game-wrap').getBoundingClientRect();
        const maxX = Math.max(6, wrapRect.width - dbg.offsetWidth - 6);
        const maxY = Math.max(6, wrapRect.height - dbg.offsetHeight - 6);
        const nx = Math.min(maxX, Math.max(6, savedX));
        const ny = Math.min(maxY, Math.max(6, savedY));
        dbg.style.left = nx + 'px'; dbg.style.top = ny + 'px'; dbg.style.transform = 'none'; dbg.style.bottom = 'auto';
        // mark as user-positioned so auto-centering won't override
        dbg.dataset.userPos = '1';
      }
      if(header && !header.dataset.dragInit){
        header.dataset.dragInit = '1';
        let dragging = false; let startX=0, startY=0, origLeft=0, origTop=0;
        const onDown = (e) => {
          e.preventDefault();
          dragging = true;
          startX = (e.touches ? e.touches[0].clientX : e.clientX);
          startY = (e.touches ? e.touches[0].clientY : e.clientY);
          const rect = dbg.getBoundingClientRect();
          const wrapRect = document.getElementById('game-wrap').getBoundingClientRect();
          origLeft = rect.left - wrapRect.left; origTop = rect.top - wrapRect.top;
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
          document.addEventListener('touchmove', onMove, {passive:false});
          document.addEventListener('touchend', onUp);
        };
        const onMove = (e) => {
          if(!dragging) return;
          e.preventDefault();
          const mx = (e.touches ? e.touches[0].clientX : e.clientX);
          const my = (e.touches ? e.touches[0].clientY : e.clientY);
          const wrapRect = document.getElementById('game-wrap').getBoundingClientRect();
          let nx = Math.round(origLeft + (mx - startX));
          let ny = Math.round(origTop + (my - startY));
          // clamp inside wrap
          nx = Math.max(6, Math.min(nx, wrapRect.width - dbg.offsetWidth - 6));
          ny = Math.max(6, Math.min(ny, wrapRect.height - dbg.offsetHeight - 6));
          dbg.style.left = nx + 'px'; dbg.style.top = ny + 'px'; dbg.style.transform = 'none'; dbg.dataset.userPos = '1';
        };
        const onUp = (e) => {
          if(!dragging) return; dragging = false;
          document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
          document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp);
          // persist
          const wrapRect = document.getElementById('game-wrap').getBoundingClientRect();
          const rect = dbg.getBoundingClientRect();
          const leftLocal = rect.left - wrapRect.left; const topLocal = rect.top - wrapRect.top;
          localStorage.setItem('dbg:x', leftLocal); localStorage.setItem('dbg:y', topLocal);
        };
        header.addEventListener('mousedown', onDown);
        header.addEventListener('touchstart', onDown, {passive:false});
      }
    }
  }catch(e){ /* ignore */ }
}

function drawBillboard(x,y,w,h, img){
  // board
  ctx.fillStyle='rgba(255,255,255,0.96)'; ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='rgba(120,80,40,0.9)'; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h);
  if(img){ try{ ctx.drawImage(img, x+8, y+8, w-16, h-16); }catch(e){ ctx.fillStyle='#eee'; ctx.fillRect(x+8,y+8,w-16,h-16); ctx.fillStyle='#999'; ctx.fillText('Image', x+20,y+h/2); } } else {
    ctx.fillStyle='#f4a261'; ctx.fillRect(x+8,y+8,w-16,h-16);
    ctx.fillStyle='#fff'; ctx.font=Math.max(12, Math.round(w*0.06))+'px sans-serif'; ctx.fillText('Upload billboard', x+20,y + Math.round(h*0.55));
  }
}

// collision helpers for circle

// load any saved billboards initially
loadBillboards();

// load any saved billboards initially
// (coins and canvas init are performed when initGame is called)

export function initGame(){
  // initialize physics with current canvas size
  width = canvas.clientWidth || window.innerWidth;
  height = canvas.clientHeight || window.innerHeight;
  physics.initPhysics(width, height);
  // initialize canvas and scale
  resizeCanvas();
  // populate a few starting coins
  coins = [];
  for(let i=0;i<3;i++) coins.push({x:500 + i*200, y: player.y + player.h - 36, r:12, collected:false});
  // init controller input handlers
  if(initController) initController();
  // start the main loop
  let last = performance.now();
  function loop(now){ try{ const dt = now - last; last = now; update(dt); render(); } catch(e){ console.error('Game loop error', e); } finally{ requestAnimationFrame(loop); } }
  requestAnimationFrame(loop);
}
