require('dotenv').config()
const crypto = require('crypto')
const { connect, getDb, client } = require('./db')

// Token secreto aleatorio para el link de subida de imágenes de cada equipo
function makeToken() {
  return crypto.randomBytes(16).toString('hex')
}

// Integrantes por equipo (Hoja 2 "DATOS GRUPALES"): nombre, carrera, correo
const rosters = require('./data/miembros.json')

// Normaliza nombres para emparejar proyectos (Hoja 1) con rosters (Hoja 2)
function norm(s) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Proyectos tomados de la Hoja 1 (respuestas del formulario)
const projects = [
  {
    name: 'NET GUARDIAN SAE',
    eje: 'Eje 1: Seguridad y Defensa Tecnológica',
    docente: 'Ing. Isabel Pilicita Mgtr.',
    descripcion: 'Plataforma de monitoreo para ISPs.',
  },
  {
    name: 'RAIZ',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Paola Andrea Suárez Torres',
    descripcion:
      'El proyecto facilita el acceso de productores y consumidores a alimentos de calidad, contribuyendo a la reducción de costos en la cadena de comercialización y promoviendo una mayor eficiencia en la distribución de los productos. Se alinea con los Objetivos de Desarrollo Sostenible (ODS), especialmente con el ODS 1 (Fin de la pobreza), el ODS 8 (Trabajo decente y crecimiento económico), el ODS 10 (Reducción de las desigualdades) y el ODS 12 (Producción y consumo responsables).',
  },
  {
    name: 'InverNova',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Paola Suárez',
    descripcion:
      'Invernadero inteligente y armable que soluciona el problema del acceso a la alimentación saludable, reduce costos y ahorra en la compra de productos perecibles de la canasta básica familiar, además de reducir la contaminación por químicos en los cultivos. Aborda los ODS 2, 3, 11 y 12.',
  },
  {
    name: 'Robot soccer',
    eje: 'Eje 1: Seguridad y Defensa Tecnológica',
    docente: 'Ing. Isabel Pilicita Mgtr.',
    descripcion: 'Implementación de tecnología con aplicación de sistemas de control.',
  },
  {
    name: 'Campus Flow',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Rocío del Carmen Orbe Cajas',
    descripcion:
      'El problema principal de la comunidad universitaria de la ESPE es la saturación del parqueadero debido al ingreso masivo de automóviles con un solo ocupante, lo que genera pérdidas de tiempo, estrés y gasto extra en combustible. Campus Flow es una plataforma digital e institucional de movilidad universitaria compartida enfocada en la seguridad y la sostenibilidad. Opera como un sistema cerrado que exige el correo institucional (@espe.edu.ec), automatiza el emparejamiento de rutas, ofrece perfiles con reputación y premia la optimización de asientos vacíos mediante "Eco-Puntos" canjeables.',
  },
  {
    name: 'Smart Tag',
    eje: 'Eje 1: Seguridad y Defensa Tecnológica',
    docente: 'Ing. Amparo Pilicita',
    descripcion:
      'Smart Tag es un dispositivo inteligente de rastreo y localización diseñado para ayudar a proteger y recuperar objetos personales de manera rápida y segura. Se adapta a las plataformas Find My de Apple y Find Hub de Android; su tamaño es ligero y compacto.',
  },
  {
    name: 'SEGUR',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Edison Sarzosa',
    descripcion:
      'Plataforma tecnológica orientada a mejorar la seguridad en buses mediante monitoreo inteligente de cámaras de vigilancia, alertas y gestión de incidentes con respuesta temprana de autoridades.',
  },
  {
    name: 'SecondGo',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Edison Sarzosa',
    descripcion:
      'SecondGo es una empresa dedicada al desarrollo de una aplicación móvil que facilita la compra y venta de ropa de segunda mano, promoviendo la sostenibilidad y la economía circular mediante el uso de tecnologías innovadoras.',
  },
  {
    name: "Croki's",
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Ing. César Ricardo Segovia Guerrero MPDE',
    descripcion:
      'Producto de harina de hongo (Hongo Ostra), una alternativa nutricional en proteínas y vitaminas, de fácil producción y crecimiento, orgánica y sana para las personas que tienen intolerancia al gluten.',
  },
  {
    name: 'ROBODELIVERY',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Luis Alfredo Tipán Tapia',
    descripcion:
      'En el contexto de entregas, busca solucionar los retrasos, los riesgos de los repartidores y la necesidad de servicios más eficientes e innovadores mediante el uso de robots autónomos para realizar entregas seguras y en el menor tiempo posible.',
  },
  {
    name: 'Agroconecta',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Rocío del Carmen Orbe Cajas',
    descripcion:
      'AgroConecta es una plataforma digital que conecta directamente a pequeños agricultores con consumidores urbanos mediante WhatsApp, logística compartida y trazabilidad con códigos QR. Su objetivo es eliminar intermediarios, garantizar precios justos y pagos rápidos para los productores, mientras ofrece a los consumidores alimentos frescos con información transparente sobre su origen e impacto social.',
  },
  {
    name: 'Lytos',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Rocío del Carmen Orbe Cajas',
    descripcion:
      'LYTOS resuelve la mala clasificación de residuos mediante un basurero inteligente que facilita el reciclaje y reduce la carga operativa.',
  },
  {
    name: 'HydroVerde',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Luis Tapia',
    descripcion:
      'Sistema hidropónico a base de materiales reciclados, con cultivos hidropónicos orgánicos libres de pesticidas.',
  },
  {
    name: 'NOVABAG',
    eje: 'Eje 1: Seguridad y Defensa Tecnológica',
    docente: 'Mercedes Montero',
    descripcion:
      'NovaBag nace como una solución innovadora a los problemas de inseguridad, pérdida de pertenencias y falta de opciones sostenibles que enfrentan estudiantes y usuarios del transporte público. Esta mochila inteligente integra GPS en tiempo real, bloqueo biométrico y alarmas conectadas al celular, además de un panel solar portátil y materiales reciclados e impermeables. Combina seguridad, tecnología y sostenibilidad en un solo producto.',
  },
  {
    name: 'BIENESTAR 360',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Mercedes Montero',
    descripcion:
      'El proyecto responde a una necesidad identificada mediante una encuesta aplicada a estudiantes de la ESPE: el 84,3% considera importante cuidar su salud mental, el 52,6% siente estrés o cansancio emocional con frecuencia y el 94,7% usaría una plataforma digital con psicólogos certificados, ejercicios de autogestión emocional y comunidad de apoyo.',
  },
  {
    name: 'SKYGREEN',
    eje: 'Eje 2: Sostenibilidad y Green University',
    docente: 'Mercedes Montero',
    descripcion:
      'En Ecuador existe una creciente tendencia hacia la implementación de infraestructura verde impulsada por políticas ambientales y programas de sostenibilidad. Los techos verdes contribuyen a disminuir el efecto de isla de calor urbana, optimizan el manejo de aguas lluvias y generan espacios de bienestar para la comunidad. SkyGreen aprovecha esta oportunidad mediante el diseño e instalación de sistemas modulares adaptados a las condiciones climáticas del país.',
  },
]

