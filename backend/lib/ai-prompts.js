import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

const MAX_CUSTOM_PROMPTS = 20;

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(import.meta.dirname, "..", "..", "data");

const ROLE_FILES = {
  system: "trainer-system-prompt.txt",
  titles: "session-titles-system-prompt.txt",
  chat: "trainer-chat-system-prompt.txt",
};

const ROLE_FALLBACK = {
  system:
    "Eres un entrenador personal de triatlón especializado en Ironman 70.3. Analiza las sesiones del atleta y genera planes progresivos.\n\nFORMATO DE RESPUESTA\n\nDebes responder únicamente con un JSON válido con esta estructura: { \"comments\": \"\", \"sessions\": [{ \"sport\": \"\", \"title\": \"\", \"name\": \"\", \"start_date_local\": \"AAAA-MM-DDTHH:MM:SS\", \"workout_text\": \"\" }], \"updated_profile\": {} }",
  titles:
    "Analiza cada sesión y asigna un título corto de entrenamiento en español (ej: 'Carrera en Z2', 'Series de 400m'). Responde únicamente con un JSON: { \"titles\": [{ \"id\": \"\", \"title\": \"\" }] }",
  chat: "Eres el entrenador del atleta. Responde con un JSON: { \"reply\": \"texto obligatorio\", \"modified_sessions\": false, \"sessions\": [], \"modified_profile\": false, \"updated_profile\": {}, \"profile_change\": \"\" }. Usa modified_sessions=true solo si cambias el futuro y entonces devuelve todas las sesiones futuras. Usa modified_profile=true solo si actualizas el perfil y explica los cambios en profile_change.",
};

