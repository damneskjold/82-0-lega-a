# LBA 30-0

Clone hobbistico del gioco "82-0" (NBA) per la Lega Basket Serie A italiana.
App statica, nessun backend. Sito pubblicato su GitHub Pages: https://damneskjold.github.io/82-0-lega-a/

## Come funziona il gioco

Il giocatore riceve **5 carte-squadra, una alla volta** (mai tutte insieme).
Per ciascuna sceglie un giocatore **e** decide subito a quale slot del
quintetto finale lo assegna — la scelta è irrevocabile prima di vedere la
carta successiva (è la difficoltà centrale di 82-0: non sai cosa arriverà
dopo, rischi di "bruciare" uno slot).

I 5 slot sono fissi e visibili per tutto il draft, nell'ordine del quintetto
base italiano:

| slot | sigla | rank |
|------|-------|------|
| Playmaker   | PM | 1 |
| Guardia     | G  | 2 |
| Ala Piccola | AP | 3 |
| Ala Grande  | AG | 4 |
| Centro      | C  | 5 |

Il motore calcola un record proiettato su **30 partite** (girone di andata e
ritorno a 16 squadre, non 82 come in NBA), con un tier finale (da E "ultima
in classifica" a S "corazzata") e il dettaglio statistico dei 5 scelti.
Il risultato è condivisibile come **immagine PNG** generata su canvas
(Web Share API con file, fallback su download e su condivisione testuale).

**Schermata risultato, stile 82-0**: punteggio con glow (`text-shadow`
sul numero, `box-shadow` sul bordo della hero box, entrambi in
`--accent-glow`), separatore "—" più leggero fra vittorie e sconfitte,
riga metadati compatta sotto il punteggio con **modalità · tier
colorato · rating** (es. "Classic · A Pretendente scudetto · Rating
105.3" — il colore del tier, non solo grigio muto, per dare più peso
visivo a un risultato alto, come "A+ HISTORIC" in verde su 82-0). Non
ancora replicato sull'immagine PNG condivisa (canvas, disegno statico
a coordinate fisse — più lavoro, lasciato per un giro successivo se
serve). **Layout a due colonne su desktop** — fatto: `.result-layout`
(hero+azioni a sinistra, quintetto+statistiche a destra, come 82-0),
grid a 1 colonna sotto 860px come sul draft, mobile resta impilato
in verticale.

**Se `data/dataset.json` non si carica** (rete assente, 404, hosting
momentaneamente giù) l'app non resta più bianca in silenzio: mostra
`#screen-error` con un messaggio e un bottone "Riprova" che ricarica la
pagina (`loadData()` controlla `res.ok` e lancia, il chiamante in
`DOMContentLoaded` la cattura).

### Legalità dei ruoli (sistema a rank)

Ogni slot ha un rank fisso 1-5; ogni ruolo copre **uno o due rank adiacenti**
(`ROLE_RANKS` in `docs/app.js`):

```
Playmaker     -> 1
Play/Guardia  -> 1, 2
Guardia       -> 2
Guardia/Ala   -> 2, 3
Ala           -> 3, 4
Ala/Centro    -> 4, 5
Centro        -> 5
```

Un giocatore è cliccabile solo se almeno uno slot del suo rank è ancora
libero, e cliccandolo si illuminano solo gli slot legali. Questo impedisce
le assurdità del vecchio schema "3 posti mobili Guardia/Ala" — un Centro non
può più finire nello slot Guardia.

### Un giocatore, una volta sola

Un giocatore che ha cambiato squadra compare nelle rose di più carte. Una
volta schierato, la sua riga diventa non selezionabile nelle carte
successive, con l'etichetta "Già nel tuo quintetto" al posto del ruolo
(controllo per `player_id`, in `renderRound()`).

## Modalità di gioco

