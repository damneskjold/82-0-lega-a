#!/usr/bin/env python3
"""
Check dati - Parte B: consistenza interna del dataset.

A differenza di check_data_coverage.py (Parte A: "ci sono tutte le
squadre/decadi giuste?"), questo script verifica "i numeri dentro ogni
carta sono giusti e internamente coerenti?":

1. Ricalcolo: richiama la vera funzione di aggregazione
   (build_decade() in scrape_decade_sample.py) sui dati gia' in cache,
   per ognuna delle squadre/decadi, e confronta il risultato campo per
   campo con quanto scritto in data/dataset.json. Gira SOLO su cache
   locale (una guardia fa fallire lo script se tentasse una vera
   chiamata di rete) - la parte 3 sotto e' l'unica che tocca la rete,
   di proposito isolata.
2. Controlli strutturali sul dataset: nessun giocatore duplicato dentro
   una carta, nessuna carta-decade duplicata per la stessa squadra,
   coerenza della soglia di eleggibilita'.
3. Spot-check live e limitato (5 giocatori-stagione a caso) contro
   l'API di legabasket.it, per escludere che la cache locale si sia
   corrotta o sia stata modificata a mano dopo il download. Rispetta la
   stessa policy di scrape_dataset.py (1 richiesta alla volta, pausa
   1s, user-agent dichiarato). Se la rete non e' raggiungibile da
   questo ambiente, lo segnala e continua con gli altri controlli.

Uso:
    cd scripts && python3 check_data_consistency.py
"""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET_PATH = ROOT / "data" / "dataset.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))

import scrape_dataset  # noqa: E402

# --- guardia anti-rete per la parte 1/2: se scrape_dataset provasse una
# vera richiesta HTTP (cache miss), lo script deve fallire rumorosamente
# invece di scaricare dati non previsti in questo check ---
_real_http_get_json = scrape_dataset.http_get_json
_network_allowed = False


def _guarded_http_get_json(url):
    cache_key = url.replace("https://www.legabasket.it/api/", "").replace("/", "_").replace("?", "__").replace("&", "_")
    cache_file = scrape_dataset.CACHE_DIR / f"{cache_key}.json"
    if not cache_file.exists() and not _network_allowed:
        raise RuntimeError(
            f"check_data_consistency: tentata chiamata di rete non prevista per {url} "
            f"(cache mancante: {cache_file}) - la parte di ricalcolo deve girare solo su cache"
        )
    return _real_http_get_json(url)


scrape_dataset.http_get_json = _guarded_http_get_json

from scrape_decade_sample import (  # noqa: E402
    build_decade,
    TEAMS as DECADE_TEAMS,
    DECADES,
    min_seasons_for,
)
from scrape_87_90 import (  # noqa: E402
    TEAMS_87_90,
    LABEL as LABEL_8790,
    YEAR_START as YEAR_START_8790,
    YEAR_END as YEAR_END_8790,
    MIN_SEASONS as MIN_SEASONS_8790,
)

MIN_PRESENCES = scrape_dataset.MIN_PRESENCES

# Olimpia Milano e' stata aggiunta a TEAMS in scrape_decade_sample.py (era
# l'unica squadra fuori da quel dict, con un role_overrides_by_name storico
# perso - vedi data/decade_coverage_research.md e la nota di commit): ora
# ricalcolabile 1:1 come le altre 29, nessuna gestione speciale necessaria.
ALL_TEAMS_FOR_RECOMPUTE = dict(DECADE_TEAMS)

# "Late '80s" (TEAMS_87_90 in scrape_87_90.py) non era coperta da questo
# check fino ad ora (vedi README, sezione "Debito noto", voce ora segnata
# risolta): e' un dict a parte, con la sua etichetta/finestra/soglia
# proprie (non le 4 decadi vere sopra) e role_overrides_by_name sempre
# vuoto (solo role_forced_by_name viene usato per quella partizione -
# vedi scrape_87_90.py).
DECADES_8790 = [(LABEL_8790, YEAR_START_8790, YEAR_END_8790)]

FIELDS_TO_COMPARE = [
    "role", "role_source", "height", "games_total", "eligible",
    "minutes_avg", "points_avg", "off_rebound_avg", "def_rebound_avg",
    "assists_avg", "steals_avg", "turnovers_avg", "blocks_avg",
    "blocked_against_avg", "fouls_committed_avg", "fouls_suffered_avg",
    "fg2_pct", "fg3_pct", "ft_pct", "rating_lega", "rating_oer",
]

dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
teams_in_dataset = {t["key"]: t for t in dataset["teams"]}

print("=== 1. Ricalcolo indipendente (build_decade su cache) vs dataset.json ===\n")

recompute_mismatches = []          # (team_key, decade, player_id, field, atteso, ricalcolato)
recompute_player_set_diffs = []    # (team_key, decade, solo_in_dataset, solo_in_ricalcolo)


