-- Development only. Requires at least one test teacher, one test student, and a store.
WITH teacher AS (SELECT id FROM lite.lite_profiles WHERE role='teacher' LIMIT 1),
student AS (SELECT id FROM lite.lite_profiles WHERE role='student' LIMIT 1),
store AS (SELECT id FROM lite.lite_stores LIMIT 1),
game AS (
 INSERT INTO lite.lite_games(teacher_id,name,code,cycle_count,duration_seconds,capital_min,capital_max,costs,enabled_events)
 SELECT teacher.id,'Prueba de cierre',upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),3,120,30000,30000,'{"basic":50,"standard":80,"premium":120}'::jsonb,'[]'::jsonb FROM teacher RETURNING id
), company AS (
 INSERT INTO lite.lite_companies(game_id,student_id,name,store_id,initial_capital,cash)
 SELECT game.id,student.id,'Tienda prueba',store.id,30000,30000 FROM game,student,store RETURNING id,game_id
), cycle AS (
 INSERT INTO lite.lite_cycles(game_id,number,starts_at,ends_at)
 SELECT game_id,1,now()-interval '121 seconds',now()-interval '1 second' FROM company RETURNING id
), decision AS (
 INSERT INTO lite.lite_decisions(cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed)
 SELECT cycle.id,company.id,'basic',20,100,200,true FROM cycle,company RETURNING id
)
SELECT cycle.id AS cycle_id FROM cycle,decision;
