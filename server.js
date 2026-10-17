// Servidor do Reino do Rei Louco: entrega o jogo e sincroniza os jogadores.
// Sem dependências: só o Node.js (18 ou mais novo). Rode com: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---- WebSocket mínimo (RFC 6455) ----
const clients = new Map(); // socket -> {peer, p}
let next = 1;

function frame(str) {
  const payload = Buffer.from(str, 'utf8'), len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
function sendTo(sock, obj) { if (!sock.destroyed) sock.write(frame(JSON.stringify(obj))); }
function broadcast(obj, except) { const f = frame(JSON.stringify(obj)); for (const s of clients.keys()) if (s !== except && !s.destroyed) s.write(f); }
function drop(sock) {
  const c = clients.get(sock); if (!c) return;
  clients.delete(sock); broadcast({ t: 'l', peer: c.peer });
  try { sock.destroy(); } catch {}
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const peer = 'p' + String(next++).padStart(6, '0');
  clients.set(sock, { peer, p: {} });
  sock.alive = true;
  sendTo(sock, { t: 'hello', peer, all: [...clients.entries()].filter(([s]) => s !== sock).map(([, c]) => ({ peer: c.peer, p: c.p })) });

  let buf = Buffer.alloc(0), frag = [];
  sock.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > 1e6) { drop(sock); return; }
    for (;;) {
      if (buf.length < 2) break;
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (!masked) { drop(sock); return; }
      if (buf.length < off + 4 + len) break;
      const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 8) { drop(sock); return; }
      if (op === 9) { if (!sock.destroyed) sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
      if (op === 10) { sock.alive = true; continue; }
      if (op === 1 || op === 0) {
        frag.push(data);
        if (!fin) continue;
        const text = Buffer.concat(frag).toString('utf8'); frag = [];
        let m; try { m = JSON.parse(text); } catch { continue; }
        if (m && m.t === 'p' && m.p && typeof m.p === 'object' && text.length < 32000) {
          clients.get(sock).p = m.p;
          broadcast({ t: 'p', peer, p: m.p }, sock);
        }
      }
    }
  });
  sock.on('close', () => drop(sock));
  sock.on('error', () => drop(sock));
});

setInterval(() => {
  for (const s of clients.keys()) {
    if (!s.alive) { drop(s); continue; }
    s.alive = false;
    if (!s.destroyed) s.write(Buffer.from([0x89, 0]));
  }
}, 20000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Reino do Rei Louco rodando em http://localhost:' + PORT));