def check_team_decade(team_key, cfg, label, y0, y1, min_seasons):
    """Ricalcola una carta-decade con build_decade() e la confronta campo per
    campo con quanto scritto in dataset.json, aggiungendo eventuali
    discrepanze a recompute_mismatches/recompute_player_set_diffs.
    Condivisa fra le decadi vere (TEAMS, soglia da min_seasons_for) e
    "Late '80s" (TEAMS_87_90, soglia fissa 3 - vedi le due chiamate sotto)."""
    team = teams_in_dataset.get(team_key)
    if team is None:
        print(f"  [{team_key}] assente da dataset.json, salto (dovrebbe essere gia' stato segnalato dalla Parte A)")
        return

    club_ids = cfg["club_ids"] if "club_ids" in cfg else [cfg["club_id"]]
    seasons_by_decade = {s["decade"]: s for s in team["seasons"] if "decade" in s}

    stored = seasons_by_decade.get(label)
    recomputed = build_decade(club_ids, cfg["display_name"], cfg.get("role_overrides_by_name", {}), label, y0, y1,
                              cfg.get("role_forced_by_name"))
    qualifies = len(recomputed["seasons_included"]) >= min_seasons

    if stored is None:
        if qualifies:
            recompute_mismatches.append((team_key, label, None, "carta_mancante", "presente", "assente da dataset.json"))
        return
    if not qualifies:
        recompute_mismatches.append((team_key, label, None, "carta_in_eccesso", "assente", "presente in dataset.json ma sotto soglia stagioni"))
        return

    stored_players = {p["player_id"]: p for p in stored["players"]}
    recomputed_players = {p["player_id"]: p for p in recomputed["players"]}

    only_stored = set(stored_players) - set(recomputed_players)
    only_recomputed = set(recomputed_players) - set(stored_players)
    if only_stored or only_recomputed:
        recompute_player_set_diffs.append((team_key, label, sorted(only_stored), sorted(only_recomputed)))

    for pid in sorted(set(stored_players) & set(recomputed_players)):
        sp, rp = stored_players[pid], recomputed_players[pid]
        for field in FIELDS_TO_COMPARE:
            sv, rv = sp.get(field), rp.get(field)
            if sv != rv:
                recompute_mismatches.append((team_key, label, pid, field, sv, rv))

    if stored.get("lineup_complete") != recomputed.get("lineup_complete"):
        recompute_mismatches.append((team_key, label, None, "lineup_complete", stored.get("lineup_complete"), recomputed.get("lineup_complete")))
    if stored.get("seasons_included") != recomputed.get("seasons_included"):
        recompute_mismatches.append((team_key, label, None, "seasons_included", stored.get("seasons_included"), recomputed.get("seasons_included")))


for team_key, cfg in sorted(ALL_TEAMS_FOR_RECOMPUTE.items()):
    for label, y0, y1 in DECADES:
        check_team_decade(team_key, cfg, label, y0, y1, min_seasons_for(label))

# "Late '80s": stessa funzione, soglia fissa (non min_seasons_for(), che
# darebbe 5 - il default per una decade vera, sbagliato per questa
# finestra di 3 stagioni - vedi scrape_87_90.py).
for team_key, cfg in sorted(TEAMS_87_90.items()):
    for label, y0, y1 in DECADES_8790:
        check_team_decade(team_key, cfg, label, y0, y1, MIN_SEASONS_8790)

if recompute_mismatches:
    print(f"  MISMATCH trovati: {len(recompute_mismatches)}")
    for team_key, label, pid, field, sv, rv in recompute_mismatches[:40]:
        who = f"player_id={pid}" if pid is not None else "(carta)"
        print(f"    [{team_key}] {label} {who} campo={field}: dataset={sv!r} ricalcolo={rv!r}")
    if len(recompute_mismatches) > 40:
        print(f"    ... e altri {len(recompute_mismatches) - 40}")
else:
    print("  OK: nessun mismatch di ricalcolo su nessuna squadra/decade/campo")

if recompute_player_set_diffs:
    print(f"\n  Differenze nell'insieme giocatori (potrebbero indicare stagioni/roster diversi): {len(recompute_player_set_diffs)}")
    for team_key, label, only_stored, only_recomputed in recompute_player_set_diffs:
        print(f"    [{team_key}] {label}: solo in dataset={only_stored} solo in ricalcolo={only_recomputed}")

# --- 2. controlli strutturali sul dataset.json reale ---
print("\n=== 2. Controlli strutturali (duplicati, soglia eleggibilita') ===\n")

dup_players = []       # (team_key, decade, player_id)
dup_decade_cards = []   # (team_key, decade)
eligibility_violations = []  # (team_key, decade, player_id, games_total, role, eligible)

