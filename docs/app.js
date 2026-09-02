// LBA 30-0 - prototipo frontend
// Nessun backend: tutto gira in-browser leggendo data/dataset.json
// Flusso: 5 squadre mostrate UNA ALLA VOLTA. Per ognuna scegli un giocatore
// dalla lista, poi lo assegni cliccando uno dei 5 slot del quintetto (solo
// quelli in cui può giocare sono cliccabili). Scelta irrevocabile.

// posizione numerica (1=playmaker ... 5=centro): ogni ruolo dei dati copre uno o
// due rank adiacenti. Un giocatore puo' scivolare al massimo di una posizione
// (es. Guardia/Ala copre Guardia e Ala Piccola, ma mai Centro o Playmaker).
// "Ala" pura copre sia Ala Piccola che Ala Grande perche' i dati di legabasket
// non distinguono le due (nessuna stima da altezza fatta per questo, solo per i
// ruoli mancanti come gia' documentato).
const ROLE_RANKS = {
  "Playmaker": [1],
  "Play/Guardia": [1, 2],
  "Guardia": [2],
  "Guardia/Ala": [2, 3],
  "Ala": [3, 4],
  "Ala/Centro": [4, 5],
  "Centro": [5],
};

// i 5 slot del quintetto, ciascuno con la propria posizione (rank) specifica
const SLOT_DEFS = [
  { id: "playmaker", type: "playmaker", label: "Playmaker", short: "PM", rank: 1 },
  { id: "wing1", type: "wing", label: "Guardia", short: "G", rank: 2 },
  { id: "wing2", type: "wing", label: "Ala Piccola", short: "AP", rank: 3 },
  { id: "wing3", type: "wing", label: "Ala Grande", short: "AG", rank: 4 },
  { id: "centro", type: "centro", label: "Centro", short: "C", rank: 5 },
];

// colore identificativo per squadra (approssimativo, solo per riconoscibilità visiva)
const TEAM_COLORS = {
  virtus_bologna: "#c1121f",
  olimpia_milano: "#e2001a",
  canturina: "#2a9d34",
  treviso: "#52b788",
  varese: "#c1121f",
  siena: "#3d5a80",
  venezia: "#f77f00",
  trieste: "#7209b7",
  brescia: "#0466c8",
  pesaro: "#003566",
  roma: "#9d4edd",
  reggio_emilia: "#8d0801",
  fortitudo_bologna: "#118ab2",
  napoli: "#00a8e8",
  pistoia: "#ffb703",
  sassari: "#2b2d42",
  trento: "#06a77d",
  avellino: "#588157",
  reggio_calabria: "#6a4c93",
  cremona: "#264653",
  brindisi: "#2d6a4f",
  livorno: "#457b9d",
  udine: "#1d3557",
  caserta: "#14213d",
};

// Formula tarata a mano sugli esempi discussi con l'utente
const MID = 44.7;
const K = 0.04925;
const REF_TEAM = { points: 43.33, rebounds: 4.87 + 11.94, assists: 6.54, steals: 5.43, blocks: 1.14 };
const PEN_THRESH = 0.5;
const PEN_SCALE = 15;

let ALL_TEAM_SEASONS = [];
let currentDraw = []; // 5 team-season objects, in ordine di rivelazione
let roundIndex = 0;
let slots = []; // 5 slot: { id, type, rank, pick: null | {player, teamSeason} }
let selected = null; // giocatore selezionato in attesa di uno slot: { player, teamSeason, legalIds }

const $ = (sel) => document.querySelector(sel);

async function loadData() {
  const res = await fetch("data/dataset.json");
  const data = await res.json();
  const flat = [];
  for (const team of data.teams) {
    for (const season of team.seasons) {
      if (!season.lineup_complete) continue;
      flat.push({
        teamKey: team.key,
        displayName: team.display_name,
        year: season.year ?? season.decade,
        teamNameAtTime: season.team_name_at_time,
        color: TEAM_COLORS[team.key] || "#d97706",
        players: season.players.filter((p) => p.eligible),
      });
    }
  }
  ALL_TEAM_SEASONS = flat;
}

