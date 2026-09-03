#!/usr/bin/env node
/*
 * Check visivo sistematico (backlog 1.1) per docs/index.html + app.js.
 *
 * Durante lo sviluppo i glitch grafici sono sempre stati trovati a mano,
 * di rimbalzo (uno screenshot dell'utente, poi uno script usa-e-getta in
 * /tmp che misurava l'elemento già sospetto). Questo script generalizza
 * quelle misure in uno scanner del DOM che gira su OGNI elemento
 * visibile, in una matrice di schermate x viewport x modalità, così i
 * problemi si trovano prima che li trovi l'utente.
 *
 * Cosa cerca (nessun confronto pixel con screenshot di riferimento: per
 * un progetto hobby sarebbe più manutenzione che valore):
 *   1. la pagina scrolla in orizzontale
 *   2. elementi che sbordano dai bordi laterali del viewport
 *   3. contenuto tagliato in orizzontale dove l'overflow è nascosto
 *      (il bug della colonna statistiche tagliata su schermi stretti)
 *   4. contenuto tagliato in verticale dove l'overflow è nascosto
 *   5. elementi interattivi coperti da qualcos'altro (il bug dell'ultima
 *      riga nascosta dietro il pannello quintetto fisso)
 *   6. bersagli tocco più piccoli di 36px su viewport mobile (informativo)
 *
 * Salva anche uno screenshot per ogni combinazione, fuori dal repo, per
 * una scorsa a occhio.
 *
 * Uso:
 *   1. avviare un server statico sulla cartella docs/, es.:
 *        python3 -m http.server 8899 --directory docs
 *   2. node tests/visual_check.js [url] [--out=CARTELLA]
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  DEFAULT_URL,
  launchBrowser,
  newPage,
  gotoHome,
  openDecadePicker,
  startMode,
  selectPlayableRow,
  placeAndAdvance,
} = require("./lib/driver");

const args = process.argv.slice(2);
const URL = args.find((a) => !a.startsWith("--")) || DEFAULT_URL;
const OUT_DIR =
  (args.find((a) => a.startsWith("--out=")) || "").slice("--out=".length) ||
  path.join(os.tmpdir(), "lba-visual-check");

// viewport rappresentativi, non tutte le combinazioni possibili: i due
// più stretti sono quelli dove sono usciti tutti i glitch finora
const VIEWPORTS = [
  { width: 320, height: 568, label: "320x568 (iPhone SE 1a gen, il più stretto)" },
  { width: 375, height: 667, label: "375x667 (iPhone SE 2a gen / 8)" },
  { width: 390, height: 844, label: "390x844 (iPhone 12-15)" },
  { width: 768, height: 1024, label: "768x1024 (tablet verticale)" },
  { width: 1280, height: 900, label: "1280x900 (desktop)" },
  { width: 1440, height: 900, label: "1440x900 (desktop largo)" },
];

const TOUCH_MIN = 36;

/**
 * Scanner iniettato nella pagina: gira su ogni elemento visibile dentro
 * #app. Deve essere autonomo (viene serializzato da Playwright).
 */
