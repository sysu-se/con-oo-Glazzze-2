import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameStore } from '../../src/stores/gameStore.js';
import { timer } from '../../src/node_modules/@sudoku/stores/timer.js';
import { makePuzzle } from './helpers/domain-api.js';

function readStore(store) {
  let value;
  const unsubscribe = store.subscribe(v => {
    value = v;
  });
  unsubscribe();
  return value;
}

afterEach(() => {
  timer.reset();
  vi.useRealTimers();
});

describe('HW1 UI integration via gameStore adapter', () => {
  it('pause/resume controls timer progression through a single state source', () => {
    vi.useFakeTimers();

    const gameStore = createGameStore({ initialGrid: makePuzzle() });

    expect(readStore(gameStore.paused)).toBe(true);
    expect(readStore(timer)).toBe('00:00');

    gameStore.resume();
    vi.advanceTimersByTime(1200);

    const runningValue = readStore(timer);
    expect(readStore(gameStore.paused)).toBe(false);
    expect(runningValue).not.toBe('00:00');

    gameStore.pause();
    const pausedValue = readStore(timer);
    vi.advanceTimersByTime(2000);

    expect(readStore(gameStore.paused)).toBe(true);
    expect(readStore(timer)).toBe(pausedValue);
  });

  it('share-import replay restores board and history through adapter methods', () => {
    const source = createGameStore({ initialGrid: makePuzzle() });

    source.guess(0, 2, 4);
    source.guess(1, 1, 7);
    source.undo();

    const payload = source.serialize();

    const target = createGameStore({ initialGrid: makePuzzle() });
    target.importCode(payload);

    const sourceGame = source.getGame();
    const targetGame = target.getGame();

    expect(targetGame.getSudoku().getGrid()).toEqual(sourceGame.getSudoku().getGrid());
    expect(targetGame.toJSON()).toEqual(sourceGame.toJSON());
    expect(readStore(target.canUndo)).toBe(readStore(source.canUndo));
    expect(readStore(target.canRedo)).toBe(readStore(source.canRedo));
  });
});
