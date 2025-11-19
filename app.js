

const SIZE = 4;
const boardEl = document.getElementById('game-container'); 
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const btnRestart = document.getElementById('btn-restart');
const btnUndo = document.getElementById('btn-undo');
const btnLeaders = document.getElementById('btn-leaders');
const modalGameover = document.getElementById('modal-gameover');
const modalLeaders = document.getElementById('modal-leaders');
const leadersList = document.getElementById('leaders-list');
const playerName = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score');
const restartFromModal = document.getElementById('restart-from-modal');
const closeLeaders = document.getElementById('close-leaders');
const mobileControls = document.getElementById('mobile-controls');

let state = { grid: [], score: 0, over: false };
let prevState = null; // для отмены хода (сохраняем полную копию)
const STORAGE_GAME = 'lab2048_game_v1';
const STORAGE_LEADERS = 'lab2048_leaders_v1';
const STORAGE_BEST = 'lab2048_best_v1';


function posToCoord(i){ return { r: Math.floor(i / SIZE), c: i % SIZE }; }
function coordToPos(r,c){ return r * SIZE + c; }
function copyGrid(g){ return g.slice(); }
function randomInt(max){ return Math.floor(Math.random() * max); }


function getTileMetrics(){
  const cs = getComputedStyle(document.documentElement);
  const gap = parseInt(cs.getPropertyValue('--gap')) || 10;
  const sizeRaw = cs.getPropertyValue('--tile-size') || '75px';
  const size = parseInt(sizeRaw);
  return { gap, size };
}


let nextId = 1;
let tiles = []; 
let tilesMap = new Map(); 

function createTileObject(value, pos){
  const t = { id: nextId++, value, pos, mergedFrom: null };
  tiles.push(t);
  return t;
}


function createTileElement(tile, animateSpawn = true){
  const el = document.createElement('div');
  el.className = 'tile';
  el.dataset.value = String(tile.value);
  el.dataset.id = String(tile.id);
  el.style.position = 'absolute';
  el.style.width = getTileMetrics().size + 'px';
  el.style.height = getTileMetrics().size + 'px';
  el.style.transition = 'transform 0.18s ease';
  const inner = document.createElement('div');
  inner.className = 'tile-inner';
  inner.textContent = tile.value;
  el.appendChild(inner);


  boardEl.appendChild(el);
  tilesMap.set(tile.id, el);

 
  const { x, y } = tilePositionXY(tile.pos);
  if (animateSpawn){
    
    el.style.transform = `translate(${x}px,${y}px) scale(0)`;
    requestAnimationFrame(()=> el.style.transform = `translate(${x}px,${y}px) scale(1)`);
  } else {
    el.style.transform = `translate(${x}px,${y}px)`;
  }
}


function tilePositionXY(posIndex){
  const { gap, size } = getTileMetrics();
  const { r, c } = posToCoord(posIndex);
  const x = c * (size + gap);
  const y = r * (size + gap);
  return { x, y };
}


function updateTileElement(tile, animate = true){
  const el = tilesMap.get(tile.id);
  if (!el) return;
  el.dataset.value = String(tile.value);
  const inner = el.querySelector('.tile-inner');
  if (inner) inner.textContent = tile.value;

  const { x, y } = tilePositionXY(tile.pos);
  if (animate){
    
    requestAnimationFrame(()=> el.style.transform = `translate(${x}px,${y}px)`);
  } else {
    el.style.transition = 'none';
    el.style.transform = `translate(${x}px,${y}px)`;
    
    void el.offsetWidth;
    el.style.transition = 'transform 0.18s ease';
  }
}


function removeTileElement(tile){
  const el = tilesMap.get(tile.id);
  if (!el) return;
  el.remove();
  tilesMap.delete(tile.id);
}


function playMergeEffect(tile){
  const el = tilesMap.get(tile.id);
  if (!el) return;
  el.classList.add('merge-effect');
  setTimeout(()=> el.classList.remove('merge-effect'), 180);
}


function render(){
  const existingIds = new Set(tiles.map(t=>t.id));
  for (const [id, el] of tilesMap){
    if (!existingIds.has(Number(id))){
      el.remove();
      tilesMap.delete(Number(id));
    }
  }


  tiles.forEach(tile=>{
    if (!tilesMap.has(tile.id)){
      createTileElement(tile, true);
    } else {
    
      updateTileElement(tile, true);
    }
   
    const el = tilesMap.get(tile.id);
    if (el) el.dataset.value = String(tile.value);
  });


  scoreEl.textContent = 'Score: ' + state.score;
  const best = Number(localStorage.getItem(STORAGE_BEST) || 0);
  bestEl.textContent = 'Best: ' + best;
}


