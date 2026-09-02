#!/usr/bin/env node
/*
 * Test di fumo per il gioco (docs/index.html + app.js), con Playwright.
 * Consolida in un unico script versionato le verifiche fatte a mano
 * più volte durante lo sviluppo (e finite in /tmp, quindi perse ogni
 * volta): completamento partita, nessun doppione nel quintetto,
 * legalità dei ruoli negli slot, 0 errori console.
 *
 * Uso:
 *   1. avviare un server statico sulla cartella docs/, es.:
 *        python3 -m http.server 8899 --directory docs
 *   2. node tests/game_smoke_test.js [numero_partite] [url]
 *      (default: 20 partite, http://localhost:8899)
 *
 * Richiede Playwright installato e disponibile a livello globale
 * (require('playwright')) - non è una dipendenza npm del repo.
 */
// playwright non e' una dipendenza npm del repo: si prova la risoluzione
// normale (funziona se e' installato come dipendenza o globalmente sul
// path di node), altrimenti si cade sul percorso globale noto in questo
// ambiente di sviluppo.
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node22/lib/node_modules/playwright"));
}

const GAMES = parseInt(process.argv[2] || "20", 10);
const URL = process.argv[3] || "http://localhost:8899";

const SLOT_RANK_BY_SHORT = { PM: 1, G: 2, AP: 3, AG: 4, C: 5 };
// alterna le 3 modalita' fra le partite, cosi' lo smoke test copre tutte e
// tre senza dover triplicare il numero di partite giocate
const MODES = ["classic", "decade", "blind"];

async function startMode(page, mode) {
  if (mode === "classic") {
    await page.click("#btn-mode-classic");
  } else if (mode === "blind") {
    await page.click("#btn-mode-blind");
  } else {
    await page.click("#btn-mode-decade-open");
    await page.waitForSelector("#screen-decades:not([hidden])");
    // 2 decadi a caso fra quelle disponibili, come richiesto dal minimo di gioco
    await page.check("input.decade-check[value=\"'90s\"]");
    await page.check("input.decade-check[value=\"'10s\"]");
    await page.click("#btn-decades-start");
  }
  await page.waitForSelector("#screen-draft:not([hidden])");
}

async function playOneGame(page, gameIndex, errors, mode) {
  await startMode(page, mode);

  for (let round = 1; round <= 5; round++) {
    await page.waitForSelector(".player-row", { timeout: 5000 });

    // riga -> vero oggetto giocatore, nello stesso ordine con cui il gioco li
    // renderizza (per points_avg desc, o alfabetico per cognome in Blind -
    // vedi renderRound in app.js), cosi' la legalita' si verifica con la
    // stessa fonte di verita' del gioco (ranksFor, esposta su window
    // essendo una function declaration) invece di re-implementare qui la
    // logica dei ruoli/soglie altezza - altrimenti il test si disallinea
    // ogni volta che quella logica cambia
    const rowData = await page.evaluate((isBlind) => {
      const ts = currentDraw[roundIndex];
      const pickedIds = new Set(slots.filter((s) => s.pick).map((s) => s.pick.player.player_id));
      const openRanks = new Set(slots.filter((s) => !s.pick).map((s) => s.rank));
      const sorted = isBlind
        ? [...ts.players].sort((a, b) => a.surname.localeCompare(b.surname))
        : [...ts.players].sort((a, b) => b.points_avg - a.points_avg);
      return sorted.map((p) => {
        const ranks = pickedIds.has(p.player_id) ? [] : ranksFor(p, heightRulesEnabled);
        const hasOpenSlot = ranks.some((r) => openRanks.has(r));
        return { name: `${p.name} ${p.surname}`, disabled: !hasOpenSlot, ranks };
      });
    }, mode === "blind");

    const target = rowData.find((r) => !r.disabled);
    if (!target) {
      errors.push(`game ${gameIndex} [${mode}] round ${round}: nessuna riga selezionabile (soft lock)`);
      return;
    }

    const rowIndex = rowData.indexOf(target);
    await page.locator(".player-row").nth(rowIndex).click();
    await page.waitForSelector(".slot-box.legal", { timeout: 3000 });
    const legalShorts = await page.$$eval(".slot-box.legal .lbl-short", (els) => els.map((e) => e.textContent.trim()));

    // gli slot mostrati come legali devono corrispondere esattamente ai
    // rank del giocatore secondo ranksFor()
    const legalRanks = legalShorts.map((s) => SLOT_RANK_BY_SHORT[s]).sort();
    const overlap = legalRanks.length > 0 && legalRanks.every((r) => target.ranks.includes(r));
    if (!overlap) {
      errors.push(
        `game ${gameIndex} [${mode}] round ${round}: ${target.name} (rank ${JSON.stringify(target.ranks)}) mostrato legale per slot ${legalShorts.join(",")} (rank ${JSON.stringify(legalRanks)}) - non combaciano`
      );
    }

    await page.locator(".slot-box.legal").first().click();

    if (round < 5) {
      await page.waitForFunction(
        (r) => document.querySelector("#round-progress")?.textContent.includes(`Squadra ${r + 1} di`),
        round
      );
    } else {
      await page.waitForSelector("#screen-result:not([hidden])");
    }
  }

  const finalNames = await page.$$eval(".lineup-row .who-name", (els) => els.map((e) => e.textContent.trim()));
  if (finalNames.length !== 5) {
    errors.push(`game ${gameIndex} [${mode}]: quintetto finale con ${finalNames.length} giocatori invece di 5`);
  } else if (new Set(finalNames).size !== 5) {
    errors.push(`game ${gameIndex} [${mode}]: doppione nel quintetto finale - ${JSON.stringify(finalNames)}`);
  }

  await page.click("#btn-change-mode");
  await page.waitForSelector("#screen-home:not([hidden])");
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push("console: " + m.text());
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("#screen-home:not([hidden])");

  const gameErrors = [];
  for (let g = 1; g <= GAMES; g++) {
    await playOneGame(page, g, gameErrors, MODES[(g - 1) % MODES.length]);
  }

  await browser.close();

  console.log(`Partite giocate: ${GAMES}`);
  console.log(`Errori di gioco: ${gameErrors.length}`);
  gameErrors.forEach((e) => console.log("  - " + e));
  console.log(`Errori console: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log("  - " + e));

  const ok = gameErrors.length === 0 && consoleErrors.length === 0;
  console.log(ok ? "\nOK" : "\nFALLITO");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("Test crashato:", e);
  process.exit(1);
});
