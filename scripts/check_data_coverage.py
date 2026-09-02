#!/usr/bin/env python3
"""
Check dati - Parte A: verifica indipendente della copertura decadi/squadre.

Ricalcola da zero, direttamente dai file grezzi in data/raw_cache/
(teams_get-teams__items=50_year=<anno>.json, uno per anno 1990-2025),
quali "identita'-citta'" qualificano per quale decade secondo la soglia
gia' documentata (MIN_SEASONS_PER_DECADE / MIN_SEASONS_DECADE_IN_CORSO in
scripts/scrape_decade_sample.py), poi confronta il risultato con:

1. la tabella scritta a mano in data/decade_coverage_research.md
   (le 30 squadre incluse + l'elenco delle scartate)
2. le decadi realmente presenti in data/dataset.json

per trovare discrepanze: squadre che qualificano ma non sono ne' incluse
ne' scartate esplicitamente (gap), squadre scartate che in realta'
qualificano (falso scarto), o differenze fra la tabella e il dataset
reale (mismatch).

Uso:
    cd scripts && python3 check_data_coverage.py
"""
import json
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
RAW_CACHE = ROOT / "data" / "raw_cache"
DATASET_PATH = ROOT / "data" / "dataset.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scrape_decade_sample import (  # noqa: E402
    TEAMS as DECADE_TEAMS,
    MIN_SEASONS_PER_DECADE,
    MIN_SEASONS_DECADE_IN_CORSO,
    DECADE_IN_CORSO,
    DECADES,
)
from scrape_dataset import TEAMS as SAMPLE_TEAMS  # noqa: E402

DECADE_SHORT = {"anni '90": "90", "anni 2000": "00", "anni 2010": "10", "anni 2020": "20"}


def min_seasons_for(label):
    return MIN_SEASONS_DECADE_IN_CORSO if label == DECADE_IN_CORSO else MIN_SEASONS_PER_DECADE


# --- mappa team_key -> club_id inclusi, unendo le due fonti (olimpia_milano
# e' solo in scrape_dataset.py, le altre 29 solo/anche in scrape_decade_sample.py) ---
TEAM_CLUB_IDS = {}
for src in (SAMPLE_TEAMS, DECADE_TEAMS):
    for key, cfg in src.items():
        ids = set(cfg["club_ids"]) if "club_ids" in cfg else {cfg["club_id"]}
        TEAM_CLUB_IDS.setdefault(key, set()).update(ids)

assert len(TEAM_CLUB_IDS) == 30, f"attese 30 squadre incluse, trovate {len(TEAM_CLUB_IDS)}"

# --- tabella attesa, trascritta da data/decade_coverage_research.md righe 41-70 ---
EXPECTED_COVERAGE = {
    "varese": {"90", "00", "10", "20"},
    "olimpia_milano": {"90", "00", "10", "20"},
    "virtus_bologna": {"90", "00", "10", "20"},
    "pesaro": {"90", "00", "10", "20"},
    "canturina": {"90", "00", "10"},
    "roma": {"90", "00", "10"},
    "reggio_emilia": {"90", "10", "20"},
    "treviso": {"90", "00", "20"},
    "fortitudo_bologna": {"90", "00"},
    "venezia": {"10", "20"},
    "napoli": {"00", "20"},
    "trieste": {"90", "20"},
    "siena": {"90", "00"},
    "pistoia": {"90", "10"},
    "sassari": {"10", "20"},
    "trento": {"10", "20"},
    "avellino": {"00", "10"},
    "reggio_calabria": {"90", "00"},
    "cremona": {"10", "20"},
    "brindisi": {"10", "20"},
    "livorno": {"00"},
    "udine": {"00"},
    "brescia": {"20"},
    "caserta": {"10"},
    "biella": {"00"},
    "verona": {"90"},
    "teramo": {"00"},
    "roseto": {"00"},
    "tortona": {"20"},
    "scafati": {"20"},
}
assert set(EXPECTED_COVERAGE) == set(TEAM_CLUB_IDS), "le 30 chiavi della tabella attesa non combaciano con TEAM_CLUB_IDS"