Scelte in home con 3 tile (stile 82-0, che ha Classic/Hoop IQ/1v1 —
qui non c'è multiplayer, quindi solo le prime due idee più una terza
nostra), tutte sullo stesso motore (`startDraft(mode, decades)` in
`app.js`):

- **Classic**: tutte le decadi, statistiche in chiaro nel draft — il
  gioco di sempre.
- **Scegli decade**: come Classic ma solo sulle decadi selezionate
  (minimo 2, schermata `#screen-decades` prima del draft, checkbox
  sempre pulite alla riapertura — non si accumulano scelte precedenti).
  `CEILING`/`MID`/`K` si ricalcolano sul sottoinsieme
  (`recomputeCurve(pool, ...)`, `pool` non è più sempre
  `ALL_TEAM_SEASONS`) — essendo `MID_FRACTION`/`PERFECTION_BAND` frazioni
  del tetto, la curva è proporzionalmente la stessa qualunque sia la
  dimensione del pool. **Verificate dal vivo tutte le 11 combinazioni
  possibili** (le 6 coppie, le 4 triple, tutte e 4 insieme — non solo
  qualcuna a campione): squadre disponibili sempre fra 21 e 30 (mai
  sotto le 5 minime per un draft), curva sempre valida, 0 errori su una
  partita completa per ciascuna.
- **Blind**: come Classic ma senza statistiche nel draft (`blindMode`) e
  giocatori ordinati per cognome invece che per PPG — l'unico indizio è
  nome e ruolo, la valutazione del quintetto a fine partita resta
  invariata (mostra tutto, solo la fase di scelta è "alla cieca").

A fine partita, 2 bottoni distinti (non uno solo che torna sempre alla
scelta modalità): **Rigioca** ripete subito la stessa modalità/decadi
(`lastMode`/`lastDecades`, salvate da `startDraft()`), **Cambia
modalità** torna alla home con le 3 tile.

## Fonte dati e vincoli

- Fonte: API JSON pubbliche di legabasket.it (non documentate, scoperte
  ispezionando il traffico di rete del sito — vedi `scripts/`)
- Uso consentito per scopo personale/non commerciale (Termini e Condizioni
  legabasket.it) — questo è un progetto hobbistico
- **Politica di scraping rispettosa** (da mantenere in ogni script nuovo):
  una richiesta alla volta, **mai in parallelo**, pausa di 1 secondo fra le
  richieste, un solo user-agent dichiarato e non rotante con email di
  contatto, cache su disco in `data/raw_cache/` per non richiedere due volte
  la stessa cosa
- **Non usare Basketball-Reference.com**: i loro ToS vietano scraping e la
  costruzione di strumenti con i loro dati
- I dati legabasket.it non sono "certificati" (dichiarazione loro stessi):
  possibili piccole imprecisioni, accettabile per un gioco

Attenzione a un tranello dell'API: il parametro `year` è l'anno di **inizio**
stagione (`year=2025` → stagione 2025-26).

### Limite storico verificato

L'API espone squadre e rose fino al 1975, ma **non esiste alcuna statistica
individuale prima della stagione 1987-88** (verificato su due club, con un
confine netto fra 1986 e 1987). Questo esclude gli anni 60/70/primi 80 —
si può giocare solo dagli anni 90 in poi. La copertura dei ruoli negli anni
90 è ~55-70% nelle prime stagioni e 100% dal 1997-98 (media 81%).

## Scope dati attuale

Il dataset serve **solo carte-decade** (`decade`, `year_range`,
`seasons_included`): tutte le stagioni disponibili di una squadra in una
decade, aggregate con media pesata — il modello giusto, quello di 82-0.

Il modello originale a stagione singola (`year`, anni campione
2005/2010/2015/2020/2025 — 38 carte) è stato usato come prototipo nella
prima parte del progetto e poi **rimosso** dal dataset spedito
(`data/dataset.json` e `docs/data/dataset.json`): lo script che le
generava (`scripts/scrape_dataset.py`) resta nel repo per riferimento
ma non è più usato per popolare il gioco. Il frontend gestisce ancora
genericamente `season.year ?? season.decade` (codice invariato, solo
vestigiale ora che `year` non compare più nei dati).

