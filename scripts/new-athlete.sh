node scripts/create-athlete.mjs --name "Hugo Naudin" --owner-email hugo.naudin03@gmail.com

sqlite3 data/endurance.db "INSERT into tenant_members VALUES ('1426722d-9439-486f-95bc-87380733f4b8', 'b0dfdf80-db96-450f-a477-43ec3a7cc774', 'admin', 0, CURRENT_TIMESTAMP);"

UPDATE tenant_members SET role = 'admin' WHERE tenant_id = '1426722d-9439-486f-95bc-87380733f4b8'  AND user_id = 'b0dfdf80-db96-450f-a477-43ec3a7cc774';