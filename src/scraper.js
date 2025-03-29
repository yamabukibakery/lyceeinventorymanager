const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

async function scrapeAndUpdateCards(shouldStop = () => false) {
  const filePath = path.join(__dirname, '../public/data/cards.json');

  // Load existing cards and remove any with UNKNOWN IDs
  const existingCards = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf-8')).filter(card => card.id !== "UNKNOWN")
    : [];

  console.log(`Found ${existingCards.length} existing cards`);
  const knownIDs = new Set(existingCards.map(card => card.id));
  
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewport to ensure all content is visible
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set user agent to avoid detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  console.log('Browser launched successfully');

  let pageNum = 1;
  const newCards = [];
  let consecutiveEmptyPages = 0;
  const MAX_EMPTY_PAGES = 3; // Stop after 3 consecutive empty pages

  while (true) {
    if (shouldStop()) {
      console.log('🛑 Fetch stopped by user');
      break;
    }

    const url = `https://lycee-tcg.com/card/?deck=&smenu=&recommend=&word=&cost_min=&cost_max=&ex_min=&ex_max=&ap_min=&ap_max=&dp_min=&dp_max=&sp_min=&sp_max=&dmg_min=&dmg_max=&sort=&limit=200&output=&page=${pageNum}&view=`;
    console.log(`🔍 Checking page ${pageNum}...`);
    
    try {
      // Navigate to the page and wait for network to be idle
      await page.goto(url, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000 
      });
      console.log(`Page ${pageNum} loaded`);

      // Wait for the card container to load
      await page.waitForSelector('a[href*="card_detail.pl"]', { 
        timeout: 30000,
        visible: true 
      }).catch(() => console.log('No cards found on page, might be the end'));

      // Scroll to bottom to ensure all content is loaded
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait a bit for any lazy-loaded content
      await page.waitForTimeout(2000);

      const cardsOnPage = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="card_detail.pl"]'))
          .map(link => {
            // Extract card ID from the href (card_detail.pl?cardno=LO-XXXX-X)
            const match = link.href.match(/cardno=(LO-\d{4}-[A-Z])/);
            if (!match) return null;
            
            const id = match[1];
            const img = link.querySelector('img');
            const name = link.textContent.trim();
            
            return {
              id,
              name,
              image: img ? img.src : null
            };
          })
          .filter(card => card && card.id && card.image); // Filter out any invalid entries
      });

      console.log(`Found ${cardsOnPage.length} valid cards on page ${pageNum}`);
      const fresh = cardsOnPage.filter(card => !knownIDs.has(card.id));
      console.log(`${fresh.length} new cards found on page ${pageNum}`);

      if (cardsOnPage.length === 0) {
        consecutiveEmptyPages++;
        console.log(`Empty page detected (${consecutiveEmptyPages}/${MAX_EMPTY_PAGES})`);
        if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
          console.log('Reached maximum number of consecutive empty pages. Stopping.');
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
        if (fresh.length === 0) {
          console.log('No new cards found on this page');
        } else {
          newCards.push(...fresh);
        }
      }

      pageNum++;
    } catch (error) {
      console.error(`Error on page ${pageNum}:`, error);
      break;
    }
  }

  console.log('Closing browser...');
  await browser.close();
  console.log('Browser closed');

  const merged = [...existingCards, ...newCards];
  console.log(`Writing ${merged.length} total cards to file...`);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  console.log('File written successfully');

  return {
    newCards: newCards.length,
    totalCards: merged.length
  };
}

module.exports = scrapeAndUpdateCards;
