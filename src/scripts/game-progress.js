export const GAME_PROGRESS_STORAGE_KEY = 'ilovemyfiles-game-progress-v1';

function getStorage(storage) {
  if (storage) return storage;

  try {
    return window.localStorage;
  } catch (error) {
    console.warn('Unable to access game progress in local storage.', error);
    return null;
  }
}

export function readGameProgress(storage) {
  const target = getStorage(storage);
  if (!target) return {};

  try {
    const stored = target.getItem(GAME_PROGRESS_STORAGE_KEY);
    if (!stored) return {};

    const progress = JSON.parse(stored);
    return progress && typeof progress === 'object' && !Array.isArray(progress) ? progress : {};
  } catch (error) {
    console.warn('Unable to read game progress from local storage.', error);
    return {};
  }
}

function updateGameProgress(gameId, update, storage) {
  if (!gameId) return;
  const target = getStorage(storage);
  if (!target) return;

  const progress = readGameProgress(target);
  const previous = progress[gameId] ?? { played: false, bestScore: null, bestLabel: '' };
  progress[gameId] = update(previous);

  try {
    target.setItem(GAME_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('game-progress-updated'));
  } catch (error) {
    console.warn('Unable to save game progress to local storage.', error);
  }
}

export function markGamePlayed(gameId, storage) {
  updateGameProgress(gameId, previous => ({ ...previous, played: true }), storage);
}

export function saveGameBest(gameId, score, label, { higherIsBetter = true, storage } = {}) {
  if (!Number.isFinite(score)) return;

  updateGameProgress(gameId, previous => {
    const isBest = !Number.isFinite(previous.bestScore) ||
      (higherIsBetter ? score > previous.bestScore : score < previous.bestScore);
    return {
      ...previous,
      played: true,
      ...(isBest ? { bestScore: score, bestLabel: label } : {}),
    };
  }, storage);
}

export function gameProgressLabel(record) {
  if (!record?.played) return 'Not played yet';
  return record.bestLabel ? `Played before · Best: ${record.bestLabel}` : 'Played before';
}
