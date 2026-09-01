#!/usr/bin/env python3
"""
Carte "decade" (stile 82-0), aggregate su tutte le stagioni disponibili
di una squadra in una decade, con media pesata per partite giocate.

A differenza di scrape_dataset.py (che pesca 5 anni campione, una
stagione = una carta), qui per ogni decade in DECADES si aggregano TUTTE
le stagioni disponibili di ciascuna squadra in TEAMS. Vedi il piano in
/root/.claude/plans/sbagliato-qui-il-squishy-sunset.md per il contesto.

Riusa le funzioni di rete/estrazione da scrape_dataset.py (stessa
cache su disco, stessa pausa 1s, stesso user-agent).

Idempotente: se una carta-decade per una squadra esiste gia' nel
dataset (stesso team_key + stessa etichetta decade), viene sostituita
invece che duplicata.
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

DECADES = [
    ("anni '90", 1990, 1999),
    ("anni 2000", 2000, 2009),
    ("anni 2010", 2010, 2019),
    ("anni 2020", 2020, 2025),  # decade parziale, in corso
]

# criterio di ammissione di una squadra a una decade (vedi README): sotto
# questa soglia la carta non rispecchia una decade vera, e' scartata.
# Per "anni 2020" la soglia e' piu' bassa perche' la decade e' ancora a
# meta' (solo 6 stagioni disponibili al massimo, 2020-2025).
MIN_SEASONS_PER_DECADE = 5
MIN_SEASONS_DECADE_IN_CORSO = 3
DECADE_IN_CORSO = "anni 2020"


def min_seasons_for(label: str) -> int:
    return MIN_SEASONS_DECADE_IN_CORSO if label == DECADE_IN_CORSO else MIN_SEASONS_PER_DECADE

# Squadre da processare in questo giro. team_key deve corrispondere alla
# chiave gia' usata in data/dataset.json (stessa convenzione di
# scrape_dataset.py: TEAMS li'). role_overrides_by_name: ruoli trovati
# manualmente via ricerca web per giocatori "eligible" senza alcuna fonte
# di ruolo nei dati legabasket (roster ne' fallback carriera) - risolti
# per nome invece che per player_id perche' l'id lo scopriamo solo alla
# prima esecuzione (vedi elenco "SENZA RUOLO" stampato).
TEAMS = {
    "virtus_bologna": {
        "club_id": 6,
        "display_name": "Virtus Bologna",
        "role_overrides_by_name": {
            ("Bill", "Wennington"): "Centro",        # 7'0", 3 titoli NBA coi Bulls come centro di riserva
            ("Clemon", "Johnson"): "Centro",          # 6'10", centro, campione NBA 1983 coi 76ers
            ("Orlando", "Woolridge"): "Ala/Centro",   # 6'9", ala forte/ala-centro
            ("Jurij", "Zdovc"): "Playmaker",           # playmaker sloveno, poi CT nazionale
            ("Russ", "Schoene"): "Ala",                # ala, draft NBA 1982
            ("Vittorio", "Gallinari"): "Ala/Centro",  # ala forte/centro, padre di Danilo Gallinari
            ("Branislav", "Prelevic"): "Guardia",      # guardia serba
            ("Kostas", "Patavoukas"): "Play/Guardia",  # playmaker/guardia greco
            ("Emilio", "Marcheselli"): "Playmaker",    # playmaker, quarto assistman all-time Olimpia (era li' prima)
            ("Roberto", "Cavallari"): "Centro",        # 205cm, centro (Wikidata/Virtuspedia)
            ("Giampiero", "Savio"): "Ala",              # 195cm, ala (Wikipedia)
            ("Tullio", "De Piccoli"): "Ala/Centro",     # 202cm, ala/centro (Wikipedia)
        },
    },
    "varese": {
        "club_id": 60,
        "display_name": "Pallacanestro Varese",
        "role_overrides_by_name": {
            ("Giuseppe", "Calavita"): "Centro",        # 211cm, centro (Wikipedia)
            ("Massimo", "Ferraiuolo"): "Playmaker",     # ex playmaker, dirigente Varese dal 2010 (Wikipedia)
            ("Riccardo", "Caneva"): "Ala",              # ala, storico giocatore Varese (Wikipedia)
            ("Reggie", "Theus"): "Play/Guardia",        # 198cm, shooting guard/point guard NBA (Wikipedia)
            ("Eddie Lee", "Wilkins"): "Ala/Centro",     # 208cm, power forward/center NBA (Wikipedia, Basketball-Reference)
            ("Richard", "Petruska"): "Ala/Centro",      # 208cm, power forward/center (EuroLeague profile)
        },
    },
    "canturina": {
        "club_id": 12,
        "display_name": "Pallacanestro Cantù",
        "role_overrides_by_name": {
            ("Silvano", "Dal Seno"): "Ala",              # 200cm, ala (Wikipedia)
            ("Andrea", "Gianolla"): "Guardia",            # 198cm, guardia (Wikipedia)
            ("Angelo", "Gilardi"): "Centro",              # 207cm, pivot cresciuto nel settore giovanile Cantù (Wikipedia)
            ("Adrian", "Caldwell"): "Ala/Centro",         # 203cm, power forward/centro sottodimensionato NBA (Wikipedia)
            ("Luigi", "Corvo"): "Playmaker",              # ruolo "P" nella rosa Cantù 1992-93 (Wikipedia stagione)
            ("Michael", "Curry"): "Guardia/Ala",          # 196cm, shooting guard/small forward NBA (Wikipedia)
            ("Piero", "Montecchi"): "Play/Guardia",       # 194cm, play-guardia (Wikipedia)
            ("John", "Ebeling"): "Centro",                # 203cm, centro (Wikidata)
        },
    },
    "pesaro": {
        "club_id": 37,
        "display_name": "Victoria Libertas Pesaro",
        "role_overrides_by_name": {
            ("Darwin", "Cook"): "Play/Guardia",           # 191cm, point guard/shooting guard NBA (Basketball-Reference)
            ("Andrea", "Gracis"): "Playmaker",            # playmaker storico di Pesaro (Wikipedia)
            ("Giovanni", "Grattoni"): "Guardia",          # 196cm, guardia (Wikipedia)
            ("Domenico", "Zampolini"): "Ala",             # ~198cm, ala piccola, bandiera Pesaro (Wikipedia)
            ("Paolo", "Calbini"): "Playmaker",            # 183cm, playmaker (Wikipedia)
            ("Haywoode", "Workman"): "Playmaker",         # 188cm, point guard NBA (Wikipedia)
            ("Dean", "Garrett"): "Centro",                # 211cm, centro NBA (Wikipedia)
            ("Lloyd", "Daniels"): "Guardia/Ala",          # 201cm, shooting guard/small forward NBA (Wikipedia)
            ("Todd", "Day"): "Guardia",                   # 198cm, shooting guard NBA (Wikipedia)
            ("Troy", "Truvillion"): "Play/Guardia",       # 191cm, point guard/shooting guard (Proballers)
            # Andrea Pistilli: nessuna fonte trovata (profilo legabasket vuoto,
            # proballers non accessibile, nessuna pagina stagione Wikipedia per
            # Pesaro 1996-97) - resta eligible=False, non indovinato
        },
    },
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


def build_decade(club_id: int, display_name: str, role_overrides_by_name: dict,
                  label: str, year_start: int, year_end: int) -> dict:
    print(f"\n=== {display_name} - {label} ({year_start}-{year_end}) ===")
    acc = {}  # player_id -> dict con sums, meta
    seasons_included = []

    for year in range(year_start, year_end + 1):
        teams = get_teams_for_year(year)
        match = next((t for t in teams if t["club_id"] == club_id), None)
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

    # override manuali risolti per nome (l'id lo scopriamo solo ora)
    role_overrides_by_pid = {}
    for pid, a in acc.items():
        key = (a["name"], a["surname"])
        if key in role_overrides_by_name:
            role_overrides_by_pid[pid] = role_overrides_by_name[key]

    players_out = []
    missing_role = []
    for pid, a in acc.items():
        games = a["games_total"]
        eligible = games >= MIN_PRESENCES
        role = a["role"]
        role_source = a["role_source"]

        if not role:
            if pid in role_overrides_by_pid:
                role = role_overrides_by_pid[pid]
                role_source = "wikipedia_lookup"
            elif a["height"]:
                role = estimate_role_from_height(a["height"])
                role_source = "estimated_height"
            else:
                # nessuna fonte di ruolo ne' altezza: non si indovina, il
                # giocatore resta nel dataset ma non selezionabile in gioco
                role = None
                role_source = None
                if eligible:
                    missing_role.append(a)
                eligible = False

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
        print(f"  SENZA RUOLO (eligible altrimenti, ora non selezionabile) — {len(missing_role)}:")
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
        "team_name_at_time": display_name,
        "lineup_complete": lineup_complete,
        "players": players_out,
    }


def main():
    dataset_path = ROOT / "data" / "dataset.json"
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))

    for team_key, cfg in TEAMS.items():
        team = next((t for t in dataset["teams"] if t["key"] == team_key), None)
        if team is None:
            print(f"[{team_key}] non trovato in dataset.json, salto (va aggiunto manualmente prima)")
            continue

        all_decade_objs = [
            build_decade(cfg["club_id"], cfg["display_name"], cfg["role_overrides_by_name"], label, y0, y1)
            for label, y0, y1 in DECADES
        ]
        decade_objs = [d for d in all_decade_objs if len(d["seasons_included"]) >= min_seasons_for(d["decade"])]
        skipped = [d for d in all_decade_objs if len(d["seasons_included"]) < min_seasons_for(d["decade"])]

        # idempotente: sostituisce le carte-decade con la stessa etichetta invece di duplicarle
        existing_by_label = {s["decade"]: i for i, s in enumerate(team["seasons"]) if "decade" in s}
        for d in decade_objs:
            if d["decade"] in existing_by_label:
                team["seasons"][existing_by_label[d["decade"]]] = d
            else:
                team["seasons"].append(d)
        # rimuove eventuali carte gia' presenti che in questo run non
        # raggiungono piu' la soglia (solo fra le decadi processate qui);
        # indici in ordine decrescente per non invalidarsi a vicenda
        skip_indices = sorted((existing_by_label[d["decade"]] for d in skipped if d["decade"] in existing_by_label), reverse=True)
        for idx in skip_indices:
            del team["seasons"][idx]

        print(f"\n[{team_key}] {len(decade_objs)} carte-decade pronte:")
        for d in decade_objs:
            n_elig = sum(1 for p in d["players"] if p["eligible"])
            print(f"  {d['decade']}: {len(d['players'])} giocatori ({n_elig} eligible), "
                  f"lineup_complete={d['lineup_complete']}, stagioni={d['seasons_included']}")
        if skipped:
            print("  scartate (sotto soglia stagioni minime):")
            for d in skipped:
                print(f"  {d['decade']}: solo {len(d['seasons_included'])} stagioni "
                      f"(soglia {min_seasons_for(d['decade'])}) {d['seasons_included']}")

    dataset_path.write_text(json.dumps(dataset, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nFatto. Dataset aggiornato: {dataset_path}")


if __name__ == "__main__":
    main()