function spawnRandom(count = 1){
  const empty = state.grid.map((v,i)=> v === 0 ? i : -1).filter(i=>i >= 0);
  if (empty.length === 0) return;
  count = Math.min(count, empty.length);

  for (let k = 0; k < count; k++){
    const idx = empty.splice(randomInt(empty.length), 1)[0];
    const val = Math.random() < 0.9 ? 2 : 4;
    state.grid[idx] = val;
    const t = createTileObject(val, idx);
    createTileElement(t, true);
  }
  render();
}


function snapshotState(){
  const s = {
    grid: copyGrid(state.grid),
    score: state.score,
    over: state.over,
    tiles: tiles.map(t=>({ id: t.id, value: t.value, pos: t.pos }))
  };
  return s;
}
function restoreSnapshot(snapshot){
  state.grid = copyGrid(snapshot.grid);
  state.score = snapshot.score;
  state.over = snapshot.over;
  tiles.forEach(t => {
    const el = tilesMap.get(t.id);
    if (el) el.remove();
    tilesMap.delete(t.id);
  });
  tiles = snapshot.tiles.map(t => ({ id: t.id, value: t.value, pos: t.pos }));
  const maxId = tiles.reduce((m,t)=> Math.max(m,t.id), 0);
  if (maxId >= nextId) nextId = maxId + 1;
  tiles.forEach(t => createTileElement(t, false));
  render();
}


function canMove(){
  if (state.grid.some(v=>v===0)) return true;
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE-1;c++){
      if (state.grid[coordToPos(r,c)] === state.grid[coordToPos(r,c+1)]) return true;
    }
  }
  for (let c=0;c<SIZE;c++){
    for (let r=0;r<SIZE-1;r++){
      if (state.grid[coordToPos(r,c)] === state.grid[coordToPos(r+1,c)]) return true;
    }
  }
  return false;
}


