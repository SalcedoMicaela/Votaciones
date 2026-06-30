# Sistema de fases con jurados y rúbrica — Plan de implementación

> **Para quien ejecuta:** implementar tarea por tarea. Pasos con checkbox (`- [ ]`).
> Spec: `docs/superpowers/specs/2026-06-30-jurados-fases-design.md`.

**Goal:** Agregar jurados (login usuario/clave), rúbrica /20, calificación por equipo y fases
eliminatorias con ranking combinado (nota 90% + votos 10%) y trazabilidad de votos por fase.

**Architecture:** Node/Express + MongoDB (driver nativo) en `backend/`; React + Vite + Tailwind en
`frontend/`. Se agregan colecciones `judges`, `questions`, `scores`; se añade `phase` a `votes` y
`phaseReached` a `teams`; `current_phase` en `settings`.

**Tech Stack:** Express, mongodb v6, scrypt (auth.js), socket.io, React, axios, react-router, lucide-react.

## Global Constraints
- No hay framework de pruebas: **verificación = correr el backend (`node server.js`) + llamadas a la
  API (PowerShell `Invoke-RestMethod`) y Playwright para UI.** No introducir jest/vitest.
- Contraseñas (admin y jurados) **hasheadas con scrypt** (`backend/auth.js`: `hashPassword`/`verifyPassword`).
- Mantener verde institucional ESPE (`espe-*`), íconos `lucide-react`, patrón de secciones del admin.
- El `id` siempre se devuelve como string (`_id.toString()`). `.env` no se toca (credenciales).
- Puntaje final /20 = `nota_jurados × 0.9` + `(votos/másVotado) × 2`.

---

### Task 1: db.js — colecciones, índices y `current_phase`

**Files:** Modify `backend/db.js`

**Produces:** índices de `judges`(username único, token único sparse), `scores`((judgeId,teamId,phase) único),
`votes`((email,phase) único, (deviceId,phase) único sparse); setting `current_phase='1'`.

- [ ] **Paso 1:** En `connect()`, reemplazar la creación de índices de `votes` (los simples `email_1`,
  `deviceId_1`) por **drop de los viejos + índices compuestos**, y agregar los nuevos índices:

```js
// votes: migrar de índices simples a compuestos (1 voto por fase)
const voteIdx = (await db.collection('votes').indexes()).map(i => i.name)
for (const n of ['email_1', 'deviceId_1']) {
  if (voteIdx.includes(n)) await db.collection('votes').dropIndex(n)
}
await db.collection('votes').createIndex({ email: 1, phase: 1 }, { unique: true })
await db.collection('votes').createIndex({ deviceId: 1, phase: 1 }, { unique: true, sparse: true })

// jurados, rúbrica y calificaciones
await db.collection('judges').createIndex({ username: 1 }, { unique: true })
await db.collection('judges').createIndex({ token: 1 }, { unique: true, sparse: true })
await db.collection('scores').createIndex({ judgeId: 1, teamId: 1, phase: 1 }, { unique: true })

// fase actual
await db.collection('settings').updateOne(
  { key: 'current_phase' },
  { $setOnInsert: { key: 'current_phase', value: '1' } },
  { upsert: true }
)
```

- [ ] **Paso 2:** Verificar (reiniciar backend): no debe lanzar error de índices.
  Run: `node server.js` → log "MongoDB conectado". Si hay votos viejos sin `phase`, primero
  `POST /api/admin/reset-votes` o `npm run seed -- --force`.
- [ ] **Paso 3:** Commit `feat(fases): indices de jurados/rubrica/scores y voto por fase`.

---

### Task 2: backend/auth helpers reutilizables para fase

**Files:** Create `backend/phase.js`

**Produces:** `getCurrentPhase(db) -> Promise<number>`, `setCurrentPhase(db, n)`, `computeRanking(db, phase) -> Promise<Array>`.

- [ ] **Paso 1:** Crear `backend/phase.js`:

