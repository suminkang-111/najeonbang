var currentProfileId = null;

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function winRateClass(p){ if (isNaN(p)) return 'wr-gray'; if (p>=70) return 'wr-yellow'; if (p>=50) return 'wr-blue'; if (p>=40) return 'wr-red'; return 'wr-gray'; }


function applyChampImmediate(team, id, name, labelEl){
  // update per-match map
  const map = perMatchData[team];
  const entry = map.get(id) || { role:'', champ:'', k:'', d:'', a:'' };
  map.set(id, { ...entry, champ: name });
  // update label visually
  if (labelEl){
    labelEl.textContent = name;
    labelEl.classList.add('active');
    setTimeout(()=>labelEl.classList.remove('active'), 400);
  }
}


// ===== Data & constants =====
const CHAMPIONS_RAW = ["아트록스","아리","아칼리","액션","알리스타","아무무","애니비아","애니","아펠리오스","애쉬","아우렐리온 솔","아지르","바드","벨베스","블리츠크랭크","브랜드","브라움","브라이어","케이틀린","카밀","카시오페아","초가스","코르키","다리우스","다이애나","문도 박사","드레이븐","에코","엘리스","이블린","이즈리얼","피들스틱","피오라","피즈","갈리오","갱플랭크","가렌","나르","그라가스","그레이브즈","그웬","헤카림","하이머딩거","흐웨이","일라오이","이렐리아","아이번","잔나","자르반 4세","잭스","제이스","진","징크스","크산테","카이사","칼리스타","카르마","카서스","카사딘","카타리나","케일","케인","케넨","카직스","킨드레드","클레드","코그모","르블랑","리 신","레오나","릴리아","리산드라","루시안","룰루","럭스","말파이트","말자하","마오카이","마스터 이","밀리오","미스 포츈","모데카이저","모르가나","나피리","나미","나서스","노틸러스","니코","니달리","닐라","녹턴","누누와 윌럼프","올라프","오리아나","오른","판테온","뽀삐","파이크","키아나","퀸","라칸","람머스","렉사이","렐","레나타 글라스크","레넥톤","렝가","리븐","럼블","라이즈","사미라","세주아니","세나","세라핀","세트","샤코","쉔","쉬바나","신지드","사이온","시비르","스카너","소나","소라카","스웨인","사일러스","신드라","탐 켄치","탈리야","탈론","타릭","티모","쓰레쉬","트리스타나","트런들","트린다미어","트위스티드 페이트","트위치","우디르","우르곳","바루스","베인","베이가","벨코즈","벡스","바이","비에고","빅토르","블라디미르","볼리베어","워윅","오공","자야","제라스","신 짜오","야스오","요네","요릭","유미","자크","제드","제리","직스","질리언","조이","자이라"];
const CHAMPIONS = CHAMPIONS_RAW.slice().sort((a,b)=> a.localeCompare(b, 'ko-KR'));
let allPlayers = [];
let selectedA = new Set();
let selectedB = new Set();
let perMatchData = { A:new Map(), B:new Map() };
let activeAssign = { team:null, playerId:null };

