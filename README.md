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
PERFECTION_THRESHOLD = CEILING * PERFECTION_BAND        (PERFECTION_BAND = 0.89)
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
- `PERFECTION_BAND = 0.89`: sopra l'89% del tetto teorico, sempre 30-0 —
  un pugno di quintetti vicinissimi al meglio possibile, non un plateau
  che capita per caso vicino al tetto (comportamento naturale di
  qualunque sigmoide, se non lo si rende esplicito). Tre ritocchi, ognuno
  misurato prima di essere spedito — mai a occhio, perché `K` dipende da
  `PERFECTION_THRESHOLD` tramite `computeK()`: spostare la banda non
  tocca solo la punta della curva, la ripiattisce tutta, e uno
  spostamento piccolo ha un effetto più grande di quanto sembri a naso:
  - `0.97` (primo valore): troppo raro per essere divertente — tier S
    ~1 partita su 326 giocando bene, 30-0 esatto **mai** su 100.000
    pescate anche giocando da onniscente (il quintetto migliore in
    assoluto — Del Negro/TVS, Young/RCA, Komazec/VAR, Daye/PES, Gay/PIS,
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
  - `0.89` (attuale): confrontate 7 bande (`0.93`→`0.87`) sulle
    **stesse identiche pescate**, chiamando la vera `evaluateLineup()` —
    un primo giro con una riscrittura a mano della formula (senza
    l'arrotondamento e la penalità che la vera funzione applica) aveva
    dato un tier S 3 volte più basso del reale, un errore scoperto solo
    confrontandolo col numero prodotto dalla funzione vera. `0.89` è il
    primo valore dove il 30-0 esce per davvero giocando in modo ottimo
    (5 su 3000, ~1 ogni 600 — anche confermato su un giro più ampio,
    5 su 4000), tenendo l'aumento del tier S il più piccolo possibile
    fra le opzioni che funzionano: 1 su 31 → 1 su 14, contro 1 su 9 a
    `0.87` (quasi il triplo, per lo stesso identico guadagno sul 30-0)
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

**`CEILING` è la somma del massimo `rating_lega` per ciascun rank su
tutto il pool — non è garantito che una combinazione reale di 5 carte
distinte possa prenderli tutti insieme.** Verificato che è comunque
quasi raggiungibile per davvero, non un fantasma: la miglior
combinazione reale di 5 carte esistenti (Del Negro/TVS, Young/RCA,
Komazec/VAR, Daye/PES, Gay/PIS, tutte anni '90) arriva al **99.3% del
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
  nessuna carta è incoerente (tutte e 62 coprono i 5 rank), ma è un
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
   su tutte le 4110 righe giocatore-decade percentuali di tiro in
   [0,100], nessun valore negativo, minuti/partita ≤42, altezza in un
   range umano plausibile, `eligible` sempre con un ruolo — più la
   distribuzione di `role_source` (91,2% direttamente da roster
   legabasket, 3,7% + 0,1% da ricerca web/stima altezza, quindi a
   rischio più alto) e la top 20 per `rating_lega` come base per lo
   spot-check mirato (i giocatori più forti hanno l'impatto maggiore su
   un eventuale errore). Trovate e corrette 3 altezze chiaramente
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
problema è reale (simulato 200.000 draw, Virtus Bologna/4 carte
compare nel 47.5% delle partite contro il 16.67% atteso se equo,
Udine/1 carta solo nel 7.3%), potrebbe diventare una personalizzazione
facoltativa in futuro.

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
