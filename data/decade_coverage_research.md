# Copertura per decade delle squadre storiche di Serie A

Quali squadre qualificano per una carta-decade in ciascuna delle 4 decadi
giocabili (90s/00s/10s/20s — pre-1987 non ha statistiche individuali,
vedi README). Soglia di qualificazione: **almeno 5 stagioni** in Serie
A1/Serie A/LBA in quella decade, **3** per gli anni 2020 (decade ancora
a metà, solo 6 stagioni possibili — vedi README).

## Metodo (riverificato il 2026-09-01)

Prima versione fatta con 3 agenti di ricerca su Wikipedia a inizio
sessione, andata persa quando la conversazione è stata riassunta (viveva
solo in chat). Ricostruita a memoria dall'utente. Questa versione è
**riverificata direttamente sui dati legabasket.it**, non su Wikipedia:
tutti gli anni 1990-2025 erano già in cache locale (`data/raw_cache/`,
scaricati durante le run precedenti di `scrape_decade_sample.py`), quindi
è bastato rileggerli — zero nuove richieste all'API.

Per ogni anno si contano le squadre presenti (`get-teams`, che restituisce
esattamente le squadre di Serie A1/A di quella stagione) raggruppate per
`club_id` — l'identificativo stabile che legabasket assegna a un club a
prescindere dai cambi di sponsor. **Cinque città** hanno **due `club_id`
diversi** per una rifondazione dopo un lungo buco (fallimento, radiazione):
Treviso (56 + 107), Trieste (55 + 106), Livorno (22 + 23), Pistoia (39 +
102, corretto qui il 2026-09-02 — mancava in questa nota pur essendo già
gestito correttamente in `TEAMS` negli script), Udine (58 + 57, stesso
motivo) — sommati come stessa identità cittadina, coerente con la
convenzione già in README. Bologna, Roma e Milano hanno invece due
`club_id` genuinamente distinti perché sono due club diversi nella stessa
città (Virtus/Fortitudo, Virtus/Stella Azzurra, Olimpia/Milano 1958) —
**non** sommati.

Risultato: la tabella ricostruita a memoria dall'utente era esatta su
tutte le 29 righe. Le uniche differenze rispetto a quella versione sono
dovute alla soglia ridotta (3, non 5) sugli anni 2020, introdotta dopo:
**Brindisi** sale da 1/4 a 2/4 (4 stagioni 2020-20xx, sopra la soglia
ridotta), e compare una nuova candidata marginale, **Scafati** (esattamente
3 stagioni negli anni 2020, 1/4).

## Tabella

| Città (squadra) | Decadi | Copertura |
|---|---|---|
| Varese | 90 00 10 20 | 4/4 |
| Olimpia Milano | 90 00 10 20 | 4/4 |
| Virtus Bologna | 90 00 10 20 | 4/4 |
| Pesaro | 90 00 10 20 | 4/4 |
| Cantù | 90 00 10 | 3/4 |
| Roma (Virtus) | 90 00 10 | 3/4 |
| Reggio Emilia | 90 10 20 | 3/4 |
| Treviso | 90 00 20 | 3/4 |
| Fortitudo Bologna | 90 00 | 2/4 |
| Venezia | 10 20 | 2/4 |
| Napoli | 00 20 | 2/4 |
| Trieste | 90 20 | 2/4 |
| Siena | 90 00 | 2/4 |
| Pistoia | 90 10 | 2/4 |
| Sassari | 10 20 | 2/4 |
| Trento | 10 20 | 2/4 |
| Avellino | 00 10 | 2/4 |
| Reggio Calabria | 90 00 | 2/4 |
| Cremona | 10 20 | 2/4 |
| Brindisi | 10 20 | 2/4 |
| Livorno | 00 | 1/4 |
| Udine | 00 | 1/4 |
| Brescia | 20 | 1/4 |
| Caserta | 10 | 1/4 |
| Biella | 00 | 1/4 |
| Verona | 90 | 1/4 |
| Teramo | 00 | 1/4 |
| Roseto | 00 | 1/4 |
| Tortona | 20 | 1/4 |
| Scafati | 20 | 1/4 |

Casi al limite della soglia, da tenere a mente se in futuro si scoprissero
altre stagioni non ancora in cache: Brescia anni 2010 (4 stagioni, ne
manca 1), Cantù anni 2020 (2 stagioni, un buco nel mezzo), Trieste anni
2000/2010 (4 e 2), Treviso anni 2010 (3, sommando i due `club_id`).

Squadre controllate e **scartate** (nessuna decade sopra soglia, in
ordine di stagioni totali): Montegranaro, Torino, Capo d'Orlando, Forlì,
Montecatini, Rimini, Imola, Fabriano, Rieti, Ferrara, Napoli (identità
1990, `club_id` 33, diversa da quella 2000+), Firenze, Pavia, Trapani
(entrambe le identità, vecchia e nuova), Milano (identità 1990, `club_id`
27, diversa da Olimpia), Gorizia, Messina, Jesi, Casale Monferrato.

## Stato di implementazione (aggiornare mano a mano)