function drawFive() {
  // pesca 5 squadre-stagione distinte, evitando (quando possibile) di ripetere la stessa squadra due volte
  const shuffled = [...ALL_TEAM_SEASONS].sort(() => Math.random() - 0.5);
  const five = [];
  const usedKeys = new Set();

  // TEMP: forza Olimpia e Bologna nel draw per prova utente, rimuovere dopo il test
  for (const forcedKey of ["olimpia_milano", "virtus_bologna"]) {
    const options = shuffled.filter((ts) => ts.teamKey === forcedKey);
    if (options.length > 0) {
      const forced = options[Math.floor(Math.random() * options.length)];
      five.push(forced);
      usedKeys.add(forced.teamKey);
    }
  }

  for (const ts of shuffled) {
    if (five.length >= 5) break;
    if (usedKeys.has(ts.teamKey)) continue;
    five.push(ts);
    usedKeys.add(ts.teamKey);
  }
  // se non bastano squadre diverse (non dovrebbe succedere con 11 squadre), completa senza il vincolo
  if (five.length < 5) {
    for (const ts of shuffled) {
      if (five.length >= 5) break;
      if (!five.includes(ts)) five.push(ts);
    }
  }
  return five;
}

function startDraft() {
  currentDraw = drawFive();
  roundIndex = 0;
  slots = SLOT_DEFS.map((d) => ({ ...d, pick: null }));
  selected = null;
  $("#screen-home").hidden = true;
  $("#screen-result").hidden = true;
  $("#screen-draft").hidden = false;
  renderRound();
}

// Determina in quali slot (per id) puo' essere messo un giocatore, dato lo stato attuale.
// Ogni slot ha un rank fisso (1=playmaker...5=centro); il ruolo del giocatore copre uno o
// due rank adiacenti (ROLE_RANKS) - legale solo se il rank dello slot e' tra quelli coperti.
function legalSlotIdsFor(player) {
  const ranks = ROLE_RANKS[player.role] || [];
  const legal = [];
  for (const s of slots) {
    if (s.pick) continue;
    if (ranks.includes(s.rank)) legal.push(s.id);
  }
  return legal;
}

function assignSelectedTo(slotId) {
  if (!selected || !selected.legalIds.includes(slotId)) return;
  const slot = slots.find((s) => s.id === slotId);
  slot.pick = { player: selected.player, teamSeason: selected.teamSeason };
  selected = null;
  roundIndex++;
  if (roundIndex >= 5) {
    showResult();
  } else {
    renderRound();
  }
}

function renderSlotsPanel() {
  const panel = $("#slots-panel");
  panel.innerHTML =
    `<h3>Quintetto</h3>` +
    slots
      .map((s) => {
        const labelHtml = `<span class="lbl-full">${s.label}</span><span class="lbl-short">${s.short}</span>`;
        if (s.pick) {
          return `<div class="slot-box filled" style="--team-color:${s.pick.teamSeason.color}">
            <div class="slot-label">${labelHtml}</div>
            <div class="slot-player">${s.pick.player.name} ${s.pick.player.surname}</div>
          </div>`;
        }
        let cls = "slot-box empty";
        let clickable = false;
        if (selected) {
          if (selected.legalIds.includes(s.id)) {
            cls += " legal";
            clickable = true;
          } else {
            cls += " illegal";
          }
        }
        return `<div class="${cls}" data-slot-id="${s.id}">
          <div class="slot-label">${labelHtml}</div>
          <div class="slot-status">${clickable ? "Metti qui" : "Libero"}</div>
        </div>`;
      })
      .join("");

  panel.querySelectorAll(".slot-box.legal").forEach((el) => {
    el.addEventListener("click", () => assignSelectedTo(el.dataset.slotId));
  });
}

