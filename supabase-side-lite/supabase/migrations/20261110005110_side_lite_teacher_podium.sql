-- SIDE-LITE private podium. No browser-facing privileges or direct Data API
-- policies; only the authenticated, membership-checking API may access it.
create table side_lite_private.teacher_grades (
 game_id uuid not null,
 company_id uuid not null,
 grade numeric(4,2) not null check(grade between 0 and 20),
 updated_at timestamptz not null default now(),
 primary key(game_id,company_id),
 foreign key(game_id,company_id) references public.lite_companies(game_id,id) on delete cascade
);
create table side_lite_private.teacher_podium (
 game_id uuid primary key references public.lite_games(id) on delete cascade,
 reason text not null check(char_length(reason)<=1000),
 scheduled_at timestamptz not null,
 published_snapshot jsonb not null check(jsonb_typeof(published_snapshot)='array'),
 created_at timestamptz not null default now()
);
alter table side_lite_private.teacher_grades enable row level security;
alter table side_lite_private.teacher_podium enable row level security;
revoke all on side_lite_private.teacher_grades,side_lite_private.teacher_podium from public,anon,authenticated,service_role;
grant select,insert,update on side_lite_private.teacher_grades to side_lite_api;
grant select,insert,update,delete on side_lite_private.teacher_podium to side_lite_api;
