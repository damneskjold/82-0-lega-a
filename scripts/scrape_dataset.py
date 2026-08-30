#!/usr/bin/env python3
"""
Raccolta dati per il gioco "82-0 LBA".

Fonte: legabasket.it (API JSON pubbliche usate dal sito stesso, no scraping HTML).
Uso consentito: personale, non commerciale (vedi Termini e Condizioni legabasket.it).

Politica di raccolta rispettosa:
- 1 richiesta alla volta, mai in parallelo
- pausa di 1 secondo tra ogni richiesta
- user-agent unico, dichiarato, non ruotato
- cache su disco: se lo script viene interrotto e rilanciato, non ripete le
  chiamate gia' fatte (risparmia tempo e richieste al server)

Output: data/dataset.json con, per ciascuna delle 11 squadre storiche
selezionate, le stagioni campione (ogni 5 anni: 1990/1995/.../2025 quando
la squadra esisteva in Serie A quell'anno) con rosa e statistiche medie
per giocatore in quella stagione.
"""
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = "https://www.legabasket.it/api"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LBA82-0-personal-hobby-script/1.0 (uso non commerciale, contatto: deveglia@gmail.com)"
PAUSE_SECONDS = 1.0

ROOT = Path(__file__).parent.parent
CACHE_DIR = ROOT / "data" / "raw_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

TARGET_YEARS = [2005, 2010, 2015, 2020, 2025]

# club_id stabile per squadra, verificato manualmente da data/club_discovery.json
# (per Treviso e Trieste due club_id diversi: la squadra e' fallita e rifondata,
# quindi e' un'entita' diversa prima/dopo)
TEAMS = {
    "virtus_bologna": {"display": "Virtus Bologna", "club_ids": [6]},
    "olimpia_milano": {"display": "Olimpia Milano", "club_ids": [28]},
    "canturina": {"display": "Pallacanestro Cantù", "club_ids": [12]},
    "treviso": {"display": "Benetton/De'Longhi Treviso", "club_ids": [56, 107]},
    "varese": {"display": "Pallacanestro Varese", "club_ids": [60]},
    "siena": {"display": "Mens Sana Siena", "club_ids": [51]},
    "venezia": {"display": "Reyer Venezia", "club_ids": [61]},
    "trieste": {"display": "Pallacanestro Trieste", "club_ids": [55, 106]},
    "brescia": {"display": "Germani Brescia", "club_ids": [8]},
    "pesaro": {"display": "Victoria Libertas Pesaro", "club_ids": [37]},
    "roma": {"display": "Virtus Roma", "club_ids": [48]},
}

MIN_PRESENCES = 10  # soglia minima presenze per considerare un giocatore "selezionabile"


def http_get_json(url: str) -> dict:
    """GET con cache su disco (chiave = url), rispetta la pausa solo sulle chiamate reali."""
    cache_key = url.replace("https://www.legabasket.it/api/", "").replace("/", "_").replace("?", "__").replace("&", "_")
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  [HTTP {e.code}] {url}")
        data = {}
    time.sleep(PAUSE_SECONDS)
    cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def get_teams_for_year(year: int) -> list:
    return http_get_json(f"{BASE}/teams/get-teams?items=50&year={year}").get("teams", [])


def get_team_roster(team_id: int) -> dict:
    return http_get_json(f"{BASE}/teams/get-team-roster?id={team_id}")


def get_player_stats(player_id: int, year: int) -> dict:
    return http_get_json(f"{BASE}/players/get-player-stats?id={player_id}&s={year}")


def pct(realized, total):
    try:
        r, t = float(realized), float(total)
        return round(100 * r / t, 1) if t > 0 else None
    except (TypeError, ValueError):
        return None


def find_regular_season_entry(stats_resp: dict, year: int) -> dict | None:
    """La risposta di get-player-stats include una voce per competizione
    (Regular Season, Play Off, Coppa Italia, Supercoppa...). Vogliamo SOLO
    la Regular Season, quella che corrisponde a una stagione da 30 partite
    (girone di andata e ritorno), per essere coerenti con il formato del
    campionato che stiamo simulando."""
    avg_list = ((stats_resp.get("stats") or {}).get("data") or {}).get("avg") or []
    candidates = [e for e in avg_list if e.get("championship_year") == year]
    reg_season = next((e for e in candidates if e.get("championship_name") == "Regular Season"), None)
    if reg_season:
        return reg_season
    # fallback: se manca l'etichetta esatta, prendo la voce con piu' partite
    # giocate (tipicamente e' il campionato, non playoff/coppe che sono piu' corti)
    if candidates:
        return max(candidates, key=lambda e: e.get("played_matches") or 0)
    return None


def estimate_role_from_height(height) -> str:
    """Fallback finale quando il ruolo non e' classificato da nessuna fonte
    (raro, principalmente stagioni 1990/1995). Stima grezza da altezza."""
    try:
        h = float(height)
    except (TypeError, ValueError):
        h = 0
    if h <= 0:
        return "Ala"  # valore neutro se manca anche l'altezza (0 = dato assente, non "bassissimo")
    if h < 188:
        return "Playmaker"
    if h < 195:
        return "Guardia"
    if h < 202:
        return "Ala"
    if h < 208:
        return "Ala/Centro"
    return "Centro"


