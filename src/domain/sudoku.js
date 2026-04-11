/**
 * Sudoku 类 - 代表单个数独棋盘的核心领域对象
 * 职责：
 * - 持有初始棋盘（只读）和用户输入的稀疏变更
 * - 提供 guess() 接口来修改棋盘
 * - 提供 clone() 方法用于快照（Undo/Redo 需要）
 * - 提供序列化接口
 */

export class Sudoku {
  /**
   * @param {number[][]} initialGrid - 9x9 的初始棋盘（0 代表空白）
   */
  //Sudoku状态持有：持有当前 grid / board 数据
  constructor(initialGrid) {
    this._assertGridShapeAndRange(initialGrid, 'initialGrid');
    this._assertNoConflicts(initialGrid, 'initialGrid');

    // 防御性复制：不允许外部修改初始棋盘
    this.initialGrid = this._freezeGrid(this._deepCopy(initialGrid));

    // 稀疏记录用户改动：key = row * 9 + col, value = 数字
    this.userMoves = new Map();
  }

  /**
   * 获取当前棋盘状态（包括用户输入和初始值）
   * @returns {number[][]} - 当前 9x9 棋盘
   */
  //读取当前棋盘状态（包括用户输入和初始值）
  getGrid() {
    const grid = this._deepCopy(this.initialGrid);

    for (const [key, value] of this.userMoves) {
      const row = Math.floor(key / 9);
      const col = key % 9;
      grid[row][col] = value;
    }

    return grid;
  }

  /**
   * 获取初始题面（给定数字）
   * @returns {number[][]}
   */
  getInitialGrid() {
    return this._deepCopy(this.initialGrid);
  }

  /**
   * 校验当前棋盘是否合法，并返回冲突单元格
   * @returns {{ valid: boolean, invalidCells: string[] }}
   */
  //提供校验能力：当前棋盘是否合法，并返回冲突单元格
  validate() {
    const grid = this.getGrid();
    const invalid = new Set();

    // 行冲突
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

    // 列冲突
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

    // 宫冲突
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

    return {
      valid: invalid.size === 0,
      invalidCells: Array.from(invalid),
    };
  }

  /**
   * 用户猜测 - 在指定位置输入数字
   * @param {Object} move - { row, col, value }
   * @param {number} move.row - 行号 (0-8)
   * @param {number} move.col - 列号 (0-8)
   * @param {number|null} move.value - 输入值 (1-9, null/0 表示清空)
   */
  //提供guess() 接口：用户输入数字，修改 userGrid
  guess(move) {
    if (!move || typeof move !== 'object') {
      throw new Error('Invalid move: expected { row, col, value } object');
    }

    const { row, col, value } = move;
    const normalizedValue = value === null ? 0 : value;
    
    // 验证参数
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 8 || col < 0 || col > 8) {
      throw new Error(`Invalid cell position: row=${row}, col=${col}`);
    }
    if (!Number.isInteger(normalizedValue) || normalizedValue < 0 || normalizedValue > 9) {
      throw new Error(`Invalid value: ${value}`);
    }

    // 只允许在初始为空的单元格输入
    // （不能修改初始棋盘中已有的数字）
    if (this.initialGrid[row][col] !== 0) {
      // 在初始棋盘有值的位置，忽略输入（或可选择抛错）
      return;
    }

    const key = this._cellKey(row, col);
    const currentValue = this.userMoves.has(key) ? this.userMoves.get(key) : 0;

    if (normalizedValue !== 0 && this._hasConflictAt(row, col, normalizedValue)) {
      throw new Error(
        `Invalid guess: placing ${normalizedValue} at row=${row}, col=${col} violates Sudoku rules`,
      );
    }

    if (currentValue === normalizedValue) {
      return;
    }

