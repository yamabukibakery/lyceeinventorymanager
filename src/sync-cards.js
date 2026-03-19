const scrapeAndUpdateCards = require('./scraper');

(async () => {
  const result = await scrapeAndUpdateCards();
  console.log(`Sync complete. New cards: ${result.newCards}. Total cards: ${result.totalCards}.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
