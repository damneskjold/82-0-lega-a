# LBA 30-0

Clone hobbistico del gioco "82-0" (NBA) per la Lega Basket Serie A italiana.
App statica, nessun backend. Sito pubblicato su GitHub Pages: https://damneskjold.github.io/82-0-lega-a/

## Come funziona il gioco

Il giocatore riceve **5 squadre-stagione, una alla volta** (mai tutte insieme).
Per ciascuna sceglie un giocatore **e** decide subito a quale ruolo del
quintetto finale lo assegna — la scelta è irrevocabile prima di vedere la
squadra successiva (è la difficoltà centrale di 82-0: non sai cosa arriverà
dopo, rischi di "bruciare" uno slot).

Il quintetto finale deve avere **esattamente**:
- 1 Playmaker
- 1 Centro
- 3 giocatori tra Guardia e Ala, con split 2+1 o 1+2 (mai 3+0)

Il motore calcola un record proiettato su **30 partite** (girone di andata e
ritorno a 16 squadre, non 82 come in NBA).

## Fonte dati e vincoli

- Fonte: API JSON pubbliche di legabasket.it (non documentate, scoperte
  ispezionando il traffico di rete del sito — vedi `scripts/`)
- Uso consentito per scopo personale/non commerciale (Termini e Condizioni
  legabasket.it) — questo è un progetto hobbistico
- **Non usare Basketball-Reference.com**: i loro ToS vietano scraping e la
  costruzione di strumenti con i loro dati
- I dati legabasket.it non sono "certificati" (dichiarazione loro stessi):
  possibili piccole imprecisioni, accettabile per un gioco

## Scope dati attuale

11 squadre storiche italiane, stagioni campione **2005, 2010, 2015, 2020, 2025**
(una ogni 5 anni; il dataset copriva anche 1990/1995/2000 ma sono stati
tolti perché i giocatori di quell'epoca sono troppo poco riconoscibili per
la maggior parte dei giocatori del gioco).

Squadre (chiave interna → nome): `virtus_bologna`, `olimpia_milano`,
`canturina` (Cantù), `treviso`, `varese`, `siena`, `venezia`, `trieste`,
`brescia`, `pesaro`, `roma`. Alcune non coprono tutte e 5 le stagioni per
buchi reali nella loro storia in Serie A (fallimenti/rifondazioni — es.
Roma non ha dati dopo il 2010, Brescia solo da 2020).

Per ogni squadra-stagione si scaricano: rosa completa (`get-team-roster`)
e statistiche di **Regular Season** (non playoff/coppe — l'API le mescola
di default, va filtrato esplicitamente per `championship_name`) per ogni
giocatore (`get-player-stats`). Un giocatore è "eleggibile" se ha giocato
almeno 10 partite quella stagione con quella squadra.

### Ruoli

legabasket classifica i giocatori in 4 categorie core (Playmaker, Guardia,
Ala, Centro) più alcuni tag ibridi (Guardia/Ala, Play/Guardia, Ala/Centro)
che contano come jolly per entrambi i ruoli che affiancano. Non c'è una
5a categoria pulita tipo "power forward" — per questo il quintetto usa lo
schema 1 Playmaker + 1 Centro + 3 mobili Guardia/Ala (rispecchia lo schema
reale PG/SG/SF/PF/C, dove SG e PF nel basket italiano vengono spesso
etichettati genericamente Guardia/Ala).

Fallback quando il ruolo manca nei dati sorgente (raro dal 2005 in poi):
1. ruolo della rosa di quella stagione specifica
2. ruolo "di carriera" del giocatore (`player_role_description`)
3. stima grezza da altezza (soglie in `scripts/scrape_dataset.py`)

Ogni giocatore ha un campo `role_source` che dice quale livello è stato
usato — utile per capire quanto fidarsi del dato.

## Motore di calcolo

Rating giocatore = `rating_lega` (indice ufficiale legabasket, già
aggrega punti/rimbalzi/assist/ecc. in un numero solo — non abbiamo
inventato una formula di rating nostra).