Situazione oggi: **completato**. Tutte le 30 squadre identificate dalla
ricerca di copertura hanno almeno una carta-decade (Bologna, Milano,
Varese, Pesaro a 4/4; Cantù, Roma, Treviso, Reggio Emilia a 3/4; le
altre 22 a 1/4 o 2/4, a seconda di quante stagioni hanno effettivamente
giocato in Serie A in ciascuna decade). Le squadre nuove (senza storia
di carte-stagione, la maggioranza) sono state aggiunte come stub vuoto
in `data/dataset.json` prima di lanciare lo script decade.

Stato dettagliato, copertura per decade di ogni squadra e cronologia
dei batch: `data/decade_coverage_research.md`.

Le 2 forzature TEMP in `drawFive()` (Milano+Bologna sempre nel draw,
usate per le prove utente mentre il roster si popolava) sono state
rimosse.

**Debito noto legato al pool**: `drawFive()` pesca da un unico elenco
piatto di tutte le carte (`ALL_TEAM_SEASONS`), senza pesare per
squadra. Bologna/Milano/Varese/Pesaro (4 carte-decade ciascuna) hanno
quindi 4 volte più probabilità di uscire rispetto a una squadra con 1
sola carta (la maggioranza, ora che il roster è completo). Non
risolto: andrebbe cambiato a pesca a due passaggi (prima la squadra,
poi la carta al suo interno) per dare a ogni squadra pari probabilità.

### Aggregazione per decade

Come in 82-0, la carta rappresenta la squadra *in quella decade*, non una
singola annata. Per ogni statistica:

```
media_decade = Σ(stat_stagione × partite_stagione) / Σ(partite_stagione)
```

Media **pesata per partite giocate**, non media semplice delle medie di
stagione. Un giocatore è eleggibile se ha giocato **almeno 10 partite in
totale nella decade con quella squadra** (non 10 in una singola stagione).

Effetto collaterale da tenere a mente: le medie di decade smussano i picchi
(l'annata eccezionale si annacqua su 10 anni), quindi la distribuzione dei
rating è diversa da quella su cui sono tarati `MID` e `K`.

### Decadi e nomi delle squadre

Decadi previste: **anni '90, 2000, 2010, 2020** (quest'ultima parziale,
2020-2025, solo 6 stagioni possibili). Criterio di ammissione di una
squadra a una decade: almeno 5 stagioni in Serie A in quella decade, **3
per gli anni 2020** (soglia ridotta perché la decade è ancora a metà —
`MIN_SEASONS_PER_DECADE` / `MIN_SEASONS_DECADE_IN_CORSO` in
`scrape_decade_sample.py`). Sotto soglia la carta viene scartata invece
di essere generata comunque sottile.

Convenzione sui nomi: le squadre si chiamano **col solo nome della città**,
tranne dove la città ha avuto due club distinti in Serie A — Milano (Olimpia
vs Milano 1958), Bologna (Virtus vs Fortitudo), Roma (Virtus/Banco vs Stella
Azzurra). Treviso, Napoli e Livorno sono trattate come identità continue
nonostante fallimenti e rifondazioni.

**UI**: il frontend non mostra il nome completo da nessuna parte (stile
82-0) — solo la sigla a 3 lettere (`TEAM_ABBR` in `app.js`, definita
insieme all'utente) e la decade in formato compatto (`DECADE_LABELS`:
`anni '90`→`'90s`, `anni 2000`→`'00s`, `anni 2010`→`'10s`, `anni
2020`→`'20s`). Le sigle a rischio collisione, risolte esplicitamente:
Bologna (VBO Virtus / FBO Fortitudo), Reggio (REG Emilia / RCA
Calabria), il gruppo Treviso/Trieste/Trento (TVS/TRI/TNT).