```js
const { ObjectId } = require('mongodb')

async function getCurrentPhase(db) {
  const s = await db.collection('settings').findOne({ key: 'current_phase' })
  return parseInt(s?.value || '1', 10) || 1
}
async function setCurrentPhase(db, n) {
  await db.collection('settings').updateOne(
    { key: 'current_phase' }, { $set: { value: String(n) } }, { upsert: true })
}

// Ranking combinado de una fase: solo equipos activos (phaseReached >= phase)
async function computeRanking(db, phase) {
  const teams = (await db.collection('teams').find().sort({ createdAt: 1, _id: 1 }).toArray())
    .filter(t => (t.phaseReached || 1) >= phase)
  const ids = teams.map(t => t._id.toString())

  // votos por equipo en la fase
  const voteAgg = await db.collection('votes')
    .aggregate([{ $match: { phase } }, { $group: { _id: '$teamId', n: { $sum: 1 } } }]).toArray()
  const votos = {}; voteAgg.forEach(v => { votos[v._id] = v.n })
  const maxVotos = Math.max(0, ...ids.map(id => votos[id] || 0))

  // notas de jurados por equipo en la fase
  const scoreAgg = await db.collection('scores')
    .aggregate([{ $match: { phase } },
      { $group: { _id: '$teamId', avg: { $avg: '$total' }, n: { $sum: 1 } } }]).toArray()
  const notas = {}; scoreAgg.forEach(s => { notas[s._id] = { avg: s.avg, n: s.n } })

  const rows = teams.map(t => {
    const id = t._id.toString()
    const nota = notas[id]?.avg || 0
    const v = votos[id] || 0
    const puntosNota = nota * 0.9
    const puntosVotos = maxVotos > 0 ? (v / maxVotos) * 2 : 0
    return {
      id, name: t.name, logo: t.logo || '', eje: t.eje || '',
      notaJurados: Math.round(nota * 100) / 100,
      numJurados: notas[id]?.n || 0,
      votos: v,
      puntosNota: Math.round(puntosNota * 100) / 100,
      puntosVotos: Math.round(puntosVotos * 100) / 100,
      final: Math.round((puntosNota + puntosVotos) * 100) / 100,
    }
  })
  rows.sort((a, b) => b.final - a.final || b.notaJurados - a.notaJurados || b.votos - a.votos)
  return rows
}

module.exports = { getCurrentPhase, setCurrentPhase, computeRanking }
```

- [ ] **Paso 2:** Commit `feat(fases): helpers de fase y ranking combinado`.

---

### Task 3: vote.js — votación por fase

**Files:** Modify `backend/routes/vote.js`

**Consumes:** `getCurrentPhase` de `../phase`.
**Produces:** `GET /api/vote/teams` → `{ phase, teams:[activos] }`; voto guarda `phase`; chequeos por fase.

- [ ] **Paso 1:** Importar `const { getCurrentPhase } = require('../phase')`.
- [ ] **Paso 2:** En `computeResults(db)`, leer la fase actual, filtrar equipos activos
  (`(t.phaseReached||1) >= phase`) y contar votos con `{ phase }` en el `$match` del aggregate.
- [ ] **Paso 3:** En `POST /`: tras validar, `const phase = await getCurrentPhase(db)`;
  duplicado por `{ email, phase }` y `{ deviceId, phase }`; insertar `{ teamId, email, deviceId, ip, phase, votedAt }`.
- [ ] **Paso 4:** `GET /check` y `/check-device`: filtrar por la fase actual (`{ email, phase }`).
- [ ] **Paso 5:** Agregar `GET /teams`: devuelve `{ phase, teams }` con los equipos activos
  (campos id, name, description, eje, logo, photo, members).
- [ ] **Paso 6:** Verificar: votar → guarda phase; revotar mismo correo misma fase → 409.
  Run (PowerShell): activar votación, `POST /api/vote` con email+deviceId → success; repetir → 409.
- [ ] **Paso 7:** Commit `feat(fases): votación y resultados por fase`.

---

### Task 4: admin.js — CRUD de rúbrica (questions)

**Files:** Modify `backend/routes/admin.js`

**Produces:** `GET/POST/PUT/DELETE /api/admin/questions`.

- [ ] **Paso 1:** Agregar endpoints (protegidos con `adminAuth`, salvo el GET que puede ser público
  para mostrar el total en el panel):

```js
function mapQuestion(q){ return { id: q._id.toString(), text: q.text, maxScore: q.maxScore, order: q.order||0 } }

router.get('/questions', async (req,res)=>{ try{
  const qs = await getDb().collection('questions').find().sort({ order:1, _id:1 }).toArray()
  res.json(qs.map(mapQuestion))
}catch(e){res.status(500).json({error:e.message})}})

router.post('/questions', adminAuth, async (req,res)=>{ try{
  const { text, maxScore, order } = req.body
  if(!text || !(maxScore>0)) return res.status(400).json({error:'Texto y puntaje (>0) requeridos'})
  const doc = { text:String(text).trim(), maxScore:Number(maxScore), order:Number(order)||0, createdAt:new Date() }
  const r = await getDb().collection('questions').insertOne(doc)
  res.json(mapQuestion({ ...doc, _id:r.insertedId }))
}catch(e){res.status(500).json({error:e.message})}})

router.put('/questions/:id', adminAuth, async (req,res)=>{ try{
  if(!ObjectId.isValid(req.params.id)) return res.status(404).json({error:'No encontrada'})
  const { text, maxScore, order } = req.body
  const set = {}
  if(text!==undefined) set.text=String(text).trim()
  if(maxScore!==undefined) set.maxScore=Number(maxScore)
  if(order!==undefined) set.order=Number(order)
  await getDb().collection('questions').updateOne({_id:new ObjectId(req.params.id)},{$set:set})
  res.json({ ok:true })
}catch(e){res.status(500).json({error:e.message})}})

router.delete('/questions/:id', adminAuth, async (req,res)=>{ try{
  if(!ObjectId.isValid(req.params.id)) return res.status(404).json({error:'No encontrada'})
  await getDb().collection('questions').deleteOne({_id:new ObjectId(req.params.id)})
  res.json({ ok:true })
}catch(e){res.status(500).json({error:e.message})}})
```