function move(direction){
  if (state.over) return false;

  
  prevState = snapshotState();

  let moved = false;
  let scoreGainTotal = 0;

  
  const getLineIndices = (lineIdx) => {
    const arr = [];
    if (direction === 'left'){
      const r = lineIdx;
      for (let c=0;c<SIZE;c++) arr.push(coordToPos(r,c));
    } else if (direction === 'right'){
      const r = lineIdx;
      for (let c=SIZE-1;c>=0;c--) arr.push(coordToPos(r,c));
    } else if (direction === 'up'){
      const c = lineIdx;
      for (let r=0;r<SIZE;r++) arr.push(coordToPos(r,c));
    } else if (direction === 'down'){
      const c = lineIdx;
      for (let r=SIZE-1;r>=0;r--) arr.push(coordToPos(r,c));
    }
    return arr;
  };

  
  const tileAtPos = (pos) => tiles.find(t => t.pos === pos);

  
  const newTilesArray = [];

  for (let line = 0; line < SIZE; line++){
    const indices = getLineIndices(line);

    
    const lineTiles = indices.map(pos => tileAtPos(pos)).filter(Boolean);

    
    const mergedLine = [];
    for (let i=0;i<lineTiles.length;i++){
      const current = lineTiles[i];
      if (i+1 < lineTiles.length && lineTiles[i+1].value === current.value){
        const newValue = current.value * 2;
        const mergedTile = { id: current.id, value: newValue, pos: null, mergedFrom: [ current.id, lineTiles[i+1].id ] };
        newTilesArray.push(mergedTile);
        scoreGainTotal += newValue;
        i++; 
        moved = true;
      } else {
        newTilesArray.push({ id: current.id, value: current.value, pos: null, mergedFrom: null });
      }
    }

    
    while (mergedLine.length < 0){} 

    for (let k = 0; k < indices.length; k++){
      const targetPos = indices[k];
      const t = newTilesArray[ newTilesArray.length - indices.length + k ]; 
    }
  }

  
  const resultTiles = [];
  for (let line = 0; line < SIZE; line++){
    const indices = getLineIndices(line);
    const lineTiles = indices.map(pos => tileAtPos(pos)).filter(Boolean);
    const resultLineTiles = [];
    for (let i=0;i<lineTiles.length;i++){
      const cur = lineTiles[i];
      if (i+1 < lineTiles.length && lineTiles[i+1].value === cur.value){
        resultLineTiles.push({ id: cur.id, value: cur.value*2, mergedFrom: [cur.id, lineTiles[i+1].id] });
        scoreGainTotal += cur.value*2;
        i++; 
        moved = true;
      } else {
        resultLineTiles.push({ id: cur.id, value: cur.value, mergedFrom: null });
      }
    }

    while (resultLineTiles.length < SIZE) resultLineTiles.push(null);

    for (let k=0;k<indices.length;k++){
      const posIndex = indices[k];
      const entry = resultLineTiles[k];
      if (entry === null){
      } else {
        entry.pos = posIndex;
        resultTiles.push(entry);
      }
    }
  }


  const currentById = new Map(tiles.map(t => [t.id, t]));
  const newTilesFinal = [];
  const removedIds = new Set();

  for (const nt of resultTiles){
    if (!nt) continue;
    newTilesFinal.push({ id: nt.id, value: nt.value, pos: nt.pos, mergedFrom: nt.mergedFrom });
    if (nt.mergedFrom && nt.mergedFrom.length === 2){
      removedIds.add(nt.mergedFrom[1]);
    }
  }

  
  for (const nt of newTilesFinal){
    const old = currentById.get(nt.id);
    if (!old) {
      moved = true;
    } else {
      if (old.pos !== nt.pos) moved = true;
      if (old.value !== nt.value) moved = true;
    }
  }


  if (!moved){
    return false;
  }


  state.score += scoreGainTotal;

  
  tiles.forEach(t => {
    if (!tilesMap.has(t.id)) createTileElement(t,false);
  });

  const targetByPos = new Map();
  newTilesFinal.forEach(nt => {
    targetByPos.set(nt.pos, nt);
  });

  const destinations = new Map(); 
  const mergeTargets = new Map(); 
 
  tiles.forEach(t => destinations.set(t.id, null));
  newTilesFinal.forEach(nt => {
    destinations.set(nt.id, nt.pos);
    if (nt.mergedFrom && nt.mergedFrom.length === 2){
      const [tid, removedId] = nt.mergedFrom;
      mergeTargets.set(removedId, tid); 
    }
  });

 
tiles.forEach(t => {
    const el = tilesMap.get(t.id);
    if (!el) return;

    const dest = destinations.get(t.id);

    
    if (mergeTargets.has(t.id)) {
        const targetId = mergeTargets.get(t.id);
        const targetTile = newTilesFinal.find(o => o.id === targetId);
        if (targetTile) {
            const { x, y } = tilePositionXY(targetTile.pos);
            requestAnimationFrame(() => {
                el.style.transition = "transform 0.18s ease";
                el.style.transform = `translate(${x}px,${y}px)`;
            });
        }
        return;
    }

    
    if (dest === null) {
        el.style.transition = "transform 0.18s ease, opacity 0.18s ease";
        el.style.opacity = "0";
        return;
    }

    
    const { x, y } = tilePositionXY(dest);
    requestAnimationFrame(() => {
        el.style.transition = "transform 0.18s ease";
        el.style.transform = `translate(${x}px,${y}px)`;
    });
});

  setTimeout(()=> {
    for (const [removedId, targetId] of mergeTargets){
      const elRem = tilesMap.get(removedId);
      if (elRem){
        elRem.remove();
        tilesMap.delete(removedId);
      }
    }

    const newTilesArr = [];
    for (const nt of newTilesFinal){
      const existing = currentById.get(nt.id);
      newTilesArr.push({ id: nt.id, value: nt.value, pos: nt.pos });
      const el = tilesMap.get(nt.id);
      if (el){
        el.dataset.value = String(nt.value);
        const inner = el.querySelector('.tile-inner');
        if (inner) inner.textContent = String(nt.value);
      }
      if (nt.mergedFrom) playMergeEffect({ id: nt.id });
    }
    tiles = newTilesArr;

    
    state.grid = Array(SIZE*SIZE).fill(0);
    tiles.forEach(t => { state.grid[t.pos] = t.value });

    render();
    saveGame();

   
    setTimeout(()=> {
      spawnRandom(1);
      if (!canMove()){
        state.over = true;
        showGameOver();
      }
      saveGame();
    }, 80);

  }, 200);

  return true;
}


function newGame(){
  state.grid = Array(SIZE*SIZE).fill(0);
  state.score = 0;
  state.over = false;
  prevState = null;

  
  tiles.forEach(t => {
    const el = tilesMap.get(t.id);
    if (el) el.remove();
  });
  tiles = [];
  tilesMap.clear();
  nextId = 1;

  spawnRandom(1 + randomInt(3));
  render();
  saveGame();
}

function undo(){
  if (!prevState) return;
  if (state.over) return;
  restoreSnapshot(prevState);
  prevState = null;
  saveGame();
}

