// Simple runner game using canvas. Saves highscores and supports custom billboards via Storage helpers.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let width = canvas.width, height = canvas.height;

// UI elements
const scoreEl = document.getElementById('score');
const distEl = document.getElementById('distance');
const startBtn = document.getElementById('start-btn');
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
const restartBtn = document.getElementById('restart-btn');
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
let scoresSort = { key: 'score', dir: -1 }; // default: points desc then distance desc

let keys = {};
let running = false;
let score = 0;
let distance = 0;
let player = { x:120, y:380, w:44, h:64, vy:0, onGround:true };
// tuned values: lower gravity and stronger jump to increase "time on air"
// tuned values: lower gravity and stronger jump to increase "time on air"
// tuned physics: lower gravity for longer airtime but small initial impulse so peak stays below billboards
let gravity = 0.12;
let obstacles = [];
let coins = [];
let lastSpawn = 0;
let startTime = 0;
let billboardLeft = null, billboardCenter = null, billboardRight = null;
let backgroundImg = null;

function resizeCanvas(){ width=canvas.width; height=canvas.height; }
window.addEventListener('resize', resizeCanvas);

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

// controls
// Space only jumps now (no restart on space)
document.addEventListener('keydown', e=>{ keys[e.code]=true; if(e.code==='Space'){ e.preventDefault(); jump(); } });
document.addEventListener('keyup', e=>{ keys[e.code]=false; });

function startGame(){ running = true; score=0; distance=0; obstacles=[]; coins=[]; lastSpawn=0; startTime = performance.now(); gameOverPanel.classList.add('hidden'); }

startBtn.addEventListener('click', ()=>{ if(!running) startGame(); });
if(jumpBtn) jumpBtn.addEventListener('click', ()=>{ jump(); });
// restart button already present in bottom-controls
if(restartBtn) restartBtn.addEventListener('click', ()=>{ startGame(); });

function jump(){
  // lower jump height while keeping airtime
  if(player.onGround){ player.vy = -6.0; player.onGround=false; }
}

function spawnObstacle(now){
  // increase minimum spawn distance to give player more reaction time early on
  if(now - lastSpawn < 1400) return;
  lastSpawn = now + Math.random()*500 - 200;
  const type = Math.random()<0.7? 'rock' : 'box';
  const x = width + 220; // spawn further off-screen
  const obsY = 420; // moved up floor reference
  if(type==='rock') obstacles.push({x, y:obsY, w:48, h:36, type}); else obstacles.push({x, y:obsY, w:52, h:52, type});
  if(Math.random()<0.45){ coins.push({x:x+140, y:player.y + player.h - 36, r:12, collected:false}); }
}

function update(dt){ if(!running) return; // physics
 player.vy += gravity; player.y += player.vy; if(player.y >= 380){ player.y=380; player.vy=0; player.onGround=true; }
 // move obstacles
 for(let o of obstacles){ o.x -= 200*dt/1000; }
 obstacles = obstacles.filter(o=>o.x+o.w> -50);
 for(let c of coins){ c.x -= 200*dt/1000; }
 coins = coins.filter(c=>c.x> -50 && !c.collected);
 // collisions
 for(let i=0;i<obstacles.length;i++){ const o=obstacles[i]; if(rectOverlap(player,o)){ gameOver(); return; } }
 for(let c of coins){ if(circleRectOverlap(c, player)){ score += 100; c.collected=true; } }
 // update score/distance
 const elapsed = performance.now() - startTime; distance = Math.floor(elapsed/100); scoreEl.textContent = score; distEl.textContent = distance;
 // occasionally spawn
 spawnObstacle(performance.now());
}

function rectOverlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
function circleRectOverlap(circle, rect){ const cx = circle.x; const cy = circle.y; const rx = rect.x; const ry = rect.y; const rw = rect.w; const rh = rect.h; const closestX = Math.max(rx, Math.min(cx, rx+rw)); const closestY = Math.max(ry, Math.min(cy, ry+rh)); const dx = cx-closestX; const dy = cy-closestY; return (dx*dx+dy*dy) < (circle.r*circle.r); }

