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

const ROLE_RANKS = {
  Playmaker: [1],
  "Play/Guardia": [1, 2],
  Guardia: [2],
  "Guardia/Ala": [2, 3],
  Ala: [3, 4],
  "Ala/Centro": [4, 5],
  Centro: [5],
};
const SLOT_RANK_BY_SHORT = { PM: 1, G: 2, AP: 3, AG: 4, C: 5 };

async function playOneGame(page, gameIndex, errors) {
  await page.click("#btn-start");
  await page.waitForSelector("#screen-draft:not([hidden])");

  const pickedRoles = []; // { slotShort, role }
  for (let round = 1; round <= 5; round++) {
    await page.waitForSelector(".player-row", { timeout: 5000 });

    const rows = await page.$$eval(".player-row", (els) =>
      els.map((el, i) => ({
        i,
        name: el.querySelector(".player-name")?.textContent.trim(),
        role: el.querySelector(".player-role")?.textContent.trim(),
        disabled: el.classList.contains("disabled"),
      }))
    );
    const target = rows.find((r) => !r.disabled);
    if (!target) {
      errors.push(`game ${gameIndex} round ${round}: nessuna riga selezionabile (soft lock)`);
      return;
    }

    await page.locator(".player-row").nth(target.i).click();
    await page.waitForSelector(".slot-box.legal", { timeout: 3000 });
    const legalShorts = await page.$$eval(".slot-box.legal .lbl-short", (els) => els.map((e) => e.textContent.trim()));

    // il ruolo del giocatore deve coprire almeno uno dei rank degli slot legali mostrati
    const playerRanks = ROLE_RANKS[target.role] || [];
    const legalRanks = legalShorts.map((s) => SLOT_RANK_BY_SHORT[s]);
    const overlap = legalRanks.some((r) => playerRanks.includes(r));
    if (!overlap) {
      errors.push(
        `game ${gameIndex} round ${round}: ${target.name} (ruolo ${target.role}) mostrato legale per slot ${legalShorts.join(",")} ma nessun rank combacia`
      );
    }

    await page.locator(".slot-box.legal").first().click();
    pickedRoles.push({ name: target.name, role: target.role });

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
    errors.push(`game ${gameIndex}: quintetto finale con ${finalNames.length} giocatori invece di 5`);
  } else if (new Set(finalNames).size !== 5) {
    errors.push(`game ${gameIndex}: doppione nel quintetto finale - ${JSON.stringify(finalNames)}`);
  }

  await page.click("#btn-again");
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
    await playOneGame(page, g, gameErrors);
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
