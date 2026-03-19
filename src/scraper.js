const fs = require('fs');
const path = require('path');

const CARD_LIST_URL = 'https://lycee-tcg.com/card/';
const PAGE_SIZE = 200;
const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 2;

function decodeHtml(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTextLines(value) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

async function fetchPageHtml(pageNum) {
  const url = `${CARD_LIST_URL}?page=${pageNum}&limit=${PAGE_SIZE}`;
  let lastError;

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page ${pageNum}: ${response.status}`);
      }

      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt === FETCH_RETRIES) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new Error(`Timed out while fetching page ${pageNum}`);
  }

  throw lastError;
}

function parseCardsFromHtml(html) {
  const cards = [];
  const chunks = html.split(/<tr>\s*<td rowspan="5"[^>]*>/i).slice(1);

  for (const chunk of chunks) {
    const imageMatch = chunk.match(/<img src="([^"]+)"/i);
    const firstRowMatch = chunk.match(
      /<td width="100">(LO-\d{4}(?:-[A-Z])?)<\/td>\s*<td colspan="7"[^>]*><a href="\.\/card_detail\.pl\?cardno=[^"]+">([\s\S]*?)<\/a><\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/i
    );
    const metaRowMatch = chunk.match(
      /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td colspan="2">([\s\S]*?)<\/td>\s*<\/tr>/i
    );
    const textMatch = chunk.match(/<tr>\s*<td colspan="10"[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/i);
    const versionMatch = chunk.match(/Version : ([\s\S]*?)<\/td>/i);
    const illustratorMatch = chunk.match(/illust : ([\s\S]*?)<\/td>/i);

    if (!imageMatch || !firstRowMatch || !metaRowMatch || !textMatch) {
      continue;
    }

    const imagePath = imageMatch[1];
    const id = firstRowMatch[1];
    const name = stripTags(firstRowMatch[2]);
    const category = stripTags(firstRowMatch[3]);
    const rarity = stripTags(firstRowMatch[4]);
    const attribute = stripTags(metaRowMatch[1]);
    const ex = stripTags(metaRowMatch[2]);
    const cost = stripTags(metaRowMatch[3]);
    const restriction = stripTags(metaRowMatch[4]);
    const ap = stripTags(metaRowMatch[5]);
    const dp = stripTags(metaRowMatch[6]);
    const sp = stripTags(metaRowMatch[7]);
    const dmg = stripTags(metaRowMatch[8]);
    const types = stripTags(metaRowMatch[9]);
    const bodyLines = splitTextLines(textMatch[1]);
    const version = versionMatch ? stripTags(versionMatch[1]) : '';
    const illustrator = illustratorMatch ? stripTags(illustratorMatch[1]) : '';
    const originalText = bodyLines.filter(line => !/^初出\s*:/.test(line) && !/^\[.*カードを使用したデッキ/.test(line));
    const release = bodyLines.find(line => /^初出\s*:/.test(line)) || '';

    cards.push({
      id,
      name: name || id,
      image: new URL(imagePath, CARD_LIST_URL).href,
      category,
      rarity,
      attribute,
      ex,
      cost,
      restriction,
      ap,
      dp,
      sp,
      dmg,
      types,
      version,
      illustrator,
      release,
      originalText,
      originalTextDisplay: originalText.join('\n')
    });
  }

  return cards;
}

async function scrapeAndUpdateCards(shouldStop = () => false, onProgress = () => {}) {
  const filePath = path.join(__dirname, '../public/data/cards.json');
  const existingCards = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf-8')).filter(card => card.id !== 'UNKNOWN')
    : [];

  console.log(`Found ${existingCards.length} existing cards`);
  onProgress({ stage: 'starting', existingCards: existingCards.length, page: 0, message: `Found ${existingCards.length} existing cards` });

  const cardMap = new Map(existingCards.map(card => [card.id, card]));
  const knownIDs = new Set(existingCards.map(card => card.id));
  const newCards = [];
  const needsFullRefresh = existingCards.some(card => !card.originalTextDisplay);
  let pageNum = 1;
  let consecutiveEmptyPages = 0;
  let consecutiveKnownPages = 0;
  let stopped = false;
  const maxEmptyPages = 2;
  const maxKnownPages = 3;

  while (true) {
    if (shouldStop()) {
      console.log('Fetch stopped by user');
      stopped = true;
      onProgress({ stage: 'stopped', page: pageNum, message: 'Fetch stopped by user', newCards: newCards.length });
      break;
    }

    console.log(`Checking page ${pageNum}...`);
    onProgress({ stage: 'fetching', page: pageNum, message: `Checking page ${pageNum}...`, newCards: newCards.length });

    try {
      const html = await fetchPageHtml(pageNum);
      const cardsOnPage = parseCardsFromHtml(html);

      console.log(`Found ${cardsOnPage.length} valid cards on page ${pageNum}`);
      onProgress({
        stage: 'parsed',
        page: pageNum,
        message: `Found ${cardsOnPage.length} valid cards on page ${pageNum}`,
        pageCards: cardsOnPage.length,
        newCards: newCards.length
      });

      if (cardsOnPage.length === 0) {
        consecutiveEmptyPages += 1;
        if (consecutiveEmptyPages >= maxEmptyPages) {
          console.log('Reached the end of the result set.');
          onProgress({ stage: 'complete', page: pageNum, message: 'Reached the end of the result set.', newCards: newCards.length });
          break;
        }

        pageNum += 1;
        continue;
      }

      consecutiveEmptyPages = 0;
      cardsOnPage.forEach(card => {
        cardMap.set(card.id, card);
      });
      const freshCards = cardsOnPage.filter(card => !knownIDs.has(card.id));

      if (freshCards.length === 0) {
        console.log('No new cards found on this page');
        onProgress({ stage: 'parsed', page: pageNum, message: `No new cards found on page ${pageNum}`, pageCards: cardsOnPage.length, newCards: newCards.length });
        consecutiveKnownPages += 1;
        if (!needsFullRefresh && consecutiveKnownPages >= maxKnownPages) {
          console.log('Reached several pages with no new cards. Stopping early.');
          onProgress({ stage: 'complete', page: pageNum, message: 'Reached several pages with no new cards. Stopping early.', newCards: newCards.length });
          break;
        }
      } else {
        consecutiveKnownPages = 0;
        freshCards.forEach(card => knownIDs.add(card.id));
        newCards.push(...freshCards);
        console.log(`Added ${freshCards.length} new cards from page ${pageNum}`);
        onProgress({
          stage: 'parsed',
          page: pageNum,
          message: `Added ${freshCards.length} new cards from page ${pageNum}`,
          pageCards: cardsOnPage.length,
          newCards: newCards.length
        });
      }

      fs.writeFileSync(filePath, JSON.stringify(Array.from(cardMap.values()), null, 2));
      pageNum += 1;
    } catch (error) {
      console.error(`Error on page ${pageNum}:`, error);
      onProgress({ stage: 'error', page: pageNum, message: error.message, newCards: newCards.length });
      break;
    }
  }

  const merged = Array.from(cardMap.values());
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  console.log(`Wrote ${merged.length} total cards to ${filePath}`);
  onProgress({ stage: 'saved', page: pageNum, message: `Wrote ${merged.length} total cards`, totalCards: merged.length, newCards: newCards.length });

  return {
    newCards: newCards.length,
    totalCards: merged.length,
    stopped
  };
}

module.exports = scrapeAndUpdateCards;
