/**
 * Sudoku 类 - 代表单个数独棋盘的核心领域对象
 * 职责：
 * - 持有初始棋盘（只读）和用户输入的棋盘
 * - 提供 guess() 接口来修改棋盘
 * - 提供 clone() 方法用于快照（Undo/Redo 需要）
 * - 提供序列化接口
 */

export class Sudoku {
  /**
   * @param {number[][]} initialGrid - 9x9 的初始棋盘（0 代表空白）
   */
  constructor(initialGrid) {
    // 防御性复制：不允许外部修改初始棋盘
    this.initialGrid = this._deepCopy(initialGrid);
    
    // 用户的猜测棋盘（初始时复制初始棋盘）
    this.userGrid = this._deepCopy(initialGrid);
  }

  /**
   * 获取当前棋盘状态（包括用户输入和初始值）
   * @returns {number[][]} - 当前 9x9 棋盘
   */
  getGrid() {
    return this._deepCopy(this.userGrid);
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
  validate() {
    const grid = this.userGrid;
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
   * @param {number} move.value - 输入值 (0-9, 0 表示清空)
   */
  guess(move) {
    const { row, col, value } = move;
    
    // 验证参数
    if (row < 0 || row > 8 || col < 0 || col > 8) {
      throw new Error(`Invalid cell position: row=${row}, col=${col}`);
    }
    if (value < 0 || value > 9) {
      throw new Error(`Invalid value: ${value}`);
    }

    // 只允许在初始为空的单元格输入
    // （不能修改初始棋盘中已有的数字）
    if (this.initialGrid[row][col] !== 0) {
      // 在初始棋盘有值的位置，忽略输入（或可选择抛错）
      return;
    }

    this.userGrid[row][col] = value;
  }

  /**
   * 克隆当前的 Sudoku 实例
   * 返回一个完全独立的副本，包括用户输入的棋盘状态
   * @returns {Sudoku} - 新的 Sudoku 实例
   */
  clone() {
    const cloned = new Sudoku(this.initialGrid);
    // 直接赋值用户棋盘的深拷贝
    cloned.userGrid = this._deepCopy(this.userGrid);
    return cloned;
  }

  /**
   * 序列化为 JSON 可表达的对象
   * @returns {Object} - 包含 initialGrid 和 userGrid 的对象
   */
  toJSON() {
    return {
      initialGrid: this._deepCopy(this.initialGrid),
      userGrid: this._deepCopy(this.userGrid),
    };
  }

  /**
   * 转换为可读的字符串形式
   * @returns {string} - 棋盘的字符串表示
   */
  toString() {
    return this._formatGrid(this.userGrid);
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
  const sudoku = new Sudoku(json.initialGrid);
  // 恢复用户棋盘状态
  sudoku.userGrid = json.userGrid.map(row => [...row]);
  return sudoku;
}
