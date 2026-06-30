# Sistema de fases con jurados y rúbrica — Diseño

Fecha: 2026-06-30
Proyecto: Sistema de Votaciones (Club de Emprendimiento ESPE)

## 1. Objetivo

Agregar un sistema de **calificación por jurados** y **fases eliminatorias** al sistema de
votaciones existente. En cada fase, los jurados califican el pitch de cada equipo con una
**rúbrica (preguntas /20)** y, en paralelo, el público vota. Al cerrar la fase, los mejores
equipos (según un puntaje combinado) **pasan a la siguiente fase** y el ciclo se repite. Los
votos y notas de cada fase se conservan (trazabilidad).

## 2. Decisiones tomadas

- **Acceso de jurados:** usuario y contraseña por jurado.
- **Puntaje final (sobre 20):** `nota_jurados × 0.9` (hasta 18) + `votos_relativos × 2` (hasta 2).
- **Voto del público:** 1 voto por persona **por fase** (puede volver a votar en la fase siguiente).
- **Cuántos pasan de fase:** configurable por el admin al cerrar la fase (por defecto 10).
- **Rúbrica:** global (las mismas preguntas para todos los jurados y todas las fases).

## 3. Modelo de datos (MongoDB, base `votaciones-empremd`)

### Colecciones nuevas

**`judges`**
```
{ _id, name, username (único, minúsculas), passwordHash, token, createdAt }
```
- `passwordHash`: scrypt (reutiliza `backend/auth.js`).
- `token`: aleatorio (32 hex). Es la "sesión" del jurado tras hacer login; se manda en el header `x-judge-token` para calificar.
- Índice único en `username`. Índice único (sparse) en `token`.

**`questions`** (rúbrica)
```
{ _id, text, maxScore (number > 0), order (number), createdAt }
```
- La suma de `maxScore` **debería** dar 20. El backend NO bloquea si no cuadra, pero el panel
  muestra el total y avisa cuando ≠ 20.

**`scores`**
```
{ _id, judgeId (string), teamId (string), phase (number),
  answers: [{ questionId (string), points (number) }],
  total (number), updatedAt }
```
- Único compuesto en **(judgeId, teamId, phase)**: un jurado califica a cada equipo una vez por
  fase (editable; se hace `upsert`).
- `total` = suma de `points`, acotado a `[0, maxScore]` por pregunta. Máximo 20.

### Cambios a colecciones existentes

**`teams`**: agregar
- `phaseReached` (number, default 1). Un equipo está **activo en la fase P** si `phaseReached ≥ P`.

**`votes`**: agregar
- `phase` (number).
- Cambiar índices únicos: de `{email}` y `{deviceId}` a **compuestos**:
  - `{ email: 1, phase: 1 }` único
  - `{ deviceId: 1, phase: 1 }` único, sparse
- Migración: los votos existentes (sin `phase`) se reinician antes de habilitar fases
  (el evento aún no inicia; se usa el botón "Reiniciar votación" o un script). Documentado en el plan.

**`settings`**: agregar
- `{ key: 'current_phase', value: '1' }` (string, como los demás settings). Default 1.

## 4. Cálculo del ranking (por fase)

Para una fase `P`, considerando solo equipos **activos** (`phaseReached ≥ P`):

```
nota_jurados(equipo) = promedio de los "total" de los scores {teamId, phase=P} de TODOS los jurados
                       que lo calificaron. Si nadie lo calificó → 0.
votos(equipo)        = nº de documentos en `votes` con {teamId, phase=P}.
maxVotos             = máximo de votos(equipo) entre los equipos activos de la fase P.

puntos_nota(equipo)  = nota_jurados(equipo) × 0.9                 // 0–18
puntos_votos(equipo) = maxVotos > 0 ? (votos(equipo) / maxVotos) × 2 : 0   // 0–2
PUNTAJE_FINAL        = puntos_nota + puntos_votos                 // 0–20
```

Orden del ranking: `PUNTAJE_FINAL` descendente. Empate: mayor `nota_jurados`, luego más `votos`.

El endpoint de ranking devuelve, por equipo: `notaJurados`, `puntosNota`, `votos`, `puntosVotos`,
`final`, y `numJurados` (cuántos lo calificaron), para que el panel muestre el desglose.

## 5. Avance de fase

Endpoint `POST /api/admin/advance` con `{ count }` (default 10), protegido por admin:
1. Calcula el ranking de `current_phase` entre los equipos activos.
2. A los **top `count`** les pone `phaseReached = current_phase + 1`.
3. Incrementa `current_phase`.
4. Pone `voting_active = false` (la votación se reabre manualmente en la nueva fase).
5. Emite por socket `phase:update` con la nueva fase.

Los votos y scores de fases anteriores **no se tocan** (quedan con su `phase`). Trazabilidad: el
panel puede consultar el ranking de cualquier fase pasada (`GET /api/admin/ranking?phase=N`).

No hay "deshacer avance" automático (fuera de alcance); si se necesita corregir, se hace en BD.

## 6. Backend — rutas

