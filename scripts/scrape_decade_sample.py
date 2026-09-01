#!/usr/bin/env python3
"""
Prototipo: carte "decade" (stile 82-0) per Olimpia Milano.

A differenza di scrape_dataset.py (che pesca 5 anni campione, una
stagione = una carta), qui per ogni decade si aggregano TUTTE le
stagioni disponibili di una squadra in quella decade, con media pesata
per partite giocate. Vedi il piano in
/root/.claude/plans/sbagliato-qui-il-squishy-sunset.md per il contesto.

Riusa le funzioni di rete/estrazione da scrape_dataset.py (stessa
cache su disco, stessa pausa 1s, stesso user-agent).
"""
import json
from pathlib import Path

from scrape_dataset import (
    ROOT,
    MIN_PRESENCES,
    get_teams_for_year,
    get_team_roster,
    get_player_stats,
    find_regular_season_entry,
    estimate_role_from_height,
    check_lineup_complete,
)

CLUB_ID = 28  # Olimpia Milano, unico club_id (nessuna rifondazione da gestire)
DISPLAY_NAME = "Olimpia Milano"

DECADES = [
    ("anni '90", 1990, 1999),
    ("anni 2000", 2000, 2009),
    ("anni 2010", 2010, 2019),
    ("anni 2020", 2020, 2025),  # decade parziale, in corso
]

# Ruoli trovati manualmente via ricerca web per giocatori "eligible" senza
# alcuna fonte di ruolo nei dati legabasket (roster ne' fallback carriera).
# Popolato dopo aver visto l'elenco "SENZA RUOLO" stampato da questo script.
MANUAL_ROLE_OVERRIDES = {
    3641: "Centro",       # Cozell McQueen - center/power forward (Wikipedia)
    3824: "Play/Guardia", # Piero Montecchi - play-guard, playmaker di ruolo (Wikipedia/Olimpia Milano)
    5810: "Ala",          # Jay Vincent - 6'7" forward (Wikipedia)
    4779: "Ala/Centro",   # Johnny Rogers - 6'10" power forward (Wikipedia)
    5411: "Centro",       # Zan Tabak - center (Wikipedia/Basketball-Reference)
    4919: "Centro",       # Mathias Sahlstrom - 6'8" center (FIBA)
}

STAT_FIELDS = [
    "minutes_avg", "points_avg", "off_rebound_avg", "def_rebound_avg",
    "assists_avg", "steals_avg", "turnovers_avg", "blocks_avg",
    "blocked_against_avg", "fouls_committed_avg", "fouls_suffered_avg",
]
STAT_SOURCE = {
    "minutes_avg": "played_minutes",
    "points_avg": "points",
    "off_rebound_avg": "offensive_rebound",
    "def_rebound_avg": "defensive_rebound",
    "assists_avg": "assists",
    "steals_avg": "regain_balls",
    "turnovers_avg": "lost_balls",
    "blocks_avg": "ball_stop_given",
    "blocked_against_avg": "ball_stop_received",
    "fouls_committed_avg": "done_fouls",
    "fouls_suffered_avg": "suffered_fouls",
}
SHOT_PAIRS = {
    "fg2_pct": ("shots_2p_realized", "shots_2p_total"),
    "fg3_pct": ("shots_3p_realized", "shots_3p_total"),
    "ft_pct": ("free_throws_realized", "free_throws_total"),
}


