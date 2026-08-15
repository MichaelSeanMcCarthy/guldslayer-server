# GuldSlayer Dedicated Server

An always-on world for GuldSlayer. This runs the exact same simulation code as the
browser game, headlessly in Node, acting as a permanent invisible host. Players connect
over WebSockets — no PeerJS, no TURN relays, no join codes.

## What's in here

- `server.js` — boots the game world and accepts players (seats 8)
- `shims.js` — browser-API stand-ins so the game script runs in Node
- `guldslayer.html` — the game itself (single source of truth for client AND server)
- `package.json` — one dependency (`ws`)

## Deploy on Railway

1. Sign up at railway.com (GitHub login is easiest) — Hobby plan, $5/mo.
2. Put this folder in a GitHub repo and click **New Project → Deploy from GitHub repo**
   (or install the Railway CLI, and from this folder run `railway init` then `railway up`).
3. Railway auto-detects Node and runs `npm start`. Nothing to configure — the server
   reads the port from `PORT` automatically.
4. In the service's **Settings → Networking**, click **Generate Domain**.
   You'll get something like `guldslayer-production.up.railway.app`.
5. Check it's alive: open `https://YOUR-DOMAIN/health` in a browser —
   you should see live world stats as JSON.

## Point the game at it

Open `guldslayer.html` and set (near the bottom, next to `METERED_APP`):

```js
const SERVER_URL='wss://YOUR-DOMAIN';    // e.g. 'wss://guldslayer-production.up.railway.app'
```

That adds a **⚔ Play Online** button to the title screen. Host that HTML anywhere
(Netlify free tier is perfect — drag-and-drop the file), share the link, done.

No code changes needed for a quick test: any player can also press **Join a Game**
and paste the `wss://…` address straight into the code box.

## Notes

- **Updating the game:** the server reads `guldslayer.html` at boot, so client and
  server always simulate the same rules. When you update the game, update the copy in
  this folder too and redeploy (`git push` — Railway redeploys automatically).
- **World lifetime:** the world lives in memory. It keeps running while nobody's
  online, but a redeploy or restart generates a fresh world.
- **Peer-to-peer still works:** Create a Game / Join a Game with codes is untouched,
  as is Play Solo.
- Local test drive: `npm install && npm start`, then join `ws://localhost:3000`.
