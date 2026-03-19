const express = require('express');
const path = require('path');
const scrapeAndUpdateCards = require('./scraper');
const { ensureDataDir, readCards, getCardsFilePath } = require('./card-store');

const app = express();
const port = Number(process.env.PORT) || 8000;
let shouldStopFetch = false;
let activeFetchPromise = null;
let syncState = {
  running: false,
  stage: 'idle',
  page: 0,
  message: 'Idle',
  newCards: 0,
  totalCards: 0,
  startedAt: null,
  finishedAt: null,
  error: null
};

function updateSyncState(patch) {
  syncState = {
    ...syncState,
    ...patch
  };
}

ensureDataDir();

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    dataFile: getCardsFilePath(),
    totalCards: readCards().length
  });
});

app.get('/api/cards', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(readCards());
});

app.post('/api/stop-fetch', (req, res) => {
  shouldStopFetch = true;
  console.log('Stop signal received');
  res.json({ message: 'Stop signal sent' });
});

app.post('/api/fetch-cards', async (req, res) => {
  try {
    if (!activeFetchPromise) {
      console.log('Starting card fetch process...');
      shouldStopFetch = false;
      updateSyncState({
        running: true,
        stage: 'starting',
        page: 0,
        message: 'Starting card fetch process...',
        newCards: 0,
        error: null,
        startedAt: new Date().toISOString(),
        finishedAt: null
      });
      activeFetchPromise = scrapeAndUpdateCards(
        () => shouldStopFetch,
        progress => {
          updateSyncState({
            ...progress,
            running: progress.stage !== 'saved' && progress.stage !== 'complete' && progress.stage !== 'stopped' && progress.stage !== 'error'
          });
        }
      )
        .then(result => {
          updateSyncState({
            running: false,
            stage: result.stopped ? 'stopped' : 'complete',
            message: result.stopped ? 'Sync stopped by user' : 'Sync complete',
            newCards: result.newCards,
            totalCards: result.totalCards,
            finishedAt: new Date().toISOString(),
            error: null
          });
          return result;
        })
        .catch(error => {
          updateSyncState({
            running: false,
            stage: 'error',
            message: error.message || 'Sync failed',
            error: error.message || 'Sync failed',
            finishedAt: new Date().toISOString()
          });
          throw error;
        })
        .finally(() => {
          activeFetchPromise = null;
        });
    } else {
      console.log('Fetch already in progress, joining existing run...');
    }

    res.status(202).json({
      started: true,
      running: true,
      ...syncState
    });
  } catch (error) {
    console.error('Error during card fetch:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch new cards'
    });
  }
});

app.get('/api/sync-status', (req, res) => {
  res.json(syncState);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
