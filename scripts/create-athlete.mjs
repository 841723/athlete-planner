#!/usr/bin/env node
// Crea un nuevo atleta: tenant + owner (role athlete, is_owner) + perfil opcional.
// Uso:
//   node scripts/create-athlete.mjs --name "Sara" --owner-email sara@example.com \
//     --profile data/athlete-profile.example.json [--slug sara] [--min-date 2026-05-12]
// Requiere: backend DB (se crea en data/endurance.db si no existe).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAthlete, slugify } from "../backend/lib/athletes.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const name = arg("name");
const ownerEmail = arg("owner-email");
if (!name) die('Falta --name "<nombre del atleta>"');
if (!ownerEmail) die("Falta --owner-email <email> (debe coincidir con su cuenta de Google)");

const slug = arg("slug") ?? slugify(name);
const profilePath = arg("profile");
const profile = profilePath
  ? JSON.parse(fs.readFileSync(path.resolve(ROOT, profilePath), "utf8"))
  : null;

try {
  const athlete = createAthlete({
    name,
    ownerEmail,
    slug,
    minDate: arg("min-date"),
    planStart: arg("plan-start"),
    goalDate: arg("goal-date"),
    trainingWeekOneStart: arg("training-week-one-start"),
    profile,
  });
  console.log("Atleta creado:");
  console.log(`  Tenant: ${athlete.name} (${athlete.slug})`);
  console.log(`  Tenant id: ${athlete.id}`);
  console.log(`  Owner: ${athlete.ownerEmail}`);
  console.log(`  Perfil importado: ${profile ? "sí" : "no"}`);
  console.log(`  MIN_DATE: ${arg("min-date") ?? "2026-05-12"}`);
  console.log("");
  console.log("El owner debe iniciar sesión con Google (email coincidente) y cambiar al tenant en el selector.");
} catch (err) {
  die(err.message);
}
