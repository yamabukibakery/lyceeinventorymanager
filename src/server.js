const express = require('express');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const app = express();
const port = 8000;

// Global variable to track if fetch should be stopped
let shouldStopFetch = false;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// API endpoint to stop fetching
app.post('/api/stop-fetch', (req, res) => {
  shouldStopFetch = true;
  console.log('🛑 Stop signal received');
  res.json({ message: 'Stop signal sent' });
});

// API endpoint to fetch new cards
app.post('/api/fetch-cards', async (req, res) => {
  console.log('Starting card fetch process...');
  shouldStopFetch = false; // Reset stop flag
  try {
    const existingPath = path.join(__dirname, '../public/data/cards.json');
    const existingCards = fs.existsSync(existingPath)
      ? JSON.parse(fs.readFileSync(existingPath, 'utf-8'))
      : [];
    
    console.log(`Found ${existingCards.length} existing cards`);
    const knownIDs = new Set(existingCards.map(card => card.id));
    
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    console.log('Browser launched successfully');

    let pageNum = 1;
    const newCards = [];

    while (true) {
      if (shouldStopFetch) {
        console.log('🛑 Fetch process stopped by user');
        break;
      }

      const url = `https://lycee-tcg.com/card/?page=${pageNum}`;
      console.log(`Fetching page ${pageNum}...`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      console.log(`Page ${pageNum} loaded`);

      const cardsOnPage = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .filter(img => img.src.includes('lycee-tcg.com/card/image/'))
          .map(img => {
            const id = img.alt?.trim() || "UNKNOWN";
            const nameNode = img.parentElement?.nextElementSibling?.querySelector('div');
            const name = nameNode?.textContent?.trim() || id;
            return { id, name, image: img.src };
          });
      });

      console.log(`Found ${cardsOnPage.length} cards on page ${pageNum}`);
      const fresh = cardsOnPage.filter(card => !knownIDs.has(card.id));
      console.log(`${fresh.length} new cards found on page ${pageNum}`);

      if (cardsOnPage.length === 0 || fresh.length === 0) {
        console.log('✅ Reached end or all cards known. Stopping...');
        break;
      }

      newCards.push(...fresh);
      pageNum++;
    }

    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed');

    const merged = [...existingCards, ...newCards];
    console.log(`Writing ${merged.length} total cards to file...`);
    fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2));
    console.log('File written successfully');

    res.json({
      newCards: newCards.length,
      totalCards: merged.length,
      stopped: shouldStopFetch
    });

  } catch (error) {
    console.error('Error during card fetch:', error);
    res.status(500).json({ error: 'Failed to fetch new cards' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
}); 