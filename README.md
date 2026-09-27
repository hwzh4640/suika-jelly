# Suika Jelly · 果冻合成大西瓜

A browser take on the Suika (watermelon) merge game: drop glossy jelly fruits into a glass
mason jar, and when two identical jellies touch they squish together into the next fruit.
Grow a watermelon, don't let the jar overflow.

**Play:** https://pages.hz.ax/suika-jelly/

- Works on phones (touch: drag to aim, release to drop) and desktop (mouse or `←` `→` + `Space`).
- English, 简体中文, 繁體中文 — auto-detected, switchable in the menu, or `?lang=zh-TW`.
- Original chiptune loop and all sound effects are synthesised in the browser with Web Audio;
  no audio files. The tempo creeps up as the jar fills. `M` toggles mute, `P` pauses.
- Physics by [matter-js](https://brm.io/matter-js/); everything else is hand-drawn Canvas 2D.
- Global leaderboard (all-time and this week): when a game ends you can add a name to
  register the score. Entering a name is optional.
- Installable PWA: add to Home Screen on iOS/Android for a full-screen, offline-capable app with
  its own icon and launch screens. Shared links show a preview card.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173/suika-jelly/
npm test           # vitest: rules, merge maths, song data, i18n
npm run build      # tsc + vite → dist/
npm run smoke      # headless Chromium: plays, checks audio output, screenshots to /tmp
npm run assets     # regenerate icons, iOS launch screens and cover.png into public/
                   # (ONLY=cover npm run assets for just the link-preview image)
node scripts/palette.mjs   # fruit colours: contact sheet and distances, see below

npm run scores:dev # the leaderboard Worker locally on :8787 (npm run dev talks to it)
npm run scores:e2e # API checks against a throwaway local Worker
npm run smoke:lb   # the leaderboard in a browser against a throwaway local Worker
```

The browser scripts expect Playwright's Chromium in `~/.cache/ms-playwright/chromium-1223`
(override with `CHROME_PATH`).

Pushes to `main` deploy through GitHub Actions to GitHub Pages.

## Leaderboard

Scores live in a small Cloudflare Worker (`worker/`) backed by one SQLite Durable Object; it
runs comfortably on the free tier. The game itself stays a static site.

**Setup.** Add two repository secrets, then re-run the workflow. Until they exist the Worker
job is skipped and the game is published without any leaderboard UI.

```sh
gh secret set CLOUDFLARE_API_TOKEN   # a token from the "Edit Cloudflare Workers" template
gh secret set CLOUDFLARE_ACCOUNT_ID
gh workflow run deploy.yml
```

The workflow deploys the Worker and bakes its address into the site build as
`VITE_SCORES_URL`. To serve the API from another address (a custom domain, say), set the
repository variable `SCORES_URL`; it is used when the Worker job reports no address.

**What is stored.** The name as entered (cleaned of invisible characters, at most 16
characters), the score, the time of submission, and four numbers about the game (seconds
played, fruits dropped, merges, highest fruit). Nothing identifies a player: no account, no
cookie, no device id. For rate limiting the Worker keeps a salted, truncated hash of the
sender's network address for at most a day; the salt changes daily and the address itself is
never stored. The browser remembers the last name used and which rows it submitted, so it
can prefill the field and highlight your rows.

**Fair play.** The server rejects results the game rules make impossible (too many drops for
the time played, more points than the dropped fruits could ever yield, and so on), duplicate
submissions of the same game, floods, and requests from other websites. It cannot tell
whether a *possible* score was really played: the game runs in the player's browser, so a
determined person can submit an invented but believable result.

**Removing an entry.** Set a third secret and re-run the workflow to switch on the admin
route, then delete by id (ids are in the `GET /scores` output):

```sh
gh secret set SCORES_ADMIN_TOKEN     # any long random string, e.g. from `openssl rand -hex 32`
curl -X DELETE -H "Authorization: Bearer $TOKEN" https://<worker-address>/scores/<id>
```

Without that secret the route does not exist.

**Retention.** The all-time top 1000 and the top 5000 of the current and previous week are
kept; everything else is pruned daily. Weeks start on Monday 00:00 UTC.

**Changing the rules.** `shared/scoreRules.ts` mirrors the scoring table and drop cooldown.
If those change in the game, update it too; `npm test` fails when they disagree.

## Fruit colours

Each fruit has its own colour so it can be recognised at a glance: wine-red cherry, pink
strawberry, violet grape, amber dekopon, orange persimmon, red apple, green pear, pale pink
peach, yellow pineapple, jade melon, dark green watermelon. Besides hue the fruits are spread
across lightness, because lightness is what remains for red-green colour-blind players.

`node scripts/palette.mjs` draws every fruit at the same size, measures the colour each one
really shows, and prints how far apart every pair is for normal vision and for the three
kinds of colour blindness, with a contact sheet in `/tmp/suika-palette.png`. Use it when
changing colours in `src/game/fruits.ts`; `npm test` enforces minimum distances.

Eleven fruits cannot all be separated by colour alone for colour-blind players. Where colour
runs out (dekopon and pear, for example), shape and pattern carry the difference: the
dekopon's knob, strawberry seeds, the pineapple's lattice and crown, the melon's net, the
watermelon's stripes.

## Scoring

Merging two fruits of tier *n* (cherry = 1) scores the triangular number *n(n+1)/2*:
1, 3, 6, 10, 15, 21, 28, 36, 45, 55 and 66 for two watermelons, which vanish.