def build_player_record(roster_entry: dict, stats_resp: dict, year: int) -> dict | None:
    e = find_regular_season_entry(stats_resp, year)
    if not e:
        return None
    presences = e.get("played_matches") or 0

    role = roster_entry.get("player_role")
    if role == "Pivot":
        role = "Centro"  # sinonimo storico, stesso ruolo
    role_source = "roster"
    if not role or role == "-":
        # nelle stagioni piu' vecchie (soprattutto 1990/1995) la rosa storica
        # spesso non ha il ruolo classificato; usiamo come fallback il ruolo
        # "di carriera" del giocatore, gia' presente nella risposta get-player-stats
        fallback_role = (stats_resp.get("player") or {}).get("player_role_description")
        if fallback_role and fallback_role != "-":
            role = fallback_role
            role_source = "fallback_career"
        else:
            role = estimate_role_from_height(roster_entry.get("height"))
            role_source = "estimated_height"

    return {
        "player_id": roster_entry["id"],
        "name": roster_entry["name"],
        "surname": roster_entry["surname"],
        "role_id": roster_entry.get("player_role_id"),
        "role": role,
        "role_source": role_source,
        "height": roster_entry.get("height"),
        "presences": presences,
        "eligible": presences >= MIN_PRESENCES,
        "minutes_avg": e.get("played_minutes"),
        "points_avg": e.get("points"),
        "off_rebound_avg": e.get("offensive_rebound"),
        "def_rebound_avg": e.get("defensive_rebound"),
        "assists_avg": e.get("assists"),
        "steals_avg": e.get("regain_balls"),
        "turnovers_avg": e.get("lost_balls"),
        "blocks_avg": e.get("ball_stop_given"),
        "blocked_against_avg": e.get("ball_stop_received"),
        "fouls_committed_avg": e.get("done_fouls"),
        "fouls_suffered_avg": e.get("suffered_fouls"),
        "fg2_pct": pct(e.get("shots_2p_realized"), e.get("shots_2p_total")),
        "fg3_pct": pct(e.get("shots_3p_realized"), e.get("shots_3p_total")),
        "ft_pct": pct(e.get("free_throws_realized"), e.get("free_throws_total")),
        "rating_lega": e.get("rating_lega"),
        "rating_oer": e.get("rating_oer"),
    }


# Regola del quintetto: 1 Playmaker + 1 Centro fissi, poi 3 posti mobili tra
# Guardia e Ala con split 2-1 o 1-2 (mai 3-0). I ruoli ibridi contano come
# jolly per entrambe le categorie che affiancano.
ROLE_ALIASES = {
    "playmaker": ["Playmaker", "Play/Guardia"],
    "centro": ["Centro", "Ala/Centro"],
    "guardia": ["Guardia", "Play/Guardia", "Guardia/Ala"],
    "ala": ["Ala", "Guardia/Ala", "Ala/Centro"],
}


def check_lineup_complete(players: list) -> bool:
    elig_roles = [p["role"] for p in players if p["eligible"]]
    counts = {k: sum(1 for r in elig_roles if r in aliases) for k, aliases in ROLE_ALIASES.items()}
    if counts["playmaker"] < 1 or counts["centro"] < 1:
        return False
    if counts["guardia"] < 1 or counts["ala"] < 1:
        return False
    if counts["guardia"] + counts["ala"] < 3:
        return False
    return True


def main():
    # 1) per ogni anno target, chi e' in Serie A quell'anno (per trovare i team_id)
    year_teams_cache = {y: get_teams_for_year(y) for y in TARGET_YEARS}

    dataset = {"teams": [], "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "min_presences_threshold": MIN_PRESENCES}
    total_seasons = 0
    total_players = 0

    for key, meta in TEAMS.items():
        team_out = {"key": key, "display_name": meta["display"], "seasons": []}
        for year in TARGET_YEARS:
            teams_that_year = year_teams_cache[year]
            match = next((t for t in teams_that_year if t["club_id"] in meta["club_ids"]), None)
            if not match:
                continue
            team_id = match["id"]
            print(f"[{key}] {year} -> team_id={team_id} ({match['name']})")
            roster = get_team_roster(team_id)
            players_out = []
            for p in roster.get("players", []):
                stats_resp = get_player_stats(p["id"], year)
                rec = build_player_record(p, stats_resp, year)
                if rec:
                    players_out.append(rec)
                    total_players += 1
            team_out["seasons"].append({
                "year": year,
                "team_id": team_id,
                "team_name_at_time": match["name"],
                "lineup_complete": check_lineup_complete(players_out),
                "players": players_out,
            })
            total_seasons += 1
        dataset["teams"].append(team_out)

    out_path = ROOT / "data" / "dataset.json"
    out_path.write_text(json.dumps(dataset, indent=2, ensure_ascii=False), encoding="utf-8")
    n_complete = sum(1 for t in dataset["teams"] for s in t["seasons"] if s["lineup_complete"])
    print(f"\nFatto. {total_seasons} stagioni ({n_complete} con quintetto completo), {total_players} giocatori-stagione salvati in {out_path}")


if __name__ == "__main__":
    main()
