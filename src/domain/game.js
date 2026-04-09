/**
 * Game 类 - 代表一场数独游戏的核心逻辑
 * 职责：
 * - 持有当前的 Sudoku 实例
 * - 管理操作历史（Undo/Redo）
 * - 提供游戏级别的接口（guess, undo, redo）
 * - 追踪游戏状态
 */

import { Sudoku, createSudokuFromJSON } from './sudoku.js';

export class Game {
  /**
   * @param {Object} options - 配置对象
   * @param {Sudoku} options.sudoku - 初始的 Sudoku 实例
   */
  constructor(options) {
    const { sudoku } = options;

    if (!sudoku || !(sudoku instanceof Sudoku)) {
      throw new Error('Game requires a Sudoku instance');
    }

    // 持有当前 Sudoku：当前游戏的 Sudoku 状态
    this.currentSudoku = sudoku;

    // 保留初始 Sudoku，供序列化和恢复使用
    this.initialSudoku = sudoku.clone();

    // 管理历史：只存储可重放的操作日志，而不是整盘快照
    this.history = [];

    // 当前位置指针：表示已经应用了多少条操作
    this.currentIndex = 0;
  }

  /**
   * 用户猜测 - 修改棋盘并记录历史
   * @param {Object} move - { row, col, value }
   */
  //对外提供面向 UI 的游戏操作入口：guess() 方法，用户输入数字，修改 userGrid，并记录历史
  guess(move) {
    // 1. 如果当前不在历史末尾，删除 redo 栈
    //   （新操作会清除所有"重做"的可能性）
    if (this.currentIndex < this.history.length) {
      this.history = this.history.slice(0, this.currentIndex);
    }

    const previousValue = this.currentSudoku.getGrid()[move.row][move.col];

    // 2. 执行 guess
    this.currentSudoku.guess(move);

    const nextValue = this.currentSudoku.getGrid()[move.row][move.col];

    // 没有实际变化时，不写入历史
    if (previousValue === nextValue) {
      return;
    }

    // 3. 当前操作加入历史
    this.history.push({
      type: 'guess',
      move: { ...move },
      previousValue,
    });
    this.currentIndex++;
  }

  /**
   * undo：撤销上一步操作
   */
  undo() {
    if (this.canUndo()) {
      const operation = this.history[this.currentIndex - 1];
      this.currentSudoku.guess({
        row: operation.move.row,
        col: operation.move.col,
        value: operation.previousValue,
      });
      this.currentIndex--;
    }
  }

  /**
   * redo：重做下一步操作
   */
  redo() {
    if (this.canRedo()) {
      const operation = this.history[this.currentIndex];
      this.currentSudoku.guess({
        row: operation.move.row,
        col: operation.move.col,
        value: operation.move.value,
      });
      this.currentIndex++;
    }
  }

  /**
   * 检查是否可以撤销
   * @returns {boolean}
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * 检查是否可以重做
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.history.length;
  }

  /**
   * 获取当前的 Sudoku 实例
   * @returns {Sudoku}
   */
  getSudoku() {
    return this.currentSudoku;
  }

  /**
   * 序列化为 JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      initialSudoku: this.initialSudoku.toJSON(),
      // 记录可重放的历史操作，而不是整盘快照
      history: this.history.map(operation => ({
        type: operation.type,
        move: { ...operation.move },
        previousValue: operation.previousValue,
      })),
      currentIndex: this.currentIndex,
    };
  }

  /**
   * 转换为字符串
   * @returns {string}
   */
  toString() {
    return `Game(currentIndex: ${this.currentIndex}, historyLength: ${this.history.length})\n${this.currentSudoku.toString()}`;
  }
}

/**
 * 工厂函数：创建新的 Game 实例
 * @param {Object} options - { sudoku }
 * @returns {Game}
 */
export function createGame(options) {
  return new Game(options);
}

/**
 * 工厂函数：从 JSON 数据恢复 Game 实例
 * @param {Object} json - 序列化的 Game 数据
 * @returns {Game}
 */
export function createGameFromJSON(json) {
  const initialSudoku = createSudokuFromJSON(json.initialSudoku);
  const game = new Game({ sudoku: initialSudoku.clone() });

  game.initialSudoku = initialSudoku;

  game.history = json.history.map(operation => ({
    type: operation.type,
    move: { ...operation.move },
    previousValue: operation.previousValue,
  }));

  game.currentIndex = json.currentIndex;
  game.currentSudoku = initialSudoku.clone();

  for (let index = 0; index < game.currentIndex; index++) {
    const operation = game.history[index];
    game.currentSudoku.guess(operation.move);
  }

  return game;
}