function scanDom(touchMin) {
  const problems = [];
  const touchTargets = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const TOL = 1;

  const describe = (el) => {
    if (!el) return "(nulla)";
    const id = el.id ? "#" + el.id : "";
    const cls =
      typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return el.tagName.toLowerCase() + id + cls + (txt ? ` "${txt}"` : "");
  };

  const visible = (el) => {
    if (el.closest("[hidden]")) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // 1. la pagina scrolla in orizzontale: su mobile è sempre un bug
  if (doc.scrollWidth > doc.clientWidth + TOL) {
    problems.push({
      type: "overflow-x-pagina",
      el: "(documento)",
      detail: `scrollWidth=${doc.scrollWidth} > clientWidth=${doc.clientWidth}`,
    });
  }

  const els = Array.from(document.querySelectorAll("#app *")).filter(visible);

  for (const el of els) {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);

    // 2. sborda dai bordi laterali del viewport
    if (r.right > vw + TOL) {
      problems.push({
        type: "oltre-bordo-destro",
        el: describe(el),
        detail: `right=${Math.round(r.right)} vs viewport=${vw}`,
      });
    }
    if (r.left < -TOL) {
      problems.push({ type: "oltre-bordo-sinistro", el: describe(el), detail: `left=${Math.round(r.left)}` });
    }

    // 3. contenuto tagliato in orizzontale dove l'overflow è nascosto:
    //    il testo sparisce e non c'è modo di scrollare per vederlo
    const clipX = st.overflowX === "hidden" || st.overflowX === "clip";
    if (clipX && el.scrollWidth > el.clientWidth + TOL) {
      problems.push({
        type: "contenuto-tagliato-x",
        el: describe(el),
        detail: `scrollWidth=${el.scrollWidth} > clientWidth=${el.clientWidth}`,
      });
    }

    // 4. stessa cosa in verticale
    const clipY = st.overflowY === "hidden" || st.overflowY === "clip";
    if (clipY && el.scrollHeight > el.clientHeight + TOL) {
      problems.push({
        type: "contenuto-tagliato-y",
        el: describe(el),
        detail: `scrollHeight=${el.scrollHeight} > clientHeight=${el.clientHeight}`,
      });
    }
  }

  // 5. elementi interattivi IRRAGGIUNGIBILI: si porta ognuno al centro
  //    (scrollIntoView) e si controlla se lì è ancora coperto da
  //    qualcos'altro. È la differenza fra "adesso sta sotto il pannello
  //    fisso ma basta scrollare" (normale) e "non c'è scroll che tenga,
  //    resta sotto" (il bug dell'ultima riga nascosta dietro il pannello
  //    quintetto). elementFromPoint tiene già conto di pointer-events,
  //    quindi un velo non cliccabile sopra non viene segnalato.
  const interactiveSel = "button, .player-row, .slot-box, .mode-tile, .decade-tile, [role=button]";
  const interactive = Array.from(document.querySelectorAll(interactiveSel)).filter(visible);
  const scrollState = new Map();
  for (const el of document.querySelectorAll("#app *")) scrollState.set(el, el.scrollTop);
  const pageScroll = window.scrollY;

  for (const el of interactive) {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > vw || cy > vh) {
      problems.push({
        type: "non-portabile-nel-viewport",
        el: describe(el),
        detail: `centro a ${Math.round(cx)},${Math.round(cy)} fuori da ${vw}x${vh} anche dopo scrollIntoView`,
      });
      continue;
    }
    const top = document.elementFromPoint(cx, cy);
    if (top && !el.contains(top) && !top.contains(el)) {
      problems.push({
        type: "coperto-anche-dopo-scroll",
        el: describe(el),
        detail: `coperto da ${describe(top)}`,
      });
    }
  }

  // ripristina lo scroll com'era, così lo screenshot dopo lo scan
  // rispecchia lo stato che si voleva fotografare
  for (const [el, top] of scrollState) el.scrollTop = top;
  window.scrollTo(0, pageScroll);

  // 6. contrasto reale a schermo dove il colore squadra fa da sfondo:
  //    il controllo sui colori in checkShareCard() verifica che inkFor()
  //    calcoli il valore giusto, questo verifica che arrivi davvero fino
  //    al pixel (se il collegamento della variabile CSS si rompe, lì non
  //    si vedrebbe)
  const parseRgb = (s) => {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  };
  const lum = (rgb) => {
    const ch = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  // il colore squadra a volte è impostato via style inline su un elemento
  // (es. --team-color) ma applicato da CSS a un discendente (es. l'icona
  // quadrata dentro uno slot pieno): bisogna guardare anche i figli, non
  // solo l'elemento che porta l'attributo style. Ma la variabile CSS si
  // eredita su TUTTI i discendenti anche quando nessuno la usa davvero
  // (es. i bottoni del filtro ruolo dentro la card della squadra, che non
  // c'entrano nulla col colore squadra): per non segnalare falsi positivi,
  // teniamo solo i discendenti il cui sfondo/colore effettivo corrisponde
  // proprio al valore risolto di --team-color/--team-ink su quell'elemento.
  const resolveProbe = document.createElement("div");
  resolveProbe.style.cssText = "position:absolute;top:-9999px;left:-9999px";
  document.body.appendChild(resolveProbe);
  const resolveVar = (el, name) => {
    const raw = getComputedStyle(el).getPropertyValue(name).trim();
    if (!raw) return null;
    resolveProbe.style.color = "";
    resolveProbe.style.color = raw;
    return getComputedStyle(resolveProbe).color;
  };
  const teamColorCandidates = new Set();
  for (const root of document.querySelectorAll('[style*="--team-color"]')) {
    teamColorCandidates.add(root);
    for (const desc of root.querySelectorAll("*")) teamColorCandidates.add(desc);
  }
  for (const el of Array.from(teamColorCandidates).filter(visible)) {
    const st = getComputedStyle(el);
    // richiediamo che sia lo SFONDO di questo elemento a essere il colore
    // squadra: un discendente che eredita solo il colore testo (es. lo
    // span delle iniziali dentro .who-avatar, che non ha sfondo proprio,
    // trasparente) non è un consumatore reale della coppia sfondo/testo —
    // quella coppia si controlla già sull'elemento che ha davvero lo
    // sfondo colorato (qui il genitore, il cui textContent include anche
    // il testo dello span figlio)
    if (st.backgroundColor !== resolveVar(el, "--team-color")) continue;
    const fg = parseRgb(st.color);
    const bg = parseRgb(st.backgroundColor);
    if (!fg || !bg || !el.textContent.trim()) continue;
    const lf = lum(fg);
    const lb = lum(bg);
    const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
    if (ratio < 3) {
      problems.push({
        type: "contrasto-basso-a-schermo",
        el: describe(el),
        detail: `testo ${st.color} su ${st.backgroundColor}, contrasto ${ratio.toFixed(2)} < 3.0`,
      });
    }
  }
  resolveProbe.remove();

  // 7. bersagli tocco piccoli (solo mobile, solo informativo)
  if (vw <= 480) {
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (r.height < touchMin || r.width < touchMin) {
        touchTargets.push({ el: describe(el), detail: `${Math.round(r.width)}x${Math.round(r.height)}px` });
      }
    }
  }

  return { problems, touchTargets };
}

