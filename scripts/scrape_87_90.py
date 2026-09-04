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
# role_forced_by_name: ruoli mancanti nei dati grezzi, trovati con ricerca
# web verificata (10 agenti paralleli, uno per squadra - Wikipedia IT/EN,
# virtuspedia.it, basketball-reference dove accessibile). Solo giocatori
# SOPRA la soglia MIN_PRESENCES (10 partite, la stessa soglia "eligible"
# usata ovunque nella pipeline) sono stati cercati - i giocatori marginali
# sotto soglia non selezionabili comunque non serve classificarli.
# Confidenza "alta" salvo dove annotato "media" in linea. 7 giocatori sopra
# soglia restano irrisolti (nessuna fonte affidabile trovata, non indovinati):
# Paolo Cappelli (Bologna), Fabrizio Valente (Roma), Giordano Marusic
# (Treviso), Guido Curtarello (Varese), Massimo Rossi e Gianluca Ceccarini
# (Livorno), Giuseppe Vitiello (Caserta).
TEAMS_87_90 = {
    "virtus_bologna": {
        "club_ids": [6], "display_name": "Virtus Bologna",
        "role_forced_by_name": {
            ("Domenico", "Fantin"): "Guardia",
            ("Massimo", "Sbaragli"): "Ala",
            ("Mike", "Silvester"): "Guardia/Ala",
            ("Greg", "Stokes"): "Ala/Centro",
            ("Vittorio", "Gallinari"): "Ala",
            ("Clemon", "Johnson"): "Centro",
            ("Clivo Massimo", "Righi"): "Centro",
        },
    },
    "canturina": {
        "club_ids": [12], "display_name": "Pallacanestro Cantù",
        "role_forced_by_name": {
            ("Umberto", "Cappelletti"): "Playmaker",
            ("Angelo", "Gilardi"): "Centro",
            ("Enrico", "Milesi"): "Ala/Centro",  # confidenza media, fonte non fetchabile direttamente
            ("Jeff", "Turner"): "Ala",
            ("Greg", "Stokes"): "Ala/Centro",
            ("Tullio", "De Piccoli"): "Ala/Centro",
            ("Andrea", "Gianolla"): "Guardia",
        },
    },
    "olimpia_milano": {
        "club_ids": [28], "display_name": "Olimpia Milano",
        "role_forced_by_name": {
            ("Piero", "Montecchi"): "Play/Guardia",
            ("Roberto", "Premier"): "Guardia/Ala",
        },
    },
    "pesaro": {
        "club_ids": [37], "display_name": "Victoria Libertas Pesaro",
        "role_forced_by_name": {
            ("Darwin", "Cook"): "Play/Guardia",
            ("Andrea", "Gracis"): "Playmaker",
            ("Matteo", "Minelli"): "Playmaker",  # confidenza media, fonte giornalistica non un profilo formale
            ("Silvano", "Motta"): "Guardia",
            ("Giuseppe", "Natali"): "Centro",
            ("Renzo", "Vecchiato"): "Centro",
            ("Domenico", "Zampolini"): "Ala",
            ("Maurizio", "Ferro"): "Guardia",
            ("Luca", "Silvestrin"): "Ala/Centro",
        },
    },
    "roma": {
        "club_ids": [48], "display_name": "Virtus Roma",
        "role_forced_by_name": {
            ("Carlo", "Della Valle"): "Playmaker",
            ("Tiziano", "Lorenzon"): "Ala/Centro",
            ("Fulvio", "Polesello"): "Centro",
            ("Marco", "Ricci"): "Centro",
            ("Stefano", "Teso"): "Guardia",
            ("Federico", "Casarin"): "Guardia",
            ("Enrico", "Gilardi"): "Guardia",
            ("Josè", "Vargas"): "Centro",
            ("Roberto", "Castellano"): "Guardia",
            ("Danny", "Ferry"): "Ala",
            ("Roberto", "Premier"): "Guardia",  # confidenza media, fonte copre soprattutto il periodo Milano
            ("Brian", "Shaw"): "Play/Guardia",
            ("David", "Thirdkill"): "Guardia/Ala",
        },
    },
    "treviso": {
        "club_ids": [56], "display_name": "Benetton/De'Longhi Treviso",
        "role_forced_by_name": {
            ("Federico", "Casarin"): "Play/Guardia",
            ("Massimo", "Iacopini"): "Guardia",
            ("Marco", "Mian"): "Play/Guardia",  # confidenza media-alta
            ("Mark", "Olberding"): "Ala",
            ("Paolo", "Pressacco"): "Playmaker",
            ("Paolo", "Vazzoler"): "Ala",
            ("Davide", "Croce"): "Centro",
            ("Pietro", "Generali"): "Centro",
            ("Kyle", "Macy"): "Playmaker",
        },
    },
    "varese": {
        "club_ids": [60], "display_name": "Pallacanestro Varese",
        "role_forced_by_name": {
            ("Riccardo", "Caneva"): "Ala",
            ("Massimo", "Ferraiuolo"): "Playmaker",
            ("Charles", "Pittman"): "Ala",
            ("Corny", "Thompson"): "Ala/Centro",
            ("Renzo", "Tombolato"): "Centro",
            ("Giuseppe", "Calavita"): "Centro",
            ("Frank", "Johnson"): "Playmaker",
        },
    },
    "livorno": {
        "club_ids": [23], "display_name": "Livorno",
        "role_forced_by_name": {
            ("Luigi", "Cagnazzo"): "Centro",
            ("Walter", "De Raffaele"): "Playmaker",
            ("Alessandro", "Fantozzi"): "Playmaker",
            ("Lee", "Johnson"): "Ala/Centro",
            ("Scott", "May"): "Ala",
            ("Simone", "Lottici"): "Play/Guardia",
        },
    },
    "caserta": {
        "club_ids": [10], "display_name": "Juvecaserta",
        "role_forced_by_name": {
            ("Sergio", "Donadoni"): "Guardia",
            ("Pietro", "Generali"): "Centro",
            ("Georgi", "Glouchkov"): "Ala/Centro",
            ("Fulvio", "Polesello"): "Centro",
        },
    },
    # club_id 33 = Filodoro/Wuber/Paini Napoli (1987-1990, sparisce dalla A1
    # subito dopo), 42 = l'entita' Napoli di oggi (dal 2005). 15 anni di
    # buco fra le due - NON verificabile come "stessa societa'" dall'API,
    # ma stesso tipo di situazione gia' accettata per Treviso/Trieste nel
    # dataset principale (buco lungo poi rifondazione, stessa citta').
    # Giudizio, non fatto oggettivo: segnalato esplicitamente qui.
    "napoli": {
        "club_ids": [33, 42], "display_name": "Napoli",
        "role_forced_by_name": {
            ("Antonio", "Fuss"): "Centro",
            ("Tim", "Kempton"): "Ala/Centro",
            ("Simone", "Lottici"): "Play/Guardia",
            ("Stefano", "Sbarra"): "Guardia",
            ("Sam", "Williams"): "Ala",
            ("Domenico", "Fantin"): "Guardia",
            ("Cozell", "Mc Queen"): "Centro",
            ("Clivo Massimo", "Righi"): "Centro",
            ("Massimo", "Sbaragli"): "Ala",
            ("Mark", "Simpson"): "Ala",
            ("Gianluca", "Lenoli"): "Playmaker",  # confidenza media, fonte indiretta
        },
    },
}


def main():
    out = {"teams": []}
    for team_key, cfg in TEAMS_87_90.items():
        d = build_decade(cfg["club_ids"], cfg["display_name"], {}, LABEL, YEAR_START, YEAR_END,
                          cfg.get("role_forced_by_name"))
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
