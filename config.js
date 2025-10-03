// handles config UI and billboard uploads
document.addEventListener('DOMContentLoaded', ()=>{
  const configBtn = document.getElementById('config-btn');
  const configPanel = document.getElementById('config-panel');
  const closeConfig = document.getElementById('close-config');
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

  function loadPreviews(){
    const l = Storage.getBillboard('left');
    const c = Storage.getBillboard('center');
    const r = Storage.getBillboard('right');
    const b = Storage.getBackground();
    previewLeft.src = l || '';
    if(previewCenter) previewCenter.src = c || '';
    previewRight.src = r || '';
    if(previewBg) previewBg.src = b || '';
  }
  loadPreviews();

  configBtn.addEventListener('click', ()=>{ configPanel.classList.add('is-active') });
  closeConfig.addEventListener('click', ()=>{ configPanel.classList.remove('is-active') });

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
  alert('Billboard images saved locally.');
  configPanel.classList.remove('is-active');
    // notify game that images changed
    const ev = new Event('billboards-changed'); window.dispatchEvent(ev);
    window.dispatchEvent(new Event('background-changed'));
  });

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
