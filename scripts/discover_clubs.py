#!/usr/bin/env python3
"""
Script di scoperta: mappa le squadre "storiche" target al loro club_id stabile
su legabasket.it, controllando anno per anno quali club_id compaiono con nomi
che contengono le parole chiave delle citta' target.

Uso previsto: SOLO per uso personale/hobbistico, come da Termini e Condizioni
di legabasket.it. Pausa di 1 secondo tra le richieste, nessuna parallelizzazione,
nessuna rotazione di IP/user-agent.
"""
import json
import time
import urllib.request
from pathlib import Path

BASE = "https://www.legabasket.it/api/teams/get-teams"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LBA82-0-personal-hobby-script/1.0 (uso non commerciale, contatto: deveglia@gmail.com)"
PAUSE_SECONDS = 1.0

DECADES = {
    "90s": range(1990, 2000),
    "00s": range(2000, 2010),
    "10s": range(2010, 2020),
    "20s": range(2020, 2027),
}

TARGET_KEYWORDS = {
    "virtus_bologna": ["bologna"],
    "olimpia_milano": ["milano", "olimpia", "armani"],
    "canturina": ["cant"],
    "treviso": ["treviso", "benetton"],
    "varese": ["varese"],
    "siena": ["siena"],
    "venezia": ["venezia", "reyer"],
    "trieste": ["trieste"],
    "brescia": ["brescia"],
    "pesaro": ["pesaro", "scavolini", "vuelle"],
    "roma": ["roma"],
}


def fetch_teams_for_year(year: int):
    url = f"{BASE}?items=50&year={year}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("teams", [])


def main():
    all_years = sorted({y for yrs in DECADES.values() for y in yrs})
    club_years: dict[int, dict] = {}  # club_id -> {"names": set, "years": {year: team_id}}

    for i, year in enumerate(all_years):
        try:
            teams = fetch_teams_for_year(year)
        except Exception as e:
            print(f"[WARN] anno {year}: errore {e}")
            teams = []
        for t in teams:
            cid = t["club_id"]
            entry = club_years.setdefault(cid, {"names": set(), "years": {}})
            entry["names"].add(t["name"])
            entry["years"][year] = t["id"]
        print(f"[{i+1}/{len(all_years)}] anno {year}: {len(teams)} squadre")
        time.sleep(PAUSE_SECONDS)

    # match target keywords against collected names
    result = {}
    for key, keywords in TARGET_KEYWORDS.items():
        matches = []
        for cid, entry in club_years.items():
            names_lower = " | ".join(entry["names"]).lower()
            if any(kw in names_lower for kw in keywords):
                matches.append({
                    "club_id": cid,
                    "names": sorted(entry["names"]),
                    "years_present": sorted(entry["years"].keys()),
                })
        result[key] = matches

    out_path = Path(__file__).parent.parent / "data" / "club_discovery.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSalvato: {out_path}")

    print("\n=== Riepilogo ===")
    for key, matches in result.items():
        print(f"\n{key}:")
        if not matches:
            print("  NESSUN MATCH")
        for m in matches:
            years = m["years_present"]
            print(f"  club_id={m['club_id']} anni={min(years)}-{max(years)} ({len(years)} presenze) nomi={m['names']}")


if __name__ == "__main__":
    main()
