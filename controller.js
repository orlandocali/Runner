// controller.js - input handling (ES module)
export const Keys = {};

export function initController(){
  document.addEventListener('keydown', e=>{
    Keys[e.code]=true;
    // Spacebar triggers jump; prevent default to avoid page scroll
    if(e.code==='Space'){
      // ignore if focus is in an input or textarea
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if(tag.toLowerCase() !== 'input' && tag.toLowerCase() !== 'textarea'){
        e.preventDefault();
        // prefer physics module when available
        // call the game's jump handler if exposed so the cap logic is applied
        if(typeof window.performJump === 'function'){
          window.performJump();
        } else if(window._physics && typeof window._physics.jump === 'function'){
          const desired = parseInt(window.Storage.getSetting('jumpHeight') || window._cfg_jumpHeight || 120, 10);
          window._physics.jump(desired);
        } else if(typeof window.jump === 'function'){
          window.jump();
        }
      }
    }
  });
  document.addEventListener('keyup', e=>{ Keys[e.code]=false; });
}
