// LBA 30-0 - prototipo frontend
// Nessun backend: tutto gira in-browser leggendo data/dataset.json
// Flusso: 5 squadre mostrate UNA ALLA VOLTA. Per ognuna scegli un giocatore
// dalla lista, poi lo assegni cliccando uno dei 5 slot del quintetto (solo
// quelli in cui può giocare sono cliccabili). Scelta irrevocabile.

// posizione numerica (1=playmaker ... 5=centro): ogni ruolo dei dati copre uno o
// due rank adiacenti. Un giocatore puo' scivolare al massimo di una posizione
// (es. Guardia/Ala copre Guardia e Ala Piccola, ma mai Centro o Playmaker).
// "Ala" pura copre sia Ala Piccola che Ala Grande perche' i dati di legabasket
// non distinguono le due. Questi 7 ruoli (4 puri + 3 ibridi) sono il campo
// `role` originale di legabasket, non una nostra stima.
const ROLE_RANKS = {
  "Playmaker": [1],
  "Play/Guardia": [1, 2],
  "Guardia": [2],
  "Guardia/Ala": [2, 3],
  "Ala": [3, 4],
  "Ala/Centro": [4, 5],
  "Centro": [5],
};

// Un giocatore di ruolo PURO (non gia' ibrido) alto abbastanza guadagna
// anche il rank adiacente superiore, come se fosse un ibrido "per quel
// singolo giocatore" (non e' un'opzione: e' cosi' che gira il gioco).
// Soglie scelte insieme sui percentili di altezza reali del dataset, non a
// occhio - vedi README, sezione Ruoli. Solo +1 rank verso l'alto, mai in
// giu', e mai sui ruoli gia' ibridi (evita la complessita' di un giocatore
// a 3 rank tipo "playmaker alto quanto un centro").
// Per estendere un'ala fino al Centro l'altezza da sola non basta: il
// gruppo delle ali sopra i 204cm si e' rivelato un miscuglio di lunghi
// veri e di ali che giocavano sul perimetro, e la regola le spingeva
// tutte verso il centro (Kukoc archiviato come AG/C, Bodiroga pure).
// Serve anche che rimbalzi come un lungo. La soglia e' calibrata sui
// centri puri del dataset, non scelta a occhio: 6.7 rimbalzi/30min e' il
// loro 25esimo percentile, cioe' "almeno quanto un centro vero scarso".
// Per gli altri due salti (play->guardia, guardia->ala) non si applica:
// li' si rivendica un posto piu' grande sul perimetro, e l'altezza e' un
// indizio ragionevole di suo.
const BIG_REBOUNDS_PER_30 = 6.7;
const HEIGHT_RANK_EXTENSION = {
  "Playmaker": { minHeight: 192, extraRank: 2 },
  "Guardia": { minHeight: 196, extraRank: 3 },
  "Ala": { minHeight: 204, extraRank: 5, minRebounds30: BIG_REBOUNDS_PER_30 },
};

// rimbalzi totali per 30 minuti: normalizzati sui minuti, altrimenti si
// premia solo chi giocava tanto invece di chi rimbalzava da lungo
function rebounds30(player) {
  const min = Number(player.minutes_avg) || 0;
  if (min <= 0) return null;
  const reb = (Number(player.off_rebound_avg) || 0) + (Number(player.def_rebound_avg) || 0);
  return (reb / min) * 30;
}

// rank legali per un giocatore: quelli del suo ruolo, piu' l'eventuale rank
// extra per altezza se extendByHeight e' true. Massimo 2 rank adiacenti,
// come ogni altro ruolo/ibrido nel gioco: se la base ne ha gia' 2 (oggi
// solo "Ala", che copre AP+AG), l'estensione SPOSTA la coppia verso
// l'alto invece di allargarla a 3 - un'Ala estesa a Centro "diventa"
// AG/C (perde AP), esattamente come l'ibrido ufficiale Ala/Centro non ha
// mai AP. Playmaker/Guardia (base di 1 solo rank) restano un semplice
// allargamento a 2, gia' cosi'.
function ranksFor(player, extendByHeight) {
  const base = ROLE_RANKS[player.role] || [];
  if (!extendByHeight) return base;
  const ext = HEIGHT_RANK_EXTENSION[player.role];
  if (!ext || !player.height || player.height < ext.minHeight) return base;
  if (base.includes(ext.extraRank)) return base;
  if (ext.minRebounds30 != null) {
    const r30 = rebounds30(player);
    // senza minuti non si puo' verificare: meglio non estendere che
    // regalare il ruolo di centro a un'ala solo perche' e' alta
    if (r30 === null || r30 < ext.minRebounds30) return base;
  }
  const combined = [...base, ext.extraRank].sort((a, b) => a - b);
  return combined.length > 2 ? combined.slice(combined.length - 2) : combined;
}

