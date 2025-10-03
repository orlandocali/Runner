// physics.js - ES module, uses px and seconds
const BASE_HEIGHT = 720;
let physicsScale = 1;
const MIN_PHYS_SCALE = 0.85; // don't scale physics below this to keep gameplay playable on small viewports
let gravityMultiplier = 1; // computed per-width via curve
let minGravityMult = 0.45; // configurable minimum multiplier for tiny widths
let gravityGlobalMult = 0.6; // global gravity multiplier (tweak overall hang time) - default <1 for more hang time
const GRAVITY_CURVE_EXP = 2.0; // exponent for smoother falloff curve
let gravityEnabled = true; // allow toggling gravity mapping
// gravity base in px/s^2; nominal tuning
const BASE_GRAVITY_PX = 2000; // px/s^2 baseline

// runtime state
let groundY = 0;
let player = { x:120, y:0, w:44, h:64, vy:0, onGround:true };

// telemetry
const telemetry = { ax:0, ay:0, vx:0, vy:0, x:0, y:0 };

export function initPhysics(widthPx, heightPx){
  physicsScale = (heightPx || BASE_HEIGHT) / BASE_HEIGHT;
  physicsScale = Math.max(MIN_PHYS_SCALE, physicsScale);
  groundY = Math.round((heightPx || BASE_HEIGHT) * 0.72);
  player.x = Math.round((widthPx || 1280) * 0.09);
  player.y = groundY - player.h;
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

export function getGravityPx(){ return gravityEnabled ? BASE_GRAVITY_PX : 0; }

// effective gravity exposed to consumers (includes gravity multiplier and global mult)
export function getGravityPxEffective(){ return getGravityPx() * gravityMultiplier * gravityGlobalMult * physicsScale; }

export function setMinGravityMult(v){ minGravityMult = (typeof v === 'number') ? v : minGravityMult; }
export function setGravityGlobalMult(v){ gravityGlobalMult = (typeof v === 'number') ? v : gravityGlobalMult; }
export function getGravityMultiplier(){ return gravityMultiplier; }

export function setGravityEnabled(v){ gravityEnabled = !!v; telemetry.ay = getGravityPxEffective(); }

export function setPhysicsScale(h){ physicsScale = (h || BASE_HEIGHT) / BASE_HEIGHT; physicsScale = Math.max(MIN_PHYS_SCALE, physicsScale); telemetry.ay = getGravityPxEffective(); }

export function getPlayer(){ return player; }
export function getGroundY(){ return groundY; }
export function getTelemetry(){ return telemetry; }

// apply physics for dt seconds; uses px and px/s units
export function applyPhysics(dt){
  // dt in seconds
  const g = getGravityPxEffective();
  // integrate
  player.vy += g * dt;
  player.y += player.vy * dt;
  // telemetry
  telemetry.vy = player.vy;
  telemetry.ay = g;
  telemetry.x = player.x;
  telemetry.y = player.y;
  if(player.y >= groundY - player.h){ player.y = groundY - player.h; player.vy = 0; player.onGround = true; }
}

// jump to reach desiredHeight (pixels). computes initial v0 = -sqrt(2*g*h)
export function jump(desiredHeightPx){
  if(!player.onGround) return;
  const h = Math.max(8, desiredHeightPx || 120);
  const gEff = getGravityPxEffective();
  // if effective gravity is zero, use fallback small impulse
  if(gEff <= 0.0001){ player.vy = -Math.sqrt(2 * 9.8 * h) * 0.1; player.onGround = false; return; }
  const v0 = Math.sqrt(2 * gEff * h);
  player.vy = -v0;
  player.onGround = false;
}

export function rectOverlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
export function circleRectOverlap(circle, rect){ const cx = circle.x; const cy = circle.y; const rx = rect.x; const ry = rect.y; const rw = rect.w; const rh = rect.h; const closestX = Math.max(rx, Math.min(cx, rx+rw)); const closestY = Math.max(ry, Math.min(cy, ry+rh)); const dx = cx-closestX; const dy = cy-closestY; return (dx*dx+dy*dy) < (circle.r*circle.r); }
