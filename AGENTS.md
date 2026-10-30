# Torjäger-Challenge: Hinweise für Claude und Mitwirkende

Belohnungs-App für eine Familie (ein Kind): Aufgaben bringen Tore, Karten kosten Minus, Tore führen zu Zielen mit Belohnungen, dazu Sticker-Album (100 Stück) und Angel-Spiel (Fang). Ton: warm, ermutigend, nie beschämend. Der Nutzer ist ein Elternteil, spricht Deutsch und will **so wenig wie möglich selbst tun müssen**: Antworten auf Deutsch, kurz, ehrlich darüber, was geprüft wurde und was nicht.

> **Living memory:** Halte diese Datei aktuell (dauerhafte Entscheidungen, Regeln, Gotchas themenbasiert, kein datierter Changelog).

## Eine Codebasis, zwei Ausgaben

| Ausgabe | Ordner | Speicher | Zweck |
|---|---|---|---|
| Web-App (Home-Bildschirm der iPhones) | `docs/`, ausgeliefert von GitHub Pages (`main`, Ordner `/docs`) | Firestore (EU), Pfad `families/<Familiencode>/…` | die eigentliche App für Eltern und Kind |
| Claude-Seite (Artifact) | `build/torjaeger.html`, per Artifact-Werkzeug veröffentlicht | Claude-db | früherer Weg, bleibt als Rückfall (private Seite, Claude-Login nötig) |

`src/`: `logic.js` (Regeln, rein), `svg.js`, `fx.js`, `store.js` (Speicher, Sync, Echo-Erkennung), `cloud.js` (Web-App: Familienlink, Firestore-Adapter, Sperrseiten), `views.js`, `actions.js`, `style.css`, `body.html`.
Dokumente: `cfg/main` (Einstellungen), `cfg/progress` (Feiern, Eingelöstes, Album), `days/<JJJJ-MM-TT>`, `konto/<id>`. Beide Ausgaben nutzen dieselben Dokumente und dieselbe Schnittstelle (`doc/collection/onSnapshot/set/delete`); `fsAdapter` in `cloud.js` bildet sie auf Firestore ab.

## Befehle

```bash
npm install                      # einmalig (firebase, esbuild, Schriften, firebase-tools für den Emulator)
node build.js                    # baut build/ (Claude-Seite, Testversionen) und docs/ (Web-App)
node test/test-logic.js          # Regeln, rein
node test/e2e7.js                # Browser-Tests der Claude-Seite (Playwright; global installiert, NODE_PATH=$(npm root -g))
node test/e2e.js; node test/e2e4.js; node test/e2e6.js
node tools/rules.js <Code> build/test.firestore.rules   # Regeln aus der Vorlage
./node_modules/.bin/firebase emulators:start --only firestore --project demo-torjaeger --config firebase.json   # Emulator auf 127.0.0.1:8085 (lädt das Jar beim ersten Start)
node test/e2e-cloud.js           # Web-App gegen den Emulator: echtes SDK, echte Regeln, zwei Geräte, offline, falscher Code
node test/subpath.js             # docs/ unter dem Pages-Unterpfad /torjaeger-app/: Manifest, Symbole, Service Worker, Schriften, Start ohne Netz
node tools/icons.js              # Symbole neu zeichnen (assets/)
```

Vor jedem Push auf `main` müssen **alle** Suiten grün sein: Push = live für die Familie (Pages baut in etwa einer Minute). Nach Änderungen an `src/` immer `node build.js` laufen lassen und `docs/` mit committen. Die Datei `docs/index.html` nach dem Build **nie** von Hand ändern (die Sicherheitsrichtlinie enthält den Hash des Skripts).

## Veröffentlichung und Repo

