const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const DATA_DIR = path.join(__dirname, 'data');

// ensure data folder
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const datasetRoutes = require('./datasetRoutes');
app.use('/api/datasets', datasetRoutes);


// helpers
function datasetFile(name) {
  // sanitize name a bit
  return path.join(DATA_DIR, `${name}.json`);
}

// list datasets
app.get('/api/datasets', (req, res) => {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -5));
  res.json({ datasets: files });
});

// create dataset
app.post('/api/datasets', (req, res) => {
  const { name } = req.body;
  if (!name || !/^[\w-]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid dataset name. Use letters, numbers, dash or underscore.' });
  }
  const f = datasetFile(name);
  if (fs.existsSync(f)) return res.status(400).json({ error: 'Dataset already exists' });
  fs.writeFileSync(f, JSON.stringify([], null, 2));
  res.json({ ok: true, name });
});

// get records
app.get('/api/datasets/:name/records', (req, res) => {
  const f = datasetFile(req.params.name);
  if (!fs.existsSync(f)) return res.json({ records: [] });
  const arr = JSON.parse(fs.readFileSync(f));
  // return sorted oldest->newest for chat UI
  arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ records: arr });
});

// add a record (store prompt+response as the required raw format plus parsed fields)
app.post('/api/datasets/:name/records', (req, res) => {
  const {
    role, // "user" or "ai"
    message,
    traits = {},
    mood = '',
    emotion = '',
    nsfw = 0
  } = req.body;

  if (!role || !message) {
    return res.status(400).json({ error: 'Both role and message are required' });
  }

  const nsfwVal = Number(nsfw) || 0;
  const f = datasetFile(req.params.name);
  const arr = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [];

  // find the last block
  let lastBlock = arr[arr.length - 1];

  // check if last block matches current parameters
  const matchesLastBlock =
    lastBlock &&
    JSON.stringify(lastBlock.traits || {}) === JSON.stringify(traits) &&
    lastBlock.mood === mood &&
    lastBlock.emotion === emotion &&
    lastBlock.nsfw === nsfwVal;

  if (matchesLastBlock) {
    // append to existing block
    lastBlock.conversation.push({ speaker: role, text: message });
  } else {
    // create new block
    const newBlock = {
      traits,
      mood,
      emotion,
      nsfw: nsfwVal,
      conversation: [{ speaker: role, text: message }],
      createdAt: new Date().toISOString()
    };
    arr.push(newBlock);
  }

  fs.writeFileSync(f, JSON.stringify(arr, null, 2));

  res.json({ ok: true, records: arr, matchesLastBlock });
});

app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// listen on environment PORT and bind to 0.0.0.0 for Codespaces port forwarding
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