function gameOver(){ running=false; finalScore.textContent = score; // show Bulma modal
  gameOverPanel.classList.add('is-active'); saveNameInput.value = '';
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
clearScores.addEventListener('click', ()=>{ if(confirm('Clear all saved high scores?')){ Storage.clearHighScores(); loadScores(); } });

function loadScores(){
  scoresListCached = Storage.getHighScores();
  // default sort already enforced by storage; apply any additional sorting
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
function loop(now){ const dt = now - last; last = now; update(dt); render(); requestAnimationFrame(loop); }
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
 const bbW = 260, bbH = 120; const margin = (width - (bbW * 3)) / 4;
 const bx1 = margin; const bx2 = margin * 2 + bbW; const bx3 = margin * 3 + bbW * 2;
 drawBillboard(bx1, 80, bbW, bbH, billboardLeft);
 drawBillboard(bx2, 80, bbW, bbH, billboardCenter);
 drawBillboard(bx3, 80, bbW, bbH, billboardRight);
 // ground (moved up)
 ctx.fillStyle='#d3e39f'; ctx.fillRect(0,480,width,60);
 // path
 ctx.fillStyle='#b8855a'; ctx.fillRect(0,440,width,40);
 // flowers (moved down a bit relative to new ground)
 for(let i=20;i<width;i+=80){ ctx.fillStyle='white'; ctx.beginPath(); ctx.arc((i+ (distance%40)),560,8,0,Math.PI*2); ctx.fill(); ctx.fillStyle='yellow'; ctx.beginPath(); ctx.arc(i+ (distance%40),560,4,0,Math.PI*2); ctx.fill(); }
 // obstacles
 ctx.fillStyle='#777'; for(let o of obstacles){ if(o.type==='rock'){ ctx.fillStyle='#666'; ctx.beginPath(); ctx.ellipse(o.x+o.w/2, o.y+o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2); ctx.fill(); } else { ctx.fillStyle='#b04'; ctx.fillRect(o.x,o.y,o.w,o.h); ctx.fillStyle='green'; ctx.fillRect(o.x+8,o.y-16, o.w-16,20); } }
 // coins
 for(let c of coins){ ctx.fillStyle='gold'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle='orange'; ctx.fillText('G', c.x-4, c.y+4); }
 // player
 ctx.fillStyle='#8b2e6b'; ctx.fillRect(player.x, player.y, player.w, player.h);
 // UI overlays handled elsewhere
}

function drawBillboard(x,y,w,h, img){ // post legs
 // board (no posts)
 ctx.fillStyle='#fff'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='#8b5a3a'; ctx.strokeRect(x,y,w,h);
 if(img){ try{ ctx.drawImage(img, x+8, y+8, w-16, h-16); }catch(e){ ctx.fillStyle='#eee'; ctx.fillRect(x+8,y+8,w-16,h-16); ctx.fillStyle='#999'; ctx.fillText('Image', x+20,y+h/2); } } else {
   ctx.fillStyle='#f4a261'; ctx.fillRect(x+8,y+8,w-16,h-16);
   ctx.fillStyle='#fff'; ctx.font='18px sans-serif'; ctx.fillText('Upload billboard', x+20,y+h/2);
 }
}

// collision helpers for circle

// initial spawn of some coins
for(let i=0;i<3;i++) coins.push({x:500 + i*200, y: player.y + player.h - 36, r:12, collected:false});

// load any saved billboards initially
loadBillboards();

// small helper to adapt canvas size on high-DPI displays
(function fixDPI(){ const dpr = window.devicePixelRatio || 1; const w = canvas.width; const h = canvas.height; canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; ctx.scale(dpr,dpr); })();