function buildDescription(p) {
  return `Docente: ${p.docente}\n\n${p.descripcion}`
}

async function run() {
  await connect()
  const db = getDb()
  const teams = db.collection('teams')

  // Ejes temáticos por defecto
  const ejesCount = await db.collection('ejes').countDocuments()
  if (ejesCount === 0) {
    await db.collection('ejes').insertMany([
      { name: 'Eje 1: Seguridad y Defensa Tecnológica', shortName: 'Seguridad y Defensa', icon: 'ShieldCheck', color: 'sky', order: 1, createdAt: new Date() },
      { name: 'Eje 2: Sostenibilidad y Green University', shortName: 'Sostenibilidad', icon: 'Leaf', color: 'emerald', order: 2, createdAt: new Date() },
    ])
    console.log('✓ Ejes temáticos por defecto insertados')
  }

  const force = process.argv.includes('--force')
  const count = await teams.countDocuments()

  if (count > 0 && !force) {
    console.log(
      `Ya existen ${count} equipos en la base de datos. Usa "npm run seed -- --force" para reemplazarlos.`
    )
    await client.close()
    return
  }

  if (count > 0 && force) {
    await teams.deleteMany({})
    await db.collection('votes').deleteMany({})
    await db.collection('scores').deleteMany({})
    console.log('Equipos, votos y calificaciones anteriores eliminados (--force).')
  }

  // Mapa de rosters (Hoja 2) por nombre normalizado
  const rosterByName = {}
  rosters.forEach(r => { rosterByName[norm(r.name)] = r.members })

  const now = Date.now()

  // Equipos de la Hoja 1 (con descripción) + sus integrantes si coinciden
  const docs = projects.map((p, i) => ({
    name: p.name,
    description: buildDescription(p),
    eje: p.eje,
    whatsapp: '0991267695',
    link: '',
    uploadToken: makeToken(),
    members: rosterByName[norm(p.name)] || [],
    // createdAt incremental para preservar el orden de la hoja
    createdAt: new Date(now + i),
  }))

  // Rosters sin proyecto en la Hoja 1 -> se agregan como equipos nuevos
  const projectNames = new Set(projects.map(p => norm(p.name)))
  const huerfanos = rosters.filter(r => !projectNames.has(norm(r.name)))
  huerfanos.forEach((r, j) => {
    docs.push({
      name: r.name,
      description: '',
      eje: '',
      whatsapp: '0991267695',
      link: '',
      uploadToken: makeToken(),
      members: r.members,
      createdAt: new Date(now + projects.length + j),
    })
  })

  await teams.insertMany(docs)
  const totalMiembros = docs.reduce((s, d) => s + d.members.length, 0)
  console.log(`✓ ${docs.length} equipos cargados en "${db.databaseName}" (${projects.length} con proyecto + ${huerfanos.length} solo-roster).`)
  console.log(`✓ ${totalMiembros} integrantes asignados.`)
  if (huerfanos.length) {
    console.log(`  Equipos agregados desde la Hoja 2: ${huerfanos.map(h => h.name).join(', ')}`)
  }

  await client.close()
}

run().catch(err => {
  console.error('Error al ejecutar el seed:', err)
  process.exit(1)
})