- Repo: `github.com/a-heuberger/torjaeger-app`, **öffentlich**, Branch `main`. Die Web-App liegt als `docs/` darin; GitHub Pages liefert sie aus (Settings → Pages → Branch `main`, Ordner `/docs`) unter `https://a-heuberger.github.io/torjaeger-app/`, also in einem **Unterpfad**: im Code und in `docs/` nur relative Pfade (Manifest, Symbole, `sw.js`), nie ein führendes `/`. `test/subpath.js` fängt das ab.
- Pushen aus einer Claude-Sitzung: Repo mit `add_repo` (Zugriff `push`) anhängen, dann normal `git push`. Das läuft über die Claude-GitHub-App. Meldet GitHub **403 „repo_not_connected“**, hat die App auf dem Konto `a-heuberger` keinen Zugriff auf das Repo: Der Nutzer gibt ihn unter github.com/settings/installations → Claude → Configure frei (nur der Kontoinhaber kann das). Das Anlegen eines Repos über die Werkzeuge geht nicht (403), das macht der Nutzer.
- Die Cloud-Sitzung hat keinen Browser und erreicht den Computer des Nutzers nicht (auch nicht mit „du bist eingeloggt“). Konsolen- und Einstellungsschritte (GitHub, Firebase) erledigt der Nutzer selbst oder das Claude-Fenster in seinem Chrome: ein vollständiger Auftrag zum Einfügen, das Ergebnis kommt als Text zurück. Für Pages und Firebase hat das so funktioniert.

## Zugang und Datenschutz

- Daten: Vorname, Aufgaben, Tore, Guthaben. Das Repo ist **öffentlich**: Niemals Familiencode, Firebase-Konfiguration, Familienlink oder echten Stand ins Repo, in Tests, Screenshots oder Commit-Nachrichten. Tests nutzen `TESTCODE23456789` und das Emulator-Projekt `demo-torjaeger`.
- Zugang = **Familienlink** `https://<Seite>/#c=<base64url({ k, f, e? })>`. `k` = Familiencode (16 Zeichen A–Z/2–9), `f` = Firebase-Webkonfiguration, `e` = Emulator (nur Tests). Der Link wird einmal pro Gerät geöffnet und liegt dann im lokalen Speicher (`torj-cloud-v1`). Bauen: `node tools/familienlink.js <Seite> <Code> <Konfigurationsdatei>`; neuen Code: `node tools/familiencode.js`.
- Der Code steht in den Firestore-Regeln (`firestore.rules.template`, Platzhalter `FAMILIENCODE`; der Nutzer fügt sie in der Firebase-Konsole ein) und im Link, sonst nirgends. Ohne Code ist nichts erreichbar (auch `/families` lässt sich nicht auflisten). Das Modell ist „geheimer Link“, nicht „Online-Banking“.
- Der Trainer-Code (PIN) schützt nur vor versehentlichem Tippen und liegt als Hash in `cfg/main`.
- Das Firebase-Projekt gehört dem Nutzer (Google-Konto), kostenloser Spark-Tarif, Datenbank in der EU. Claude hat darauf keinen Zugriff; Regeln und Konsole macht der Nutzer nach `ANLEITUNG.md` (oder das Claude-Fenster in seinem Chrome nach einem Auftrag zum Einfügen). Eingerichtet und von außen geprüft: Datenbank `eur3`, Produktionsmodus, Regeln aus der Vorlage mit dem Familiencode, Web-App registriert. Konfiguration, Familiencode und Familienlink liegen **nicht** im Repo; einen neuen Link baut man mit `tools/familienlink.js` aus der Konfiguration, die der Nutzer aus der Firebase-Konsole kopiert.

## Spielregeln (Stand, so umgesetzt und getestet)