// ===== Tabs =====
function setActiveTab(id) {
  $$('.tab').forEach(s => s.classList.remove('active'));
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  const tabEl = document.getElementById(id);
  if (tabEl) tabEl.classList.add('active');
  const btnEl = document.querySelector(`.tab-btn[data-tab="${id}"]`);
  if (btnEl) btnEl.classList.add('active');

  if (id === 'players') loadPlayers();
  if (id === 'matches') loadMatches();
  if (id === 'leaderboard') loadLeaderboard();
  if (id === 'new-match') setupNewMatch();
  if (id === 'zocr') {
    try {
      const boxEl = document.getElementById('zocrResult');
      if (boxEl) { boxEl.classList.remove('hidden'); boxEl.style.display = 'block'; }
      if (typeof showReviewTable === 'function') {
        const b = (window._zBlue && window._zBlue.length) ? window._zBlue : [];
        const r = (window._zRed && window._zRed.length) ? window._zRed : [];
        showReviewTable(b, r);
      }
      const applyBtn = document.getElementById('applyZoneToForm');
      if (applyBtn) applyBtn.disabled = false;
    } catch (e) {
      console.warn('zocr init table fail', e);
    }
  }
}
document.addEventListener('DOMContentLoaded', ()=>{
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', ()=> setActiveTab(btn.dataset.tab)));
  setActiveTab('players');
  $('#player-form').addEventListener('submit', onAddPlayer);
  $('#saveMatch')?.addEventListener('click', saveMatch);
  renderChampions();
  $('#champSearch')?.addEventListener('input', renderChampions);

  // profile modal close
  $('#closeProfile')?.addEventListener('click', ()=> $('#profileModal').classList.add('hidden'));
  document.getElementById('profileModal')?.addEventListener('click', (e)=>{ if (e.target.id === 'profileModal') $('#profileModal').classList.add('hidden'); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') { $('#profileModal')?.classList.add('hidden'); closeChampPopover(); }});

  // OCR wiring
  $('#cropInput')?.addEventListener('change', loadImageToCanvas);
  $('#runZoneOcr')?.addEventListener('click', runZoneOcr);
  $('#applyZoneToForm')?.addEventListener('click', ()=> setActiveTab('new-match'));
});

// ===== Players =====
async function onAddPlayer(e){ e.preventDefault(); const name=e.target.name.value.trim(); if(!name) return; await fetch('/api/players',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}); e.target.reset(); loadPlayers();}
async function loadPlayers(){ const r=await fetch('/api/players'); allPlayers=await r.json(); const tb=$('#players-table tbody'); tb.innerHTML=''; allPlayers.forEach(p=>{ const tr=document.createElement('tr'); tr.className = (r.result==='승'?'row-win':'row-lose'); tr.innerHTML=`<td>${p.name}</td><td>${p.rating}</td><td>${p.wins} / ${p.losses}</td><td>${p.win_streak||0}</td><td>${p.lose_streak||0}</td><td class="${(p.wins+p.losses)?winRateClass(Math.round(p.wins*1000/(p.wins+p.losses))/10):'wr-gray'}">${(p.wins+p.losses)?(Math.round(p.wins*1000/(p.wins+p.losses))/10).toFixed(1):"0.0"}%</td><td><button class="action-btn" data-del="${p.id}">삭제</button></td>`; tb.appendChild(tr); }); $$('button[data-del]').forEach(btn=> btn.onclick=async ()=>{ if(!confirm('삭제하시겠습니까?')) return; await fetch('/api/players/'+btn.dataset.del,{method:'DELETE'}); loadPlayers();}); }

// ===== New Match =====
function renderChips(container, idsSet, teamKey){
  container.innerHTML = '';
  allPlayers.forEach(p => {
    const selected = idsSet.has(p.id);
    const chip = document.createElement('span');
    chip.className = 'player-chip' + (selected?' selected':'');
    chip.textContent = p.name;
    chip.addEventListener('click', ()=>{
      if (selected) { idsSet.delete(p.id); perMatchData[teamKey].delete(p.id); }
      else { idsSet.add(p.id); perMatchData[teamKey].set(p.id, { role:'', champ:'', k:'', d:'', a:'' }); }
      setupNewMatch();
    });
    container.appendChild(chip);
  });
}
function setupNewMatch(){
  renderChips($('#teamA'), selectedA, 'A');
  renderChips($('#teamB'), selectedB, 'B');
  renderTeamSetup('A', $('#teamA-setup'), selectedA);
  renderTeamSetup('B', $('#teamB-setup'), selectedB);
  // pool
  const pool=$('#pool'); pool.innerHTML='';
  const remaining=allPlayers.filter(p=>!selectedA.has(p.id)&&!selectedB.has(p.id));
  remaining.forEach(p=>{ const chip=document.createElement('span'); chip.className='player-chip'; chip.textContent=p.name; chip.onclick=()=>{ selectedA.add(p.id); perMatchData['A'].set(p.id,{role:'',champ:'',k:'',d:'',a:''}); setupNewMatch();}; pool.appendChild(chip); });
  const today = new Date().toISOString().slice(0,10); if ($('#matchDate') && !$('#matchDate').value) $('#matchDate').value=today;
}
function renderTeamSetup(teamKey, container, idsSet){
  container.innerHTML='';
  Array.from(idsSet).forEach(id=>{
    const p=allPlayers.find(x=>x.id===id);
    const e=perMatchData[teamKey].get(id)||{role:'', champ:'', k:'', d:'', a:''};
    const row=document.createElement('div'); row.className='setup-row';
    row.innerHTML=`
      <div><strong>${p?.name||id}</strong> <span class="tag">(${teamKey==='A'?'블루':'레드'})</span></div>
      <select data-role="${teamKey}|${id}"><option value="">역할 없음</option><option>TOP</option><option>JUNGLE</option><option>MID</option><option>ADC</option><option>SUPPORT</option></select>
      <div><span class="chip" data-assign="${teamKey}|${id}">${e.champ||'챔피언 선택'}</span></div>
      <div class="kda-inputs"><input type="number" min="0" placeholder="K" value="${e.k||''}" data-k="${teamKey}|${id}"><span>/</span><input type="number" min="0" placeholder="D" value="${e.d||''}" data-d="${teamKey}|${id}"><span>/</span><input type="number" min="0" placeholder="A" value="${e.a||''}" data-a="${teamKey}|${id}"></div>
      <button class="row-del" title="삭제" data-delrow="${teamKey}|${id}">✕</button>`;
    container.appendChild(row);
    row.querySelector('select').value=e.role||'';
    row.querySelector('select').onchange=(ev)=>{ perMatchData[teamKey].set(id,{...e, role:ev.target.value}); const chipEl=row.querySelector(`[data-assign="${teamKey}|${id}"]`); activeAssign={team:teamKey, playerId:id}; highlightActiveAssign(); openChampPopover(chipEl, (name)=>{ const map=perMatchData[teamKey]; const ent=map.get(id)||{role:'',champ:'',k:'',d:'',a:''}; map.set(id,{...ent, champ:name}); chipEl.textContent=name; }); };
    const chip = row.querySelector(`[data-assign="${teamKey}|${id}"]`);
    chip.addEventListener('click', (ev)=>{ activeAssign = { team:teamKey, playerId:id }; highlightActiveAssign(); openChampPopover(ev.currentTarget, (name)=>{ const map=perMatchData[teamKey]; const ent=map.get(id)||{role:'',champ:'',k:'',d:'',a:''}; map.set(id,{...ent, champ:name}); ev.currentTarget.textContent=name; }); });
    row.querySelector(`[data-k="${teamKey}|${id}"]`).oninput=(ev)=>{ perMatchData[teamKey].set(id,{...perMatchData[teamKey].get(id), k:ev.target.value}); };
    row.querySelector(`[data-d="${teamKey}|${id}"]`).oninput=(ev)=>{ perMatchData[teamKey].set(id,{...perMatchData[teamKey].get(id), d:ev.target.value}); };
    row.querySelector(`[data-a="${teamKey}|${id}"]`).oninput=(ev)=>{ perMatchData[teamKey].set(id,{...perMatchData[teamKey].get(id), a:ev.target.value}); };
    row.querySelector(`[data-delrow="${teamKey}|${id}"]`).onclick = ()=> { (teamKey==='A'?selectedA:selectedB).delete(id); perMatchData[teamKey].delete(id); setupNewMatch(); };
  });
  highlightActiveAssign();
}
function highlightActiveAssign(){
  $$('[data-assign]').forEach(el => el.classList.remove('active'));
  if (!activeAssign.playerId) return;
  const key = `${activeAssign.team}|${activeAssign.playerId}`;
  const el = $$(`[data-assign="${key}"]`)[0];
  if (el) el.classList.add('active');
}
function renderChampions(){
  const grid=$('#champGrid'); if(!grid) return;
  const q=($('#champSearch')?.value||'').toLowerCase();
  grid.innerHTML='';
  CHAMPIONS.filter(c=>c.toLowerCase().includes(q)).forEach(name=>{
    const chip=document.createElement('span'); chip.className='chip'; chip.textContent=name;
    chip.onclick=()=>{
      if (!activeAssign.playerId) { alert('챔피언을 배정할 선수를 먼저 선택하세요.'); return; }
      const map = perMatchData[activeAssign.team];
      const entry = map.get(activeAssign.playerId) || { role:'', champ:'', k:'', d:'', a:'' };
      map.set(activeAssign.playerId, { ...entry, champ: name });
      const label = document.querySelector(`[data-assign="${activeAssign.team}|${activeAssign.playerId}"]`);
      if (label) label.textContent = name;
    };
    grid.appendChild(chip);
  });
}

// ===== Quick Champion Popover =====
let champPopover, champQuickList, champQuickSearch, champPopoverOnPick = null;
function openChampPopover(anchorEl, onPick){
  champPopover ||= $('#champPopover'); champQuickList ||= $('#champQuickList'); champQuickSearch ||= $('#champQuickSearch');
  champPopoverOnPick = onPick;
  const rect = anchorEl.getBoundingClientRect();
  const top = Math.max(10, rect.top - 10);
  const left = Math.min(window.innerWidth - 300, rect.right + 10);
  champPopover.style.top = `${top}px`; champPopover.style.left = `${left}px`; champPopover.style.display='block';
  renderQuickList('');
  champQuickSearch.value=''; champQuickSearch.focus();
}
function closeChampPopover(){ if (champPopover) champPopover.style.display='none'; }
function renderQuickList(q){
  champQuickList.innerHTML='';
  const list = CHAMPIONS.filter(c=>c.toLowerCase().includes(q.toLowerCase()));
  list.forEach(name=>{
    const div=document.createElement('div'); div.className='item'; div.textContent=name;
    div.onmousedown=(ev)=>{ev.preventDefault();ev.stopPropagation();if(champPopoverOnPick) champPopoverOnPick(name);const key=activeAssign?`${activeAssign.team}|${activeAssign.playerId}`:null;if(key){const label=document.querySelector(`[data-assign="${key}"]`); if(label){label.textContent=name; label.classList.add('active'); setTimeout(()=>label.classList.remove('active'),400);} }closeChampPopover();};
    champQuickList.appendChild(div);
  });
}
document.addEventListener('DOMContentLoaded', ()=>{
  champPopover = $('#champPopover'); champQuickList = $('#champQuickList'); champQuickSearch = $('#champQuickSearch');
  champQuickSearch?.addEventListener('input', ()=> renderQuickList(champQuickSearch.value));
  document.addEventListener('click', (e)=>{ if(champPopover && champPopover.style.display==='block'){ if(!champPopover.contains(e.target) && !e.target.closest('[data-assign]') && e.target.id!=='champQuickSearch'){ closeChampPopover(); } } });
});

async function saveMatch(){
  const winner=document.querySelector('input[name="winner"]:checked')?.value;
  const date=$('#matchDate').value;
  const notes=$('#notes').value.trim();
  const teamA=Array.from(selectedA).map(id=>({ id, name:(allPlayers.find(p=>p.id===id)||{}).name, ...(perMatchData['A'].get(id)||{}) }));
  const teamB=Array.from(selectedB).map(id=>({ id, name:(allPlayers.find(p=>p.id===id)||{}).name, ...(perMatchData['B'].get(id)||{}) }));
  if(teamA.length===0||teamB.length===0) return alert('두 팀에 선수를 배치해주세요.');
  if(!winner) return alert('승리 팀을 선택해주세요.');
  const res=await fetch('/api/matches',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ winner, teamA, teamB, date, notes })});
  const data=await res.json(); if(!res.ok){ alert(data.error||'오류'); return; }
  alert('매치가 저장되었습니다.'); selectedA.clear(); selectedB.clear(); perMatchData={A:new Map(), B:new Map()}; $('#notes').value=''; setActiveTab('matches');
}

