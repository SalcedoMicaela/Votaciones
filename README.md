# Sistema de Votaciones - Club de Emprendimiento ESPE

Sistema de votación electrónica para el **Club de Emprendimiento** de la **Universidad de las Fuerzas Armadas ESPE**, desarrollado para el Departamento de Ciencias Económicas, Administrativas y del Comercio (DCEA).

Los estudiantes votan por proyectos de emprendimiento usando su correo institucional `@espe.edu.ec` con restricción por IP (1 voto por persona).

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + Vite + React Router v6 + Tailwind CSS |
| **Backend** | Node.js + Express + Socket.IO |
| **Base de datos** | MongoDB (driver nativo, sin Mongoose) |
| **Tiempo real** | Socket.IO (actualización de votos en vivo) |
| **Autenticación admin** | scrypt (hash + salt, nativo de Node) |
| **Despliegue** | Frontend → Vercel · Backend → Render |

---

## Estructura del proyecto

```
Proyecto/
├── backend/
│   ├── server.js          # Entry point Express + Socket.IO
│   ├── db.js              # Conexión MongoDB + índices + seed de settings
│   ├── auth.js            # Hash/verificación de contraseña con scrypt
│   ├── seed.js            # Seed de equipos desde JSON
│   ├── data/miembros.json # Datos de integrantes por equipo
│   ├── routes/
│   │   ├── admin.js       # CRUD de equipos, toggle de votación, links
│   │   ├── vote.js        # Votación, resultados, verificación email/IP
│   │   └── upload.js      # Subida de logo/foto por token
│   ├── .env.example
│   ├── render.yaml
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.jsx        # Entry point (BrowserRouter)
    │   ├── App.jsx         # Layout + rutas
    │   ├── socket.js       # Cliente Socket.IO
    │   ├── pages/
    │   │   ├── VotePage.jsx       # Página principal de votación
    │   │   ├── VoteTeamPage.jsx   # Voto directo por equipo (QR)
    │   │   ├── ResultsPage.jsx    # Resultados en vivo (podio + ranking)
    │   │   ├── AdminPage.jsx      # Panel de administración
    │   │   └── UploadPage.jsx     # Subida de imágenes por token
    │   ├── components/
    │   │   ├── TeamCard.jsx       # Tarjeta de equipo
    │   │   ├── AdminLogin.jsx     # Formulario de autenticación
    │   │   ├── Logo.jsx          # Logo institucional
    │   │   └── LogoBar.jsx       # Barra de logos
    │   └── utils/
    │       ├── eje.js     # Configuración de ejes temáticos
    │       ├── image.js   # Redimensionamiento de imágenes
    │       └── qr.js      # Descarga de QR y enlaces WhatsApp
    ├── .env
    ├── tailwind.config.js
    ├── vite.config.js
    └── package.json
```

---

## Requisitos

- Node.js >= 18
- MongoDB (local o Atlas)

---

## Instalación y configuración

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd Proyecto
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # Configurar variables de entorno
npm install
npm run seed           # Poblar la base de datos con equipos
npm run dev            # Servidor en http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # Ajustar VITE_API_URL si es necesario
npm install
npm run dev            # http://localhost:5173
```

---

## Variables de entorno

### Backend (`.env`)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `MONGO` | URI de conexión MongoDB | `mongodb://localhost:27017` |
| `MONGO_DB` | Nombre de la base de datos | `votaciones-empremd` |
| `ADMIN_PASSWORD` | Contraseña inicial del admin | `admin123` |
| `PORT` | Puerto del servidor | `3000` |

### Frontend (`.env`)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `VITE_API_URL` | URL del backend | `http://localhost:3000` |
| `VITE_FRONTEND_URL` | URL del frontend | `window.location.origin` |

---

## API

### Públicas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/teams` | Listar todos los equipos |
| `GET` | `/api/admin/status` | Estado de la votación (`votingActive`) |
| `GET` | `/api/vote/results` | Resultados con conteo de votos |
| `GET` | `/api/vote/check?email=` | Verificar si un email ya votó |
| `GET` | `/api/vote/check-ip` | Verificar si la IP ya votó |
| `POST` | `/api/vote` | Emitir voto `{ teamId, email }` |
| `GET` | `/api/upload/:token` | Obtener datos del equipo por token |
| `POST` | `/api/upload/:token` | Subir logo/foto del equipo |
| `GET` | `/api/health` | Health check |

### Protegidas (requieren header `x-admin-password`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/admin/login` | Validar contraseña |
| `POST` | `/api/admin/password` | Cambiar contraseña |
| `POST` | `/api/admin/teams` | Crear equipo |
| `PUT` | `/api/admin/teams/:id` | Editar equipo |
| `DELETE` | `/api/admin/teams/:id` | Eliminar equipo (+ sus votos) |
| `GET` | `/api/admin/links` | Obtener tokens de subida |
| `POST` | `/api/admin/toggle` | Abrir/cerrar votación |
| `POST` | `/api/admin/reset-votes` | Reiniciar votación |

---

## Reglas de votación

1. La votación debe estar **activada** por el administrador
2. El votante debe usar su **correo institucional** `@espe.edu.ec`
3. **1 voto por email** (índice único en MongoDB)
4. **1 voto por IP** (índice único en MongoDB) — impide votar desde otro navegador o dispositivo en la misma red
5. No se puede cambiar el voto después de emitido

---

## Panel de administración

Ruta: `/admin`

Secciones:
- **Resumen** — Estadísticas generales y ranking en vivo
- **Equipos** — CRUD completo (nombre, eje temático, descripción, integrantes, imágenes)
- **Votación** — Activar/desactivar votación, reiniciar votos
- **QR y enlaces** — Generar códigos QR de voto directo y link de subida por equipo
- **Configuración** — Cambiar contraseña de administrador

---

## Ejes temáticos

| Eje | Descripción |
|-----|-------------|
| **Eje 1** | Seguridad y Defensa Tecnológica |
| **Eje 2** | Sostenibilidad y Green University |

---

## Despliegue

### Backend (Render)

```yaml
# render.yaml incluido en el proyecto
services:
  - type: web
    name: voting-system-backend
    env: node
    buildCommand: npm install
    startCommand: node server.js
```

Variables de entorno secretas: `MONGO`, `MONGO_DB`, `ADMIN_PASSWORD`

### Frontend (Vercel)

Conectar repositorio y configurar:
- `VITE_API_URL` = URL del backend en Render
- `VITE_FRONTEND_URL` = URL del frontend en Vercel

---

## Seed de datos

```bash
cd backend
npm run seed            # Inserta equipos (solo si la BD está vacía)
npm run seed -- --force # Reemplaza todos los equipos existentes
```

Los datos provienen de:
- 14 proyectos hardcodeados con nombre, eje, docente y descripción
- `data/miembros.json` con los integrantes por equipo
