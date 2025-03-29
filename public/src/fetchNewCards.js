
async function fetchNewCards() {
  const button = document.getElementById('fetchButton');
  const status = document.getElementById('fetchStatus');

  try {
    button.disabled = true;
    status.textContent = 'Fetching new cards...';
    status.className = 'status loading';

    const response = await fetch('/api/fetch-cards', { method: 'POST' });

    if (!response.ok) throw new Error('Fetch failed');

    const result = await response.json();
    status.textContent = `✅ Added ${result.newCards} new cards (Total: ${result.totalCards})`;
    status.className = 'status success';

    setTimeout(() => location.reload(), 2000);

  } catch (err) {
    status.textContent = '❌ ' + err.message;
    status.className = 'status error';
  } finally {
    button.disabled = false;
  }
}
