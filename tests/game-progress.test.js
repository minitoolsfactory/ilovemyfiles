import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_PROGRESS_STORAGE_KEY,
  gameProgressLabel,
  markGamePlayed,
  readGameProgress,
  saveGameBest,
} from '../src/scripts/game-progress.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test('game progress records played status and keeps the best higher score', () => {
  const storage = createStorage();

  markGamePlayed('snake', storage);
  saveGameBest('snake', 4, '4 bugs', { storage });
  saveGameBest('snake', 2, '2 bugs', { storage });
  saveGameBest('snake', 7, '7 bugs', { storage });

  const progress = readGameProgress(storage);
  assert.deepEqual(progress.snake, {
    played: true,
    bestScore: 7,
    bestLabel: '7 bugs',
  });
  assert.equal(gameProgressLabel(progress.snake), 'Played before · Best: 7 bugs');
});

test('game progress keeps the lowest score when fewer moves are better', () => {
  const storage = createStorage();

  saveGameBest('solitaire', 18, '18 moves', { higherIsBetter: false, storage });
  saveGameBest('solitaire', 22, '22 moves', { higherIsBetter: false, storage });
  saveGameBest('solitaire', 14, '14 moves', { higherIsBetter: false, storage });

  assert.equal(readGameProgress(storage).solitaire.bestLabel, '14 moves');
});

test('unplayed games have an explicit status', () => {
  assert.equal(gameProgressLabel(undefined), 'Not played yet');
  assert.equal(GAME_PROGRESS_STORAGE_KEY, 'ilovemyfiles-game-progress-v1');
});