- Aufgaben: Tor oder Kein Tor (der Gegner bekommt es). „Eigener Grund“: Tor (bis `extraMax` pro Tag) oder Kein Tor mit Freitext. Neun Standardaufgaben, die ersten drei nur an Schultagen.
- Karten: Gelb −1, Rot −3 **Minus**, Rot höchstens einmal pro Tag, zwei offene Gelbe ergeben automatisch Rot, Gelbe verfallen nie, Trainer kann zurückziehen, **kein Einspruch**, Grund freiwillig. Karten geben dem Gegner nichts.
- **Übersicht (Kopf, Heute, Woche) zeigt alle Tore ohne Abzug.** Ziele und Fang rechnen mit Tore minus Minus (`score`); ein eingelöstes Ziel bleibt erreicht; fällt ein noch nicht eingelöstes durch Minus weg, wird es beim Wiedererreichen erneut gefeiert. Sticker-Tüten zählen nach den gesamten Toren (ohne Abzug).
- Ziele: 25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 500 Tore mit Belohnungstexten des Trainers (alles änderbar). „5 € aufs Guthabenkonto“ bucht beim Einlösen aufs Konto. „Fußballpack“ ist reiner Belohnungstext und hat nichts mit den App-Stickern zu tun.
- Sticker: 100 (60 normal, 30 selten, 10 ultraselten), 1/2/5 Punkte, 10 Punkte = 1 Bonus-Tor, Tüte alle 6 Tore (einstellbar).

## Gotchas

- iOS: Safari und Home-Bildschirm-App haben **getrennten** Speicher. Der Link bleibt deshalb mit `#c=…` in der Adresse (wird beim „Zum Home-Bildschirm“ übernommen); sonst fragt die App einmal nach dem Link. `hashchange` nimmt einen neuen Link sofort an.
- Offline-Start: Ein `cfg/main`, das nur aus dem Zwischenspeicher kommt und nicht existiert, ist **kein** neues Spiel, sondern Sperrseite „offline“, bis der Server antwortet. Geschrieben wird ohne Abwarten (Firestore-Warteschlange).
- Service Worker (`assets/sw.template.js`): Beim allerersten Laden ist er noch nicht aktiv, was die Seite dabei lädt, würde nie gemerkt. Deshalb stehen die Schriften (`__FONTS__`, aus `build.js`) in der Hülle, und `index.html` gibt es als Rückfall nur für Navigationen (sonst bekäme eine Schriftanfrage ohne Netz HTML zurück und das Laden scheitert mit „OTS parsing error“).
- Sicherheitsrichtlinie per Meta-Tag: `img-src` muss `https://www.google.com` erlauben (das SDK pingt `cleardot.gif`); Test-Build erlaubt zusätzlich `127.0.0.1`.
- esbuild-Ziel `safari15`; `safari14` scheitert an der Destrukturierung im SDK.
- Firestore-Regel `{document=**}` trifft auch den Familienknoten selbst; das ist gewollt und unkritisch.
- Das echte Projekt lässt sich von außen prüfen, ohne Daten zu berühren (Firestore-REST, ohne Anmeldung): Richtiger Code → `GET …/documents/families/<Code>/cfg/main` gibt 404 (erlaubt, nur leer), `…/days` gibt 200 `{}`. Falscher Code, `…/families` und jeder andere Pfad geben 403. **Der API-Schlüssel schützt nichts:** dieselben Aufrufe ohne `key=` antworten genauso, allein die Regeln mit dem Familiencode im Pfad entscheiden. Ein Probe-Dokument (`_selftest/probe`) sofort wieder löschen.
- Rauchtest mit dem echten Link nur **lesend** fahren (Einlauf erscheint, kein Schreibkanal); die Einrichtung abzuschließen schreibt `cfg/main` in die echte Datenbank.
- Trainer-Modus „Schieß“ (`shootMode`): Der Spielstand hält Tore zurück, bis der Ball geschossen oder übersprungen wurde (Tests: `skipShots`).
- Browser-Tests der Claude-Seite brauchen `test/mock-claude.js` (bildet die db von Claude nach, `window.__nodb`/`__readonly` schalten Zugriffsarten).
- Eine doppelte Setting-`id` oder ein ungültiger Block lässt andere Plattformen Dateien still liegen: lieber testen als annehmen.
