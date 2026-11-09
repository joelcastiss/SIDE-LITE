CREATE TABLE IF NOT EXISTS lite_teacher_grades (
 game_id uuid NOT NULL REFERENCES lite_games(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES lite_companies(id) ON DELETE CASCADE,
 grade numeric(4,2) NOT NULL CHECK(grade BETWEEN 0 AND 20),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(game_id,company_id)
);
CREATE TABLE IF NOT EXISTS lite_teacher_podium (
 game_id uuid PRIMARY KEY REFERENCES lite_games(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(length(reason)<=1000),
 scheduled_at timestamptz NOT NULL,
 published_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
