const fs = require('fs');
const path = require('path');

const DEFAULT_DATA_DIR = path.join(__dirname, '../data');
const DEFAULT_CARDS_FILE = 'cards.json';
const LEGACY_CARDS_FILE = path.join(__dirname, '../public/data/cards.json');

function getDataDir() {
  return process.env.DATA_DIR || DEFAULT_DATA_DIR;
}

function getCardsFilePath() {
  return path.join(getDataDir(), DEFAULT_CARDS_FILE);
}

function ensureDataDir() {
  fs.mkdirSync(getDataDir(), { recursive: true });
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function readCards() {
  const filePath = getCardsFilePath();
  if (!fs.existsSync(filePath) && fs.existsSync(LEGACY_CARDS_FILE)) {
    try {
      const legacyCards = readJsonFile(LEGACY_CARDS_FILE);
      writeCards(legacyCards);
      return legacyCards;
    } catch (error) {
      console.error(`Failed to migrate cards from ${LEGACY_CARDS_FILE}:`, error);
    }
  }

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    return readJsonFile(filePath);
  } catch (error) {
    console.error(`Failed to read cards from ${filePath}:`, error);
    return [];
  }
}

function writeCards(cards) {
  ensureDataDir();
  const filePath = getCardsFilePath();
  const tempFilePath = `${filePath}.tmp`;
  fs.writeFileSync(tempFilePath, JSON.stringify(cards, null, 2), 'utf-8');
  fs.renameSync(tempFilePath, filePath);
}

module.exports = {
  ensureDataDir,
  getCardsFilePath,
  readCards,
  writeCards
};