// i 5 slot del quintetto, ciascuno con la propria posizione (rank) specifica
const SLOT_DEFS = [
  { id: "playmaker", type: "playmaker", label: "Playmaker", short: "PM", rank: 1 },
  { id: "wing1", type: "wing", label: "Guardia", short: "G", rank: 2 },
  { id: "wing2", type: "wing", label: "Ala Piccola", short: "AP", rank: 3 },
  { id: "wing3", type: "wing", label: "Ala Grande", short: "AG", rank: 4 },
  { id: "centro", type: "centro", label: "Centro", short: "C", rank: 5 },
];

// sigle (PM/G/AP/AG/C) di TUTTI i rank per cui il giocatore e' eleggibile
// in questo momento, in ordine crescente, separate da "/" (stesso
// separatore dei tag ibridi ufficiali di legabasket, es. "Ala/Centro") -
// mai il nome/tag completo per esteso. Tiene conto sia dei tag ibridi
// ufficiali sia dell'estensione per altezza: un playmaker anche guardia
// mostra "PM/G", un'ala normale (copre gia' AP e AG di suo) mostra
// "AP/AG", un'ala estesa a centro mostra "AP/AG/C". Un giocatore con un
// solo rank mostra solo quella sigla (es. "G", "PM").
const RANK_SHORT = Object.fromEntries(SLOT_DEFS.map((d) => [d.rank, d.short]));
function roleSiglaFor(player) {
  const ranks = [...ranksFor(player, heightRulesEnabled)].sort((a, b) => a - b);
  return ranks.map((r) => RANK_SHORT[r]).join("/");
}

// filtro ruolo nella lista di pescaggio: Ala Piccola e Ala Grande sono un
// chip solo ("A"), non due - separarle isolava due gruppi che si
// sovrappongono parecchio (il ruolo base "Ala" copre gia' entrambe di suo)
// per un guadagno piccolo rispetto a un chip in piu' (misurato: vedi
// README, sezione filtro ruolo). Un giocatore ibrido puo' comparire sotto
// piu' di un chip, stessa logica di roleSiglaFor.
const ROLE_FILTERS = ["Tutti", "PM", "G", "A", "C"];
const FILTER_BUCKET_BY_RANK = { 1: "PM", 2: "G", 3: "A", 4: "A", 5: "C" };
function matchesRoleFilter(player, filter) {
  if (filter === "Tutti") return true;
  return ranksFor(player, heightRulesEnabled).some((r) => FILTER_BUCKET_BY_RANK[r] === filter);
}

// colore identificativo per squadra: colore sociale storico REALE del club
// (verificato via ricerca web - Wikipedia IT, siti ufficiali, stampa
// sportiva - vedi README "Decisioni prese finora" per la metodologia e le
// fonti), con tonalità variata dentro la stessa famiglia di colore per
// restare distinguibile quando più club condividono lo stesso colore
// sociale (5 bianconero, 7 biancorosso, 9 biancoblu, ecc: un vincolo reale
// del basket italiano, non un errore di scelta). Confidenza bassa/media
// segnalata dove le fonti erano meno solide o il club ha cambiato colori
// nel tempo.
const TEAM_COLORS = {
  virtus_bologna: "#0A0A0A", // bianconero (alta)
  olimpia_milano: "#953C2A", // biancorosso (alta)
  canturina: "#0A1EAA", // biancoblu (alta)
  treviso: "#27621F", // verde e bianco (alta)
  varese: "#FEEB13", // gialloblù, epoca Ignis (media - doppia identità, vedi README)
  siena: "#3ABE22", // bianco, verde e nero (alta)
  venezia: "#6D2027", // orogranata (alta)
  trieste: "#A31416", // biancorosso (media)
  brescia: "#4B6DF2", // biancazzurro (media - club rifondato nel 2009)
  pesaro: "#B22F45", // biancorosso (alta)
  roma: "#411B1E", // giallorosso e blu - componente rosso (alta)
  reggio_emilia: "#E14A2F", // biancorosso (alta)
  fortitudo_bologna: "#0E1440", // biancoblu (alta)
  napoli: "#196A94", // azzurro e bianco (alta)
  pistoia: "#D05D47", // bianco e rosso (media)
  sassari: "#124995", // biancoblu (alta)
  trento: "#555A51", // bianconero (alta)
  avellino: "#25C07E", // bianco, verde e arancione (media)
  reggio_calabria: "#F78002", // nero e arancione - non viola (alta)
  cremona: "#4B97F5", // bianco e blu (media)
  brindisi: "#050E65", // biancoazzurro (alta)
  livorno: "#6A3149", // bianco e amaranto (media)
  udine: "#252529", // bianconero (alta)
  caserta: "#373E39", // bianconero (alta)
  biella: "#E62B48", // rosso e blu - componente rosso (alta)
  verona: "#1225F0", // gialloblù - componente blu (alta)
  teramo: "#EB1717", // biancorosso (alta)
  roseto: "#5AB9ED", // biancazzurro (media)
  tortona: "#534D56", // bianconero (alta)
  scafati: "#F2BA40", // gialloblù (alta)
};

