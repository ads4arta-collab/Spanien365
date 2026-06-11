# spanien365.de – NIE Service Setup

## Projektstruktur

```
spanien365/
├── netlify.toml
├── package.json
├── public/
│   ├── index.html          ← Startseite (noch einzufügen)
│   ├── nie-nummer.html     ← NIE Formular + Checkout
│   └── danke.html          ← Erfolgsseite nach Zahlung
└── netlify/functions/
    ├── create-checkout.js  ← Erstellt Stripe Session
    ├── webhook.js          ← Befüllt PDFs + sendet Mail
    └── pdfs/               ← !! PDFs hier ablegen !!
        ├── ex15.pdf
        └── modelo790.pdf
```

## Setup Schritt für Schritt

### 1. PDFs ablegen
Kopiere die originalen PDFs in `netlify/functions/pdfs/`:
- `ex15.pdf` → das EX-15 Formular
- `modelo790.pdf` → das Modelo 790-012 Formular

### 2. Bei Netlify deployen
1. GitHub Repository erstellen und Code hochladen
2. Bei Netlify: "Add new site" → "Import from Git"
3. Build settings: alles leer lassen (statische Seite)
4. Deploy klicken

### 3. Umgebungsvariablen in Netlify setzen
Unter: Site settings → Environment variables

| Variable | Wert |
|---|---|
| STRIPE_SECRET_KEY | sk_test_... (aus Stripe Dashboard → Developers → API Keys) |
| STRIPE_WEBHOOK_SECRET | whsec_... (siehe Schritt 4) |
| RESEND_API_KEY | re_... (aus Resend Dashboard → API Keys) |
| URL | https://spanien365.de |

### 4. Stripe Webhook einrichten
1. Stripe Dashboard → Developers → Webhooks → "Add endpoint"
2. URL: `https://spanien365.de/.netlify/functions/webhook`
3. Event: `checkout.session.completed`
4. Den "Signing secret" (whsec_...) als STRIPE_WEBHOOK_SECRET in Netlify eintragen

### 5. Domain verbinden
1. Netlify → Site settings → Domain management → "Add custom domain"
2. `spanien365.de` eingeben
3. Bei Ionos die Nameserver auf Netlify umstellen ODER einen CNAME/A-Record setzen
   - Netlify zeigt dir die genauen DNS-Werte an

### 6. Stripe Live-Modus aktivieren
Wenn alles getestet ist:
1. Stripe Dashboard → oben rechts von "Test" auf "Live" wechseln
2. Live API Keys in Netlify Umgebungsvariablen ersetzen
3. Neuen Live-Webhook erstellen (gleiche URL)

## Testen
- Testkarte: `4242 4242 4242 4242` / beliebiges Datum / beliebige CVC
- Nach Zahlung sollte die danke.html erscheinen und eine Mail ankommen

## Preisänderung
In `netlify/functions/create-checkout.js` die Zeile:
```
unit_amount: 2900, // 29,00 EUR in cents
```