- **Fatte**: Virtus Bologna (4/4), Olimpia Milano (4/4), Pallacanestro
  Varese (4/4), Victoria Libertas Pesaro (4/4), Pallacanestro Cantù
  (3/4: 90/00/10, anni 2020 scartata — solo 2 stagioni, sotto anche la
  soglia ridotta), Virtus Roma (3/4: 90/00/10, anni 2020 scartata — 0
  stagioni, franchigia ferma dal 2020), Benetton/De'Longhi Treviso (3/4:
  90/00/20, anni 2010 scartata — solo 3 stagioni sommando i due `club_id`
  56+107)
- **Batch 1 fatto**: Reggio Emilia (3/4: 90/10/20, anni 2000 scartata —
  solo 3 stagioni), Reyer Venezia (2/4: 10/20), Fortitudo Bologna (2/4:
  90/00). Reggio Emilia e Fortitudo erano squadre nuove, aggiunte come
  stub vuoto in `data/dataset.json` prima di lanciare lo script decade
  (Fortitudo non ha carte-stagione, solo decade). Aggiunti anche i
  colori in `TEAM_COLORS` (`docs/app.js`).
- **Batch 2 fatto**: Napoli (2/4: 00/20 — squadra nuova, stub vuoto,
  solo carte-decade), Pallacanestro Trieste (2/4: 90/20), Mens Sana
  Siena (2/4: 90/00). Aggiunto anche il colore Napoli in `TEAM_COLORS`.
- **Batch 3 fatto**: Pistoia (2/4: 90/10 — squadra nuova, due club_id
  39+102 per una rifondazione), Dinamo Sassari (2/4: 10/20, squadra
  nuova), Aquila Basket Trento (2/4: 10/20, squadra nuova). Aggiunti i
  3 colori in `TEAM_COLORS`.
- **Batch 4 fatto**: Scandone Avellino (2/4: 00/10, squadra nuova, 0
  giocatori senza ruolo), Viola Reggio Calabria (2/4: 90/00, squadra
  nuova), Vanoli Cremona (2/4: 10/20, squadra nuova, 0 giocatori senza
  ruolo). Aggiunti i 3 colori in `TEAM_COLORS`.
- **Fix**: Clivo Massimo Righi e Dirk Rassloff (Reggio Calabria/Pistoia,
  batch 3-4) risolti a Centro dall'utente stesso.
- **Batch 5 fatto**: Brindisi (2/4: 10/20, squadra nuova), Livorno (1/4:
  00, squadra nuova — anni '90 scartata, solo 4 stagioni), Udine (1/4:
  00, squadra nuova), Germani Brescia (1/4: 20), Juvecaserta (1/4: 10,
  squadra nuova — anni '90 scartata, solo 4 stagioni). Tutti i
  giocatori senza ruolo trovati in questo batch appartenevano a carte
  poi scartate per sotto soglia (Livorno e Caserta anni '90) - zero
  ricerca necessaria. Aggiunti i 4 colori mancanti in `TEAM_COLORS`.
- **Batch 6 fatto (ULTIMO)**: Biella (1/4: 00, squadra nuova, 0
  giocatori senza ruolo), Verona (1/4: 90, squadra nuova), Teramo (1/4:
  00, squadra nuova, 0 senza ruolo), Roseto (1/4: 00, squadra nuova, 0
  senza ruolo), Bertram Derthona Tortona (1/4: 20, squadra nuova, 0
  senza ruolo), Givova Scafati (1/4: 20, squadra nuova). 10 giocatori
  senza ruolo risolti (9 Verona + 1 Scafati, entrambe le carte
  sopravvissute), 1 rimasto irrisolvibile (Alfiero Perbellini, Verona,
  6.5 min/partita). Aggiunti i 6 colori finali in `TEAM_COLORS`.

## Roster completo: tutte le 30 squadre della ricerca sono state aggiunte

Con il batch 6 il dataset copre tutte le 30 squadre identificate dalla
ricerca (tabella sopra). Nessuna squadra rimanente da aggiungere per
questo criterio di ammissione (5 stagioni/decade, 3 per gli anni 2020).
Prossimi passi che restano (vedi README "Da fare"): rimuovere le 2
forzature TEMP in `drawFive()` e mergiare su `main`, poi ritarare
penalità/`MID`/`K` a roster chiuso, poi le rifiniture (sigle squadra,
ruoli multipli via altezza, verifica colori).

Nota tecnica: `scrape_decade_sample.py` scarta automaticamente una
decade con troppe poche stagioni disponibili invece di generare comunque
una carta sottile che non rispecchia una vera decade
(`MIN_SEASONS_PER_DECADE = 5`, `MIN_SEASONS_DECADE_IN_CORSO = 3` per gli
anni 2020).

## Riverifica automatica (2026-09-02)

`scripts/check_data_coverage.py` ricalcola da zero, direttamente dai file
grezzi in `data/raw_cache/` (tutti gli anni 1990-2025, 55 `club_id`
distinti visti), quali identità-città qualificano per quale decade, e
confronta il risultato con la tabella sopra e con `data/dataset.json`
reale. Nessun gap (nessuna squadra qualificante dimenticata), nessun
falso scarto, nessun mismatch fra tabella e dataset — tutte le 30 righe
confermate indipendentemente. L'unico problema trovato è stato di
documentazione, non di dati: questa nota di metodo diceva "tre città" con
`club_id` doppio invece di cinque (mancavano Pistoia e Udine, già corrette
sopra).