// Il colore squadra fa da sfondo alle iniziali del giocatore (avatar del
// quintetto finale e card PNG condivisa). Con i colori sociali veri
// introdotti nella 1.1 alcune squadre sono chiarissime - Varese e'
// giallo #FEEB13 - e le iniziali bianche fisse ci sparivano sopra
// (contrasto 1.23, sotto qualunque soglia leggibile). L'inchiostro si
// sceglie quindi in base al contrasto WCAG, mai fisso.
const INK_LIGHT = "#ffffff";
const INK_DARK = "#0f141b"; // stesso valore di --bg
function relLuminance(hex) {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrastRatio(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function inkFor(bgHex) {
  if (typeof bgHex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(bgHex)) return INK_LIGHT;
  const l = relLuminance(bgHex);
  return contrastRatio(l, relLuminance(INK_LIGHT)) >= contrastRatio(l, relLuminance(INK_DARK))
    ? INK_LIGHT
    : INK_DARK;
}

// sigle a 3 lettere stile 82-0 (no sponsor), definite insieme all'utente.
// Bologna (VBO/FBO) e Reggio (REG/RCA) le due coppie a rischio collisione
// per due club nella stessa citta'; Treviso/Trieste/Trento (TVS/TRI/TNT)
// il gruppo con le iniziali piu' simili.
const TEAM_ABBR = {
  virtus_bologna: "VBO",
  olimpia_milano: "MIL",
  fortitudo_bologna: "FBO",
  canturina: "CAN",
  treviso: "TVS",
  varese: "VAR",
  siena: "SIE",
  venezia: "VEN",
  trieste: "TRI",
  brescia: "BRE",
  pesaro: "PES",
  roma: "ROM",
  reggio_emilia: "REG",
  napoli: "NAP",
  pistoia: "PIS",
  sassari: "SAS",
  trento: "TNT",
  avellino: "AVE",
  reggio_calabria: "RCA",
  cremona: "CRE",
  brindisi: "BRI",
  livorno: "LIV",
  udine: "UDI",
  caserta: "CAS",
  biella: "BIE",
  verona: "VER",
  teramo: "TER",
  roseto: "ROS",
  tortona: "TOR",
  scafati: "SCA",
};

// formato compatto stile 82-0 per l'etichetta di decade, al posto di
// "anni '90"/"anni 2000" ecc. (season.decade cosi' come generato da
// scrape_decade_sample.py)
const DECADE_LABELS = {
  "anni '90": "'90s",
  "anni 2000": "'00s",
  "anni 2010": "'10s",
  "anni 2020": "'20s",
};

// nome modalita' da mostrare nella riga metadati del risultato (stile
// 82-0: "CLASSIC MODE | A+ HISTORIC | 98.1 pts")
const MODE_LABELS = { classic: "Classic", decade: "Scegli decade", blind: "Blind" };

// CEILING = tetto teorico: somma del miglior rating_lega per ciascuno dei
// 5 rank, su tutte le squadre/decadi del dataset caricato. Calcolato in
// runtime da computeCeiling() dopo loadData(), NON hardcoded: e' il
// numero che si "sfasava" ogni volta che si aggiungevano squadre (da
// 127.5 con le prime 11 squadre a 151.6 con tutte e 30, mai ritarato nel
// frattempo) - calcolandolo dal dataset invece che scrivendolo a mano
// il problema non si ripresenta piu' da solo quando il roster cresce.
let CEILING = 0;
// MID = rating che vale 15/30 vittorie (record da 0.500). NON e' piu'
// ancorato al "giocatore a caso per ruolo" (rating mediano, ~43): a
// quel livello la sigmoide risultava gia' quasi satura per una
// selezione semplicemente attenta (non ottimale) ai rating visibili,
// che raggiunge da sola ~104 di rating (~68% del tetto) e quindi quasi
// sempre 26+ vittorie. MID_FRACTION sposta l'ancoraggio a "una buona
// selezione ma non ottimale", cosi' il .500 rappresenta uno sforzo
// onesto e non il minimo sindacale.
// (0.65 era troppo severo: quintetti onesti da 80-100 di rating, con
// giocatori sui 15-24 punti a partita, finivano comunque in zona
// retrocessione - ritarato a 0.55 dopo il feedback sulle prime partite
// reali giocate col roster completo.)
const MID_FRACTION = 0.55;
let MID = 0;
// PERFECTION_BAND: sopra questa frazione del tetto, il risultato e'
// sempre 30-0 - la "zona di perfezione" di un pugno di quintetti vicini
// al meglio possibile, invece di un plateau che capita per caso vicino
// al tetto (comportamento naturale di qualunque sigmoide, altrimenti).
// A 0.97 il tier S (29-30) era troppo raro per essere divertente (~1
// partita su 326 giocando bene): abbassato a 0.93, poi a 0.89 dopo aver
// misurato che a 0.93 il 30-0 esatto non usciva mai nemmeno giocando in
// modo ottimale (0 su 3000 pescate) - non era un problema di bravura, la
// soglia stava sopra il 99.9-esimo percentile di quello che le pescate
// permettono. Confrontate 7 bande (0.93->0.87) sulle STESSE pescate,
// chiamando la vera evaluateLineup() (non una riscrittura a mano - un
// primo giro senza arrotondamento/penalita' aveva dato numeri sballati,
// vedi README): 0.90 e sotto restava a 0/3000; 0.89 e' il primo valore
// dove il 30-0 esce davvero (5 su 3000, ~1 ogni 600 giocando in modo
// ottimale) con l'aumento di tier S piu' contenuto fra le opzioni che
// funzionano (1/31 -> 1/14, contro 1/9 a 0.87 - quasi il triplo).
// ATTENZIONE: K dipende da PERFECTION_THRESHOLD (vedi computeK sotto),
// quindi cambiare questa costante non sposta solo la punta della curva
// ma la ripiattisce tutta - anche piccoli spostamenti hanno un effetto
// piu' grande di quanto sembri a naso, vanno sempre misurati con
// tests/difficulty_check.js prima di cambiarli (vedi README, sezione
// "Curva a due tratti").
const PERFECTION_BAND = 0.89;
let PERFECTION_THRESHOLD = 0;
// K: calibrato (vedi computeK) perche' la sigmoide raggiunga circa 29.5
// vittorie appena sotto PERFECTION_THRESHOLD, cosi' il passaggio alla
// zona di perfezione resta morbido invece che un gradino.
let K = 0;

const REF_TEAM = { points: 43.33, rebounds: 4.87 + 11.94, assists: 6.54, steals: 5.43, blocks: 1.14 };
const PEN_THRESH = 0.5;
const PEN_SCALE = 15;
// le stoppate sono concentrate quasi solo nei centri (il 30% dei
// giocatori eleggibili ne fa praticamente zero, contro <2% delle altre
// categorie): pesarle come le altre penalizzava quintetti forti solo
// perche' non avevano un centro-stoppatore, non perche' fossero davvero
// sbilanciati. Pesate al 25%, le altre 4 categorie al 100%.
const PEN_WEIGHTS = { points: 1, rebounds: 1, assists: 1, steals: 1, blocks: 0.25 };

let ALL_TEAM_SEASONS = []; // tutte le carte-decade, sempre intero
let currentPool = []; // pool da cui pesca la partita in corso (= ALL_TEAM_SEASONS, o un sottoinsieme di decadi)
let currentDraw = []; // 5 team-season objects, in ordine di rivelazione
let roundIndex = 0;
let slots = []; // 5 slot: { id, type, rank, pick: null | {player, teamSeason} }
let selected = null; // giocatore selezionato in attesa di uno slot: { player, teamSeason, legalIds }
let roleFilter = "Tutti"; // filtro ruolo nella lista pescaggio, si azzera ad ogni nuova carta
let blindMode = false; // modalita' "Blind": statistiche nascoste, giocatori in ordine alfabetico
// SEMPRE true nel gioco spedito: le regole "as is" (false) restano
// raggiungibili in codice (computeCeiling/recomputeCurve/ranksFor
// accettano tutte il parametro), ma non sono un'opzione per chi gioca -
// non c'e' un doppio dataset, e' la stessa unica sorgente dati con due
// modi di leggerla, uno dei quali e' quello che gira davvero.
let heightRulesEnabled = true;

const $ = (sel) => document.querySelector(sel);

// tetto teorico: il miglior rating_lega disponibile per ciascuno dei 5
// rank, sommato, SUL POOL DATO (non sempre tutto ALL_TEAM_SEASONS - la
// modalita' "Scegli decade" gioca su un sottoinsieme, e il tetto deve
// riflettere solo cio' che e' davvero pescabile in quella partita).
// Dipende da extendByHeight perche' con i ruoli estesi un rank puo'
// avere un candidato migliore (es. un'ala molto alta col rating piu'
// alto di ogni centro puro).
function computeCeiling(pool, extendByHeight) {
  const bestByRank = {};
  for (const ts of pool) {
    for (const p of ts.players) {
      const ranks = ranksFor(p, extendByHeight);
      const rl = Number(p.rating_lega || 0);
      for (const r of ranks) {
        if (!(r in bestByRank) || rl > bestByRank[r]) bestByRank[r] = rl;
      }
    }
  }
  return Object.values(bestByRank).reduce((a, b) => a + b, 0);
}

// ricalcola CEILING/PERFECTION_THRESHOLD/MID/K sul pool dato - chiamata
// dopo il caricamento dati (pool = tutte le squadre) e di nuovo ad ogni
// "Genera sfida" (pool = tutte le squadre, o solo le decadi scelte in
// modalita' "Scegli decade"): MID_FRACTION/PERFECTION_BAND sono frazioni
// del tetto, quindi la curva resta proporzionalmente la stessa qualunque
// sia la dimensione del pool - verificato che non degenera su sottoinsiemi
// piccoli (una singola decade, 14-17 squadre, da' comunque una K sensata).
function recomputeCurve(pool, extendByHeight) {
  CEILING = computeCeiling(pool, extendByHeight);
  PERFECTION_THRESHOLD = CEILING * PERFECTION_BAND;
  MID = CEILING * MID_FRACTION;
  K = computeK(PERFECTION_THRESHOLD, MID, 29.5);
}

// K tale per cui, appena sotto la soglia della zona di perfezione, la
// sigmoide valga circa targetWins (29) invece di saltare direttamente a
// 30 - vedi la spiegazione a PERFECTION_BAND sopra.
function computeK(threshold, mid, targetWins) {
  return -Math.log(30 / targetWins - 1) / (threshold - mid);
}

async function loadData() {
  const res = await fetch("data/dataset.json");
  if (!res.ok) throw new Error(`HTTP ${res.status} nel caricare data/dataset.json`);
  const data = await res.json();
  const flat = [];
  for (const team of data.teams) {
    for (const season of team.seasons) {
      if (!season.lineup_complete) continue;
      flat.push({
        teamKey: team.key,
        abbr: TEAM_ABBR[team.key] || team.key.slice(0, 3).toUpperCase(),
        decadeLabel: DECADE_LABELS[season.decade] || season.decade,
        color: TEAM_COLORS[team.key] || "#d97706",
        players: season.players.filter((p) => p.eligible),
      });
    }
  }
  ALL_TEAM_SEASONS = flat;
  currentPool = flat;
  recomputeCurve(currentPool, heightRulesEnabled);
}

function drawFive() {
  // pesca 5 squadre-stagione distinte dal pool della partita in corso
  // (tutte le squadre, o solo le decadi scelte in "Scegli decade"),
  // evitando (quando possibile) di ripetere la stessa squadra due volte
  const shuffled = [...currentPool].sort(() => Math.random() - 0.5);
  const five = [];
  const usedKeys = new Set();

  for (const ts of shuffled) {
    if (five.length >= 5) break;
    if (usedKeys.has(ts.teamKey)) continue;
    five.push(ts);
    usedKeys.add(ts.teamKey);
  }
  // se non bastano squadre diverse (non dovrebbe succedere con 30 squadre), completa senza il vincolo
  if (five.length < 5) {
    for (const ts of shuffled) {
      if (five.length >= 5) break;
      if (!five.includes(ts)) five.push(ts);
    }
  }
  return five;
}

// mode: "classic" | "decade" | "blind". decades: Set di decadeLabel
// ("'90s" ecc.), richiesto solo per "decade". Salvate per "Rigioca" a
// fine partita, che deve ripartire nella stessa modalita' senza tornare
// alla scelta.
let lastMode = "classic";
let lastDecades = null;

function startDraft(mode, decades) {
  lastMode = mode;
  lastDecades = decades;
  blindMode = mode === "blind";
  currentPool = mode === "decade" ? ALL_TEAM_SEASONS.filter((ts) => decades.has(ts.decadeLabel)) : ALL_TEAM_SEASONS;
  recomputeCurve(currentPool, heightRulesEnabled);
  currentDraw = drawFive();
  roundIndex = 0;
  slots = SLOT_DEFS.map((d) => ({ ...d, pick: null }));
  selected = null;
  roleFilter = "Tutti";
  $("#screen-home").hidden = true;
  $("#screen-decades").hidden = true;
  $("#screen-result").hidden = true;
  $("#screen-draft").hidden = false;
  // header piu' snello durante il draft (vedi .topbar.header-compact in
  // CSS, vale anche su desktop). result-compact e' la versione solo-
  // mobile usata nel risultato (vedi showResult()) - qui si toglie nel
  // caso si arrivi da "Rigioca" senza passare da resetToHome()
  document.body.classList.add("header-compact");
  document.body.classList.remove("result-compact");
  renderRound();
}

// Determina in quali slot (per id) puo' essere messo un giocatore, dato lo stato attuale.
// Ogni slot ha un rank fisso (1=playmaker...5=centro); il ruolo del giocatore copre uno o
// due rank adiacenti (ranksFor, eventualmente esteso per altezza) - legale solo se il
// rank dello slot e' tra quelli coperti.
function legalSlotIdsFor(player) {
  const ranks = ranksFor(player, heightRulesEnabled);
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
  roleFilter = "Tutti"; // ogni nuova carta riparte senza filtro attivo
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
          const color = s.pick.teamSeason.color;
          // quadrato colorato con le iniziali, come l'avatar della
          // schermata finale (stesso inkFor() per il contrasto: non
          // sparisce su una squadra dal colore chiaro) - non solo una
          // barretta a sinistra su uno sfondo scuro
          return `<div class="slot-box filled" style="--team-color:${color};--team-ink:${inkFor(color)}">
            <div class="slot-icon">${initialsFor(s.pick.player)}</div>
            <div class="slot-label">${labelHtml}</div>
          </div>`;
        }
        let cls = "slot-box empty";
        if (selected) {
          cls += selected.legalIds.includes(s.id) ? " legal" : " illegal";
        }
        // quadrato vuoto (solo contorno) con la sigla del ruolo dentro:
        // stessa forma dello slot pieno, riempirlo di colore non la
        // cambia. Niente altro testo di stato: quello legale si illumina
        // gia' da solo (bordo/sfondo accent, vedi .slot-box.legal in CSS).
        // La sigla e' in uno span perche' su mobile va nascosta: li'
        // l'etichetta sotto e' gia' la sigla e verrebbe scritta due volte
        return `<div class="${cls}" data-slot-id="${s.id}">
          <div class="slot-icon"><span class="icon-role">${s.short}</span></div>
          <div class="slot-label">${labelHtml}</div>
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

  // Blind: niente indizi sulla qualita' del giocatore, ne' dall'ordine
  // (alfabetico per cognome, non per PPG) ne' dalle statistiche (nascoste)
  const sortedPlayers = blindMode
    ? [...ts.players].sort((a, b) => a.surname.localeCompare(b.surname))
    : [...ts.players].sort((a, b) => b.points_avg - a.points_avg);

  card.innerHTML = `
    <div class="team-card-head">
      <div class="team-dot" style="--team-color:${ts.color}"></div>
      <div>
        <div class="team-card-name">${ts.abbr}</div>
        <div class="team-card-year">${ts.decadeLabel}</div>
      </div>
    </div>
    <div class="role-filter">
      ${ROLE_FILTERS.map(
        (f) => `<button type="button" class="role-chip${f === roleFilter ? " active" : ""}" data-filter="${f}">${f}</button>`
      ).join("")}
    </div>
    ${
      blindMode
        ? ""
        : `<div class="player-list-header">
      <div></div>
      <div class="player-stats-header">
        <div class="stat-col">P</div>
        <div class="stat-col">R</div>
        <div class="stat-col">A</div>
        <div class="stat-col">S</div>
        <div class="stat-col">B</div>
      </div>
    </div>`
    }
    <div class="player-list" id="round-player-list"></div>
  `;

  card.querySelectorAll(".role-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      roleFilter = btn.dataset.filter;
      renderRound();
    });
  });

  // un giocatore puo' comparire nelle rose di squadre diverse (es. chi ha
  // cambiato squadra): una volta scelto non e' piu' selezionabile altrove
  const pickedIds = new Set(slots.filter((s) => s.pick).map((s) => s.pick.player.player_id));

  const list = $("#round-player-list");
  const visiblePlayers = sortedPlayers.filter((p) => matchesRoleFilter(p, roleFilter));
  if (visiblePlayers.length === 0) {
    list.innerHTML = `<div class="empty-role-note">Nessun giocatore per questo ruolo in questa carta.</div>`;
    return;
  }
  visiblePlayers.forEach((p) => {
    const alreadyPicked = pickedIds.has(p.player_id);
    const legalIds = alreadyPicked ? [] : legalSlotIdsFor(p);
    const isSelected = !!(selected && selected.player === p);
    const row = document.createElement("div");
    row.className = "player-row" + (legalIds.length === 0 ? " disabled" : "") + (isSelected ? " selected" : "");
    const reb = Number(p.off_rebound_avg || 0) + Number(p.def_rebound_avg || 0);
    row.innerHTML = `
      <div class="player-info">
        <div class="player-name">${p.name} ${p.surname}</div>
        <div class="player-role">${alreadyPicked ? "Già nel tuo quintetto" : roleSiglaFor(p)}</div>
      </div>
      ${
        blindMode
          ? ""
          : `<div class="player-stats">
        <div class="stat-col">${p.points_avg.toFixed(1)}</div>
        <div class="stat-col">${reb.toFixed(1)}</div>
        <div class="stat-col">${p.assists_avg.toFixed(1)}</div>
        <div class="stat-col">${Number(p.steals_avg || 0).toFixed(1)}</div>
        <div class="stat-col">${Number(p.blocks_avg || 0).toFixed(1)}</div>
      </div>`
      }
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
  // curva a due tratti: sopra la soglia di perfezione sempre 30-0 (un
  // pugno di quintetti vicinissimi al tetto teorico), sotto la sigmoide
  // di sempre - vedi PERFECTION_BAND
  const winsRaw = teamRating >= PERFECTION_THRESHOLD ? 30 : 30 / (1 + Math.exp(-K * (teamRating - MID)));

  const cats = {
    points: chosen.reduce((s, p) => s + Number(p.points_avg || 0), 0),
    rebounds: chosen.reduce((s, p) => s + Number(p.off_rebound_avg || 0) + Number(p.def_rebound_avg || 0), 0),
    assists: chosen.reduce((s, p) => s + Number(p.assists_avg || 0), 0),
    steals: chosen.reduce((s, p) => s + Number(p.steals_avg || 0), 0),
    blocks: chosen.reduce((s, p) => s + Number(p.blocks_avg || 0), 0),
  };
  const ratios = {};
  for (const k of Object.keys(cats)) ratios[k] = cats[k] / REF_TEAM[k];

  // squilibrio complessivo: somma pesata degli scarti sotto soglia su
  // TUTTE le categorie (non solo la peggiore) - un quintetto debole in
  // 2 categorie pesa piu' di uno debole in 1 sola
  const weakCats = Object.keys(ratios)
    .filter((k) => ratios[k] < PEN_THRESH)
    .sort((a, b) => ratios[a] - ratios[b]);
  const penalty = PEN_SCALE * Object.keys(ratios).reduce(
    (sum, k) => sum + PEN_WEIGHTS[k] * Math.max(0, PEN_THRESH - ratios[k]),
    0
  );
  const winsFinal = Math.max(0, Math.min(30, Math.round(winsRaw - penalty)));

  return { teamRating, winsRaw, cats, ratios, weakCats, penalty, winsFinal };
}

const CAT_LABELS = { points: "Punti", rebounds: "Rimbalzi", assists: "Assist", steals: "Recuperate", blocks: "Stoppate" };

// livello qualitativo della squadra, in stile "voto + nome tier" (vedi 82-0)
const TIERS = [
  { min: 29, letter: "S", label: "Corazzata", color: "#f59e0b" },
  { min: 24, letter: "A", label: "Pretendente scudetto", color: "#4ade80" },
  { min: 18, letter: "B", label: "Squadra da playoff", color: "#60a5fa" },
  { min: 11, letter: "C", label: "Salvezza tranquilla", color: "#a78bfa" },
  { min: 5, letter: "D", label: "Zona playout", color: "#fb923c" },
  { min: 0, letter: "E", label: "Ultima in classifica", color: "#f87171" },
];
function tierFor(wins) {
  return TIERS.find((t) => wins >= t.min) || TIERS[TIERS.length - 1];
}

// solo per il recap finale (schermata risultato + condivisione): nome
// e cognome interi sono utili durante la scelta (riconoscere il
// giocatore conta), ma nel recap contano di piu' compattezza e spazio
// - iniziale puntata + cognome, stile "N. Cognome"
function shortName(player) {
  const initial = (player.name || "?")[0] || "?";
  return `${initial}. ${player.surname}`;
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
  // header-compact e' del draft (vale anche su desktop, invariato): si
  // toglie qui come sempre. result-compact e' un'altra cosa - comprime
  // l'header SOLO sotto gli 860px (vedi CSS), perche' su schermi stretti
  // il quintetto deve restare visibile senza scroll quanto possibile
  // (l'header pieno costava 81px inutili). Il desktop del risultato non
  // deve cambiare aspetto rispetto a prima.
  document.body.classList.remove("header-compact");
  document.body.classList.add("result-compact");

  const wins = result.winsFinal;
  const losses = 30 - wins;
  $("#result-record").innerHTML = `${wins}<span class="result-record-sep">—</span>${losses}`;

  const tier = tierFor(wins);
  $("#result-tier").innerHTML =
    `${MODE_LABELS[lastMode] || "Classic"} · ` +
    `<span class="tier-badge" style="--tier-color:${tier.color}">${tier.letter}</span> ` +
    `<span style="color:${tier.color}">${tier.label}</span> · Rating ${result.teamRating.toFixed(1)}`;

  const lineupEl = $("#result-lineup");
  // header colonne (P R A S B) una volta sola, visibile solo sotto gli
  // 860px (.lineup-stats-header e' display:none altrove, vedi CSS):
  // sotto le sue etichette, ogni riga sotto mostra solo il numero,
  // niente piu' .stat-lbl ripetuta 5 volte - stesso schema gia' usato
  // nella lista di pescaggio (.player-stats-header + righe di soli
  // numeri), che qui mancava
  const lineupHeader = `<div class="lineup-stats-header">
    <div class="lineup-stats-header-spacer"></div>
    <div class="who-stats">
      <div class="stat-col">P</div>
      <div class="stat-col">R</div>
      <div class="stat-col">A</div>
      <div class="stat-col">S</div>
      <div class="stat-col">B</div>
    </div>
  </div>`;
  const lineupRows = orderedSlots
    .map((s) => {
      const pk = s.pick;
      const p = pk.player;
      const reb = Number(p.off_rebound_avg || 0) + Number(p.def_rebound_avg || 0);
      return `<div class="lineup-row">
        <div class="who-avatar" style="--team-color:${pk.teamSeason.color};--team-ink:${inkFor(pk.teamSeason.color)}">
          <span class="avatar-initials">${initialsFor(p)}</span>
          <span class="avatar-role">${s.short}</span>
        </div>
        <div class="who">
          <div class="who-name">${shortName(p)}</div>
          <div class="who-from">${pk.teamSeason.abbr} · ${pk.teamSeason.decadeLabel}</div>
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
  lineupEl.innerHTML = lineupHeader + lineupRows;

  lastShareText =
    `LBA 30-0 — ${wins}-${losses} (${tier.letter}, ${tier.label})\n` +
    orderedSlots
      .map((s) => `${s.short} ${shortName(s.pick.player)} (${s.pick.teamSeason.abbr} ${s.pick.teamSeason.decadeLabel})`)
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
        name: shortName(p),
        team: `${s.pick.teamSeason.abbr} · ${s.pick.teamSeason.decadeLabel}`,
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
      const weak = result.weakCats.includes(k);
      return `<div class="stat-box ${weak ? "weak" : ""}">
        <div class="val">${result.cats[k].toFixed(1)}</div>
        <div class="label">${CAT_LABELS[k]}</div>
      </div>`;
    })
    .join("");

  const noteEl = $("#result-note");
  if (result.penalty > 0.05) {
    const parts = result.weakCats.map((k) => `${CAT_LABELS[k]} (${Math.round(result.ratios[k] * 100)}%)`);
    noteEl.textContent = `Squadra sbilanciata: ${parts.join(", ")} sotto la media di lega → -${result.penalty.toFixed(1)} vittorie stimate`;
  } else {
    noteEl.textContent = "";
  }
}

function resetToHome() {
  $("#screen-result").hidden = true;
  $("#screen-draft").hidden = true;
  $("#screen-home").hidden = false;
  document.body.classList.remove("header-compact");
  document.body.classList.remove("result-compact");
}

// click sul logo: torna alla home. Se una sfida e' in corso (schermata
// draft visibile) chiede conferma prima, perche' altrimenti si perde -
// senza questo, cambiare modalita' a meta' partita era impossibile senza
// finire prima le 5 squadre.
function goHomeWithConfirm() {
  const draftInProgress = !$("#screen-draft").hidden;
  if (draftInProgress && !confirm("Tornare alla home? La sfida in corso andrà persa.")) return;
  $("#screen-decades").hidden = true;
  resetToHome();
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
    const avatarBg = p.color || C.accent;
    ctx.fillStyle = avatarBg;
    roundRectPath(ctx, 54, rowY + 14, 70, 70, 10);
    ctx.fill();
    ctx.fillStyle = inkFor(avatarBg); // non bianco fisso: vedi inkFor()
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

      // divisore verticale fra le colonne, come sullo schermo
      // (.who-stats .stat-col:not(:first-child)): stesso C.border dei
      // separatori orizzontali, e va da sopra il valore a sotto
      // l'etichetta, cioe' esattamente l'altezza della coppia, non
      // dell'intera riga
      if (si > 0) {
        ctx.strokeStyle = C.border;
        ctx.beginPath();
        ctx.moveTo(cx - colW / 2, rowY + 16);
        ctx.lineTo(cx - colW / 2, rowY + 62);
        ctx.stroke();
      }
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

function openDecadePicker() {
  // sempre pulita all'apertura: altrimenti una scelta precedente resta
  // selezionata e si accumula silenziosamente con quella nuova
  document.querySelectorAll(".decade-tile").forEach((el) => el.classList.remove("selected"));
  updateDecadeStartButton();
  $("#screen-home").hidden = true;
  $("#screen-decades").hidden = false;
}

function closeDecadePicker() {
  $("#screen-decades").hidden = true;
  $("#screen-home").hidden = false;
}

// il bottone "Inizia" della modalita' "Scegli decade" resta disabilitato
// finche' non sono selezionate almeno 2 decadi (vincolo esplicito: sotto
// 2 non avrebbe senso rispetto a giocare Classic)
function updateDecadeStartButton() {
  const selected = document.querySelectorAll(".decade-tile.selected").length;
  $("#btn-decades-start").disabled = selected < 2;
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadData();
  } catch (e) {
    // dataset.json non raggiungibile (rete, 404, hosting momentaneamente
    // giu') - senza questo la pagina restava bianca e rotta in silenzio,
    // senza dire perche'. "Riprova" ricarica la pagina da zero.
    console.error("Caricamento dati fallito:", e);
    $("#screen-home").hidden = true;
    $("#screen-error").hidden = false;
    $("#btn-retry-load").addEventListener("click", () => location.reload());
    return;
  }
  $("#btn-mode-classic").addEventListener("click", () => startDraft("classic"));
  $("#btn-mode-blind").addEventListener("click", () => startDraft("blind"));
  $("#btn-mode-decade-open").addEventListener("click", openDecadePicker);
  $("#btn-decades-back").addEventListener("click", closeDecadePicker);
  document.querySelectorAll(".decade-tile").forEach((el) => {
    el.addEventListener("click", () => {
      el.classList.toggle("selected");
      updateDecadeStartButton();
    });
  });
  $("#btn-decades-start").addEventListener("click", () => {
    const decades = new Set([...document.querySelectorAll(".decade-tile.selected")].map((el) => el.dataset.decade));
    startDraft("decade", decades);
  });
  $("#btn-replay").addEventListener("click", () => startDraft(lastMode, lastDecades));
  $("#btn-change-mode").addEventListener("click", resetToHome);
  $("#btn-share").addEventListener("click", shareResult);
  $("#logo-home-link").addEventListener("click", goHomeWithConfirm);
  $("#logo-home-link").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goHomeWithConfirm(); }
  });
});
