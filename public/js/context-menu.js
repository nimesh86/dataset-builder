// context-menu.js
function showContextMenu(x, y, index) {
  let menu = document.getElementById('contextMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'contextMenu';
    menu.className = 'context-menu';
    document.body.appendChild(menu);
  }
  menu.innerHTML = `
    <div data-action="delete" data-index="${index}">Delete from here</div>
    <div data-action="branch" data-index="${index}">Create branch from here</div>
    <div data-action="edit" data-index="${index}">Edit</div>
  `;
  menu.style.top = y + 'px';
  menu.style.left = x + 'px';
  menu.style.display = 'block';
}

// Hide menu on outside click
document.addEventListener('click', () => {
  const menu = document.getElementById('contextMenu');
  if (menu) menu.style.display = 'none';
});

document.body.addEventListener('click', async (e) => {
  if (e.target.closest('#contextMenu div')) {
    const action = e.target.dataset.action;
    const index = parseInt(e.target.dataset.index);

    if (action === 'delete') {
      await deleteFromIndex(index);
    }

    if (action === 'branch') {
      await createBranch(index);
    }

    if (action === 'edit') {
      await editRecord(index);
    }
  }
});

// DELETE
function deleteFromIndex(index) {
  if (!confirm(`Delete all records from index ${index} onwards?`)) return;
  return fetch(`/api/datasets/${window.currentDataset}/records/${index}`, {
    method: 'DELETE'
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Deleted successfully');
        loadRecords(window.currentDataset);
      } else {
        alert(data.error || 'Error deleting records');
      }
    });
}

// EDIT
function editRecord(index) {
  const newPrompt = prompt("Enter new prompt:");
  const newResponse = prompt("Enter new response:");
  return fetch(`/api/datasets/${window.currentDataset}/records/${index}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: newPrompt, response: newResponse })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Record updated');
        loadRecords(window.currentDataset);
      } else {
        alert(data.error || 'Error updating record');
      }
    });
}

// CREATE BRANCH
function createBranch(index) {
  const newName = prompt("Enter name for new dataset branch:");
  return fetch(`/api/datasets/${window.currentDataset}/branch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, newName })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert(`Branch '${newName}' created`);
        loadRecords(newName);
      } else {
        alert(data.error || 'Error creating branch');
      }
    });
}
