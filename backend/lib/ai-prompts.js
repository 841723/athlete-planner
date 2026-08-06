import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

const MAX_CUSTOM_PROMPTS = 5;

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

export function seedPredefinedPrompts(tenantId) {
  const db = getDb();
  const existing = db
    .prepare("SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND is_predefined = 1")
    .get(tenantId).cnt;
  if (existing >= PREDEFINED_PROMPTS.length) return;

  const insert = db.prepare(
    "INSERT OR IGNORE INTO ai_prompts (id, tenant_id, name, content, is_predefined, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  );
  const now = new Date().toISOString();
  for (const p of PREDEFINED_PROMPTS) {
    insert.run(randomUUID(), tenantId, p.name, p.content, now);
  }
}

export function getPrompts(tenantId) {
  seedPredefinedPrompts(tenantId);
  return getDb()
    .prepare(
      "SELECT id, name, content, is_predefined FROM ai_prompts WHERE tenant_id = ? ORDER BY is_predefined DESC, name ASC"
    )
    .all(tenantId);
}

export function getPrompt(promptId) {
  const row = getDb()
    .prepare("SELECT id, tenant_id, name, content, is_predefined FROM ai_prompts WHERE id = ?")
    .get(promptId);
  return row ?? null;
}

export function savePrompt(tenantId, { name, content }) {
  const count = getDb()
    .prepare(
      "SELECT COUNT(*) as cnt FROM ai_prompts WHERE tenant_id = ? AND is_predefined = 0"
    )
    .get(tenantId).cnt;
  if (count >= MAX_CUSTOM_PROMPTS) {
    throw new Error(`Maximo ${MAX_CUSTOM_PROMPTS} prompts personalizados permitidos`);
  }
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO ai_prompts (id, tenant_id, name, content, is_predefined, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    )
    .run(id, tenantId, name, content, new Date().toISOString());
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
