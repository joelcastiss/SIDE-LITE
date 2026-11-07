-- Run only on the SIDE-LITE development branch after creating the NOINHERIT application login without neon_superuser.
-- Do not place passwords in migrations or expose the database to clients.
GRANT USAGE ON SCHEMA lite TO lite_dev_api;
GRANT SELECT, INSERT ON lite.lite_profiles TO lite_dev_api;
GRANT UPDATE(id) ON lite.lite_profiles TO lite_dev_api;
GRANT SELECT, INSERT ON lite.lite_games,lite.lite_products,lite.lite_companies,lite.lite_cycles,lite.lite_decisions,lite.lite_results TO lite_dev_api;
GRANT SELECT ON lite.lite_stores,lite.lite_events TO lite_dev_api;
GRANT UPDATE(id) ON lite.lite_games TO lite_dev_api;
GRANT UPDATE(cash,inventory) ON lite.lite_companies TO lite_dev_api;
GRANT UPDATE(status) ON lite.lite_cycles TO lite_dev_api;
GRANT UPDATE(quality,quantity,price,marketing_amount,confirmed,updated_at) ON lite.lite_decisions TO lite_dev_api;
