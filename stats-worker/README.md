# Dexle stats Worker

Counts finished daily puzzles from the web version so the page can show how many players finished today, the share who solved it, and the average guesses among solvers.

- `worker.js`: the Worker. `POST /result` records one result per browser per day; `GET /stats?day=YYYY-MM-DD` returns the totals.
- `schema.sql`: the D1 table.
- `wrangler.toml`: only needed if you deploy from the command line.

Rules: only yesterday, today, or tomorrow (Pacific) are accepted, guesses must be 1 to 4 (a failed game is 4), one result per browser per day, at most 6 results per network per day, and only pages served from `ALLOWED_ORIGINS` may post. IP addresses are never stored, only a hash salted by the day.

Settings (optional; the defaults are in `worker.js`): `ALLOWED_ORIGINS`, `TIMEZONE`, `LIVES`, `PER_IP_PER_DAY`.
