/*
# English Verb Practice — Schema

## Overview
Creates tables for a nick-based English verb practice app. Users log in with a nickname (no email/password). One designated nick is the admin who can add/remove verbs.

## New Tables

1. **players** — stores nicknames and admin flag
   - id (uuid, pk)
   - nick (text, unique, not null) — the nickname
   - is_admin (boolean, default false)
   - created_at (timestamptz)

2. **verbs** — the verb dictionary
   - id (uuid, pk)
   - slovensky (text, not null) — Slovak meaning
   - prvy_tvar (text, not null) — base form (e.g. "be")
   - druhy_tvar (text, not null) — past simple (e.g. "was/were")
   - treti_tvar (text, not null) — past participle (e.g. "been")
   - created_at (timestamptz)

3. **player_verbs** — per-player stats for each verb (spaced repetition data)
   - id (uuid, pk)
   - player_id (uuid, fk -> players, on delete cascade)
   - verb_id (uuid, fk -> verbs, on delete cascade)
   - spravne (int, default 0) — correct count
   - zle (int, default 0) — wrong count
   - streak (int, default 0) — current streak
   - level (int, default 1) — mastery level
   - posledna_chyba (timestamptz, nullable) — last error timestamp
   - UNIQUE(player_id, verb_id)

4. **verb_errors** — error log for each wrong answer
   - id (uuid, pk)
   - player_verb_id (uuid, fk -> player_verbs, on delete cascade)
   - cas (timestamptz, default now())
   - odpovede (jsonb) — array of 3 user answers
   - spravne (jsonb) — array of 3 correct answers
   - typ (text) — question type: "slovak", "form1", "form2", "form3"

## Security
- RLS enabled on all tables.
- Policies allow anon + authenticated CRUD (nick-based app, no Supabase auth).
- Admin actions are gated in the frontend by checking the nick against VITE_ADMIN_NICK env var.

## Notes
1. No Supabase auth — the app uses nick-based login only.
2. Admin nick is defined in the frontend .env as VITE_ADMIN_NICK.
3. Spaced repetition logic runs in the frontend: wrong verbs appear more frequently.
*/

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nick text UNIQUE NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS verbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slovensky text NOT NULL,
  prvy_tvar text NOT NULL,
  druhy_tvar text NOT NULL,
  treti_tvar text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE verbs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_verbs" ON verbs;
CREATE POLICY "anon_select_verbs" ON verbs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_verbs" ON verbs;
CREATE POLICY "anon_insert_verbs" ON verbs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_verbs" ON verbs;
CREATE POLICY "anon_update_verbs" ON verbs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_verbs" ON verbs;
CREATE POLICY "anon_delete_verbs" ON verbs FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS player_verbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  verb_id uuid NOT NULL REFERENCES verbs(id) ON DELETE CASCADE,
  spravne int NOT NULL DEFAULT 0,
  zle int NOT NULL DEFAULT 0,
  streak int NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  posledna_chyba timestamptz,
  UNIQUE(player_id, verb_id)
);

ALTER TABLE player_verbs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_player_verbs" ON player_verbs;
CREATE POLICY "anon_select_player_verbs" ON player_verbs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_player_verbs" ON player_verbs;
CREATE POLICY "anon_insert_player_verbs" ON player_verbs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_player_verbs" ON player_verbs;
CREATE POLICY "anon_update_player_verbs" ON player_verbs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_player_verbs" ON player_verbs;
CREATE POLICY "anon_delete_player_verbs" ON player_verbs FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS verb_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_verb_id uuid NOT NULL REFERENCES player_verbs(id) ON DELETE CASCADE,
  cas timestamptz DEFAULT now(),
  odpovede jsonb NOT NULL,
  spravne jsonb NOT NULL,
  typ text NOT NULL
);

ALTER TABLE verb_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_verb_errors" ON verb_errors;
CREATE POLICY "anon_select_verb_errors" ON verb_errors FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_verb_errors" ON verb_errors;
CREATE POLICY "anon_insert_verb_errors" ON verb_errors FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_verb_errors" ON verb_errors;
CREATE POLICY "anon_delete_verb_errors" ON verb_errors FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_player_verbs_player_id ON player_verbs(player_id);
CREATE INDEX IF NOT EXISTS idx_player_verbs_verb_id ON player_verbs(verb_id);
CREATE INDEX IF NOT EXISTS idx_verb_errors_player_verb_id ON verb_errors(player_verb_id);