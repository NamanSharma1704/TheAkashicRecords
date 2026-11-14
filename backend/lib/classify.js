/* The System's classifier: a series' class from its genres and title. (Split out of index.js, 2026-11-13.) */

// ─── INTERNAL SCORERS ─────────────────────────────────────────────────────────
// Both return a Record<class, number> so they can be additively combined.

const _genreScores = (genres) => {
    const scores = { NECROMANCER: 0, CONSTELLATION: 0, MAGE: 0, IRREGULAR: 0, PLAYER: 0 };
    if (!genres || genres.length === 0) return scores;

    const g = genres.map(x => x.toLowerCase());
    const has = (kw) => g.some(genre => genre.includes(kw));

    // PLAYER — explicit game/system mechanics
    if (has('game'))                     scores.PLAYER += 8;
    if (has('rpg'))                      scores.PLAYER += 8;
    if (has('video game'))               scores.PLAYER += 8;
    if (has('virtual reality'))          scores.PLAYER += 6;
    if (has('level'))                    scores.PLAYER += 5;
    if (has('system'))                   scores.PLAYER += 5;
    if (has('dungeon'))                  scores.PLAYER += 5;
    if (has('user registration'))        scores.PLAYER += 6;
    if (has('guild'))                    scores.PLAYER += 4;
    if (has('tournament'))               scores.PLAYER += 3;

    // IRREGULAR — isekai / regression / transmigration
    if (has('isekai'))                   scores.IRREGULAR += 9;
    if (has('reincarnation'))            scores.IRREGULAR += 9;
    if (has('regression'))               scores.IRREGULAR += 9;
    if (has('transmigration'))           scores.IRREGULAR += 9;
    if (has('time travel'))              scores.IRREGULAR += 7;
    if (has('time loop'))                scores.IRREGULAR += 7;
    if (has('transported to another'))   scores.IRREGULAR += 8;
    if (has('villainess'))               scores.IRREGULAR += 6;
    if (has('second chance'))            scores.IRREGULAR += 6;
    if (has('tower'))                    scores.IRREGULAR += 5;
    if (has('overpowered main character')) scores.IRREGULAR += 3;

    // MAGE — explicit magic/sorcery tags (note: bare 'fantasy' is very generic, only +1)
    if (has('magic system'))             scores.MAGE += 8;
    if (has('magic'))                    scores.MAGE += 7;
    if (has('alchemy'))                  scores.MAGE += 7;
    if (has('sorcery'))                  scores.MAGE += 8;
    if (has('wizard'))                   scores.MAGE += 8;
    if (has('witchcraft'))               scores.MAGE += 8;
    if (has('elemental'))                scores.MAGE += 5;
    if (has('mana'))                     scores.MAGE += 5;
    if (has('spirit'))                   scores.MAGE += 4;
    if (has('contract'))                 scores.MAGE += 4;
    if (has('familiar'))                 scores.MAGE += 4;
    if (has('enchant'))                  scores.MAGE += 5;
    // "fantasy" alone is too vague — minimal weight so title signals can override
    if (has('fantasy') && !has('isekai') && !has('reincarnation')) scores.MAGE += 1;

    // CONSTELLATION — divine / mythological / cosmic
    if (has('mythology'))                scores.CONSTELLATION += 9;
    if (has('gods'))                     scores.CONSTELLATION += 8;
    if (has('divine'))                   scores.CONSTELLATION += 8;
    if (has('celestial'))                scores.CONSTELLATION += 8;
    if (has('cosmic'))                   scores.CONSTELLATION += 8;
    if (has('religion'))                 scores.CONSTELLATION += 6;
    if (has('prophecy'))                 scores.CONSTELLATION += 7;
    if (has('fate'))                     scores.CONSTELLATION += 5;
    if (has('chosen one'))               scores.CONSTELLATION += 6;
    if (has('heaven'))                   scores.CONSTELLATION += 5;
    if (has('saint'))                    scores.CONSTELLATION += 5;
    if (has('angel'))                    scores.CONSTELLATION += 5;
    if (has('dragon'))                   scores.CONSTELLATION += 4;

    // NECROMANCER — death / dark arts / horror / underworld
    if (has('necromancy'))               scores.NECROMANCER += 10;
    if (has('undead'))                   scores.NECROMANCER += 9;
    if (has('horror'))                   scores.NECROMANCER += 7;
    if (has('gore'))                     scores.NECROMANCER += 6;
    if (has('zombie'))                   scores.NECROMANCER += 8;
    if (has('skeleton'))                 scores.NECROMANCER += 8;
    if (has('dark fantasy'))             scores.NECROMANCER += 6;
    if (has('supernatural') && has('horror')) scores.NECROMANCER += 5;
    if (has('demons') && has('horror'))  scores.NECROMANCER += 5;
    if (has('psychological') && has('horror')) scores.NECROMANCER += 5;
    if (has('survival') && has('horror')) scores.NECROMANCER += 4;
    if (has('shadow'))                   scores.NECROMANCER += 5;
    if (has('death'))                    scores.NECROMANCER += 4;

    return scores;
};