// ===== Matches & Leaderboard =====
function roleIndex(role){ return {'TOP':0,'JUNGLE':1,'MID':2,'ADC':3,'SUPPORT':4}[role] ?? 999; }
function rowForTeam(arr, idToName){ const cols=['','','','','']; arr.slice().sort((a,b)=>roleIndex(a.role)-roleIndex(b.role)).forEach(x=>{ const label=`${idToName.get(x.id)||x.id}${x.champ?` / ${x.champ}`:''}${(x.k||x.d||x.a)?` (${x.k||0}/${x.d||0}/${x.a||0})`:''}`; const i=roleIndex(x.role); if(i===999){ const idx=cols.findIndex(c=>!c); cols[idx>=0?idx:4]=label; } else cols[i]=label; }); return cols; }
async function loadMatches(){ const r=await fetch('/api/matches'); const matches=await r.json(); const idToName=new Map(allPlayers.map(p=>[p.id,p.name])); const tb=$('#matches-table tbody'); tb.innerHTML=''; matches.forEach(m=>{ const a=rowForTeam(m.team_a,idToName), b=rowForTeam(m.team_b,idToName); const trA=document.createElement('tr'); trA.innerHTML=`<td rowspan=\"2\"><div class=\"date-wrap\"><span class=\"date\">${m.date}</span> <button class=\"icon-btn danger\" onclick=\"deleteMatch(${m.id})\">삭제</button></div></td><td>블루</td><td class="team-cell ${m.winner==='A'?'win':'lose'}">${a[0]||''}</td><td class="team-cell ${m.winner==='A'?'win':'lose'}">${a[1]||''}</td><td class="team-cell ${m.winner==='A'?'win':'lose'}">${a[2]||''}</td><td class="team-cell ${m.winner==='A'?'win':'lose'}">${a[3]||''}</td><td class="team-cell ${m.winner==='A'?'win':'lose'}">${a[4]||''}</td><td class="team-cell ${m.winner==='A'?'win':'lose'}">${m.winner==='A'?'승':'패'}</td><td rowspan="2">${m.notes||''}</td>`; const trB=document.createElement('tr'); trB.innerHTML=`<td>레드</td><td class="team-cell ${m.winner==='B'?'win':'lose'}">${b[0]||''}</td><td class="team-cell ${m.winner==='B'?'win':'lose'}">${b[1]||''}</td><td class="team-cell ${m.winner==='B'?'win':'lose'}">${b[2]||''}</td><td class="team-cell ${m.winner==='B'?'win':'lose'}">${b[3]||''}</td><td class="team-cell ${m.winner==='B'?'win':'lose'}">${b[4]||''}</td><td class="team-cell ${m.winner==='B'?'win':'lose'}">${m.winner==='B'?'승':'패'}</td>`; tb.appendChild(trA); tb.appendChild(trB); }); }

