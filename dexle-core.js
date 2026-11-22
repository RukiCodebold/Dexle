/*
 * Dexle core: a line-for-line port of the Clem Handbook mod's generator (net.clemhandbook.dexsort.DexSort), so the web
 * page builds the same daily puzzle as the Minecraft server from the same species pool (dexle_pool.json).
 * If the mod's generator ever changes, this file has to change with it.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- java.util.Random, exactly
  const MULT = 0x5DEECE66Dn, ADD = 0xBn, MASK = (1n << 48n) - 1n;

  class JavaRandom {
    constructor(seed) {
      this.seed = (BigInt.asIntN(64, BigInt(seed)) ^ MULT) & MASK;
    }
    next(bits) {
      this.seed = (this.seed * MULT + ADD) & MASK;
      return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
    }
    nextInt(bound) {
      if (bound <= 0) throw new Error('bound must be positive');
      if ((bound & -bound) === bound) {
        return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
      }
      let bits, val;
      do {
        bits = this.next(31);
        val = bits % bound;
      } while (((bits - val + (bound - 1)) | 0) < 0);
      return val;
    }
  }

  // Collections.shuffle(list, rnd) for a RandomAccess list
  function shuffle(list, rnd) {
    for (let i = list.length; i > 1; i--) {
      const j = rnd.nextInt(i);
      const t = list[i - 1]; list[i - 1] = list[j]; list[j] = t;
    }
  }

  // ---------------------------------------------------------------- data
  function genOf(dex) {
    const ends = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
    for (let i = 0; i < ends.length; i++) if (dex <= ends[i]) return i + 1;
    return 9;
  }

  function monFrom(o) {
    const [hp, atk, def, spa, spd, spe] = o.stats;
    const types = o.t2 ? [o.t1, o.t2] : [o.t1];
    return {
      id: o.id, name: o.name, dex: o.dex, gen: genOf(o.dex), stage: o.stage, types,
      hp, atk, def, spa, spd, spe, bst: hp + atk + def + spa + spd + spe,
      eggs: new Set(o.eggs), family: o.family,
    };
  }

  // ---------------------------------------------------------------- type chart
  const CHART = {};
  function eff(atk, m, ...defs) { for (const d of defs) (CHART[atk] = CHART[atk] || {})[d] = m; }
  eff('normal', 0.5, 'rock', 'steel'); eff('normal', 0, 'ghost');
  eff('fire', 2, 'grass', 'ice', 'bug', 'steel'); eff('fire', 0.5, 'fire', 'water', 'rock', 'dragon');
  eff('water', 2, 'fire', 'ground', 'rock'); eff('water', 0.5, 'water', 'grass', 'dragon');
  eff('electric', 2, 'water', 'flying'); eff('electric', 0.5, 'electric', 'grass', 'dragon'); eff('electric', 0, 'ground');
  eff('grass', 2, 'water', 'ground', 'rock'); eff('grass', 0.5, 'fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel');
  eff('ice', 2, 'grass', 'ground', 'flying', 'dragon'); eff('ice', 0.5, 'fire', 'water', 'ice', 'steel');
  eff('fighting', 2, 'normal', 'ice', 'rock', 'dark', 'steel'); eff('fighting', 0.5, 'poison', 'flying', 'psychic', 'bug', 'fairy'); eff('fighting', 0, 'ghost');
  eff('poison', 2, 'grass', 'fairy'); eff('poison', 0.5, 'poison', 'ground', 'rock', 'ghost'); eff('poison', 0, 'steel');
  eff('ground', 2, 'fire', 'electric', 'poison', 'rock', 'steel'); eff('ground', 0.5, 'grass', 'bug'); eff('ground', 0, 'flying');
  eff('flying', 2, 'grass', 'fighting', 'bug'); eff('flying', 0.5, 'electric', 'rock', 'steel');
  eff('psychic', 2, 'fighting', 'poison'); eff('psychic', 0.5, 'psychic', 'steel'); eff('psychic', 0, 'dark');
  eff('bug', 2, 'grass', 'psychic', 'dark'); eff('bug', 0.5, 'fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy');
  eff('rock', 2, 'fire', 'ice', 'flying', 'bug'); eff('rock', 0.5, 'fighting', 'ground', 'steel');
  eff('ghost', 2, 'psychic', 'ghost'); eff('ghost', 0.5, 'dark'); eff('ghost', 0, 'normal');
  eff('dragon', 2, 'dragon'); eff('dragon', 0.5, 'steel'); eff('dragon', 0, 'fairy');
  eff('dark', 2, 'psychic', 'ghost'); eff('dark', 0.5, 'fighting', 'dark', 'fairy');
  eff('steel', 2, 'ice', 'rock', 'fairy'); eff('steel', 0.5, 'fire', 'water', 'electric', 'steel');
  eff('fairy', 2, 'fighting', 'dragon', 'dark'); eff('fairy', 0.5, 'fire', 'poison', 'steel');

  function multiplier(atk, def) {
    let m = 1;
    for (const t of def.types) {
      const row = CHART[atk];
      if (row && Object.prototype.hasOwnProperty.call(row, t)) m *= row[t];
    }
    return m;
  }
  function beats(a, b) {
    for (const t of a.types) if (multiplier(t, b) > 1) return true;
    return false;
  }
  function disjoint(a, b) {
    for (const x of a) if (b.has ? b.has(x) : b.includes(x)) return false;
    return true;
  }

  // ---------------------------------------------------------------- links (same order as the Java enum)
  const L = (name, label, desc, test) => ({ name, label, desc, test, kind: kindOf(name) });
  function kindOf(name) {
    if (name.startsWith('SPEED') || name.startsWith('STAT_') || name.startsWith('TOTAL')) return 'STAT';
    const i = name.indexOf('_');
    return i < 0 ? name : name.substring(0, i);
  }
  const STAGE_NOTE = '(babies count as the first stage)';
  const LINKS = [
    L('GEN_LT', 'Gen <', 'The left one is from an earlier generation.', (a, b) => a.gen < b.gen),
    L('GEN_EQ', 'Gen =', 'Both are from the same generation.', (a, b) => a.gen === b.gen),
    L('GEN_GT', 'Gen >', 'The left one is from a later generation.', (a, b) => a.gen > b.gen),
    L('STAGE_LT', 'Stage <', 'The left one is an earlier evolution stage ' + STAGE_NOTE + '.', (a, b) => a.stage < b.stage),
    L('STAGE_EQ', 'Stage =', 'Both are the same evolution stage ' + STAGE_NOTE + '.', (a, b) => a.stage === b.stage),
    L('STAGE_GT', 'Stage >', 'The left one is a later evolution stage ' + STAGE_NOTE + '.', (a, b) => a.stage > b.stage),
    L('BEATS_R', 'Beats >', "The left one has a type advantage over the right one (a type that's super effective against it).", (a, b) => beats(a, b)),
    L('BEATS_L', 'Beats <', "The right one has a type advantage over the left one (a type that's super effective against it).", (a, b) => beats(b, a)),
    L('SHARES', 'Type =', 'They have at least one type in common.', (a, b) => !disjoint(a.types, b.types)),
    L('EGG', 'Egg =', 'They share an egg group, so they could breed together.', (a, b) => !disjoint(a.eggs, b.eggs)),
    L('SPEED_LT', 'Speed <', 'The left one has lower base Speed.', (a, b) => a.spe < b.spe),
    L('SPEED_GT', 'Speed >', 'The left one has higher base Speed.', (a, b) => a.spe > b.spe),
    L('TOTAL_LT', 'Stat total <', 'The left one has a lower base stat total.', (a, b) => a.bst < b.bst),
    L('TOTAL_GT', 'Stat total >', 'The left one has a higher base stat total.', (a, b) => a.bst > b.bst),
    L('STAT_HP_LT', 'HP <', 'The left one has lower base HP.', (a, b) => a.hp < b.hp),
    L('STAT_HP_GT', 'HP >', 'The left one has higher base HP.', (a, b) => a.hp > b.hp),
    L('STAT_ATK_LT', 'Attack <', 'The left one has lower base Attack.', (a, b) => a.atk < b.atk),
    L('STAT_ATK_GT', 'Attack >', 'The left one has higher base Attack.', (a, b) => a.atk > b.atk),
    L('STAT_DEF_LT', 'Defence <', 'The left one has lower base Defence.', (a, b) => a.def < b.def),
    L('STAT_DEF_GT', 'Defence >', 'The left one has higher base Defence.', (a, b) => a.def > b.def),
    L('STAT_SPA_LT', 'Sp. Atk <', 'The left one has lower base Special Attack.', (a, b) => a.spa < b.spa),
    L('STAT_SPA_GT', 'Sp. Atk >', 'The left one has higher base Special Attack.', (a, b) => a.spa > b.spa),
    L('STAT_SPD_LT', 'Sp. Def <', 'The left one has lower base Special Defence.', (a, b) => a.spd < b.spd),
    L('STAT_SPD_GT', 'Sp. Def >', 'The left one has higher base Special Defence.', (a, b) => a.spd > b.spd),
  ];

  // ---------------------------------------------------------------- generation
  const N = 6;
  const PERMS = (() => {
    const out = [];
    const a = [0, 1, 2, 3, 4, 5];
    (function permute(k) {
      if (k === a.length) { out.push(a.slice()); return; }
      for (let i = k; i < a.length; i++) {
        let t = a[k]; a[k] = a[i]; a[i] = t;
        permute(k + 1);
        t = a[k]; a[k] = a[i]; a[i] = t;
      }
    })(0);
    return out;
  })();

  function solutions(mons, links, stopAt) {
    let n = 0;
    for (const p of PERMS) {
      let ok = true;
      for (let i = 0; i < links.length && ok; i++) ok = links[i].test(mons[p[i]], mons[p[i + 1]]);
      if (ok && ++n >= stopAt) return n;
    }
    return n;
  }

  function pick(pool, rng) {
    const out = [];
    const families = new Set();
    let tries = 0;
    while (out.length < N) {
      if (++tries > 200) return null;
      const m = pool[rng.nextInt(pool.length)];
      if (families.has(m.family)) continue;
      families.add(m.family);
      out.push(m);
    }
    return out;
  }

  function chooseLinks(m, rng) {
    const links = [];
    const kinds = new Map();
    for (let i = 0; i < N - 1; i++) {
      const byKind = new Map(); // insertion order, like LinkedHashMap
      for (const l of LINKS) {
        if (!l.test(m[i], m[i + 1])) continue;
        if ((kinds.get(l.kind) || 0) >= 2) continue;
        if (!byKind.has(l.kind)) byKind.set(l.kind, []);
        byKind.get(l.kind).push(l);
      }
      if (byKind.size === 0) return null;
      const weighted = [];
      for (const k of byKind.keys()) {
        const w = k === 'SHARES' || k === 'EGG' ? 1 : 2;
        for (let n = 0; n < w; n++) weighted.push(k);
      }
      const kind = weighted[rng.nextInt(weighted.length)];
      const options = byKind.get(kind);
      const l = options[rng.nextInt(options.length)];
      links.push(l);
      kinds.set(kind, (kinds.get(kind) || 0) + 1);
    }
    return links;
  }

  function scramble(answer, links, rng) {
    const list = answer.slice();
    for (let t = 0; t < 500; t++) {
      shuffle(list, rng);
      let right = 0;
      for (let i = 0; i < links.length; i++) if (links[i].test(list[i], list[i + 1])) right++;
      let same = true;
      for (let i = 0; i < list.length; i++) if (list[i] !== answer[i]) { same = false; break; }
      if (right <= 2 && !same) return list.slice();
    }
    return answer.slice().reverse();
  }

  function daily(pool, seed) {
    const rng = new JavaRandom(seed);
    for (let attempt = 0; attempt < 5000; attempt++) {
      const picks = pick(pool, rng);
      if (picks === null) continue;
      for (let tryLinks = 0; tryLinks < 40; tryLinks++) {
        const links = chooseLinks(picks, rng);
        if (links === null) break;
        if (solutions(picks, links, 2) !== 1) continue;
        const start = scramble(picks, links, rng);
        return { answer: picks, links, start };
      }
    }
    throw new Error('No unique puzzle found');
  }

  /** The seed the server uses for a date string like "2026-11-23": epochDay * 31 + 7. */
  function seedFor(dateStr) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const epochDay = Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
    return BigInt(epochDay) * 31n + 7n;
  }

  function check(puzzle, order) {
    return puzzle.links.map((l, i) => l.test(order[i], order[i + 1]));
  }

  const api = { JavaRandom, monFrom, daily, seedFor, check, LINKS, genOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DexleCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