**`routes/judges.js`** (nuevo, montado en `/api/judges`):
- `POST /login` — `{ username, password }` → valida → `{ id, name, token }`.
- `GET /me` — header `x-judge-token` → `{ id, name }` (valida sesión).
- `GET /teams` — header `x-judge-token` → `{ phase, questions, teams: [{ id, name, logo, eje, members, myScore }] }`
  (equipos activos de la fase actual + rúbrica + la nota que ESTE jurado ya puso a cada uno).
- `POST /score` — header `x-judge-token` → `{ teamId, answers:[{questionId, points}] }` → upsert score de la fase actual.

**`routes/admin.js`** (agregar, protegido por admin):
- Jurados: `GET /judges`, `POST /judges` `{name, username, password}`, `PUT /judges/:id`, `DELETE /judges/:id`.
- Rúbrica: `GET /questions`, `POST /questions` `{text, maxScore}`, `PUT /questions/:id`, `DELETE /questions/:id`.
- Fases: `GET /phase` → `{ phase }`; `POST /advance` `{count}`; `GET /ranking?phase=N` → ranking con desglose.

**`routes/vote.js`** (ajustar a fases):
- `computeResults` y `POST /` usan `current_phase`: el voto guarda `phase = current_phase`; el chequeo
  de duplicado es por `{email, phase}` y `{deviceId, phase}`; los resultados cuentan solo la fase actual.
- `GET /results`, `/check`, `/check-device` consideran la fase actual.
- Los equipos mostrados al público y en resultados son solo los **activos** de la fase actual.

El CRUD de la rúbrica vive dentro de `routes/admin.js` (no hay archivo `questions.js` aparte).
El jurado recibe la rúbrica vía `GET /api/judges/teams`. No se expone una rúbrica pública aparte.

**`db.js`**: crear índices nuevos (`judges`, `scores`, `questions`, índices compuestos de `votes`),
sembrar `current_phase = 1`. Migrar índices viejos de `votes` (email/deviceId simples → compuestos).

## 7. Frontend — pantallas

**Jurado** (rutas nuevas en `App.jsx`):
- `/jurado` — login (usuario + contraseña). Guarda `judgeToken` en localStorage.
- `/jurado/calificar` — lista de equipos activos; por equipo, tarjeta con las preguntas y un input
  numérico por pregunta (0..maxScore); botón "Guardar". Indica a quién ya calificó y el total /20.
  Componente nuevo `pages/JudgeLoginPage.jsx` y `pages/JudgeScorePage.jsx` (o uno solo con estados).

**Público (`VotePage`)**:
- Muestra `Fase N` en el hero. Solo equipos activos de la fase actual.
- Voto por fase (los endpoints ya lo manejan). El texto de "ya votaste" aplica a la fase actual.

**Admin** — 3 secciones nuevas en el menú lateral (`AdminPage.jsx`):
- **Jurados**: CRUD (nombre, usuario, contraseña). Lista + alta/edición/baja.
- **Rúbrica**: CRUD de preguntas (texto + puntaje máx), con total /20 y aviso si ≠ 20.
- **Fases / Ranking**: fase actual; tabla de ranking en vivo (nota, votos, puntaje final, nº jurados);
  input "cuántos pasan" + botón "Cerrar fase y avanzar" (con confirmación); selector para ver el
  ranking de fases anteriores (historial / trazabilidad).

Se reutiliza el verde institucional ESPE, los íconos lucide y el patrón de tarjetas/secciones actual.

## 8. Manejo de errores

- Login de jurado incorrecto → 401, el front muestra "Usuario o contraseña incorrectos".
- Calificar sin sesión válida (token) → 401.
- Calificar un equipo no activo en la fase actual → 400.
- Puntos fuera de rango (>maxScore o <0) → se acotan en el backend.
- `username` de jurado duplicado → 409 "Ese usuario ya existe".
- Avanzar de fase sin equipos / count inválido → 400 con mensaje claro.
- Votar cuando la votación está cerrada → 403 (ya existe).

## 9. Pruebas (verificación)

- Crear jurado → login OK / clave mala → 401.
- Crear rúbrica (ej. 4 preguntas × 5 = 20) → total muestra 20.
- Jurado califica 2 equipos → `scores` guarda total correcto; re-calificar actualiza (no duplica).
- Ranking: con notas + votos, el puntaje final coincide con la fórmula (probar con números conocidos:
  equipo con nota 20 y más votado → 18 + 2 = 20).
- Voto por fase: una persona vota en fase 1; al avanzar a fase 2 puede votar de nuevo; los votos de
  fase 1 siguen contabilizados al consultar `?phase=1`.
- Avanzar: top N quedan con `phaseReached=2`, los demás no; el público en fase 2 solo ve a los que pasaron.
- 0 errores de consola en las pantallas nuevas.

## 10. Fuera de alcance (YAGNI)

- Deshacer un avance de fase desde la UI (se corrige en BD si hace falta).
- Rúbrica distinta por fase (la rúbrica es global).
- Reportes/exportación PDF del ranking (se puede imprimir la vista si se requiere luego).