let profileChart;
async function loadLeaderboard(){ const r=await fetch('/api/leaderboard'); const rows=await r.json(); const tb=$('#leaderboard-table tbody'); tb.innerHTML=''; rows.forEach((p,i)=>{ const tr=document.createElement('tr'); tr.className = (r.result==='승'?'row-win':'row-lose'); tr.innerHTML=`<td>${i+1}</td><td><button class="linklike" data-profile="${p.id}">${p.name}</button></td><td>${p.rating}</td><td>${p.wins} / ${p.losses}</td><td>${p.win_streak||0}</td><td>${p.lose_streak||0}</td>`; tb.appendChild(tr); }); $$('button[data-profile]').forEach(btn=> btn.onclick=()=> openProfile(btn.dataset.profile)); }

async function openProfile(playerId){ currentProfileId = String(playerId);
  const me = allPlayers.find(p=> String(p.id) === String(playerId));
  $('#profileTitle').textContent = `${me?.name || playerId} 개인전적`;
  const resHist = await fetch('/api/rating-history/'+playerId);
  const hist = await resHist.json();
  const labels = ['시작', ...hist.map(h => h.matchId)];
  const data = [1000, ...hist.map(h => h.rating)];
  const ctx = document.getElementById('profileChart').getContext('2d');
  if (profileChart) profileChart.destroy();
  profileChart = new Chart(ctx, { type:'line', data:{ labels, datasets:[{ label:'Rating', data }] }, options:{ responsive:true, maintainAspectRatio:false } });

  const res = await fetch('/api/player/'+playerId+'/matches');
  const rows = await res.json();
  const tbody = $('#profileTable tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const k = r.k!==null && r.k!=='' ? r.k : '-';
    const d = r.d!==null && r.d!=='' ? r.d : '-';
    const a = r.a!==null && r.a!=='' ? r.a : '-';
    const mkTable = (arr)=>{
      let h='<table class="mate-table"><thead><tr><th>닉네임</th><th>챔피언</th><th>K</th><th>D</th><th>A</th></tr></thead><tbody>';
      arr.forEach(t=>{ h+=`<tr><td>${t.name}</td><td>${t.champ||''}</td><td>${t.k||0}</td><td>${t.d||0}</td><td>${t.a||0}</td></tr>`; });
      h+='</tbody></table>'; return h;
    };
    const sameTeam = [{name: r.me?.name||'', champ:r.champ||'', k:k, d:d, a:a}, ...r.teammates];
    const teammates = mkTable(sameTeam);
    const opponents  = mkTable(r.opponents);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.date}</td><td>${r.team}</td><td>${r.role||''}</td><td>${r.champ||''}</td><td>${k}/${d}/${a}</td><td>${teammates}</td><td>${opponents}</td><td><span class='result-badge ${r.result==='승'?'win':'lose'}'>${r.result}</span></td><td>${r.delta>0?`+${r.delta}`:r.delta}</td>`;
    const rateCell = (r.ratingAfter!=null) ? `${r.ratingAfter} (${r.delta>0?`+${r.delta}`:r.delta})` : (r.delta>0?`+${r.delta}`:(r.delta||''));
    const _last = tr.lastElementChild || tr.querySelector(':scope > td:last-child') || tr.querySelector('td:last-child');
    if (_last) _last.textContent = rateCell;
    // highlight row by result
    try{
      const _resTxt = (r.result||'').toString();
      if (_resTxt.includes('승')) tr.classList.add('row-win');
      else if (_resTxt.includes('패')) tr.classList.add('row-loss');
    }catch(_){}
    tbody.appendChild(tr);
  });
  // === Scroll wrapper when rows exceed 6 ===
  try{
    const tbl = document.getElementById('profileTable');
    if (tbl){
      let wrap = document.getElementById('profileTableWrap');
      if (!wrap){
        wrap = document.createElement('div');
        wrap.id = 'profileTableWrap';
        tbl.parentNode.insertBefore(wrap, tbl);
        wrap.appendChild(tbl);
      }
      const rowCount = tbl.querySelectorAll('tbody > tr').length;
      if (rowCount > 6) wrap.classList.add('scroll'); else wrap.classList.remove('scroll');
    }
  }catch(_){}
  $('#profileModal').classList.remove('hidden');
}

// ===== OCR: Zone-based with review DnD =====
let cropImg = new Image();
let cropCanvas = null, cropCtx = null;
let activeZone = 'blue_names';
const zoneNames = { blue_names:'블루 닉네임', blue_kda:'블루 KDA', red_names:'레드 닉네임', red_kda:'레드 KDA' };
const zones = []; // {zone:'blue_names', x,y,w,h}

function setActiveZone(z){ activeZone = z; const label = $('#activeZoneLabel'); if (label) label.textContent = zoneNames[activeZone]; }
function drawZones(){
  if (!cropCanvas) return;
  cropCtx.drawImage(cropImg, 0,0, cropCanvas.width, cropCanvas.height);
  cropCtx.save();
  zones.forEach(z=>{
    cropCtx.strokeStyle = z.zone.includes('blue') ? '#6ea8fe' : '#ff7676';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(z.x,z.y,z.w,z.h);
    cropCtx.fillStyle = 'rgba(0,0,0,0.4)';
    cropCtx.fillRect(z.x,z.y,60,18);
    cropCtx.fillStyle = '#fff';
    cropCtx.font = '12px system-ui';
    cropCtx.fillText(zoneNames[z.zone], z.x+4, z.y+13);
  });
  cropCtx.restore();
}
function setupCropCanvas(){
  cropCanvas = $('#cropCanvas'); cropCtx = cropCanvas.getContext('2d');
  let start = null; let drawing=false;
  cropCanvas.onmousedown = (e)=>{
    const rect = cropCanvas.getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top; start = {x,y}; drawing=true;
  };
  cropCanvas.onmousemove = (e)=>{
    if(!drawing) return;
    const rect = cropCanvas.getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top;
    drawZones();
    const w = x - start.x, h = y - start.y;
    cropCtx.save();
    cropCtx.strokeStyle = activeZone.includes('blue') ? '#6ea8fe' : '#ff7676';
    cropCtx.setLineDash([6,4]);
    cropCtx.strokeRect(start.x, start.y, w, h);
    cropCtx.restore();
  };
  cropCanvas.onmouseup = (e)=>{
    if(!drawing) return; drawing=false;
    const rect = cropCanvas.getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const w = x - start.x, h = y - start.y;
    if (Math.abs(w) < 10 || Math.abs(h) < 10) { drawZones(); return; }
    const z = { zone:activeZone, x: Math.min(start.x,x), y: Math.min(start.y,y), w: Math.abs(w), h: Math.abs(h) };
    zones.push(z); drawZones(); renderZonesList();
  };
}
function renderZonesList(){
  const box = $('#zonesList'); if (!box) return; box.innerHTML='';
  zones.forEach((z,i)=>{
    const div = document.createElement('div');
    div.className = 'assign-item';
    div.textContent = `${i+1}. ${zoneNames[z.zone]} (x:${Math.round(z.x)}, y:${Math.round(z.y)}, w:${Math.round(z.w)}, h:${Math.round(z.h)})`;
    box.appendChild(div);
  });
}
function loadImageToCanvas(e){
  const file=e.target.files?.[0]; if(!file) return;
  const url = URL.createObjectURL(file);
  cropImg.onload = ()=>{
    cropCanvas = $('#cropCanvas'); cropCtx = cropCanvas.getContext('2d');
    cropCanvas.width = Math.min(1400, cropImg.width);
    cropCanvas.height = Math.floor(cropImg.height * (cropCanvas.width / cropImg.width));
    drawZones();
  };
  cropImg.src = url;
  zones.length = 0; renderZonesList();
  setupCropCanvas();
}
function cropRegion(z){
  const off = document.createElement('canvas'); const octx = off.getContext('2d');
  off.width = Math.max(1, Math.floor(z.w)); off.height = Math.max(1, Math.floor(z.h));
  octx.drawImage(cropCanvas, z.x, z.y, z.w, z.h, 0,0, off.width, off.height);
  return off;
}
function horizontalLinesFromCanvas(cnv){
  const ctx = cnv.getContext('2d');
  const {width:w, height:h} = cnv;
  const data = ctx.getImageData(0,0,w,h).data;
  const proj = new Array(h).fill(0);
  for(let y=0;y<h;y++){
    let sum=0, row=y*w*4;
    for(let x=0;x<w;x++){
      const i=row+x*4;
      const lum = (data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114);
      sum += (255 - lum);
    }
    proj[y]=sum;
  }
  const thr = 0.15 * Math.max(...proj);
  const lines=[];
  let s=null;
  for(let y=0;y<h;y++){
    if(proj[y]>thr){ if(s===null) s=y; }
    else { if(s!==null){ if(y-s>8) lines.push([s,y]); s=null; } }
  }
  if(s!==null && h-s>8) lines.push([s,h]);
  return lines;
}
function cropLine(cnv, range){ const off=document.createElement('canvas'); off.width=cnv.width; off.height=range[1]-range[0]; off.getContext('2d').drawImage(cnv,0,range[0],cnv.width,off.height,0,0,off.width,off.height); return off; }
function cleanNameLine(s){
  s = s.replace(/\b(블루\s*닉네임|레드\s*닉네임)\b/gi,'').trim();
  s = s.normalize('NFKC');
  s = s.replace(/[^가-힣A-Za-z._\-\s]/g,' ').replace(/\s+/g,' ').trim();
  return s.length>=2 ? s : '';
}
function parseKDAstrict(s){
  const m = s.match(/(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/);
  if(!m) return null;
  const a=[+m[1],+m[2],+m[3]];
  if (a.some(v=>v<0||v>60)) return null;
  return a;
}

function parseKDAloose(s){
  const nums = (s.match(/\d+/g)||[]).map(x=>+x);
  if (nums.length>=3){ return [nums[0], nums[1], nums[2]]; }
  return null;
}

function preprocessForOCR(cnv){
  // returns [normalCanvas, invertedCanvas] with enhanced grayscale
  const w=cnv.width, h=cnv.height;
  const base=document.createElement('canvas'); base.width=w; base.height=h;
  const ctx=base.getContext('2d'); ctx.drawImage(cnv,0,0);
  const img=ctx.getImageData(0,0,w,h);
  // grayscale + contrast stretch
  let min=255, max=0;
  for(let i=0;i<img.data.length;i+=4){
    const r=img.data[i], g=img.data[i+1], b=img.data[i+2];
    const y = (0.299*r + 0.587*g + 0.114*b)|0;
    img.data[i]=img.data[i+1]=img.data[i+2]=y;
    if(y<min) min=y; if(y>max) max=y;
  }
  const range = Math.max(1, max-min);
  for(let i=0;i<img.data.length;i+=4){
    let y = img.data[i];
    y = ((y-min)*255/range)|0;
    img.data[i]=img.data[i+1]=img.data[i+2]=y;
  }
  ctx.putImageData(img,0,0);
  // inverted
  const inv=document.createElement('canvas'); inv.width=w; inv.height=h;
  const ictx=inv.getContext('2d'); ictx.drawImage(base,0,0);
  const id=ictx.getImageData(0,0,w,h);
  for(let i=0;i<id.data.length;i+=4){
    const y=id.data[i]; const invy=255-y;
    id.data[i]=id.data[i+1]=id.data[i+2]=invy;
  }
  ictx.putImageData(id,0,0);
  return [base, inv];
}

async function ocrCanvasByConfig(cnv, type){
  const allow = type==='kda' ? '0123456789/' : '._- ' + '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼히ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const lang = type==='kda' ? 'eng' : 'kor';
  const [norm, inv] = preprocessForOCR(cnv);
  const rec = async (canvas)=>{
    const { data:{ text } } = await Tesseract.recognize(canvas, lang, { tessedit_char_whitelist: allow, tessedit_pageseg_mode: 6 });
    return (text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
  };
  const arr1 = await rec(norm);
  const arr2 = await rec(inv);
  const uniq = (arr)=>{ const out=[]; const seen=new Set(); arr.forEach(s=>{ const t=s.replace(/\s+/g,' ').trim(); if(t && !seen.has(t)){ seen.add(t); out.push(t); } }); return out; };
  const merged = uniq([...(arr1||[]), ...(arr2||[])]);
  if (type==='kda'){
    let filt = merged.filter(s=> ((s.match(/\//g)||[]).length)>=2).slice(0,5);
    if (filt.length<5){
      // fallback per-row OCR to fill missing lines
      const byRows = await ocrKdaByRows(cnv);
      // merge while keeping order: prefer existing, fill blanks from byRows
      const out=[]; for(let i=0;i<5;i++){ out[i] = filt[i] || byRows[i] || ''; }
      return out;
    }
    return filt;
  } else {
    return merged.slice(0,5);
  }
}

// Simple Levenshtein for fuzzy name snapping
function lev(a, b){
  a = (a||'').toString(); b = (b||'').toString();
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({length:m+1}, (_,i)=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i;
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      const cost = a[i-1]===b[j-1]?0:1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[m][n];
}
function normalizeKor(s){ return (s||'').toString().trim().normalize('NFKC').replace(/\s+/g,' ').toLowerCase(); }
function bestMatchName(raw){
  if (!Array.isArray(allPlayers) || allPlayers.length===0) return raw;
  const target = normalizeKor(raw);
  let best = raw, bestScore = -1;
  for(const p of allPlayers){
    const cand = normalizeKor(p.name);
    const dist = lev(target, cand);
    const sim = 1 - dist / Math.max(target.length||1, cand.length||1);
    if (sim > bestScore){ bestScore = sim; best = p.name; }
  }
  return bestScore >= 0.6 ? best : raw;
}

// Review table with DnD & player pool
function showReviewTable(bluePlayers, redPlayers){
  bluePlayers = bluePlayers.map(p => ({...p, name: bestMatchName(p.name)}));
  redPlayers  = redPlayers.map(p => ({...p, name: bestMatchName(p.name)}));
  const pad = (arr)=>{ const out=arr.slice(0,5); while(out.length<5) out.push({name:'',k:'',d:'',a:''}); return out; };
  window._zBlue = pad(bluePlayers); window._zRed = pad(redPlayers);

  const box = $('#zocrResult'); box.innerHTML='';

  // Player pool
  const pool = document.createElement('div'); pool.className='pool';
  pool.innerHTML = '<strong>플레이어 풀(드래그해서 닉네임 칸에 드롭):</strong>';
  allPlayers.forEach(p=>{
    const it=document.createElement('span'); it.className='pool-item'; it.textContent=p.name; it.draggable=true;
    it.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain','NAME:'+p.name); });
    pool.appendChild(it);
  });
  box.appendChild(pool);

  // Mode toggle
  const modeWrap = document.createElement('div'); modeWrap.className='mode-toggle';
  modeWrap.innerHTML = '<label>드래그 모드: <select id="dndMode"><option value="name">이름 정렬</option><option value="kda">KDA 정렬</option></select></label>';
  box.appendChild(modeWrap);

  const renderTable = (arr,label)=>{
    const wrap = document.createElement('div');
    wrap.innerHTML = `<h4>${label==='A'?'블루(A)':'레드(B)'} — 5줄 고정</h4>` +
      `<table class="profile-table"><thead><tr><th>#</th><th>닉네임</th><th>K</th><th>D</th><th>A</th></tr></thead><tbody></tbody></table>`;
    const tbody = wrap.querySelector('tbody');
    arr.forEach((p,i)=>{
      const tr = document.createElement('tr'); tr.className='draggable-row'; tr.draggable=true;
      tr.innerHTML = `<td>${i+1}</td>
        <td contenteditable data-edit="name|${label}|${i}" class="drop-name">${p.name||''}</td>
        <td contenteditable data-edit="k|${label}|${i}">${p.k||''}</td>
        <td contenteditable data-edit="d|${label}|${i}">${p.d||''}</td>
        <td contenteditable data-edit="a|${label}|${i}">${p.a||''}</td>`;
      tbody.appendChild(tr);

      // pool drop
      const nameCell = tr.querySelector('.drop-name');
      nameCell.addEventListener('dragover', ev=>{ ev.preventDefault(); nameCell.classList.add('drag-over'); });
      nameCell.addEventListener('dragleave', ()=> nameCell.classList.remove('drag-over'));
      nameCell.addEventListener('drop', ev=>{
        ev.preventDefault(); nameCell.classList.remove('drag-over');
        const data = ev.dataTransfer.getData('text/plain'); if (data.startsWith('NAME:')){
          const nm = data.slice(5); nameCell.textContent = nm;
          const arrRef = label==='A'?window._zBlue:window._zRed; arrRef[i].name = nm;
        }
      });

      // row dnd reorder
      tr.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain', `${label}|${i}`); });
      tr.addEventListener('dragover', ev=>{ ev.preventDefault(); tr.classList.add('drag-over'); });
      tr.addEventListener('dragleave', ()=> tr.classList.remove('drag-over'));
      tr.addEventListener('drop', ev=>{
        ev.preventDefault(); tr.classList.remove('drag-over');
        const data = ev.dataTransfer.getData('text/plain'); const [srcTeam, srcIdx] = data.split('|');
        if (srcTeam!==label) return;
        const dstIdx = i;
        const mode = ($('#dndMode')?.value)||'name';
        const arrRef = label==='A'?window._zBlue:window._zRed;
        if (mode==='name'){ const t=arrRef[srcIdx].name; arrRef[srcIdx].name=arrRef[dstIdx].name; arrRef[dstIdx].name=t; }
        else { ['k','d','a'].forEach(k=>{ const t=arrRef[srcIdx][k]; arrRef[srcIdx][k]=arrRef[dstIdx][k]; arrRef[dstIdx][k]=t; }); }
        showReviewTable(window._zBlue, window._zRed);
      });
    });

    // edits
    wrap.querySelectorAll('[data-edit]').forEach(cell=>{
      cell.oninput = ()=>{
        const [key, team, idx] = cell.dataset.edit.split('|'); const arrRef = team==='A'?window._zBlue:window._zRed;
        if (key==='name') arrRef[idx].name = cell.textContent.trim();
        else arrRef[idx][key] = Number(cell.textContent.replace(/\D/g,''))||0;
      };
    });
    box.appendChild(wrap);
  };

  renderTable(window._zBlue,'A');
  renderTable(window._zRed,'B');

  $('#applyZoneToForm').disabled = false;
  $('#applyZoneToForm').onclick = ()=>{
    selectedA.clear(); selectedB.clear(); perMatchData = { A:new Map(), B:new Map() };
    function ensureId(name){
      const p=allPlayers.find(x=>x.name===name);
      if (p) return p.id;
      const id=Math.min(0,...[0,...allPlayers.map(p=>p.id)])-1;
      allPlayers.push({ id, name, rating:1000, wins:0, losses:0, win_streak:0, lose_streak:0 });
      return id;
    }
    (window._zBlue||[]).forEach(r=>{ if(!r.name) return; const id=ensureId(r.name); selectedA.add(id); perMatchData.A.set(id,{ role:'', champ:'', k:r.k||0, d:r.d||0, a:r.a||0 }); });
    (window._zRed||[]).forEach(r=>{ if(!r.name) return; const id=ensureId(r.name); selectedB.add(id); perMatchData.B.set(id,{ role:'', champ:'', k:r.k||0, d:r.d||0, a:r.a||0 }); });
    setActiveTab('new-match');
  };
}

