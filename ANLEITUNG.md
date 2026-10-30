# Einrichtung (einmalig, ca. 10 Minuten)

Die App selbst liegt bei GitHub und wird von dort ausgeliefert. Dazu kommt eine kostenlose Datenbank bei Google (Firebase). Nur ihr könnt dort ein Konto nutzen, deshalb sind das die einzigen Schritte, die nicht von Claude erledigt werden.

## 1. Datenbank bei Google anlegen

1. https://console.firebase.google.com öffnen und mit dem Google-Konto anmelden, dem die Datenbank gehören soll (am besten ein privates).
2. **Projekt erstellen** (Create a project): Name z. B. `torjaeger-familie` → Weiter → Google Analytics **ausschalten** → Projekt erstellen → Weiter.
3. Links im Menü **Erstellen** (Build) → **Firestore Database** → **Datenbank erstellen** (Create database):
   Standort **eur3 (Europa)** (alternativ europe-west3 Frankfurt), **Im Produktionsmodus starten**, Erstellen. Wird eine Edition abgefragt: **Standard**.
4. Oben auf den Reiter **Regeln** (Rules): den gesamten Text löschen, den Regeltext von Claude einfügen, **Veröffentlichen** (Publish).
5. Zahnrad neben „Projektübersicht“ → **Projekteinstellungen** → unten bei „Meine Apps“ auf das Web-Symbol **</>** → Spitzname `Torjäger` → **App registrieren**
   (Firebase Hosting **nicht** ankreuzen). Den Block `const firebaseConfig = { … };` kopieren und Claude schicken.

## 2. Seite bei GitHub freischalten

Im Repo: **Settings** → **Pages** → bei „Build and deployment“ die Quelle **Deploy from a branch** → Branch `main`, Ordner `/docs` → **Save**.
Nach etwa einer Minute ist die App unter der angezeigten Adresse erreichbar.

## 3. Auf die iPhones

1. Claude schickt den **Familienlink**. Er enthält den Zugang und ist so geheim wie ein Passwort: nur an die Familie schicken.
2. Link auf dem iPhone in **Safari** öffnen.
3. Unten auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → Hinzufügen.
4. App vom Home-Bildschirm öffnen. Falls sie nach dem Familienlink fragt: Link aus der Nachricht kopieren und einfügen (einmalig).
5. Auf dem ersten Gerät: Einlauf durchspielen (Name, Trikot, **Trainer-Code** festlegen). Auf den anderen Geräten ist der Stand sofort da.

## Wenn etwas hakt

- „Der Link passt nicht“: Der Familiencode in den Regeln stimmt nicht mit dem im Link überein, oder die Regeln wurden nicht veröffentlicht (Schritt 1.4).
- „Noch keine Verbindung“ beim allerersten Start: Internet nötig, danach geht auch offline.
- Neuer Link nötig (z. B. weil er weitergegeben wurde): Claude erzeugt einen neuen Code, die Regeln werden einmal ersetzt, alle bekommen den neuen Link, der Stand wird übernommen.
