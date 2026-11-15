# Evo Pixels — Website (Phase 1)

Static single-page website for the Evo Pixels game platform. No build step,
no backend, no on-chain work, nothing spent.

## Roadmap (user's plan)

1. **Website** — this site
2. **Game** — raise + battle pixel creatures, as a **Telegram Mini App**
3. **Quests** — quests earn airdrop eligibility
4. **Wallet connect + item shop** — buy items with a Solana wallet
5. **Airdrop + listing** — $EVO airdrop and listing, several months after the event

## What is on the site

- Hero with the approved creature art
- The Creature — about + gallery of 8 creatures (Gen 1 art from the generator)
- The Game — Telegram Mini App teaser (raise + battle + evolve)
- Quests — coming soon, earn airdrop eligibility
- Item Shop — coming soon, wallet connect works (connect only, no purchases yet)
- Airdrop — explainer (open participation, months after the event)
- Footer — X / Telegram / Discord links are `#` placeholders

## Placeholders (do NOT treat as real)

- **"Play on Telegram"** button links to `#` — the bot / Mini App does not
  exist yet. Clicking it shows a "coming soon" message. Add the real
  `t.me/...` link when the Mini App is live.
- **Social links** (X / Telegram / Discord) are `#` placeholders.
- **$EVO token name, symbol (1B supply)** are proposed, not finalised.
- The wallet Connect button only connects Phantom / Solflare and shows the
  address. It makes **no transactions and no on-chain calls**.

## Preview locally

```bash
cd ~/workspace/nft-pixel-creature/website
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy later (when the user says so)

Pure static files — works on any static host. GitHub Pages (same pattern as
the SANDLINE playtest link): push `website/` to a repo's `gh-pages` branch
or `docs/` folder, or serve the folder from Vercel/Netlify. All asset paths
are relative, so a subpath deploy works.

## Files

- `index.html` — page structure + all sections
- `styles.css` — flat pixel styling (dark purple, teal + gold, no gradients)
- `app.js` — wallet connect (Phantom/Solflare) + Play button placeholder
- `assets/` — hero creature, evolved creature, 8 gallery creatures
