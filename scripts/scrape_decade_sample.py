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
        # correzioni verificate che VINCONO sulla classificazione di
        # legabasket (a differenza di role_overrides_by_name, che riempie
        # solo i buchi). Usate con parsimonia e solo dove la ricerca
        # storica contraddice la fonte in modo netto.
        "role_forced_by_name": {
            # legabasket lo da' "Ala" (= AP/AG): era una guardia tiratrice pura, 201cm (Wikipedia IT)
            ("Predrag", "Danilovic"): "Guardia/Ala",
            # legabasket lo da' "Ala": in Italia giocava guardia, 198-201cm (Wikipedia IT, Proballers)
            ("Emanuel", "Ginobili"): "Guardia/Ala",
        },
    },
    "olimpia_milano": {
        "club_id": 28,
        "display_name": "Olimpia Milano",
        # aggiunta dopo le altre 29 (le carte-decade originarie risalivano a
        # un passaggio piu' vecchio della sessione, con un
        # role_overrides_by_name mai salvato - vedi check_data_consistency.py
        # e data/decade_coverage_research.md). Ricerca web per 24 giocatori
        # senza ruolo classificato ne' altezza: 20 risolti qui, 4 restano
        # irrisolvibili (Massimo Re, Emilio Rotasperti, Federico Aime,
        # Angelillo D'Ambrosio - identita' confermata ma nessuna fonte
        # riporta il ruolo di gioco, per D'Ambrosio l'unico omonimo trovato
        # ha un anno di nascita diverso quindi neanche quello e' affidabile)
        "role_overrides_by_name": {
            ("Cozell", "Mc Queen"): "Centro",          # NC State, drafted Celtics 1985 (Wikipedia)
            ("Piero", "Montecchi"): "Play/Guardia",     # playmaker/guardia (Museo del Basket Milano)
            ("Jay", "Vincent"): "Ala",                  # ex NBA Dallas Mavericks, Michigan State (Wikipedia)
            ("Johnny", "Rogers"): "Ala",                # (Museo del Basket Milano)
            ("Zan", "Tabak"): "Centro",                 # ex NBA Houston Rockets (Wikipedia)
            ("Mathias", "Sahlstrom"): "Centro",         # pivot svedese, arrivato da Iraklis Salonicco 1997/98 (Museo del Basket Milano)
            ("Georgios", "Kalaitzis"): "Guardia/Ala",   # ala/guardia greco (Wikipedia)
            ("Riccardo", "Musumeci"): "Guardia",        # settore giovanile Olimpia (Playbasket.it)
            ("Francesco", "Gravaghi"): "Guardia",       # settore giovanile Olimpia (RealOlimpiaMilano)
            ("Luigi", "Suigo"): "Centro",               # settore giovanile Olimpia (Sportando)
            ("Samuele", "Giardini"): "Guardia",         # (Eurobasket.com)
            ("Cristian", "Barbieri"): "Ala",            # settore giovanile Olimpia (Playbasket.it)
            ("Francesco", "De Capitani"): "Guardia",    # settore giovanile Olimpia, da Saronno (RealOlimpiaMilano)
            ("Federico Andrea", "Ferraris"): "Playmaker",  # settore giovanile Olimpia (Playbasket.it)
            ("Vittorio", "Lazzari"): "Ala",             # settore giovanile Olimpia (Playbasket.it)
            ("Giovanni", "Tam"): "Centro",              # settore giovanile Olimpia (PianetaBasket/MilanoToday)
            ("Luca", "Panna"): "Centro",                # settore giovanile Olimpia (MessinaSportiva.it)
            ("Diego", "Garavaglia"): "Ala",             # settore giovanile Olimpia (Wikipedia IT)
            ("Federico", "Pillepich"): "Ala",           # ala grande, settore giovanile Olimpia (PianetaBasket)
            ("Guglielmo", "Youssef"): "Ala",            # settore giovanile Olimpia (PianetaBasket)
        },
        # correzioni verificate che VINCONO sulla classificazione di
        # legabasket (a differenza di role_overrides_by_name, che riempie
        # solo i buchi). Usate con parsimonia e solo dove la ricerca
        # storica contraddice la fonte in modo netto.
        "role_forced_by_name": {
            # legabasket lo da' "Guardia/Ala" (= G/AP): a 205cm a Milano era
            # ala piccola con impieghi da ala grande, mai guardia (olimpiamilano.com, Wikipedia IT)
            ("Danilo", "Gallinari"): "Ala",
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
            ("Andrea", "Pistilli"): "Guardia",            # trovato dall'utente
        },
    },
    "roma": {
        "club_id": 48,
        "display_name": "Virtus Roma",
        "role_overrides_by_name": {
            ("Michael", "Cooper"): "Guardia/Ala",          # ex Lakers, ala difensiva SG/SF NBA (Wikipedia/Wikidata)
            ("Davide", "Croce"): "Centro",                 # centro (Wikipedia)
            ("Tiziano", "Lorenzon"): "Ala/Centro",         # 203cm, "ala-pivot", inventore del ruolo n.4 con tiro da 3 (Wikipedia)
            ("Roberto", "Premier"): "Guardia/Ala",         # shooting guard/small forward (Wikipedia)
            ("Alessandro", "Fantozzi"): "Playmaker",       # 189cm, playmaker (Wikipedia)
            ("Ricky", "Mahorn"): "Ala/Centro",             # 208cm, power forward/centro NBA, "Bad Boys" Pistons (Wikipedia)
            ("Ben", "Coleman"): "Ala",                     # 206cm, power forward NBA (Wikipedia)
            ("Albert", "English"): "Guardia",              # A.J. English, 190cm, shooting guard NBA (Wikidata)
            ("Marco", "Lamperti"): "Guardia",              # guardia (Wikipedia)
            ("Andrade", "Israel"): "Centro",               # centro brasiliano, nazionale olimpica (Wikipedia)
            ("Roberto", "Guerrini"): "Guardia",            # 193cm, guardia, Mens Sana Siena (basketsiena.it)
            ("Roberto", "Cavallari"): "Centro",            # gia' risolto per Virtus Bologna, stesso giocatore
            ("Tullio", "De Piccoli"): "Ala/Centro",        # gia' risolto per Virtus Bologna, stesso giocatore
            ("Paolo", "Calbini"): "Playmaker",             # gia' risolto per Pesaro, stesso giocatore
            ("Tod", "Murphy"): "Ala/Centro",               # 206cm, center/forward NBA (Wikipedia)
            ("Ed", "Stokes"): "Centro",                    # 213cm, centro NBA (Wikipedia)
            ("Francesco", "Mazzoni"): "Ala/Centro",        # 201cm (6'7"), trovato dall'utente
            ("Giovanni", "Sabbia"): "Ala",                 # small forward, trovato dall'utente
            # Giovanni Focardi, Andrea Negro: nessuna fonte trovata (profili
            # legabasket vuoti, proballers non accessibile, nessuna pagina
            # Wikipedia dedicata) - restano eligible=False, non indovinati
        },
        # correzioni verificate che VINCONO sulla classificazione di
        # legabasket (a differenza di role_overrides_by_name, che riempie
        # solo i buchi). Usate con parsimonia e solo dove la ricerca
        # storica contraddice la fonte in modo netto.
        "role_forced_by_name": {
            # legabasket lo da' "Centro" (= solo C): a Roma era ala-pivot,
            # il 4 di riferimento oltre che centro (Wikipedia IT ed EN)
            ("Dino", "Radja"): "Ala/Centro",
        },
    },
    "treviso": {
        # due club_id per la stessa citta': rifondazione dopo un buco lungo
        # (stesso trattamento gia' usato per le carte-stagione in
        # scrape_dataset.py, TEAMS["treviso"]["club_ids"])
        "club_ids": [56, 107],
        "display_name": "Benetton/De'Longhi Treviso",
        "role_overrides_by_name": {
            ("Pietro", "Generali"): "Centro",              # 205cm, centro (Wikipedia)
            ("Massimo", "Iacopini"): "Guardia",            # guardia tiratrice, capocannoniere storico Treviso (Wikipedia)
            ("Marco", "Mian"): "Playmaker",                # playmaker (Wikipedia)
            ("Paolo", "Vazzoler"): "Ala",                  # small forward, soprannome "piranha" (Wikipedia)
            ("Fabio", "Morrone"): "Ala",                   # 198cm, ala (Wikipedia)
            ("Nino", "Pellacani"): "Centro",               # 208cm, centro (Wikipedia)
            ("Andrea", "Gracis"): "Playmaker",             # gia' risolto per Pesaro, stesso giocatore
            ("Orlando", "Woolridge"): "Ala/Centro",        # gia' risolto per Virtus Bologna, stesso giocatore
            ("Winston", "Garland"): "Playmaker",           # 188cm, point guard NBA (Wikipedia)
            ("Laurent", "Sciarra"): "Playmaker",           # 195cm, point guard francese (Wikipedia)
        },
    },
    "reggio_emilia": {
        "club_id": 44,
        "display_name": "Pallacanestro Reggiana",
        "role_overrides_by_name": {
            ("Georgi", "Glouchkov"): "Ala/Centro",      # 203cm, power forward/centro, primo giocatore dell'est nella storia NBA (Wikipedia)
            ("Marco", "Lamperti"): "Guardia",           # gia' risolto per Virtus Roma, stesso giocatore
            ("Giorgio", "Ottaviani"): "Ala",            # ala piccola (Wikipedia stagioni Reggiana)
            ("Angelo", "Reale"): "Centro",              # centro (Wikipedia)
            ("Luca", "Vicinelli"): "Ala",               # ala grande (Wikipedia)
            ("Danko", "Cvjeticanin"): "Guardia",        # 198cm, shooting guard croato (Wikipedia)
            ("Piero", "Montecchi"): "Play/Guardia",     # gia' risolto per Olimpia Milano, stesso giocatore
            # Gianluca Carra, Renzo Filoia: nessuna fonte trovata (profili
            # legabasket vuoti, nessuna pagina Wikipedia dedicata) - restano
            # eligible=False, non indovinati
        },
    },
    "venezia": {
        "club_id": 61,
        "display_name": "Reyer Venezia",
        "role_overrides_by_name": {},
    },
    "fortitudo_bologna": {
        "club_id": 5,
        "display_name": "Fortitudo Bologna",
        "role_overrides_by_name": {
            ("Stefano", "Pezzin"): "Ala/Centro",        # "ala-pivot" massiccio e combattivo (Wikipedia)
            # Domenico Zecca: nessuna fonte trovata come giocatore (solo
            # come team manager in anni recenti) - resta eligible=False,
            # non indovinato
        },
    },
    "napoli": {
        "club_id": 42,
        "display_name": "Napoli",
        "role_overrides_by_name": {},
    },
    "trieste": {
        # due club_id per la stessa citta': rifondazione dopo un buco
        # lungo (stesso trattamento gia' usato per Treviso)
        "club_ids": [55, 106],
        "display_name": "Pallacanestro Trieste",
        "role_overrides_by_name": {
            ("Lemone", "Lampley"): "Centro",             # 211cm, centro NBA draft 1986 (Wikipedia)
            ("Jevon", "Crudup"): "Ala",                  # 206cm, forward NBA draft 1994 (Wikipedia)
            ("Simone", "Gironi"): "Ala/Centro",          # ala grande/centro (Wikipedia)
            ("Francesco", "Gori"): "Guardia",            # 195cm, guardia tiratrice, cresciuto nel vivaio Trieste (proballers/legapallacanestro)
            ("Delme", "Herriman"): "Ala",                # power forward britannico, giocava dall'1 al 4 (Wikipedia)
            ("Albert", "English"): "Guardia",            # gia' risolto per Virtus Roma, stesso giocatore
            ("Giuseppe", "Calavita"): "Centro",          # gia' risolto per Pallacanestro Varese, stesso giocatore
            ("Giovanni", "Sabbia"): "Ala",               # gia' risolto per Virtus Roma, stesso giocatore
            ("Andrea", "Gianolla"): "Guardia",           # gia' risolto per Pallacanestro Cantu', stesso giocatore
        },
    },
    "siena": {
        "club_id": 51,
        "display_name": "Mens Sana Siena",
        "role_overrides_by_name": {
            ("Lemone", "Lampley"): "Centro",             # gia' risolto per Trieste, stesso giocatore
            ("Maurizio", "Lasi"): "Playmaker",           # playmaker, 18 anni in Serie A (Wikipedia)
            ("Marco", "Solfrini"): "Ala",                # small forward, argento olimpico 1980 (Wikipedia)
            ("Letterio", "Visigalli"): "Guardia",        # 194cm, guardia (basketsiena.it)
            ("Sherron", "Mills"): "Ala",                 # 203cm, power forward NBA draft 1993 (Wikipedia)
            ("Lucius", "Davis"): "Ala",                  # 201cm, forward (Wikipedia)
            ("Keith", "Gray"): "Guardia",                # 188cm, guard NBA draft 1985 (Wikipedia)
            ("Gerard", "King"): "Ala",                   # 206cm, small forward (Wikipedia)
            ("Andrea", "Gianolla"): "Guardia",           # gia' risolto per Pallacanestro Cantu', stesso giocatore
            ("Giampiero", "Savio"): "Ala",               # gia' risolto per Virtus Bologna, stesso giocatore
            ("Massimo", "Iacopini"): "Guardia",          # gia' risolto per Treviso, stesso giocatore
            ("Marco", "Mian"): "Playmaker",              # gia' risolto per Treviso, stesso giocatore
            ("Andrea", "Pistilli"): "Guardia",           # gia' risolto per Pesaro, stesso giocatore
            ("Roberto", "Guerrini"): "Guardia",          # gia' risolto per Virtus Roma, stesso giocatore
            # Pierluigi Portesani: nessuna fonte trovata (12 partite, 2.2
            # punti/partita) - resta eligible=False, non indovinato
        },
    },
    "pistoia": {
        # due club_id per la stessa citta': rifondazione dopo un buco
        # lungo (anni 2000 del tutto assenti), stesso pattern di Treviso
        "club_ids": [39, 102],
        "display_name": "Pistoia",
        "role_overrides_by_name": {
            ("Stephen", "Howard"): "Ala",                # 206cm, small forward NBA (Wikipedia)
            ("Marty", "Embry"): "Ala/Centro",            # 206cm, forward/centro, draft NBA 1986 Utah Jazz (Basketball-Reference)
            ("Walter", "De Raffaele"): "Playmaker",      # playmaker, poi celebre allenatore (Wikipedia)
            ("Fabio", "Spagnoli"): "Guardia/Ala",        # guardia/ala, ottimo tiro da 3 (Wikipedia)
            ("Eugenio", "Capone"): "Centro",             # 211cm, centro (Wikipedia)
            ("Carlo", "Della Valle"): "Playmaker",       # playmaker, padre di Amedeo Della Valle (Wikipedia)
            ("Mark", "Campanaro"): "Guardia",            # 191cm, shooting guard (Wikidata/Proballers)
            ("Furio", "De Monaco"): "Ala/Centro",        # 208cm, power forward/centro (Wikipedia/Lega Nazionale Pallacanestro)
            ("Matteo", "Lanza"): "Guardia",              # guardia (Wikipedia)
            ("Tod", "Murphy"): "Ala/Centro",             # gia' risolto per Virtus Roma, stesso giocatore
            ("Clivo Massimo", "Righi"): "Centro",        # trovato dall'utente
            # Stefano Maguolo, Alessandro Piperno, Giuseppe Valerio,
            # Leandro Gros: nessuna fonte trovata (tutti fra 4.6 e 10.4
            # min/partita, marginali) - restano eligible=False, non
            # indovinati
        },
    },
    "sassari": {
        "club_id": 52,
        "display_name": "Dinamo Sassari",
        "role_overrides_by_name": {},
    },
    "trento": {
        "club_id": 104,
        "display_name": "Aquila Basket Trento",
        "role_overrides_by_name": {},
    },
    "avellino": {
        "club_id": 1,
        "display_name": "Scandone Avellino",
        "role_overrides_by_name": {},
    },
    "reggio_calabria": {
        "club_id": 43,
        "display_name": "Viola Reggio Calabria",
        "role_overrides_by_name": {
            ("Dean", "Garrett"): "Centro",               # gia' risolto per Pesaro, stesso giocatore
            ("Lucio", "Lagana'"): "Guardia",             # guardia, 227 presenze con Viola (Wikipedia)
            ("Matteo", "Lanza"): "Guardia",              # gia' risolto per Pistoia, stesso giocatore
            ("Giorgio", "Rifatti"): "Centro",            # argentino, segnalo' Manu Ginobili a Reggio Calabria (Wikipedia)
            ("Michael", "Young"): "Guardia/Ala",         # 201cm, small forward/shooting guard NBA (Wikipedia)
            ("Tiziano", "Lorenzon"): "Ala/Centro",       # gia' risolto per Virtus Roma, stesso giocatore
            ("Alexander", "Volkov"): "Ala/Centro",       # 208cm, power forward/centro, draft NBA 1986 (Wikipedia)
            ("Kevin", "Pritchard"): "Playmaker",         # point guard NBA, poi dirigente (Wikipedia)
            ("Alessandro", "Fantozzi"): "Playmaker",     # gia' risolto per Virtus Roma, stesso giocatore
            ("Randy", "White"): "Ala",                   # 203cm, power forward, draft NBA 1989 (Wikipedia)
            ("Andrea", "Cattani"): "Playmaker",          # playmaker, esordio A1 a 16 anni (Wikipedia)
            ("Paolo", "Prato"): "Centro",                # 204cm, centro (Wikipedia)
            ("Rocco", "Famà"): "Playmaker",              # ex playmaker, 188cm (Eurobasket)
            ("Clivo Massimo", "Righi"): "Centro",        # trovato dall'utente
            ("Dirk", "Rassloff"): "Centro",              # trovato dall'utente
        },
        # correzioni verificate che VINCONO sulla classificazione di
        # legabasket (a differenza di role_overrides_by_name, che riempie
        # solo i buchi). Usate con parsimonia e solo dove la ricerca
        # storica contraddice la fonte in modo netto.
        "role_forced_by_name": {
            # stesso caso della sua carta Virtus Bologna: guardia, non ala
            ("Emanuel", "Ginobili"): "Guardia/Ala",
        },
    },
    "cremona": {
        "club_id": 100,
        "display_name": "Vanoli Cremona",
        "role_overrides_by_name": {},
    },
    "brindisi": {
        "club_id": 82,
        "display_name": "Brindisi",
        "role_overrides_by_name": {},
    },
    "livorno": {
        # due club_id per la stessa citta': rifondazione dopo un buco
        # lungo, stesso pattern gia' usato per Treviso/Trieste/Pistoia
        "club_ids": [22, 23],
        "display_name": "Livorno",
        "role_overrides_by_name": {},
    },
    "udine": {
        "club_ids": [58, 57],
        "display_name": "Udine",
        "role_overrides_by_name": {},
    },
    "brescia": {
        "club_id": 8,
        "display_name": "Germani Brescia",
        "role_overrides_by_name": {},
    },
    "caserta": {
        "club_id": 10,
        "display_name": "Juvecaserta",
        "role_overrides_by_name": {},
    },
    "biella": {
        "club_id": 3,
        "display_name": "Biella",
        "role_overrides_by_name": {},
    },
    "verona": {
        "club_id": 63,
        "display_name": "Verona",
        "role_overrides_by_name": {
            ("Vittorio", "Gallinari"): "Ala/Centro",     # gia' risolto per Virtus Bologna, stesso giocatore
            ("Tim", "Kempton"): "Ala/Centro",            # 208cm, power forward/centro NBA (Wikipedia)
            ("Giampiero", "Savio"): "Ala",               # gia' risolto per Virtus Bologna, stesso giocatore
            ("Russ", "Schoene"): "Ala",                  # gia' risolto per Virtus Bologna, stesso giocatore
            ("Riccardo", "Caneva"): "Ala",               # gia' risolto per Pallacanestro Varese, stesso giocatore
            ("Fabio", "Torri"): "Guardia",               # guardia di riserva, poi rimpiazzato da Spagnoli (scaligerabasket.it)
            ("Fabio", "Spagnoli"): "Guardia/Ala",        # gia' risolto per Pistoia, stesso giocatore
            ("Sebastian", "Neal"): "Guardia",            # 196cm, guard (college Georgia)
            # Alfiero Perbellini: nessuna fonte trovata (15 partite, 6.5
            # min/partita, marginale) - resta eligible=False, non
            # indovinato
        },
    },
    "teramo": {
        "club_id": 64,
        "display_name": "Teramo",
        "role_overrides_by_name": {},
    },
    "roseto": {
        "club_id": 49,
        "display_name": "Roseto",
        "role_overrides_by_name": {},
    },
    "tortona": {
        "club_id": 111,
        "display_name": "Bertram Derthona Tortona",
        "role_overrides_by_name": {},
    },
    "scafati": {
        "club_id": 50,
        "display_name": "Givova Scafati",
        "role_overrides_by_name": {
            ("Fabio", "Mian"): "Guardia",                # 196cm, guardia (Wikipedia)
        },
    },
}

