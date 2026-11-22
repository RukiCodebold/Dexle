CREATE TABLE IF NOT EXISTS results (
  day     TEXT    NOT NULL,
  client  TEXT    NOT NULL,
  solved  INTEGER NOT NULL,
  guesses INTEGER NOT NULL,
  ip_hash TEXT    NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (day, client)
);
CREATE INDEX IF NOT EXISTS results_day_ip ON results (day, ip_hash);