- [ ] **Paso 2:** Verificar: crear 4 preguntas ×5 → GET devuelve 4, suma 20.
- [ ] **Paso 3:** Commit `feat(jurados): CRUD de rúbrica`.

---

### Task 5: admin.js — CRUD de jurados

**Files:** Modify `backend/routes/admin.js`

**Consumes:** `hashPassword` de `../auth`, `makeToken()`.
**Produces:** `GET/POST/PUT/DELETE /api/admin/judges`.

- [ ] **Paso 1:** Agregar (protegidos). `username` en minúsculas, único (409 si existe).
  No devolver `passwordHash`. `mapJudge` → `{ id, name, username }`.
  POST genera `token = makeToken()` y `passwordHash = hashPassword(password)`. PUT permite cambiar
  name/username/password (si viene). DELETE elimina. (código análogo a teams, con manejo de E11000 → 409.)
- [ ] **Paso 2:** Verificar: crear jurado `{name, username, password}` → 201; duplicado username → 409.
- [ ] **Paso 3:** Commit `feat(jurados): CRUD de jurados`.

---

### Task 6: routes/judges.js — login y calificación

**Files:** Create `backend/routes/judges.js`; Modify `backend/server.js` (montar `/api/judges`)

**Consumes:** `verifyPassword`, `getCurrentPhase`, `computeRanking`(no), `getDb`.
**Produces:** `POST /api/judges/login`, `GET /api/judges/me`, `GET /api/judges/teams`, `POST /api/judges/score`.

- [ ] **Paso 1:** `judgeAuth` middleware: lee `x-judge-token`, busca jurado por token → `req.judge`.
- [ ] **Paso 2:** `POST /login` `{username, password}`: valida con `verifyPassword`; si ok genera/garantiza
  `token` y responde `{ id, name, token }`; si no → 401 "Usuario o contraseña incorrectos".
- [ ] **Paso 3:** `GET /me` (judgeAuth) → `{ id, name }`.
- [ ] **Paso 4:** `GET /teams` (judgeAuth): `phase=getCurrentPhase`; equipos activos; `questions` (rúbrica);
  y `myScore` por equipo (score de este jurado en esta fase, o null). Responder `{ phase, questions, teams }`.
- [ ] **Paso 5:** `POST /score` (judgeAuth) `{ teamId, answers:[{questionId, points}] }`:
  validar equipo activo en la fase; acotar `points` a `[0, maxScore]` de cada pregunta;
  `total = Σ points`; `upsert` en `scores` por `{ judgeId, teamId, phase }`; responder `{ ok, total }`.
  Emitir socket `score:update`.
- [ ] **Paso 6:** En `server.js`: `app.use('/api/judges', require('./routes/judges'))`.
- [ ] **Paso 7:** Verificar: login jurado → token; POST /score → guarda; GET /teams muestra `myScore`.
- [ ] **Paso 8:** Commit `feat(jurados): login y calificación de equipos`.

---

### Task 7: admin.js — fases y ranking

**Files:** Modify `backend/routes/admin.js`

**Consumes:** `getCurrentPhase`, `setCurrentPhase`, `computeRanking` de `../phase`.
**Produces:** `GET /api/admin/phase`, `GET /api/admin/ranking?phase=N`, `POST /api/admin/advance`.

- [ ] **Paso 1:** `GET /phase` → `{ phase }`.
- [ ] **Paso 2:** `GET /ranking?phase=N` (default fase actual) → `computeRanking(db, N)`.
- [ ] **Paso 3:** `POST /advance` `{ count }` (adminAuth): `phase=getCurrentPhase`; `ranking=computeRanking(db,phase)`;
  `top = ranking.slice(0, count).map(r=>r.id)`; `updateMany({_id in top},{ $set:{ phaseReached: phase+1 }})`;
  `setCurrentPhase(phase+1)`; cerrar votación (`voting_active=false`); emitir `phase:update`.
  Validar `count>=1`. Responder `{ phase: phase+1, passed: top.length }`.
