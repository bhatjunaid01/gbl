const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim().replace(/^\uFEFF/, '');
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && (process.env[key] == null || process.env[key] === '')) process.env[key] = value;
  }
}

loadEnv();

const { init } = require('./db');
const challanRoutes = require('./routes/challans');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use('/api', challanRoutes);

function renderTemplateWithData(data) {
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  if (!html.includes('<base href="/">')) {
    html = html.replace('<head>', '<head>\n    <base href="/">');
  }
  if (data.readOnly) {
    html = html.replace('<html lang="en">', '<html lang="en" class="verification-mode">');
    html = html.replace('<body>', '<body class="verification-page">');
  }
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  return html.replace('</body>', `    <script>window.__CHALLAN_DATA__ = ${payload};</script>\n</body>`);
}

app.get('/challan/:challanNumber', async (req, res, next) => {
  const { getDb, get, close, FIELD_COLUMNS, COLUMN_TO_DATA_FIELD } = require('./db');
  const QRCode = require('qrcode');
  const db = getDb();
  try {
    const row = await get(db, 'SELECT * FROM challans WHERE challan_number = ?', [req.params.challanNumber]);
    if (!row) return res.status(404).send('Challan not found');
    const fields = {};
    for (const column of FIELD_COLUMNS) fields[COLUMN_TO_DATA_FIELD[column]] = row[column] || '';
    fields['challan-no'] = row.challan_number;
    const qrDataUrl = await QRCode.toDataURL(row.qr_url, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 400,
      color: { dark: '#4A148C', light: '#FFFFFF' }
    });
    res.send(renderTemplateWithData({
      readOnly: true,
      challanNumber: row.challan_number,
      qrUrl: row.qr_url,
      qrDataUrl,
      fields
    }));
  } catch (err) {
    next(err);
  } finally {
    await close(db);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`QR base URL=${process.env.QR_BASE_URL || 'browser origin (localhost fallback)'}`);
  });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

