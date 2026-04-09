/**
 * Game 类 - 代表一场数独游戏的核心逻辑
 * 职责：
 * - 持有当前的 Sudoku 实例
 * - 管理操作历史（Undo/Redo）
 * - 提供游戏级别的接口（guess, undo, redo）
 * - 追踪游戏状态
 */

import { Sudoku } from './sudoku.js';

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

    //持有当前 Sudoku：当前游戏的 Sudoku 状态
    this.currentSudoku = sudoku;

    // 管理历史使用历史堆栈：存储每个步骤的 Sudoku 快照
    // 每次 guess 后，当前状态的快照会被添加到这里
    this.history = [sudoku.clone()]; // 初始状态也记录在历史中

    // 当前位置指针（指向 history 数组的索引）
    // 0 表示初始状态，1 表示第一次 guess 后，以此类推
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
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // 2. 执行 guess
    this.currentSudoku.guess(move);

    // 3. 当前状态加入历史
    this.currentIndex++;
    this.history.push(this.currentSudoku.clone());
  }

  /**
   * undo：撤销上一步操作
   */
  undo() {
    if (this.canUndo()) {
      this.currentIndex--;
      this.currentSudoku = this.history[this.currentIndex].clone();
    }
  }

  /**
   * redo：重做下一步操作
   */
  redo() {
    if (this.canRedo()) {
      this.currentIndex++;
      this.currentSudoku = this.history[this.currentIndex].clone();
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
    return this.currentIndex < this.history.length - 1;
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
      currentSudoku: this.currentSudoku.toJSON(),
      // 记录完整的历史
      history: this.history.map(sudoku => sudoku.toJSON()),
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
  // 创建一个占位符 sudoku（会被覆盖）
  const dummySudoku = new Sudoku([
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]);
  const game = new Game({ sudoku: dummySudoku });

  // 恢复历史：从 JSON 重新构建每个历史状态的 Sudoku
  game.history = json.history.map(sudokuJson => {
    const sudoku = new Sudoku(sudokuJson.initialGrid);
    sudoku.userGrid = sudokuJson.userGrid.map(row => [...row]);
    return sudoku;
  });

  // 恢复当前状态
  game.currentIndex = json.currentIndex;
  game.currentSudoku = game.history[game.currentIndex].clone();

  return game;
}
