#!/usr/bin/env node
/*
 * Check di difficoltà: il gioco è tarato come dice il README?
 *
 * Lo smoke test verifica che una partita si possa giocare senza errori,
 * non che sia bilanciata: gioca "prima riga selezionabile", cioè non
 * prova nemmeno a vincere. Questo script misura invece quanto è
 * difficile ottenere un buon risultato, che è la cosa che si sfasa da
 * sola ogni volta che cambiano i ruoli, le soglie o il dataset (è già
 * successo: le correzioni ai ruoli e la regola dei rimbalzi hanno reso
 * il tier S più frequente di quanto scritto nel README, ~1 su 36 invece
 * di ~1 su 78, senza che nessuno se ne accorgesse).
 *
 * Usa le funzioni VERE del gioco chiamate sulla pagina reale (drawFive,
 * ranksFor, evaluateLineup): re-implementarle qui misurerebbe la copia,
 * non il gioco.
 *
 * Due misure separate:
 *
 * 1. Tre strategie a confronto sulla stessa pescata
 *      - "primo eleggibile": quella dello smoke test
 *      - "avido": miglior rating disponibile round per round, senza
 *        pianificare (un giocatore attento ma umano)
 *      - "ottimo": la miglior formazione possibile su quella pescata
 *        (tutte le 120 assegnazioni carta->slot x i migliori candidati
 *        per casella)
 *
 * 2. Raggiungibilità del 30-0, su molte più pescate: si calcola solo il
 *    rating massimo ottenibile (senza penalità), che è un LIMITE
 *    SUPERIORE - se nemmeno quello arriva a PERFECTION_THRESHOLD, il
 *    30-0 su quella pescata è impossibile. Così si possono fare
 *    centinaia di migliaia di pescate invece di poche centinaia.
 *
 * Uso:
 *   1. avviare un server statico sulla cartella docs/, es.:
 *        python3 -m http.server 8899 --directory docs
 *   2. node tests/difficulty_check.js [pescate] [pescate-30-0] [url]
 */
const { DEFAULT_URL, launchBrowser, newPage, gotoHome } = require("./lib/driver");

const DRAWS = Number(process.argv[2] || 800);
const REACH_DRAWS = Number(process.argv[3] || 200000);
const URL = process.argv[4] || DEFAULT_URL;

// soglie di allarme: non "il numero è cambiato" (cambia ad ogni ritocco
// del dataset), ma "il gioco non fa più quello che dice di fare"
const EXPECT = {
  // giocando in modo ottimale la media deve restare in una fascia
  // sensata: troppo in alto = vince chiunque, troppo in basso = punitivo
  optimalMeanMin: 22,
  optimalMeanMax: 28,
  // il 30-0 deve restare raro ma POSSIBILE: se diventa irraggiungibile
  // in assoluto il gioco promette nel nome un traguardo che non esiste
  perfectMustBePossible: true,
};

function summarize(wins) {
  const w = [...wins].sort((a, b) => a - b);
  const mean = w.reduce((a, b) => a + b, 0) / (w.length || 1);
  return {
    partite: w.length,
    media: +mean.toFixed(2),
    mediana: w[Math.floor(w.length / 2)],
    min: w[0],
    max: w[w.length - 1],
    tierS: w.filter((x) => x >= 29).length,
    perfette: w.filter((x) => x === 30).length,
  };
}

