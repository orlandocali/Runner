// config.js (global script) - handles config UI and billboard uploads
document.addEventListener('DOMContentLoaded', ()=>{
  const configBtn = document.getElementById('config-btn');
  const configPanel = document.getElementById('config-panel');
  const closeConfig = document.getElementById('close-config');
  const gameConfigBtn = document.getElementById('game-config-btn');
  const gamePanel = document.getElementById('game-panel');
  const closeGameConfig = document.getElementById('close-game-config');
  const saveBtn = document.getElementById('save-config');
  const resetBtn = document.getElementById('reset-config');
  const leftInput = document.getElementById('billboard-left');
  const centerInput = document.getElementById('billboard-center');
  const rightInput = document.getElementById('billboard-right');
  const bgInput = document.getElementById('background-image');
  const previewLeft = document.getElementById('preview-left');
  const previewCenter = document.getElementById('preview-center');
  const previewRight = document.getElementById('preview-right');
  const previewBg = document.getElementById('preview-bg');
  const bbOffset = document.getElementById('setting-bb-offset');
  const obsSpeed = document.getElementById('setting-obs-speed');
  const obsSpacing = document.getElementById('setting-obs-spacing');
  const widthScale = document.getElementById('setting-width-scale');
  const jumpHeight = document.getElementById('setting-jump-height');
  const minGrav = document.getElementById('setting-min-grav');
  const gravGlobal = document.getElementById('setting-grav-global');
  const pwModal = document.getElementById('pw-modal');
  const pwInput = document.getElementById('pw-input');
  const pwOk = document.getElementById('pw-ok');
  const pwCancel = document.getElementById('pw-cancel');
  const pwClose = document.getElementById('close-pw');

  // helper: arraybuffer to base64
  function ab2b64(buf){ const bytes = new Uint8Array(buf); let bin=''; for(let i=0;i<bytes.length;i++){ bin += String.fromCharCode(bytes[i]); } return btoa(bin); }
  function genSalt(){ const s = new Uint8Array(16); crypto.getRandomValues(s); return ab2b64(s.buffer); }
  async function hashSalted(pw, saltB64){ const enc = new TextEncoder(); const salt = atob(saltB64); const saltBytes = new Uint8Array([...salt].map(c=>c.charCodeAt(0))); const data = new Uint8Array(saltBytes.length + pw.length); data.set(saltBytes,0); data.set(enc.encode(pw), saltBytes.length); const digest = await crypto.subtle.digest('SHA-256', data); return ab2b64(digest); }

  // pw modal state
  let _pwCallback = null; // function to call after successful set/verify
  let _pwMode = 'verify'; // or 'set'
  function showPwModal(mode, cb){ _pwMode = mode; _pwCallback = cb; if(pwModal){ pwInput.value=''; pwModal.classList.add('is-active'); const title = pwModal.querySelector('.modal-card-title'); if(title) title.textContent = (mode==='set') ? 'Set admin password' : 'Enter password'; setTimeout(()=>pwInput.focus(),150); } }
  function hidePwModal(){ if(pwModal) pwModal.classList.remove('is-active'); _pwCallback = null; }

  // Expose auth helper for other modules (attach to window for compatibility)
  async function requireAdminAuth(onSuccess){
    const storedHash = localStorage.getItem('runner:auth:hash');
    const storedSalt = localStorage.getItem('runner:auth:salt');
    if(!storedHash || !storedSalt){
      // first-run: set password
      showPwModal('set', async ()=>{
        const pw = pwInput.value || '';
        if(!pw){ alert('Password cannot be empty'); return; }
        const salt = genSalt();
        const h = await hashSalted(pw, salt);
        localStorage.setItem('runner:auth:salt', salt);
        localStorage.setItem('runner:auth:hash', h);
        hidePwModal();
        onSuccess();
      });
    } else {
      // verify
      showPwModal('verify', async ()=>{
        const pw = pwInput.value || '';
        const h = await hashSalted(pw, storedSalt);
        if(h === storedHash){ hidePwModal(); onSuccess(); }
        else { alert('Incorrect password'); }
      });
    }
  }
  window.requireAdminAuth = requireAdminAuth;

  // modal button handlers
  if(pwOk) pwOk.addEventListener('click', async ()=>{ if(_pwCallback) await _pwCallback(); });
  if(pwCancel) pwCancel.addEventListener('click', ()=>{ hidePwModal(); });
  if(pwClose) pwClose.addEventListener('click', ()=>{ hidePwModal(); });

  function loadPreviews(){
    const l = window.Storage.getBillboard('left');
    const c = window.Storage.getBillboard('center');
    const r = window.Storage.getBillboard('right');
    const b = window.Storage.getBackground();
    previewLeft.src = l || '';
    if(previewCenter) previewCenter.src = c || '';
    previewRight.src = r || '';
    if(previewBg) previewBg.src = b || '';
    // load saved settings
  const savedBb = window.Storage.getSetting('billboardOffset') || 80;
  const savedObs = window.Storage.getSetting('obstacleSpeed') || 160;
  const savedSpacing = window.Storage.getSetting('obstacleSpacing');
  const savedWidth = window.Storage.getSetting('widthScale') || false;
  const savedJump = window.Storage.getSetting('jumpHeight') || 120;
  const savedMinGrav = window.Storage.getSetting('minGravityMult') || 0.45;
  const savedGravGlobal = window.Storage.getSetting('gravityGlobalMult') || 1;
  const savedShowPhysics = window.Storage.getSetting('showPhysics') || false;
  if(bbOffset) bbOffset.value = savedBb;
  if(obsSpeed) obsSpeed.value = savedObs;
  if(obsSpacing) obsSpacing.value = (typeof savedSpacing === 'number') ? savedSpacing : 50;
  if(widthScale) widthScale.checked = savedWidth;
  if(jumpHeight) jumpHeight.value = savedJump;
  if(minGrav) minGrav.value = savedMinGrav;
  if(gravGlobal) gravGlobal.value = savedGravGlobal;
  if(document.getElementById('setting-show-physics')) document.getElementById('setting-show-physics').checked = !!savedShowPhysics;
  }
  loadPreviews();

  configBtn.addEventListener('click', ()=>{
    if(window.requireAdminAuth){ window.requireAdminAuth(()=>{ configPanel.classList.add('is-active'); loadPreviews(); }); }
    else { configPanel.classList.add('is-active'); loadPreviews(); }
  });
  closeConfig.addEventListener('click', ()=>{ configPanel.classList.remove('is-active') });

  // game config actions (password-protected)
  gameConfigBtn.addEventListener('click', ()=>{
    if(window.requireAdminAuth){ window.requireAdminAuth(()=>{ gamePanel.classList.add('is-active'); loadPreviews(); }); }
    else { gamePanel.classList.add('is-active'); loadPreviews(); }
  });
  closeGameConfig.addEventListener('click', ()=>{ gamePanel.classList.remove('is-active') });

  function readFileAsDataURL(file, cb){ const fr = new FileReader(); fr.onload = e=>cb(e.target.result); fr.readAsDataURL(file); }

  leftInput.addEventListener('change', e=>{ const f=e.target.files[0]; if(f) readFileAsDataURL(f, data=>previewLeft.src=data); });
  if(centerInput) centerInput.addEventListener('change', e=>{ const f=e.target.files[0]; if(f) readFileAsDataURL(f, data=>previewCenter.src=data); });
  rightInput.addEventListener('change', e=>{ const f=e.target.files[0]; if(f) readFileAsDataURL(f, data=>previewRight.src=data); });
  if(bgInput) bgInput.addEventListener('change', e=>{ const f=e.target.files[0]; if(f) readFileAsDataURL(f, data=>previewBg.src=data); });

  saveBtn.addEventListener('click', ()=>{
  Storage.setBillboard('left', previewLeft.src || null);
  if(previewCenter) Storage.setBillboard('center', previewCenter.src || null);
  Storage.setBillboard('right', previewRight.src || null);
    if(previewBg) Storage.setBackground(previewBg.src || null);
    // save settings
    Storage.setSetting('billboardOffset', parseInt(bbOffset.value,10));
    // graphic-only saves
    // notify game and reload to apply changes
    Storage.setSetting('obstacleSpeed', parseInt(obsSpeed.value,10));
    Storage.setSetting('obstacleSpacing', parseInt(obsSpacing.value,10));
    Storage.setSetting('widthScale', !!widthScale.checked);
  // notify game and reload to apply changes
  const ev = new Event('billboards-changed'); window.dispatchEvent(ev);
  window.dispatchEvent(new Event('background-changed'));
  // brief feedback then reload so everything is reset with new settings
  alert('Settings saved — reloading page to apply changes');
  configPanel.classList.remove('is-active');
  setTimeout(()=>{ window.location.reload(); }, 200);
  });

  // game config saves (jump height, spacing, speed, width-scale)
  const saveGameBtn = document.getElementById('save-game-config');
  const resetGameBtn = document.getElementById('reset-game-config');
  if(saveGameBtn){ saveGameBtn.addEventListener('click', ()=>{
  Storage.setSetting('obstacleSpeed', parseInt(obsSpeed.value,10));
  Storage.setSetting('obstacleSpacing', parseInt(obsSpacing.value,10));
  Storage.setSetting('widthScale', !!widthScale.checked);
  Storage.setSetting('jumpHeight', parseInt(jumpHeight.value,10));
  Storage.setSetting('minGravityMult', parseFloat(minGrav.value));
  Storage.setSetting('gravityGlobalMult', parseFloat(gravGlobal.value));
  const showPhysics = (document.getElementById('setting-show-physics') || {}).checked;
  Storage.setSetting('showPhysics', !!showPhysics);
    gamePanel.classList.remove('is-active');
    // notify runtime to apply changes live
    window.dispatchEvent(new Event('game-config-saved'));
    // brief feedback
    alert('Game settings saved');
  }); }
  if(resetGameBtn){ resetGameBtn.addEventListener('click', ()=>{
    if(confirm('Reset game settings to defaults?')){
      Storage.setSetting('obstacleSpeed', 160);
      Storage.setSetting('obstacleSpacing', 50);
      Storage.setSetting('widthScale', false);
      Storage.setSetting('jumpHeight', 120);
  // gravity setting removed from UI; nothing to reset here
      loadPreviews();
      gamePanel.classList.remove('is-active');
      alert('Game settings reset');
      window.dispatchEvent(new Event('game-config-saved'));
    }
  }); }

  resetBtn.addEventListener('click', ()=>{
    if(confirm('Reset billboards to default?')){
  Storage.setBillboard('left', null);
  Storage.setBillboard('center', null);
  Storage.setBillboard('right', null);
  if(previewBg) Storage.setBackground(null);
      loadPreviews();
      window.dispatchEvent(new Event('billboards-changed'));
      window.dispatchEvent(new Event('background-changed'));
      configPanel.classList.remove('is-active');
    }
  });
});