# --- elenco scartate, trascritto da data/decade_coverage_research.md righe 77-82 ---
# per Napoli/Milano 1990 il documento da' esplicitamente il club_id (per
# evitare ambiguita' coi due team inclusi che hanno lo stesso nome citta')
DISCARDED_CLUB_ID_HINTS = {33: "Napoli (identità 1990)", 27: "Milano (identità 1990)"}
DISCARDED_NAME_SUBSTRINGS = [
    "Montegranaro", "Torino", "Orlando", "Forli", "Forlì", "Montecatini",
    "Rimini", "Imola", "Fabriano", "Rieti", "Ferrara", "Firenze", "Pavia",
    "Trapani", "Gorizia", "Messina", "Jesi", "Casale",
]

# rifondazioni con club_id doppio, sommate come stessa identita' cittadina.
# data/decade_coverage_research.md (righe 22-28) ne documenta solo 3
# (Treviso, Trieste, Livorno) nella nota di metodo, ma TEAMS in
# scrape_dataset.py/scrape_decade_sample.py ne usa 5: mancano Pistoia
# (39+102) e Udine (58+57), confermate rifondazioni dai dati grezzi
# (Kleenex/Madigan/Rolly/Mabo Pistoia anni '90 col club_id 39, poi Giorgio
# Tesi/The Flexx/Oriora/Estra Pistoia anni 2010-20 col club_id 102; Snaidero
# Udine anni 2000 col club_id 58, poi APU Udine 2025 col club_id 57) - vedi
# nota nel report del check_data_coverage.py, la nota di metodo nel research
# doc andrebbe corretta di conseguenza.
MERGE_GROUPS = [{56, 107}, {55, 106}, {22, 23}, {39, 102}, {58, 57}]


def merge_group_for(club_id):
    for g in MERGE_GROUPS:
        if club_id in g:
            return frozenset(g)
    return frozenset({club_id})


# --- 1. legge tutti gli anni grezzi, costruisce club_id -> anno -> nome, e
# l'insieme di tutti gli anni presenti per ogni club_id ---
years_by_club = defaultdict(set)  # club_id -> set(anni)
names_by_club = defaultdict(set)  # club_id -> set(nomi visti)

year_files = sorted(RAW_CACHE.glob("teams_get-teams__items=50_year=*.json"))
assert year_files, "nessun file teams_get-teams__*.json trovato in data/raw_cache/"

for f in year_files:
    year = int(f.stem.rsplit("year=", 1)[1])
    data = json.loads(f.read_text())
    for t in data.get("teams", []):
        years_by_club[t["club_id"]].add(year)
        names_by_club[t["club_id"]].add(t["name"])

print(f"Anni grezzi letti: {len(year_files)} file ({min(years_by_club_years := [y for s in years_by_club.values() for y in s])}-{max(years_by_club_years)})")
print(f"Club_id distinti visti in Serie A1/A/LBA 1990-{max(years_by_club_years)}: {len(years_by_club)}")

# --- 2. raggruppa in identita' (applicando le 3 fusioni note), poi calcola
# le decadi qualificanti per ciascuna identita' ---
raw_identities = defaultdict(set)  # frozenset(club_ids) -> set(anni unione)
for club_id, years in years_by_club.items():
    group = merge_group_for(club_id)
    raw_identities[group] |= years

qualifying = {}  # frozenset(club_ids) -> set(decadi qualificanti, "90"/"00"/"10"/"20")
for group, years in raw_identities.items():
    decades_ok = set()
    for label, start, end in DECADES:
        count = sum(1 for y in years if start <= y <= end)
        if count >= min_seasons_for(label):
            decades_ok.add(DECADE_SHORT[label])
    if decades_ok:
        qualifying[group] = decades_ok

