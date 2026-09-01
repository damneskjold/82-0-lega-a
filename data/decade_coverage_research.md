# Copertura per decade delle squadre storiche di Serie A (ricerca)

Ricerca storica (Wikipedia, pagine stagione + storia club) per capire quali
squadre qualificano per una carta-decade in ciascuna delle 4 decadi
giocabili (90s/00s/10s/20s — pre-1987 non ha statistiche individuali,
vedi README). Soglia di qualificazione: **almeno 5 stagioni** in Serie
A1/Serie A/LBA in quella decade.

Fatta la prima volta con 3 agenti di ricerca in parallelo a inizio
sessione, andata persa quando la conversazione è stata riassunta (viveva
solo nella chat, non in un file — errore da non ripetere). Ricostruita a
memoria dall'utente, che l'aveva salvata; una riverifica veloce fatta in
un secondo momento concorda su quasi tutto tranne un paio di voci minori
(Fortitudo Bologna, Treviso) segnalate sotto come meno certe.

## Tabella

| Città (squadra) | Decadi | Copertura |
|---|---|---|
| Varese | 90 00 10 20 | 4/4 |
| Olimpia Milano | 90 00 10 20 | 4/4 |
| Virtus Bologna | 90 00 10 20 | 4/4 |
| Cantù | 90 00 10 | 3/4 |
| Pesaro | 90 00 10 | 3/4 |
| Roma (Virtus) | 90 00 10 | 3/4 |
| Reggio Emilia | 90 10 20 | 3/4 |
| Fortitudo Bologna | 90 00 | 2/4 |
| Venezia | 10 20 | 2/4 |
| Treviso | 90 00 20 | 2/4* |
| Napoli | 00 20 | 2/4 |
| Trieste | 90 20 | 2/4 |
| Siena | 90 00 | 2/4 |
| Pistoia | 90 10 | 2/4 |
| Sassari | 10 20 | 2/4 |
| Trento | 10 20 | 2/4 |
| Avellino | 00 10 | 2/4 |
| Reggio Calabria | 90 00 | 2/4 |
| Cremona | 10 20 | 2/4 |
| Livorno | 00 | 1/4 |
| Udine | 00 | 1/4 |
| Brescia | 20 | 1/4 |
| Caserta | 10 | 1/4 |
| Biella | 00 | 1/4 |
| Verona | 90 | 1/4 |
| Teramo | 00 | 1/4 |
| Roseto | 00 | 1/4 |
| Brindisi | 10 | 1/4 |
| Tortona | 20 | 1/4 |

\* segnata "meno certa": una riverifica veloce indicava 90/00 senza 20s.
Da confermare su legabasket.it direttamente prima di usarla per decidere.

## Stato di implementazione (aggiornare mano a mano)

- **Fatte**: Virtus Bologna (4/4), Olimpia Milano (4/4), Pallacanestro
  Varese (4/4), Pallacanestro Cantù (3/4: 90/00/10, anni 2020 scartata
  automaticamente dallo script per sotto soglia — solo 2 stagioni),
  Victoria Libertas Pesaro (3/4: 90/00/10, anni 2020 scartata — solo 4
  stagioni)
- **Migliori candidate successive**: Roma (già nel roster, club_id noto,
  ma ferma dal 2020 quindi niente carta anni 2020 — solo 3 carte su 4
  possibili), Reggio Emilia (squadra nuova, tuttora attiva, richiede
  discovery del club_id)

Nota tecnica: `scrape_decade_sample.py` ora scarta automaticamente
(`MIN_SEASONS_PER_DECADE = 5`) qualsiasi decade con meno di 5 stagioni
disponibili, invece di generare comunque una carta sottile che non
rispecchia una vera decade. Aggiunto dopo che le prime carte Cantù/Pesaro
anni 2020 (2 e 4 stagioni) sono passate senza questo filtro.