(async () => {
  const browser = await launchBrowser();
  const page = await newPage(browser);
  await gotoHome(page, URL);

  const res = await page.evaluate(
    ({ draws, reachDraws }) => {
      currentPool = ALL_TEAM_SEASONS;
      recomputeCurve(currentPool, heightRulesEnabled);

      const RANKS = [1, 2, 3, 4, 5];
      const permutations = (arr) => {
        if (arr.length <= 1) return [arr];
        const out = [];
        arr.forEach((x, i) => {
          const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
          for (const p of permutations(rest)) out.push([x, ...p]);
        });
        return out;
      };
      const PERMS = permutations([0, 1, 2, 3, 4]);

      const pickSequential = (draw, cmp) => {
        // strategia a turni: scorre le carte in ordine, sceglie un
        // giocatore e occupa uno slot, senza tornare indietro (come il
        // gioco vero, che non permette di ripensarci)
        const open = new Set(RANKS);
        const chosen = [];
        const usedIds = new Set();
        for (const card of draw) {
          const sorted = [...card.players].sort(cmp);
          const pick = sorted.find(
            (p) => !usedIds.has(p.player_id) && ranksFor(p, heightRulesEnabled).some((r) => open.has(r))
          );
          if (!pick) return null; // softlock
          const slot = ranksFor(pick, heightRulesEnabled).filter((r) => open.has(r)).sort()[0];
          open.delete(slot);
          usedIds.add(pick.player_id);
          chosen.push(pick);
        }
        return chosen;
      };

      const byPoints = (a, b) => b.points_avg - a.points_avg;
      const byRating = (a, b) => Number(b.rating_lega || 0) - Number(a.rating_lega || 0);

      const TOP_N = 3;
      const playOptimal = (draw) => {
        const cand = draw.map((card) => {
          const byRank = {};
          for (const r of RANKS) {
            byRank[r] = card.players
              .filter((p) => ranksFor(p, heightRulesEnabled).includes(r))
              .sort(byRating)
              .slice(0, TOP_N);
          }
          return byRank;
        });
        let best = null;
        for (const perm of PERMS) {
          const lists = draw.map((_, i) => cand[i][perm[i] + 1]);
          if (lists.some((l) => l.length === 0)) continue;
          const idx = [0, 0, 0, 0, 0];
          while (true) {
            const chosen = lists.map((l, i) => l[idx[i]]);
            if (new Set(chosen.map((p) => p.player_id)).size === 5) {
              const r = evaluateLineup(chosen);
              if (!best || r.winsFinal > best.winsFinal || (r.winsFinal === best.winsFinal && r.teamRating > best.teamRating)) {
                best = { winsFinal: r.winsFinal, teamRating: r.teamRating };
              }
            }
            let k = 4;
            while (k >= 0 && ++idx[k] >= lists[k].length) { idx[k] = 0; k--; }
            if (k < 0) break;
          }
        }
        return best;
      };

      const wins = { firstEligible: [], greedy: [], optimal: [] };
      const optimalRatings = [];
      let softlock = 0;

      for (let i = 0; i < draws; i++) {
        const draw = drawFive();
        const fe = pickSequential(draw, byPoints);
        const gr = pickSequential(draw, byRating);
        if (!fe || !gr) { softlock++; continue; }
        wins.firstEligible.push(evaluateLineup(fe).winsFinal);
        wins.greedy.push(evaluateLineup(gr).winsFinal);
        const best = playOptimal(draw);
        if (best) {
          wins.optimal.push(best.winsFinal);
          optimalRatings.push(best.teamRating);
        }
      }

      // --- 2. raggiungibilita' del 30-0 (limite superiore, veloce) ---
      const bestByCard = ALL_TEAM_SEASONS.map((ts) => {
        const best = [0, 0, 0, 0, 0];
        for (const p of ts.players) {
          const rl = Number(p.rating_lega || 0);
          for (const r of ranksFor(p, heightRulesEnabled)) if (rl > best[r - 1]) best[r - 1] = rl;
        }
        return { best, teamKey: ts.teamKey, label: ts.abbr + " " + ts.decadeLabel };
      });
      const cardByLabel = new Map(bestByCard.map((c) => [c.label, c]));
      const maxRatingOf = (cards) => {
        let best = 0;
        for (const perm of PERMS) {
          let sum = 0;
          for (let i = 0; i < 5; i++) sum += cards[i].best[perm[i]];
          if (sum > best) best = sum;
        }
        return best;
      };

      let sopraSoglia = 0;
      let maxPescando = 0;
      for (let i = 0; i < reachDraws; i++) {
        const five = drawFive().map((ts) => cardByLabel.get(ts.abbr + " " + ts.decadeLabel));
        const r = maxRatingOf(five);
        if (r > maxPescando) maxPescando = r;
        if (r >= PERFECTION_THRESHOLD) sopraSoglia++;
      }

      // la miglior combinazione di 5 carte in assoluto: dice se il 30-0
      // e' possibile almeno in teoria
      let bestEver = { rating: 0, cards: null };
      const n = bestByCard.length;
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++)
          for (let c = b + 1; c < n; c++)
            for (let d = c + 1; d < n; d++)
              for (let e = d + 1; e < n; e++) {
                const cards = [bestByCard[a], bestByCard[b], bestByCard[c], bestByCard[d], bestByCard[e]];
                if (new Set(cards.map((x) => x.teamKey)).size < 5) continue;
                const r = maxRatingOf(cards);
                if (r > bestEver.rating) bestEver = { rating: r, cards: cards.map((x) => x.label) };
              }

      const rs = [...optimalRatings].sort((a, b) => a - b);
      return {
        soglia: +PERFECTION_THRESHOLD.toFixed(1),
        tetto: +CEILING.toFixed(1),
        wins,
        softlock,
        ratingOttimo: {
          mediana: +rs[Math.floor(rs.length / 2)].toFixed(1),
          max: +rs[rs.length - 1].toFixed(1),
          percentualeDelTetto: +((100 * rs[rs.length - 1]) / CEILING).toFixed(1),
        },
        raggiungibilita: {
          pescate: reachDraws,
          sopraSoglia,
          unaOgni: sopraSoglia ? Math.round(reachDraws / sopraSoglia) : null,
          maxPescando: +maxPescando.toFixed(1),
        },
        miglioreInAssoluto: {
          rating: +bestEver.rating.toFixed(1),
          carte: bestEver.cards,
          superaLaSoglia: bestEver.rating >= PERFECTION_THRESHOLD,
        },
      };
    },
    { draws: DRAWS, reachDraws: REACH_DRAWS }
  );

  const fe = summarize(res.wins.firstEligible);
  const gr = summarize(res.wins.greedy);
  const op = summarize(res.wins.optimal);

  console.log(`\nSoglia 30-0: rating ${res.soglia} (tetto teorico ${res.tetto})\n`);
  console.log("Strategia            media  mediana  min  max  tier S  30-0");
  const row = (name, s) =>
    `${name.padEnd(20)} ${String(s.media).padStart(5)}  ${String(s.mediana).padStart(7)}  ` +
    `${String(s.min).padStart(3)}  ${String(s.max).padStart(3)}  ${String(s.tierS).padStart(6)}  ${String(s.perfette).padStart(4)}`;
  console.log(row("primo eleggibile", fe));
  console.log(row("avido", gr));
  console.log(row("ottimo", op));
  console.log(`\n  (su ${op.partite} pescate, softlock: ${res.softlock})`);
  console.log(
    `  tier S giocando in modo ottimale: 1 ogni ${Math.round(op.partite / (op.tierS || 1))} partite`
  );
  console.log(
    `  miglior rating raggiunto: ${res.ratingOttimo.max} (${res.ratingOttimo.percentualeDelTetto}% del tetto), mediana ${res.ratingOttimo.mediana}`
  );

  const r = res.raggiungibilita;
  console.log(`\nRaggiungibilita' del 30-0 (limite superiore, ${r.pescate} pescate):`);
  console.log(
    `  ${r.sopraSoglia} pescate sopra la soglia` +
      (r.unaOgni ? ` = ~1 ogni ${r.unaOgni}` : " = mai") +
      `, miglior pescata vista ${r.maxPescando}`
  );
  const b = res.miglioreInAssoluto;
  console.log(
    `  miglior combinazione possibile di 5 carte: rating ${b.rating} (${b.carte.join(", ")}) -> ` +
      (b.superaLaSoglia ? "supera la soglia, il 30-0 e' possibile" : "SOTTO la soglia: 30-0 IMPOSSIBILE")
  );

  const problems = [];
  if (op.media < EXPECT.optimalMeanMin || op.media > EXPECT.optimalMeanMax) {
    problems.push(
      `media giocando in modo ottimale ${op.media} fuori dalla fascia attesa ` +
        `${EXPECT.optimalMeanMin}-${EXPECT.optimalMeanMax}`
    );
  }
  if (EXPECT.perfectMustBePossible && !b.superaLaSoglia) {
    problems.push("il 30-0 non e' raggiungibile con nessuna combinazione di carte: il gioco promette nel nome un traguardo che non esiste");
  }

  console.log("");
  if (problems.length) {
    console.log("=== PROBLEMI ===");
    for (const p of problems) console.log("  - " + p);
    await browser.close();
    process.exit(1);
  }
  console.log("OK");
  await browser.close();
})();
