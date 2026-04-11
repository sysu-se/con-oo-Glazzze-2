import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js'

describe('HW1 serialization / deserialization', () => {
  it('supports sudoku round-trip serialization', async () => {
    const { createSudoku, createSudokuFromJSON } = await loadDomainApi()

    const sudoku = createSudoku(makePuzzle())
    sudoku.guess({ row: 0, col: 2, value: 4 })

    const restored = createSudokuFromJSON(
      JSON.parse(JSON.stringify(sudoku.toJSON())),
    )

    expect(restored.getGrid()).toEqual(sudoku.getGrid())
    expect(typeof restored.toString()).toBe('string')
  })

  it('supports game round-trip serialization for the current board state', async () => {
    const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi()

    const game = createGame({ sudoku: createSudoku(makePuzzle()) })
    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })

    const restored = createGameFromJSON(
      JSON.parse(JSON.stringify(game.toJSON())),
    )

    expect(restored.getSudoku().getGrid()).toEqual(game.getSudoku().getGrid())
  })

  it('rejects restoring an invalid Sudoku state from JSON', async () => {
    const { createSudokuFromJSON } = await loadDomainApi()

    const invalid = {
      initialGrid: makePuzzle(),
      userMoves: [[2, 5]], // row=0 col=2, conflicts with existing 5 in row 0
    }

    expect(() => createSudokuFromJSON(invalid)).toThrow()
  })

  it('rejects restoring a Game with out-of-bounds currentIndex', async () => {
    const { createGameFromJSON } = await loadDomainApi()

    const invalid = {
      initialSudoku: { initialGrid: makePuzzle(), userMoves: [] },
      history: [],
      currentIndex: 1,
    }

    expect(() => createGameFromJSON(invalid)).toThrow()
  })

  it('rejects restoring a Game with malformed history operation', async () => {
    const { createGameFromJSON } = await loadDomainApi()

    const invalid = {
      initialSudoku: { initialGrid: makePuzzle(), userMoves: [] },
      history: [{ type: 'guess', move: { row: 0, col: 2, value: 4 }, previousValue: -1 }],
      currentIndex: 0,
    }

    expect(() => createGameFromJSON(invalid)).toThrow()
  })
})
