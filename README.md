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
ritorno a 16 squadre, non 82 come in NBA), con un tier finale (da F "ultima
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

### Filtro ruolo nella lista di pescaggio

Le carte-decade arrivano ad avere 79 giocatori (mediana 47): con un solo
slot rimasto aperto, il primo giocatore utile poteva essere anche alla
15ª riga (per il Centro, il caso peggiore, in 10 carte su 62), tutte da
scorrere in mezzo a righe grigie. Sopra la lista, 4 chip — **PM · G · A ·
C** — restringono la lista a chi copre quel ruolo (`ROLE_FILTERS`,
`matchesRoleFilter()` in `app.js`). Facoltativo e reversibile: parte
sempre su **"Tutti"** ad ogni nuova carta (`roleFilter` si azzera in
`startDraft()` e in `assignSelectedTo()`, mai dentro `renderRound()` —
altrimenti si azzererebbe anche selezionando una semplice riga), quindi
la vista di sempre resta un tocco di distanza; selezionare una riga non
tocca il filtro attivo.

**Ala Piccola e Ala Grande sono un chip solo** ("A"), non due — scelta
presa dopo aver misurato il costo della separazione, non a occhio: il
ruolo base "Ala" copre già entrambe di suo, quindi separarle isolava due
gruppi molto sovrapposti. Simulando 2000 partite (pick per rating più
alto disponibile), un filtro "A" unico porta la lista media da 50 a 23
giocatori; separarlo in AP/AG scenderebbe fino a 17 — 6 in meno, contro
un pulsante in più e, nel 36.6% dei round (quelli con aperta *una sola*
fra AP e AG), un ~25% di righe residue ancora illegali nella vista
unificata. Compromesso accettato: il guadagno grosso (50→23) arriva già
con 4 chip, il resto (23→17) costava più di quanto valesse.

Niente numeri sui chip né conteggi sopra la lista — stessa scelta di
82-0 (i suoi tab All/G/F/C non hanno numeri, il conteggio compare una
volta sola *dopo* aver scelto il filtro, non su ogni pulsante prima):
coi ruoli ibridi che contano in più chip un numero per pulsante avrebbe
richiesto una nota a parte per spiegare perché "non torna".

Su mobile i chip hanno `min-height`/`min-width` di **36px**: col solo
padding restavano 26px di altezza (e 35px di larghezza per "A" e "C",
una lettera sola), sotto il minimo che `visual_check.js` segnala per un
bersaglio da toccare — servono entrambe le dimensioni perché il check
guarda entrambe. Su desktop restano compatti: il puntatore non ha
bisogno di 36px.

Le 5 colonne di statistiche (P R A S B) hanno **divisori verticali
sobri** fra loro (stesso `--border` già usato per le righe, riusato in
verticale) e i numeri sono **centrati** nella propria colonna invece che
allineati a destra — CSS puro (`.player-stats .stat-col`), nessuna
modifica alla struttura dati. Gli stessi divisori sono anche nella
schermata risultato (`.who-stats`) e **nella card PNG condivisa**: quella
è disegnata su `<canvas>`, quindi il CSS non la tocca e le linee vanno
tracciate a mano in `renderShareCard()` (stesso `C.border` dei separatori
orizzontali già presenti, alte quanto la coppia valore+etichetta, non
quanto l'intera riga). Se ne era accorta una passata a mano: gli script
verificano che la card sia leggibile e contrastata, non che sia coerente
con la schermata che riproduce — ed è l'unica cosa del gioco che finisce
sotto gli occhi di altri. Prototipato con mockup interattivi
(dati reali della carta, non lorem) prima di scrivere il codice vero,
comprese due correzioni trovate lì: le colonne erano troppo strette per
il padding aggiunto e il divisore tagliava dentro le cifre, e il colore
decorativo di uno slot si perdeva sullo sfondo scuro.

### Quintetto a quadrati

Il pannello "Quintetto" durante il draft mostrava gli slot riempiti con
una barretta colorata a sinistra su sfondo scuro, diversa dallo stile
usato nella schermata finale (avatar quadrati colorati con iniziali). Ora
usa lo stesso linguaggio ovunque: ogni slot ha un **quadratino** (`.slot-icon`,
38px desktop / 30px mobile) fin da vuoto — solo contorno, con dentro la
sigla del ruolo ("C", "PM"...) — che diventa colorato con le iniziali del
giocatore una volta scelto, con lo stesso calcolo di contrasto
(`inkFor()`) già usato per gli avatar finali. Riempire uno slot cambia
solo il colore del quadrato, mai la sua forma. Lo stato "legale" (slot
apribile subito) resta un contorno arancione sullo stesso quadrato,
invece di colorare l'intera riga. Prototipato con un mockup a dati reali
prima di scrivere il codice vero, approvato senza revisioni.

**Su mobile il quadrato vuoto è vuoto davvero**: lì l'etichetta sotto è
già la sigla (`.lbl-short`), quindi tenerla anche dentro il quadrato la
scriveva due volte ("PM" sopra "PM") — su desktop non si nota perché
l'etichetta è la parola intera ("PLAYMAKER") e la sigla dentro il
quadrato la completa. Si nasconde la sigla (`.icon-role`) e non
l'etichetta perché l'etichetta serve anche a slot pieno, dove nel
quadrato ci sono le iniziali del giocatore: così la barra in fondo allo
schermo non cambia altezza quando uno slot si riempie (verificato: 72px
sia vuota sia con slot pieni), coerente col principio che riempire uno
slot cambia solo il colore, mai la forma.

Il cambiamento ha scoperto un buco nello scanner di contrasto di
`tests/visual_check.js`: controllava solo l'elemento che porta
l'attributo `style="--team-color:..."`, ma qui il colore vero lo applica
il CSS a un **figlio** (`.slot-box.filled .slot-icon`), non
all'elemento con lo style inline — un "0 problemi" sarebbe stato un falso
negativo. Corretto per controllare anche i discendenti, ma tenendo solo
quelli il cui **sfondo effettivo** risolve davvero al valore di
`--team-color` (non basta ereditare la variabile: i bottoni del filtro
ruolo, annidati nella stessa card per motivi di markup, la ereditano
anch'essi senza usarla, e uno span di sole iniziali senza sfondo proprio,
tipo `.avatar-initials`, eredita solo il colore testo — controllarlo da
solo contro uno sfondo trasparente sarebbe un falso positivo, il
contrasto vero si vede già sul genitore che ha davvero sfondo *e* testo).
Verificato con un nuovo caso in `tests/visual_check_selftest.js` che
riproduce esattamente il pattern genitore/figlio e prova che lo scanner
corretto lo intercetta.

### Colonne della schermata risultato

Gli stessi divisori verticali della lista di pescaggio valgono anche per
le 5 colonne (P R A S B) della riga di ogni giocatore nel quintetto
finale, con i numeri **centrati**: prima quella riga usava ancora lo
spaziamento a `gap`, quindi le due schermate mostravano gli stessi dati
in due modi diversi. Stesso schema di lì (il padding assorbe il
divisore, `border-left` sulle colonne diverse dalla prima).

Sotto il quintetto, la riga dei **totali di squadra** (Punti, Rimbalzi,
Assist, Recuperate, Stoppate) aveva un difetto più sottile, segnalato
guardando due partite diverse a confronto: usava
`justify-content: space-between` con ogni box largo quanto il proprio
contenuto, quindi un valore più largo — i rimbalzi quando in quintetto
c'è un centro vero, es. "28.4" invece di "9.1" — spostava **tutta la
riga**, e le etichette non stavano mai nello stesso punto da una partita
all'altra. Ora ogni box è `flex: 1`: larghezza uguale sempre,
indipendente dai numeri che escono. Verificato su 6 partite di fila che
le posizioni x dei 5 box sono identiche al pixel. La larghezza fissa ha
poi fatto emergere il problema opposto sui telefoni più stretti —
l'etichetta più lunga ("Recuperate") non ci stava più in una riga sola e
usciva dal box toccando quella dopo: risolto con `overflow-wrap` (va a
capo invece di sovrapporsi, stessa scelta già presa per nomi e ruoli) e
un font leggermente più piccolo sotto i 400px.

### Il quintetto visibile senza scroll (solo mobile)

Segnalato con uno screenshot reale (iPhone 17, non uno schermo piccolo):
della schermata risultato si vedevano solo 2 giocatori su 5 senza
scrollare. Misurato: il contenuto è alto **1180px** contro una finestra
di **852px** anche nel caso migliore (browser senza barre) — 2 righe
piene e una terza tagliata, esattamente come nello screenshot. Confronto
con 82-0 (stesso telefono, stesso utente): loro il quintetto lo mostrano
subito dopo il record, coi bottoni (Share/Build Another) **in fondo**;
da noi i bottoni (Condividi/Rigioca/Cambia modalità) stavano **sopra**
il quintetto, e l'header pieno (logo + sottotitolo) tornava a piena
misura proprio nella schermata dove serviva più spazio.

**Esplicitamente richiesto di non toccare il desktop**, che va bene
com'è — tutto qui sotto vale solo sotto gli 860px:

- **Riordino via CSS `order`, non l'HTML**: `.result-left`/
  `.result-right` diventano `display: contents` solo nella media query,
  il che libera i loro figli (`.result-hero`, `.result-actions`,
  `.result-lineup`, `.result-breakdown`, `.result-note`) a stare tutti
  allo stesso livello nell'unica colonna della griglia — a quel punto si
  riordinano con `order` senza spostare una riga nell'HTML. Il desktop,
  che sta fuori da questa media query, resta l'identica griglia a due
  colonne di sempre (verificato pixel per pixel: stesso screenshot prima
  e dopo). Nuovo ordine mobile: record → quintetto → totali → nota →
  bottoni, stesso schema di 82-0.
- **Header compatto riusato, non reinventato**: esisteva già una classe
  (`header-compact`, prima si chiamava `draft-active`) che comprime
  l'header durante il draft — ma vale su *tutte* le larghezze, draft
  compreso il desktop, dov'è comportamento vecchio e voluto. Usarla
  anche nel risultato avrebbe compattato l'header pure sul desktop del
  risultato, che non doveva cambiare: serviva una classe **diversa**
  (`result-compact`), con le stesse identiche regole ma scritte *dentro*
  la media query sotto gli 860px, così il desktop non la vede mai. Non
  è stato un tentativo riuscito al primo colpo: il primo giro riusava
  `header-compact` anche nel risultato senza accorgersi che comprimeva
  pure il desktop — trovato solo confrontando lo screenshot prima/dopo,
  non a occhio.
- **Una sola colonna su mobile, mai due** — richiesto esplicitamente:
  82-0 ci riesce con una sola colonna, quindi niente split laterale per
  guadagnare spazio in verticale.

Risultato misurato: **da 2 a 4 giocatori interi visibili su 5** sullo
stesso iPhone, zero riga di HTML spostata, zero pixel diverso sul
desktop (confermato da `tests/visual_check.js` su tutti i viewport).
Restano fuori dallo schermo solo il 5° giocatore (parzialmente) e i
totali — comprimere ogni riga giocatore su una riga sola (come fa 82-0)
resta un secondo passo possibile, più invasivo, non fatto qui.

**Secondo giro, dopo il test dal vivo sul telefono vero**: l'utente ha
confermato che si vedevano i 5 giocatori ma non tutto lo schermo, più due
problemi nuovi. Trovati e sistemati tutti e tre:

1. **Spazio vuoto di troppo prima di "Condividi"** — bug reale, non
   sensazione: `display: contents` (introdotto sopra) rende
   `.result-hero`/`.result-lineup`/`.result-breakdown`/`.result-note`
   fratelli diretti nella griglia, quindi il `gap: 20px` di
   `.result-layout` si applica ora fra ognuno di loro — ma ognuno porta
   ANCHE il proprio `margin-bottom: 20px` di prima (pensato per lo
   stacking dentro `.result-left`/`.result-right`): 40px invece di 20px
   ad ogni passaggio. Corretto azzerando quei margin-bottom solo dentro
   la media query (`1123px → 1043px` di contenuto).
2. **"Recuperate" andava a capo a metà** ("RECUPERAT" / "E") nello
   screenshot dell'utente. Verificato che il fix esistente (font più
   piccolo sotto i 400px) funziona in un test pulito identico — quasi
   certamente cache di Safari sulla versione precedente della pagina,
   non un bug vivo (GitHub Pages + cache aggressiva su iOS).
3. **Righe giocatore ancora troppo alte**: trovato che sotto i 400px
   (iPhone compreso) esisteva già una regola — non introdotta in questo
   giro — che manda le statistiche di ogni riga a capo su una riga
   propria, perché numero+etichetta impilati (`.stat-val` sopra
   `.stat-lbl`) sono troppo alti per stare a fianco del nome: ogni riga
   era quindi già **due righe fisiche** (94px misurati, contro i ~56px
   attesi da una riga sola). Causa strutturale: l'etichetta P/R/A/S/B si
   ripeteva sotto ogni numero di ogni riga, invece di comparire una
   volta sola — l'opposto di come fa già la lista di pescaggio (header
   con le sigle una volta, righe di soli numeri). Riusato lo stesso
   schema, ma **solo sotto gli 860px** (`.lineup-stats-header`, con
   `display: none` di base — invisibile su desktop, dove ogni riga tiene
   la propria etichetta come sempre).

   Tre bug trovati costruendo il mockup prima di scrivere il codice
   vero, utili a chi tocca ancora questa zona:
   - `.who-stats { display: flex }` nel CSS base è specificamente
     `.lineup-row .who-stats` (con l'antenato `.lineup-row`) — un header
     fuori da `.lineup-row` non lo eredita, va ridichiarato o le 5 sigle
     si impilano verticalmente invece che in riga.
   - Header e riga slittavano (colonne non allineate) perché la vecchia
     regola usava `min-width` (cresce col contenuto: "18.4" più largo di
     "P") — serve `width` fissa uguale per entrambi (30px, misurato per
     non far andare a capo il caso più largo).
   - Annullare il vecchio "vai a capo sotto i 400px" richiede un
     selettore più specifico (`.result-lineup .lineup-row`, non
     `.lineup-row`), altrimenti la regola originale — scritta più avanti
     nel file — vince per ordine sorgente: stesso identico pattern del
     bug del punto 1, capitato due volte nello stesso giro di lavoro.

   Risultato (stessa pescata, stesso iPhone): **1006px → 934px**,
   bottone "Condividi" da y=926 a y=830. Effetto collaterale minore: a
   320px (iPhone SE 1ª gen, il più stretto testato) i cognomi più lunghi
   ora vanno a capo a metà parola invece che restare su una riga — non
   succede più da 375px in su, quindi non tocca telefoni recenti come
   quello con cui è stato testato.

**Terzo giro**: provato di nuovo dal vivo, confrontando anche con 82-0
(che però è un'app nativa — nessuna barra indirizzi che mangia spazio,
non è un confronto alla pari al 100%). Segnalato che il box del record
restava comunque pesante. Misurato dove andava lo spazio, blocco per
blocco (stessa pescata, stesso iPhone):

| blocco | altezza |
|---|---|
| header | 49px |
| box del record | 183px |
| header colonne + 5 righe | 337px |
| totali squadra | 38px |
| nota (vuota) | 17px |
| bottoni | 93px |
| spaziatura fra i blocchi | 100px (20px × 5) |

Tre correzioni, tutte solo sotto gli 860px:

- **Nota vuota che sparisce del tutto**: quando non c'è "squadra
  sbilanciata" (il caso più comune) l'elemento è vuoto ma teneva
  comunque la sua altezza minima più un gap prima e dopo, per niente.
  `.result-note:empty { display: none; }` — CSS puro, nessun cambio in
  `app.js`: quando il testo c'è, l'elemento smette di essere `:empty` e
  torna visibile da solo. Verificato entrambi gli stati direttamente
  (`display: block` con testo, `none` senza).
- **Spaziatura fra i blocchi ridotta** da 20px a 12px — 20px andava bene
  per il desktop (un solo gap, fra le due colonne), qui sotto ci sono
  5-6 blocchi impilati e si accumulava.
- **Box del record più compatto**: padding da `26px 20px 20px` a
  `16px 16px 14px`, margini di record e sottotitolo ridotti — è il
  secondo blocco più pesante dopo il quintetto.

Le tre regole condividono lo stesso rischio già preso due volte in
questo file: a parità di specificità vince l'ordine nel foglio, non la
media query, e le regole base per `.result-hero`/`.result-record`/
`.result-tier` sono scritte *dopo* questa media query nel file — quindi
tutte e tre le nuove regole hanno `.result-layout` davanti per battere
in specificità, non solo per contare sull'ordine.

Risultato (stessa pescata, stesso iPhone): **934px → 852px** — nel caso
migliore (852px di viewport, zero barre Safari) il contenuto reale
finisce a **745px**, con margine, contro i 1180px di partenza a inizio
sessione. Desktop verificato pixel per pixel ancora identico.

**Quarto giro**: provato di nuovo in Safari (non nel browser interno
dell'app di Claude, che ha una barra in più — controllato prima di
insistere sul codice, per non inseguire un problema che non era nostro)
e ancora mancava un pezzo, i bottoni finali non erano visibili. Ultimo
giro di stretta, solo sotto gli 860px:

- **Margine sopra il box del record**: collassava con quello
  dell'header al più grande dei due (20px, il margine base di
  `.result-layout`) invece che ai 12px già usati per gli altri gap —
  allineato anche questo a 12px.