    if (normalizedValue === 0) {
      this.userMoves.delete(key);
    } else {
      this.userMoves.set(key, normalizedValue);
    }
  }

  /**
   * 克隆当前的 Sudoku 实例（即是快照能力）
   * 返回一个完全独立的副本，包括用户输入的棋盘状态
   * @returns {Sudoku} - 新的 Sudoku 实例
   */
  clone() {
    const cloned = Object.create(Sudoku.prototype);
    cloned.initialGrid = this.initialGrid;
    cloned.userMoves = new Map(this.userMoves);
    return cloned;
  }

  /**
   * 提供序列化能力：序列化为 JSON 可表达的对象
   * @returns {Object} - 包含 initialGrid 和 userGrid 的对象
   */
  toJSON() {
    return {
      initialGrid: this._deepCopy(this.initialGrid),
      userMoves: Array.from(this.userMoves.entries()),
    };
  }

  /**
   * 提供外表化能力：转换为可读的字符串形式
   * @returns {string} - 棋盘的字符串表示
   */
  toString() {
    return this._formatGrid(this.getGrid());
  }

  /**
   * ===== 私有辅助方法 =====
   */

  /**
   * 深拷贝二维数组
   * @private
   */
  _deepCopy(grid) {
    return grid.map(row => [...row]);
  }

  /**
   * 校验棋盘结构和值域
   * @private
   */
  _assertGridShapeAndRange(grid, label) {
    if (!Array.isArray(grid) || grid.length !== 9) {
      throw new Error(`Invalid ${label}: expected 9x9 grid`);
    }

    for (let row = 0; row < 9; row++) {
      if (!Array.isArray(grid[row]) || grid[row].length !== 9) {
        throw new Error(`Invalid ${label}: expected 9x9 grid`);
      }

      for (let col = 0; col < 9; col++) {
        const value = grid[row][col];
        if (!Number.isInteger(value) || value < 0 || value > 9) {
          throw new Error(`Invalid ${label}: value out of range at row=${row}, col=${col}`);
        }
      }
    }
  }

  /**
   * 校验棋盘是否满足基础数独约束（忽略 0）
   * @private
   */
  _assertNoConflicts(grid, label) {
    const used = new Set();

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const value = grid[row][col];
        if (value === 0) {
          continue;
        }

        const rowKey = `r${row}:${value}`;
        const colKey = `c${col}:${value}`;
        const boxKey = `b${Math.floor(row / 3)}${Math.floor(col / 3)}:${value}`;

        if (used.has(rowKey) || used.has(colKey) || used.has(boxKey)) {
          throw new Error(`Invalid ${label}: Sudoku conflicts detected`);
        }

        used.add(rowKey);
        used.add(colKey);
        used.add(boxKey);
      }
    }
  }

  /**
   * 冻结二维数组，确保初始棋盘不会被意外修改
   * @private
   */
  _freezeGrid(grid) {
    for (const row of grid) {
      Object.freeze(row);
    }

    return Object.freeze(grid);
  }

  /**
   * 计算单元格键值
   * @private
   */
  _cellKey(row, col) {
    return row * 9 + col;
  }

  /**
   * 判断在指定位置放置 value 是否会造成行/列/宫冲突
   * @private
   */
  _hasConflictAt(row, col, value) {
    const grid = this.getGrid();

    // 排除当前位置，再进行冲突检查
    for (let index = 0; index < 9; index++) {
      if (index !== col && grid[row][index] === value) {
        return true;
      }

      if (index !== row && grid[index][col] === value) {
        return true;
      }
    }

    const boxRowStart = Math.floor(row / 3) * 3;
    const boxColStart = Math.floor(col / 3) * 3;

    for (let y = boxRowStart; y < boxRowStart + 3; y++) {
      for (let x = boxColStart; x < boxColStart + 3; x++) {
        if ((y !== row || x !== col) && grid[y][x] === value) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 格式化棋盘为可读字符串
   * @private
   */
  _formatGrid(grid) {
    let result = '╔═══════╤═══════╤═══════╗\n';
    
    for (let row = 0; row < 9; row++) {
      if (row !== 0 && row % 3 === 0) {
        result += '╟───────┼───────┼───────╢\n';
      }

      for (let col = 0; col < 9; col++) {
        if (col === 0) {
          result += '║ ';
        } else if (col % 3 === 0) {
          result += '│ ';
        }

        result += (grid[row][col] === 0 ? '·' : grid[row][col]) + ' ';

        if (col === 8) {
          result += '║';
        }
      }

      result += '\n';
    }

    result += '╚═══════╧═══════╧═══════╝';
    return result;
  }
}

/**
 * 工厂函数：创建新的 Sudoku 实例
 * @param {number[][]} initialGrid - 初始棋盘
 * @returns {Sudoku}
 */
export function createSudoku(initialGrid) {
  return new Sudoku(initialGrid);
}

/**
 * 工厂函数：从 JSON 数据恢复 Sudoku 实例
 * @param {Object} json - 序列化的 Sudoku 数据
 * @returns {Sudoku}
 */
export function createSudokuFromJSON(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid Sudoku JSON payload');
  }

  const sudoku = new Sudoku(json.initialGrid);

  if (Array.isArray(json.userMoves)) {
    for (const [key, value] of json.userMoves) {
      if (!Number.isInteger(key) || key < 0 || key > 80) {
        throw new Error(`Invalid userMoves key: ${key}`);
      }

      const row = Math.floor(key / 9);
      const col = key % 9;
      sudoku.guess({ row, col, value });
    }
  } else if (Array.isArray(json.userGrid)) {
    sudoku._assertGridShapeAndRange(json.userGrid, 'userGrid');

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const value = json.userGrid[row][col];
        if (value !== sudoku.initialGrid[row][col]) {
          sudoku.guess({ row, col, value });
        }
      }
    }
  }

  return sudoku;
}
