
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data.json');
const adapter = new JSONFile('data.json');
const db = new Low(adapter, { players: [], matches: [], rating_history: [] });

async function init() {
  await db.read();
  db.data ||= { players: [], matches: [], rating_history: [] };
  for (const p of db.data.players) {
    if (p.win_streak == null) p.win_streak = 0;
    if (p.lose_streak == null) p.lose_streak = 0;
    if (p.rating == null) p.rating = 1000;
  }
  await db.write();
}
init();

app.use(cors());
app.use(express.json({ limit:'10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

function nextId(list) { let m=0; for (const it of list) m=Math.max(m, it.id||0); return m+1; }

function applyCustomRatingChange(player, didWin) {
  let delta = didWin ? 20 : -20;
  const ws = player.win_streak || 0, ls = player.lose_streak || 0;
  if (didWin && ws >= 2) delta += 5;
  if (!didWin && ls >= 2) delta -= 5;
  player.rating = (player.rating || 1000) + delta;
  if (didWin) { player.wins=(player.wins||0)+1; player.win_streak=(player.win_streak||0)+1; player.lose_streak=0; }
  else { player.losses=(player.losses||0)+1; player.lose_streak=(player.lose_streak||0)+1; player.win_streak=0; }
  return delta;
}

async function recomputeAll(){
  await db.read();
  db.data.players = db.data.players.map(p=>({ ...p, rating:1000, wins:0, losses:0, win_streak:0, lose_streak:0 }));
  db.data.rating_history = [];
  const idToPlayer = new Map(db.data.players.map(p=>[p.id,p]));
  const matches = [...db.data.matches].sort((a,b)=> a.id-b.id);
  for(const m of matches){
    const winnerA = m.winner==='A';
    for(const e of m.team_a){
      const p = idToPlayer.get(e.id);
      const delta = applyCustomRatingChange(p, winnerA);
      db.data.rating_history.push({ id: nextId(db.data.rating_history), player_id:p.id, match_id:m.id, rating_after:p.rating, delta, date:new Date().toISOString() });
    }
    for(const e of m.team_b){
      const p = idToPlayer.get(e.id);
      const delta = applyCustomRatingChange(p, !winnerA);
      db.data.rating_history.push({ id: nextId(db.data.rating_history), player_id:p.id, match_id:m.id, rating_after:p.rating, delta, date:new Date().toISOString() });
    }
  }
  await db.write();
}


// players
app.get('/api/players', async (req,res)=>{ await db.read(); res.json([...db.data.players].sort((a,b)=> b.rating-a.rating || a.name.localeCompare(b.name))); });
app.post('/api/players', async (req,res)=>{ await db.read(); const {name}=req.body; if(!name) return res.status(400).json({error:'이름 필요'});
  if (db.data.players.some(p=>p.name===name)) return res.status(200).json({ id: db.data.players.find(p=>p.name===name).id, existed:true });
  const id = nextId(db.data.players);
  db.data.players.push({ id, name, rating:1000, wins:0, losses:0, win_streak:0, lose_streak:0, created_at:new Date().toISOString() });
  await db.write(); res.json({ id, created:true });
});
app.put('/api/players/:id', async (req,res)=>{ await db.read(); const id=Number(req.params.id); const p=db.data.players.find(p=>p.id===id);
  if(!p) return res.status(404).json({error:'not found'}); const {name}=req.body; p.name=name; await db.write(); res.json({ok:true});
});
app.delete('/api/players/:id', async (req,res)=>{ await db.read(); const id=Number(req.params.id); db.data.players=db.data.players.filter(p=>p.id!==id); await db.write(); res.json({ok:true}); });

// matches
app.get('/api/matches', async (req,res)=>{ await db.read(); res.json([...db.data.matches].sort((a,b)=> b.id-a.id)); });
app.post('/api/matches', async (req,res)=>{
  await db.read();
  const { date, winner, teamA, teamB, notes } = req.body;
  if (winner !== 'A' && winner !== 'B') return res.status(400).json({ error: '승자 선택 필요(A/B)' });
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length===0 || teamB.length===0) return res.status(400).json({ error: '팀 인원이 잘못되었습니다.' });
  const idByName = new Map(db.data.players.map(p=>[p.name, p.id]));
  const idExists = new Set(db.data.players.map(p=>p.id));
  const ensureId = (e)=>{
    if (e.id && idExists.has(e.id)) return e.id;
    if (e.name && idByName.has(e.name)) { e.id = idByName.get(e.name); return e.id; }
    if (e.name) {
      const id = nextId(db.data.players);
      db.data.players.push({ id, name:e.name, rating:1000, wins:0, losses:0, win_streak:0, lose_streak:0, created_at:new Date().toISOString() });
      idByName.set(e.name, id); idExists.add(id); e.id = id; return id;
    }
    const id = nextId(db.data.players);
    db.data.players.push({ id, name:`player_${id}`, rating:1000, wins:0, losses:0, win_streak:0, lose_streak:0, created_at:new Date().toISOString() });
    idExists.add(id); e.id=id; return id;
  };
  [...teamA, ...teamB].forEach(ensureId);

  const matchId = nextId(db.data.matches);
  db.data.matches.push({ id:matchId, date: date||new Date().toISOString().slice(0,10), winner, team_a: teamA, team_b: teamB, notes: notes||null });

  const winnerA = winner==='A';
  const idToPlayer = new Map(db.data.players.map(p=>[p.id,p]));
  for (const e of teamA) { const p = idToPlayer.get(e.id); const delta = applyCustomRatingChange(p, winnerA);
    db.data.rating_history.push({ id: nextId(db.data.rating_history), player_id:p.id, match_id:matchId, rating_after:p.rating, delta, date:new Date().toISOString() });
  }
  for (const e of teamB) { const p = idToPlayer.get(e.id); const delta = applyCustomRatingChange(p, !winnerA);
    db.data.rating_history.push({ id: nextId(db.data.rating_history), player_id:p.id, match_id:matchId, rating_after:p.rating, delta, date:new Date().toISOString() });
  }

  await db.write();
  res.json({ ok:true, id:matchId });
});

app.get('/api/leaderboard', async (req,res)=>{ await db.read();
  const rows=[...db.data.players].sort((a,b)=> b.rating-a.rating);
  res.json(rows.map(p=>({ id:p.id, name:p.name, rating:p.rating, wins:p.wins, losses:p.losses, win_streak:p.win_streak||0, lose_streak:p.lose_streak||0 })));
});
app.get('/api/rating-history/:playerId', async (req,res)=>{ await db.read(); const pid=Number(req.params.playerId);
  const rows=db.data.rating_history.filter(h=>h.player_id===pid).sort((a,b)=> a.id-b.id);
  res.json(rows.map(h=>({ matchId:h.match_id, rating:h.rating_after, delta:h.delta, date:h.date })));
});
app.get('/api/player/:playerId/matches', async (req,res)=>{
  await db.read();
  const pid = Number(req.params.playerId);
  const nameMap = new Map(db.data.players.map(p=>[p.id,p.name]));
  const results = [];
  for (const m of db.data.matches) {
    const a = m.team_a.find(x=>x.id===pid);
    const b = m.team_b.find(x=>x.id===pid);
    if (!a && !b) continue;
    const isA = !!a;
    const me = isA ? a : b;
    const team = isA ? '블루' : '레드';
    const win = (m.winner === 'A' && isA) || (m.winner === 'B' && !isA);
    const teammatesArr = (isA ? m.team_a : m.team_b).filter(x=>x.id!==pid).map(x=>({ id:x.id, name:nameMap.get(x.id)||String(x.id), champ:x.champ||'', k:x.k??'', d:x.d??'', a:x.a??'' }));
    const opponentsArr = (isA ? m.team_b : m.team_a).map(x=>({ id:x.id, name:nameMap.get(x.id)||String(x.id), champ:x.champ||'', k:x.k??'', d:x.d??'', a:x.a??'' }));
    const hist = db.data.rating_history.find(h => h.player_id===pid && h.match_id===m.id);
    results.push({ matchId:m.id, date:m.date, team, role:me.role||'', champ:me.champ||'', k:me.k??null, d:me.d??null, a:me.a??null,
      result: win ? '승' : '패', delta: hist?.delta ?? 0, ratingAfter: hist?.rating_after ?? null,
      teammates: teammatesArr, opponents: opponentsArr, me: { name:nameMap.get(pid)||String(pid), champ:me.champ||'', k:me.k??'', d:me.d??'', a:me.a??'' }, notes: m.notes||'' });
  }
  results.sort((x,y)=> y.matchId - x.matchId);
  res.json(results);
});

app.get('/api/export', async (req,res)=>{ await db.read(); res.json(db.data); });
app.get('/api/health', (req,res)=>res.json({ok:true,time:new Date().toISOString()}));

app.listen(PORT, ()=> console.log(`LoL scrim tracker v5.2.2 running on http://localhost:${PORT}`));


app.delete('/api/matches/:id', async (req,res)=>{
  await db.read();
  const id = Number(req.params.id);
  const before = db.data.matches.length;
  db.data.matches = db.data.matches.filter(m=>m.id!==id);
  if (db.data.matches.length === before) return res.status(404).json({error:'not found'});
  db.data.rating_history = db.data.rating_history.filter(h=>h.match_id!==id);
  await db.write();
  await recomputeAll();
  res.json({ ok:true });
});
