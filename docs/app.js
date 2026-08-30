// LBA 30-0 - prototipo frontend
// Nessun backend: tutto gira in-browser leggendo data/dataset.json
// Flusso: 5 squadre mostrate UNA ALLA VOLTA. Per ognuna scegli un giocatore
// e lo assegni a uno slot ancora libero del quintetto. Scelta irrevocabile.

const ROLE_ALIASES = {
  playmaker: ["Playmaker", "Play/Guardia"],
  centro: ["Centro", "Ala/Centro"],
  guardia: ["Guardia", "Play/Guardia", "Guardia/Ala"],
  ala: ["Ala", "Guardia/Ala", "Ala/Centro"],
};

const SLOT_LABELS = { playmaker: "Playmaker", centro: "Centro", wing: "Guardia/Ala" };

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
let slotsOpen = { playmaker: 1, centro: 1, wing: 3 };
let wingTally = { guardia: 0, ala: 0 };
let picks = []; // {teamSeason, player, slotType}

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
        year: season.year,
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
  slotsOpen = { playmaker: 1, centro: 1, wing: 3 };
  wingTally = { guardia: 0, ala: 0 };
  picks = [];
  $("#screen-home").hidden = true;
  $("#screen-result").hidden = true;
  $("#screen-draft").hidden = false;
  renderRound();
}

// Determina a quali slot puo' essere assegnato un giocatore, dato lo stato attuale
function legalSlotsFor(player) {
  const role = player.role;
  const legal = [];
  if (slotsOpen.playmaker > 0 && ROLE_ALIASES.playmaker.includes(role)) legal.push("playmaker");
  if (slotsOpen.centro > 0 && ROLE_ALIASES.centro.includes(role)) legal.push("centro");
  if (slotsOpen.wing > 0 && (ROLE_ALIASES.guardia.includes(role) || ROLE_ALIASES.ala.includes(role))) {
    // se questo e' l'ultimo slot "ala/guardia" rimasto, il quintetto finale deve comunque
    // avere almeno 1 guardia e 1 ala: blocco la scelta se la renderebbe impossibile
    if (slotsOpen.wing === 1) {
      const newGuardia = wingTally.guardia + (ROLE_ALIASES.guardia.includes(role) ? 1 : 0);
      const newAla = wingTally.ala + (ROLE_ALIASES.ala.includes(role) ? 1 : 0);
      if (newGuardia >= 1 && newAla >= 1) legal.push("wing");
    } else {
      legal.push("wing");
    }
  }
  return legal;
}

function assign(player, slotType, teamSeason) {
  slotsOpen[slotType]--;
  if (slotType === "wing") {
    if (ROLE_ALIASES.guardia.includes(player.role)) wingTally.guardia++;
    if (ROLE_ALIASES.ala.includes(player.role)) wingTally.ala++;
  }
  picks.push({ teamSeason, player, slotType });
  roundIndex++;
  if (roundIndex >= 5) {
    showResult();
  } else {
    renderRound();
  }
}

function renderSlotsPanel() {
  const panel = $("#slots-panel");
  const rows = [];
  rows.push(["playmaker", "Playmaker", slotsOpen.playmaker]);
  rows.push(["centro", "Centro", slotsOpen.centro]);
  rows.push(["wing", "Guardia/Ala", slotsOpen.wing]);
  panel.innerHTML =
    `<h3>Slot quintetto</h3>` +
    rows
      .map(([key, label, remaining]) => {
        const cls = remaining === 0 ? "done" : "open";
        const text = key === "wing" ? `${label}: ${remaining} liberi` : `${label}: ${remaining === 0 ? "assegnato" : "libero"}`;
        return `<div class="slot-row ${cls}">${text}</div>`;
      })
      .join("");
}

