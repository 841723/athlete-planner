node scripts/create-athlete.mjs --name "Hugo Naudin" --owner-email hugo.naudin03@gmail.com

sqlite3 data/endurance.db "INSERT into tenant_members (tenant_id, user_id, role, is_owner, created_at) VALUES ("hugo-naudin", "diego-roldan", "admin", 0, CURRENT_TIMESTAMP);"