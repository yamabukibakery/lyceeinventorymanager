// Add button functionality
const fetchButton = document.getElementById('fetch-cards');
const stopButton = document.getElementById('stop-fetch');

fetchButton.addEventListener('click', async () => {
  fetchButton.disabled = true;
  stopButton.disabled = false;
  fetchButton.textContent = 'Fetching...';
  
  try {
    const response = await fetch('/api/fetch-cards', { method: 'POST' });
    const result = await response.json();
    
    if (result.error) {
      alert('Error fetching cards: ' + result.error);
    } else {
      if (result.stopped) {
        alert(`Fetch stopped by user. Fetched ${result.newCards} new cards. Total cards: ${result.totalCards}`);
      } else {
        alert(`Successfully fetched ${result.newCards} new cards. Total cards: ${result.totalCards}`);
      }
      location.reload(); // Reload to show new cards
    }
  } catch (error) {
    alert('Error fetching cards: ' + error.message);
  } finally {
    fetchButton.disabled = false;
    stopButton.disabled = true;
    fetchButton.textContent = 'Fetch New Cards';
  }
});

stopButton.addEventListener('click', async () => {
  try {
    await fetch('/api/stop-fetch', { method: 'POST' });
    stopButton.disabled = true;
  } catch (error) {
    alert('Error stopping fetch: ' + error.message);
  }
});

// Load existing cards
fetch('data/cards.json')
  .then(res => res.json())
  .then(cards => {
    const container = document.getElementById('card-container');
    cards.forEach(card => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <h3>${card.name} (${card.id})</h3>
        <img src="${card.image}" width="150"><br>
        <label>Owned: </label>
        <input type="number" min="0" max="4" value="${getCount(card.id)}" onchange="updateCount('${card.id}', this.value)">
      `;
      if (getCount(card.id) > 0) div.classList.add('owned');
      container.appendChild(div);
    });
  });

function getCount(id) {
  return parseInt(localStorage.getItem(id)) || 0;
}

function updateCount(id, value) {
  localStorage.setItem(id, value);
  location.reload();
}