// Zone OCR runner
let cropCtxInit=false;
document.addEventListener('DOMContentLoaded', ()=>{
  $$('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'zocr' && !cropCtxInit){ cropCtxInit=true; }
  });
  $('#cropInput')?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    const url = URL.createObjectURL(f);
    cropImg.onload = ()=>{
      cropCanvas = $('#cropCanvas'); cropCtx = cropCanvas.getContext('2d');
      cropCanvas.width = Math.min(1400, cropImg.width);
      cropCanvas.height = Math.floor(cropImg.height * (cropCanvas.width / cropImg.width));
      drawZones();
    };
    cropImg.src = url;
    zones.length = 0; renderZonesList();
    setupCropCanvas();
  });
  $$('button[data-zone]').forEach(b => b.addEventListener('click', ()=> setActiveZone(b.dataset.zone)));
  $('#clearLast')?.addEventListener('click', ()=>{ zones.pop(); drawZones(); renderZonesList(); });
  $('#clearAll')?.addEventListener('click', ()=>{ zones.length=0; drawZones(); renderZonesList(); });
});

async function runZoneOcr(){
  if (!zones || zones.length===0){ alert('최소 1개 이상의 영역을 지정해 주세요. (닉네임 또는 KDA 아무거나)'); return; }
  $('#zocrResult').textContent='영역 인식 중...';

  const collate = async (kind)=>{
    const pieces = zones.filter(z=>z.zone===kind).map(z=>cropRegion(z));
    if(!pieces.length) return [];
    const lines = [];
    for(const cnv of pieces){
      const tctx = cnv.getContext('2d');
      const trimUi = Number(document.getElementById('trimTopPx')?.value||28);
      const cut = Math.min(Math.max(0,trimUi), Math.floor(cnv.height*0.2));
      const trimmed = document.createElement('canvas'); const t2=trimmed.getContext('2d');
      trimmed.width=cnv.width; trimmed.height=Math.max(1, cnv.height-cut);
      t2.drawImage(cnv,0,cut,cnv.width,cnv.height-cut,0,0,trimmed.width,trimmed.height);
      const ranges = horizontalLinesFromCanvas(trimmed);
      for(const r of ranges){
        const lineC = cropLine(trimmed, r);
        const txts = await ocrCanvasByConfig(lineC, kind.includes('kda')?'kda':'name');
        txts.forEach(t=> lines.push(t));
      }
    }
    return lines;
  };

  const BnamesRaw = await collate('blue_names');
  const BKraw = await collate('blue_kda');
  const RnamesRaw = await collate('red_names');
  const RKraw = await collate('red_kda');

  const Bnames = BnamesRaw.map(cleanNameLine).filter(Boolean);
  const Rnames = RnamesRaw.map(cleanNameLine).filter(Boolean);
  const BK = BKraw.map(s=>parseKDAstrict(s)||parseKDAloose(s)).filter(Boolean);
  const RK = RKraw.map(s=>parseKDAstrict(s)||parseKDAloose(s)).filter(Boolean);

  const pair = (names, klist)=>{
    const total = Math.max(names.length, klist.length);
    const nRows = Math.min(5, total || 5); // 기본 5줄 틀 유지
    const out=[];
    for(let i=0;i<nRows;i++){
      const n = names[i] || '';
      const kd = klist[i] || [0,0,0];
      const [k,d,a] = [kd[0]||0, kd[1]||0, kd[2]||0];
      out.push({ name:n, k,d,a });
    }
    return out;
  };
  const bluePlayers = pair(Bnames,BK);
  const redPlayers = pair(Rnames,RK);

  showReviewTable(bluePlayers, redPlayers);
}


