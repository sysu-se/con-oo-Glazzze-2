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
    if (!move || typeof move !== 'object') {
      throw new Error('Invalid move: expected { row, col, value } object');
    }

    const { row, col } = move;
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 8 || col < 0 || col > 8) {
      throw new Error(`Invalid move position: row=${row}, col=${col}`);
    }

    const previousValue = this.currentSudoku.getGrid()[row][col];

    // 执行 guess；若领域规则拒绝该 move，保持历史不变
    this.currentSudoku.guess(move);

    const nextValue = this.currentSudoku.getGrid()[row][col];

    // 没有实际变化时，不写入历史，也不清空 redo 历史
    if (previousValue === nextValue) {
      return;
    }

    // 仅在成功且有实际变化时才清空 redo 栈
    if (this.currentIndex < this.history.length) {
      this.history = this.history.slice(0, this.currentIndex);
    }

    // 当前操作加入历史
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
      // 兼容旧消费方：同时暴露当前盘面
      currentSudoku: this.currentSudoku.toJSON(),
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
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid Game JSON payload');
  }

  // 新格式：{ initialSudoku, history: operation[], currentIndex }
  // 旧格式：{ currentSudoku, history: sudokuSnapshot[], currentIndex }
  const isOperationHistory = Array.isArray(json.history) && json.history.every(op => op && typeof op === 'object' && op.type === 'guess');
  const isSnapshotHistory = Array.isArray(json.history) && json.history.every(s => s && typeof s === 'object' && (Array.isArray(s.userGrid) || Array.isArray(s.userMoves)));

  if (!Array.isArray(json.history)) {
    throw new Error('Invalid Game JSON payload: history must be an array');
  }

  if (isOperationHistory) {
    if (!Number.isInteger(json.currentIndex) || json.currentIndex < 0 || json.currentIndex > json.history.length) {
      throw new Error('Invalid Game JSON payload: currentIndex out of bounds');
    }

    const initialSudoku = createSudokuFromJSON(json.initialSudoku);
    const game = new Game({ sudoku: initialSudoku.clone() });

    game.initialSudoku = initialSudoku;

    game.history = json.history.map(operation => {
      if (!operation || typeof operation !== 'object') {
        throw new Error('Invalid Game JSON payload: malformed history operation');
      }
      if (operation.type !== 'guess') {
        throw new Error(`Invalid Game JSON payload: unsupported operation type ${operation.type}`);
      }
      if (!operation.move || typeof operation.move !== 'object') {
        throw new Error('Invalid Game JSON payload: malformed move');
      }

      const { row, col, value } = operation.move;
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 8 || col < 0 || col > 8) {
        throw new Error('Invalid Game JSON payload: move position out of range');
      }
      if (!Number.isInteger(value) || value < 0 || value > 9) {
        throw new Error('Invalid Game JSON payload: move value out of range');
      }
      if (!Number.isInteger(operation.previousValue) || operation.previousValue < 0 || operation.previousValue > 9) {
        throw new Error('Invalid Game JSON payload: previousValue out of range');
      }

      return {
        type: operation.type,
        move: { ...operation.move },
        previousValue: operation.previousValue,
      };
    });

    game.currentIndex = json.currentIndex;
    game.currentSudoku = initialSudoku.clone();

    for (let index = 0; index < game.currentIndex; index++) {
      const operation = game.history[index];
      game.currentSudoku.guess(operation.move);
    }

    return game;
  }

  if (isSnapshotHistory) {
    if (!Number.isInteger(json.currentIndex) || json.currentIndex < 0 || json.currentIndex >= json.history.length) {
      throw new Error('Invalid legacy Game JSON payload: currentIndex out of bounds');
    }

    const snapshots = json.history.map(snapshot => createSudokuFromJSON(snapshot));
    const initialSudoku = snapshots[0].clone();
    const game = new Game({ sudoku: initialSudoku.clone() });
    game.initialSudoku = initialSudoku;

    // 将旧快照历史转换为可重放的操作历史
    game.history = [];
    for (let index = 1; index < snapshots.length; index++) {
      const prev = snapshots[index - 1].getGrid();
      const next = snapshots[index].getGrid();

      let diff = null;
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          if (prev[row][col] !== next[row][col]) {
            if (diff !== null) {
              throw new Error('Invalid legacy Game JSON payload: snapshot step has multiple cell changes');
            }
            diff = { row, col, previousValue: prev[row][col], value: next[row][col] };
          }
        }
      }

      if (diff === null) {
        throw new Error('Invalid legacy Game JSON payload: snapshot step has no changes');
      }

      game.history.push({
        type: 'guess',
        move: { row: diff.row, col: diff.col, value: diff.value },
        previousValue: diff.previousValue,
      });
    }

    game.currentIndex = json.currentIndex;
    game.currentSudoku = initialSudoku.clone();
    for (let index = 0; index < game.currentIndex; index++) {
      game.currentSudoku.guess(game.history[index].move);
    }

    return game;
  }

  throw new Error('Invalid Game JSON payload: unsupported history format');
}