- **Righe giocatore ancora più basse**: avatar da 36px a 30px (la stessa
  misura già usata per i riquadri dello slot nel quintetto durante il
  draft su mobile — non una taglia nuova) e padding verticale da 10px a
  6px. **63px → 49px per riga**, i bottoni non si toccano (restano al
  loro padding pieno, comodi da premere).

Risultato (stessa pescata, stesso iPhone): il contenuto reale (dove
finiscono i bottoni, non solo il caso migliore teorico) passa da
**745px a 669px**. Verificato anche a 320px (iPhone SE 1ª gen, il più
stretto testato): entra tutto pure lì, cosa che prima richiedeva
comunque scroll. Dai 1180px di partenza a inizio sessione è un **–43%**.
Desktop, ancora una volta, pixel per pixel identico.

**Quinto giro**: provato di nuovo, screenshot reale da Safari — mancava
ancora la riga Rigioca/Cambia modalità, e "Recuperate" si spezzava a
metà su iPhone vero (`RECUPERAT` / `E`) pur avendo passato i test
automatici a schermo stretto. Causa: il browser di sviluppo qui non ha
lo stesso font di iOS reale (San Francisco, dal font-stack
`-apple-system`) — il fallback usato in test rendeva "Recuperate" più
stretto della resa vera, quindi il fix esistente (font più piccolo)
passava i test ma non bastava sul dispositivo reale. Non rilevabile da
qui: serviva lo screenshot reale per scoprirlo.

- **Font dell'etichetta ridotto ulteriormente** (0.52rem → 0.46rem) per
  lasciare un margine anche se il font vero rende più largo, più
  `hyphens: auto` come rete di sicurezza — se dovesse comunque andare a
  capo, si spezza in modo pulito ("Recupe-/rate") invece che a caso
  ("RECUPERAT"/"E").
- **Ultimi gap stretti**: 12px → 8px sia fra i blocchi impilati sia fra
  "Condividi" e la riga Rigioca/Cambia modalità — i bottoni stessi non
  sono stati toccati (restano comodi da premere, sopra la soglia minima
  di 36px già stabilita in questa stessa sezione per i chip del filtro).

Anche qui lo stesso rischio di specificità preso più volte in questo
file: `.result-actions` ha una regola base scritta dopo questa media
query, serviva `.result-layout` davanti per battere in specificità.