# --- 3a. confronto per le 30 squadre incluse: la copertura ricalcolata dai
# dati grezzi (sullo stesso club_id/club_ids gia' usato dagli script di
# scraping) deve combaciare esattamente con la tabella trascritta ---
print("\n=== 3a. Confronto tabella attesa vs ricalcolo dai dati grezzi (30 squadre incluse) ===")
mismatches = []
for team_key, club_ids in sorted(TEAM_CLUB_IDS.items()):
    years = set()
    for cid in club_ids:
        years |= years_by_club.get(cid, set())
    recomputed = set()
    for label, start, end in DECADES:
        count = sum(1 for y in years if start <= y <= end)
        if count >= min_seasons_for(label):
            recomputed.add(DECADE_SHORT[label])
    expected = EXPECTED_COVERAGE[team_key]
    if recomputed != expected:
        mismatches.append((team_key, expected, recomputed))
        print(f"  MISMATCH {team_key}: tabella={sorted(expected)} ricalcolo={sorted(recomputed)}")
if not mismatches:
    print("  OK: tutte le 30 squadre, copertura ricalcolata identica alla tabella")

# --- 3b. squadre che qualificano per >=1 decade ma non sono fra le 30
# incluse: devono essere nell'elenco scartate, altrimenti sono un gap ---
included_groups = {frozenset(ids) for ids in TEAM_CLUB_IDS.values()}
print("\n=== 3b. Identita' qualificanti non incluse tra le 30 (gap o scarto atteso) ===")
gaps = []
false_discards = []
for group, decades_ok in sorted(qualifying.items(), key=lambda kv: -len(kv[1])):
    if group in included_groups:
        continue
    names = set()
    for cid in group:
        names |= names_by_club.get(cid, set())
    names_joined = " / ".join(sorted(names))

    hint = None
    for cid in group:
        if cid in DISCARDED_CLUB_ID_HINTS:
            hint = DISCARDED_CLUB_ID_HINTS[cid]
            break
    matched_discarded = hint is not None or any(
        sub.lower() in name.lower() for name in names for sub in DISCARDED_NAME_SUBSTRINGS
    )

    if matched_discarded:
        false_discards.append((group, decades_ok, names_joined))
        print(f"  FALSO SCARTO? {names_joined} (club_id {sorted(group)}) qualifica per {sorted(decades_ok)} ma e' nell'elenco scartate")
    else:
        gaps.append((group, decades_ok, names_joined))
        print(f"  GAP: {names_joined} (club_id {sorted(group)}) qualifica per {sorted(decades_ok)} ma non e' ne' incluso ne' scartato")

if not gaps and not false_discards:
    print("  OK: nessuna identita' qualificante fuori dalle 30 incluse o dall'elenco scartate")

# --- 4. confronto tabella attesa vs dataset.json reale ---
print("\n=== 4. Confronto tabella attesa vs data/dataset.json reale ===")
dataset = json.loads(DATASET_PATH.read_text())
teams_in_dataset = {t["key"]: t for t in dataset["teams"]}

DECADE_LABEL_TO_SHORT = {"anni '90": "90", "anni 2000": "00", "anni 2010": "10", "anni 2020": "20"}
dataset_mismatches = []
for team_key, expected in sorted(EXPECTED_COVERAGE.items()):
    team = teams_in_dataset.get(team_key)
    if not team:
        dataset_mismatches.append((team_key, expected, set()))
        print(f"  MISMATCH {team_key}: assente da dataset.json (atteso {sorted(expected)})")
        continue
    actual = set()
    for season in team.get("seasons", []):
        if not season.get("lineup_complete"):
            continue
        short = DECADE_LABEL_TO_SHORT.get(season.get("decade"))
        if short:
            actual.add(short)
    if actual != expected:
        dataset_mismatches.append((team_key, expected, actual))
        print(f"  MISMATCH {team_key}: tabella={sorted(expected)} dataset={sorted(actual)}")
if not dataset_mismatches:
    print("  OK: tutte le 30 squadre, decadi in dataset.json identiche alla tabella attesa")

# --- verdetto finale ---
print("\n=== Verdetto ===")
problems = len(mismatches) + len(gaps) + len(false_discards) + len(dataset_mismatches)
if problems == 0:
    print("PULITO: nessun gap, nessun mismatch, nessun falso scarto.")
else:
    print(f"TROVATI {problems} problemi da rivedere (vedi sopra).")
sys.exit(1 if problems else 0)
