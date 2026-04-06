# Hivemind — Project Rules

## Key links
- **Game:** https://kmurali9.github.io/hivemind-game/
- **Admin test:** https://kmurali9.github.io/hivemind-game/?admin=1
- **GitHub repo:** https://github.com/kmurali9/hivemind-game
- **Firebase console:** https://console.firebase.google.com/project/hivemind-game-ab3f1
- **Firestore data:** https://console.firebase.google.com/project/hivemind-game-ab3f1/firestore

## What this is
A daily puzzle game (like Wordle) where players pick one item from each row and score points based on how popular their picks are.

## Content rules
- **Family friendly** — all prompts, categories, and items must be appropriate for all ages. No sexual, explicit, or drug-related content. Think NYT Games audience.
- **Be FUNNY** — every prompt should make someone laugh or say "ooh that's a good one." Irreverent, opinionated, meme-aware. Not corporate or generic.
- **Keep items short** — under ~20 characters so they fit in the grid cells on mobile.

## Timeliness and cultural relevance
- **This is critical.** Prompts should feel like they were written TODAY, not 6 months ago.
- **Tie into what's happening in the real world** — big movie/TV releases (new Game of Thrones season, Marvel movie opening weekend), sports moments (NBA Finals, Super Bowl week, March Madness), award shows, viral moments, holidays, seasonal events.
- **When generating prompts, search the web** for what's coming up in that date range — premieres, playoffs, album drops, cultural events — and weave them in. At least 2-3 prompts per week should be tied to something timely.
- **Examples of great timely prompts:**
  - NBA Finals week: "Draft Your All-Time Starting Five"
  - New season of a hit show drops: "Cast Your Dream [Show] Alliance"
  - Summer kicks off: "Build Your Perfect Beach Day Cooler"
  - Oscar week: "Build Your Snub Revenge Ballot"
- **Evergreen prompts are fine for filler** (food debates, workplace humor, etc.) but the magic is in the timely ones.

## Technical rules
- This is a single `index.html` file + `prompts.json`. Keep it that way — no build tools, no frameworks.
- Prompts load from `prompts.json` by today's date (Pacific Time). Never hardcode a prompt in index.html.
- Firebase handles auth (anonymous) and storing picks. Never expose or change the Firebase config without asking.
- Always push to GitHub after changes — the site auto-deploys from the `main` branch.
- `prompts.json` is fetched with a cache-busting parameter (`?v=timestamp`) to avoid stale CDN cache on GitHub Pages.
- **Deploy timing:** Changes to `index.html`, `prompts.json`, or `firestore.rules` should be pushed before 9am PT or after midnight PT when possible. Mid-day pushes risk users getting different versions due to CDN caching. If a mid-day push is unavoidable, avoid touching the submit flow, scoring logic, or today's prompt data.

## Play restriction — CRITICAL
This is the #1 most important system to protect. Streaks, leaderboards, and all retention features depend on it. If it breaks, the game is meaningless.

**How it works (4 layers):**
1. **Client-side** — localStorage + cookies + sessionStorage + played-games cookie list. Checked on page load and before "Let's Go" click.
2. **Firebase device doc** — on submit, a `games/{gameId}/devices/{deviceId}` doc is written alongside the pick. On next visit, this doc is checked with a simple read (not a query). This catches users who get a new anonymous UID.
3. **Firestore security rules** — `picks/{userId}` is create-only (no update/delete). Same UID cannot submit twice. `devices/{deviceId}` is also create-only.
4. **Admin bypass** — `?admin=1` URL param skips all client checks and allows updating own pick doc. Never share this link publicly.

**Known limitation:** If a user clears ALL browser data (localStorage + cookies + IndexedDB), they get a new device ID and new anonymous UID. The device doc check won't catch them. This is the Wordle-level tradeoff — accepted for now.

**After every code change to index.html, verify:**
- `markPlayedLocally()` is still called BEFORE the Firebase write in `submitPicks()`
- `hasPlayedLocally()` still checks localStorage, cookies, sessionStorage, and played-games cookie
- `hasPlayed()` still checks Firebase `picks/{userId}` AND `devices/{deviceId}`
- The batch write in `submitPicks()` still writes BOTH `picks/{userId}` AND `devices/{deviceId}`
- Firestore rules (`firestore.rules`) still enforce create-only on both collections

**Daily monitoring:** A scheduled task runs at 10:30am PT checking yesterday's data for duplicate device IDs, missing device docs, and other anomalies. If issues are found, an alert email is sent to Krishna immediately.

## Prompt generation
- Prompts are pre-generated in bulk (currently 90 days through Jul 2, 2026).
- There is no auto-generation pipeline — when running low, generate more manually.
- Weekly preview email goes out Sundays at 9am PT showing Mon–Sun ahead.
- Low-stock alert emails on Mondays if under 2 weeks of prompts remain.
- **NEVER edit prompts for today or any past date.** Firebase stores column indices (0-4), not item names. Changing items at a position breaks results for anyone who already played. GitHub Pages can cache for 10+ minutes, so even "quick" edits cause some users to play different versions of the same game. Only edit prompts with gameId dates that are TOMORROW or later.
- Item ordering matters: $5 (index 0) should be the most desirable/popular option, $1 (index 4) the least. This creates the budget tension that makes the game fun.

## User preferences
- Krishna is not an engineer — do the work, don't explain how to do it.
- Keep explanations simple and jargon-free.
- Always push and deploy after making changes.
- When in doubt, ask before making big changes.