Risultato: **669px → 676px** su una pescata (rumore statistico fra
partite diverse — nomi/squadre diversi cambiano leggermente l'altezza,
non un peggioramento: verificato via CSS calcolato che i valori sono
davvero applicati), ma con la riga dei bottoni finalmente tutta visibile
e "Recuperate" su una riga sola, confermato anche a 320px.

**Sesto giro**: ancora uno screenshot reale a mostrare che mancava
l'ultima riga di bottoni, coperta dalla barra di Safari. Segnalato che
Safari nasconde da solo la barra scrollando (avrebbe forse già bastato
nella pratica), ma l'utente ha scelto di stringere ancora via codice
piuttosto che fare affidamento su quello. Un limite dichiarato esplicito
prima di partire: i bottoni non scendono sotto i 36px di tocco comodo,
la stessa soglia già stabilita per i chip del filtro — rispettata anche
stringendo tutto il resto.

- **Box del record**: font del punteggio da `3.4rem` a `3rem` sotto i
  400px, padding da `16px 16px 14px` a `14px 12px 12px`
- **Righe giocatore**: padding verticale da 6px a 5px (ultimo mezzo
  passo, sotto rischia l'illeggibilità)
- **Totali di squadra**: padding-top da 4px a 2px
- **Gap residui**: 8px → 6px ovunque erano rimasti (blocchi impilati,
  margine sopra il record, fra "Condividi" e la riga sotto)

Bottoni verificati esplicitamente dopo il giro: 43px ("Condividi") e
38px (Rigioca/Cambia modalità), entrambi sopra soglia. Risultato:
**676px → 620px**, bottoni tutti visibili con un po' di margine sotto,
confermato anche a 320px. Dai 1180px di partenza a inizio sessione è un
**–47%**. Desktop, ancora una volta, pixel per pixel identico.

**Settimo giro**: quasi al traguardo, ma segnalati due difetti veri dallo
screenshot dell'utente (bottoni ancora tagliati all'ultimo pelo dalla
barra di Safari, e i divisori fra le colonne P/R/A/S/B di ogni
giocatore troppo appiccicati ai numeri a due cifre — es. i rimbalzi di
un centro, "10.1", "16.8").

Il secondo era un vero difetto introdotto in un giro precedente: quando
le colonne sono state rese a **larghezza fissa** (`width`, non
`min-width`) per allineare l'header alle righe, il padding era stato
tolto del tutto (`.who-stats .stat-col { width: 30px; padding: 0; }`) —
il testo arrivava a toccare la linea del divisore, più visibile sui
numeri a due cifre perché più larghi. Corretto senza toccare
l'allineamento: `width: 34px; padding: 0 2px` — l'area di contenuto
resta 30px (stessa di prima, nessun rischio di tornare ad andare a capo
su "18.4"/"29.7"), ma ora c'è margine dal divisore. Un solo cambio,
applicato automaticamente sia all'header sia alle righe perché usano la
stessa regola.

Per il resto, ultimo giro di gap: `.result-layout` e `.result-actions`
da 6px a 4px, box del record da `14px 12px 12px` a `12px 10px 10px`.
Bottoni verificati di nuovo dopo il giro: 43px e 38-54px (il secondo
bottone va a due righe di testo sotto i 320px, ma resta ben sopra la
soglia di 36px). Nessun overflow orizzontale verificato esplicitamente
a 320px, dopo aver allargato le colonne di 4px ciascuna.

Risultato: **620px → 608px**. Dai 1180px di partenza a inizio sessione,
**–48%**. Desktop pixel per pixel ancora identico.

**Ottavo giro**: testato dal vivo, tre cose ancora segnalate — divisori
ancora appiccicati (confermato esplicitamente dall'utente: il problema
era proprio quello, non contrasto né allineamento), le etichette dei
totali ("Recuperate") che continuavano ad andare a capo in modo brutto
su iPhone reale anche dopo il font ridotto e `hyphens: auto` del quinto
giro, e ancora un po' di spazio scrollabile di troppo sotto ai bottoni.

- **Divisori**: area di contenuto delle colonne P/R/A/S/B da 30px a
  31px, padding da 2px a 3px per lato (`width: 34px`→`37px`). Un primo
  tentativo più aggressivo (40px totali) dava un ottimo margine dal
  divisore ma aveva un effetto collaterale non visto subito: a 320px
  (il telefono più stretto testato) spingeva la colonna del nome
  (`.who`, `min-width: 0` per potersi restringere) fino a **0px di
  larghezza** — il nome andava a capo lettera per lettera invece che a
  parola, un bug di flexbox non catturato dal check automatico (non è
  un overflow, solo un pessimo wrap) e trovato solo misurando a
  schermo. Corretto scegliendo una larghezza più moderata **e**
  aggiungendo `min-width: 44px` su `.who` come rete di sicurezza, così
  anche in futuro quella colonna non può più collassare del tutto.
  Margine dal divisore verificato: 6-8px a 320px, 7-11px a 393px, sui
  numeri a due cifre (prima: 0-2px).
- **Etichette totali**: invece di rincorrere ancora il wrapping,
  eliminato il problema alla radice come suggerito dall'utente stesso —
  sotto i 400px "Punti/Rimbalzi/Assist/Recuperate/Stoppate" diventano
  sigle "Pti/Rim/Ast/Rec/Stp" (nuova mappa `CAT_LABELS_SHORT` in
  `app.js`, resa con due `<span>` per etichetta e mostrata/nascosta via
  CSS — stesso pattern già usato per le sigle P/R/A/S/B del quintetto).
  `CAT_LABELS` intera resta invariata, serve ancora per la nota
  "squadra sbilanciata". Font riportato da `0.46rem` a `0.6rem` (non
  serve più tenerlo minuscolo per evitare il wrap).
- **Spazio in fondo**: trovato che `#app` ha `padding-bottom: 60px`
  globale (pensato per il respiro del sito, desktop incluso) — sulla
  schermata risultato compatta ne restava quasi tutto invenduto.
  Aggiunta una regola scoped `body.result-compact #app { padding-bottom:
  16px }`, solo sotto gli 860px, solo sulla schermata risultato.

Risultato: la pagina non scrolla più affatto dentro un viewport di
852px (iPhone 17) — contenuto fino a **610px**, con margine reale sotto
i bottoni invece di finire all'ultimo pelo. Bottoni verificati ancora
43px/38px. Nessun overflow orizzontale a 320px. Desktop pixel per pixel
identico (nessuna delle tre modifiche esce dalle media query
`<860px`/`<400px` o dalla classe `.result-compact`).

**Nono giro**: richiesta esplicita di stringere ancora lo scoreboard
(box "Record proiettato") per azzerare del tutto lo spazio scrollabile
residuo — un ritocco piccolo e mirato, solo font e padding del box, non
altro. Sotto i 400px `.result-record` da `3rem` a `2.7rem`; nel blocco
mobile `.result-hero` padding da `12px 10px 10px` a `10px 8px 8px`.
Risultato: **610px → 600px**. Bottoni verificati ancora 43px/38px,
nessun overflow, desktop invariato.

**Decimo giro**: due nuovi screenshot dal vivo mostravano ancora
"RECUPERATE" per intero (non le sigle del quinto/ottavo giro) e il
record ancora grande — nessuna delle correzioni scoped `<400px>` degli
ultimi giri sembrava attiva. Causa trovata misurando la risoluzione
dello screenshot: un iPhone 17 reale (modello base, non Pro) è
1206×2622px a 3x, cioè **402px CSS di larghezza logica** — 2px sopra la
soglia dei 400px usata finora, bastava a saltare quelle regole per
intero senza che nessun check automatico se ne accorgesse (non è un
overflow, solo una regola che non scatta). Corretto alzando la soglia
da `400px` a `440px` (margine anche per i prossimi modelli) in
entrambe le media query che la usavano.