- [ ] **Paso 4:** Verificar: con notas/votos de prueba, `GET /ranking` da el orden correcto;
  `POST /advance {count:2}` deja 2 equipos con `phaseReached=2` y sube la fase.
- [ ] **Paso 5:** Commit `feat(fases): ranking y avance de fase`.

---

### Task 8: Frontend — páginas de jurado

**Files:** Create `frontend/src/pages/JudgePage.jsx`; Modify `frontend/src/App.jsx` (ruta `/jurado`)

**Consumes:** API `/api/judges/*`.
**Produces:** pantalla de login + calificación.

- [ ] **Paso 1:** `JudgePage`: si no hay `judgeToken` en localStorage → formulario login
  (usuario, contraseña) → `POST /login` → guarda token + nombre. Si hay token → vista de calificación.
- [ ] **Paso 2:** Vista calificación: `GET /teams` (header `x-judge-token`). Muestra `Fase N`, y por
  equipo una tarjeta con las preguntas (input number 0..maxScore) + total /20 + botón "Guardar"
  (`POST /score`). Marca equipos ya calificados. Botón "Salir" (borra token).
- [ ] **Paso 3:** En `App.jsx`: `<Route path="/jurado" element={<JudgePage/>} />`.
- [ ] **Paso 4:** Verificar (Playwright): login con un jurado de prueba, calificar un equipo, ver total.
- [ ] **Paso 5:** Commit `feat(jurados): pantalla de login y calificación (frontend)`.

---

### Task 9: Frontend — VotePage por fase

**Files:** Modify `frontend/src/pages/VotePage.jsx`

**Consumes:** `GET /api/vote/teams` (en vez de `/api/admin/teams`).
**Produces:** público ve solo equipos activos + etiqueta de fase.

- [ ] **Paso 1:** Cambiar la carga de equipos a `GET /api/vote/teams` (devuelve `{phase, teams}`);
  guardar `phase` en estado y mostrar "Fase N" en el hero junto al estado de votación.
- [ ] **Paso 2:** `socket.on('phase:update', ...)` → recargar equipos/fase.
- [ ] **Paso 3:** Verificar (Playwright): tras avanzar de fase, el público solo ve a los que pasaron y
  muestra "Fase 2".
- [ ] **Paso 4:** Commit `feat(fases): público por fase`.

---

### Task 10: Frontend — Admin: Jurados, Rúbrica, Fases/Ranking

**Files:** Modify `frontend/src/pages/AdminPage.jsx`

**Consumes:** API admin de questions/judges/ranking/advance.
**Produces:** 3 secciones nuevas en el menú lateral.

- [ ] **Paso 1:** Agregar al `SECTIONS` (lucide): `Jurados` (UserCog), `Rúbrica` (ClipboardList),
  `Fases` (Layers). Cargar `judges`, `questions`, `phase`, `ranking` al autenticar.
- [ ] **Paso 2:** Sección **Rúbrica**: lista de preguntas con texto + puntaje máx (editable), botón
  agregar/eliminar, y total /20 con aviso si ≠ 20.
- [ ] **Paso 3:** Sección **Jurados**: formulario (nombre, usuario, contraseña) + lista con editar/eliminar.
- [ ] **Paso 4:** Sección **Fases**: muestra fase actual; tabla de ranking en vivo (equipo, nota /20,
  votos, puntos nota, puntos votos, **final /20**, nº jurados); input "cuántos pasan" (default 10) +
  botón "Cerrar fase y avanzar" (con confirmación); selector de fase para ver historial (`GET /ranking?phase=N`).
  Suscribir socket `score:update` y `vote:update` para refrescar el ranking.
- [ ] **Paso 5:** Verificar (Playwright): crear rúbrica + jurado, calificar (desde /jurado), ver ranking
  en el admin con el puntaje final correcto, avanzar de fase.
- [ ] **Paso 6:** Commit `feat(fases): secciones de jurados, rúbrica y fases en el admin`.

---

## Self-Review (cobertura del spec)
- Jurados (usuario/clave): Tasks 5,6,8,10 ✓
- Rúbrica /20: Tasks 4,8,10 ✓
- Calificación por equipo/fase: Tasks 2,6,8 ✓
- Ranking combinado 90/10 relativo al más votado: Task 2 (fórmula) ✓
- Voto por fase + trazabilidad: Tasks 1,3 ✓
- Avance configurable (default 10): Task 7,10 ✓
- Público por fase: Tasks 3,9 ✓
- Manejo de errores (401/409/400/403): Tasks 4,5,6,7 ✓