function renderRound() {
  renderSlotsPanel();
  $("#round-progress").textContent = `Squadra ${roundIndex + 1} di 5${selected ? " · scegli dove giocherà " + selected.player.name + " " + selected.player.surname : ""}`;

  const ts = currentDraw[roundIndex];
  const card = $("#round-card");
  card.style.setProperty("--team-color", ts.color);

  const sortedPlayers = [...ts.players].sort((a, b) => b.points_avg - a.points_avg);

  card.innerHTML = `
    <div class="team-card-head">
      <div class="team-dot" style="--team-color:${ts.color}"></div>
      <div>
        <div class="team-card-name">${ts.displayName}</div>
        <div class="team-card-year">${ts.teamNameAtTime} · ${ts.year}</div>
      </div>
    </div>
    <div class="player-list-header">
      <div></div>
      <div class="player-stats-header">
        <div class="stat-col">P</div>
        <div class="stat-col">R</div>
        <div class="stat-col">A</div>
      </div>
    </div>
    <div class="player-list" id="round-player-list"></div>
  `;

  // un giocatore puo' comparire nelle rose di squadre diverse (es. chi ha
  // cambiato squadra): una volta scelto non e' piu' selezionabile altrove
  const pickedIds = new Set(slots.filter((s) => s.pick).map((s) => s.pick.player.player_id));

  const list = $("#round-player-list");
  sortedPlayers.forEach((p) => {
    const alreadyPicked = pickedIds.has(p.player_id);
    const legalIds = alreadyPicked ? [] : legalSlotIdsFor(p);
    const isSelected = !!(selected && selected.player === p);
    const row = document.createElement("div");
    row.className = "player-row" + (legalIds.length === 0 ? " disabled" : "") + (isSelected ? " selected" : "");
    const reb = Number(p.off_rebound_avg || 0) + Number(p.def_rebound_avg || 0);
    row.innerHTML = `
      <div>
        <div class="player-name">${p.name} ${p.surname}</div>
        <div class="player-role">${alreadyPicked ? "Già nel tuo quintetto" : p.role}</div>
      </div>
      <div class="player-stats">
        <div class="stat-col">${p.points_avg.toFixed(1)}</div>
        <div class="stat-col">${reb.toFixed(1)}</div>
        <div class="stat-col">${p.assists_avg.toFixed(1)}</div>
      </div>
    `;
    if (legalIds.length > 0) {
      row.addEventListener("click", () => {
        selected = isSelected ? null : { player: p, teamSeason: ts, legalIds };
        renderRound();
      });
    }
    list.appendChild(row);
  });
}

function evaluateLineup(chosen) {
  const teamRating = chosen.reduce((sum, p) => sum + Number(p.rating_lega || 0), 0);
  const winsRaw = 30 / (1 + Math.exp(-K * (teamRating - MID)));

  const cats = {
    points: chosen.reduce((s, p) => s + Number(p.points_avg || 0), 0),
    rebounds: chosen.reduce((s, p) => s + Number(p.off_rebound_avg || 0) + Number(p.def_rebound_avg || 0), 0),
    assists: chosen.reduce((s, p) => s + Number(p.assists_avg || 0), 0),
    steals: chosen.reduce((s, p) => s + Number(p.steals_avg || 0), 0),
    blocks: chosen.reduce((s, p) => s + Number(p.blocks_avg || 0), 0),
  };
  const ratios = {};
  for (const k of Object.keys(cats)) ratios[k] = cats[k] / REF_TEAM[k];
  let weakCat = null;
  let weakRatio = Infinity;
  for (const k of Object.keys(ratios)) {
    if (ratios[k] < weakRatio) { weakRatio = ratios[k]; weakCat = k; }
  }
  const penalty = Math.max(0, PEN_THRESH - weakRatio) * PEN_SCALE;
  const winsFinal = Math.max(0, Math.min(30, Math.round(winsRaw - penalty)));

  return { teamRating, winsRaw, cats, ratios, weakCat, weakRatio, penalty, winsFinal };
}

const CAT_LABELS = { points: "Punti", rebounds: "Rimbalzi", assists: "Assist", steals: "Recuperate", blocks: "Stoppate" };

