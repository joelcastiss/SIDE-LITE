-- Remove the unused private HTTP extension and schema after the scheduler setup was blocked.
DROP EXTENSION IF EXISTS http;
DROP SCHEMA IF EXISTS side_lite_scheduler;