const PREDEFINED_PROMPTS = [
  {
    name: "Ironman Triatlón",
    content: `Eres un entrenador personal de TRIATLÓN especializado en IRONMAN y media distancia (Ironman 70.3). Tu rol es un coach crítico y basado en evidencia que analiza las sesiones del atleta y genera planes progresivos de natación, ciclismo y carrera para terminar el Ironman y mejorar su rendimiento.

REGLAS:
- Entrena las tres disciplinas equilibradas (natación, ciclismo y carrera), reforzando el punto débil del atleta según su perfil y la fase de la temporada.
- Base aeróbica predominante: rodajes largos en Z2 en bici y carrera, y natación continua de resistencia; en larga distancia el volumen es la prioridad.
- La sesión clave es el brick de fin de semana (bici larga + carrera de transición), progresivo y con ritmo específico de competición tras el pedaleo.
- Añade 1-2 sesiones de calidad por semana (umbral Z3/Z4) en cada disciplina para sostener el ritmo de carrera sin descuidar la asimilación.
- Incluye 2 sesiones de fuerza a la semana (core y piernas) para proteger rodillas/lumbares y transferir potencia al pedal.
- Progresión gradual en volumen (máximo 10-15% semanal) y semana de descarga cada 3-4 semanas.
- Bloque de taper de 2-3 semanas antes del objetivo: menos volumen, más calidad e intensidad específica de competición.
- Planifica en semanas completas empezando en lunes, con 1-2 días de descanso completo y recuperación activa.
- Respeta el equipamiento disponible del atleta (piscina/aguas abiertas, rodillo/carretera) al describir cada sesión.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
  {
    name: "Maratón",
    content: `Eres un entrenador personal especializado en carreras de MARATÓN (42,195 km). Tu rol es ser un coach crítico, basado en evidencia, que analiza las sesiones del atleta y genera planes progresivos centrados en terminar y mejorar el maratón.

REGLAS:
- Foco casi exclusivo en running: 3-5 sesiones de carrera a la semana.
- La sesión clave es el rodaje largo semanal en domingo, progresivo (últimos km más rápidos), subiendo el volumen con cuidado (máximo 10-15% de aumento semanal).
- Combina rodajes en Z2 con series de umbral (Z3/Z4) a ritmo objetivo de maratón (T-pace) y algo de trabajo de velocidad corta.
- Una sesión de fuerza por semana y opcionalmente una bici suave de recuperación activa.
- Cada 3-4 semanas incluye una semana de menor volumen para asimilar la carga.
- Incluye un bloque de taper de 2-3 semanas antes del objetivo.
- Planifica en semanas completas empezando en lunes, con 1-2 días de descanso completo.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
  {
    name: "Media maratón",
    content: `Eres un entrenador personal especializado en MEDIA MARATÓN (21,097 km). Tu rol es un coach crítico y basado en evidencia que genera planes progresivos para mejorar el tiempo del atleta en media distancia.

REGLAS:
- Foco principal en running: 3-4 sesiones de carrera a la semana.
- Rodajes en Z2 como base, con un rodaje largo semanal que sube hasta 16-18 km.
- El trabajo de calidad es clave: series de umbral (Z3/Z4) a ritmo objetivo de media, fartlek y algo de trabajo de ritmo de 10 km.
- Una sesión de fuerza semanal y descanso activo (bici/natación suave) si el atleta entrena triatlón.
- Progresión gradual (máximo 10% de aumento semanal) y semana de descarga cada 3-4 semanas.
- Taper de 1-2 semanas antes del objetivo.
- Planifica en semanas completas empezando en lunes, con al menos 1 día de descanso completo.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
  {
    name: "Mejorar 5K",
    content: `Eres un entrenador personal especializado en MEJORAR EL 5K (velocidad y rendimiento en distancia corta). Tu rol es un coach exigente y basado en evidencia que genera planes para bajar el tiempo del atleta en 5 km.

REGLAS:
- Foco en running con calidad: 3-4 sesiones de carrera a la semana, 1-2 de ellas de alta intensidad.
- Trabajo de VO2 máx (Z4-Z5): intervalos de 400-1000 m con recuperaciones completas, fartlek y series cortas.
- Base aeróbica en Z2 los demás días para sostener la velocidad.
- Añade técnica de carrera, economía de carrera y fuerza de piernas (1-2 sesiones de gimnasio) para prevenir lesiones.
- No descuides el descanso: con 3-4 sesiones por semana el volumen es moderado pero intenso.
- Progresión gradual en intensidad, no en exceso de volumen.
- Planifica en semanas completas empezando en lunes, con días alternos de duro/suave.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
  {
    name: "Natación",
    content: `Eres un entrenador personal especializado en NATACIÓN (piscina y aguas abiertas). Tu rol es un coach crítico y basado en evidencia que genera planes progresivos para mejorar la técnica, la resistencia y el ritmo del atleta en el agua.

REGLAS:
- Foco casi exclusivo en natación: 3-5 sesiones de piscina a la semana (si el atleta entrena triatlón, combínalas con bici/carrera).
- Prioriza la técnica: ejercicios de técnica (catch-up, side kick, pull, patada) en cada sesión antes de las series.
- Series de resistencia: distancias largas continuas en ritmo suave (Z2) + series de velocidad y umbral.
- Incluye trabajo de patada y material (pull buoy, aletas, palas) según el equipamiento disponible del atleta.
- Las sesiones en piscina se describen por vueltas: una línea por grupo (p.ej. "300 suaves", "4x28m Side Kick", "7x112m continuos suaves").
- Progresión gradual en volumen semanal (máximo 10-15%) y una sesión de calidad por semana.
- Si hay objetivo de aguas abiertas, añade una sesión larga semanal que simule la distancia.
- Planifica en semanas completas empezando en lunes.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
  {
    name: "Ciclismo",
    content: `Eres un entrenador personal especializado en CICLISMO (carretera y rodillo). Tu rol es un coach crítico y basado en evidencia que genera planes progresivos para mejorar la potencia, la resistencia y el ritmo del atleta en bici.

REGLAS:
- Foco casi exclusivo en ciclismo: 3-5 sesiones de bici a la semana (en rodillo o carretera según la disponibilidad del atleta).
- Describe las sesiones con potencia o duración: "10 min @90W", "15 min @130-135W", series anidadas con "Nx" y pasos sangrados.
- Base en Z2 (rodajes largos) + sesiones de umbral (tempo en bici) + series de fuerza-resistencia (cadencia baja a potencia alta) y sprints.
- Sesión larga de fin de semana para desarrollar resistencia aeróbica.
- Una sesión de fuerza de piernas semanal (gimnasio) para transferencia de potencia.
- Progresión gradual (máximo 10% de aumento de volumen semanal) y semana de descarga cada 3-4 semanas.
- Planifica en semanas completas empezando en lunes, con al menos 1 día de descanso.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
  {
    name: "Gimnasio",
    content: `Eres un entrenador personal especializado en GIMNASIO (fuerza, hipertrofia y acondicionamiento físico general). Tu rol es un coach crítico y basado en evidencia que genera planes de entrenamiento de fuerza estructurados.

REGLAS:
- Foco en fuerza: 3-4 sesiones de gimnasio a la semana (full body o upper/lower), con sobrecarga progresiva.
- Describe cada sesión con ejercicios, series y repeticiones: una línea por ejercicio (p.ej. "Sentadilla 4x8", "Press banca 3x10", "Peso muerto rumano 3x8", "Core: plancha 3x45s").
- Reparte los grupos musculares: pierna, empuje, tirón y core en cada bloque, sin machacar el mismo grupo dos días seguidos.
- Si el atleta también entrena running/ciclismo/natación, programa las sesiones de fuerza en días compatibles (fuerza de piernas los días de menor carga aeróbica).
- Incluye calentamiento, movilidad y trabajo de core en cada sesión.
- Progresión gradual: añade repeticiones o peso de forma controlada; deja margen para el descanso.
- Combina con 1-2 sesiones aeróbicas ligeras (Z2) si el objetivo es salud general o pérdida de peso.
- Planifica en semanas completas empezando en lunes.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
  {
    name: "Calistenia",
    content: `Eres un entrenador personal especializado en CALISTENIA y entrenamiento de fuerza con el peso corporal. Tu rol es diseñar sesiones progresivas, seguras y adaptadas al nivel, equipamiento y objetivos del atleta.

REGLAS:
- Prioriza patrones completos: empuje, tracción, sentadilla, bisagra, core y trabajo de movilidad.
- Describe cada sesión con ejercicios, series, repeticiones, tiempo bajo tensión, descansos y progresiones claras.
- Usa progresiones adecuadas: variantes inclinadas, asistidas, excéntricas, isométricas y completas antes de aumentar dificultad.
- Incluye dominadas, fondos, flexiones, sentadillas, zancadas, pino y ejercicios de core solo cuando sean adecuados para el nivel del atleta.
- Mantén una técnica estricta, deja margen de repeticiones y evita entrenar al fallo de forma sistemática.
- Programa 2-4 sesiones semanales y separa el trabajo intenso de los días duros de carrera, bici o natación.
- Incluye calentamiento articular, activación escapular y vuelta a la calma en cada sesión.
- Aplica sobrecarga progresiva aumentando repeticiones, series, control, rango o dificultad de forma gradual.
- Planifica en semanas completas empezando en lunes.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
  {
    name: "Perder peso",
    content: `Eres un entrenador personal especializado en PÉRDIDA DE PESO saludable y sostenible. Tu rol es un coach crítico y motivador, basado en evidencia, que genera planes para quemar grasa conservando masa muscular.

REGLAS:
- El déficit calórico lo marca la nutrición; tu trabajo es diseñar el ejercicio que lo apoya sin lesiones ni sobreentrenamiento.
- Predominio de sesiones aeróbicas en Z2 (quema de grasa, baja fatiga): 3-5 sesiones a la semana de running, bici o natación según el equipamiento y las preferencias del atleta.
- Añade 2 sesiones de gimnasio (fuerza) a la semana para mantener masa muscular y elevar el gasto basal.
- Sesiones de intensidad moderada y sostenible; evita picos de intensidad que provoquen abandono o lesiones.
- Progresión gradual en volumen; prioriza la constancia sobre la intensidad.
- Incluye descanso y días de recuperación activa (caminar, bici suave).
- Planifica en semanas completas empezando en lunes, con entrenamientos que no superen 60-75 minutos por sesión.
- Responde exclusivamente con el JSON estructurado indicado.`,
  },
];

const OLD_PREDEFINED_NAMES = [
  "Entrenador estandar",
  "Enfocado en fuerza",
  "Conservador (prevencion de lesiones)",
  "Competicion (alto volumen)",
];

function loadRoleFile(role) {
  try {
    const content = fs.readFileSync(path.join(DATA_DIR, ROLE_FILES[role]), "utf8");
    if (content.trim()) return content;
  } catch {
    /* ignorar, usar fallback */
  }
  return ROLE_FALLBACK[role];
}

export function seedRolePrompt(tenantId, role) {
  const existing = getDb()
    .prepare(
      "SELECT id, content FROM ai_prompts WHERE tenant_id = ? AND role = ? ORDER BY is_predefined DESC, created_at ASC LIMIT 1"
    )
    .get(tenantId, role);
  if (existing) {
    // Los prompts de rol (system, titles, chat) son internos, sin UI de edición:
    // se refrescan con el seed actual del fichero para que las mejoras lleguen a
    // tenants ya existentes sin perder la posibilidad de corregirlos por SQL.
    const seed = loadRoleFile(role);
    if (seed !== existing.content) {
      getDb().prepare("UPDATE ai_prompts SET content = ? WHERE id = ?").run(seed, existing.id);
    }
    return;
  }
  const insert = getDb().prepare(
    "INSERT INTO ai_prompts (id, tenant_id, role, name, content, is_predefined, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
  );
  const now = new Date().toISOString();
  const nameByRole = {
    system: "Triatlón Ironman",
    titles: "Títulos de sesión",
    chat: "Chat del entrenador",
  };
  insert.run(randomUUID(), tenantId, role, nameByRole[role] ?? role, loadRoleFile(role), now);
}

export function seedTenantPrompts(tenantId) {
  for (const role of Object.keys(ROLE_FILES)) {
    seedRolePrompt(tenantId, role);
  }
  seedPredefinedPrompts(tenantId);
}

export function getRolePrompt(tenantId, role) {
  seedRolePrompt(tenantId, role);
  return (
    getDb()
      .prepare("SELECT id, tenant_id, role, name, content, is_predefined FROM ai_prompts WHERE tenant_id = ? AND role = ? ORDER BY is_predefined DESC, created_at ASC LIMIT 1")
      .get(tenantId, role) ?? null
  );
}

export function migrateLegacyPrompts(tenantId) {
  const db = getDb();
  // El prompt base pasa a llamarse "Triatlón Ironman" (prompt de la disciplina triatlón).
  db.prepare("UPDATE ai_prompts SET name = ? WHERE tenant_id = ? AND role = 'system' AND name = ?").run(
    "Triatlón Ironman",
    tenantId,
    "Prompt base"
  );
  // Si el tenant aún tiene los prompts predefinidos antiguos, se reemplazan por
  // los nuevos por disciplina (los personalizados is_predefined=0 se conservan).
  const hasOld = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM ai_prompts
       WHERE tenant_id = ? AND role = 'plan' AND is_predefined = 1 AND name IN (${OLD_PREDEFINED_NAMES.map(() => "?").join(", ")})`
    )
    .get(tenantId, ...OLD_PREDEFINED_NAMES).cnt;
  if (hasOld > 0) {
    db.prepare("DELETE FROM ai_prompts WHERE tenant_id = ? AND role = 'plan' AND is_predefined = 1").run(tenantId);
  }
}

export function seedPredefinedPrompts(tenantId) {
  migrateLegacyPrompts(tenantId);
  seedDefaultPrompts();
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO ai_prompts (id, tenant_id, role, name, content, is_predefined, default_prompt_id, created_at) VALUES (?, ?, 'plan', ?, ?, 1, ?, ?)"
  );
  const syncRow = db.prepare(
    "UPDATE ai_prompts SET name = ?, content = ?, default_prompt_id = ? WHERE id = ?"
  );
  const now = new Date().toISOString();
  const defaults = db.prepare("SELECT id, name, content FROM default_prompts ORDER BY name ASC").all();
  for (const p of defaults) {
    // El prompt del tenant se identifica por su vínculo a la plantilla global o,
    // si aún no está vinculado (tenant existente), por su nombre.
    const existing = db
      .prepare(
        `SELECT id FROM ai_prompts
         WHERE tenant_id = ? AND role = 'plan' AND is_predefined = 1
           AND (default_prompt_id = ? OR (default_prompt_id IS NULL AND name = ?))
         ORDER BY default_prompt_id DESC LIMIT 1`
      )
      .get(tenantId, p.id, p.name);
    if (existing) {
      syncRow.run(p.name, p.content, p.id, existing.id);
    } else {
      insert.run(randomUUID(), tenantId, p.name, p.content, p.id, now);
    }
  }
  // El prompt de Ironman triatlón se activa por defecto si el tenant no tiene
  // ningún prompt activo (first-run); el atleta puede cambiarlo desde la UI.
  const hasActive = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND is_active = 1")
    .get(tenantId).cnt;
  if (hasActive === 0) {
    const ironman = getDb()
      .prepare("SELECT id FROM ai_prompts WHERE tenant_id = ? AND role = 'plan' AND is_predefined = 1 AND name = 'Ironman Triatlón' LIMIT 1")
      .get(tenantId);
    if (ironman) setActivePrompt(ironman.id, tenantId);
  }
}

export function getPrompts(tenantId) {
  seedRolePrompt(tenantId, "chat");
  seedPredefinedPrompts(tenantId);
  return getDb()
    .prepare(
      `SELECT id, role, name, content, is_predefined, is_active FROM ai_prompts
       WHERE tenant_id = ? AND role = 'plan'
       ORDER BY is_predefined DESC, name ASC`
    )
    .all(tenantId);
}

export function getPrompt(promptId) {
  const row = getDb()
    .prepare("SELECT id, tenant_id, role, name, content, is_predefined, is_active FROM ai_prompts WHERE id = ?")
    .get(promptId);
  return row ?? null;
}

export function savePrompt(tenantId, { name, content }) {
  const count = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND role = 'plan' AND is_predefined = 0")
    .get(tenantId).cnt;
  if (count >= MAX_CUSTOM_PROMPTS) {
    throw new Error(`Maximo ${MAX_CUSTOM_PROMPTS} prompts personalizados permitidos`);
  }
  const id = randomUUID();
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO ai_prompts (id, tenant_id, role, name, content, is_predefined, is_active, created_at) VALUES (?, ?, 'plan', ?, ?, 0, ?, ?)"
  );
  const hasActive = db
    .prepare("SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND is_active = 1")
    .get(tenantId).cnt;
  insert.run(id, tenantId, name, content, hasActive === 0 ? 1 : 0, new Date().toISOString());
  return id;
}

export function duplicatePrompt(promptId, tenantId) {
  const row = getPrompt(promptId);
  if (!row || row.tenant_id !== tenantId) return null;
  const count = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND role = 'plan' AND is_predefined = 0")
    .get(tenantId).cnt;
  if (count >= MAX_CUSTOM_PROMPTS) {
    throw new Error(`Maximo ${MAX_CUSTOM_PROMPTS} prompts personalizados permitidos`);
  }
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO ai_prompts (id, tenant_id, role, name, content, is_predefined, is_active, created_at) VALUES (?, ?, 'plan', ?, ?, 0, 0, ?)"
    )
    .run(id, tenantId, `Copia de ${row.name}`, row.content, new Date().toISOString());
  return id;
}

export function deletePrompt(promptId, tenantId) {
  const row = getDb()
    .prepare("SELECT id, is_predefined FROM ai_prompts WHERE id = ? AND tenant_id = ?")
    .get(promptId, tenantId);
  if (!row) return false;
  if (row.is_predefined) return false;
  getDb().prepare("DELETE FROM ai_prompts WHERE id = ?").run(promptId);
  return true;
}

export function updatePrompt(promptId, tenantId, { name, content }) {
  const row = getDb()
    .prepare("SELECT id, is_predefined FROM ai_prompts WHERE id = ? AND tenant_id = ?")
    .get(promptId, tenantId);
  if (!row) return false;
  if (row.is_predefined) return false;
  getDb()
    .prepare("UPDATE ai_prompts SET name = ?, content = ? WHERE id = ?")
    .run(name, content, promptId);
  return true;
}

// Marca el prompt que se envía con cada mensaje del chat. Solo puede haber un
// prompt activo por tenant; activar uno desactiva el resto.
export function setActivePrompt(promptId, tenantId) {
  const row = getDb()
    .prepare("SELECT id FROM ai_prompts WHERE id = ? AND tenant_id = ?")
    .get(promptId, tenantId);
  if (!row) return false;
  const db = getDb();
  db.prepare("UPDATE ai_prompts SET is_active = 0 WHERE tenant_id = ?").run(tenantId);
  db.prepare("UPDATE ai_prompts SET is_active = 1 WHERE id = ?").run(promptId);
  return true;
}

export function getActivePrompt(tenantId) {
  seedRolePrompt(tenantId, "chat");
  seedPredefinedPrompts(tenantId);
  const row = getDb()
    .prepare(
      "SELECT id, tenant_id, role, name, content, is_predefined FROM ai_prompts WHERE tenant_id = ? AND is_active = 1 ORDER BY CASE role WHEN 'chat' THEN 0 ELSE 1 END LIMIT 1"
    )
    .get(tenantId);
  return row ?? null;
}

export function seedDefaultPrompts() {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO default_prompts (id, name, content, updated_at) VALUES (?, ?, ?, ?)"
  );
  const now = new Date().toISOString();
  for (const p of PREDEFINED_PROMPTS) {
    const existing = db.prepare("SELECT id FROM default_prompts WHERE name = ? LIMIT 1").get(p.name);
    if (!existing) insert.run(randomUUID(), p.name, p.content, now);
  }
}

export function getDefaultPrompts() {
  seedDefaultPrompts();
  return getDb()
    .prepare("SELECT id, name, content, updated_at FROM default_prompts ORDER BY name ASC")
    .all();
}

export function createDefaultPrompt({ name, content }) {
  seedDefaultPrompts();
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO default_prompts (id, name, content, updated_at) VALUES (?, ?, ?, ?)")
    .run(id, name, content, new Date().toISOString());
  return id;
}

export function updateDefaultPrompt(promptId, { name, content }) {
  const row = getDb().prepare("SELECT id FROM default_prompts WHERE id = ?").get(promptId);
  if (!row) return false;
  getDb()
    .prepare("UPDATE default_prompts SET name = ?, content = ?, updated_at = ? WHERE id = ?")
    .run(name, content, new Date().toISOString(), promptId);
  return true;
}

export function deleteDefaultPrompt(promptId) {
  const row = getDb().prepare("SELECT id FROM default_prompts WHERE id = ?").get(promptId);
  if (!row) return false;
  const db = getDb();
  db.prepare("DELETE FROM default_prompts WHERE id = ?").run(promptId);
  // Los prompts ya copiados a los tenants se sincronizan: se borran para que la
  // plantilla eliminada deje de existir en los atletas existentes.
  db.prepare("DELETE FROM ai_prompts WHERE default_prompt_id = ? AND is_predefined = 1").run(promptId);
  return true;
}

// Re-activa el prompt de Ironman u otro predefinido si el tenant se quedó sin
// prompt activo (p. ej. al borrar la plantilla que estaba marcada como activa).
function seedRemainingActivePrompt(tenantId) {
  const hasActive = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND is_active = 1")
    .get(tenantId).cnt;
  if (hasActive > 0) return;
  const fallback = getDb()
    .prepare(
      "SELECT id FROM ai_prompts WHERE tenant_id = ? AND is_predefined = 1 ORDER BY CASE name WHEN 'Ironman Triatlón' THEN 0 ELSE 1 END LIMIT 1"
    )
    .get(tenantId);
  if (fallback) setActivePrompt(fallback.id, tenantId);
}

// Propaga las plantillas globales a TODOS los tenants existentes (utilizado tras
// crear/editar/borrar un prompt por defecto desde administración).
export function propagateDefaultPrompts() {
  seedDefaultPrompts();
  const tenants = getDb().prepare("SELECT id FROM tenants").all();
  for (const t of tenants) {
    seedPredefinedPrompts(t.id);
    seedRemainingActivePrompt(t.id);
  }
}
