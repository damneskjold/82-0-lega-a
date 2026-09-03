"use strict";
/*
 * Helper condivisi per guidare il gioco (docs/index.html + app.js) da
 * Playwright. Estratti da game_smoke_test.js quando è arrivato il
 * secondo script di test (visual_check.js): la logica per pescare una
 * riga giocatore legale è la parte delicata (dipende da ranksFor() e
 * dagli slot ancora liberi) e va scritta una volta sola, altrimenti i
 * due test si disallineano appena cambia la logica dei ruoli.
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

const SLOT_RANK_BY_SHORT = { PM: 1, G: 2, AP: 3, AG: 4, C: 5 };
const MODES = ["classic", "decade", "blind"];
const DEFAULT_URL = "http://localhost:8899";

async function launchBrowser() {
  return chromium.launch({ args: ["--no-sandbox"] });
}

/** Pagina nuova con la raccolta degli errori console/pageerror già attaccata. */
async function newPage(browser, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push("console: " + m.text());
  });
  page.consoleErrors = consoleErrors;
  return page;
}

async function gotoHome(page, url = DEFAULT_URL) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#screen-home:not([hidden])");
}

/** Apre la schermata decadi e ne seleziona alcune (senza far partire la partita). */
async function openDecadePicker(page, decades = ["'90s", "'10s"]) {
  await page.click("#btn-mode-decade-open");
  await page.waitForSelector("#screen-decades:not([hidden])");
  for (const d of decades) {
    await page.click(`.decade-tile[data-decade="${d}"]`);
  }
}

async function startMode(page, mode) {
  if (mode === "classic") {
    await page.click("#btn-mode-classic");
  } else if (mode === "blind") {
    await page.click("#btn-mode-blind");
  } else {
    await openDecadePicker(page);
    await page.click("#btn-decades-start");
  }
  await page.waitForSelector("#screen-draft:not([hidden])");
}

/**
 * Righe della carta corrente nello stesso ordine con cui il gioco le
 * renderizza (per points_avg desc, o alfabetico per cognome in Blind -
 * vedi renderRound in app.js), con la loro eleggibilità calcolata dalla
 * stessa fonte di verità del gioco (ranksFor, esposta su window essendo
 * una function declaration) invece di re-implementare qui la logica dei
 * ruoli/soglie altezza.
 */
async function rowEligibility(page, isBlind) {
  return page.evaluate((blind) => {
    const ts = currentDraw[roundIndex];
    const pickedIds = new Set(slots.filter((s) => s.pick).map((s) => s.pick.player.player_id));
    const openRanks = new Set(slots.filter((s) => !s.pick).map((s) => s.rank));
    const sorted = blind
      ? [...ts.players].sort((a, b) => a.surname.localeCompare(b.surname))
      : [...ts.players].sort((a, b) => b.points_avg - a.points_avg);
    return sorted.map((p) => {
      const ranks = pickedIds.has(p.player_id) ? [] : ranksFor(p, heightRulesEnabled);
      const hasOpenSlot = ranks.some((r) => openRanks.has(r));
      return { name: `${p.name} ${p.surname}`, disabled: !hasOpenSlot, ranks };
    });
  }, isBlind);
}

/**
 * Clicca la prima riga selezionabile e aspetta che gli slot legali si
 * illuminino. Torna null se non c'è nessuna riga selezionabile (soft lock).
 */
async function selectPlayableRow(page, isBlind) {
  await page.waitForSelector(".player-row", { timeout: 5000 });
  const rows = await rowEligibility(page, isBlind);
  const target = rows.find((r) => !r.disabled);
  if (!target) return null;

  const rowIndex = rows.indexOf(target);
  await page.locator(".player-row").nth(rowIndex).click();
  await page.waitForSelector(".slot-box.legal", { timeout: 3000 });
  const legalShorts = await page.$$eval(".slot-box.legal .lbl-short", (els) =>
    els.map((e) => e.textContent.trim())
  );
  return {
    target,
    rowIndex,
    legalShorts,
    legalRanks: legalShorts.map((s) => SLOT_RANK_BY_SHORT[s]).sort(),
  };
}

/** Piazza nel primo slot legale e aspetta il round successivo (o il risultato). */
async function placeAndAdvance(page, round) {
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

module.exports = {
  chromium,
  SLOT_RANK_BY_SHORT,
  MODES,
  DEFAULT_URL,
  launchBrowser,
  newPage,
  gotoHome,
  openDecadePicker,
  startMode,
  rowEligibility,
  selectPlayableRow,
  placeAndAdvance,
};