// livello qualitativo della squadra, in stile "voto + nome tier" (vedi 82-0)
const TIERS = [
  { min: 27, letter: "S", label: "Corazzata", color: "#f59e0b" },
  { min: 23, letter: "A", label: "Pretendente scudetto", color: "#4ade80" },
  { min: 18, letter: "B", label: "Squadra da playoff", color: "#60a5fa" },
  { min: 13, letter: "C", label: "Salvezza tranquilla", color: "#a78bfa" },
  { min: 8, letter: "D", label: "Zona playout", color: "#fb923c" },
  { min: 0, letter: "E", label: "Ultima in classifica", color: "#f87171" },
];
function tierFor(wins) {
  return TIERS.find((t) => wins >= t.min) || TIERS[TIERS.length - 1];
}

function initialsFor(player) {
  const a = (player.name || "?")[0] || "?";
  const b = (player.surname || "?")[0] || "?";
  return (a + b).toUpperCase();
}

let lastShareText = "";
let lastShareData = null;

function showResult() {
  const orderedSlots = [...slots].sort((a, b) => a.rank - b.rank); // ordine quintetto base: PM, G, AP, AG, C
  const chosen = orderedSlots.map((s) => s.pick.player);
  const result = evaluateLineup(chosen);

  $("#screen-draft").hidden = true;
  $("#screen-result").hidden = false;

  const wins = result.winsFinal;
  const losses = 30 - wins;
  $("#result-record").textContent = `${wins}-${losses}`;

  const tier = tierFor(wins);
  $("#result-tier").innerHTML =
    `<span class="tier-badge" style="--tier-color:${tier.color}">${tier.letter}</span> ${tier.label} · Rating ${result.teamRating.toFixed(1)}`;

  const lineupEl = $("#result-lineup");
  lineupEl.innerHTML = orderedSlots
    .map((s) => {
      const pk = s.pick;
      const p = pk.player;
      const reb = Number(p.off_rebound_avg || 0) + Number(p.def_rebound_avg || 0);
      return `<div class="lineup-row">
        <div class="who-avatar" style="--team-color:${pk.teamSeason.color}">
          <span class="avatar-initials">${initialsFor(p)}</span>
          <span class="avatar-role">${s.short}</span>
        </div>
        <div class="who">
          <div class="who-name">${p.name} ${p.surname}</div>
          <div class="who-from">${pk.teamSeason.teamNameAtTime} · ${pk.teamSeason.year}</div>
        </div>
        <div class="who-stats">
          <div class="stat-col"><span class="stat-val">${p.points_avg.toFixed(1)}</span><span class="stat-lbl">P</span></div>
          <div class="stat-col"><span class="stat-val">${reb.toFixed(1)}</span><span class="stat-lbl">R</span></div>
          <div class="stat-col"><span class="stat-val">${p.assists_avg.toFixed(1)}</span><span class="stat-lbl">A</span></div>
          <div class="stat-col"><span class="stat-val">${p.steals_avg.toFixed(1)}</span><span class="stat-lbl">S</span></div>
          <div class="stat-col"><span class="stat-val">${p.blocks_avg.toFixed(1)}</span><span class="stat-lbl">B</span></div>
        </div>
      </div>`;
    })
    .join("");

  lastShareText =
    `LBA 30-0 — ${wins}-${losses} (${tier.letter}, ${tier.label})\n` +
    orderedSlots
      .map((s) => `${s.short} ${s.pick.player.name} ${s.pick.player.surname} (${s.pick.teamSeason.teamNameAtTime} ${s.pick.teamSeason.year})`)
      .join("\n");

  lastShareData = {
    wins,
    losses,
    tier,
    rating: result.teamRating,
    totals: result.cats,
    players: orderedSlots.map((s) => {
      const p = s.pick.player;
      return {
        initials: initialsFor(p),
        color: s.pick.teamSeason.color,
        role: s.short,
        name: `${p.name} ${p.surname}`,
        team: `${s.pick.teamSeason.teamNameAtTime} · ${s.pick.teamSeason.year}`,
        points: Number(p.points_avg || 0),
        reb: Number(p.off_rebound_avg || 0) + Number(p.def_rebound_avg || 0),
        ast: Number(p.assists_avg || 0),
        stl: Number(p.steals_avg || 0),
        blk: Number(p.blocks_avg || 0),
      };
    }),
  };

  const breakdownEl = $("#result-breakdown");
  breakdownEl.innerHTML = Object.keys(result.cats)
    .map((k) => {
      const weak = k === result.weakCat && result.ratios[k] < PEN_THRESH;
      return `<div class="stat-box ${weak ? "weak" : ""}">
        <div class="val">${result.cats[k].toFixed(1)}</div>
        <div class="label">${CAT_LABELS[k]}</div>
      </div>`;
    })
    .join("");

  const noteEl = $("#result-note");
  if (result.penalty > 0.05) {
    noteEl.textContent = `Squadra sbilanciata: ${CAT_LABELS[result.weakCat]} troppo bassi (${Math.round(result.ratios[result.weakCat] * 100)}% della media di lega) → -${result.penalty.toFixed(1)} vittorie stimate`;
  } else {
    noteEl.textContent = "";
  }
}

