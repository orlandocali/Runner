import { Storage } from './storage.js';
import { initController, Keys } from './controller.js';
import * as physics from './physics.js';
import './config.js';
import { initGame } from './game.js';

// expose Storage and controller to legacy code
window.Storage = Storage;
window.Keys = Keys;
window.initController = initController;

// initialize physics with current canvas size
function setupPhysics(){
  const canvas = document.getElementById('game');
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  // load gravity tuning from settings before initializing physics
  const minG = Storage.getSetting('minGravityMult');
  const globalG = Storage.getSetting('gravityGlobalMult');
  if(typeof minG === 'number') physics.setPhysicsScale(h) , physics.setPhysicsScale(h); // noop to keep signatures
  if(typeof minG === 'number') physics.setPhysicsScale(h);
  // set values (use exposed setters)
  if(typeof minG === 'number' && physics.setMinGravityMult) physics.setMinGravityMult(minG);
  if(typeof globalG === 'number' && physics.setGravityGlobalMult) physics.setGravityGlobalMult(globalG);
  physics.initPhysics(w,h);
}

// apply settings live when config saves
window.addEventListener('billboards-changed', ()=>{ /* nothing for physics */ });
window.addEventListener('background-changed', ()=>{ /* nothing for physics */ });

// game configuration changes should be applied live
window.addEventListener('game-config-saved', ()=>{
  // read settings and apply to physics and other runtime params
  const jumpH = Storage.getSetting('jumpHeight') || 120;
  const widthScale = Storage.getSetting('widthScale') || false;
  const gravityEnabled = Storage.getSetting('gravityEnabled');
  // apply physics settings
  const canvas = document.getElementById('game');
  const h = (canvas && (canvas.clientHeight || canvas.height)) || window.innerHeight;
  physics.setPhysicsScale(h);
  // apply gravity sliders
  const minG2 = Storage.getSetting('minGravityMult');
  const globalG2 = Storage.getSetting('gravityGlobalMult');
  if(typeof minG2 === 'number' && physics.setMinGravityMult) physics.setMinGravityMult(minG2);
  if(typeof globalG2 === 'number' && physics.setGravityGlobalMult) physics.setGravityGlobalMult(globalG2);
  // gravityEnabled setting removed from UI; keep current value
  // expose jumpHeight available to legacy jump by storing on window
  // set jumpHeight available to legacy jump by storing on window
  window._cfg_jumpHeight = jumpH;
  // show/hide debug box according to saved setting
  const showDbg = Storage.getSetting('showPhysics');
  const dbgBox = document.getElementById('debug-box');
  if(dbgBox){ if(showDbg) { dbgBox.style.display='block'; dbgBox.setAttribute('aria-hidden','false'); } else { dbgBox.style.display='none'; dbgBox.setAttribute('aria-hidden','true'); } }
});

// initial setup
setupPhysics();
window.addEventListener('resize', ()=>{ setupPhysics(); });

// initialize debug box visibility from settings
const dbgBoxInit = document.getElementById('debug-box');
if(dbgBoxInit){ const showDbgInit = Storage.getSetting('showPhysics'); if(showDbgInit){ dbgBoxInit.style.display='block'; dbgBoxInit.setAttribute('aria-hidden','false'); } else { dbgBoxInit.style.display='none'; dbgBoxInit.setAttribute('aria-hidden','true'); } }
// wire close button
const dbgCloseBtn = document.getElementById('dbg-close');
if(dbgCloseBtn){ dbgCloseBtn.addEventListener('click', ()=>{ const box = document.getElementById('debug-box'); if(box){ box.style.display='none'; box.setAttribute('aria-hidden','true'); Storage.setSetting('showPhysics', false); } }); }

// expose physics functions to legacy consumers for minimal changes
window._physics = physics;

// expose a window.jump wrapper for legacy code to call (game.js will also wrap to cap height)
window.jump = function(){ const desired = parseInt(Storage.getSetting('jumpHeight') || window._cfg_jumpHeight || 120, 10); if(window._physics && typeof window._physics.jump === 'function') window._physics.jump(desired); };

// initialize controller
if(window.initController) window.initController();

console.log('main module loaded');
// start the game
initGame();
