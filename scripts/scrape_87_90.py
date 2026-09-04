#!/usr/bin/env python3
"""
Carta-decade "anni '87-'90": NON una vera decade (solo 3 stagioni,
1987-88/1988-89/1989-90 - le uniche con statistiche di gioco strutturate
prima del 1990, verificato a mano contro l'API di legabasket.it: 1986-87
e prima torna sempre vuoto). Tenuta volutamente separata dal dataset
principale (`data/dataset.json`) e da `scrape_decade_sample.py`:

- soglia di qualificazione 3/3 stagioni (non 5/10 come le decadi vere:
  non avrebbe senso alla stessa scala) - solo squadre presenti in TUTTE
  e 3 le stagioni
- etichetta onesta "anni '87-'90", non "anni '80": non copre il decennio,
  copre gli ultimi 3 anni prima del 1990
- output in data/dataset_87_90.json, NON in data/dataset.json - da
  rivedere ed eventualmente fondere a mano, non un merge automatico

Riusa build_decade() da scrape_decade_sample.py cosi' com'e' (stessa
logica di aggregazione, stessa cache su disco, stessa pausa 1s) - solo
l'elenco squadre e l'intervallo di anni cambiano.

Uso:
  cd scripts && python3 scrape_87_90.py
"""
import json

from scrape_decade_sample import ROOT, build_decade, min_seasons_for

LABEL = "anni '87-'90"
YEAR_START = 1987
YEAR_END = 1989
MIN_SEASONS = 3  # 3/3: tutte le stagioni disponibili in questa finestra corta

# le 10 squadre confermate (vedi conversazione): presenti in tutte e 3 le
# stagioni 1987/1988/1989, raggruppate per club_id come discover_clubs.py.
# display_name e role_overrides_by_name riusano quelli gia' definiti per
# lo stesso team_key nelle decadi vere (stesso club, corregge gli stessi
# nomi se dovessero ricomparire) - presi da scrape_decade_sample.TEAMS.
TEAMS_87_90 = {
    "virtus_bologna": {"club_ids": [6], "display_name": "Virtus Bologna"},
    "canturina": {"club_ids": [12], "display_name": "Pallacanestro Cantù"},
    "olimpia_milano": {"club_ids": [28], "display_name": "Olimpia Milano"},
    "pesaro": {"club_ids": [37], "display_name": "Victoria Libertas Pesaro"},
    "roma": {"club_ids": [48], "display_name": "Virtus Roma"},
    "treviso": {"club_ids": [56], "display_name": "Benetton/De'Longhi Treviso"},
    "varese": {"club_ids": [60], "display_name": "Pallacanestro Varese"},
    "livorno": {"club_ids": [23], "display_name": "Livorno"},
    "caserta": {"club_ids": [10], "display_name": "Juvecaserta"},
    # club_id 33 = Filodoro/Wuber/Paini Napoli (1987-1990, sparisce dalla A1
    # subito dopo), 42 = l'entita' Napoli di oggi (dal 2005). 15 anni di
    # buco fra le due - NON verificabile come "stessa societa'" dall'API,
    # ma stesso tipo di situazione gia' accettata per Treviso/Trieste nel
    # dataset principale (buco lungo poi rifondazione, stessa citta').
    # Giudizio, non fatto oggettivo: segnalato esplicitamente qui.
    "napoli": {"club_ids": [33, 42], "display_name": "Napoli"},
}


def main():
    out = {"teams": []}
    for team_key, cfg in TEAMS_87_90.items():
        d = build_decade(cfg["club_ids"], cfg["display_name"], {}, LABEL, YEAR_START, YEAR_END)
        n_seasons = len(d["seasons_included"])
        if n_seasons < MIN_SEASONS:
            print(f"  [{team_key}] SCARTATA: solo {n_seasons}/3 stagioni {d['seasons_included']}")
            continue
        n_elig = sum(1 for p in d["players"] if p["eligible"])
        print(f"  [{team_key}] OK: {len(d['players'])} giocatori ({n_elig} eligible), "
              f"lineup_complete={d['lineup_complete']}")
        out["teams"].append({"key": team_key, "seasons": [d]})

    out_path = ROOT / "data" / "dataset_87_90.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nFatto. {len(out['teams'])} squadre su {len(TEAMS_87_90)} scritte in {out_path}")
    print("File separato, non fuso in data/dataset.json - da rivedere a mano.")


if __name__ == "__main__":
    main()