function resetToHome() {
  $("#screen-result").hidden = true;
  $("#screen-draft").hidden = true;
  $("#screen-home").hidden = false;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

// disegna la card risultato su un <canvas> per la condivisione come immagine
function renderShareCard(data) {
  const CARD_W = 900;
  const ROW_H = 130;
  const LIST_PAD = 24;
  const HERO_H = 230;
  const TOTALS_H = 90;
  const listH = data.players.length * ROW_H + LIST_PAD * 2;
  const CARD_H = 210 + HERO_H + 24 + listH + 20 + TOTALS_H + 60;

  const C = {
    bg: "#0f141b", panel: "#171e28", border: "#2a3444",
    text: "#e7ecf2", muted: "#8a96a8", accent: "#d97706",
  };
  const FONT = "-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = CARD_W * scale;
  canvas.height = CARD_H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  let y = 30;
  ctx.textAlign = "center";
  ctx.font = `800 42px ${FONT}`;
  const w1 = ctx.measureText("LBA ").width;
  const w2 = ctx.measureText("30-0").width;
  ctx.textAlign = "left";
  ctx.fillStyle = C.text;
  ctx.fillText("LBA ", CARD_W / 2 - (w1 + w2) / 2, y + 42);
  ctx.fillStyle = C.accent;
  ctx.fillText("30-0", CARD_W / 2 - (w1 + w2) / 2 + w1, y + 42);
  y += 70;

  ctx.textAlign = "center";
  ctx.fillStyle = C.muted;
  ctx.font = `400 20px ${FONT}`;
  ctx.fillText("Il quintetto perfetto della storia della Serie A", CARD_W / 2, y);
  y += 40;

  const heroY = y;
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 2;
  roundRectPath(ctx, 30, heroY, CARD_W - 60, HERO_H, 16);
  ctx.stroke();

  let hy = heroY + 50;
  ctx.fillStyle = C.muted;
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText("RECORD PROIETTATO", CARD_W / 2, hy);
  hy += 80;
  ctx.fillStyle = C.text;
  ctx.font = `800 90px ${FONT}`;
  ctx.fillText(`${data.wins}-${data.losses}`, CARD_W / 2, hy);
  hy += 45;
  {
    const badgeSize = 26;
    const gap = 8;
    const labelText = `${data.tier.label} · Rating ${data.rating.toFixed(1)}`;
    ctx.font = `600 20px ${FONT}`;
    const labelWidth = ctx.measureText(labelText).width;
    const tx = CARD_W / 2 - (badgeSize + gap + labelWidth) / 2;

    ctx.fillStyle = data.tier.color;
    roundRectPath(ctx, tx, hy - badgeSize + 5, badgeSize, badgeSize, 6);
    ctx.fill();
    ctx.fillStyle = "#0b0f14";
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(data.tier.letter, tx + badgeSize / 2, hy - 5);

    ctx.textAlign = "left";
    ctx.fillStyle = C.muted;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(labelText, tx + badgeSize + gap, hy);
  }

  y = heroY + HERO_H + 24;

  const listY = y;
  ctx.fillStyle = C.panel;
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  roundRectPath(ctx, 30, listY, CARD_W - 60, listH, 14);
  ctx.fill();
  ctx.stroke();

  let ry = listY + LIST_PAD;
  data.players.forEach((p, i) => {
    const rowY = ry;
    ctx.fillStyle = p.color || C.accent;
    roundRectPath(ctx, 54, rowY + 14, 70, 70, 10);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(p.initials, 54 + 35, rowY + 14 + 44);

    ctx.fillStyle = C.bg;
    ctx.strokeStyle = C.border;
    roundRectPath(ctx, 54 + 12, rowY + 14 + 58, 46, 20, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.accent;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(p.role, 54 + 35, rowY + 14 + 72);

    ctx.textAlign = "left";
    ctx.fillStyle = C.text;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(truncateToWidth(ctx, p.name, 250), 150, rowY + 44);
    ctx.fillStyle = C.muted;
    ctx.font = `400 17px ${FONT}`;
    ctx.fillText(truncateToWidth(ctx, p.team, 250), 150, rowY + 70);

    const stats = [["P", p.points], ["R", p.reb], ["A", p.ast], ["S", p.stl], ["B", p.blk]];
    const statsRight = CARD_W - 54;
    const colW = 62;
    stats.forEach((s, si) => {
      const cx = statsRight - (stats.length - 1 - si) * colW;
      ctx.textAlign = "center";
      ctx.fillStyle = C.text;
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText(s[1].toFixed(1), cx, rowY + 38);
      ctx.fillStyle = C.muted;
      ctx.font = `700 12px ${FONT}`;
      ctx.fillText(s[0], cx, rowY + 58);
    });

    if (i < data.players.length - 1) {
      ctx.strokeStyle = C.border;
      ctx.beginPath();
      ctx.moveTo(54, rowY + ROW_H - 8);
      ctx.lineTo(CARD_W - 54, rowY + ROW_H - 8);
      ctx.stroke();
    }
    ry += ROW_H;
  });

  y = listY + listH + 20;

  ctx.textAlign = "center";
  const totalCols = [
    ["points", "PUNTI"], ["rebounds", "RIMBALZI"], ["assists", "ASSIST"], ["steals", "RECUPERATE"], ["blocks", "STOPPATE"],
  ];
  const colW2 = (CARD_W - 60) / totalCols.length;
  totalCols.forEach(([k, lbl], i) => {
    const cx = 30 + colW2 * i + colW2 / 2;
    ctx.fillStyle = C.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(data.totals[k].toFixed(1), cx, y + 30);
    ctx.fillStyle = C.muted;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(lbl, cx, y + 52);
  });
  y += TOTALS_H;

  ctx.fillStyle = C.muted;
  ctx.font = `400 15px ${FONT}`;
  ctx.fillText("Costruisci il tuo quintetto su LBA 30-0", CARD_W / 2, y + 20);

  return canvas;
}

async function shareResult() {
  let blob = null;
  if (lastShareData) {
    try {
      const canvas = renderShareCard(lastShareData);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    } catch (e) {
      blob = null; // se il canvas fallisce per qualche motivo, si scende ai fallback testuali sotto
    }
  }

  if (blob) {
    const file = new File([blob], "lba-30-0.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "LBA 30-0", text: lastShareText });
        return;
      } catch (e) {
        return; // utente ha annullato la condivisione nativa
      }
    }
    // niente condivisione file supportata: scarica l'immagine
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lba-30-0.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: "LBA 30-0", text: lastShareText });
      return;
    } catch (e) {
      return; // utente ha annullato la condivisione nativa
    }
  }
  try {
    await navigator.clipboard.writeText(lastShareText);
    alert("Quintetto copiato negli appunti!");
  } catch (e) {
    alert(lastShareText);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  $("#btn-start").addEventListener("click", startDraft);
  $("#btn-again").addEventListener("click", resetToHome);
  $("#btn-share").addEventListener("click", shareResult);
});
