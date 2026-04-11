/**
 * src/stores/gameStore.js
 * Store Adapter - 连接领域对象 (Game/Sudoku) 与 Svelte 响应式系统
 * 
 * 职责：
 * - 内部持有 Game 实例（领域对象）
 * - 对外暴露响应式状态（grid, invalidCells, won 等）
 * - 对外暴露命令方法（guess, undo, redo 等）
 * - UI 通过这个 adapter 消费领域对象
 */



import { writable, derived } from 'svelte/store';//典型Svelte 3 风格
import { createGame, createSudoku } from '../domain/index.js';
import { generateSudoku } from '@sudoku/sudoku';
import { solveSudoku } from '@sudoku/sudoku';
import { decodeSencode } from '@sudoku/sencode';

/**
 * 检查数独是否已赢（所有单元格都填满且合法）
 * @param {Sudoku} sudoku
 * @returns {boolean}
 */
function isWon(sudoku) {
  const grid = sudoku.getGrid();
  
  // 检查是否所有单元格都有数字
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        return false;
      }
    }
  }
  
  // TODO: 可以添加数独合法性检查
  // 这里简化为只检查是否全部填满
  return true;
}

/**
 * 找到无效的单元格（与其他单元格冲突的位置）
 * 无效指：同行、同列、同宫有重复数字
 * @param {Sudoku} sudoku
 * @returns {Set} - 包含无效单元格的 "row,col" 字符串
 */
function findInvalidCells(sudoku) {
  const grid = sudoku.getGrid();
  const invalid = new Set();
  
  // 检查行冲突
  for (let row = 0; row < 9; row++) {
    const seen = new Map();
    for (let col = 0; col < 9; col++) {
      const value = grid[row][col];
      if (value !== 0) {
        if (seen.has(value)) {
          invalid.add(`${row},${col}`);
          invalid.add(`${row},${seen.get(value)}`);
        } else {
          seen.set(value, col);
        }
      }
    }
  }
  
  // 检查列冲突
  for (let col = 0; col < 9; col++) {
    const seen = new Map();
    for (let row = 0; row < 9; row++) {
      const value = grid[row][col];
      if (value !== 0) {
        if (seen.has(value)) {
          invalid.add(`${row},${col}`);
          invalid.add(`${seen.get(value)},${col}`);
        } else {
          seen.set(value, row);
        }
      }
    }
  }
  
  // 检查宫（3x3 box）冲突
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Map();
      for (let row = boxRow * 3; row < boxRow * 3 + 3; row++) {
        for (let col = boxCol * 3; col < boxCol * 3 + 3; col++) {
          const value = grid[row][col];
          if (value !== 0) {
            const key = `${row},${col}`;
            if (seen.has(value)) {
              invalid.add(key);
              invalid.add(seen.get(value));
            } else {
              seen.set(value, key);
            }
          }
        }
      }
    }
  }
  
  return invalid;
}

/**
 * 创建游戏 Store Adapter
 * @param {Object} options
 * @param {number[][]} options.initialGrid - 初始棋盘
 * @returns {Object} - 包含响应式状态和命令的店铺对象
 */