async function scrollContainers(page, toEnd) {
  await page.evaluate((end) => {
    const scrollables = Array.from(document.querySelectorAll("#app *")).filter((el) => {
      const oy = getComputedStyle(el).overflowY;
      return (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 4;
    });
    for (const el of scrollables) el.scrollTop = end ? el.scrollHeight : 0;
    window.scrollTo(0, end ? document.body.scrollHeight : 0);
  }, toEnd);
  await page.waitForTimeout(120);
}

async function scan(page, vp, state, findings) {
  const { problems, touchTargets } = await page.evaluate(scanDom, TOUCH_MIN);
  const where = `${vp.width}x${vp.height} / ${state}`;
  for (const p of problems) findings.problems.push({ ...p, where });
  for (const t of touchTargets) findings.touchTargets.push({ ...t, where });

  const file = path.join(OUT_DIR, `${vp.width}x${vp.height}__${state}.png`);
  await page.screenshot({ path: file, fullPage: true });
  findings.shots += 1;
}

async function runViewport(browser, vp, findings) {
  const page = await newPage(browser, { width: vp.width, height: vp.height });
  await gotoHome(page, URL);
  await scan(page, vp, "home", findings);

  // schermata decadi, con 2 decadi selezionate (stato .selected)
  await openDecadePicker(page);
  await scan(page, vp, "decadi", findings);
  await page.click("#btn-decades-back");
  await page.waitForSelector("#screen-home:not([hidden])");

  // classic e blind hanno layout diversi nella lista (blind nasconde le
  // statistiche): vanno guardate entrambe. La modalità decade produce la
  // stessa schermata draft di classic, cambia solo il pool.
  for (const mode of ["classic", "blind"]) {
    await startMode(page, mode);
    await scan(page, vp, `draft-r1-${mode}`, findings);

    // con un giocatore selezionato: slot legali illuminati
    if (!(await selectPlayableRow(page, mode === "blind"))) {
      findings.errors.push(`${vp.width}x${vp.height} [${mode}] round 1: nessuna riga selezionabile`);
      break;
    }
    await scan(page, vp, `draft-r1-selezionato-${mode}`, findings);

    // lista scrollata in fondo: è lì che si nascondevano le ultime righe
    // dietro il pannello quintetto fisso
    await scrollContainers(page, true);
    await scan(page, vp, `draft-r1-scrollato-${mode}`, findings);
    await scrollContainers(page, false);

    await placeAndAdvance(page, 1);

    for (let round = 2; round <= 5; round++) {
      // round 4: 3 slot pieni, il pannello quintetto è nel suo stato più carico
      if (round === 4) await scan(page, vp, `draft-r4-${mode}`, findings);
      if (!(await selectPlayableRow(page, mode === "blind"))) {
        findings.errors.push(`${vp.width}x${vp.height} [${mode}] round ${round}: nessuna riga selezionabile`);
        break;
      }
      await placeAndAdvance(page, round);
    }

    await page.waitForSelector("#screen-result:not([hidden])");
    await scan(page, vp, `risultato-${mode}`, findings);
    await scrollContainers(page, true);
    await scan(page, vp, `risultato-scrollato-${mode}`, findings);
    await scrollContainers(page, false);

    await page.click("#btn-change-mode");
    await page.waitForSelector("#screen-home:not([hidden])");
  }

  // schermata di errore caricamento dati (simulata bloccando il fetch).
  // Gli errori console che ne derivano sono voluti, quindi si scartano:
  // altrimenti il test si segnalerebbe da solo il proprio scenario.
  const errorsBeforeSim = page.consoleErrors.length;
  await page.route("**/data/dataset.json", (route) => route.abort());
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#screen-error:not([hidden])");
  await scan(page, vp, "errore-caricamento", findings);
  await page.unroute("**/data/dataset.json");
  page.consoleErrors.length = errorsBeforeSim;

  findings.consoleErrors.push(...page.consoleErrors.map((e) => `${vp.width}x${vp.height}: ${e}`));
  await page.close();
}

/**
 * Card PNG condivisa + contrasto delle iniziali sui colori squadra.
 *
 * La card è disegnata su <canvas>, quindi lo scanner del DOM non la vede:
 * era il buco più grosso del check visivo, ed è anche l'unica cosa del
 * gioco che finisce sotto gli occhi di altre persone. Il controllo vero e
 * proprio è sul contrasto (calcolabile, quindi non regredisce in
 * silenzio); il PNG viene salvato per una scorsa a occhio, e ne viene
 * generata anche una versione col caso peggiore forzato, invece di
 * sperare che il sorteggio peschi proprio le squadre dai colori chiari.
 */
async function checkShareCard(browser, findings) {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoHome(page, URL);

  // contrasto delle iniziali su ognuno dei 30 colori squadra: sotto 3.0
  // (soglia WCAG per testo grande in grassetto) non si leggono
  const contrasts = await page.evaluate(() =>
    Object.entries(TEAM_COLORS).map(([team, color]) => {
      const ink = inkFor(color);
      return { team, color, ink, ratio: contrastRatio(relLuminance(color), relLuminance(ink)) };
    })
  );
  for (const c of contrasts) {
    if (c.ratio < 3.0) {
      findings.problems.push({
        type: "contrasto-iniziali-illeggibile",
        el: `${c.team} (${c.color})`,
        detail: `inchiostro ${c.ink}, contrasto ${c.ratio.toFixed(2)} < 3.0`,
        where: "card PNG + avatar quintetto",
      });
    }
  }
  const peggiore = contrasts.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
  console.log(
    `  contrasto iniziali: minimo ${peggiore.ratio.toFixed(2)} (${peggiore.team}), su ${contrasts.length} squadre`
  );

  // una partita vera, per avere lastShareData da renderizzare
  await startMode(page, "classic");
  for (let round = 1; round <= 5; round++) {
    if (!(await selectPlayableRow(page, false))) {
      findings.errors.push(`card PNG: nessuna riga selezionabile al round ${round}`);
      await page.close();
      return;
    }
    await placeAndAdvance(page, round);
  }
  await page.waitForSelector("#screen-result:not([hidden])");

  // i 5 colori squadra più chiari: è lì che le iniziali bianche fisse
  // sparivano, quindi la card di controllo li usa tutti insieme
  const cards = await page.evaluate(() => {
    const render = (data) => {
      const c = renderShareCard(data);
      return { w: c.width, h: c.height, url: c.toDataURL("image/png") };
    };
    const normale = render(lastShareData);

    const piuChiari = Object.entries(TEAM_COLORS)
      .map(([team, color]) => ({ team, color, l: relLuminance(color) }))
      .sort((a, b) => b.l - a.l)
      .slice(0, 5);
    const peggiore = render({
      ...lastShareData,
      players: lastShareData.players.map((p, i) => ({ ...p, color: piuChiari[i].color })),
    });
    return { normale, peggiore, colori: piuChiari.map((x) => `${x.team} ${x.color}`) };
  });

  for (const [nome, card] of [["normale", cards.normale], ["colori-piu-chiari", cards.peggiore]]) {
    if (!card.w || !card.h) {
      findings.errors.push(`card PNG (${nome}): canvas di dimensioni ${card.w}x${card.h}`);
      continue;
    }
    const file = path.join(OUT_DIR, `share-card__${nome}.png`);
    fs.writeFileSync(file, Buffer.from(card.url.split(",")[1], "base64"));
    findings.shots += 1;
    console.log(`  card PNG ${nome}: ${card.w}x${card.h} -> ${path.basename(file)}`);
  }
  console.log(`  (caso peggiore forzato con: ${cards.colori.join(", ")})`);

  findings.consoleErrors.push(...page.consoleErrors.map((e) => `card PNG: ${e}`));
  await page.close();
}

function report(findings) {
  console.log(`\nScreenshot salvati: ${findings.shots} in ${OUT_DIR}\n`);

  // raggruppa per tipo + elemento: lo stesso problema su più viewport è
  // una riga sola, con l'elenco dei viewport dove si presenta
  const groups = new Map();
  for (const p of findings.problems) {
    const key = `${p.type} ${p.el} ${p.detail}`;
    if (!groups.has(key)) groups.set(key, { ...p, wheres: [] });
    groups.get(key).wheres.push(p.where);
  }

  console.log(`=== Problemi di layout: ${groups.size} distinti (${findings.problems.length} occorrenze) ===\n`);
  const byType = new Map();
  for (const g of groups.values()) {
    if (!byType.has(g.type)) byType.set(g.type, []);
    byType.get(g.type).push(g);
  }
  for (const [type, list] of byType) {
    console.log(`  ${type} (${list.length}):`);
    for (const g of list.slice(0, 12)) {
      console.log(`    - ${g.el}`);
      console.log(`      ${g.detail}`);
      console.log(`      in: ${g.wheres.slice(0, 4).join("; ")}${g.wheres.length > 4 ? ` (+${g.wheres.length - 4})` : ""}`);
    }
    if (list.length > 12) console.log(`    ... e altri ${list.length - 12}`);
    console.log("");
  }
  if (groups.size === 0) console.log("  nessuno\n");

  const touchGroups = new Map();
  for (const t of findings.touchTargets) {
    const key = `${t.el} ${t.detail}`;
    if (!touchGroups.has(key)) touchGroups.set(key, { ...t, wheres: [] });
    touchGroups.get(key).wheres.push(t.where);
  }
  console.log(`=== Bersagli tocco < ${TOUCH_MIN}px su mobile (informativo): ${touchGroups.size} ===\n`);
  for (const t of [...touchGroups.values()].slice(0, 15)) {
    console.log(`    - ${t.el} → ${t.detail}  (${t.wheres.length} viste)`);
  }
  if (touchGroups.size === 0) console.log("  nessuno");
  if (touchGroups.size > 15) console.log(`    ... e altri ${touchGroups.size - 15}`);

  console.log(`\n=== Errori di guida: ${findings.errors.length} ===`);
  findings.errors.forEach((e) => console.log("  - " + e));
  console.log(`=== Errori console: ${findings.consoleErrors.length} ===`);
  findings.consoleErrors.forEach((e) => console.log("  - " + e));

  const ok = groups.size === 0 && findings.errors.length === 0 && findings.consoleErrors.length === 0;
  console.log(ok ? "\nOK" : "\nCI SONO COSE DA GUARDARE (vedi sopra)");
  return ok;
}

// esportato per poter essere verificato dal test negativo
// (tests/visual_check_selftest.js): uno scanner che non scatta mai non
// vale niente, quindi va provato anche su una pagina rotta apposta
module.exports = { scanDom, TOUCH_MIN };

if (require.main !== module) return;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await launchBrowser();
  const findings = { problems: [], touchTargets: [], errors: [], consoleErrors: [], shots: 0 };

  for (const vp of VIEWPORTS) {
    process.stdout.write(`viewport ${vp.label}... `);
    await runViewport(browser, vp, findings);
    process.stdout.write("fatto\n");
  }

  process.stdout.write("card PNG condivisa + contrasto colori squadra...\n");
  await checkShareCard(browser, findings);

  await browser.close();
  process.exit(report(findings) ? 0 : 1);
})().catch((e) => {
  console.error("Check visivo crashato:", e);
  process.exit(1);
});