// --- keep UI chip text in sync with data ---
function syncAssignChips(){
  try{
    ['A','B'].forEach(team=>{
      const map = perMatchData && perMatchData[team];
      if(!map || !map.forEach) return;
      map.forEach((entry, id)=>{
        const el = document.querySelector(`[data-assign="${team}|${id}"]`);
        if(el && entry && entry.champ){
          if (el.textContent !== entry.champ) el.textContent = entry.champ;
        }
      });
    });
  }catch(e){/*noop*/}
}
document.addEventListener('click', ()=> setTimeout(syncAssignChips, 0));


// Fallback OCR: split KDA box into 5 horizontal bands and OCR each row separately
async function ocrKdaByRows(cnv){
  const results = [];
  const h = cnv.height, w = cnv.width;
  for(let i=0;i<5;i++){
    const y0 = Math.floor(h*i/5);
    const y1 = Math.floor(h*(i+1)/5);
    const band = document.createElement('canvas');
    band.width = w; band.height = (y1-y0);
    const bctx = band.getContext('2d');
    // small inner padding to include descenders/ascenders
    const pad=2;
    bctx.drawImage(cnv, 0, Math.max(0,y0-pad), w, Math.min(h, y1+pad)-(Math.max(0,y0-pad)), 0, 0, w, (y1-y0));
    const [norm, inv] = preprocessForOCR(band);
    const rec = async (canvas)=>{
      const { data:{ text } } = await Tesseract.recognize(canvas, 'eng', { tessedit_char_whitelist: '0123456789/', tessedit_pageseg_mode: 7 });
      return (text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    };
    const a = await rec(norm);
    const b = await rec(inv);
    // choose the line that has 2 slashes; else take the longest
    const pick = (arr)=>{
      const filt = arr.filter(s=> (s.match(/\//g)||[]).length>=2);
      if (filt.length) return filt[0];
      // pick the longest numeric-ish line
      return arr.sort((x,y)=> y.replace(/[^0-9/]/g,'').length - x.replace(/[^0-9/]/g,'').length)[0] || '';
    };
    const line = pick([...(a||[]), ...(b||[])]);
    results.push(line||'');
  }
  return results;
}

function winrateFromRows(rows){
  let w=0,l=0; rows.forEach(r=>{ if(r.result==='승') w++; else if(r.result==='패') l++; });
  const t=w+l; const wr = t? Math.round(w*1000/t)/10 : 0;
  return {w,l,wr};
}


async function deleteMatch(id){
  try{
    if(!confirm('이 매치를 삭제할까요? 되돌릴 수 없습니다.')) return;
    const res = await fetch('/api/matches/'+id, { method:'DELETE' });
    const data = await res.json();
    if(!res.ok || !data.ok){ alert(data.error||'삭제 실패'); return; }
    await loadMatches();
    if (typeof loadLeaderboard === 'function') await loadLeaderboard();
    const modal = document.getElementById('profileModal');
    if (modal && !modal.classList.contains('hidden') && currentProfileId) { await openProfile(currentProfileId); }
    alert('삭제되었습니다.');
  }catch(e){ console.error(e); alert('삭제 중 오류'); }
}