Sistemando questo si è scoperto un secondo bug, stesso tipo già preso
altre volte in questa sessione: lo scambio parola-intera/sigla
(`.label-full`/`.label-short`, introdotto all'ottavo giro) era stato
scritto dentro la media query mobile, ma la regola di default
`.label-short { display: none }` (fuori da qualsiasi media query) sta
*dopo* nel foglio — stessa specificità, vince l'ordine nel file, non la
media query. Le sigle restavano quindi nascoste su ogni larghezza.
Corretto con selettori più specifici (`.stat-box .label-full`/
`.stat-box .label-short`), stesso rimedio già usato altre volte.

Verificato di nuovo tutto (0 problemi, nessun overflow a 320px, bottoni
43px/38px, desktop invariato) esplicitamente alla vera larghezza
dell'iPhone 17 (402px), non solo alle larghezze indovinate di prima.

**Undicesimo giro**: confermato che ora entra tutto senza scroll — a
quel punto l'utente ha chiesto di riaprire un po' il respiro fra le
sezioni, segno che si era stretto più del necessario inseguendo lo
zero-scroll. C'era margine avanzato nel viewport (874px reali
dell'iPhone 17, contenuto fermo a 600px): riportati `.result-layout`
gap e margin da `4px` a `12px`, `.result-actions` gap da `4px` a `8px`,
`.result-breakdown` padding-top da `2px` a `4px`. Risultato: **600px →
630px**, ancora ben dentro il viewport con margine per la barra di
Safari. Bottoni ancora 43px/38px, nessun overflow a 320px, desktop
invariato, 0 problemi nella suite.

### Schermata home e draft più compatte su mobile

Una volta a posto la schermata risultato, richieste analoghe sulle
altre due schermate mobile, viste dal vivo sull'iPhone 17:

- **Home**: le 3 tile modalità (Classic/Scegli decade/Blind) erano
  impilate una per riga sotto i 540px, con molto spazio vuoto intorno.
  Richiesta esplicita di tornare a 3 colonne anche su mobile (come
  nell'82-0 preso a riferimento) e meno spazio vuoto. Tile ridisegnate
  più piccole (icona, titolo e descrizione a font ridotto) per stare in
  3 colonne strette, `.home-box` con margini e padding ridotti.
  Un'insidia trovata subito: i bottoni "Gioca" con solo padding ridotto
  scendevano a 26px di altezza, sotto la soglia di tocco di 36px
  stabilita più volte in questa sessione — corretto con `min-height:
  36px` + centratura via flex (stesso pattern già usato per
  `.role-chip`), invece di fidarsi del solo padding. Verificato: 36px
  esatti su tutti e 3 i bottoni, nessun overflow a 320px, desktop
  (dove le tile erano già a 3 colonne) invariato.
- **Draft**: il testo "Squadra 1 di 5 · scegli dove giocherà..." sopra
  la lista giudicato superfluo su mobile. Nascosto con `display: none`
  solo sotto gli 860px (stessa soglia usata per il resto della
  schermata compatta) — il desktop, dove nessuno l'ha segnalato, lo
  mostra ancora esattamente come prima.

Verificato con la suite automatica (0 problemi) e screenshot reali a
320px/402px/desktop per entrambe le schermate.

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
  `CEILING`/`MID`/`K`/`PERFECTION_THRESHOLD` si ricalcolano sul
  sottoinsieme (`recomputeCurve(pool, ...)`, `pool` non è più sempre
  `ALL_TEAM_SEASONS`). `PERFECTION_THRESHOLD` in particolare **non** è
  più una frazione fissa del tetto: si ricalibra dal vivo sul pool
  scelto (vedi "Curva a due tratti" sotto) per tenere la rarità del
  30-0 costante qualunque sia la dimensione del pool — un bug reale
  scoperto dopo l'aggiunta di "Late '80s" (segnalato dall'utente: 30-0
  al secondo tentativo su un pool piccolo), non solo un'ipotesi.
- **Blind**: come Classic ma senza statistiche nel draft (`blindMode`) e
  giocatori ordinati per cognome invece che per PPG — l'unico indizio è
  nome e ruolo, la valutazione del quintetto a fine partita resta
  invariata (mostra tutto, solo la fase di scelta è "alla cieca").

A fine partita, 2 bottoni distinti (non uno solo che torna sempre alla
scelta modalità): **Rigioca** ripete subito la stessa modalità/decadi
(`lastMode`/`lastDecades`, salvate da `startDraft()`), **Cambia
modalità** torna alla home con le 3 tile.

### "Late '80s": una decade "corta" ma nel roster pieno

Esplorando l'estensione agli anni '80 (vedi conversazione) è emerso che
legabasket.it ha statistiche di gioco strutturate solo a partire dalla
stagione 1987-88 — 1986-87 e prima tornano sempre vuote, verificato a
mano contro l'API. Applicando la stessa logica di ammissione delle
decadi vere (qui "almeno 2 stagioni su 3", visto che sono solo 3 non ha
senso la soglia 5/10) risultano **10 squadre** (Virtus Bologna, Cantù,
Olimpia Milano, Pesaro, Roma, Treviso, Varese, Livorno, Caserta, Napoli
— quest'ultima con un giudizio non oggettivo, vedi
`scripts/scrape_87_90.py`) su un totale di 21 identità viste, contro le
30 delle decadi vere.

Le rose di quell'epoca hanno molti più ruoli mancanti dai dati grezzi
del solito (quasi metà dei giocatori sopra soglia presenze) — risolti
con **10 agenti di ricerca in parallelo** (uno per squadra), fonti
citate per ognuno (Wikipedia IT/EN, virtuspedia.it, basketball-reference
dove accessibile), mai indovinati dalle statistiche. Risultato: 76 su
83 giocatori sopra soglia risolti, i 7 rimasti "non trovato" sono tutti
giocatori marginali di fine rosa (nessuno sopra 4 punti/partita, quasi
tutti ultimi o penultimi in squadra per media punti — verificato prima
di accettare la lacuna, non solo assunto).

- etichetta onesta `"Late '80s"`, non `"'80s"` pieno — copre le
  stagioni 1987-90, non tutto il decennio
- **prima nell'ordine** delle caselle in "Scegli decade" (prima di
  `'90s`), non in fondo — è la più vecchia
- **nel roster pieno di Classic e Blind** come le altre decadi, nessun
  filtro speciale in `startDraft()` — decisione esplicita: dopo aver
  verificato che tutte e 10 le squadre sono `lineup_complete` con ruoli
  verificati (non indovinati), non c'è motivo di trattarla diversamente
  dalle altre 4 decadi una volta pronta
- dati grezzi tenuti a parte in `data/dataset_87_90.json` prima della
  fusione in `data/dataset.json`, script dedicato `scripts/
  scrape_87_90.py` invece di un'aggiunta a `scrape_decade_sample.py`

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

Situazione oggi: **completato**, poi cresciuto ancora con l'aggiunta di
"Late '80s" (vedi sopra). Tutte le 30 squadre identificate dalla ricerca
di copertura hanno almeno una carta-decade; contando anche "Late '80s"
(72 carte totali su 30 squadre): Virtus Bologna, Olimpia Milano, Varese
e Pesaro a **5 carte** ciascuna (le 4 decadi vere più "Late '80s"),
Cantù/Roma/Treviso a **4** (3 decadi vere + "Late '80s"), Reggio Emilia
e Napoli a **3**, 13 squadre a **2**, le restanti 8 a **1 sola carta**.
Le squadre nuove (senza storia di carte-stagione, la maggioranza) sono
state aggiunte come stub vuoto in `data/dataset.json` prima di lanciare
lo script decade.

Stato dettagliato, copertura per decade di ogni squadra e cronologia
dei batch: `data/decade_coverage_research.md` (non copre "Late '80s",
aggiunta dopo con un criterio di ammissione diverso — vedi
`scripts/scrape_87_90.py`).

Le 2 forzature TEMP in `drawFive()` (Milano+Bologna sempre nel draw,
usate per le prove utente mentre il roster si popolava) sono state
rimosse.

**Debito noto legato al pool**: `drawFive()` pesca da un unico elenco
piatto di tutte le carte (`ALL_TEAM_SEASONS`), senza pesare per
squadra. Virtus Bologna/Olimpia Milano/Varese/Pesaro (5 carte-decade
ciascuna, contando anche "Late '80s") hanno quindi 5 volte più
probabilità di uscire rispetto a una squadra con 1 sola carta (8
squadre, ora che il roster è completo). Non risolto: andrebbe cambiato
a pesca a due passaggi (prima la squadra, poi la carta al suo interno)
per dare a ogni squadra pari probabilità.

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

Una quinta partizione, "Late '80s" (1987-90, criterio di ammissione
diverso perché copre solo 3 stagioni), è stata aggiunta in seguito —
vedi "'Late '80s': una decade 'corta' ma nel roster pieno" più sotto per
i dettagli.

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

Cinque sigle riviste dopo un secondo giro di revisione insieme
all'utente (più leggibili/riconoscibili delle prime): Derthona
`TOR`→`DER`, Scafati `SCA`→`SCF`, Cantù `CAN`→`CTÙ`, Pistoia
`PIS`→`PST`, Pesaro `PES`→`PSR`. `CTÙ` (con l'accento, invece della
resa senza diacritico `CTU`) verificato dal vivo con
`tests/visual_check.js` — il documento dichiara `<meta charset="UTF-8">`
in `index.html`, il `text-transform: uppercase` via CSS applicato alle
sigle in più punti dell'interfaccia gestisce correttamente la
maiuscola accentata (`ù`→`Ù`, mappatura Unicode standard, supportata
da tutti i browser moderni), nessun errore console o glitch visivo
nello screenshot su 6 viewport.

## Ruoli

legabasket classifica i giocatori in 4 categorie core (Playmaker, Guardia,
Ala, Centro) più i tag ibridi Play/Guardia, Guardia/Ala, Ala/Centro. Non
esiste una 5a categoria pulita tipo "power forward": è il sistema a rank
sopra a coprire i 5 slot, dando ad "Ala" i rank 3 e 4.

Ordine di risoluzione del ruolo (`role_source`, un campo per giocatore
che dice quale livello è stato usato):
1. **correzione forzata verificata** (`ricerca_verificata`,
   `role_forced_by_name`) — *vince anche su un ruolo già assegnato* dagli
   altri livelli, per i casi in cui la fonte è proprio sbagliata (vedi
   "Correzioni verificate al ruolo" più sotto)
2. ruolo nella rosa di quella stagione (`roster`) — 3022 su 3276
   eleggibili nel dataset attuale (92.2%)
3. ruolo "di carriera" del giocatore (`fallback_career`)
4. override manuale trovato via ricerca web (`wikipedia_lookup`) —
   `role_overrides_by_name` in `scrape_decade_sample.py`, con la fonte
   annotata in un commento accanto a ogni nome, solo per riempire un
   buco (a differenza di `ricerca_verificata`, non vince su un ruolo già
   presente)
5. stima grezza da altezza (`estimated_height`)

