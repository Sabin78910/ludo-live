/* global WebSocket, performance, setTimeout, console, process */
// Local load test against `wrangler dev`: ROOMS rooms x 2 players play real turns for SECS seconds.
// Run the Worker without the per-IP limit (every load socket shares one IP): npx wrangler dev -c load/wrangler.load.toml
// Usage: node load/load.mjs [ws://127.0.0.1:8787] [rooms] [secs]
const [base = "ws://127.0.0.1:8787", roomsArg = "200", secsArg = "20"] = process.argv.slice(2);
const ROOMS = +roomsArg, SECS = +secsArg;
const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join("");
const lat = []; let msgs = 0, errors = 0, closed = 0;

function player(c, create, name) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${base}/room/${c}`);
    const p = { ws, seat: -1, sentAt: 0 };
    ws.onopen = () => ws.send(JSON.stringify({ t: "hello", name, clientSeed: Math.random().toString(16).slice(2), create }));
    ws.onmessage = (e) => {
      msgs++;
      const m = JSON.parse(e.data);
      if (m.t === "welcome") { p.seat = m.seat; resolve(p); }
      if (m.t === "error") errors++;
      if (m.t === "state") {
        if (p.sentAt) { lat.push(performance.now() - p.sentAt); p.sentAt = 0; }
        const r = m.room, g = r.game;
        if (r.status === "playing" && g && r.playerSeats[g.current] === p.seat && g.phase === "roll") {
          setTimeout(() => { p.sentAt = performance.now(); ws.send('{"t":"roll"}'); }, 50);
        }
      }
    };
    ws.onclose = () => { closed++; resolve(p); };
  });
}

const t0 = performance.now();
const rooms = await Promise.all(Array.from({ length: ROOMS }, async () => {
  const c = code();
  const host = await player(c, true, "Host");
  const guest = await player(c, false, "Guest");
  if (host.ws.readyState === 1) host.ws.send(JSON.stringify({ t: "start", quick: true }));
  return [host, guest];
}));
console.log(`connected ${ROOMS * 2} sockets in ${Math.round(performance.now() - t0)}ms`);

// Flood check: one extra socket fires 300 messages at once and must be closed with 4029.
const flood = await new Promise((resolve) => {
  const ws = new WebSocket(`${base}/room/${code()}`);
  ws.onopen = () => { for (let i = 0; i < 300; i++) ws.send('{"t":"ping"}'); };
  let pongs = 0;
  ws.onmessage = () => pongs++;
  ws.onclose = (e) => resolve({ code: e.code, pongs });
  setTimeout(() => resolve({ code: "still open", pongs }), 5000);
});

await new Promise((r) => setTimeout(r, SECS * 1000));
lat.sort((a, b) => a - b);
const q = (x) => Math.round(lat[Math.floor(lat.length * x)] ?? NaN);
console.log(JSON.stringify({ rooms: ROOMS, sockets: ROOMS * 2, secs: SECS, rolls: lat.length, msgsReceived: msgs, errors, closed,
  p50ms: q(0.5), p95ms: q(0.95), p99ms: q(0.99), flood }));
for (const r of rooms) for (const p of r) p.ws.close();
process.exit(0);