const _titleScores = (title) => {
    const t = title.toLowerCase();
    const scores = { NECROMANCER: 0, CONSTELLATION: 0, MAGE: 0, IRREGULAR: 0, PLAYER: 0 };

    // Weight tiers:
    //   10 = class-defining single word (necromancer, wizard, isekai)
    //    6 = strong supporting word (shadow, lich, tower)
    //    3 = ambiguous but relevant (dark, return, awakened)

    // NECROMANCER keywords
    [['necromancer', 10], ['necromancy', 10], ['necro', 10], ['undead', 10], ['lich', 10],
     ['death knight', 10], ['zombie', 9], ['skeleton', 9], ['dark lord', 8],
     ['shadow monarch', 8], ['death god', 8], ['demon king', 6], ['bone', 6],
     ['corpse', 6], ['grave', 6], ['reaper', 6], ['wraith', 6], ['phantom', 6],
     ['abyss', 5], ['cursed', 4], ['shadow', 5], ['hollow', 4], ['shade', 5],
     ['requiem', 6], ['soul stealer', 8], ['revenant', 8]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.NECROMANCER += w; });

    // CONSTELLATION keywords
    [['constellation', 10], ['celestial', 10], ['mythology', 10], ['divine', 8],
     ['cosmic', 8], ['god', 6], ['goddess', 8], ['angel', 7], ['archangel', 8],
     ['oracle', 8], ['saint', 7], ['holy', 6], ['sacred', 6], ['heaven', 6],
     ['ascend', 5], ['transcend', 5], ['immortal', 5], ['eternal', 5],
     ['dragon god', 8], ['prophecy', 7], ['fated', 5], ['chosen', 5]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.CONSTELLATION += w; });

    // IRREGULAR keywords
    [['isekai', 10], ['reincarnation', 10], ['reincarnate', 10], ['transmigrat', 10],
     ['regression', 10], ['regress', 9], ['returner', 8], ['time loop', 9],
     ['time travel', 9], ['second life', 8], ['second chance', 8], ['restart', 7],
     ['irregular', 10], ['villainess', 8], ['return', 4], ['otherworld', 7],
     ['tower', 5], ['invincible', 5], ['strongest', 5], ['overpowered', 5]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.IRREGULAR += w; });

    // MAGE keywords
    [['wizard', 10], ['mage', 10], ['sorcerer', 10], ['witch', 10], ['archmage', 10],
     ['arch mage', 10], ['witchcraft', 10], ['magician', 8], ['sorcery', 10],
     ['enchant', 7], ['alchemy', 9], ['alchemist', 9], ['arcane', 8],
     ['spell', 6], ['magic', 7], ['potion', 6], ['familiar', 6],
     ['grimoire', 7], ['elemental', 6], ['summoner', 6], ['mystic', 5]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.MAGE += w; });

    // PLAYER keywords
    [['player', 10], ['ranker', 9], ['leveling', 10], ['levelling', 10],
     ['level up', 9], ['hunter', 7], ['dungeon', 7], ['guild', 7],
     ['raider', 7], ['mmorpg', 10], ['game', 7], ['rpg', 10],
     ['solo', 5], ['rank', 4], ['awakener', 6], ['boss', 5]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.PLAYER += w; });

    return scores;
};

// Combined classifier — adds genre + title scores so neither is silently discarded.
// Example: "Return of the Necromancer" with genres ["Action","Fantasy"]:
//   NECROMANCER = genre:0 + title:10 = 10  ✓ wins
//   MAGE        = genre:1 + title:0  = 1
const classifyBest = (title, genres, oldClass) => {
    const gs = _genreScores(genres || []);
    const ts = _titleScores(title || '');

    const PRIORITY = ['NECROMANCER', 'CONSTELLATION', 'MAGE', 'IRREGULAR', 'PLAYER'];
    let best = 'PLAYER', bestScore = 0;
    for (const cls of PRIORITY) {
        const combined = gs[cls] + ts[cls];
        if (combined > bestScore) { bestScore = combined; best = cls; }
    }
    
    // If we confidently scored something, return it.
    // Otherwise, retain the old class. If no old class exists, default to PLAYER.
    if (bestScore > 0) return best;
    return oldClass || 'PLAYER';
};

module.exports = { _genreScores, _titleScores, classifyBest };
