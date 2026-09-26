const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'bank.json');
const EMPTY_DATA = { nextId: 1, applications: [], transactions: [] };

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(EMPTY_DATA, null, 2));
}

function read() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function write(data) {
  const temporary = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
  fs.renameSync(temporary, DATA_FILE);
}

function add(collection, item) {
  const data = read();
  const record = { id: data.nextId++, createdAt: new Date().toISOString(), ...item };
  data[collection].push(record);
  write(data);
  return record;
}

function updateApplication(id, changes) {
  const data = read();
  const application = data.applications.find((item) => item.id === Number(id));
  if (!application) return null;
  Object.assign(application, changes, { updatedAt: new Date().toISOString() });
  write(data);
  return application;
}

module.exports = { read, write, add, updateApplication };
