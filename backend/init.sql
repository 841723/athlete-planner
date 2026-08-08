-- Esquema de la base de datos. Se aplica en backend/lib/db.js al primer acceso.
-- Las migraciones incrementales (ALTER) se ejecutan desde db.js con ensureColumn.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('athlete', 'admin', 'visitor')),
  is_owner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('completed', 'planned')),
  sport TEXT,
  start_date_local TEXT,
  title TEXT,
  name TEXT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_date ON sessions(tenant_id, kind, start_date_local);

CREATE TABLE IF NOT EXISTS athlete_profiles (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  week INTEGER,
  label TEXT,
  date TEXT,
  target_pace TEXT,
  url TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_goals_tenant ON goals(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan_start TEXT,
  goal_date TEXT,
  training_week_one_start TEXT,
  min_date TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS ai_provider_settings (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gemini',
  api_key TEXT NOT NULL,
  model TEXT DEFAULT 'gemini-2.0-flash',
  base_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS athlete_profile_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('user', 'ai')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profile_history_tenant ON athlete_profile_history(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_prompts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_predefined INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_tenant ON ai_prompts(tenant_id);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  comments TEXT,
  weeks INTEGER DEFAULT 1,
  profile_version_id TEXT,
  prompt_id TEXT,
  prompt_name TEXT,
  response_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_plans_tenant ON plans(tenant_id, created_at DESC);

-- Mensajes del chat de un plan generado con IA (conversación stateful vía response_id).
CREATE TABLE IF NOT EXISTS plan_messages (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_messages_plan ON plan_messages(plan_id, created_at);

CREATE TABLE IF NOT EXISTS activity_tracks (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  sport TEXT,
  polyline TEXT NOT NULL,
  samples TEXT NOT NULL,
  point_count INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_activity_tracks_tenant ON activity_tracks(tenant_id, session_id);

-- Claves de API por tenant para autenticación sin Google.
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'visitor')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);

-- Log de cada solicitud a un proveedor de IA.
CREATE TABLE IF NOT EXISTS ai_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT,
  api_key_id TEXT,
  auth_method TEXT NOT NULL,
  actor TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  endpoint TEXT,
  api_key_masked TEXT,
  input TEXT,
  response TEXT,
  status INTEGER,
  ok INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_tenant ON ai_logs(tenant_id, created_at DESC);
