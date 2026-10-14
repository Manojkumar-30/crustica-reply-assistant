# Crustica Reply Assistant

A free, offline reply assistant for Crustica Pizza staff. Paste a customer message, get a natural reply.

It is a **smart local reply engine** (rule-based), not an AI. There is no AI API, no backend, no login, no database and no API key.
Customer messages never leave the browser.

## Features

- Replies for Google reviews (with star rating), Instagram comments and DMs, influencer messages, WhatsApp and customer messages.
- Detects sentiment (positive, neutral, negative, mixed, question), intent (menu, price, timing, Jain, delivery, collaboration, rate and more), topics and entities (food, branch, ₹ amounts, follower counts, percentages, star rating). Tolerates small typos.
- Handles several intents in one message and answers each one.
- A recommended reply plus three alternatives, a suggested approach and a "Why this reply?" explanation.
- Rephrase (human, friendly, professional, casual, short, detailed, premium, no emoji) gives different wording every tap.
- Influencer rate strategies: Accept, Negotiate, Ask for Deliverables, Offer Barter, Decline.
- Saved replies, history with search, settings, business details. Everything is stored in the browser's `localStorage`.
- Installable on iPhone and works offline.
- **Never invents Crustica information.** Opening hours, prices, offers, delivery areas, Jain or vegan availability, menu items, phone and addresses are only stated if configured in Settings → Business details. Otherwise the reply says the team will check, and the app tells the user what is missing.

## Local development

```
npm install      # no dependencies; this is safe to skip
npm start        # http://localhost:3000  (static preview of public/)
npm test         # engine, storage and service worker tests
npm run build    # validates everything and writes dist/
npm run check    # test + build
```

Preview the production build: `DIR=dist npm start` (macOS/Linux) or `$env:DIR="dist"; npm start` (PowerShell).

`npm run build` checks syntax, imports, the manifest and icons, the service worker file list and that no keys or external calls are present. It then copies `public/` to `dist/` and stamps a build id into the service worker cache name. Each deployment gets a fresh offline cache and the old one is deleted.

## Project layout

```
public/            the whole website (deployable as-is)
  index.html, style.css, manifest.json, sw.js, icons/
  js/engine.js     the rule engine (intent scoring, sentiment, entities, templates, rephrase)
  js/replyEngine.js  replyEngine.generate(message, options)  -> the only thing the UI calls
  js/brand.js      what the assistant may state as fact
  js/store.js      localStorage with safe parsing
  js/views/        home, saved, history, settings
scripts/           build.js, test.js, make-icons.js
```

`replyEngine` is set to the local engine. An AI engine could be added later by giving `setReplyEngine()` an object with the same `generate` and `rephrase` methods. The UI would not change.

## Install on iPhone

Open the HTTPS address in **Safari** → Share → **Add to Home Screen**. The first visit must be online. After that the app opens offline.

## Deploy

Deploy the **`dist`** folder after `npm run build` (the `public` folder also works, but `dist` has the cache version stamp). There is no server code in production. All paths are relative, so it also works from a sub-folder URL.

### GitHub Pages

1. Push the project to a GitHub repository (see "GitHub" below).
2. Easiest: add a workflow that runs `npm run build` and publishes `dist` (Settings → Pages → Source: GitHub Actions).
   Or, without Actions, commit the contents of `dist` to a `docs/` folder and choose Settings → Pages → Deploy from a branch → `/docs`.
3. The site appears at `https://<user>.github.io/<repo>/`.

### Cloudflare Pages (recommended)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the GitHub repository.
2. Build command: `npm run build`. Build output directory: `dist`. No environment variables.
3. Every push to the main branch deploys. You get `https://<project>.pages.dev`.

Netlify and Vercel work the same way: build command `npm run build`, publish/output directory `dist`.

### Custom domain: reply.crustica.in

Nothing in this project changes DNS. When you are ready:

```
reply.crustica.in  →  Cloudflare Pages  →  Crustica Reply Assistant
```

- **Cloudflare Pages:** project → Custom domains → Set up a domain → `reply.crustica.in`. If `crustica.in` already uses Cloudflare DNS, Cloudflare adds the record for you. Otherwise add a **CNAME** at your DNS provider: name `reply`, target `<project>.pages.dev`.
- **GitHub Pages:** add a **CNAME** record `reply` → `<user>.github.io`, then set the custom domain in Settings → Pages (tick Enforce HTTPS).
- **Netlify:** CNAME `reply` → `<site>.netlify.app`. **Vercel:** CNAME `reply` → `cname.vercel-dns.com`.
- DNS changes can take from a few minutes to a few hours. HTTPS certificates are issued automatically.
- iPhone users should re-add the app to the Home Screen after the domain changes, because the install is tied to the address.

## GitHub

This folder is not a git repository by itself (it may sit inside another one). Run `git init` inside it before pushing.
`.gitignore` already excludes `.env*`, keys, `node_modules`, `dist`, logs and exported backups. The project has no secrets and nothing needs to be added.
Do not commit exported backup files: they contain customer messages.

## Troubleshooting

- **The page shows an old version.** Hard refresh, or close and reopen the app. The service worker loads from the network first, so a new deployment shows on the next online open. If it persists: Safari → Settings → Advanced → Website Data → remove the site.
- **Copy does not work.** Browsers only allow copying on a tap, over HTTPS (or localhost). If it still fails the reply text is selected: press and hold, then Copy.
- **Add to Home Screen is missing.** Use Safari (not an in-app browser), and use the HTTPS address.
- **"Opening hours aren't configured" notes.** Fill in Settings → Business details. Until then replies say the team will check.
- **Settings or history disappeared.** They live in this browser only. Clearing site data, private browsing or a different browser starts fresh. Use Settings → Your data → Export backup.
- **`npm run build` fails.** The message names the file. Typical causes: a new JS file missing from the `SHELL` list in `public/sw.js`, or a wrong import path.