function renderPicksPanel() {
  const panel = $("#picks-panel");
  if (picks.length === 0) {
    panel.innerHTML = `<h3>Scelte finora</h3><div style="color:var(--muted);font-size:0.82rem;">Nessuna ancora</div>`;
    return;
  }
  panel.innerHTML =
    `<h3>Scelte finora</h3>` +
    picks
      .map(
        (pk) => `<div class="pick-row">
          <div class="team-dot" style="--team-color:${pk.teamSeason.color}"></div>
          <div>
            <div class="pick-slot">${SLOT_LABELS[pk.slotType]}</div>
            <div class="pick-name">${pk.player.name} ${pk.player.surname}</div>
          </div>
        </div>`
      )
      .join("");
}

function renderRound() {
  renderSlotsPanel();
  renderPicksPanel();
  $("#round-progress").textContent = `Squadra ${roundIndex + 1} di 5`;

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
    <div class="player-list" id="round-player-list"></div>
  `;

  const list = $("#round-player-list");
  sortedPlayers.forEach((p) => {
    const legal = legalSlotsFor(p);
    const row = document.createElement("div");
    row.className = "player-row" + (legal.length === 0 ? " disabled" : "");
    row.innerHTML = `
      <div>
        <div class="player-name">${p.name} ${p.surname}</div>
        <div class="player-role">${p.role}</div>
      </div>
      <div class="player-stats">${p.points_avg.toFixed(1)}p ${(p.off_rebound_avg + p.def_rebound_avg).toFixed(1)}r ${p.assists_avg.toFixed(1)}a</div>
    `;
    if (legal.length > 0) {
      row.addEventListener("click", () => onPlayerClick(p, legal, ts, row));
    }
    list.appendChild(row);
  });
}

function onPlayerClick(player, legalSlots, teamSeason, rowEl) {
  // rimuovi eventuali chooser gia' aperti su altre righe
  document.querySelectorAll(".assign-chooser").forEach((el) => el.remove());

  if (legalSlots.length === 1) {
    assign(player, legalSlots[0], teamSeason);
    return;
  }
  // ambiguo (es. Play/Guardia con sia Playmaker che Guardia/Ala ancora liberi): chiedi conferma
  const chooser = document.createElement("div");
  chooser.className = "assign-chooser";
  chooser.innerHTML =
    legalSlots.map((s) => `<button data-slot="${s}">Usa come ${SLOT_LABELS[s]}</button>`).join("") +
    `<button class="cancel">Annulla</button>`;
  chooser.querySelectorAll("button[data-slot]").forEach((btn) => {
    btn.addEventListener("click", () => assign(player, btn.dataset.slot, teamSeason));
  });
  chooser.querySelector(".cancel").addEventListener("click", () => chooser.remove());
  rowEl.insertAdjacentElement("afterend", chooser);
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

function showResult() {
  const chosen = picks.map((pk) => pk.player);
  const result = evaluateLineup(chosen);

  $("#screen-draft").hidden = true;
  $("#screen-result").hidden = false;

  const wins = result.winsFinal;
  const losses = 30 - wins;
  $("#result-record").textContent = `${wins}-${losses}`;
  $("#result-sub").textContent = `Rating squadra: ${result.teamRating.toFixed(1)}`;

  const orderedPicks = [...picks].sort((a, b) => SLOT_DISPLAY_ORDER[a.slotType] - SLOT_DISPLAY_ORDER[b.slotType]);
  const lineupEl = $("#result-lineup");
  lineupEl.innerHTML = orderedPicks
    .map((pk) => {
      const roleLabel = pk.slotType === "wing" ? pk.player.role : SLOT_LABELS[pk.slotType];
      return `<div class="lineup-row">
        <div class="team-dot" style="--team-color:${pk.teamSeason.color}"></div>
        <div class="role-tag">${roleLabel}</div>
        <div class="who">${pk.player.name} ${pk.player.surname}</div>
        <div class="from">${pk.teamSeason.teamNameAtTime} ${pk.teamSeason.year}</div>
      </div>`;
    })
    .join("");

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

window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  $("#btn-start").addEventListener("click", startDraft);
  $("#btn-again").addEventListener("click", resetToHome);
});
