const fetchButton = document.getElementById('fetch-cards');
const stopButton = document.getElementById('stop-fetch');
const fetchStatus = document.getElementById('fetch-status');
const cardContainer = document.getElementById('card-container');
const searchFilter = document.getElementById('search-filter');
const elementFilter = document.getElementById('element-filter');
const rarityFilter = document.getElementById('rarity-filter');
const seriesFilter = document.getElementById('series-filter');
const boosterFilter = document.getElementById('booster-filter');
const costFilter = document.getElementById('cost-filter');
const exFilter = document.getElementById('ex-filter');
const apFilter = document.getElementById('ap-filter');
const dpFilter = document.getElementById('dp-filter');
const spFilter = document.getElementById('sp-filter');
const dmgFilter = document.getElementById('dmg-filter');
const addPlaysetButton = document.getElementById('add-playset');
const resultsSummary = document.getElementById('results-summary');
const loadMoreButton = document.getElementById('load-more');
const textModal = document.getElementById('text-modal');
const textModalTitle = document.getElementById('text-modal-title');
const textModalId = document.getElementById('text-modal-id');
const textModalBody = document.getElementById('text-modal-body');
const textModalClose = document.getElementById('text-modal-close');

let isFetching = false;
let allCards = [];
let syncPollTimer = null;
let renderedCount = 120;
const RENDER_PAGE_SIZE = 120;
const filterContainers = {
  element: elementFilter,
  rarity: rarityFilter,
  series: seriesFilter,
  booster: boosterFilter,
  cost: costFilter,
  ex: exFilter,
  ap: apFilter,
  dp: dpFilter,
  sp: spFilter,
  dmg: dmgFilter
};
const ELEMENT_OPTIONS = ['雪', '月', '花', '日', '宙', '無'];
const SERIES_OPTIONS = ['TM', 'VA', 'BXB', 'GUP', 'KHP', 'YUZ', 'AIG', 'TOA', 'AQP', 'AUG', 'SP', 'NEX', 'OSP', 'PUR', 'TW', 'HOK', 'GIG', 'NAV', 'AL'];
const RARITY_OPTIONS = ['P', 'KR', 'SR', 'R', 'U', 'C'];
const SMALL_STAT_OPTIONS = ['0', '1', '2', '3', '4', '5', '6'];
const POWER_STAT_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const COST_OPTIONS = ['0', '1', '2', '3', '4', '5', '6'];

function setStatus(message, className = '') {
  fetchStatus.textContent = message;
  fetchStatus.className = `status ${className}`.trim();
}

async function loadCards() {
  const response = await fetch('/data/cards.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load cards');
  }

  allCards = (await response.json()).map(card => ({
    ...card,
    series: extractSeries(card),
    booster: card.version || '',
    costValue: normalizeCost(card.cost),
    exValue: cleanStat(card.ex),
    apValue: cleanStat(card.ap),
    dpValue: cleanStat(card.dp),
    spValue: cleanStat(card.sp),
    dmgValue: cleanStat(card.dmg),
    searchText: `${card.name || ''} ${card.id || ''}`.toLowerCase()
  }));

  populateFilters(allCards);
  renderedCount = RENDER_PAGE_SIZE;
  renderCards();
  return allCards;
}