## Ruoli

legabasket classifica i giocatori in 4 categorie core (Playmaker, Guardia,
Ala, Centro) più i tag ibridi Play/Guardia, Guardia/Ala, Ala/Centro. Non
esiste una 5a categoria pulita tipo "power forward": è il sistema a rank
sopra a coprire i 5 slot, dando ad "Ala" i rank 3 e 4.

Ordine di risoluzione del ruolo:
1. ruolo nella rosa di quella stagione (`roster`) — 840 su 865 eleggibili
2. ruolo "di carriera" del giocatore (`fallback_career`)
3. override manuale trovato via ricerca web (`wikipedia_lookup`) —
   `role_overrides_by_name` in `scrape_decade_sample.py`, con la fonte
   annotata in un commento accanto a ogni nome
4. stima grezza da altezza (`estimated_height`)

**Regola ferma: il ruolo non si inventa mai.** Se non c'è nessuna fonte e
manca anche l'altezza, il giocatore viene marcato `eligible: false` — meglio
un giocatore in meno che uno mostrato come selezionabile con un ruolo
sbagliato. Lo script stampa a fine run l'elenco "SENZA RUOLO" da risolvere
a mano.

Ogni giocatore porta un campo `role_source` che dice quale livello è stato
usato.

### Ruoli estesi per altezza

Un giocatore che ha cambiato squadra spesso trova squadre con tante "Ali"
ma senza nessun "Ala/Centro": impossibile mettere in campo un Centro
decente se pesca solo carte con quel profilo, anche con giocatori alti
quanto un centro vero. Un giocatore di ruolo **puro** (non già ibrido)
alto abbastanza guadagna anche il rank adiacente superiore, come se
legabasket stesso gli avesse dato un tag ibrido. **Massimo 2 rank
adiacenti**, come ogni altro ruolo/ibrido nel gioco — mai 3: "Ala" parte
già da 2 rank (AP+AG), quindi la sua estensione a Centro non si
*aggiunge* (diventerebbe AP/AG/C, mai visto altrove) ma *sposta* la
coppia verso l'alto, perdendo AP — un'Ala estesa a Centro diventa
indistinguibile da un'Ala/Centro ufficiale (AG/C), esattamente come ci
si aspetterebbe da un giocatore che a quell'altezza è più "ala grande"
che "ala piccola". Playmaker e Guardia (base di 1 solo rank) restano un
semplice allargamento a 2, non serve spostare nulla. **Non è un'opzione**:
è così che gira il gioco spedito, non c'è un toggle in home — la logica
"as is" (senza estensione) resta comunque richiamabile in codice
(`ranksFor(player, false)`), non è stata cancellata, semplicemente non è
quello che gira davvero.

```
Playmaker (rank 1) + altezza >= 192cm  -> anche Guardia (rank 2)
Guardia   (rank 2) + altezza >= 196cm  -> anche Ala (rank 3)
Ala       (rank 3,4) + altezza >= 204cm -> anche Centro (rank 5)
```

