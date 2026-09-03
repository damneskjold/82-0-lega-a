#!/usr/bin/env node
/*
 * Test negativo dello scanner di visual_check.js.
 *
 * Uno scanner che non segnala mai niente sembra identico a uno scanner
 * che funziona e non trova problemi: questo script rompe la pagina
 * apposta, un difetto alla volta, e verifica che il controllo
 * corrispondente scatti davvero. Serve a dare valore al "0 problemi" del
 * check visivo.
 *
 * Uso:
 *   1. avviare un server statico sulla cartella docs/, es.:
 *        python3 -m http.server 8899 --directory docs
 *   2. node tests/visual_check_selftest.js [url]
 */
const { DEFAULT_URL, launchBrowser, newPage, gotoHome } = require("./lib/driver");
const { scanDom, TOUCH_MIN } = require("./visual_check");

const URL = process.argv[2] || DEFAULT_URL;

// ogni caso: un difetto iniettato nella pagina + il tipo di problema che
// lo scanner deve segnalare
const CASES = [
  {
    name: "elemento larghissimo -> overflow orizzontale di pagina",
    expect: "overflow-x-pagina",
    break: () => {
      const d = document.createElement("div");
      d.style.cssText = "width:3000px;height:10px;background:red";
      document.querySelector("#app").appendChild(d);
    },
  },
  {
    name: "testo lungo in un box stretto con overflow nascosto -> testo tagliato",
    expect: "contenuto-tagliato-x",
    break: () => {
      const d = document.createElement("div");
      d.style.cssText = "width:40px;overflow:hidden;white-space:nowrap";
      d.textContent = "un nome di giocatore molto lungo che non ci sta";
      document.querySelector("#app").appendChild(d);
    },
  },
  {
    name: "velo fisso sopra tutto -> elementi interattivi irraggiungibili",
    expect: "coperto-anche-dopo-scroll",
    break: () => {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;inset:0;background:rgba(255,0,0,.5);z-index:9999";
      document.body.appendChild(d);
    },
  },
];

(async () => {
  const browser = await launchBrowser();
  const failures = [];

  for (const c of CASES) {
    const page = await newPage(browser, { width: 375, height: 667 });
    await gotoHome(page, URL);

    // prima: la pagina sana non deve già segnalare quel tipo
    const before = await page.evaluate(scanDom, TOUCH_MIN);
    if (before.problems.some((p) => p.type === c.expect)) {
      failures.push(`[${c.name}] la pagina sana segnalava già "${c.expect}": il caso non prova niente`);
    }

    await page.evaluate(c.break);
    const after = await page.evaluate(scanDom, TOUCH_MIN);
    const found = after.problems.filter((p) => p.type === c.expect);
    if (found.length === 0) {
      failures.push(`[${c.name}] atteso "${c.expect}", lo scanner non l'ha segnalato`);
      console.log(`  FALLITO  ${c.name}`);
    } else {
      console.log(`  ok       ${c.name} -> ${found.length} segnalazioni "${c.expect}"`);
    }

    await page.close();
  }

  await browser.close();
  console.log(`\nCasi: ${CASES.length}, falliti: ${failures.length}`);
  failures.forEach((f) => console.log("  - " + f));
  console.log(failures.length === 0 ? "\nOK" : "\nFALLITO");
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error("Selftest crashato:", e);
  process.exit(1);
});