function renderCards() {
  const cards = getFilteredCards();
  const visibleCards = cards.slice(0, renderedCount);
  cardContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();

  visibleCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div class="card-media">
        <img src="${card.image}" alt="${card.name}" loading="lazy">
      </div>
      <div class="card-body">
        <div class="card-head">
          <p class="card-id">${card.id}</p>
          <h3>${card.name}</h3>
        </div>
        <p class="card-meta">${formatMeta(card)}</p>
        <div class="card-text-shell">
          <pre class="card-text${card.originalTextDisplay ? '' : ' card-text-empty'}">${card.originalTextDisplay || 'Official Japanese card text will appear after the next successful full sync.'}</pre>
          <button class="text-expand-button secondary-button" type="button" data-card-id="${card.id}">Read Text</button>
        </div>
        <div class="card-footer">
          <label class="owned-field">
            <span>Owned</span>
            <input type="number" min="0" max="4" value="${getCount(card.id)}" onchange="updateCount('${card.id}', this.value)">
          </label>
        </div>
      </div>
    `;

    if (getCount(card.id) > 0) {
      div.classList.add('owned');
    }

    fragment.appendChild(div);
  });

  cardContainer.appendChild(fragment);
  resultsSummary.textContent = `Showing ${visibleCards.length} of ${cards.length} matching cards`;
  loadMoreButton.hidden = visibleCards.length >= cards.length;
  loadMoreButton.disabled = visibleCards.length >= cards.length;
  addPlaysetButton.disabled = getSelectedValues(boosterFilter).length !== 1;
}

async function startSync({ auto = false } = {}) {
  if (isFetching) {
    return;
  }

  isFetching = true;
  fetchButton.disabled = true;
  stopButton.disabled = false;
  fetchButton.textContent = 'Syncing...';
  setStatus(auto ? 'Starting background sync...' : 'Starting sync...', 'loading');

  try {
    const response = await fetch('/api/fetch-cards', { method: 'POST' });
    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || 'Failed to start sync');
    }

    beginStatusPolling();
  } catch (error) {
    isFetching = false;
    fetchButton.disabled = false;
    stopButton.disabled = true;
    fetchButton.textContent = 'Sync Cards';
    setStatus(`Error fetching cards: ${error.message}`, 'error');
  }
}

function beginStatusPolling() {
  stopStatusPolling();
  pollSyncStatus();
  syncPollTimer = setInterval(pollSyncStatus, 2000);
}

function stopStatusPolling() {
  if (syncPollTimer) {
    clearInterval(syncPollTimer);
    syncPollTimer = null;
  }
}

async function pollSyncStatus() {
  try {
    const response = await fetch('/api/sync-status', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to read sync status');
    }

    const status = await response.json();
    updateSyncUi(status);

    if (!status.running) {
      stopStatusPolling();
      isFetching = false;
      fetchButton.disabled = false;
      stopButton.disabled = true;
      fetchButton.textContent = 'Sync Cards';

      if (status.stage === 'complete' || status.stage === 'saved' || status.stage === 'stopped') {
        await loadCards();
      }
    }
  } catch (error) {
    stopStatusPolling();
    isFetching = false;
    fetchButton.disabled = false;
    stopButton.disabled = true;
    fetchButton.textContent = 'Sync Cards';
    setStatus(`Error reading sync status: ${error.message}`, 'error');
  }
}

function updateSyncUi(status) {
  if (status.running) {
    const pageText = status.page ? ` Page ${status.page}.` : '';
    const newCardsText = typeof status.newCards === 'number' ? ` New cards: ${status.newCards}.` : '';
    setStatus(`${status.message || 'Syncing...'}${pageText}${newCardsText}`, 'loading');
    return;
  }

  if (status.stage === 'error') {
    setStatus(`Sync failed: ${status.error || status.message || 'Unknown error'}`, 'error');
    return;
  }

  if (status.stage === 'stopped') {
    setStatus(`Sync stopped. Added ${status.newCards || 0} new cards. Total cards: ${status.totalCards || allCards.length}.`, 'success');
    return;
  }

  if (status.stage === 'complete' || status.stage === 'saved') {
    setStatus(`Sync complete. Added ${status.newCards || 0} new cards. Total cards: ${status.totalCards || allCards.length}.`, 'success');
  }
}

fetchButton.addEventListener('click', () => {
  startSync();
});

stopButton.addEventListener('click', async () => {
  try {
    await fetch('/api/stop-fetch', { method: 'POST' });
    stopButton.disabled = true;
    setStatus('Stopping fetch after the current page finishes...', 'loading');
  } catch (error) {
    setStatus(`Error stopping fetch: ${error.message}`, 'error');
  }
});

loadCards()
  .then(cards => {
    if (shouldAutoSync(cards)) {
      startSync({ auto: true });
    } else {
      pollSyncStatus();
    }
  })
  .catch(error => {
    setStatus(`Error loading cards: ${error.message}`, 'error');
  });

function shouldAutoSync(cards) {
  if (cards.length === 0) {
    return true;
  }

  if (!cards.some(card => card.originalTextDisplay)) {
    return true;
  }

  const lastSync = Number(localStorage.getItem('lycee_last_auto_sync_at') || 0);
  const now = Date.now();

  if (now - lastSync > 1000 * 60 * 60 * 6) {
    localStorage.setItem('lycee_last_auto_sync_at', String(now));
    return true;
  }

  return false;
}

function getCount(id) {
  return parseInt(localStorage.getItem(id), 10) || 0;
}

function formatMeta(card) {
  const parts = [
    extractIpCode(card),
    card.category,
    card.rarity,
    card.attribute,
    card.cost ? `Cost ${card.cost}` : '',
    card.ex ? `EX ${card.ex}` : '',
    card.ap ? `AP ${card.ap}` : '',
    card.dp ? `DP ${card.dp}` : '',
    card.sp ? `SP ${card.sp}` : '',
    card.dmg ? `DMG ${card.dmg}` : '',
    card.version
  ];

  return parts.filter(Boolean).join(' • ');
}

function populateFilters(cards) {
  setOptions(elementFilter, [...ELEMENT_OPTIONS, ...cards.map(card => card.attribute)], compareLocaleJa);
  setOptions(rarityFilter, [...RARITY_OPTIONS, ...cards.map(card => card.rarity)], compareRarity);
  setOptions(seriesFilter, [...SERIES_OPTIONS, ...cards.map(card => card.series).filter(Boolean)], compareLocaleJa);
  setOptions(boosterFilter, cards.map(card => card.booster).filter(Boolean), compareLocaleJa);
  setOptions(costFilter, [...COST_OPTIONS, ...cards.map(card => card.costValue).filter(Boolean)], compareNumericStrings);
  setOptions(exFilter, [...SMALL_STAT_OPTIONS, ...cards.map(card => card.exValue).filter(Boolean)], compareNumericStrings);
  setOptions(apFilter, [...POWER_STAT_OPTIONS, ...cards.map(card => card.apValue).filter(Boolean)], compareNumericStrings);
  setOptions(dpFilter, [...POWER_STAT_OPTIONS, ...cards.map(card => card.dpValue).filter(Boolean)], compareNumericStrings);
  setOptions(spFilter, [...SMALL_STAT_OPTIONS, ...cards.map(card => card.spValue).filter(Boolean)], compareNumericStrings);
  setOptions(dmgFilter, [...SMALL_STAT_OPTIONS, ...cards.map(card => card.dmgValue).filter(Boolean)], compareNumericStrings);
}

function setOptions(container, values, sorter = compareLocaleJa) {
  const currentValues = new Set(getSelectedValues(container));
  const uniqueValues = [...new Set(values.filter(Boolean))].sort(sorter);
  const summaryLabel = container.dataset.label || 'Options';
  container.innerHTML = '';

  const details = document.createElement('details');
  details.className = 'filter-dropdown';
  if (currentValues.size > 0) {
    details.open = true;
  }

  const summary = document.createElement('summary');
  summary.className = 'filter-summary';
  summary.textContent = currentValues.size > 0
    ? `${summaryLabel}: ${Array.from(currentValues).slice(0, 2).join(', ')}${currentValues.size > 2 ? ` +${currentValues.size - 2}` : ''}`
    : `All ${summaryLabel}`;
  details.appendChild(summary);

  const list = document.createElement('div');
  list.className = 'checkbox-list';

  uniqueValues.forEach(value => {
    const label = document.createElement('label');
    label.className = 'checkbox-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = value;
    input.checked = currentValues.has(value);

    const text = document.createElement('span');
    text.textContent = value;

    label.appendChild(input);
    label.appendChild(text);
    list.appendChild(label);
  });

  details.appendChild(list);
  container.appendChild(details);
}

function getSelectedValues(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
}

function extractIpCode(card) {
  const match = (card.version || '').match(/\(([A-Z0-9]+)\)/);
  return match ? match[1] : '';
}

function extractSeries(card) {
  return extractIpCode(card) || '';
}

function normalizeCost(cost) {
  if (!cost) {
    return '';
  }

  const compact = String(cost).replace(/\s+/g, '');
  if (/^\d+$/.test(compact)) {
    return compact;
  }

  return String(compact.length);
}

function cleanStat(value) {
  return value == null ? '' : String(value).trim();
}

function compareNumericStrings(a, b) {
  return Number(a) - Number(b);
}

function compareLocaleJa(a, b) {
  return a.localeCompare(b, 'ja');
}

function compareRarity(a, b) {
  const order = new Map(RARITY_OPTIONS.map((value, index) => [value, index]));
  const aRank = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
  const bRank = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;

  if (aRank !== bRank) {
    return aRank - bRank;
  }

  return compareLocaleJa(a, b);
}

function getFilteredCards() {
  const query = searchFilter.value.trim().toLowerCase();
  const elementValues = new Set(getSelectedValues(elementFilter));
  const rarityValues = new Set(getSelectedValues(rarityFilter));
  const seriesValues = new Set(getSelectedValues(seriesFilter));
  const boosterValues = new Set(getSelectedValues(boosterFilter));
  const costValues = new Set(getSelectedValues(costFilter));
  const exValues = new Set(getSelectedValues(exFilter));
  const apValues = new Set(getSelectedValues(apFilter));
  const dpValues = new Set(getSelectedValues(dpFilter));
  const spValues = new Set(getSelectedValues(spFilter));
  const dmgValues = new Set(getSelectedValues(dmgFilter));

  return allCards.filter(card => {
    const matchesQuery = !query || card.searchText.includes(query);
    const matchesElement = elementValues.size === 0 || elementValues.has(card.attribute);
    const matchesRarity = rarityValues.size === 0 || rarityValues.has(card.rarity);
    const matchesSeries = seriesValues.size === 0 || seriesValues.has(card.series);
    const matchesBooster = boosterValues.size === 0 || boosterValues.has(card.booster);
    const matchesCost = costValues.size === 0 || costValues.has(card.costValue);
    const matchesEx = exValues.size === 0 || exValues.has(card.exValue);
    const matchesAp = apValues.size === 0 || apValues.has(card.apValue);
    const matchesDp = dpValues.size === 0 || dpValues.has(card.dpValue);
    const matchesSp = spValues.size === 0 || spValues.has(card.spValue);
    const matchesDmg = dmgValues.size === 0 || dmgValues.has(card.dmgValue);
    return matchesQuery && matchesElement && matchesRarity && matchesSeries && matchesBooster && matchesCost && matchesEx && matchesAp && matchesDp && matchesSp && matchesDmg;
  });
}

function updateCount(id, value) {
  localStorage.setItem(id, value);
  renderCards();
}

Object.values(filterContainers).forEach(container => {
  container.addEventListener('change', event => {
    if (event.target.matches('input[type="checkbox"]')) {
      renderedCount = RENDER_PAGE_SIZE;
      renderCards();
    }
  });
});

searchFilter.addEventListener('input', () => {
  renderedCount = RENDER_PAGE_SIZE;
  renderCards();
});

loadMoreButton.addEventListener('click', () => {
  renderedCount += RENDER_PAGE_SIZE;
  renderCards();
});

addPlaysetButton.addEventListener('click', () => {
  const selectedBoosters = getSelectedValues(boosterFilter);
  if (selectedBoosters.length !== 1) {
    setStatus('Select exactly one booster first to add a playset.', 'error');
    return;
  }

  const booster = selectedBoosters[0];
  const playsetCards = allCards.filter(card => card.booster === booster && ['SR', 'R', 'U', 'C'].includes(card.rarity));
  playsetCards.forEach(card => {
    localStorage.setItem(card.id, '4');
  });
  setStatus(`Added playset entries for ${playsetCards.length} base-rarity cards from ${booster}.`, 'success');
  renderCards();
});

cardContainer.addEventListener('click', event => {
  const button = event.target.closest('.text-expand-button');
  if (!button) {
    return;
  }

  const card = allCards.find(item => item.id === button.dataset.cardId);
  if (!card) {
    return;
  }

  textModalId.textContent = card.id;
  textModalTitle.textContent = card.name;
  textModalBody.textContent = card.originalTextDisplay || 'Official Japanese card text will appear after the next successful full sync.';
  textModal.showModal();
});

textModalClose.addEventListener('click', () => {
  textModal.close();
});

textModal.addEventListener('click', event => {
  if (event.target === textModal) {
    textModal.close();
  }
});
