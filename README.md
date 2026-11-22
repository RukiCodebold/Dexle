# Dexle on the web

The same daily puzzle as the Clem Cobblemon server, plus random puzzles with shareable links.

## Files
- `index.html`: the page
- `dexle-core.js`: the puzzle generator (a line-for-line copy of the mod's, so puzzles match the server)
- `dexle_pool.json`: the species list. **Replace this with your server's copy** (see below)
- `fonts/`: Kalam and Pixelify Sans (SIL Open Font License, see `fonts/OFL.txt`)

## Setup
1. Install Clem Handbook 1.3.0 or newer on the server and start it.
2. Run `/dexle export` (ops only). It writes `config/dexle_pool.json`. The server also rewrites that file by itself
   the first time anyone opens Dexle after a restart.
3. Copy these files into a folder of a GitHub Pages repo, e.g. `dexle/`, and replace `dexle_pool.json` with the
   server's file.
4. Push. The page is at `https://<user>.github.io/<repo>/dexle/`.

If you use the modpack repo, add `dexle/` to `.packwizignore` first. Otherwise `packwiz refresh` indexes the
page into the modpack and every player's instance downloads it.

## Keeping it in sync
- Re-export and re-upload `dexle_pool.json` whenever you add or remove species data packs on the server, ideally at
  the midnight restart so the day's puzzle doesn't change partway through.
- If a future mod update changes how puzzles are generated, `dexle-core.js` has to be updated with it.
