fetch('../public/data/cards.json')
  .then(res => res.json())
  .then(cards => {
    const container = document.getElementById('inventory-list');
    cards.forEach(card => {
      const count = parseInt(localStorage.getItem(card.id));
      if (count && count > 0) {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <h3>${card.name} (${card.id}) - x${count}</h3>
          <img src="${card.image}" width="150">
        `;
        container.appendChild(div);
      }
    });
  });

function exportInventory() {
  let csv = 'CardID,Quantity\n';
  for (let key in localStorage) {
    const val = localStorage.getItem(key);
    if (parseInt(val) > 0) csv += `${key},${val}\n`;
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'lycee_inventory.csv';
  link.click();
}