**Regola ferma: il ruolo non si inventa mai.** Se non c'è nessuna fonte e
manca anche l'altezza, il giocatore viene marcato `eligible: false` — meglio
un giocatore in meno che uno mostrato come selezionabile con un ruolo
sbagliato. Lo script stampa a fine run l'elenco "SENZA RUOLO" da risolvere
a mano.

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
Ala       (rank 3,4) + altezza >= 204cm E rimbalzi >= 6.7/30min -> Centro (rank 5)
```

**Perché il salto ad Ala/Centro chiede anche i rimbalzi.** Con la sola
altezza il gruppo delle ali sopra i 204cm era un miscuglio: lunghi veri
insieme ad ali che giocavano sul perimetro, e la regola spingeva tutte
verso il centro. Ne uscivano classificazioni palesemente sbagliate —
**Toni Kukoc** (che a Treviso era l'ala che portava palla) e **Dejan
Bodiroga** archiviati come ala grande/centro solo perché alti. Ora
l'altezza non basta: serve anche rimbalzare come un lungo. La soglia è
calibrata sui **centri puri del dataset**, non scelta a occhio — 6.7
rimbalzi per 30 minuti è il loro 25° percentile, cioè "almeno quanto un
centro vero scarso". Delle 96 ali alte in dubbio, 29 restano AG/C e 67
tornano AP/AG. Verificato che nessuna delle 62 carte-decade perda la
copertura dei 5 slot, e che la difficoltà non si sposti: sulle stesse
4000 pescate simulate, media 23.96 → 23.97 vittorie, tier S 1.75% →
1.73%, zero blocchi. Il salto vale solo per Ala→Centro: per gli altri
due (play→guardia, guardia→ala) si rivendica un posto più grande sul
perimetro, dove l'altezza è un indizio ragionevole di suo.

(`HEIGHT_RANK_EXTENSION` in `app.js`, funzione `ranksFor(player, extendByHeight)`
usata al posto dell'accesso diretto a `ROLE_RANKS` ovunque serva la legalità.)

**Correzioni verificate al ruolo** (`role_forced_by_name` in
`scrape_decade_sample.py`): a differenza di `role_overrides_by_name`, che
riempie solo i buchi quando legabasket non dà alcun ruolo, queste
*vincono* su una classificazione esistente e servono ai casi in cui la
fonte è proprio sbagliata. Applicate con parsimonia, una riga di
motivazione con fonte per ciascuna. Oggi ce ne sono 4: Danilović e
Ginóbili (dati "Ala" da legabasket, erano guardie: 2.9 e 3.0-4.3
rimbalzi/30min, profilo da perimetro puro), Radja (dato "Centro", a Roma
era ala-pivot: 8.5 rimbalzi/30min) e Danilo Gallinari (dato
"Guardia/Ala", a Milano a 205cm era ala piccola/grande, mai guardia).

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
PERFECTION_THRESHOLD = estimatePerfectionThreshold(pool)   (percentile 99.65 di 20.000 pescate simulate sul pool corrente)
wins_raw = 30                                            se team_rating >= PERFECTION_THRESHOLD
wins_raw = 30 / (1 + e^(-K * (team_rating - MID)))       altrimenti
```