for team in dataset["teams"]:
    seen_decades = {}
    for season in team.get("seasons", []):
        label = season.get("decade")
        if label:
            seen_decades[label] = seen_decades.get(label, 0) + 1
        seen_pids = {}
        for p in season.get("players", []):
            seen_pids[p["player_id"]] = seen_pids.get(p["player_id"], 0) + 1
            expected_eligible = (p["games_total"] >= MIN_PRESENCES) and (p.get("role") is not None)
            if p["eligible"] != expected_eligible:
                eligibility_violations.append((team["key"], label, p["player_id"], p["games_total"], p.get("role"), p["eligible"]))
        for pid, count in seen_pids.items():
            if count > 1:
                dup_players.append((team["key"], label, pid))
    for label, count in seen_decades.items():
        if count > 1:
            dup_decade_cards.append((team["key"], label))

if dup_players:
    print(f"  DUPLICATI GIOCATORE trovati: {len(dup_players)}")
    for team_key, label, pid in dup_players:
        print(f"    [{team_key}] {label}: player_id={pid} compare piu' volte nella stessa carta")
else:
    print("  OK: nessun giocatore duplicato dentro una carta")

if dup_decade_cards:
    print(f"\n  CARTE-DECADE DUPLICATE trovate: {len(dup_decade_cards)}")
    for team_key, label in dup_decade_cards:
        print(f"    [{team_key}] {label}: piu' di una carta con la stessa etichetta decade")
else:
    print("  OK: nessuna carta-decade duplicata")

if eligibility_violations:
    print(f"\n  VIOLAZIONI SOGLIA ELEGGIBILITA' trovate: {len(eligibility_violations)}")
    for team_key, label, pid, games, role, elig in eligibility_violations[:20]:
        print(f"    [{team_key}] {label}: player_id={pid} games_total={games} role={role!r} eligible={elig} (atteso {games >= MIN_PRESENCES and role is not None})")
    if len(eligibility_violations) > 20:
        print(f"    ... e altre {len(eligibility_violations) - 20}")
else:
    print(f"  OK: eligible coerente con games_total >= {MIN_PRESENCES} and role presente, per tutti i giocatori")

# --- 3. spot-check live contro l'API, isolato (unica parte che tocca la rete) ---
print("\n=== 3. Spot-check live contro l'API legabasket.it (5 giocatori-stagione a caso) ===\n")

import time
import urllib.error
import urllib.request


def fetch_live_bypassing_cache(url):
    """Come http_get_json, ma NON legge/scrive la cache su disco: serve a
    verificare la cache stessa, non ha senso farla passare per la cache."""
    req = urllib.request.Request(url, headers={"User-Agent": scrape_dataset.UA})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    time.sleep(scrape_dataset.PAUSE_SECONDS)
    return data


random.seed(20260902)
cache_files = sorted(scrape_dataset.CACHE_DIR.glob("players_get-player-stats__id=*_s=*.json"))
sample = random.sample(cache_files, min(5, len(cache_files)))

network_ok = True
live_mismatches = []
for f in sample:
    stem = f.stem  # players_get-player-stats__id=<id>_s=<year>
    try:
        pid = int(stem.split("id=")[1].split("_s=")[0])
        year = int(stem.split("_s=")[1])
    except (IndexError, ValueError):
        continue
    cached = json.loads(f.read_text(encoding="utf-8"))
    url = f"{scrape_dataset.BASE}/players/get-player-stats?id={pid}&s={year}"
    try:
        live = fetch_live_bypassing_cache(url)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
        print(f"  Rete non raggiungibile ({type(e).__name__}: {e}) - spot-check live saltato, non bloccante")
        network_ok = False
        break
    # "cache_key" e' un campo di versioning interno di legabasket.it (una
    # stringa con timestamp che cambia ad ogni richiesta anche se i dati
    # statistici sotto sono identici) - va escluso dal confronto, altrimenti
    # ogni singola chiamata live risulta "diversa" per costruzione
    live_data = {k: v for k, v in live.items() if k != "cache_key"}
    cached_data = {k: v for k, v in cached.items() if k != "cache_key"}
    if live_data != cached_data:
        live_mismatches.append((pid, year))
        print(f"  MISMATCH player_id={pid} anno={year}: la cache locale differisce dalla risposta live (dati statistici, non solo cache_key)")
    else:
        print(f"  OK player_id={pid} anno={year}: cache locale identica alla risposta live (dati statistici)")

if network_ok and not live_mismatches:
    print("\n  OK: tutti i giocatori-stagione campionati combaciano con l'API live")

# --- verdetto finale ---
print("\n=== Verdetto ===")
problems = len(recompute_mismatches) + len(dup_players) + len(dup_decade_cards) + len(eligibility_violations) + len(live_mismatches)
if problems == 0:
    print("PULITO: nessun mismatch di ricalcolo, nessun duplicato, nessuna violazione di eleggibilita'" +
          ("" if not network_ok else ", spot-check live pulito") +
          (" (spot-check live non eseguito - rete non raggiungibile)" if not network_ok else "."))
else:
    print(f"TROVATI {problems} problemi da rivedere (vedi sopra).")
sys.exit(1 if problems else 0)
