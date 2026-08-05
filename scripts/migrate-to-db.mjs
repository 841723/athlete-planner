#!/usr/bin/env node
// Migra los datos actuales (sessions/*.json, planned, perfil) a la base de datos SQLite.
// Es idempotente: si ya existe un tenant en la BD, no hace nada.
import { migrate } from "../backend/lib/migrate.js";

const result = migrate();
if (!result.migrated) {
  console.log("Base de datos ya migrada. No se hizo nada.");
} else {
  console.log("Migración completada:");
  console.log(`  Tenant: ${result.tenant.name} (${result.tenant.slug})`);
  console.log(`  Sesiones completadas importadas: ${result.completed}`);
  console.log(`  Sesiones planificadas importadas: ${result.planned}`);
  console.log(`  Perfil de atleta importado: ${result.hasProfile ? "sí" : "no"}`);
  console.log(`  Owner (atleta): ${result.ownerEmail ?? "sin definir (DEFAULT_OWNER_EMAIL)"}`);
}