function saveGame(){
  const payload = { grid: state.grid, score: state.score, over: state.over, tiles: tiles.map(t=>({ id:t.id, value:t.value, pos:t.pos })) };
  localStorage.setItem(STORAGE_GAME, JSON.stringify(payload));
  const best = Number(localStorage.getItem(STORAGE_BEST) || 0);
  if (state.score > best) localStorage.setItem(STORAGE_BEST, state.score);
}
function loadGame(){
  const raw = localStorage.getItem(STORAGE_GAME);
  if (!raw) return false;
  try {
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.grid) && p.grid.length === SIZE*SIZE){
      state.grid = p.grid;
      state.score = p.score || 0;
      state.over = p.over || false;
      tiles.forEach(t => {
        const el = tilesMap.get(t.id);
        if (el) el.remove();
      });
      tilesMap.clear();
      tiles = [];
      if (Array.isArray(p.tiles)){
        p.tiles.forEach(t => {
          tiles.push({ id: t.id, value: t.value, pos: t.pos });
          if (t.id >= nextId) nextId = t.id + 1;
        });
        tiles.forEach(t => createTileElement(t, false));
      } else {
        state.grid.forEach((v,i)=>{ if (v !== 0) createTileObject(v, i); });
        tiles.forEach(t => createTileElement(t, false));
      }
      render();
      return true;
    }
  } catch(e){
    console.warn('load error', e);
  }
  return false;
}

function getLeaders(){
  const raw = localStorage.getItem(STORAGE_LEADERS);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e){ return [] }
}
function saveLeader(name, score){
  const arr = getLeaders();
  arr.push({ name: name || '---', score });
  arr.sort((a,b)=> b.score - a.score);
  const top = arr.slice(0,10);
  localStorage.setItem(STORAGE_LEADERS, JSON.stringify(top));
}
function showLeaders(){
  const arr = getLeaders();
  let html = '<table><thead><tr><th>#</th><th>Имя</th><th>Очки</th></tr></thead><tbody>';
  if (arr.length === 0) html += '<tr><td colspan="4">Рекордов пока нет</td></tr>';
  arr.forEach((it,i)=>{ html += `<tr><td>${i+1}</td><td>${escapeHtml(it.name)}</td><td>${it.score}</td><td>${escapeHtml(it.date)}</td></tr>` });
  html += '</tbody></table>';
  leadersList.innerHTML = html;
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[ch]) ); }

function showGameOver(){
  modalGameover.classList.add('open');
  playerName.value = '';
  playerName.style.display = 'block';
  saveScoreBtn.style.display = 'inline-block';
  document.getElementById('gameover-msg').textContent = 'Игра окончена. Ваш счёт: ' + state.score;
  mobileControls.style.display = 'none';
}
function hideGameOver(){
  modalGameover.classList.remove('open');
  mobileControls.style.display = '';
}

document.addEventListener('keydown', e => {
  if (e.key.startsWith('Arrow')){
    e.preventDefault();
    const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
    if (dir) {
      const moved = move(dir);
      if (moved) {  }
    }
  }
});

btnRestart.addEventListener('click', ()=>{ newGame(); hideGameOver(); });
restartFromModal.addEventListener('click', ()=>{ newGame(); hideGameOver(); modalGameover.classList.remove('open'); });
btnUndo.addEventListener('click', ()=>{ undo(); });

btnLeaders.addEventListener('click', ()=>{ showLeaders(); modalLeaders.classList.add('open'); mobileControls.style.display='none'; });
closeLeaders.addEventListener('click', ()=>{ modalLeaders.classList.remove('open'); mobileControls.style.display = '' });

saveScoreBtn.addEventListener('click', ()=> {
  const name = playerName.value.trim() || 'Аноним';
  saveLeader(name, state.score);
  document.getElementById('gameover-msg').textContent = 'Ваш рекорд сохранён.';
  playerName.style.display = 'none';
  saveScoreBtn.style.display = 'none';
  const best = Number(localStorage.getItem(STORAGE_BEST) || 0);
  if (state.score > best) localStorage.setItem(STORAGE_BEST, state.score);
});


document.querySelectorAll('[data-dir]').forEach(btn => btn.addEventListener('click', ()=> {
  move(btn.dataset.dir);
}));


let touchStartX = 0, touchStartY = 0;

boardEl.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
}, { passive: true });

boardEl.addEventListener('touchmove', e => {
    e.preventDefault();
}, { passive: false }); 

boardEl.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) + Math.abs(dy) < 30) return; 
    if (Math.abs(dx) > Math.abs(dy)){
        if (dx > 0) move('right'); else move('left');
    } else {
        if (dy > 0) move('down'); else move('up');
    }
});


function init(){
  if (!loadGame()){
    newGame();
  } else {
    render();
    if (!canMove()){
      state.over = true;
      showGameOver();
    }
  }


  function updateMobileVisibility(){ if (window.innerWidth <= 520) mobileControls.style.display = 'block'; else mobileControls.style.display = 'none'; }
  updateMobileVisibility();
  window.addEventListener('resize', updateMobileVisibility);


  window._lab2048 = { state, newGame, move, undo, saveGame, loadGame };
}
init();
