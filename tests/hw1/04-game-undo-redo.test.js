import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js'

describe('HW1 game undo / redo', () => {
  const solvedGrid = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
  ]

  it('supports a basic guess -> undo -> redo flow', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })
    expect(game.getSudoku().getGrid()[0][2]).toBe(4)
    expect(game.canUndo()).toBe(true)

    game.undo()
    expect(game.getSudoku().getGrid()[0][2]).toBe(0)
    expect(game.canRedo()).toBe(true)

    game.redo()
    expect(game.getSudoku().getGrid()[0][2]).toBe(4)
  })

  it('supports multiple undo steps in reverse order', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })

    expect(game.getSudoku().getGrid()[0][2]).toBe(4)
    expect(game.getSudoku().getGrid()[1][1]).toBe(7)

    game.undo()
    expect(game.getSudoku().getGrid()[1][1]).toBe(0)
    expect(game.getSudoku().getGrid()[0][2]).toBe(4)

    game.undo()
    expect(game.getSudoku().getGrid()[0][2]).toBe(0)
  })

  it('clears redo history after a new move following undo', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })

    game.undo()
    expect(game.canRedo()).toBe(true)

    game.guess({ row: 2, col: 0, value: 1 })
    expect(game.canRedo()).toBe(false)
    expect(game.getSudoku().getGrid()[2][0]).toBe(1)
  })

  it('keeps redo history when an invalid guess payload is rejected', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })
    game.undo()

    expect(game.canRedo()).toBe(true)

    // Invalid row should be rejected before affecting history.
    expect(() => game.guess({ row: -1, col: 2, value: 5 })).toThrow()
    expect(game.canRedo()).toBe(true)
    expect(game.getSudoku().getGrid()[1][1]).toBe(0)
  })

  it('keeps redo history when guess causes no effective change', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })
    game.undo()

    expect(game.canRedo()).toBe(true)

    // Current value is already 0 after undo, so this is a no-op.
    game.guess({ row: 1, col: 1, value: 0 })
    expect(game.canRedo()).toBe(true)
  })

  it('isWon returns true only when puzzle is full and valid', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const almostSolved = solvedGrid.map(row => [...row])
    almostSolved[0][0] = 0

    const game = createGame({ sudoku: createSudoku(almostSolved) })
    expect(game.isWon()).toBe(false)

    game.guess({ row: 0, col: 0, value: 5 })
    expect(game.isWon()).toBe(true)
  })

  it('isWon returns false for a full but conflicting board', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const conflictReady = solvedGrid.map(row => [...row])
    conflictReady[0][0] = 0
    conflictReady[0][1] = 0

    const game = createGame({ sudoku: createSudoku(conflictReady) })
    game.guess({ row: 0, col: 0, value: 1 })
    game.guess({ row: 0, col: 1, value: 1 })

    expect(game.getSudoku().validate().valid).toBe(false)
    expect(game.isWon()).toBe(false)
  })
})
