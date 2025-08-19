// public/js/main.js
(async function () {
  const datasetSelect = document.getElementById('datasetSelect');
  const chat = document.getElementById('chat');
  // const pendingLabel = document.getElementById('pendingLabel');
  const createBtn = document.getElementById('createBtn');
  const newDatasetInput = document.getElementById('newDatasetInput');
  const createConfirmBtn = document.getElementById('createConfirmBtn');
  const encryptKey = 'xyzABC123'; // hardcoded for demo; use a secure key in production

  // holds the normalized blocks for the currently selected dataset
  let conversationBlocks = [];
  // holds what will be downloaded
  let selectedDatasetJson = [];
  // let pendingPrompt = null;
  window.currentDataset = '';
  let currentRole = 'user';

  // ---------- helpers ----------
  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function normalizeNumber(n) {
    const x = typeof n === 'string' ? parseFloat(n) : n;
    return Number.isFinite(x) ? x : 0;
  }

  function readTraits() {
    return {
      trust:   normalizeNumber(document.getElementById('trait_trust').value),
      happiness: normalizeNumber(document.getElementById('trait_happiness').value),
      romantic:  normalizeNumber(document.getElementById('trait_romantic').value),
      sad:       normalizeNumber(document.getElementById('trait_sad').value),
      angry:     normalizeNumber(document.getElementById('trait_angry').value),
      lust:      normalizeNumber(document.getElementById('trait_lust').value),
    };
  }

  function readNSFW() {
    // prefer dropdown with id="nsfwLevel"; fallback to old checkbox id="nsfw"
    const el = document.getElementById('nsfwLevel') || document.getElementById('nsfw');
    if (!el) return 0;
    if (el.tagName.toLowerCase() === 'select') return parseInt(el.value, 10) || 0;
    if (el.type === 'checkbox') return el.checked ? 2 : 0;
    return 0;
  }

  // make traits object deterministic for comparison (ordered keys + numbers)
  function canonicalTraits(t) {
    const order = ['trust', 'happiness', 'romantic', 'sad', 'angry', 'lust'];
    const out = {};
    order.forEach(k => { if (k in t) out[k] = normalizeNumber(t[k]); });
    return out;
  }

  function sameMeta(a, b) {
    return (
      a.mood === b.mood &&
      a.emotion === b.emotion &&
      a.nsfw === b.nsfw &&
      JSON.stringify(canonicalTraits(a.traits)) === JSON.stringify(canonicalTraits(b.traits))
    );
  }

  // Convert server records to the new block shape (supports old or new)
  function normalizeToBlocks(records) {
    if (!Array.isArray(records)) return [];
    return records.map(rec => {
      if (Array.isArray(rec.conversation)) {
        // already new format
        return {
          traits: canonicalTraits(rec.traits || {}),
          mood: rec.mood || 'neutral',
          emotion: rec.emotion || 'none',
          nsfw: rec.nsfw ?? 0,
          conversation: rec.conversation.map(t => ({
            speaker: t.speaker === 'ai' ? 'ai' : 'user',
            text: String(t.text ?? ''),
          })),
          createdAt: rec.createdAt,
          _id: rec._id, // keep any server id if present
        };
      }
      // legacy -> convert prompt/response to a 2-turn conversation
      return {
        traits: canonicalTraits(rec.traits || {}),
        mood: rec.mood || 'neutral',
        emotion: rec.emotion || 'none',
        nsfw: rec.nsfw ?? 0,
        conversation: [
          { speaker: 'user', text: String(rec.prompt ?? '') },
          { speaker: 'ai',   text: String(rec.response ?? '') },
        ],
        createdAt: rec.createdAt,
        _id: rec._id,
      };
    });
  }

  // ---------- UI ----------
  function appendBubble(text, cls, _meta, index) {
    decrypt(text, encryptKey).then(plainText => {
      console.log(plainText);
      const b = document.createElement('div');
      b.className = 'bubble ' + (hidden ? 'blur ' : '') + cls;

      b.innerHTML = String(plainText).replace(/\n/g, '<br/>');
    
  

    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.innerHTML = '⋮';
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof showContextMenu === 'function') {
        showContextMenu(e.pageX, e.pageY, index);
      }
    };

    b.appendChild(menuBtn);
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  });
}

  function renderChat(blocks) {
    chat.innerHTML = '';
    blocks.forEach((block, bi) => {
      (block.conversation || []).forEach((turn, ti) => {
        appendBubble(
          turn.text,
          turn.speaker === 'user' ? 'user' : 'ai',
          null,
          `${bi}:${ti}`
        );
      });
    });
  }

  // ---------- data loading ----------
  async function loadDatasets() {
    const r = await api('/api/datasets');
    datasetSelect.innerHTML = '<option value="">Select dataset</option>';
    (r.datasets || []).forEach(s => {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = s;
      datasetSelect.appendChild(o);
    });
  }

  async function createDataset(name) {
    const r = await api('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (r.error) return alert('Create error: ' + r.error);
    await loadDatasets();
    datasetSelect.value = name;
    window.currentDataset = name;
    await loadRecords(name);
  }

  async function loadRecords(name) {
    if (!name) return;
    const r = await api(`/api/datasets/${encodeURIComponent(name)}/records`);
    const blocks = normalizeToBlocks(r.records || []);
    conversationBlocks = blocks.slice();       // keep in-memory copy
    selectedDatasetJson = blocks.slice();      // what we’ll download
    const lastBlock = blocks[blocks.length - 1];
    updateBlock(lastBlock);
    renderChat(blocks);
  }

  function updateBlock(lastBlock, setParameters = true) {
    if (lastBlock && lastBlock.conversation.length > 0) {
      currentRole = lastBlock.conversation.slice(-1)[0].speaker;
      mood = lastBlock.mood || 'neutral';
      emotion = lastBlock.emotion || 'none';
      if (setParameters) {
        document.getElementById('mood').value = lastBlock.mood || 'neutral';
        document.getElementById('emotion').value = lastBlock.emotion || 'none';
        document.getElementById('nsfw').value = lastBlock.nsfw || 0;
        document.getElementById('trait_trust').value = lastBlock.traits.trust || 0;
        document.getElementById('trait_happiness').value = lastBlock.traits.happiness || 0;
        document.getElementById('trait_romantic').value = lastBlock.traits.romantic || 0;
        document.getElementById('trait_sad').value = lastBlock.traits.sad || 0;
        document.getElementById('trait_angry').value = lastBlock.traits.angry || 0;
        document.getElementById('trait_lust').value = lastBlock.traits.lust || 0;
      }
      document.getElementById('content').value = '';
      currentRole = currentRole === 'user' ? 'ai' : 'user';
      document.getElementById('content').focus();
      document.getElementById('content').scrollIntoView();
      document.getElementById('content').scrollTop = 0;
      document.getElementById('content').scrollLeft = 0;
      document.getElementById('content').placeholder = `Type your ${currentRole} message here...`;
    } else {
      currentRole = 'user';
      document.getElementById('content').value = '';
      document.getElementById('content').placeholder = 'Type your user message here...';
      if (setParameters) {  
        document.getElementById('mood').value = 'neutral';
        document.getElementById('emotion').value = 'none';
        document.getElementById('nsfw').value = 0;
        document.getElementById('trait_trust').value = 0.5;
        document.getElementById('trait_happiness').value = 0.5;
        document.getElementById('trait_romantic').value = 0;
        document.getElementById('trait_sad').value = 0;
        document.getElementById('trait_angry').value = 0;
        document.getElementById('trait_lust').value = 0;
      }
    }
  }

  document.getElementById('content').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('saveBtn').click();
    }
  });

  // ---------- save flow ----------
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const role = currentRole;
    let content = document.getElementById('content').value.trim();
    if (!content) return alert('Type something in the box');
    if (!datasetSelect.value) return alert('Select or create a dataset first');
    window.currentDataset = datasetSelect.value;

    const traits = readTraits();
    const mood = document.getElementById('mood').value;
    const emotion = document.getElementById('emotion').value;
    const nsfw = readNSFW();

    content = await encrypt(content, encryptKey) 

    // send message immediately
    const payload = { role, message: content, traits, mood, emotion, nsfw };
    const r = await api(`/api/datasets/${encodeURIComponent(window.currentDataset)}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // if r.matchesLastBlock then append to last block else create new block
    if (r.error) return alert('Save error: ' + r.error);
    if (r.matchesLastBlock) {
      // append to existing block
      const lastBlock = conversationBlocks[conversationBlocks.length - 1];
      lastBlock.conversation.push({ speaker: role, text: content });
      updateBlock(lastBlock, false);
    } else {
      // create new block
      const newBlock = {
        traits: canonicalTraits(traits),
        mood,
        emotion,
        nsfw,
        conversation: [{ speaker: role, text: content }],
        createdAt: new Date().toISOString(),
        _id: r._id // use server-provided ID if available
      };
      conversationBlocks.push(newBlock);
      selectedDatasetJson.push(newBlock);
    } 

    appendBubble(content, role === 'user' ? 'user' : 'ai');

    // reset input
    document.getElementById('content').value = '';
    
    // flip role if needed
    currentRole = role === 'user' ? 'ai' : 'user';
  });


  // ---------- header controls ----------
  createBtn.addEventListener('click', () => {
    newDatasetInput.style.display = 'inline-block';
    createConfirmBtn.style.display = 'inline-block';
    newDatasetInput.focus();
  });

  createConfirmBtn.addEventListener('click', async () => {
    const name = newDatasetInput.value.trim();
    if (!name) return alert('Enter a name');
    if (!/^[\w-]+$/.test(name)) return alert('Use letters, numbers, dash or underscore');
    await createDataset(name);
    newDatasetInput.value = '';
    newDatasetInput.style.display = 'none';
    createConfirmBtn.style.display = 'none';
  });

  datasetSelect.addEventListener('change', async () => {
    const v = datasetSelect.value;
    window.currentDataset = v;
    // pendingPrompt = null;
    // pendingLabel.textContent = 'none';
    if (v) await loadRecords(v);
    else {
      conversationBlocks = [];
      selectedDatasetJson = [];
      chat.innerHTML = '';
    }
  });

  // ---------- drawer ----------
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsDrawer = document.getElementById('settingsDrawer');
  const closeDrawer = document.getElementById('closeDrawer');

  if (settingsBtn && settingsDrawer && closeDrawer) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsDrawer.classList.add('open');
    });

    closeDrawer.addEventListener('click', () => {
      settingsDrawer.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
      if (
        settingsDrawer.classList.contains('open') &&
        !settingsDrawer.contains(e.target) &&
        e.target !== settingsBtn
      ) {
        settingsDrawer.classList.remove('open');
      }
    });
  }

  // ---------- download ----------
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const datasetName = datasetSelect.value;
      if (!datasetName) return alert('Please select a dataset first!');
      const blob = new Blob(
        [JSON.stringify(selectedDatasetJson, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = datasetName + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  let hidden = true;

  document.getElementById("hideChat").addEventListener("click", () => {
    const bubbles = document.querySelectorAll(".bubble");
    hidden = !hidden;
  
    bubbles.forEach(bubble => {
      if (hidden) {
        bubble.classList.add("blur");
      } else {
        bubble.classList.remove("blur");
      }
    });

    hideChatBtn.textContent = hidden ? "🙈" : "👁️";
    return true;
  });

    // --- base64 helpers ---
  function u8ToB64(u8) {
    let s = "";
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function b64ToU8(b64) {
    const s = atob(b64);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }

  // Derive key EXACTLY like Node: SHA-256(passphrase) -> 32 bytes
  async function getKeySha256(passphrase) {
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(passphrase));
    return crypto.subtle.importKey(
      "raw",
      digest,                    // 32 bytes
      { name: "AES-CBC" },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Encrypt to "ivBase64:cipherBase64"
  async function encrypt(plainText, passphrase) {
    const key = await getKeySha256(passphrase);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const data = new TextEncoder().encode(plainText);
    const buf = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, data);
    const cipherU8 = new Uint8Array(buf);
    return `${u8ToB64(iv)}:${u8ToB64(cipherU8)}`;
  }

  // Decrypt from "ivBase64:cipherBase64"
  async function decrypt(encryptedText, passphrase) {
    const [ivB64, ctB64] = encryptedText.split(":");
    const iv = b64ToU8(ivB64);
    const cipherU8 = b64ToU8(ctB64);
    const key = await getKeySha256(passphrase);
    const buf = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, cipherU8);
    return new TextDecoder().decode(buf);
  }


  // ---------- init ----------
  await loadDatasets();
})();