# correzioni per valori di altezza chiaramente errati nei dati grezzi di
# legabasket.it (scoperti da check_data_sanity.py: altezze fuori da un
# range umano plausibile). Per player_id con un valore alternativo
# plausibile gia' visto in cache (altra stagione/squadra dello stesso
# giocatore) si usa quello - mai un valore inventato; None quando nessun
# valore plausibile e' disponibile ne' in cache ne' via ricerca web
# (Massimiliano Gironi: annullato invece di indovinare).
HEIGHT_CORRECTIONS = {
    6604: 185,   # Colbey Ross: la cache mostra sia 85 sia 185 a seconda della stagione/squadra - 185 e' plausibile per un playmaker, gia' presente altrove in cache
    2579: 211,   # Arturas Gudaitis: la cache mostra sia 108 sia 211 - 211 e' plausibile per un centro, gia' presente altrove in cache
    2420: None,  # Massimiliano Gironi: la cache mostra solo 102 (impossibile) in entrambe le stagioni disponibili, nessun valore alternativo trovato
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


def build_decade(club_ids: list, display_name: str, role_overrides_by_name: dict,
                  label: str, year_start: int, year_end: int,
                  role_forced_by_name: dict = None) -> dict:
    role_forced_by_name = role_forced_by_name or {}
    print(f"\n=== {display_name} - {label} ({year_start}-{year_end}) ===")
    acc = {}  # player_id -> dict con sums, meta
    seasons_included = []

    for year in range(year_start, year_end + 1):
        teams = get_teams_for_year(year)
        match = next((t for t in teams if t["club_id"] in club_ids), None)
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
                if pid in HEIGHT_CORRECTIONS:
                    h = HEIGHT_CORRECTIONS[pid]
                if h:
                    a["height"] = h

    # override manuali risolti per nome (l'id lo scopriamo solo ora)
    role_overrides_by_pid = {}
    role_forced_by_pid = {}
    for pid, a in acc.items():
        key = (a["name"], a["surname"])
        if key in role_overrides_by_name:
            role_overrides_by_pid[pid] = role_overrides_by_name[key]
        if key in role_forced_by_name:
            role_forced_by_pid[pid] = role_forced_by_name[key]

    players_out = []
    missing_role = []
    for pid, a in acc.items():
        games = a["games_total"]
        eligible = games >= MIN_PRESENCES
        role = a["role"]
        role_source = a["role_source"]

        # correzione verificata: vince anche su un ruolo gia' assegnato da
        # legabasket, a differenza di role_overrides_by_name che riempie
        # solo i buchi. Serve per i casi in cui la classificazione della
        # fonte e' proprio sbagliata (vedi le note in TEAMS).
        if pid in role_forced_by_pid:
            role = role_forced_by_pid[pid]
            role_source = "ricerca_verificata"
        elif not role:
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

        club_ids = cfg["club_ids"] if "club_ids" in cfg else [cfg["club_id"]]
        all_decade_objs = [
            build_decade(club_ids, cfg["display_name"], cfg["role_overrides_by_name"], label, y0, y1,
                         cfg.get("role_forced_by_name"))
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
