const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database', 'challans.db');

const FIELD_COLUMNS = [
  'challan_no',
  'mineral_name',
  'mineral_qty',
  'validity_from',
  'validity_to',
  'validity_from_hi',
  'validity_to_hi',
  'permit_no',
  'issue_date',
  'valid_upto',
  'concessionary_name',
  'concession_area',
  'mineral_type_granted',
  'quantity_granted',
  'crusher_name',
  'finished_product',
  'quantity_dispatched',
  'dispatch_datetime',
  'source',
  'destination',
  'rate',
  'total_amount',
  'gst_bill',
  'gst_quantity',
  'gst_amount',
  'vehicle_no',
  'buyer_info',
  'driver_info'
];

const DATA_FIELD_TO_COLUMN = {
  'challan-no': 'challan_no',
  'mineral-name': 'mineral_name',
  'mineral-qty': 'mineral_qty',
  'validity-from': 'validity_from',
  'validity-to': 'validity_to',
  'validity-from-hi': 'validity_from_hi',
  'validity-to-hi': 'validity_to_hi',
  'permit-no': 'permit_no',
  'issue-date': 'issue_date',
  'valid-upto': 'valid_upto',
  'concessionary-name': 'concessionary_name',
  'concession-area': 'concession_area',
  'mineral-type-granted': 'mineral_type_granted',
  'quantity-granted': 'quantity_granted',
  'crusher-name': 'crusher_name',
  'finished-product': 'finished_product',
  'quantity-dispatched': 'quantity_dispatched',
  'dispatch-datetime': 'dispatch_datetime',
  source: 'source',
  destination: 'destination',
  rate: 'rate',
  'total-amount': 'total_amount',
  'gst-bill': 'gst_bill',
  'gst-quantity': 'gst_quantity',
  'gst-amount': 'gst_amount',
  'vehicle-no': 'vehicle_no',
  'buyer-info': 'buyer_info',
  'driver-info': 'driver_info'
};

const COLUMN_TO_DATA_FIELD = Object.fromEntries(
  Object.entries(DATA_FIELD_TO_COLUMN).map(([field, column]) => [column, field])
);

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function close(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

async function init() {
  const db = getDb();
  try {
    const fieldSql = FIELD_COLUMNS.map((column) => `${column} TEXT`).join(',\n      ');
    await run(db, `
      CREATE TABLE IF NOT EXISTS challans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        challan_number TEXT NOT NULL UNIQUE,
        qr_url TEXT NOT NULL,
        ${fieldSql},
        form_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(db, 'CREATE INDEX IF NOT EXISTS idx_challans_challan_number ON challans(challan_number)');
  } finally {
    await close(db);
  }
}

module.exports = {
  DB_PATH,
  FIELD_COLUMNS,
  DATA_FIELD_TO_COLUMN,
  COLUMN_TO_DATA_FIELD,
  getDb,
  run,
  get,
  close,
  init
};
