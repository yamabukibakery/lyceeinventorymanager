const inventoryList = document.getElementById('inventory-list');
const inventorySummary = document.getElementById('inventory-summary');
const inventorySearch = document.getElementById('inventory-search');
const elementFilter = document.getElementById('inventory-element');
const rarityFilter = document.getElementById('inventory-rarity');
const seriesFilter = document.getElementById('inventory-series');
const boosterFilter = document.getElementById('inventory-booster');
const costFilter = document.getElementById('inventory-cost');
const textModal = document.getElementById('text-modal');
const textModalTitle = document.getElementById('text-modal-title');
const textModalId = document.getElementById('text-modal-id');
const textModalBody = document.getElementById('text-modal-body');
const textModalClose = document.getElementById('text-modal-close');

const filterContainers = [
  elementFilter,
  rarityFilter,
  seriesFilter,
  boosterFilter,
  costFilter
];

let ownedCards = [];

fetch('/data/cards.json')
  .then(res => res.json())
  .then(cards => {
    ownedCards = cards
      .map(card => {
        const count = parseInt(localStorage.getItem(card.id), 10) || 0;
        return {
          ...card,
          count,
          series: extractSeries(card),
          booster: card.version || '',
          costValue: normalizeCost(card.cost),
          searchText: `${card.name || ''} ${card.id || ''}`.toLowerCase()
        };
      })
      .filter(card => card.count > 0);

    populateFilters(ownedCards);
    renderInventory();
  })
  .catch(error => {
    inventoryList.textContent = `Error loading inventory: ${error.message}`;
  });

function renderInventory() {
  const filteredCards = getFilteredCards();
  inventoryList.innerHTML = '';
  const fragment = document.createDocumentFragment();

  filteredCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card owned';
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
          <pre class="card-text${card.originalTextDisplay ? '' : ' card-text-empty'}">${card.originalTextDisplay || 'No official text cached for this card yet.'}</pre>
          <button class="text-expand-button secondary-button" type="button" data-card-id="${card.id}">Read Text</button>
        </div>
        <div class="card-footer">
          <label class="owned-field">
            <span>Owned</span>
            <input type="number" min="0" max="99" value="${card.count}" onchange="updateInventoryCount('${card.id}', this.value)">
          </label>
        </div>
      </div>
    `;
    fragment.appendChild(div);
  });

  inventoryList.appendChild(fragment);
  inventorySummary.textContent = `${filteredCards.length} owned card${filteredCards.length === 1 ? '' : 's'} shown`;
}

function populateFilters(cards) {
  setOptions(elementFilter, cards.map(card => card.attribute));
  setOptions(rarityFilter, cards.map(card => card.rarity), compareRarity);
  setOptions(seriesFilter, cards.map(card => card.series));
  setOptions(boosterFilter, cards.map(card => card.booster));
  setOptions(costFilter, cards.map(card => card.costValue), compareNumericStrings);
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

function getFilteredCards() {
  const query = inventorySearch.value.trim().toLowerCase();
  const selectedElements = new Set(getSelectedValues(elementFilter));
  const selectedRarities = new Set(getSelectedValues(rarityFilter));
  const selectedSeries = new Set(getSelectedValues(seriesFilter));
  const selectedBoosters = new Set(getSelectedValues(boosterFilter));
  const selectedCosts = new Set(getSelectedValues(costFilter));

  return ownedCards.filter(card => {
    const matchesQuery = !query || card.searchText.includes(query);
    const matchesElement = selectedElements.size === 0 || selectedElements.has(card.attribute);
    const matchesRarity = selectedRarities.size === 0 || selectedRarities.has(card.rarity);
    const matchesSeries = selectedSeries.size === 0 || selectedSeries.has(card.series);
    const matchesBooster = selectedBoosters.size === 0 || selectedBoosters.has(card.booster);
    const matchesCost = selectedCosts.size === 0 || selectedCosts.has(card.costValue);
    return matchesQuery && matchesElement && matchesRarity && matchesSeries && matchesBooster && matchesCost;
  });
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

function formatMeta(card) {
  const parts = [
    card.series,
    card.category,
    card.rarity,
    card.attribute,
    card.cost ? `Cost ${card.cost}` : '',
    card.ex ? `EX ${card.ex}` : '',
    card.ap ? `AP ${card.ap}` : '',
    card.dp ? `DP ${card.dp}` : '',
    card.sp ? `SP ${card.sp}` : '',
    card.dmg ? `DMG ${card.dmg}` : '',
    card.booster
  ];

  return parts.filter(Boolean).join(' • ');
}

function compareLocaleJa(a, b) {
  return a.localeCompare(b, 'ja');
}

function compareNumericStrings(a, b) {
  return Number(a) - Number(b);
}

function compareRarity(a, b) {
  const order = new Map(['P', 'KR', 'SR', 'R', 'U', 'C'].map((value, index) => [value, index]));
  const aRank = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
  const bRank = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;
  if (aRank !== bRank) {
    return aRank - bRank;
  }
  return compareLocaleJa(a, b);
}

function updateInventoryCount(id, value) {
  const normalized = String(Math.max(0, parseInt(value, 10) || 0));
  localStorage.setItem(id, normalized);
  const target = ownedCards.find(card => card.id === id);
  if (target) {
    target.count = parseInt(normalized, 10);
  }
  ownedCards = ownedCards.filter(card => card.count > 0);
  populateFilters(ownedCards);
  renderInventory();
}

filterContainers.forEach(container => {
  container.addEventListener('change', event => {
    if (event.target.matches('input[type="checkbox"]')) {
      renderInventory();
    }
  });
});

inventorySearch.addEventListener('input', renderInventory);

inventoryList.addEventListener('click', event => {
  const button = event.target.closest('.text-expand-button');
  if (!button) {
    return;
  }

  const card = ownedCards.find(item => item.id === button.dataset.cardId);
  if (!card) {
    return;
  }

  textModalId.textContent = card.id;
  textModalTitle.textContent = card.name;
  textModalBody.textContent = card.originalTextDisplay || 'No official text cached for this card yet.';
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

function exportInventory() {
  let csv = 'CardID,CardName,Quantity\n';
  ownedCards.forEach(card => {
    csv += `${card.id},"${card.name.replace(/"/g, '""')}",${card.count}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'lycee_inventory.csv';
  link.click();
}

window.exportInventory = exportInventory;
window.updateInventoryCount = updateInventoryCount;
