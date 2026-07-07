const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { exec } = require('child_process');

const PORT     = 3000;
const DIR      = __dirname;
const MODELS   = path.join(DIR, 'models');
const DATA_DIR = path.join(DIR, 'data');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js'  : 'application/javascript; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.bin' : 'application/octet-stream',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.ico' : 'image/x-icon',
  '.pdf' : 'application/pdf',
  '.svg' : 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const FACE_API_URL  = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const FACE_API_DEST = path.join(DIR, 'face-api.min.js');
const WEIGHTS_BASE  = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const MODEL_FILES   = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

function baixar(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) { resolve(false); return; }
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    https.get(url, res => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(() => { fs.renameSync(tmp, dest); resolve(true); }); });
    }).on('error', err => { try { fs.unlinkSync(tmp); } catch(_){} reject(err); });
  });
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

/* ==================== API REST ==================== */
function handleAPI(req, res) {
  // Rota: GET /api/store/:key  →  lê data/{key}.json
  //       PUT /api/store/:key  →  grava data/{key}.json

  const key = req.url.replace(/^\/api\/store\//, '').split('?')[0];
  if (!key || !/^[\w-]+$/.test(key)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Chave inválida'); return;
  }
  const file = path.join(DATA_DIR, key + '.json');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET') {
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('null'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'PUT') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 20_000_000) req.destroy(); });
    req.on('end', () => {
      try { JSON.parse(body); } catch(e) { res.writeHead(400); res.end('JSON inválido'); return; }
      fs.writeFile(file, body, 'utf8', err => {
        if (err) { res.writeHead(500); res.end('Erro ao gravar'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    return;
  }

  res.writeHead(405); res.end('Método não permitido');
}

/* ==================== SERVIDOR ESTÁTICO ==================== */
function iniciarServidor(localIP) {
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);

    // Roteamento da API
    if (url.startsWith('/api/store/')) { handleAPI(req, res); return; }

    const safe = path.normalize(url);
    const file = path.join(DIR, safe === '/' || safe === '\\' ? 'ponto.html' : safe);

    if (!file.startsWith(DIR)) { res.writeHead(403); res.end('Acesso negado'); return; }

    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Não encontrado: ' + safe); return; }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });

  srv.listen(PORT, '0.0.0.0', () => {
    console.log('\n  ✓ Servidor iniciado!\n');
    console.log(`  ┌─────────────────────────────────────────────────────────┐`);
    console.log(`  │  PC  (este computador):                                 │`);
    console.log(`  │    http://localhost:${PORT}/ponto.html                     │`);
    console.log(`  │    http://localhost:${PORT}/index.html  (escala)           │`);
    console.log(`  │                                                          │`);
    console.log(`  │  TABLET/CELULAR (mesma rede Wi-Fi):                     │`);
    console.log(`  │    http://${localIP}:${PORT}/ponto.html                    │`);
    console.log(`  │                                                          │`);
    console.log(`  │  ⚠  Para câmera no tablet, ative no Chrome:             │`);
    console.log(`  │     chrome://flags/#unsafely-treat-insecure-origin...   │`);
    console.log(`  │     Adicione: http://${localIP}:${PORT}               │`);
    console.log(`  └─────────────────────────────────────────────────────────┘`);
    console.log('\n  Pressione Ctrl+C para encerrar.\n');
    exec(`start http://localhost:${PORT}/ponto.html`);
  });
}

/* ==================== INICIALIZAÇÃO ==================== */
async function setup() {
  console.log('\n====================================');
  console.log('  TCHE GRILL — Sistema de Ponto');
  console.log('====================================\n');

  // Diretório de dados (ponto, banco, faces, etc.)
  if (!fs.existsSync(DATA_DIR)) { fs.mkdirSync(DATA_DIR, { recursive: true }); console.log('  Diretório data/ criado ✓'); }

  // face-api.js
  process.stdout.write('  face-api.js ... ');
  try {
    const baixou = await baixar(FACE_API_URL, FACE_API_DEST);
    console.log(baixou ? 'baixado ✓' : 'já existe ✓');
  } catch(e) { console.log('ERRO: ' + e.message); }

  // Modelos de reconhecimento facial
  if (!fs.existsSync(MODELS)) fs.mkdirSync(MODELS, { recursive: true });
  const faltando = MODEL_FILES.filter(f => !fs.existsSync(path.join(MODELS, f)));
  if (faltando.length) {
    console.log(`\n  Baixando ${faltando.length} modelo(s) de reconhecimento facial...`);
    for (const f of faltando) {
      process.stdout.write(`    ${f} ... `);
      try { await baixar(WEIGHTS_BASE + f, path.join(MODELS, f)); console.log('✓'); }
      catch(e) { console.log('ERRO: ' + e.message); }
    }
  } else {
    console.log('  Modelos de reconhecimento facial: todos presentes ✓');
  }

  const localIP = getLocalIP();
  iniciarServidor(localIP);
}

setup().catch(console.error);
