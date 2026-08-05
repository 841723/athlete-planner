import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

const ASSIGNABLE_ROLES = new Set(["admin", "visitor"]);

export function listMembers(tenantId) {
  return getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.picture, m.role, m.is_owner, m.created_at
       FROM tenant_members m JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = ?
       ORDER BY m.is_owner DESC, m.created_at`
    )
    .all(tenantId)
    .map(({ is_owner, createdAt, ...r }) => ({
      ...r,
      isOwner: Boolean(is_owner),
      createdAt,
    }));
}

export function addMember(tenantId, { email, role }) {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    const err = new Error("Email inválido");
    err.status = 400;
    throw err;
  }
  if (!ASSIGNABLE_ROLES.has(role)) {
    const err = new Error("Rol inválido (solo admin o visitor)");
    err.status = 400;
    throw err;
  }
  const db = getDb();
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, null, email.toLowerCase(), null, null, new Date().toISOString());
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }
  const existing = db
    .prepare("SELECT * FROM tenant_members WHERE tenant_id = ? AND user_id = ?")
    .get(tenantId, user.id);
  if (existing) {
    db.prepare("UPDATE tenant_members SET role = ? WHERE tenant_id = ? AND user_id = ?").run(
      role,
      tenantId,
      user.id
    );
  } else {
    db.prepare(
      "INSERT INTO tenant_members (tenant_id, user_id, role, is_owner, created_at) VALUES (?, ?, ?, 0, ?)"
    ).run(tenantId, user.id, role, new Date().toISOString());
  }
  return { id: user.id, email: user.email, name: user.name, picture: user.picture, role, isOwner: false };
}

export function renameTenant(tenantId, name) {
  if (!name || typeof name !== "string" || !name.trim()) {
    const err = new Error("Nombre inválido");
    err.status = 400;
    throw err;
  }
  const db = getDb();
  db.prepare("UPDATE tenants SET name = ? WHERE id = ?").run(name.trim(), tenantId);
  return db.prepare("SELECT id, name, slug FROM tenants WHERE id = ?").get(tenantId);
}

export function updateMemberRole(tenantId, userId, role) {
  if (!ASSIGNABLE_ROLES.has(role)) {
    const err = new Error("Rol inválido (solo admin o visitor)");
    err.status = 400;
    throw err;
  }
  const db = getDb();
  const member = db
    .prepare("SELECT * FROM tenant_members WHERE tenant_id = ? AND user_id = ?")
    .get(tenantId, userId);
  if (!member) {
    const err = new Error("Usuario no encontrado en este tenant");
    err.status = 404;
    throw err;
  }
  if (member.is_owner) {
    const err = new Error("No se puede cambiar el rol del propietario (atleta)");
    err.status = 403;
    throw err;
  }
  db.prepare("UPDATE tenant_members SET role = ? WHERE tenant_id = ? AND user_id = ?").run(
    role,
    tenantId,
    userId
  );
}

export function removeMember(tenantId, userId) {
  const db = getDb();
  const member = db
    .prepare("SELECT * FROM tenant_members WHERE tenant_id = ? AND user_id = ?")
    .get(tenantId, userId);
  if (!member) {
    const err = new Error("Usuario no encontrado en este tenant");
    err.status = 404;
    throw err;
  }
  if (member.is_owner) {
    const err = new Error("El propietario (atleta) no puede ser eliminado");
    err.status = 403;
    throw err;
  }
  db.prepare("DELETE FROM tenant_members WHERE tenant_id = ? AND user_id = ?").run(tenantId, userId);
}