export function createGameStore(options = {}) {
  // 如果没有提供初始棋盘，默认生成一局 easy 题面
  const { initialGrid = generateSudoku('easy') } = options;

  function buildSolvedGrid(given) {
    try {
      return solveSudoku(given);
    } catch (error) {
      return null;
    }
  }
  
  // 创建初始的 Sudoku 和 Game
  const sudoku = createSudoku(initialGrid);
  const game = createGame({ sudoku });
  let solvedGrid = buildSolvedGrid(initialGrid);
  
  // 内部可写 store：持有当前的 Game 实例（典型Svelte 3 风格）
  const gameInstance = writable(game);
  
  // 响应式 store：当前棋盘网格
  // 每当 game 变化时，自动更新 grid
  //UI 的 grid 来自 Game -> Sudoku 的导出状态，满足UI 中看到的 grid 必须来自你的领域对象，或来自由你的领域对象导出的响应式视图状态的要求
  const grid = derived(gameInstance, $game => 
    $game.getSudoku().getGrid()
  );

  // 响应式 store：初始题面（给定数字）
  const givenGrid = derived(gameInstance, $game =>
    $game.getSudoku().getInitialGrid()
  );
  
  // 响应式 store：无效单元格集合
  const invalidCells = derived(gameInstance, $game => {
    const validation = $game.getSudoku().validate();
    return validation.invalidCells;
  });
  
  // 响应式 store：游戏是否已赢
  const won = derived(gameInstance, $game => 
    isWon($game.getSudoku())
  );
  
  //canUndo/canRedo 也是由领域对象派生，按钮状态会联动刷新
  // 响应式 store：是否可以撤销
  const canUndo = derived(gameInstance, $game => 
    $game.canUndo()
  );
  
  // 响应式 store：是否可以重做
  const canRedo = derived(gameInstance, $game => 
    $game.canRedo()
  );

  /**
   * UI 命令：用户猜测
   * @param {number} row
   * @param {number} col
   * @param {number} value
   */
  //gameStore.guess 再转发到领域对象 Game.guess
  function guess(row, col, value) {
    gameInstance.update($game => {
      $game.guess({ row, col, value });
      return $game;
    });
  }

  //gameStore 转发到 Game.undo/redo
  /**
   * UI 命令：撤销
   */
  function undo() {
    gameInstance.update($game => {
      $game.undo();
      return $game;
    });
  }

  /**
   * UI 命令：重做
   */
  function redo() {
    gameInstance.update($game => {
      $game.redo();
      return $game;
    });
  }

  /**
   * UI 命令：新游戏
   * @param {number[][]} newInitialGrid - 新的初始棋盘
   */
  function newGame(newInitialGrid) {
    solvedGrid = buildSolvedGrid(newInitialGrid);
    const newSudoku = createSudoku(newInitialGrid);
    const newGame = createGame({ sudoku: newSudoku });
    gameInstance.set(newGame);
  }

  /**
   * UI 命令：按难度开始新游戏
   * @param {('veryeasy'|'easy'|'medium'|'hard')} difficulty
   */
  function startNew(difficulty = 'easy') {
    newGame(generateSudoku(difficulty));
  }

  /**
   * UI 命令：从 sencode 开始自定义游戏
   * @param {string} sencode
   */
  //创建或加载Sudoku
  function startCustom(sencode) {
    newGame(decodeSencode(sencode));
  }

  /**
   * UI 命令：在指定位置应用提示
   * @param {number|null} row
   * @param {number|null} col
   * @returns {boolean} 是否成功应用提示
   */
  function applyHint(row, col) {
    if (row === null || col === null) {
      return false;
    }

    let applied = false;
    gameInstance.update($game => {
      const current = $game.getSudoku().getGrid();
      if (current[row][col] !== 0) {
        return $game;
      }

      try {
        const value = solvedGrid?.[row]?.[col] ?? 0;
        if (value > 0) {
          $game.guess({ row, col, value });
          applied = true;
        }
      } catch (error) {
        // 无法求解时忽略提示请求
      }

      return $game;
    });

    return applied;
  }

  /**
   * 获取当前 Game 实例（内部使用）
   */
  function getGame() {
    let currentGame;
    gameInstance.subscribe(g => { currentGame = g; })();
    return currentGame;
  }

  // 返回给 UI 使用的接口
  return {
    // === 响应式状态 ===
    // UI 可以订阅这些 store，当 Game 状态变化时自动更新
    grid: { subscribe: grid.subscribe },
    givenGrid: { subscribe: givenGrid.subscribe },
    invalidCells: { subscribe: invalidCells.subscribe },
    won: { subscribe: won.subscribe },
    canUndo: { subscribe: canUndo.subscribe },
    canRedo: { subscribe: canRedo.subscribe },
    
    // === 命令方法 ===
    // UI 调用这些方法来修改游戏状态
    guess,
    undo,
    redo,
    newGame,
    startNew,
    startCustom,
    applyHint,
    
    // === 内部访问 ===
    // 测试或高级使用场景
    getGame,
  };
}
