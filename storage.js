// tiny storage helpers using localStorage
const Storage = {
  getBillboard(side){
    return localStorage.getItem('billboard:' + side) || null;
  },
  setBillboard(side, dataURL){
    if(dataURL) localStorage.setItem('billboard:' + side, dataURL);
    else localStorage.removeItem('billboard:' + side);
  },
  getUser(){ return localStorage.getItem('runner:user') || null; },
  setUser(name){ if(name) localStorage.setItem('runner:user', name); else localStorage.removeItem('runner:user'); },
  getHighScores(){ try{ const list = JSON.parse(localStorage.getItem('runner:highscores') || '[]'); // ensure sort: points desc then distance desc
      list.sort((a,b)=>{ if(b.score !== a.score) return b.score - a.score; return (b.distance||0) - (a.distance||0); }); return list; }catch(e){return []} },
  saveHighScore(entry){ const list = Storage.getHighScores(); list.push(entry); list.sort((a,b)=>{ if(b.score !== a.score) return b.score - a.score; return (b.distance||0) - (a.distance||0); }); localStorage.setItem('runner:highscores', JSON.stringify(list.slice(0,20))); },
  clearHighScores(){ localStorage.removeItem('runner:highscores'); }
  ,
  getBackground(){ return localStorage.getItem('background:image') || null },
  setBackground(dataURL){ if(dataURL) localStorage.setItem('background:image', dataURL); else localStorage.removeItem('background:image'); }
};
// convenience: center billboard uses key 'billboard:center'

// settings helper (JSON-serialized)
Storage.getSetting = function(key){ try{ const v = localStorage.getItem('runner:setting:' + key); return v === null ? null : JSON.parse(v); }catch(e){ return null } };
Storage.setSetting = function(key, value){ try{ if(value === null || value === undefined) localStorage.removeItem('runner:setting:' + key); else localStorage.setItem('runner:setting:' + key, JSON.stringify(value)); }catch(e){} };
