-- A private synchronous client avoids persisting authorization headers in pg_net.
CREATE SCHEMA IF NOT EXISTS side_lite_scheduler AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA side_lite_scheduler FROM PUBLIC, anon, authenticated, service_role, side_lite_api, side_lite_api_edge, side_lite_closer;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA side_lite_scheduler;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA side_lite_scheduler FROM PUBLIC, anon, authenticated, service_role, side_lite_api, side_lite_api_edge, side_lite_closer;
