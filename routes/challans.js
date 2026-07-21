const express = require('express');
const QRCode = require('qrcode');
const {
  FIELD_COLUMNS,
  DATA_FIELD_TO_COLUMN,
  COLUMN_TO_DATA_FIELD,
  getDb,
  run,
  get,
  close
} = require('../db');

const router = express.Router();
function qrBaseUrl(browserOrigin) {
  if (process.env.QR_BASE_URL) return process.env.QR_BASE_URL.replace(/\/$/, '');

  if (browserOrigin) {
    try {
      const url = new URL(browserOrigin);
      const hostname = url.hostname.toLowerCase();
      const isPrivateNetwork = hostname.startsWith('10.')
        || hostname.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
      if (!isPrivateNetwork) return url.origin;
    } catch (error) {
      // Use the local default when the supplied browser origin is invalid.
    }
  }

  return 'http://localhost:3000';
}

function normalizeFields(fields = {}) {
  const normalized = {};
  for (const [dataField, column] of Object.entries(DATA_FIELD_TO_COLUMN)) {
    const value = fields[dataField] ?? fields[column] ?? '';
    normalized[column] = String(value).trim();
  }
  return normalized;
}

function toClientFields(row) {
  const fields = {};
  for (const column of FIELD_COLUMNS) {
    fields[COLUMN_TO_DATA_FIELD[column]] = row[column] || '';
  }
  fields['challan-no'] = row.challan_number;
  return fields;
}

function validateFields(fields) {
  const missing = [];
  for (const dataField of Object.keys(DATA_FIELD_TO_COLUMN)) {
    if (!Object.prototype.hasOwnProperty.call(fields, DATA_FIELD_TO_COLUMN[dataField])) {
      missing.push(dataField);
    }
  }
  return missing;
}

function generateChallanNumber() {
  const value = Math.floor(1000000000 + Math.random() * 9000000000);
  return `JK05CMV-${value}`;
}

async function generateUniqueChallanNumber(db) {
  for (let i = 0; i < 20; i += 1) {
    const challanNumber = generateChallanNumber();
    const existing = await get(db, 'SELECT id FROM challans WHERE challan_number = ?', [challanNumber]);
    if (!existing) return challanNumber;
  }
  throw new Error('Unable to generate unique challan number');
}

async function qrDataUrl(qrUrl) {
  return QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 400,
    color: {
      dark: '#4A148C',
      light: '#FFFFFF'
    }
  });
}

async function qrPng(qrUrl) {
  return QRCode.toBuffer(qrUrl, {
    type: 'png',
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 400,
    color: {
      dark: '#4A148C',
      light: '#FFFFFF'
    }
  });
}

router.post('/challans', async (req, res, next) => {
  const db = getDb();
  try {
    const fields = normalizeFields(req.body.fields || {});
    const missing = validateFields(fields);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing fields', fields: missing });
    }

    // Use the user-provided challan number if non-empty; otherwise generate a random one
    const userChallanNo = fields.challan_no;
    const challanNumber = (userChallanNo && userChallanNo.trim() !== '')
      ? userChallanNo.trim()
      : await generateUniqueChallanNumber(db);
    const qrUrl = `${qrBaseUrl(req.body.browserOrigin)}/challan/${encodeURIComponent(challanNumber)}`;
    fields.challan_no = challanNumber;

    const columns = ['challan_number', 'qr_url', ...FIELD_COLUMNS, 'form_data'];
    const placeholders = columns.map(() => '?').join(', ');
    const formData = {};
    for (const column of FIELD_COLUMNS) {
      formData[COLUMN_TO_DATA_FIELD[column]] = fields[column] || '';
    }
    formData['challan-no'] = challanNumber;

    const values = [
      challanNumber,
      qrUrl,
      ...FIELD_COLUMNS.map((column) => fields[column] || ''),
      JSON.stringify(formData)
    ];

    await run(db, `INSERT INTO challans (${columns.join(', ')}) VALUES (${placeholders})`, values);

    res.status(201).json({
      challanNumber,
      qrUrl,
      qrDataUrl: await qrDataUrl(qrUrl),
      fields: formData
    });
  } catch (err) {
    next(err);
  } finally {
    await close(db);
  }
});

router.get('/challans/:challanNumber', async (req, res, next) => {
  const db = getDb();
  try {
    const row = await get(db, 'SELECT * FROM challans WHERE challan_number = ?', [req.params.challanNumber]);
    if (!row) return res.status(404).json({ error: 'Challan not found' });
    res.json({
      challanNumber: row.challan_number,
      qrUrl: row.qr_url,
      qrDataUrl: await qrDataUrl(row.qr_url),
      fields: toClientFields(row),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (err) {
    next(err);
  } finally {
    await close(db);
  }
});

router.get('/challans/:challanNumber/qr', async (req, res, next) => {
  const db = getDb();
  try {
    const row = await get(db, 'SELECT qr_url FROM challans WHERE challan_number = ?', [req.params.challanNumber]);
    if (!row) return res.status(404).send('Challan not found');
    const png = await qrPng(row.qr_url);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.challanNumber}-qr.png"`);
    res.send(png);
  } catch (err) {
    next(err);
  } finally {
    await close(db);
  }
});


module.exports = router;
