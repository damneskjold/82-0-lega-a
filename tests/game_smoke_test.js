#!/usr/bin/env node
/*
 * Test di fumo per il gioco (docs/index.html + app.js), con Playwright.
 * Consolida in un unico script versionato le verifiche fatte a mano
 * più volte durante lo sviluppo (e finite in /tmp, quindi perse ogni
 * volta): completamento partita, nessun doppione nel quintetto,
 * legalità dei ruoli negli slot, 0 errori console.
 *
 * Per i glitch grafici (overflow, testo tagliato, elementi coperti) c'è
 * invece tests/visual_check.js, che riusa gli stessi helper di guida.
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
const {
  MODES,
  DEFAULT_URL,
  launchBrowser,
  newPage,
  gotoHome,
  startMode,
  selectPlayableRow,
  placeAndAdvance,
} = require("./lib/driver");

const GAMES = parseInt(process.argv[2] || "20", 10);
const URL = process.argv[3] || DEFAULT_URL;

async function playOneGame(page, gameIndex, errors, mode) {
  await startMode(page, mode);

  for (let round = 1; round <= 5; round++) {
    const picked = await selectPlayableRow(page, mode === "blind");
    if (!picked) {
      errors.push(`game ${gameIndex} [${mode}] round ${round}: nessuna riga selezionabile (soft lock)`);
      return;
    }

    // gli slot mostrati come legali devono corrispondere esattamente ai
    // rank del giocatore secondo ranksFor()
    const { target, legalShorts, legalRanks } = picked;
    const overlap = legalRanks.length > 0 && legalRanks.every((r) => target.ranks.includes(r));
    if (!overlap) {
      errors.push(
        `game ${gameIndex} [${mode}] round ${round}: ${target.name} (rank ${JSON.stringify(target.ranks)}) mostrato legale per slot ${legalShorts.join(",")} (rank ${JSON.stringify(legalRanks)}) - non combaciano`
      );
    }

    await placeAndAdvance(page, round);
  }

  // id reali, non il nome abbreviato mostrato a schermo (".who-name" e'
  // "N. Cognome": nel dataset ci sono giocatori reali distinti che
  // condividono la stessa sigla, es. due "D. Taylor" diversi - un
  // controllo per nome darebbe un falso doppione)
  const finalIds = await page.evaluate(() => slots.map((s) => s.pick.player.player_id));
  if (finalIds.length !== 5) {
    errors.push(`game ${gameIndex} [${mode}]: quintetto finale con ${finalIds.length} giocatori invece di 5`);
  } else if (new Set(finalIds).size !== 5) {
    errors.push(`game ${gameIndex} [${mode}]: doppione nel quintetto finale - ${JSON.stringify(finalIds)}`);
  }

  await page.click("#btn-change-mode");
  await page.waitForSelector("#screen-home:not([hidden])");
}

(async () => {
  const browser = await launchBrowser();
  const page = await newPage(browser, { width: 1280, height: 900 });

  await gotoHome(page, URL);

  const gameErrors = [];
  for (let g = 1; g <= GAMES; g++) {
    // alterna le 3 modalita' fra le partite, cosi' lo smoke test copre
    // tutte e tre senza dover triplicare il numero di partite giocate
    await playOneGame(page, g, gameErrors, MODES[(g - 1) % MODES.length]);
  }

  const consoleErrors = page.consoleErrors;
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
