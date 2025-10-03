// physics.js - ES module, uses px and seconds
const BASE_HEIGHT = 720;
let physicsScale = 1;
const MIN_PHYS_SCALE = 0.85; // don't scale physics below this to keep gameplay playable on small viewports
let gravityMultiplier = 1; // computed per-width via curve
let minGravityMult = 0.45; // configurable minimum multiplier for tiny widths
let gravityGlobalMult = 0.5; // global gravity multiplier (tweak overall hang time) - default <1 for more hang time (lower => more hang)
const GRAVITY_CURVE_EXP = 2.0; // exponent for smoother falloff curve
let gravityEnabled = true; // allow toggling gravity mapping
// gravity base in px/s^2; nominal tuning
const BASE_GRAVITY_PX = 2000; // px/s^2 baseline

// runtime state (use unique names to avoid colliding with globals in other scripts)
let physGroundY = 0;
let physPlayer = { x:120, y:0, w:44, h:64, vy:0, onGround:true };

// telemetry
const telemetry = { ax:0, ay:0, vx:0, vy:0, x:0, y:0 };

function initPhysics(widthPx, heightPx){
  physicsScale = (heightPx || BASE_HEIGHT) / BASE_HEIGHT;
  physicsScale = Math.max(MIN_PHYS_SCALE, physicsScale);
  // base ground position (fraction of height). For narrow viewports, move ground lower
  const baseGroundFrac = (widthPx && widthPx < 900) ? 0.78 : 0.72;
  physGroundY = Math.round((heightPx || BASE_HEIGHT) * baseGroundFrac);
  physPlayer.x = Math.round((widthPx || 1280) * 0.09);
  physPlayer.y = physGroundY - physPlayer.h;
  // compute gravity multiplier based on width using a smooth exponential curve
  try{
    const w = widthPx || (window && window.innerWidth) || BASE_HEIGHT;
    const t = Math.max(0, Math.min(1, w / 900));
    if(t < 1){
      // smoother falloff: min + (1-min) * t^exp
      gravityMultiplier = Math.max(minGravityMult, minGravityMult + (1 - minGravityMult) * Math.pow(t, GRAVITY_CURVE_EXP));
    } else {
      gravityMultiplier = 1;
    }
  }catch(e){ gravityMultiplier = 1; }
  telemetry.ay = getGravityPxEffective();
}

function getGravityPx(){ return gravityEnabled ? BASE_GRAVITY_PX : 0; }

// effective gravity exposed to consumers (includes gravity multiplier and global mult)
function getGravityPxEffective(){ return getGravityPx() * gravityMultiplier * gravityGlobalMult * physicsScale; }

function setMinGravityMult(v){ minGravityMult = (typeof v === 'number') ? v : minGravityMult; }
function setGravityGlobalMult(v){ gravityGlobalMult = (typeof v === 'number') ? v : gravityGlobalMult; }
function getGravityMultiplier(){ return gravityMultiplier; }

function setGravityEnabled(v){ gravityEnabled = !!v; telemetry.ay = getGravityPxEffective(); }

function setPhysicsScale(h){ physicsScale = (h || BASE_HEIGHT) / BASE_HEIGHT; physicsScale = Math.max(MIN_PHYS_SCALE, physicsScale); telemetry.ay = getGravityPxEffective(); }

function getPlayer(){ return player; }
function getPlayer(){ return physPlayer; }
function getGroundY(){ return physGroundY; }
function getTelemetry(){ return telemetry; }

// apply physics for dt seconds; uses px and px/s units
function applyPhysics(dt){
  // dt in seconds
  const g = getGravityPxEffective();
  // integrate
  physPlayer.vy += g * dt;
  physPlayer.y += physPlayer.vy * dt;
  // telemetry
  telemetry.vy = physPlayer.vy;
  telemetry.ay = g;
  telemetry.x = physPlayer.x;
  telemetry.y = physPlayer.y;
  if(physPlayer.y >= physGroundY - physPlayer.h){ physPlayer.y = physGroundY - physPlayer.h; physPlayer.vy = 0; physPlayer.onGround = true; }
}

// jump to reach desiredHeight (pixels). computes initial v0 = -sqrt(2*g*h)
function jump(desiredHeightPx){
  if(!physPlayer.onGround) return;
  const h = Math.max(8, desiredHeightPx || 120);
  const gEff = getGravityPxEffective();
  // if effective gravity is zero, use fallback small impulse
  if(gEff <= 0.0001){ player.vy = -Math.sqrt(2 * 9.8 * h) * 0.1; player.onGround = false; return; }
  const v0 = Math.sqrt(2 * gEff * h);
  physPlayer.vy = -v0;
  physPlayer.onGround = false;
}

function rectOverlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
function circleRectOverlap(circle, rect){ const cx = circle.x; const cy = circle.y; const rx = rect.x; const ry = rect.y; const rw = rect.w; const rh = rect.h; const closestX = Math.max(rx, Math.min(cx, rx+rw)); const closestY = Math.max(ry, Math.min(cy, ry+rh)); const dx = cx-closestX; const dy = cy-closestY; return (dx*dx+dy*dy) < (circle.r*circle.r); }

// attach to window for global access
window._physics = window._physics || {};
window._physics.initPhysics = initPhysics;
window._physics.getGravityPx = getGravityPx;
window._physics.getGravityPxEffective = getGravityPxEffective;
window._physics.setMinGravityMult = setMinGravityMult;
window._physics.setGravityGlobalMult = setGravityGlobalMult;
window._physics.getGravityMultiplier = getGravityMultiplier;
window._physics.setGravityEnabled = setGravityEnabled;
window._physics.setPhysicsScale = setPhysicsScale;
window._physics.getPlayer = getPlayer;
window._physics.getGroundY = getGroundY;
window._physics.getTelemetry = getTelemetry;
window._physics.applyPhysics = applyPhysics;
window._physics.jump = jump;
window._physics.rectOverlap = rectOverlap;
window._physics.circleRectOverlap = circleRectOverlap;
