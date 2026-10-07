-- ─── PURPOSE ────────────────────────────────────────────────────────────────
-- WHAT:   The `sessions` table — the server's memory of who is signed in.
-- WHERE:  Paste into a .sql file and run it against auth_app, or paste the
--         single statement into your Postgres GUI (psql / pgAdmin / Supabase).
--         app.js:26-36 already does the same trick for `users` with
--         CREATE TABLE IF NOT EXISTS at boot.
-- WHY:    A cookie is just a string the browser echoes back. It is worthless
--         on its own. The sessions table is what makes it meaningful: it maps
--         one opaque random string to one user_id, with an expiry.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  -- Surrogate primary key. NOT the cookie value — never expose this to the client.
  id BIGSERIAL PRIMARY KEY,

  -- sha256 of the random token. Deliberately NOT the token: if the database
  -- leaks, an attacker holding only these values cannot reconstruct a working
  -- cookie. See Ch. 1, "The token is random, and it is not the session id".
  token_hash TEXT NOT NULL UNIQUE,

  -- Which user this session belongs to.
  -- ON DELETE CASCADE: deleting a user must delete their sessions, otherwise
  -- an orphan row would still "authenticate" a user id that no longer exists.
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Absolute expiry, computed by the DATABASE (now() + 30 days) rather than by
  -- JavaScript, so that every row agrees on what "now" means regardless of the
  -- app server's clock.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
-- token_hash is already UNIQUE, which creates an index for the login lookup
-- (`WHERE token_hash = $1`) — that is the hot path, every authenticated request.

-- Needed for the two housekeeping jobs in session.js:
--   * purgeExpiredSessions  → WHERE expires_at <= CURRENT_TIMESTAMP
--   * enforceSessionLimit   → WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS sessions_user_id_created_at_idx
  ON sessions (user_id, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- After this, you should have:
--
--   Schemas → public → Tables → users
--   Schemas → public → Tables → sessions
--
-- Verify with:
--   SELECT token_hash, user_id, created_at, expires_at FROM sessions;
--
-- Expect zero rows until you sign in. That is correct: the login route must
-- be wired up (app-additions.js) before anything writes here.
-- ────────────────────────────────────────────────────────────────────────────