- `MID = estimateMid(pool)` (percentile 1 di 20.000 pescate simulate con
  strategia "avida" sul pool corrente - storia e dettaglio nella sezione
  "Curva adattiva alla dimensione del pool" più sotto; era
  `CEILING * MID_FRACTION`, una frazione fissa, finché non si è scoperto
  che soffriva lo stesso bug di scala di `PERFECTION_THRESHOLD`): rating
  che vale
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
- `PERFECTION_THRESHOLD`: sopra questa soglia, sempre 30-0 — un pugno di
  quintetti vicinissimi al meglio possibile, non un plateau che capita
  per caso vicino al tetto (comportamento naturale di qualunque
  sigmoide, se non lo si rende esplicito). Storicamente era
  `CEILING * PERFECTION_BAND`, una frazione fissa del tetto (`0.87`
  l'ultimo valore); dal fix "curva adattiva alla dimensione del pool"
  sotto, è calcolata dal vivo per il pool corrente invece che scritta a
  mano — la storia dei quattro ritocchi della frazione fissa resta
  sotto perché ha fissato il *livello* di rarità desiderato (quello che
  la nuova soglia dinamica riproduce sul roster pieno), anche se il
  meccanismo che la calcola oggi è un altro:
  - `0.97` (primo valore): troppo raro per essere divertente — tier S
    ~1 partita su 326 giocando bene, 30-0 esatto **mai** su 100.000
    pescate anche giocando da onniscente (il quintetto migliore in
    assoluto — Del Negro/TVS, Young/RCA, Komazec/VAR, Daye/PSR, Gay/PST,
    tutti anni '90 — è al 99.3% del tetto ma sotto quella soglia)
  - `0.93`: tier S ~1 su 78 giocando bene, voluto così. Ma con le
    correzioni ai ruoli successive (vedi "Ruoli estesi per altezza",
    cambiano chi è eleggibile per quale rank e quindi anche `CEILING`)
    si è scoperto — con `tests/difficulty_check.js`, che chiama le
    funzioni vere del gioco (`drawFive`, `ranksFor`, `evaluateLineup`)
    invece di re-implementarle — che il 30-0 esatto non usciva **mai**,
    nemmeno giocando nel modo assolutamente migliore (0 su 3000 pescate):
    la soglia stava sopra il 99.9-esimo percentile di quello che le
    pescate permettono, non un problema di bravura
  - `0.89`: confrontate 7 bande (`0.93`→`0.87`) sulle **stesse identiche
    pescate**, chiamando la vera `evaluateLineup()` — un primo giro con
    una riscrittura a mano della formula (senza l'arrotondamento e la
    penalità che la vera funzione applica) aveva dato un tier S 3 volte
    più basso del reale, un errore scoperto solo confrontandolo col
    numero prodotto dalla funzione vera. `0.89` era il primo valore
    dove il 30-0 usciva per davvero giocando in modo ottimo (5 su 3000,
    ~1 ogni 600), tenendo l'aumento del tier S il più piccolo possibile
    fra le opzioni che funzionavano: 1 su 31 → 1 su 14
  - `0.87` (ultimo valore fisso, prima del fix adattivo sotto): dopo
    settimane di gioco reale a `0.89`, il 30-0
    restava troppo raro anche su centinaia di partite — confermato
    rilanciando `tests/difficulty_check.js` su `0.89` e `0.87` **in
    parallelo** (due server locali, stessa scala di pescate: 3000 per
    le strategie, 200.000 per la raggiungibilità), poi testato dal vivo
    su un branch dedicato prima di decidere:

    | | `0.89` | `0.87` |
    |---|---|---|
    | 30-0 giocando ottimo | 0/3000 | 13/3000 (~1 ogni 231) |
    | 30-0 giocando "avido" (umano bravo) | 0/3000 | 9/3000 (~1 ogni 333) |
    | Raggiungibilità (limite superiore, 200k pescate) | 1 ogni 766 | 1 ogni 288 |
    | Tier S giocando ottimo | 1 ogni 15 | 1 ogni 9 |

    Prezzo accettato: tier S quasi raddoppiato, in cambio di un 30-0
    che si può realisticamente vedere in qualche centinaio di partite
    invece che restare una rarità quasi mai raggiunta
- `K`: calcolato da `computeK()` perché la sigmoide valga ~29.5 appena
  sotto `PERFECTION_THRESHOLD`, così il passaggio alla zona di perfezione
  resta morbido invece che un gradino

**Curva adattiva alla dimensione del pool.** `PERFECTION_BAND` come
frazione fissa del tetto sembrava scalare correttamente per costruzione
(`CEILING` cambia, la banda resta proporzionale) ma è un bug: pescare 5
carte da un pool piccolo è una fetta molto più grande di quel pool che
pescarle da uno grande, quindi combinazioni vicine al tetto capitano per
puro caso molto più spesso — non è un problema di "quanto è alto il
tetto", è un problema di combinatoria della pescata, che la frazione
fissa non catturava. Scoperto dall'utente in gioco reale (30-0 al
secondo tentativo con "Late '80s" + `'90s` selezionate, 153.4 punti
squadra) subito dopo l'aggiunta di "Late '80s" — la prima decade
abbastanza piccola (10 squadre) da rendere il problema visibile a
occhio. Misurato con una variante di `tests/difficulty_check.js` scoped
al solo pool "Late '80s": 30-0 esatto nell'**85% delle pescate**
giocando in modo ottimo, contro l'~1 ogni 230-330 atteso sul roster
pieno — non un'anomalia di fortuna, un bug strutturale.

Fix: `PERFECTION_THRESHOLD` non è più `CEILING * PERFECTION_BAND` ma il
risultato di `estimatePerfectionThreshold(pool, extendByHeight)`,
richiamata da `recomputeCurve()` per il pool esatto di ogni partita
(tutto il roster in Classic/Blind, il sottoinsieme scelto in "Scegli
decade"): simula `PERFECTION_SAMPLES` (20.000) pescate sul pool dato con
lo stesso calcolo economico della "raggiungibilità" di
`tests/difficulty_check.js` (il miglior candidato per rank per carta,
120 permutazioni carta→rank — non la ricerca esaustiva "ottimo", troppo
costosa per girare ad ogni partita), poi fissa la soglia al percentile
`PERFECTION_PERCENTILE` (`0.9965`, scelto per riprodurre sul roster
pieno lo stesso livello di rarità già validato con `0.87`) di quella
distribuzione. Costo: 250-300ms nel caso peggiore (roster pieno, 72
carte), sceso a <150ms sui pool piccoli — misurato con
`perf_test_percentile.js` (script di verifica, non nel repo) prima di
toccare il motore vero, su 4 dimensioni di pool × 4 dimensioni di
campione.

Validato **con la vera `evaluateLineup()`** (non una riscrittura a
mano — vedi sopra il precedente in cui una riscrittura semplificata
aveva dato numeri sballati) su tutte le combinazioni rilevanti, non solo
il caso segnalato, 3000 pescate ciascuna:

| Pool | Squadre | 30-0 giocando ottimo | Tier S |
|---|---|---|---|
| Classic (tutte e 5) | 72 | 1 ogni 300 | 12.0% |
| Late '80s+'90s+'00s+'10s+'20s | 72 | 1 ogni 231 | 11.2% |
| '90s+'00s+'10s+'20s | 62 | 1 ogni 214 | 10.1% |
| Late '80s+'00s+'10s+'20s | 58 | 1 ogni 429 | 9.2% |
| Late '80s+'90s+'10s+'20s | 55 | 1 ogni 333 | 12.2% |
| Late '80s+'90s+'00s+'20s | 57 | 1 ogni 500 | 13.8% |
| Late '80s+'90s+'00s+'10s | 56 | 1 ogni 429 | 17.0% |
| Late '80s+'90s (coppia più piccola) | 24 | 1 ogni 273 | 68.3% |
| Late '80s da sola (pool minimo) | 10 | 1 ogni 200 | 89.0% |
| '20s da sola | 16 | 1 ogni 176 | 88.7% |

Il 30-0 resta in una banda stretta (~1/176-1/500) su **qualunque**
combinazione, pool minimo di 10 squadre incluso — contro l'85% di prima
del fix sullo stesso pool.

**Secondo giro: lo stesso bug era anche su `MID`, non solo sulla punta
della curva.** Prima versione di questo fix: solo `PERFECTION_THRESHOLD`
ricalibrato, `MID` lasciato come frazione fissa del tetto
(`MID_FRACTION = 0.55`) - motivato all'epoca con "è un fenomeno di coda,
il punto medio della sigmoide non ha mostrato lo stesso problema". Non
era vero, solo non ancora misurato sul caso giusto: l'utente ha
segnalato in gioco reale, su "Late '80s"+"'90s" (24 carte), risultati
di 27-28-29 quasi ad ogni partita. Misurato con la strategia "avida"
(rating più alto disponibile round per round, senza pianificare - la
stessa di `tests/difficulty_check.js`) sulle stesse 24 carte: media
27.99, p10 26 (cioè il 90% delle partite finiva 26+) - contro media
24.58, p10 20 sul roster pieno con la STESSA `MID_FRACTION`. Causa
identica al bug di `PERFECTION_THRESHOLD`: su un pool piccolo anche una
scelta "avida" (non ottimale) pesca quasi sempre carte forti, quindi il
rating tipico si avvicina al tetto molto più in fretta che sul roster
pieno - non un fenomeno di coda, lo stesso fenomeno di scala, solo sulla
parte centrale della curva invece che sulla punta.

Fix: `MID` non è più `CEILING * MID_FRACTION` ma il risultato di
`estimateMid(pool, extendByHeight)`, stesso approccio Monte Carlo di
`estimatePerfectionThreshold` ma sulla distribuzione della strategia
avida (non quella "raggiungibile" ottimistica) e al percentile
`MID_PERCENTILE` (`0.01`, il primo percentile - scelto perché riproduce
sul roster pieno via avido lo stesso comportamento già validato con
`MID_FRACTION = 0.55`: media 24.6, p10 20, tier S ~7%) invece che alto.
Testato su 5 percentili candidati (0.5%-5%) prima di scegliere: quelli
troppo alti (3-5%) rendevano il roster pieno più punitivo di prima
(media scesa a 23-23.7); l'1% è il punto dove il roster pieno resta
sostanzialmente invariato mentre i pool piccoli migliorano nettamente.

Validato con la vera `evaluateLineup()` su tutte le combinazioni
rilevanti (4000 pescate ciascuna, strategia avida):

| Pool | Squadre | avido: media / p10 / mediana | avido: tier S |
|---|---|---|---|
| Classic (tutte e 5) | 72 | 24.65 / 20 / 25 | 7.7% |
| Late '80s+'90s (segnalato dall'utente) | 24 | 26.29 / 22 / 27 | 17.5% |
| Late '80s da sola (pool minimo) | 10 | 25.98 / 22 / 27 | 20.0% |
| '20s da sola | 16 | 25.12 / 21 / 26 | 8.5% |

(tier S "avido" pre-fix sugli stessi pool: 41.2% su Late'80s+'90s, 43.8%
su Late'80s da sola, 65.0% su '20s da sola — quest'ultimo praticamente
azzerato, torna vicino all'8-9% del roster pieno)

Miglioramento netto (dal 41-65% di tier S "avido" pre-fix ai valori
sopra) ma non un pareggio perfetto con il roster pieno sui pool più
piccoli (24 e 10 carte): un residuo intrinseco della stessa natura del
limite già accettato per `PERFECTION_THRESHOLD` - con solo 10-24 carte
anche il percentile più basso della distribuzione avida non può scendere
sotto un certo livello, perché quel livello stesso dipende dal tetto
del pool, che si comprime insieme a tutto il resto. Non eliminabile del
tutto con una sigmoide a parametri fissi per pescata; il costo aggiuntivo
di calibrazione (`estimateMid` in più a `estimatePerfectionThreshold`,
entrambi ad ogni "Genera sfida") resta comunque sotto ~1.1s nel caso
peggiore (roster pieno, misurato dal vivo), accettabile per un click.

**`CEILING` e `MID` sono calcolati a runtime dal dataset caricato, non
scritti a mano.** `CEILING` prima era una costante fissa (127.5, poi
151.6) che si "sfasava" ogni volta che si aggiungevano squadre senza
essere ricalcolata — è successo davvero: da 11 a 30 squadre il tetto
vero è salito di ~19% ma `K`/`MID` sono rimasti quelli di prima,
rendendo il gioco via via più facile senza che nessuno se ne
accorgesse finché non è diventato troppo evidente. Calcolandoli dal
dataset invece che scrivendoli a mano, il problema non si ripresenta
più da solo quando il roster cresce ancora.

**`CEILING` è la somma del massimo `rating_lega` per ciascun rank su
tutto il pool — non è garantito che una combinazione reale di 5 carte
distinte possa prenderli tutti insieme.** Verificato che è comunque
quasi raggiungibile per davvero, non un fantasma: la miglior
combinazione reale di 5 carte esistenti (Del Negro/TVS, Young/RCA,
Komazec/VAR, Daye/PSR, Gay/PST, tutte anni '90) arriva al **99.3% del
tetto** (150.6 su 151.6, trovato due volte in sessioni diverse con lo
stesso risultato) — i giocatori più forti per ruolo si concentrano quasi
tutti sulle stesse squadre/anni '90. Non lo si ri-ancora al valore
esatto: calcolarlo per davvero è una ricerca combinatoria su tutte le
combinazioni di carte (quella usata in `tests/difficulty_check.js` per
verificarlo, pensata per girare offline in un test, non nel browser ad
ogni caricamento pagina) — introdurre quel costo per guadagnare uno
0.7% reintrodurrebbe sotto altra forma lo stesso problema di
staleness già risolto sopra.

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

Dopo aver rigenerato `data/dataset.json`, va ricostruita la copia che
legge il frontend:

```bash
cd scripts && python3 build_web_dataset.py
```

Non è più una copia identica (prima era un `cp` fatto a mano,
dimenticabile): `data/dataset.json` resta la sorgente completa per i
check, mentre `docs/data/dataset.json` contiene **solo quello che il
gioco legge davvero** — i giocatori selezionabili e 13 campi su 24. Da
3.44 MB a 0.72 MB (0.28 → 0.10 MB compressi in rete): il resto veniva
scaricato e buttato via dal browser. Se un domani serve mostrare in
partita una statistica oggi non mostrata, va aggiunta a `PLAYER_FIELDS`
nello script — che ha una guardia apposta: se `app.js` nomina un campo
non spedito, il build fallisce invece di lasciare un `undefined` in giro.

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
  è che molti club condividono lo stesso colore sociale (8 biancorosso,
  5 bianconero, 3 biancoblu chiaro, 2 blu scuro...), quindi dentro ogni
  famiglia di colore la tonalità esatta (chiarezza/saturazione) è stata
  scelta per restare distinguibile dalle altre squadre della stessa
  famiglia, verificato con uno script di distanza percettiva (spazio
  LAB, CIE76) su tutte le 435 coppie possibili.

  **Riaudit colori a bassa confidenza** (segnalato dall'utente: "ho
  trovato un varese giallo???"): le 8 squadre a confidenza media/bassa
  del giro precedente sono state riverificate con **8 agenti di ricerca
  in parallelo**, uno per squadra, con un vincolo esplicito che nel giro
  precedente non era stato applicato con rigore — ancorare la scelta a
  cosa la squadra ha **davvero indossato nella finestra di copertura del
  progetto (1987-2025)**, non a un'epoca precedente per quanto più
  celebre. Il caso che ha innescato il riaudit: Varese era gialloblù
  perché quello è il colore associato all'era "Ignis" del club — ma
  quell'era è **1961-1974**, prima dell'inizio dei dati (1987) e fuori
  da qualunque stagione giocabile nel gioco. Verificato che il vero
  colore sociale di Varese, sia prima che dopo l'era Ignis (quindi per
  *tutta* la finestra 1987-2025), è biancorosso — confermato anche dal
  sito ufficiale del club ("Biancorosso è il colore del cuore").

  Risultato per le 8 squadre riaudit (fonti citate per ognuna nel
  commit): **6 corrette** (colore o tonalità sbagliati), **2 confermate
  invariate**:
  - **Varese**: gialloblù (epoca Ignis, fuori finestra) → **biancorosso**
  - **Trieste**: il rosso era troppo scuro/spento — schiarito, campionato
    dallo stemma ufficiale
  - **Pistoia**: era un rosso-salmone — in realtà un rosso vero saturo
    (fonte: CSS del sito ufficiale del club)
  - **Brescia**: il blu era troppo violaceo — corretto verso un blu
    reale/cobalto, campionato dal logo ufficiale (colori invariati
    nonostante la rifondazione 2009)
  - **Avellino**: il verde era troppo chiaro/mentolato — corretto verso
    uno smeraldo più saturo (fonte: infobox Wikipedia)
  - **Cremona**: il blu era troppo violaceo — corretto verso un
    ciano/blu acciaio (fonte: infobox Wikipedia)
  - **Livorno**: famiglia amaranto confermata corretta; il tono esatto
    sourced dalla ricerca si accavallava troppo con Venezia (altro
    orogranata) — tenuto il tono esistente
  - **Roseto**: confermato corretto senza modifiche (nessun hex ufficiale
    pubblicato da nessuna fonte, ma la famiglia "biancazzurro chiaro" è
    ben documentata su tutte le denominazioni del club dal 1987 a oggi)

  Con 8 squadre ora nella famiglia biancorosso (Olimpia Milano, Varese,
  Trieste, Pesaro, Reggio Emilia, Pistoia, Biella, Teramo — contro le 7
  del giro precedente + Varese), lo spazio percettivo disponibile per
  tonalità di rosso distinguibili si è ristretto: **425/435 coppie hanno
  distanza confortevole (>16)**, le 10 più vicine (12.4-15.5) sono
  quasi tutte già note dal giro precedente (il cluster dei 5 bianconero,
  12.4-13.5) più un nuovo gruppetto di 5 nel cluster biancorosso ora più
  affollato (Trieste/Biella, Varese/Pistoia, Trieste/Teramo,
  Varese/Pesaro, Reggio Emilia/Pistoia) — stesso tipo di limite
  intrinseco già presente nel bianconero, non un errore di scelta: 8
  club realmente biancorosso significa una tavolozza di rossi
  realisticamente distinguibili ma non perfettamente separati,
  verificato con una ricerca automatica (ottimizzazione congiunta in
  spazio LAB, non a occhio) prima di scegliere i tre toni contesi.
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
  nessuna carta è incoerente (tutte e 72 coprono i 5 rank), ma è un
  controllo che non controlla più la cosa giusta
- `http_get_json()` cattura gli `HTTPError` e **cacha `{}`**: una chiamata
  fallita diventa silenziosamente "giocatore senza statistiche". È successo
  3 volte con dei 500 transitori; per ora l'unico rimedio è cancellare il
  file di cache specifico e rilanciare. Servirebbe un contatore di
  fallimenti con riepilogo a fine run, e non cachare gli errori
- ~~**Nessun test versionato**~~ risolto: le verifiche che prima vivevano
  in `/tmp` e sparivano ad ogni sessione ora sono in `tests/` (smoke test
  di gioco, check visivo + il suo test negativo) e in `scripts/`
  (i tre check sui dati)
- ~~**`check_data_consistency.py`/`check_data_coverage.py` non coprivano
  "Late '80s"**~~ **risolto**: entrambi importavano `TEAMS` solo da
  `scrape_decade_sample.py`, mai `TEAMS_87_90` da `scrape_87_90.py` —
  conseguenza diretta della scelta di tenere "Late '80s" in uno script a
  parte. Il ricalcolo-e-confronto con `data/dataset.json` (la parte più
  rigorosa dei due check) non girava mai su quelle 10 squadre: una
  regressione lì (cache grezza cambiata, logica di `build_decade()`
  modificata) non sarebbe stata presa. Estesi entrambi:
  `check_data_consistency.py` condivide ora la stessa funzione di
  confronto campo-per-campo fra le 4 decadi vere e "Late '80s" (soglia
  fissa 3 stagioni invece di `min_seasons_for()`, che darebbe 5 — sbagliato
  per questa finestra corta); `check_data_coverage.py` ha 3 sezioni in
  più (5-7) che ricalcolano la qualificazione delle 10 squadre dai dati
  grezzi 1987-89 e cercano identità aggiuntive che qualificherebbero ma
  non sono incluse. Tutti e tre i check **PULITI** dopo l'estensione:
  nessun mismatch di ricalcolo su nessuna delle 10 squadre, nessuna
  identità qualificante fuori dall'elenco.

## Struttura repo

```
docs/           sito pubblicato (GitHub Pages serve da qui)
  index.html
  style.css
  app.js
  data/dataset.json         dataset snello servito al browser (generato da build_web_dataset.py, non copia)
scripts/
  discover_clubs.py         mappatura squadra -> club_id nel tempo
  scrape_dataset.py         scraping carte-stagione (prototipo, non più usato per il dataset spedito)
  scrape_decade_sample.py   carte-decade aggregate (idempotente) - unica fonte del dataset spedito
  build_web_dataset.py      costruisce la copia snella per il browser (solo i campi usati dal gioco)
  check_data_coverage.py   verifica indipendente copertura decadi/squadre (check dati 1.1, parte A)
  check_data_consistency.py verifica interna: ricalcolo, duplicati, eleggibilità, spot-check live (check dati 1.1, parte B)
  check_data_sanity.py     bound di sanità sulle statistiche, distribuzione role_source, top rating (check dati 1.1, parte C)
data/
  dataset.json              dataset generato (sorgente di verità)
  club_discovery.json       output di discover_clubs.py
  raw_cache/                cache risposte API grezze (non versionata)
tests/
  lib/driver.js             helper condivisi per guidare il gioco da Playwright
  game_smoke_test.js        test di fumo (partita completa, no doppioni, legalità ruoli, 0 errori console)
  visual_check.js           check visivo sistematico (overflow, testo tagliato, elementi irraggiungibili) su 6 viewport
  visual_check_selftest.js  test negativo dello scanner: rompe la pagina apposta e verifica che i controlli scattino
  difficulty_check.js       taratura: 3 strategie a confronto, frequenza del tier S, raggiungibilità del 30-0
```

## Come lanciare i test

```bash
python3 -m http.server 8899 --directory docs &
node tests/game_smoke_test.js         # 20 partite di default
node tests/game_smoke_test.js 60      # numero di partite a scelta

node tests/visual_check.js            # check visivo su 6 viewport (salva gli screenshot in /tmp, il path lo stampa)
node tests/visual_check_selftest.js   # verifica che lo scanner del check visivo scatti davvero

node tests/difficulty_check.js        # taratura: 3 strategie, tier S, raggiungibilità del 30-0 (~2 min)
node tests/difficulty_check.js 500 50000   # più veloce, stime più rumorose

cd scripts && python3 check_data_coverage.py     # check dati 1.1 parte A: copertura decadi/squadre
cd scripts && python3 check_data_consistency.py  # check dati 1.1 parte B: consistenza interna (tocca la rete solo per 5 chiamate di spot-check)
cd scripts && python3 check_data_sanity.py       # check dati 1.1 parte C: bound di sanità, role_source, top rating
```

## Stato e backlog

**Più recente**: audit del README dopo tutti i merge recenti, richiesto
esplicitamente dall'utente ("è aggiornato? vedi altre criticità?") —
diversi numeri diventati obsoleti corretti contro i dati reali
(conteggio carte per squadra, distribuzione `role_source`, bias di
`drawFive()`, conteggio famiglie di colore), e una lacuna reale trovata
e **risolta**: `check_data_consistency.py`/`check_data_coverage.py` non
coprivano affatto "Late '80s" (importavano le squadre solo dalle 4
decadi vere) — estesi entrambi, tutti e tre i check dati **PULITI**
dopo l'estensione (vedi "Debito noto" sopra per il dettaglio).

Prima di questo: aggiunta la partizione "Late '80s" (10 squadre,
1987-90, vedi "Late '80s: una decade 'corta' ma nel roster pieno"
sopra) e, subito dopo, scoperta e corretta la falla di scala che
rendeva quel pool piccolo troppo facile — sia `PERFECTION_THRESHOLD`
che `MID` ora si ricalibrano dal vivo sul pool di ogni partita (due
giri, il secondo dopo un'ulteriore segnalazione dell'utente in gioco
reale) invece di essere frazioni fisse del tetto (vedi "Curva adattiva
alla dimensione del pool" sotto "Curva a due tratti"). Nello stesso
giro, riaudit dei colori a bassa confidenza (Varese e altre 7 squadre,
vedi "Decisioni prese finora" sopra) - 6 corretti, 2 confermati
invariati, tutti riverificati con la finestra di copertura reale del
progetto (1987-2025) invece di epoche precedenti più celebri ma fuori
copertura. Prima ancora: schermata risultato, home e draft compattate
per mobile (undici giri misurati e testati dal vivo su iPhone 17, vedi
"Il quintetto visibile senza scroll" sopra — altezza contenuto -49% dai
1180px di partenza, quintetto finalmente visibile senza scroll). Tutto
già su `main`.

**Dopo la 1.1** è arrivato un giro di correzioni e rifiniture, anch'esse
già su `main` (dettaglio nelle sezioni sopra, qui solo l'elenco):

- **peso del dataset**: il browser scarica solo i campi che il gioco usa
  davvero, 3.44 → 0.72 MB, con `scripts/build_web_dataset.py` che si
  rifiuta di scrivere se `app.js` usa un campo non incluso (vedi "Come
  rigenerare il dataset")
- **4 ruoli corretti con ricerca verificata** (Danilovic, Ginobili,
  Gallinari, Radja) tramite il nuovo `role_forced_by_name`, e
  l'estensione di ruolo verso il Centro ora chiede anche i **rimbalzi**,
  non solo l'altezza — soglia presa dal 25° percentile dei centri veri
  (vedi "Ruoli estesi per altezza")
- **filtro ruolo** nella lista di pescaggio (Tutti/PM/G/A/C), per non
  dover scorrere 79 righe grigie quando resta aperto un solo slot
- **quintetto a quadrati**: gli slot del draft usano lo stesso linguaggio
  visivo degli avatar della schermata finale, quadrato fin da vuoto
- **colonne allineate** nella schermata risultato: divisori come nella
  lista di pescaggio, e la riga dei totali non si sposta più a seconda di
  quanto sono larghi i numeri di quella partita

Il giro ha anche chiuso un **falso negativo nello scanner del check
visivo** (non vedeva i colori applicati via CSS a un figlio) e ha aggiunto
il caso corrispondente al test negativo dello scanner.

**1.1 raggiunta**, mergiata su `main` (sito pubblico allineato:
https://damneskjold.github.io/82-0-lega-a/). La 1.1 è tutta verifica,
niente funzionalità nuove: i tre check che erano rimasti in sospeso alla
1.0 (dati, colori, visivo) sono stati fatti e sono diventati script
versionati e rilanciabili, non controlli una tantum. Hanno trovato e
fatto correggere cose vere: i colori squadra ora sono quelli sociali
storici verificati invece che scelti a occhio, Olimpia Milano è
rientrata nella stessa pipeline delle altre 29 squadre (era l'unica
generata a mano), 3 altezze impossibili nei dati grezzi di legabasket
sono state corrette, e tre glitch grafici su schermi stretti sono spariti
(nomi troncati, etichette che si toccavano, record che andava a capo).
Dettaglio punto per punto qui sotto.

**1.0 raggiunta** in precedenza. Tutte le 30 squadre della
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

**I tre punti della 1.1, nel dettaglio** (tutti fatti):

1. ~~**Check dati**~~ **fatto**: audit di giocatori, ruoli e squadre nel
   dataset, in 3 parti.
   Parte A (copertura decadi/squadre): `scripts/check_data_coverage.py`
   ricalcola da zero, dai dati grezzi in `data/raw_cache/` (1990-2025,
   indipendente dalla tabella scritta a mano), quali squadre qualificano
   per quale decade, e confronta con `data/decade_coverage_research.md`
   e con `data/dataset.json` reale — nessun gap, nessun falso scarto,
   nessun mismatch (trovata solo una nota di metodo da correggere nel
   research doc, non un problema di dati: mancavano 2 delle 5 città con
   `club_id` doppio per rifondazione). Parte B (consistenza interna)
   **fatta**: `scripts/check_data_consistency.py` (1) richiama la vera
   `build_decade()` su tutti i dati già in cache e confronta il
   risultato campo per campo con `data/dataset.json` per tutte le 30
   squadre in `TEAMS`, (2) controlla duplicati e coerenza della soglia
   di eleggibilità su tutto il dataset, (3) fa uno spot-check dal vivo
   contro l'API di legabasket.it su 5 giocatori-stagione a caso.
   Risultato: **pulito** su tutti e tre — nessun mismatch di ricalcolo,
   nessun duplicato, nessuna violazione di eleggibilità, cache locale
   confermata identica ai dati live. La Parte B aveva inizialmente
   trovato **Olimpia Milano** fuori standard (unica squadra generata da
   un passaggio più vecchio della sessione, con `role_overrides_by_name`
   mai salvato in `TEAMS` — non ricalcolabile 1:1): risolto aggiungendola
   a `TEAMS` con ricerca web verificata per i 24 giocatori senza ruolo
   classificato né altezza (20 risolti con fonte citata — Wikipedia,
   Museo del Basket Milano, Playbasket.it, ecc. — 4 restano senza ruolo
   perché nessuna fonte reperibile lo riporta, identità comunque
   confermata: Massimo Re, Emilio Rotasperti, Federico Aime, Angelillo
   D'Ambrosio), poi rigenerata con `scrape_decade_sample.py` come le
   altre 29. Nessuna carta Olimpia ha perso `lineup_complete`. Parte C
   (bound di sanità) **fatta**: `scripts/check_data_sanity.py` controlla
   su tutte le righe giocatore-decade (4110 al momento di questo check,
   cresciute a 4290 dopo l'aggiunta di "Late '80s" — il numero cresce ad
   ogni nuova partizione, rilanciare lo script per il conteggio
   aggiornato) percentuali di tiro in [0,100], nessun valore negativo,
   minuti/partita ≤42, altezza in un range umano plausibile, `eligible`
   sempre con un ruolo — più la distribuzione di `role_source` (91,2%
   direttamente da roster legabasket all'epoca di questo check, 88,8%
   oggi dopo "Late '80s" — quota scesa perché quell'epoca ha molti più
   ruoli mancanti dai dati grezzi del solito, vedi "'Late '80s'" sopra;
   3,7% + 0,1% da ricerca web/stima altezza all'epoca, 3,5% + 0,1% oggi,
   quindi a rischio più alto) e la top 20 per `rating_lega`
   come base per lo spot-check mirato (i giocatori più forti hanno
   l'impatto maggiore su un eventuale errore). Trovate e corrette 3
   altezze chiaramente
   sbagliate nei dati grezzi di legabasket.it stessi (es. 85cm, 108cm,
   102cm — impossibili per un giocatore): 2 corrette con un valore
   plausibile già presente altrove nella cache dello stesso giocatore
   (Colbey Ross 185cm, Arturas Gudaitis 211cm), 1 annullata perché
   nessun valore alternativo esiste né in cache né via ricerca web
   (Massimiliano Gironi) — nessun impatto di gioco in nessuno dei 3 casi
   (l'altezza non era comunque abbastanza per un'estensione di ruolo).
   Spot-check della top 20 per rating: nomi tutti verificabili e reali
   (Toni Kukoc, Dino Radja, Reggie Theus, Vinny Del Negro, Aleksandar
   Djordjevic, Dean Garrett, ecc.), 2 controllati a fondo con ricerca
   esterna indipendente (Djordjevic a Olimpia Milano e Fortitudo
   Bologna, Dean Garrett e Michael Young a Reggio Calabria) — confermati.
   **Check dati completo: parti A, B e C tutte fatte.**
2. ~~**Check colori**~~ **fatto**: i 30 colori squadra (`TEAM_COLORS`
   in `app.js`) sono ora basati sul vero colore sociale storico di
   ogni club (ricerca web, fonti e confidenza per squadra in
   "Decisioni prese finora" sopra), con tonalità variata dentro la
   stessa famiglia di colore per restare distinguibili — verificato
   con distanza percettiva LAB su tutte le coppie
3. ~~**Check visivo sistematico**~~ **fatto**: `tests/visual_check.js`
   percorre una matrice di 15 schermate (home, decadi, draft in vari
   stati, lista scrollata in fondo, risultato, errore di caricamento) ×
   6 viewport (320→1440px) × modalità classic/blind, e su ognuna passa
   uno **scanner generico su tutti gli elementi visibili** invece di
   controllare solo quelli già sospetti: overflow orizzontale di pagina,
   elementi oltre i bordi, contenuto tagliato dove l'overflow è nascosto,
   elementi interattivi irraggiungibili (portati al centro con
   `scrollIntoView` e poi verificati con `elementFromPoint`: distingue
   "sta sotto il pannello ma basta scrollare" da "non c'è scroll che
   tenga"), più un report informativo sui bersagli tocco < 36px. Salva
   anche uno screenshot per combinazione, fuori dal repo, perché certe
   cose le vede solo l'occhio. `tests/visual_check_selftest.js` rompe la
   pagina apposta e verifica che i controlli scattino davvero: uno
   scanner che non segnala mai niente sembra identico a uno che
   funziona. Glitch trovati e corretti in questo giro: nomi del
   quintetto finale troncati con "..." a 320px (ora vanno a capo, e
   sotto i 400px le statistiche passano su una riga propria per lasciare
   spazio al nome), etichette dei totali che si toccavano
   ("RIMBALZIASSIST..."), record che andava a capo col trattino appeso
   quando entrambi i numeri erano a due cifre (es. 18-12).
   **Copre anche la card PNG condivisa**, che essendo disegnata su
   `<canvas>` lo scanner del DOM non vedeva ed era il buco più grosso —
   oltretutto è l'unica cosa del gioco che finisce sotto gli occhi di
   altri. Lì è saltata fuori una regressione dei colori nuovi: le
   iniziali erano disegnate in bianco fisso sopra il colore squadra, e
   con i colori sociali veri **7 squadre su 30 le avevano illeggibili**
   (Varese è giallo: contrasto 1.23, praticamente invisibili). Ora
   l'inchiostro lo sceglie `inkFor()` in base al contrasto WCAG, chiaro
   o scuro, sia sul canvas sia sull'avatar nella schermata risultato:
   contrasto minimo salito da 1.23 a 4.37 su tutte e 30. Il check ora
   verifica il contrasto sia nei dati (tutti i 30 colori) sia a schermo
   (colore calcolato del pixel, così se il collegamento della variabile
   CSS si rompe si vede), e salva la card PNG anche in una versione col
   **caso peggiore forzato** — i 5 colori squadra più chiari tutti
   insieme — invece di sperare che il sorteggio ci capiti

**In standby** (scelta esplicita dell'utente, non un fix da fare
comunque): pesca a due passaggi in `drawFive()` — verificato che il
problema è reale, misurato sia sul pool intermedio dell'epoca (durante
il popolamento del roster, quando Virtus Bologna aveva già le sue 4
carte ma molte altre squadre erano ancora stub vuoti: 200.000 pescate,
47.5% delle partite contro il 16.67% atteso se equo) sia, per
riferimento, ricalcolato esattamente (formula ipergeometrica, non
simulazione) **sul pool finale di oggi** (72 carte, 30 squadre, Virtus
Bologna/Olimpia Milano/Varese/Pesaro salite a 5 carte ciascuna dopo
"Late '80s"): **31.0%** per una squadra a 5 carte, **6.9%** per una a 1
sola carta (8 squadre), contro il 16.67% atteso se equo (5 carte
distinte su 30 squadre) — il problema si è ammorbidito in percentuale
assoluta man mano che il pool è cresciuto, ma il rapporto relativo fra
squadra più frequente e meno frequente resta di circa 4.5 a 1, non
azzerato. Potrebbe diventare una personalizzazione facoltativa in
futuro.

**In standby anche**: un giudizio separato dal record, che confronti il
rating ottenuto col massimo ottenibile da quella specifica pescata
(quanto hai sfruttato le carte che ti sono capitate, non solo quanto è
alto il numero finale — oggi il rating dipende per il 90% dalla fortuna
della pescata, per il resto dalla bravura, vedi la tabella dei percentili
sopra). Scartato deliberatamente: mostrare quel numero toglierebbe la
magia al giocatore casual, rendendo esplicito quanto la pescata conta
più della bravura — cosa che oggi il gioco lascia intuire ma non
sbatte in faccia. Se mai implementato, va dietro un toggle
"developer", mai visibile di default, sullo stesso principio delle
pescate riorganizzate sequenziali sopra. Il calcolo esiste già pronto
all'uso — la stessa ricerca del miglior quintetto per-pescata scritta
per `tests/difficulty_check.js` — quindi il costo futuro sarebbe
soprattutto di interfaccia, non di calcolo.