(`HEIGHT_RANK_EXTENSION` in `app.js`, funzione `ranksFor(player, extendByHeight)`
usata al posto dell'accesso diretto a `ROLE_RANKS` ovunque serva la legalità.)

Soglie scelte insieme sui percentili di altezza reali del dataset, non a
occhio, con un vincolo esplicito dell'utente: Playmaker→Guardia doveva
restare la transizione più rara, non la più comune (con le mediane dei
tag ibridi corrispondenti — 191/197/206 — usciva l'ordine opposto,
22%/11%/16%). Alla fine, con 192/196/204: **17% / 26% / 29%** dei
giocatori di ruolo puro guadagnano il rank extra rispettivamente — nota
che Ala→Centro (204cm) supera Guardia→Ala: sceso da 205 (dove l'ordine
sarebbe rimasto "in mezzo", 21%) a 204 di proposito, accettando lo
scambio.

`CEILING`/`MID`/`K` si calcolano (`recomputeCurve()`, chiamata da
`loadData()`) sulle regole estese — con questo dataset il tetto non
cambia rispetto a "as is" (i giocatori migliori per ogni rank hanno già
un tag ibrido ufficiale legabasket, l'estensione non li supera), ma il
calcolo resta parametrico in generale: se in futuro un ruolo puro esteso
avesse il rating più alto per un rank, il tetto andrebbe aggiornato di
conseguenza.

**UI**: l'interfaccia non mostra mai il ruolo/tag completo di legabasket
per esteso (es. "Ala/Centro") — solo le sigle **PM/G/AP/AG/C** di
**tutti** i rank per cui il giocatore è eleggibile in quel momento (tag
ibrido ufficiale e/o estensione per altezza), in ordine crescente,
separate da "/" (stesso separatore dei tag ibridi ufficiali):

```
Playmaker puro                    -> PM
Playmaker esteso (o Play/Guardia) -> PM/G
Guardia pura                      -> G
Guardia estesa (o Guardia/Ala)    -> G/AP
Ala normale (copre già AP e AG)   -> AP/AG
Ala estesa a Centro               -> AG/C  (perde AP, non si accumula)
Ala/Centro (ufficiale)            -> AG/C  (identico all'estensione)
Centro puro                       -> C
```

Un giocatore con un solo rank mostra una sola sigla; con più rank le
mostra tutte insieme — mai una sigla sola per un giocatore multi-ruolo,
mai un'etichetta col nome completo.

## Motore di calcolo

Rating giocatore = `rating_lega` (indice ufficiale legabasket, già
aggrega punti/rimbalzi/assist/ecc. in un numero solo — non abbiamo
inventato una formula di rating nostra).

```
team_rating = somma dei rating_lega dei 5 giocatori scelti
```

**Curva a due tratti** (non più una sigmoide singola): sopra una soglia
il risultato è sempre 30-0, sotto è una sigmoide calibrata.

```
CEILING              = miglior rating_lega per ciascuno dei 5 rank, sommato
                        (calcolato a runtime da computeCeiling() dopo il
                        caricamento del dataset — vedi sotto il perché)
PERFECTION_THRESHOLD = CEILING * PERFECTION_BAND        (PERFECTION_BAND = 0.97)
wins_raw = 30                                            se team_rating >= PERFECTION_THRESHOLD
wins_raw = 30 / (1 + e^(-K * (team_rating - MID)))       altrimenti
```

- `MID = CEILING * MID_FRACTION` (`MID_FRACTION = 0.55`): rating che vale
  15/30 vittorie. **Non** è più ancorato al "giocatore a caso per ruolo"
  (rating mediano, ~43 sul dataset attuale): a quel livello la sigmoide
  risultava già quasi satura per una selezione semplicemente attenta ai
  rating visibili (non ottimale, senza pianificare i turni), che da sola
  raggiunge in media ~104 di rating (~68% del tetto) — quindi quasi
  sempre 26+ vittorie anche senza cercare le squadre migliori, il
  problema segnalato dall'utente dopo il primo retune. Un primo giro a
  `0.65` si è rivelato **troppo severo nella direzione opposta**: quintetti
  onesti (giocatori sui 15-24 punti a partita, rating 80-107) delle prime
  partite reali giocate a roster completo finivano comunque in zona
  retrocessione (5-25, 12-18). Ritarato a `0.55` dopo aver confrontato
  quegli stessi rating reali sotto diverse `MID_FRACTION` — verificato
  simulando 3000 draft con strategia "prendo sempre il rating più alto
  visibile": mediana 24, p10 19, **9 volte su 3000 in tier S** (raro ma
  non nullo, contro le 26+ vittorie quasi garantite di prima del primo
  retune)
- `PERFECTION_BAND = 0.93`: sopra il 93% del tetto teorico, sempre
  30-0 — un pugno di quintetti vicinissimi al meglio possibile, non un
  plateau che capita per caso vicino al tetto (comportamento naturale di
  qualunque sigmoide, se non lo si rende esplicito). Era `0.97`: troppo
  raro per essere divertente. Analizzando il vero massimo raggiungibile
  nel dataset (assegnazione ottima delle carte pescate, non solo la
  formula) il tier S usciva solo ~1 partita su 326 giocando bene, e il
  30-0 esatto **mai** su 100.000 draw simulati anche giocando da
  onniscente (il quintetto migliore in assoluto — Del Negro/TVS,
  Young/RCA, Komazec/VAR, Daye/PES, Gay/PIS, tutti anni '90 — è al 99.3%
  del tetto ma sotto la vecchia soglia). A `0.93` il tier S capita ~1
  partita su 78 giocando bene, il 30-0 esatto resta un unicorno
  (~0.002%, richiede quasi la combinazione di carte perfetta)
- `K`: calcolato da `computeK()` perché la sigmoide valga ~29.5 appena
  sotto `PERFECTION_THRESHOLD`, così il passaggio alla zona di perfezione
  resta morbido invece che un gradino

**`CEILING` e `MID` sono calcolati a runtime dal dataset caricato, non
scritti a mano.** `CEILING` prima era una costante fissa (127.5, poi
151.6) che si "sfasava" ogni volta che si aggiungevano squadre senza
essere ricalcolata — è successo davvero: da 11 a 30 squadre il tetto
vero è salito di ~19% ma `K`/`MID` sono rimasti quelli di prima,
rendendo il gioco via via più facile senza che nessuno se ne
accorgesse finché non è diventato troppo evidente. Calcolandoli dal
dataset invece che scrivendoli a mano, il problema non si ripresenta
più da solo quando il roster cresce ancora.

**Penalità sbilanciamento**: si sommano 5 categorie base (punti, rimbalzi,
assist, palle recuperate, stoppate) sui 5 giocatori, si confrontano con la
media di lega (`REF_TEAM` in `app.js`). A differenza di prima (guardava
solo la categoria più debole), ora si somma lo scarto sotto soglia di
**tutte** le categorie che ci finiscono sotto, pesate (`PEN_WEIGHTS`):
punti/rimbalzi/assist/recuperate al 100%, **stoppate al 25%** — sono
concentrate quasi solo nei centri (il 30% dei giocatori eleggibili ne fa
praticamente zero, contro <2% delle altre categorie: pesarle uguale
penalizzava quintetti forti solo perché senza un centro-stoppatore, non
perché davvero sbilanciati).

```
penalty = PEN_SCALE * Σ PEN_WEIGHTS[categoria] * max(0, PEN_THRESH - ratio[categoria])
```

`PEN_THRESH = 0.5` (soglia) e `PEN_SCALE = 15` invariati.

Tutte le costanti vivono in `docs/app.js` (frontend, la copia che conta per
il gioco pubblicato).

## Come rigenerare il dataset

Carte-stagione (modello originale):

```bash
cd scripts
python3 scrape_dataset.py
```

Carte-decade (modello attuale, da preferire per le squadre nuove):

```bash
cd scripts
python3 scrape_decade_sample.py
```

Il secondo riusa rete, cache e parsing del primo, e lavora sulle squadre
elencate in `TEAMS` in cima al file (con i loro `club_id` e gli eventuali
override di ruolo). È **idempotente**: se una carta-decade per quella
squadra esiste già, la sostituisce invece di appenderla — una versione
precedente non lo era e ha duplicato i dati.

Dopo aver rigenerato `data/dataset.json`, **copiarlo a mano** in
`docs/data/dataset.json` (il frontend legge da lì):

```bash
cp data/dataset.json docs/data/dataset.json
```

`scripts/discover_clubs.py` è lo script (già eseguito, risultato in
`data/club_discovery.json`) usato per mappare i nomi storici delle
squadre (cambiano sponsor/nome quasi ogni stagione) al loro `club_id`
stabile su legabasket.it — serve solo se si aggiungono nuove squadre.

### Schema dataset

```jsonc
{
  "generated_at": "...", "min_presences_threshold": 10,
  "teams": [{
    "key": "virtus_bologna", "display_name": "Virtus Bologna",
    "seasons": [
      // carta-stagione
      { "year": 2015, "team_id": ..., "team_name_at_time": "...",
        "lineup_complete": true, "players": [...] },
      // carta-decade
      { "decade": "anni '90", "year_range": [1990, 1999],
        "seasons_included": [1990, 1991, ...],
        "team_name_at_time": "Virtus Bologna",
        "lineup_complete": true, "players": [...] }
    ]
  }]
}
```

Un giocatore ha `player_id`, `name`, `surname`, `height`, `role`,
`role_source`, `games_total`, `eligible`, `rating_lega`, `rating_oer` e le
medie (`points_avg`, `def_rebound_avg`, `assists_avg`, percentuali di tiro,
ecc.). Solo statistiche di **Regular Season**: l'API mescola playoff e coppe
di default, va filtrato esplicitamente per `championship_name`.

## Decisioni prese finora (per chi riprende il progetto)

- Niente foto/loghi: solo un colore identificativo per squadra, ma il
  colore stesso è **verificato**: per ognuna delle 30 squadre è stato
  ricercato via web il vero colore sociale storico del club (Wikipedia
  IT, siti ufficiali, stampa sportiva — vedi `TEAM_COLORS` in `app.js`
  per il colore e la fonte/confidenza di ciascuna). Il vincolo reale
  è che molti club condividono lo stesso colore sociale (5 bianconero,
  7 biancorosso, 9 biancoblu...), quindi dentro ogni famiglia di
  colore la tonalità esatta (chiarezza/saturazione) è stata scelta
  per restare distinguibile dalle altre squadre della stessa famiglia,
  verificato con uno script di distanza percettiva (spazio LAB) su
  tutte le 435 coppie possibili: 430/435 hanno distanza confortevole
  (>16), le uniche 5 coppie più vicine (12-13, comunque distinguibili)
  sono tutte dentro il cluster dei 5 bianconero (Virtus Bologna, Trento,
  Udine, Caserta, Tortona), un limite intrinseco quando 5 squadre reali
  condividono lo stesso colore sociale e non si vuole "inventare" un
  colore diverso da quello vero. Confidenza media/bassa (fonti meno
  solide o colori sociali cambiati nel tempo) per: Varese (doppia
  identità: biancorosso originario vs gialloblù dell'era Ignis, scelto
  il secondo), Trieste, Brescia, Pistoia, Avellino, Cremona, Livorno,
  Roseto.
- Giocatori ordinati per PPG (punti a partita), non per rating, nelle
  liste di scelta
- Draft sequenziale con validazione live: la UI blocca a monte le scelte
  illegali invece di segnalare l'errore dopo
- Non serve un controllo di "risolvibilità" incrociato fra le 5 carte: ogni
  carta garantisce già di per sé di poter coprire tutti e 5 gli slot (campo
  `lineup_complete`, verificato in fase di generazione)
- Mobile: pannello del quintetto sticky in fondo allo schermo e righe
  risultato compatte su una sola riga. Nota per chi tocca il CSS: le
  `@media` query vanno messe **dopo** le regole base che sovrascrivono, a
  parità di specificità — altrimenti vince la regola base e la correzione
  mobile non fa niente (errore commesso due volte)

## Debito noto

- `check_lineup_complete()` in `scrape_dataset.py` usa ancora il vecchio
  `ROLE_ALIASES` ("1 PM + 1 C + 3 mobili"), non i rank del frontend: oggi
  nessuna carta è incoerente (tutte e 46 coprono i 5 rank), ma è un
  controllo che non controlla più la cosa giusta
- `http_get_json()` cattura gli `HTTPError` e **cacha `{}`**: una chiamata
  fallita diventa silenziosamente "giocatore senza statistiche". È successo
  3 volte con dei 500 transitori; per ora l'unico rimedio è cancellare il
  file di cache specifico e rilanciare. Servirebbe un contatore di
  fallimenti con riepilogo a fine run, e non cachare gli errori
- **Nessun test versionato**: gli script Playwright usati per le verifiche
  (composizione quintetto, legalità rank, doppioni, overflow mobile) vivono
  in `/tmp` e spariscono

## Struttura repo

```
docs/           sito pubblicato (GitHub Pages serve da qui)
  index.html
  style.css
  app.js
  data/dataset.json         copia del dataset usata dal frontend
scripts/
  discover_clubs.py         mappatura squadra -> club_id nel tempo
  scrape_dataset.py         scraping carte-stagione (prototipo, non più usato per il dataset spedito)
  scrape_decade_sample.py   carte-decade aggregate (idempotente) - unica fonte del dataset spedito
data/
  dataset.json              dataset generato (sorgente di verità)
  club_discovery.json       output di discover_clubs.py
  raw_cache/                cache risposte API grezze (non versionata)
tests/
  game_smoke_test.js        test di fumo Playwright (partita completa, no doppioni, legalità ruoli, 0 errori console)
```

## Come lanciare i test

```bash
python3 -m http.server 8899 --directory docs &
node tests/game_smoke_test.js         # 20 partite di default
node tests/game_smoke_test.js 60      # numero di partite a scelta
```

## Stato e backlog

**1.0 raggiunta**, mergiata su `main` (sito pubblico allineato:
https://damneskjold.github.io/82-0-lega-a/). Tutte le 30 squadre della
ricerca con carte-decade, motore di calcolo ritarato e verificato più
volte (curva a due tratti, penalità multi-categoria, ruoli estesi per
altezza), 3 modalità di gioco stile 82-0 (Classic/Scegli
decade/Blind), UI rifinita (draft e risultato a due colonne su
desktop, home a tile con emoji, pannello quintetto essenziale, logo
cliccabile con conferma), i glitch mobile noti risolti (colonna
statistiche tagliata, nome troncato con ellissi, riga nascosta dietro
il pannello), gestione errore sul caricamento dati. Storico completo
dei retune e delle verifiche nelle sezioni sopra e nei messaggi di
commit.

**Backlog 1.1** (in quest'ordine):

1. **Check dati**: audit di giocatori, ruoli e squadre nel dataset —
   non ancora iniziato
2. ~~**Check colori**~~ **fatto**: i 30 colori squadra (`TEAM_COLORS`
   in `app.js`) sono ora basati sul vero colore sociale storico di
   ogni club (ricerca web, fonti e confidenza per squadra in
   "Decisioni prese finora" sopra), con tonalità variata dentro la
   stessa famiglia di colore per restare distinguibili — verificato
   con distanza percettiva LAB su tutte le coppie
3. **Check visivo sistematico**: script Playwright che gioca N partite
   facendo uno screenshot ad ogni schermata chiave (draft, risultato,
   mobile/desktop), per scansione rapida di glitch grafici — oggi le
   verifiche visive restano manuali/ad-hoc. I glitch già trovati a
   mano sono stati risolti nel frattempo (vedi sopra), ma non
   sostituiscono un check sistematico per trovarne altri

**In standby** (scelta esplicita dell'utente, non un fix da fare
comunque): pesca a due passaggi in `drawFive()` — verificato che il
problema è reale (simulato 200.000 draw, Virtus Bologna/4 carte
compare nel 47.5% delle partite contro il 16.67% atteso se equo,
Udine/1 carta solo nel 7.3%), potrebbe diventare una personalizzazione
facoltativa in futuro.
