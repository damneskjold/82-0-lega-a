#!/usr/bin/env python3
"""
Check dati - Parte C: bound di sanita' sulle statistiche, distribuzione
role_source, spot-check dei giocatori con rating piu' alto.

A differenza della Parte A (copertura squadre/decadi) e della Parte B
(consistenza interna: ricalcolo, duplicati, eleggibilita'), qui si
controlla "i VALORI hanno senso?" - bound assoluti che non richiedono
ricalcolo ne' rete, solo lettura di data/dataset.json:

1. Bound di sanita' su ogni statistica di ogni giocatore: percentuali di
   tiro in [0,100], nessun valore negativo, minuti/partita <= 40 (una
   partita di Serie A dura 4x10'), altezza in un range umano plausibile
   se presente, games_total in un range plausibile per la lunghezza
   della decade.
2. Distribuzione di role_source su tutto il dataset: "roster" e
   "fallback_career" vengono direttamente dai dati legabasket.it,
   "estimated_height" ed "wikipedia_lookup" sono euristiche/ricerca
   manuale - piu' a rischio di errore, utile sapere quanti giocatori
   ricadono in ciascuna categoria.
3. Elenco dei giocatori con rating_lega piu' alto (i piu' influenti sul
   gioco: un errore li' ha l'impatto maggiore), per uno spot-check
   mirato invece che uniforme su tutti i 4110 giocatori-decade.

Uso:
    cd scripts && python3 check_data_sanity.py
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET_PATH = ROOT / "data" / "dataset.json"

dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))

PCT_FIELDS = ["fg2_pct", "fg3_pct", "ft_pct"]
NONNEGATIVE_FIELDS = [
    "minutes_avg", "points_avg", "off_rebound_avg", "def_rebound_avg",
    "assists_avg", "steals_avg", "turnovers_avg", "blocks_avg",
    "blocked_against_avg", "fouls_committed_avg", "fouls_suffered_avg",
    "games_total",
]
# una partita di Serie A dura 4x10' (40'): oltre non ha senso come media,
# margine fino a 42 per eventuali overtime frequenti in una decade intera
MAX_MINUTES_AVG = 42
# in una decade (max 10 stagioni, ~30 partite di regular season a
# stagione) il tetto teorico e' ~300 presenze totali; margine a 320
MAX_GAMES_TOTAL = 320
MIN_HEIGHT = 150
MAX_HEIGHT = 235

all_rows = []  # (team_key, decade, player) per ogni riga giocatore-decade
for team in dataset["teams"]:
    for season in team.get("seasons", []):
        if "decade" not in season:
            continue
        for p in season["players"]:
            all_rows.append((team["key"], season["decade"], p))

print(f"Righe giocatore-decade totali: {len(all_rows)}\n")

# --- 1. bound di sanita' ---
print("=== 1. Bound di sanita' sulle statistiche ===\n")
violations = []
for team_key, decade, p in all_rows:
    who = f"[{team_key}] {decade} {p['name']} {p['surname']} (id={p['player_id']})"
    for field in PCT_FIELDS:
        v = p.get(field)
        if v is not None and not (0 <= v <= 100):
            violations.append(f"{who}: {field}={v} fuori da [0,100]")
    for field in NONNEGATIVE_FIELDS:
        v = p.get(field)
        if v is not None and v < 0:
            violations.append(f"{who}: {field}={v} negativo")
    mins = p.get("minutes_avg")
    if mins is not None and mins > MAX_MINUTES_AVG:
        violations.append(f"{who}: minutes_avg={mins} > {MAX_MINUTES_AVG}")
    games = p.get("games_total")
    if games is not None and games > MAX_GAMES_TOTAL:
        violations.append(f"{who}: games_total={games} > {MAX_GAMES_TOTAL}")
    h = p.get("height")
    if h and not (MIN_HEIGHT <= h <= MAX_HEIGHT):
        violations.append(f"{who}: height={h} fuori da [{MIN_HEIGHT},{MAX_HEIGHT}]")
    # eligible=True deve sempre avere un ruolo (invariante gia' controllata
    # dalla parte B, ripetuta qui come bound di sanita' base)
    if p.get("eligible") and not p.get("role"):
        violations.append(f"{who}: eligible=True ma role assente")
    # NB: rating_lega=0 su un giocatore eligible NON e' trattato come
    # violazione - verificato a mano sui dati grezzi (2026-09-03) che e' un
    # valore realmente calcolato da legabasket.it per giocatori marginali a
    # bassissimo utilizzo (es. Giga Janelidze: -0.33/0.4/0 su 3 stagioni
    # diverse, chiaramente non un placeholder per "dato mancante" dato che
    # include anche valori negativi), non un dato mancante mascherato.

if violations:
    print(f"  VIOLAZIONI trovate: {len(violations)}")
    for v in violations[:40]:
        print(f"    {v}")
    if len(violations) > 40:
        print(f"    ... e altre {len(violations) - 40}")
else:
    print("  OK: nessuna violazione dei bound di sanita' su nessuna delle "
          f"{len(all_rows)} righe giocatore-decade")

# --- 2. distribuzione role_source ---
print("\n=== 2. Distribuzione role_source ===\n")
counts = Counter(p.get("role_source") for _, _, p in all_rows)
total = len(all_rows)
for source in ["roster", "fallback_career", "estimated_height", "wikipedia_lookup", None]:
    n = counts.pop(source, 0)
    label = source or "(nessuno, non eligible)"
    pct = 100 * n / total if total else 0
    risk = " <- euristica/ricerca manuale, piu' a rischio" if source in ("estimated_height", "wikipedia_lookup") else ""
    print(f"  {label:30s} {n:5d}  ({pct:5.1f}%){risk}")
for source, n in counts.items():  # eventuali valori imprevisti
    print(f"  VALORE IMPREVISTO {source!r}: {n}")

# --- 3. spot-check mirato: i giocatori con rating_lega piu' alto ---
print("\n=== 3. Top 20 per rating_lega (impatto piu' alto su un eventuale errore) ===\n")
eligible_rows = [(tk, d, p) for tk, d, p in all_rows if p.get("eligible")]
top = sorted(eligible_rows, key=lambda r: r[2].get("rating_lega") or 0, reverse=True)[:20]
for team_key, decade, p in top:
    print(f"  rating_lega={p['rating_lega']:6.2f}  [{team_key}] {decade}  {p['name']} {p['surname']}  "
          f"role={p['role']} ({p['role_source']})  pts={p['points_avg']}  games_total={p['games_total']}")

print("\n=== Verdetto ===")
if violations:
    print(f"TROVATI {len(violations)} problemi da rivedere (vedi sopra).")
    sys.exit(1)
else:
    print("PULITO: nessuna violazione dei bound di sanita'. Vedi sopra la distribuzione "
          "role_source e la top 20 per rating_lega per lo spot-check mirato (manuale, non automatizzato qui).")
