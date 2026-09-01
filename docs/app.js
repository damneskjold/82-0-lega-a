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

  // TEMP: forza Olimpia nel draw per prova utente, rimuovere dopo il test
  const olimpiaOptions = shuffled.filter((ts) => ts.teamKey === "olimpia_milano");
  if (olimpiaOptions.length > 0) {
    const forced = olimpiaOptions[Math.floor(Math.random() * olimpiaOptions.length)];
    five.push(forced);
    usedKeys.add(forced.teamKey);
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

  const list = $("#round-player-list");
  sortedPlayers.forEach((p) => {
    const legalIds = legalSlotIdsFor(p);
    const isSelected = !!(selected && selected.player === p);
    const row = document.createElement("div");
    row.className = "player-row" + (legalIds.length === 0 ? " disabled" : "") + (isSelected ? " selected" : "");
    const reb = Number(p.off_rebound_avg || 0) + Number(p.def_rebound_avg || 0);
    row.innerHTML = `
      <div>
        <div class="player-name">${p.name} ${p.surname}</div>
        <div class="player-role">${p.role}</div>
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
const SLOT_DISPLAY_ORDER = { playmaker: 0, centro: 1, wing: 2 };

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

function showResult() {
  const orderedSlots = [...slots].sort((a, b) => SLOT_DISPLAY_ORDER[a.type] - SLOT_DISPLAY_ORDER[b.type]);
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

async function shareResult() {
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