def build_decade(label: str, year_start: int, year_end: int) -> dict:
    print(f"\n=== {label} ({year_start}-{year_end}) ===")
    # accumulator per player_id
    acc = {}  # player_id -> dict con sums, meta
    seasons_included = []

    for year in range(year_start, year_end + 1):
        teams = get_teams_for_year(year)
        match = next((t for t in teams if t["club_id"] == CLUB_ID), None)
        if not match:
            print(f"  {year}: nessuna squadra (buco)")
            continue
        seasons_included.append(year)
        roster = get_team_roster(match["id"]).get("players", [])
        print(f"  {year}: {match['name']} ({len(roster)} giocatori in rosa)")

        for p in roster:
            stats_resp = get_player_stats(p["id"], year)
            e = find_regular_season_entry(stats_resp, year)
            if not e:
                continue
            presences = e.get("played_matches") or 0
            if presences <= 0:
                continue

            pid = p["id"]
            if pid not in acc:
                acc[pid] = {
                    "player_id": pid,
                    "name": p.get("name"),
                    "surname": p.get("surname"),
                    "role": None,
                    "role_source": None,
                    "height": None,
                    "games_total": 0,
                    "stat_sums": {k: 0.0 for k in STAT_FIELDS},
                    "shot_sums": {k: {"realized": 0.0, "total": 0.0} for k in SHOT_PAIRS},
                    "rating_lega_sum": 0.0,
                    "rating_oer_sum": 0.0,
                }
            a = acc[pid]
            a["games_total"] += presences
            for field, src_key in STAT_SOURCE.items():
                val = e.get(src_key)
                if val is not None:
                    a["stat_sums"][field] += float(val) * presences
            for pct_field, (real_key, tot_key) in SHOT_PAIRS.items():
                real = e.get(real_key) or 0
                tot = e.get(tot_key) or 0
                a["shot_sums"][pct_field]["realized"] += float(real)
                a["shot_sums"][pct_field]["total"] += float(tot)
            rl = e.get("rating_lega")
            ro = e.get("rating_oer")
            if rl is not None:
                a["rating_lega_sum"] += float(rl) * presences
            if ro is not None:
                a["rating_oer_sum"] += float(ro) * presences

            # ruolo/altezza: primo hit valido vince, non serve sovrascrivere
            if not a["role"]:
                role = p.get("player_role")
                if role == "Pivot":
                    role = "Centro"
                if role and role != "-":
                    a["role"] = role
                    a["role_source"] = "roster"
                else:
                    fallback_role = (stats_resp.get("player") or {}).get("player_role_description")
                    if fallback_role and fallback_role != "-":
                        a["role"] = fallback_role
                        a["role_source"] = "fallback_career"
            if not a["height"]:
                h = p.get("height")
                if h:
                    a["height"] = h

    players_out = []
    missing_role = []
    for pid, a in acc.items():
        games = a["games_total"]
        eligible = games >= MIN_PRESENCES
        role = a["role"]
        role_source = a["role_source"]
        if not role:
            if pid in MANUAL_ROLE_OVERRIDES:
                role = MANUAL_ROLE_OVERRIDES[pid]
                role_source = "wikipedia_lookup"
            elif a["height"]:
                role = estimate_role_from_height(a["height"])
                role_source = "estimated_height"
            else:
                role = "Ala"
                role_source = "estimated_height"
            if eligible and pid not in MANUAL_ROLE_OVERRIDES:
                missing_role.append(a)

        rec = {
            "player_id": pid,
            "name": a["name"],
            "surname": a["surname"],
            "role": role,
            "role_source": role_source,
            "height": a["height"],
            "games_total": games,
            "eligible": eligible,
        }
        for field in STAT_FIELDS:
            rec[field] = round(a["stat_sums"][field] / games, 2) if games > 0 else 0
        for pct_field in SHOT_PAIRS:
            s = a["shot_sums"][pct_field]
            rec[pct_field] = round(100 * s["realized"] / s["total"], 1) if s["total"] > 0 else None
        rec["rating_lega"] = round(a["rating_lega_sum"] / games, 2) if games > 0 else 0
        rec["rating_oer"] = round(a["rating_oer_sum"] / games, 2) if games > 0 else 0
        players_out.append(rec)

    if missing_role:
        print(f"  SENZA RUOLO (eligible, nessuna fonte) — {len(missing_role)}:")
        for a in missing_role:
            games = a["games_total"]
            pts = a["stat_sums"]["points_avg"] / games if games else 0
            rtg = a["rating_lega_sum"] / games if games else 0
            print(f"    id={a['player_id']:6d} {a['name']} {a['surname']}: "
                  f"games_total={games} pts_avg={pts:.1f} rating_lega={rtg:.2f}")

    lineup_complete = check_lineup_complete(players_out)
    return {
        "decade": label,
        "year_range": [year_start, year_end],
        "seasons_included": seasons_included,
        "team_name_at_time": DISPLAY_NAME,
        "lineup_complete": lineup_complete,
        "players": players_out,
    }


def main():
    decade_objs = [build_decade(label, y0, y1) for label, y0, y1 in DECADES]

    dataset_path = ROOT / "data" / "dataset.json"
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    team = next(t for t in dataset["teams"] if t["key"] == "olimpia_milano")
    team["seasons"].extend(decade_objs)
    dataset_path.write_text(json.dumps(dataset, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nFatto. {len(decade_objs)} carte-decade aggiunte a olimpia_milano in {dataset_path}")
    for d in decade_objs:
        n_elig = sum(1 for p in d["players"] if p["eligible"])
        print(f"  {d['decade']}: {len(d['players'])} giocatori ({n_elig} eligible), "
              f"lineup_complete={d['lineup_complete']}, stagioni={d['seasons_included']}")


if __name__ == "__main__":
    main()