```
team_rating = somma dei rating_lega dei 5 giocatori scelti
wins_raw    = 30 / (1 + e^(-K * (team_rating - MID)))
```

- `MID = 44.7`: rating di una squadra "media" (5 giocatori-tipo) → 15/30 vittorie
- `K = 0.04925`: calibrato in modo che il **miglior quintetto teoricamente
  possibile nel dataset attuale** (127.5 di rating — il miglior giocatore
  per ruolo su tutte le stagioni disponibili) arrivi esattamente a
  **30/30**. Se si amplia il dataset (più squadre/stagioni), questo tetto
  teorico cambia e K andrebbe ricalcolato.

**Penalità sbilanciamento**: si sommano 5 categorie base (punti, rimbalzi,
assist, palle recuperate, stoppate) sui 5 giocatori, si confrontano con la
media di lega (`REF_TEAM` in `app.js`), e se la categoria più debole scende
sotto il 50% della media si applica una penalità (`PEN_SCALE = 15`,
proporzionale a quanto si è sotto soglia). Tarata a mano insieme all'utente
su esempi concreti (vedi cronologia decisioni sotto).

Tutte le costanti sono duplicate in `docs/app.js` (frontend, la copia che
conta per il gioco pubblicato) — se si ritara la formula, aggiornare lì.

## Come rigenerare il dataset

```bash
cd scripts
python3 scrape_dataset.py
```

Scarica (con pausa di 1s tra le richieste, rispettosa verso legabasket.it,
mai in parallelo) rosa + statistiche per ogni squadra-stagione in
`TARGET_YEARS`, con cache su disco in `data/raw_cache/` (non versionata,
in `.gitignore`) — se rilanciato, riusa la cache invece di richiamare
l'API. Cambiare `TARGET_YEARS` o `TEAMS` in cima al file per estendere lo
scope. Dopo aver rigenerato `data/dataset.json`, copiarlo anche in
`docs/data/dataset.json` (il frontend legge da lì).

`scripts/discover_clubs.py` è lo script (già eseguito, risultato in
`data/club_discovery.json`) usato per mappare i nomi storici delle
squadre (cambiano sponsor/nome quasi ogni stagione) al loro `club_id`
stabile su legabasket.it — serve solo se si aggiungono nuove squadre.

## Decisioni prese finora (per chi riprende il progetto)

- Niente foto/loghi: solo un colore identificativo per squadra
  (approssimativo, non ricerca storica accurata — vedi `TEAM_COLORS` in
  `app.js`, correggere se qualcuno nota un colore palesemente sbagliato)
- Giocatori ordinati per PPG (punti a partita), non per rating, nelle
  liste di scelta
- Il draft è sequenziale con validazione live: un giocatore è cliccabile
  solo se esiste ancora almeno uno slot compatibile col suo ruolo: la UI
  blocca scelte che renderebbero impossibile completare il quintetto
  (es. l'ultimo slot Guardia/Ala libero, se prenderlo sforerebbe il vincolo
  2+1/1+2, non è selezionabile)
- Non serve un controllo di "risolvibilità" incrociato tra le 5 squadre:
  ogni squadra-stagione nel dataset garantisce già di per sé almeno un
  giocatore eleggibile per ciascuno dei 4 ruoli core (verificato in fase
  di generazione dataset, campo `lineup_complete`)

## Struttura repo

```
docs/           sito pubblicato (GitHub Pages serve da qui)
  index.html
  style.css
  app.js
  data/dataset.json    copia del dataset usata dal frontend
scripts/
  discover_clubs.py    mappatura squadra -> club_id nel tempo
  scrape_dataset.py    scraping + generazione dataset.json
data/
  dataset.json         dataset generato (sorgente di verità)
  club_discovery.json  output di discover_clubs.py
  raw_cache/           cache risposte API grezze (non versionata)
```

## Idee non ancora implementate

- Tasto "condividi risultato"
- Verifica/correzione manuale dei colori squadra
- Eventualmente ampliare lo scope (più squadre o più stagioni) — occhio a
  ricalibrare `K` nella formula se cambia il tetto massimo teorico
