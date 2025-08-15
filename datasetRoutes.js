const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

const DATA_DIR = path.join(__dirname, 'data');

// helper to get dataset file path
function datasetFile(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

// helper to load dataset
function loadDataset(name) {
  const filePath = datasetFile(name);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// helper to save dataset
function saveDataset(name, records) {
  const filePath = datasetFile(name);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
}

// DELETE: delete from selected index onwards
router.delete('/:name/records/:index', (req, res) => {
  const { name, index } = req.params;
  let records = loadDataset(name);
  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0 || idx >= records.length) {
    return res.status(400).json({ error: 'Invalid index' });
  }
  records = records.slice(0, idx);
  saveDataset(name, records);
  res.json({ success: true, records });
});

// PUT: edit a record
router.put('/:name/records/:index', (req, res) => {
  const { name, index } = req.params;
  const { prompt, response } = req.body;
  let records = loadDataset(name);
  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0 || idx >= records.length) {
    return res.status(400).json({ error: 'Invalid index' });
  }
  if (prompt !== undefined) records[idx].prompt = prompt;
  if (response !== undefined) records[idx].response = response;
  saveDataset(name, records);
  res.json({ success: true, records });
});

// POST: create branch dataset
router.post('/:name/branch', (req, res) => {
  const { name } = req.params;
  const { index, newName } = req.body;
  let records = loadDataset(name);
  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0 || idx >= records.length) {
    return res.status(400).json({ error: 'Invalid index' });
  }
  if (!newName || !/^[\w-]+$/.test(newName)) {
    return res.status(400).json({ error: 'Invalid new dataset name' });
  }
  const branchRecords = records.slice(0, idx + 1);
  saveDataset(newName, branchRecords);
  res.json({ success: true, records: branchRecords });
});

module.exports = router;
