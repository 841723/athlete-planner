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
  chat: "Eres el entrenador del plan de este atleta. Responde con un JSON: { \"reply\": \"texto\", \"sessions\": [] }. reply es tu análisis/respuesta; sessions, si propones cambios, son sesiones nuevas que reemplazan a las del plan.",
};

const PREDEFINED_PROMPTS = [
  {
    name: "Entrenador estandar",
    content: `Eres un entrenador personal de triatlon especializado en Ironman 70.3. Tu rol es ser un coach critico, basado en evidencia, que analiza las sesiones del atleta y genera planes de entrenamiento progresivos. No eres un chatbot amable; eres un entrenador exigente que prioriza la consecucion del objetivo.

REGLAS:
- Analiza las sesiones recientes del atleta antes de generar el plan.
- Prioriza calidad sobre cantidad.
- Evita lesiones con progresion gradual (maximo 10% de aumento de volumen semanal).
- Alterna deportes y deja dias de descanso.
- Inuye al menos 1 sesion de fuerza por semana si esta disponible.
- Para running Z2, usa rangos de FC objetivo (hr_from/hr_to).
- Calcula distancias a partir de duracion y ritmo.
- Responde exclusivamente con JSON estructurado.`,
  },
  {
    name: "Enfocado en fuerza",
    content: `Eres un entrenador de triatlon que prioriza el trabajo de fuerza y resistencia muscular. Tu enfoque es construir una base solida antes de volumen alto.

REGLAS:
- Inuye 2-3 sesiones de fuerza por semana.
- Prioriza ejercicios de core, piernas y estabilidad.
- Combina fuerza con sesiones de calidad en bici y carrera.
- Progresion: 4 semanas de base de fuerza, luego integracion con volumen.
- Responde exclusivamente con JSON estructurado.`,
  },
  {
    name: "Conservador (prevencion de lesiones)",
    content: `Eres un entrenador conservador que prioriza la salud del atleta sobre el rendimiento a corto plazo. Tu objetivo es llegar a la competicion sin lesiones.

REGLAS:
- Volumen moderado, sin picos abruptos.
- Muchos entrenamientos en zona 2 (FC baja).
- Semana de descanso cada 3-4 semanas.
- Evita series de alta intensidad hasta que el atleta este bien preparado.
- Si detectasfatiga excesiva, reduce la carga.
- Responde exclusivamente con JSON estructurado.`,
  },
  {
    name: "Competicion (alto volumen)",
    content: `Eres un entrenador orientado a competicion que busca maximizar el rendimiento. Tu enfoque es el volumen y la intensidad estructurada.

REGLAS:
- Alto volumen semanal con sesiones largas de fin de semana.
- Inuye sesiones de intervalos de alta intensidad (Z4-Z5).
- Bloques de periodo: base, construccion, pico, taper.
- Entrenamientos especificos de carrera (brick bici-carrera).
- Responde exclusivamente con JSON estructurado.`,
  },
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

function hasRole(tenantId, role) {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS cnt FROM ai_prompts WHERE tenant_id = ? AND role = ?")
      .get(tenantId, role).cnt > 0
  );
}

export function seedRolePrompt(tenantId, role) {
  if (hasRole(tenantId, role)) return;
  const insert = getDb().prepare(
    "INSERT INTO ai_prompts (id, tenant_id, role, name, content, is_predefined, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
  );
  const now = new Date().toISOString();
  const nameByRole = {
    system: "Prompt base",
    titles: "Títulos de sesión",
    chat: "Chat del plan",
  };
  insert.run(randomUUID(), tenantId, role, nameByRole[role] ?? role, loadRoleFile(role), now);
}

export function seedTenantPrompts(tenantId) {
  for (const role of Object.keys(ROLE_FILES)) {
    seedRolePrompt(tenantId, role);
  }
  seedPredefinedPrompts(tenantId);
}

export function seedPredefinedPrompts(tenantId) {
  const existing = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND role = 'plan' AND is_predefined = 1")
    .get(tenantId).cnt;
  if (existing >= PREDEFINED_PROMPTS.length) return;

  const insert = getDb().prepare(
    "INSERT INTO ai_prompts (id, tenant_id, role, name, content, is_predefined, created_at) VALUES (?, ?, 'plan', ?, ?, 1, ?)"
  );
  const now = new Date().toISOString();
  for (const p of PREDEFINED_PROMPTS) {
    insert.run(randomUUID(), tenantId, p.name, p.content, now);
  }
}

export function getPrompts(tenantId) {
  seedTenantPrompts(tenantId);
  return getDb()
    .prepare(
      `SELECT id, role, name, content, is_predefined FROM ai_prompts
       WHERE tenant_id = ? AND (role = 'plan' OR role = 'system')
       ORDER BY CASE role WHEN 'system' THEN 0 ELSE 1 END, is_predefined DESC, name ASC`
    )
    .all(tenantId);
}

export function getPrompt(promptId) {
  const row = getDb()
    .prepare("SELECT id, tenant_id, role, name, content, is_predefined FROM ai_prompts WHERE id = ?")
    .get(promptId);
  return row ?? null;
}

export function getRolePrompt(tenantId, role) {
  seedRolePrompt(tenantId, role);
  return (
    getDb()
      .prepare("SELECT id, tenant_id, role, name, content, is_predefined FROM ai_prompts WHERE tenant_id = ? AND role = ? ORDER BY is_predefined DESC, created_at ASC LIMIT 1")
      .get(tenantId, role) ?? null
  );
}

export function getFormatBlock(tenantId) {
  const systemPrompt = getRolePrompt(tenantId, "system");
  const content = systemPrompt?.content ?? "";
  const marker = "FORMATO DE RESPUESTA";
  const idx = content.indexOf(marker);
  if (idx === -1) return "";
  return content.slice(idx).trim();
}

export function savePrompt(tenantId, { name, content }) {
  const count = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND role = 'plan' AND is_predefined = 0")
    .get(tenantId).cnt;
  if (count >= MAX_CUSTOM_PROMPTS) {
    throw new Error(`Maximo ${MAX_CUSTOM_PROMPTS} prompts personalizados permitidos`);
  }
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO ai_prompts (id, tenant_id, role, name, content, is_predefined, created_at) VALUES (?, ?, 'plan', ?, ?, 0, ?)"
    )
    .run(id, tenantId, name, content, new Date().toISOString());
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
      "INSERT INTO ai_prompts (id, tenant_id, role, name, content, is_predefined, created_at) VALUES (?, ?, 'plan', ?, ?, 0, ?)"
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
