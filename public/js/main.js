(async function(){
  const datasetSelect = document.getElementById('datasetSelect');
  const chat = document.getElementById('chat');
  const pendingLabel = document.getElementById('pendingLabel');
  const createBtn = document.getElementById('createBtn');
  const newDatasetInput = document.getElementById('newDatasetInput');
  const createConfirmBtn = document.getElementById('createConfirmBtn');
  let selectedDatasetJson = '';

  let pendingPrompt = null;
  window.currentDataset = '';
  let currentRole = 'user';


  async function api(path, opts) {
    const res = await fetch(path, opts);
    return res.json();
  }

  async function loadDatasets(){
    const r = await api('/api/datasets');
    datasetSelect.innerHTML = '<option value="">Select dataset</option>';
    r.datasets.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      datasetSelect.appendChild(o);
    });
  }

  async function createDataset(name){
    const r = await api('/api/datasets', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name})});
    if (r.error) return alert('Create error: ' + r.error);
    await loadDatasets();
    datasetSelect.value = name;
    window.currentDataset = name;
    await loadRecords(name);
  }

  async function loadRecords(name){
    if(!name) return;
    const r = await api(`/api/datasets/${encodeURIComponent(name)}/records`);
    selectedDatasetJson = JSON.stringify(r);
    renderChat(r.records || []);
  }

  function appendBubble(text, cls, meta, index) {
    const wrap = document.createElement('div');
    wrap.classList.add('chat-message');
    wrap.dataset.index = index;

    const b = document.createElement('div');
    b.className = 'bubble ' + cls;
    b.innerHTML = text.replace(/\n/g, '<br/>');

    // Burger button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.innerHTML = '⋮';
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      showContextMenu(e.pageX, e.pageY, index);
    };

    b.appendChild(menuBtn);
    wrap.appendChild(b);

    if (meta) {
      const m = document.createElement('div');
      m.className = 'meta';
      m.textContent = meta;
      wrap.appendChild(m);
    }

    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
  }


  function renderChat(records){
    chat.innerHTML = '';
    records.forEach((rec, i) => {
      appendBubble(rec.prompt, 'user', `mood: ${rec.mood} emotion: ${rec.emotion} traits: ${Object.entries(rec.traits||{}).map(([k,v])=>k+':'+v).join(', ')} nsfw:${rec.nsfw}`, i*2);
      appendBubble(rec.response, 'ai', `raw: ${rec.raw}`, i*2+1);
    });
  }


  document.getElementById('saveBtn').addEventListener('click', async ()=>{
    const role = currentRole;
    const content = document.getElementById('content').value.trim();
    if(!content) return alert('Type something in the box');

    if(!datasetSelect.value) return alert('Select or create a dataset first');
    window.currentDataset = datasetSelect.value;

    const traits = {
      trust: parseFloat(document.getElementById('trait_trust').value || 0).toFixed(2),
      happiness: parseFloat(document.getElementById('trait_happiness').value || 0).toFixed(2),
      romantic: parseFloat(document.getElementById('trait_romantic').value || 0).toFixed(2),
      sad: parseFloat(document.getElementById('trait_sad').value || 0).toFixed(2),
      angry: parseFloat(document.getElementById('trait_angry').value || 0).toFixed(2),
      lust: parseFloat(document.getElementById('trait_lust').value || 0).toFixed(2)
    };
    const mood = document.getElementById('mood').value;
    const emotion = document.getElementById('emotion').value;
    const nsfw = document.getElementById('nsfw').checked ? 2 : 0;

    if(role === 'user'){
      // save pending prompt locally first
      pendingPrompt = content;
      pendingLabel.textContent = content.slice(0,40);
      appendBubble(content, 'user', `pending - mood:${mood} emotion:${emotion}`);
      document.getElementById('content').value = '';
      currentRole = 'ai';
			document.getElementById('roleLabel').textContent = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);

      return;
    }

    // role is ai
    if(!pendingPrompt) return alert('No pending user prompt. First save the user message.');

    // push to server as a single record containing prompt+response
    const body = {
      prompt: pendingPrompt,
      response: content,
      traits,
      mood,
      emotion,
      nsfw
    };
    const r = await api(`/api/datasets/${encodeURIComponent(window.currentDataset)}/records`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if(r.error) return alert('Save error: ' + r.error);
    // reload records
    pendingPrompt = null;
    pendingLabel.textContent = 'none';
    document.getElementById('content').value = '';
    await loadRecords(window.currentDataset);
    
    // Toggle role automatically
    currentRole = "user";
    document.getElementById('roleLabel').textContent = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);

  });

  createBtn.addEventListener('click', ()=>{
    newDatasetInput.style.display = 'inline-block';
    createConfirmBtn.style.display = 'inline-block';
    newDatasetInput.focus();
  });

  createConfirmBtn.addEventListener('click', async ()=>{
    const name = newDatasetInput.value.trim();
    if(!name) return alert('Enter a name');
    // very simple sanitize: only allow alnum _ -
    if(!/^[\w-]+$/.test(name)) return alert('Use letters, numbers, dash or underscore');
    await createDataset(name);
    newDatasetInput.value = '';
    newDatasetInput.style.display = 'none';
    createConfirmBtn.style.display = 'none';
  });

  datasetSelect.addEventListener('change', async ()=>{
    const v = datasetSelect.value;
    window.currentDataset = v;
    pendingPrompt = null;
    pendingLabel.textContent = 'none';
    if(v) await loadRecords(v);
    else chat.innerHTML = '';
  });

  // Drawer toggle
const settingsBtn = document.getElementById("settingsBtn");
const settingsDrawer = document.getElementById("settingsDrawer");
const closeDrawer = document.getElementById("closeDrawer");

settingsBtn.addEventListener("click", () => {
  settingsDrawer.classList.add("open");
});

closeDrawer.addEventListener("click", () => {
  settingsDrawer.classList.remove("open");
});

// Clicking outside drawer closes it
document.addEventListener("click", (e) => {
  if (settingsDrawer.classList.contains("open") &&
      !settingsDrawer.contains(e.target) &&
      e.target !== settingsBtn) {
    settingsDrawer.classList.remove("open");
  }
});

  document.getElementById("downloadBtn").addEventListener("click", () => {
  const datasetName = document.getElementById("datasetSelect").value;
  if (!datasetName) {
    alert("Please select a dataset first!");
    return;
  }

  const blob = new Blob([JSON.stringify(selectedDatasetJson, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = datasetName + ".json";
  a.click();

  URL.revokeObjectURL(url);
});

  // init
  await loadDatasets();
})();
