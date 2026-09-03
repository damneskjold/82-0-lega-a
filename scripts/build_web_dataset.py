#!/usr/bin/env python3
"""
Costruisce docs/data/dataset.json (la copia che scarica il browser) a
partire da data/dataset.json (la sorgente di verità, completa).

Perché esiste: la sorgente contiene tutto quello che serve ai check sui
dati (scripts/check_data_*.py), ma il gioco ne legge una parte piccola.
Spedirla intera voleva dire ~3.4 MB ad ogni visita, di cui circa i
quattro quinti mai usati: il 24% delle righe sono giocatori non
selezionabili che app.js scarta appena carica, 11 campi su 24 non sono
mai letti, e il file era anche indentato (tutti quegli spazi viaggiavano
fino al browser).

Sostituisce il vecchio `cp data/dataset.json docs/data/dataset.json`
fatto a mano, che era una fragilità nota: bastava scordarselo e il sito
restava indietro rispetto ai dati.

Nessun dato viene buttato: la sorgente resta completa, qui si decide solo
cosa vale la pena spedire al browser.

Uso:
    cd scripts && python3 build_web_dataset.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "dataset.json"
DST = ROOT / "docs" / "data" / "dataset.json"
APP_JS = ROOT / "docs" / "app.js"

# Campi giocatore spediti al browser, con chi li usa: se un domani serve
# mostrare in partita una statistica che oggi non si mostra, va aggiunta
# qui (e la guardia in fondo se ne accorge da sola se ci si dimentica).
PLAYER_FIELDS = {
    "player_id": "identità del giocatore: evita di sceglierlo due volte in squadre diverse",
    "name": "nome mostrato nella lista e nelle iniziali",
    "surname": "cognome mostrato nella lista, nelle iniziali e nel nome abbreviato",
    "role": "ruolo base, da cui derivano i rank degli slot",
    "height": "soglie di estensione del ruolo per altezza (ranksFor)",
    "minutes_avg": "normalizza i rimbalzi per 30 minuti in ranksFor: l'estensione ala->centro richiede che rimbalzi da lungo, non solo che sia alto",
    "eligible": "filtro al caricamento in loadData - SERVE anche se ormai sono tutti true, senza diventa undefined e il gioco scarta tutti",
    "points_avg": "colonna P e ordinamento della lista",
    "off_rebound_avg": "colonna R (sommata alle difensive)",
    "def_rebound_avg": "colonna R (sommata alle offensive)",
    "assists_avg": "colonna A",
    "steals_avg": "colonna S",
    "blocks_avg": "colonna B",
    "rating_lega": "motore di punteggio (curva, penalità, rating squadra)",
}

# Campi di squadra e stagione: stessa regola, solo quelli letti da app.js
TEAM_FIELDS = ["key", "seasons"]
SEASON_FIELDS = ["decade", "lineup_complete", "players"]


def main():
    full = json.loads(SRC.read_text(encoding="utf-8"))
    app = APP_JS.read_text(encoding="utf-8")

    tutti_i_campi = {k for t in full["teams"] for s in t["seasons"] if "decade" in s
                     for p in s["players"] for k in p}

    # guardia: se app.js nomina un campo giocatore che qui viene scartato,
    # il gioco lo leggerebbe come undefined senza che nessuno se ne accorga
    scartati_ma_usati = [
        f for f in sorted(tutti_i_campi - set(PLAYER_FIELDS))
        if re.search(r"\b" + re.escape(f) + r"\b", app)
    ]
    if scartati_ma_usati:
        print("ERRORE: app.js usa campi che questo script non spedisce al browser:")
        for f in scartati_ma_usati:
            print(f"  - {f}  (aggiungilo a PLAYER_FIELDS con una nota su chi lo usa)")
        return 1

    slim = {"teams": []}
    tenuti = scartati_giocatori = 0
    for team in full["teams"]:
        t_out = {k: team[k] for k in TEAM_FIELDS if k in team}
        t_out["seasons"] = []
        for season in team["seasons"]:
            if "decade" not in season:
                continue  # carte-stagione del vecchio prototipo, il gioco usa solo le decadi
            s_out = {k: season[k] for k in SEASON_FIELDS if k in season}
            s_out["players"] = []
            for p in season["players"]:
                if not p.get("eligible"):
                    scartati_giocatori += 1
                    continue
                s_out["players"].append({k: p[k] for k in PLAYER_FIELDS if k in p})
                tenuti += 1
            t_out["seasons"].append(s_out)
        slim["teams"].append(t_out)

    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(json.dumps(slim, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    prima = SRC.stat().st_size
    dopo = DST.stat().st_size
    print(f"sorgente  {SRC.relative_to(ROOT)}: {prima/1024/1024:.2f} MB")
    print(f"per il web {DST.relative_to(ROOT)}: {dopo/1024/1024:.2f} MB  (-{100*(prima-dopo)/prima:.0f}%)")
    print(f"giocatori spediti: {tenuti}, scartati perché non selezionabili: {scartati_giocatori}")
    print(f"campi per giocatore: {len(PLAYER_FIELDS)} su {len(tutti_i_campi)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
