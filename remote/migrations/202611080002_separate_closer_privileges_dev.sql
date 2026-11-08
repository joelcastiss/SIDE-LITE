-- SIDE-LITE development only. Requires pre-created, separate NOINHERIT roles
-- lite_dev_api and lite_dev_closer; neither may own objects, inherit extra
-- grants, bypass RLS, or hold elevated Neon privileges. Apply transactionally
-- after previous migrations, before configuring the isolated closer service.
-- PostgreSQL requires an UPDATE privilege for SELECT FOR UPDATE; the API
-- locks open cycles but does not need to close them.
-- Profiles are not row-locked by the API; prevent changing their identifiers.
REVOKE UPDATE(id) ON lite.lite_profiles FROM lite_dev_api;
REVOKE INSERT ON lite.lite_results FROM lite_dev_api;
REVOKE UPDATE(cash,inventory) ON lite.lite_companies FROM lite_dev_api;
REVOKE UPDATE(status) ON lite.lite_cycles FROM lite_dev_api;
GRANT UPDATE(id) ON lite.lite_cycles TO lite_dev_api;

GRANT USAGE ON SCHEMA lite TO lite_dev_closer;
GRANT SELECT ON lite.lite_cycles, lite.lite_games, lite.lite_companies, lite.lite_decisions TO lite_dev_closer;
GRANT INSERT ON lite.lite_results TO lite_dev_closer;
GRANT UPDATE(status) ON lite.lite_cycles TO lite_dev_closer;
GRANT UPDATE(cash,inventory) ON lite.lite_companies TO lite_dev_closer;
