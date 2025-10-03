// main.js (global script)
// relies on window.Storage, window.initController, window._physics, and window.initGame being available

// initialize physics with current canvas size
function setupPhysics(){
  const canvas = document.getElementById('game');
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  // load gravity tuning from settings before initializing physics
  const minG = (window.Storage && window.Storage.getSetting) ? window.Storage.getSetting('minGravityMult') : null;
  const globalG = (window.Storage && window.Storage.getSetting) ? window.Storage.getSetting('gravityGlobalMult') : null;
  if(window._physics && typeof window._physics.setPhysicsScale === 'function') window._physics.setPhysicsScale(h);
  // set values (use exposed setters)
  if(typeof minG === 'number' && window._physics && window._physics.setMinGravityMult) window._physics.setMinGravityMult(minG);
  if(typeof globalG === 'number' && window._physics && window._physics.setGravityGlobalMult) window._physics.setGravityGlobalMult(globalG);
  if(window._physics && typeof window._physics.initPhysics === 'function') window._physics.initPhysics(w,h);
}

// apply settings live when config saves
window.addEventListener('billboards-changed', ()=>{ /* nothing for physics */ });
window.addEventListener('background-changed', ()=>{ /* nothing for physics */ });

// game configuration changes should be applied live
window.addEventListener('game-config-saved', ()=>{
  // read settings and apply to physics and other runtime params
  const jumpH = (window.Storage && window.Storage.getSetting) ? window.Storage.getSetting('jumpHeight') : 120;
  const widthScale = (window.Storage && window.Storage.getSetting) ? window.Storage.getSetting('widthScale') : false;
  // apply physics settings
  const canvas = document.getElementById('game');
  const h = (canvas && (canvas.clientHeight || canvas.height)) || window.innerHeight;
  if(window._physics && typeof window._physics.setPhysicsScale === 'function') window._physics.setPhysicsScale(h);
  // apply gravity sliders
  const minG2 = (window.Storage && window.Storage.getSetting) ? window.Storage.getSetting('minGravityMult') : null;
  const globalG2 = (window.Storage && window.Storage.getSetting) ? window.Storage.getSetting('gravityGlobalMult') : null;
  if(typeof minG2 === 'number' && window._physics && window._physics.setMinGravityMult) window._physics.setMinGravityMult(minG2);
  if(typeof globalG2 === 'number' && window._physics && window._physics.setGravityGlobalMult) window._physics.setGravityGlobalMult(globalG2);
  // expose jumpHeight available to legacy jump by storing on window
  window._cfg_jumpHeight = jumpH;
  // show/hide debug box according to saved setting
  const showDbg = (window.Storage && window.Storage.getSetting) ? window.Storage.getSetting('showPhysics') : false;
  const dbgBox = document.getElementById('debug-box');
  if(dbgBox){ if(showDbg) { dbgBox.style.display='block'; dbgBox.setAttribute('aria-hidden','false'); } else { dbgBox.style.display='none'; dbgBox.setAttribute('aria-hidden','true'); } }
});

// initial setup
setupPhysics();
window.addEventListener('resize', ()=>{ setupPhysics(); });

// initialize debug box visibility from settings
const dbgBoxInit = document.getElementById('debug-box');
if(dbgBoxInit){ const showDbgInit = (window.Storage && window.Storage.getSetting) ? window.Storage.getSetting('showPhysics') : false; if(showDbgInit){ dbgBoxInit.style.display='block'; dbgBoxInit.setAttribute('aria-hidden','false'); } else { dbgBoxInit.style.display='none'; dbgBoxInit.setAttribute('aria-hidden','true'); } }
// wire close button
const dbgCloseBtn = document.getElementById('dbg-close');
if(dbgCloseBtn){ dbgCloseBtn.addEventListener('click', ()=>{ const box = document.getElementById('debug-box'); if(box){ box.style.display='none'; box.setAttribute('aria-hidden','true'); if(window.Storage) window.Storage.setSetting('showPhysics', false); } }); }

// expose physics functions to legacy consumers for minimal changes (window._physics should already be present)

// expose a window.jump wrapper for legacy code to call (game.js will also wrap to cap height)
window.jump = function(){ const desired = parseInt((window.Storage && window.Storage.getSetting ? window.Storage.getSetting('jumpHeight') : window._cfg_jumpHeight) || window._cfg_jumpHeight || 120, 10); if(window._physics && typeof window._physics.jump === 'function') window._physics.jump(desired); };

// initialize controller
if(window.initController) window.initController();

console.log('main script loaded');
// start the game (initGame should be defined by game.js)
if(window.initGame) window.initGame();
