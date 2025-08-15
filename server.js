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
  const { prompt, response, traits = {}, mood = '', emotion = '', nsfw = 0 } = req.body;
  if (!prompt || !response) return res.status(400).json({ error: 'Both prompt and response are required' });

  const traitPairs = Object.entries(traits).map(([k, v]) => `${k}:${v}`).join(', ');
  const nsfwVal = Number(nsfw) || 0;

  const raw = `<|user|> ${prompt} <|traits|> ${traitPairs} <|mood|> ${mood} <|emotion|> ${emotion} <|nsfw|> ${nsfwVal} <|response|> ${response}`;

  const record = {
    raw,
    prompt,
    response,
    traits,
    mood,
    emotion,
    nsfw: nsfwVal,
    createdAt: new Date().toISOString()
  };

  const f = datasetFile(req.params.name);
  const arr = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [];
  arr.push(record);
  fs.writeFileSync(f, JSON.stringify(arr, null, 2));

  res.json({ ok: true, record });
});

// listen on environment PORT and bind to localhost for Codespaces port forwarding
const PORT = process.env.PORT || 3000;
app.listen(PORT, 'localhost', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
