# 数独游戏设计文档 (Homework 1.1)

## 一、概述

本项目在 Homework 1 的基础上，完成了**将领域对象真正接入 Svelte 游戏流程**的目标。

核心改进：
- ✅ 创建了真实的领域对象（Sudoku 和 Game 类）
- ✅ 建立了 Store Adapter 层来连接领域对象与 Svelte UI
- ✅ UI 现在通过领域对象来操作游戏状态，而不是直接改数组
- ✅ Undo/Redo 由领域对象提供，完全集成到游戏流程
- ✅ Sudoku 采用稀疏变更集保存用户输入，clone() 不再整盘深拷贝
- ✅ Game 的 history 改为操作日志 + 反向操作，而不是整盘快照数组

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                  Svelte UI Components                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ App.svelte │  │ Board      │  │ Controls/Keyboard  │ │
│  │            │  │ Cell       │  │ Actions (Undo/Redo)│ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
│         ↓                ↓                  ↓            │
│  订阅状态 & 调用命令方法                    调用方法      │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│            Store Adapter (gameStore.js)                  │
│                                                          │
│  对外暴露响应式状态: grid, invalidCells, won, ...      │
│  对外暴露命令方法: guess(row,col,value), undo(), ...   │
│                                                          │
│  内部持有 Game 实例，定时将其状态导出为响应式 store    │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│          领域对象 (Domain Objects)                       │
│                                                          │
│  ┌──────────────────┐        ┌──────────────────┐      │
│  │   Game 类        │        │  Sudoku 类       │      │
│  ├──────────────────┤        ├──────────────────┤      │
│  │- currentSudoku   │        │- initialGrid     │      │
│  │- initialSudoku   │        │- userMoves       │      │
│  │- history[]       │        │                  │      │
│  │- currentIndex    │        │                  │      │
│  ├──────────────────┤        ├──────────────────┤      │
│  │+ guess()         │        │+ getGrid()       │      │
│  │+ undo()          │        │+ guess()         │      │
│  │+ redo()          │        │+ clone()         │      │
│  │+ canUndo()       │        │+ toJSON()        │      │
│  │+ canRedo()       │        │+ toString()      │      │
│  │+ getSudoku()     │        │                  │      │
│  └──────────────────┘        └──────────────────┘      │
│                                                          │
│  真实的业务逻辑：管理棋盘状态、历史、Undo/Redo        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流

#### 用户输入 → 游戏状态更新：

```
User Input (键盘按键)
    ↓
Keyboard.svelte handleKeyButton()
    ↓
调用 gameStore.guess(row, col, value)
    ↓
Store Adapter:
  - gameInstance.update() 调用 Game.guess()
  - Game 内部调用 Sudoku.guess()
  - Game 记录历史，currentIndex++
    ↓
Store Adapter 的 derived store 自动更新：
  - grid = $gameInstance.getSudoku().getGrid()
  - invalidCells = $gameInstance.getSudoku().validate().invalidCells
  - won = isWon($gameInstance.getSudoku())
    ↓
Svelte 自动检测 $grid、$invalidCells、$won 变化
    ↓
Board & Cell 自动重新渲染
```

#### Undo 操作：

```
User Click Undo Button
    ↓
Actions.svelte on:click={() => gameStore.undo()}
    ↓
gameInstance.update() 调用 Game.undo()
    ↓
Game.undo():
  - 取出当前操作的 previousValue
  - 将该格恢复到 previousValue
  - currentIndex--
    ↓
Store Adapter 的 derived store 更新
    ↓
UI 重新渲染
```

---

## 三、核心对象说明

### 3.1 Sudoku 类 (`src/domain/sudoku.js`)

**职责**：代表单个数独棋盘的状态

**关键属性**：
- `initialGrid` - 初始棋盘（防御性复制，只读，作为共享基底）
- `userMoves` - 用户输入的稀疏变更集（只记录有变化的格子）

**关键方法**：
- `guess(move)` - 用户在指定位置输入数字
- `getGrid()` - 返回当前棋盘的拷贝
- `clone()` - **重要**：结构共享地复制快照，仅复制 `userMoves`
- `toJSON()` / `toString()` - 序列化与外表化

**设计要点**：
- 防御性复制：初始网格被复制并冻结，不允许外部修改
- 只把用户改动保存在稀疏集合中，避免 clone() 每次都复制完整 9x9 网格
- 不允许修改初始值为非零的单元格（保护初始棋盘）

### 3.2 Game 类 (`src/domain/game.js`)

**职责**：管理整个游戏的生命周期和 Undo/Redo

**关键属性**：
- `currentSudoku` - 当前的 Sudoku 实例
- `initialSudoku` - 初始 Sudoku，用于序列化和恢复
- `history[]` - 历史操作日志，每个元素记录一次 guess 及其可逆信息
- `currentIndex` - 当前指向 history 中的位置

**关键方法**：
- `guess(move)` - 执行用户猜测，并记录历史
- `undo()` / `redo()` - 遍历历史
- `canUndo()` / `canRedo()` - 检查是否能操作
- `getSudoku()` - 获取当前的 Sudoku 实例

**Undo/Redo 实现细节**：

```javascript
// 初始化
game = new Game({ sudoku })
history = []                // 只保存操作日志
currentIndex = 0

// 执行 guess
game.guess({ row, col, value })
  currentSudoku.guess()              // 修改当前棋盘
  history.push({ move, previousValue })
  currentIndex++                     // 位置后移

// Undo
game.undo()
  currentSudoku.guess({ value: previousValue })
  currentIndex--

// Redo
game.redo()
  currentSudoku.guess(move)
  currentIndex++

// 关键：新操作后清除 redo 栈
game.guess() // 在 undo 后调用
  if (currentIndex < history.length) {
    history = history.slice(0, currentIndex)      // 删除 redo 历史
  }
```

### 3.3 Store Adapter - `createGameStore()` (`src/stores/gameStore.js`)

**职责**：连接领域对象和 Svelte 响应式系统

**对外暴露的响应式状态**：

```javascript
{
  grid,           // 当前棋盘 [9][9] 数组
  invalidCells,   // 冲突的单元格数组 (e.g., ["0,1", "2,3"])
  won,            // 是否赢了 (boolean)
  canUndo,        // 是否能撤销 (boolean)
  canRedo,        // 是否能重做 (boolean)
}
```

**对外暴露的命令方法**：

```javascript
{
  guess(row, col, value),  // 用户输入
  undo(),                  // 撤销
  redo(),                  // 重做
  newGame(initialGrid),    // 开始新游戏
}
```

**实现机制**：

1. **内部持有 Game 实例**
   ```javascript
   const gameInstance = writable(game);
   ```

2. **响应式导出状态**
   ```javascript
   const grid = derived(gameInstance, $game => 
     $game.getSudoku().getGrid()
   );
   ```

3. **命令通过 gameInstance.update() 修改 Game 状态**
   ```javascript
   function guess(row, col, value) {
     gameInstance.update($game => {
       $game.guess({ row, col, value });
       return $game;
     });
   }
   ```

**为什么这样设计会工作**：
- Svelte store 的 `derived` 会在依赖变化时自动重新计算
- `gameInstance` 的 update 会触发 derived 的重新计算
- UI 订阅 derived store，自动刷新

### 3.4 方案 A 的实现思路与代码结构拆分

本项目采用 Store Adapter（`createGameStore`）作为 UI 与领域层之间的唯一桥梁。实现时遵循三条原则：

1. **领域层只管规则，不直接面向 Svelte**
   - `Sudoku` 管棋盘与输入合法性。
   - `Game` 管历史、撤销、重做等流程。
   - 领域对象不暴露 Svelte 语法，不直接依赖组件。

2. **Adapter 只做“状态投影 + 命令转发”**
   - 内部持有一个 `gameInstance = writable(game)`。
   - 用 `derived(gameInstance, ...)` 把领域对象状态投影成 UI 可订阅状态。
   - 把 UI 命令统一转发到 `Game`（例如 `guess/undo/redo`）。

3. **组件层只读状态、只发命令**
   - 组件不改领域对象内部字段。
   - 组件不关心历史结构、校验细节，只关心显示与交互。

#### 3.4.1 代码结构

```text
src/domain/
  sudoku.js       // 棋盘规则、校验、序列化
  game.js         // 游戏流程、history、undo/redo

src/stores/
  gameStore.js    // Store Adapter（桥接层）

src/components/
  ...             // 只消费 gameStore 的状态和命令
```

#### 3.4.2 状态拆分（State Decomposition）

在 `createGameStore` 中，状态按“是否需要被 UI 订阅”拆分：

- **核心局面状态**：`grid`、`givenGrid`
- **规则派生状态**：`invalidCells`、`won`
- **流程派生状态**：`canUndo`、`canRedo`

这些状态全部由 `gameInstance` 派生，保证单一数据源（Single Source of Truth）。

另外，`selectedCell` 没有放进 `gameStore`，而是继续使用独立的 `cursor` store，原因是：

- 光标属于纯 UI 交互状态，不属于 `Game/Sudoku` 核心领域规则。
- 独立后可减少领域层耦合，保持 `gameStore` 聚焦在游戏规则与流程状态。

#### 3.4.3 命令拆分（Command Decomposition）

命令按“是否改变领域对象状态”拆分：

- **领域命令**：`guess`、`undo`、`redo`（直接转发到 `Game`）
- **流程命令**：`newGame`、`startNew`、`startCustom`（负责创建/加载新局）
- **辅助命令**：`applyHint`（在 Adapter 内组合 solver 与 `Game.guess`）

统一命令入口的目的：

- 所有状态变更都经过 `gameInstance.update/set`，保证 Svelte 可感知。
- 组件调用语义一致，降低 UI 复杂度。
- 后续增加日志、埋点、权限控制时，只需在 Adapter 层扩展。

#### 3.4.4 为什么这种拆分适合本次作业要求

- 满足“真实流程接入”：开局、输入、撤销重做都经过 `Game/Sudoku`。
- 满足“响应式可消费”：UI 只订阅 Adapter 导出的状态。
- 满足“可演进”：领域规则修改时，组件层改动最小。

---

## 四、Svelte 响应式机制解析

### 4.1 为什么 UI 会自动更新

**关键概念**：Svelte 的反应性基于**赋值**和 **store 通知**

**在本项目中**：

1. **store 变化导致 UI 更新**
   ```svelte
   {#each $gameStore.grid as row, y}
     {#each row as value, x}
       <!-- UI 每次 $gameStore.grid 变化都会重新渲染 -->
     {/each}
   {/each}
   ```

2. **reactive statement 追踪**
   ```svelte
   $: hintsAvailable = $hints > 0;
   <!-- 当 $hints 变化时自动重新计算 -->
   ```

### 4.2 为什么直接改二维数组不会更新

**错误做法**（不起作用）：
```javascript
grid[0][0] = 5;  // 直接改普通数组元素
// ❌ Svelte 不知道这次内部修改发生了，因为没有经过 store / 命令入口

// 这会令 UI 不更新！
```

**正确做法**（本项目使用）：
```javascript
gameInstance.update($game => {
  $game.guess({ row: 0, col: 0, value: 5 });
  return $game;  // 通过领域对象写入稀疏变更，并通知 store 重新投影状态
});
// ✅ update() 通知 store 订阅者，自动更新 derived stores
```

### 4.3 "间接依赖" 问题

假设有这样的代码（**错误示例**）：
```javascript
// ❌ 错误：缓存了一次性的派生值，后续变更不会自动反映
let gameRef = $gameInstance;
let gridRef = gameRef.getSudoku().getGrid();

// 当 gameInstance 内部状态变化时，gridRef 不会自动更新
// 因为这里只保存了普通变量，而不是 derived / store 订阅结果
```

**本项目的解决方案**：
```javascript
// ✅ 正确：derived 直接调用方法获取值
const grid = derived(gameInstance, $game => 
  $game.getSudoku().getGrid()  // 每次 store 通知时都重新投影当前棋盘
);
```

---

## 五、相比 HW1 的改进

### 5.1 HW1 的问题

在 HW1 中：
1. **领域对象只在测试中使用**
   - Sudoku 和 Game 类被设计出来，但真实 UI 没有使用
  - UI 仍然直接改二维数组状态

2. **UI 逻辑复杂，状态分散**
   - Undo/Redo 逻辑（如果有实现）散落在组件中
   - 没有统一的状态管理入口

3. **难以测试和维护**
   - 业务逻辑与 UI 耦合，不好单独测试
   - 改 UI 可能影响业务逻辑

### 5.2 HW1.1 的改进

1. **领域对象成为核心**
   - UI 通过 Store Adapter 消费 Game/Sudoku
   - 所有游戏操作都经过领域对象
   - Undo/Redo 作为游戏类的核心功能

2. **清晰的三层架构**
   ```
   UI (Svelte)
      ↓
   Store Adapter (gameStore)
      ↓
   Domain Objects (Game/Sudoku)
   ```

3. **响应式绑定清晰**
   - UI 只订阅 store 暴露的状态
   - 不需要关心内部实现
   - 改变业务逻辑时，UI 代码不需要改

4. **更好的可测试性**
   - 领域对象可单独测试（HW1 的测试都通过了）
   - Store Adapter 可单独测试
   - UI 可单独测试

### 5.3 设计 Trade-offs

**优点**：
- ✅ 关注点分离清晰
- ✅ 易于扩展功能（如添加新的 UI 状态、操作）
- ✅ 业务逻辑与 UI 完全解耦
- ✅ Undo/Redo 从框架级别支持

**缺点**：
- ❌ 层次增加了，性能可能轻微下降（但对小应用忽略不计）
- ❌ 代码量增加
- ❌ 新开发者需要理解多层架构

---

## 六、关键问题解答

### 6.0 本次作业重点问题（可直接答辩）

### 6.1 作业核心要求对照（5 项）

本节用于直接回答本次作业最重要的问题：领域对象是否已经真正接入 Svelte 的真实使用流程。

1. **开始一局游戏（创建 Game + 创建或加载 Sudoku）**
  - `App.svelte` 启动时通过 `createGameStore()` 初始化游戏入口。
  - `gameStore` 内部先创建 `Sudoku`，再创建 `Game`。
  - 新局与题码加载都通过 `newGame/startNew/startCustom` 进入同一条领域对象创建链路。

2. **界面渲染当前局面（grid 来自领域对象）**
  - `grid` 是 `derived(gameInstance, ...)` 计算出来的响应式状态。
  - `grid` 的来源是 `$game.getSudoku().getGrid()`，即领域对象导出的视图状态。
  - 棋盘组件只消费 `$gridStore` 渲染，不直接读取底层内部字段。

3. **用户输入必须调用 Game/Sudoku 接口**
  - `Keyboard` 输入调用 `gameStore.guess(...)`。
  - `gameStore.guess` 再转发到 `$game.guess(...)`。
  - `Game.guess` 内部调用 `Sudoku.guess` 执行真实业务规则。

4. **Undo / Redo 必须调用领域对象逻辑**
  - 界面按钮调用 `gameStore.undo()/redo()`。
  - `gameStore` 转发到 `$game.undo()/redo()`。
  - 真实撤销重做逻辑由 `Game` 的历史机制执行（操作日志 + 可逆操作）。

5. **领域对象变化后，Svelte 界面自动更新**
  - `gameInstance.update/set` 触发 store 通知。
  - `grid/invalidCells/canUndo/canRedo` 等 `derived` 状态自动重算。
  - 组件通过 `$store` 语法自动刷新，无需手动 DOM 更新。

**对照结论**：以上 5 项要求均已满足，且链路发生在真实 UI 交互中，而不是仅在测试代码中。

### 6.2 与上次作业（HW1）的关键区别

1. **HW1 的典型问题**
  - 领域对象更多用于测试契约；真实界面流程不完整地依赖领域层。
  - UI 侧更容易出现直接处理数组/状态细节的写法。

2. **本次 HW1.1 的本质变化**
  - 形成了稳定链路：
    `UI 事件 -> gameStore 命令 -> Game -> Sudoku -> derived 状态 -> UI 刷新`
  - 也就是说，领域对象从“存在于工程中”升级为“真实运行时主路径的一部分”。

3. **回答核心问题**
  - “将领域对象真正接入 Svelte 真实使用流程和上次作业有什么区别？”
    区别在于：这次的界面主流程确实经过 `Game/Sudoku`，不再只是概念上有领域类。
  - “真实游戏界面的主要流程，是否真正通过领域对象完成？”
    是。输入、开局、撤销、重做、渲染状态投影都经过了领域对象链路。

#### 重点问题 1：Svelte 的响应式机制如何与领域对象协作？

本项目采用了“**领域对象 + Store Adapter + Svelte 组件**”的协作方式，而不是让组件直接修改二维数组。
核心结论：Svelte 不直接操作 Sudoku/Game，而是通过 gameStore 这个适配器把“命令”和“状态投影”连接起来。

1. **领域对象只负责业务规则**
  - `Sudoku` 负责棋盘状态与输入规则（如不可修改初始给定格、稀疏变更存储等）
  - `Game` 负责流程与历史（`guess/undo/redo/canUndo/canRedo`）

2. **Store Adapter（`createGameStore`）负责把领域对象映射为可订阅状态**
  - 内部用 `writable(gameInstance)` 持有 `Game`
  - 对外通过 `derived` 导出 `grid/givenGrid/invalidCells/won/canUndo/canRedo`
  - UI 只消费这些响应式状态，不直接接触内部字段

3. **UI 通过“命令方法”驱动领域对象**
  - UI 调用 `gameStore.guess/undo/redo/startNew/startCustom/applyHint`
  - 这些方法内部统一走 `gameInstance.update(...)`
  - `update` 触发 store 通知，`derived` 自动重算，组件自动刷新

4. **为什么这比“直接改数组”稳定**
  - 直接改对象/数组内部字段是内部突变，UI 可能感知不到
  - 通过 store 的 `update/set`，通知链是明确的：
    - 命令执行 -> 领域对象状态变化 -> store 通知 -> derived 重算 -> 组件重渲染

可概括为：

```text
View 发命令
  -> gameStore.update(...)
  -> Game/Sudoku 执行业务逻辑
  -> derived stores 重新计算
  -> Svelte 组件收到新值并刷新
```

#### 重点问题 2：View 层如何消费 Sudoku / Game？

View 层**不直接依赖 `Sudoku`/`Game` 类**，而是统一依赖 `gameStore` 暴露的状态和命令。

1. **顶层注入（App）**
  - `App.svelte` 创建 `gameStore = createGameStore()`
  - 通过 props 传给 `Header`、`Board`、`Controls`
  - 同时订阅 `gameStore.won`，胜利时弹出 `gameover`

2. **Board：读状态并渲染**
  - 订阅 `gameStore.grid/givenGrid/invalidCells`
  - 基于这些状态计算选中、高亮、冲突样式
  - 不直接改棋盘数据

3. **Keyboard：发输入命令**
  - 根据 `givenGrid` 判断当前格是否可编辑
  - 可编辑时调用 `gameStore.guess(row, col, value)`
  - 不直接写 `Sudoku` 的内部字段（如 `userMoves`）

4. **ActionBar：发流程命令**
  - 订阅 `canUndo/canRedo/grid`
  - 点击按钮触发 `gameStore.undo()/redo()/applyHint()`

5. **Header/Dropdown：发“新局”命令**
  - 选择难度后调用 `gameStore.startNew(difficulty)`
  - 输入题码后调用 `gameStore.startCustom(sencode)`

因此，View 层消费方式可以总结为：

```text
只读：消费 gameStore 暴露的响应式状态
只写：调用 gameStore 暴露的命令方法
禁止：直接修改 Sudoku/Game 的内部字段
```

这使得 UI 与业务规则解耦：
- 组件关注“显示什么、何时禁用按钮”
- 领域对象关注“操作是否合法、历史如何维护”
- Store Adapter 负责两者之间的数据契约

### 6.3 Svelte 响应式机制：本项目必须理解的 5 个问题

#### Q1: 为什么修改对象内部字段后，界面不一定自动更新？

**结论**：Svelte 不会自动观察任意对象深层字段；如果没有触发 `store.set/update` 或变量重新赋值，界面可能不更新。

本项目依赖的正确机制是：

```javascript
gameInstance.update($game => {
  $game.guess({ row, col, value });
  return $game;
});
```

这段代码会触发 store 通知，随后 `derived(grid/invalidCells/canUndo...)` 重新计算，组件收到新值后刷新。

错误做法示例（绕过通知链）：

```javascript
// ❌ 直接改内部结构，不经过 gameInstance.update/set
game.currentSudoku.userMoves.set(0, 5);
```

#### Q2: 为什么直接改二维数组元素，有时 Svelte 不会按预期刷新？

**结论**：`arr[i][j] = x` 是内部突变，外层引用未变。对普通变量场景，这种写法通常不会触发响应更新。

```javascript
// ❌ 内部突变
arr[0][0] = 99;

// ✅ 产生新引用（普通变量场景）
arr = arr.map((row, i) =>
  i === 0 ? row.map((v, j) => (j === 0 ? 99 : v)) : row
);
```

本项目避免这个问题的方式是：UI 不直接改 `grid`，而是统一调用 `gameStore.guess(...)`，让领域对象改状态，再由 `derived` 重新投影。

#### Q3: 为什么 store 可以被 `$store` 消费？

**结论**：`$store` 是 Svelte 编译期语法糖，等价于“自动订阅 + 自动取消订阅 + 取当前值”。

因此在组件里可以直接写：

```svelte
{#each $gameStore.grid as row}
  ...
{/each}
```

这也是本项目 UI 自动更新的基础之一：组件订阅的是 store，而不是手写轮询或手动同步。

#### Q4: 为什么 `$:` 有时会更新，有时不会更新？

**结论**：`$:` 只会在“语句中被直接引用的依赖”变化时重跑。

本项目中的正确用法示例（来自组件）：

```svelte
$: keyboardDisabled = $gamePaused || $cursor.x === null || $cursor.y === null || isLockedCell;
```

上面语句直接依赖 `$gamePaused`、`$cursor`、`isLockedCell`，这些值变化就会重算。

如果依赖没被直接引用，或者只改了某个未被追踪的深层字段，`$:` 可能不会按预期触发。

#### Q5: 为什么“间接依赖”可能导致 reactive statement 不触发？

**结论**：把关键值先缓存到普通变量，容易丢失响应式依赖关系。

```javascript
// ❌ 间接依赖：只取了一次快照
const gridRef = game.getSudoku().getGrid();
$: rows = gridRef.length;
```

`gridRef` 本身不随 store 自动更新，导致后续语句不触发。

本项目的解决方式：让依赖绑定在 store/derived 上。

```javascript
const grid = derived(gameInstance, $game => $game.getSudoku().getGrid());
```

组件层再消费 `$grid` 或 `$gameStore.grid`，即可保持依赖链完整。

#### 本节小结：本方案依赖了哪些 Svelte 机制

1. `writable`：持有 `Game` 运行时实例。
2. `update/set`：触发状态变更通知。
3. `derived`：把领域对象状态投影为 UI 可消费状态。
4. `$store`：组件自动订阅并响应更新。
5. `$:`：在组件内部做轻量派生计算。

**因此 UI 会更新的根本原因**：
命令调用进入 `gameStore` -> `gameInstance.update` 发出通知 -> `derived` 重算 -> 组件的 `$store` 值变化 -> Svelte 重新渲染。

**如果错误地直接 mutate 对象**：
你会绕过 `update/set` 通知链，导致 `derived` 不重算，界面出现“数据改了但不刷新”或“局部状态不同步”的问题。

---

## 七、关键改动列表

| 文件 | 改动 | 说明 |
|------|------|------|
| `src/domain/sudoku.js` | 📝 新建 | Sudoku 类实现 |
| `src/domain/game.js` | 📝 新建 | Game 类实现（Undo/Redo 核心） |
| `src/domain/index.js` | 📝 新建 | 导出工厂函数 |
| `src/stores/gameStore.js` | 📝 新建 | Store Adapter，连接层 |
| `src/App.svelte` | ✏️ 修改 | 初始化 gameStore，传递给子组件 |
| `src/components/Board/index.svelte` | ✏️ 修改 | 使用 gameStore.grid 代替旧 store |
| `src/components/Controls/Keyboard.svelte` | ✏️ 修改 | 调用 gameStore.guess() |
| `src/components/Controls/ActionBar/Actions.svelte` | ✏️ 修改 | 添加 Undo/Redo 事件处理 |
| 其他组件 | ✏️ 修改 | 传递 gameStore prop |

---

## 八、如何使用

### 初始化游戏（在 App.svelte 中）：
```javascript
import { createGameStore } from './stores/gameStore.js';

export let gameStore = createGameStore();
// 此时游戏已以默认空棋盘初始化
```

### 用户操作（在任何组件中）：
```javascript
// 用户输入
gameStore.guess(row, col, value);

// 撤销
gameStore.undo();

// 重做
gameStore.redo();

// 新游戏
gameStore.newGame(initialGrid);
```

### 订阅状态（在组件中）：
```svelte
<script>
  export let gameStore;
</script>

{#each $gameStore.grid as row}
  {#each row as cell}
    <!-- 仅当 grid 变化时重新渲染 -->
  {/each}
{/each}

{#if $gameStore.won}
  <p>恭喜赢了！</p>
{/if}
```

---

## 九、未来改进方向

1. **完整迁移**：将旧的 store（如 `@sudoku/stores/grid` 等）完全替换
2. **Hint 功能**：通过 gameStore 提供，使用 solver 库
3. **持久化**：Store Adapter 支持 localStorage 保存进度
4. **网络同步**：用于多人实时同步
5. **Svelte 5 迁移**：使用 runes 和 reactive classes 进一步简化

---

## 十、项目测试

所有 HW1 的 15 个测试用例均通过 ✅

```
✓ tests/hw1/01-contract.test.js (3 tests)
✓ tests/hw1/02-sudoku-basic.test.js (5 tests)
✓ tests/hw1/03-clone.test.js (2 tests)
✓ tests/hw1/04-game-undo-redo.test.js (3 tests)
✓ tests/hw1/05-serialization.test.js (2 tests)
```

---

## 总结

本次作业成功实现了将领域对象真正接入 Svelte 游戏流程的目标。通过清晰的三层架构（UI → Store Adapter → Domain Objects），确保了：

1. **业务逻辑与 UI 的分离**
2. **Undo/Redo 的完整集成**
3. **代码的可测试性和可维护性**
4. **响应式更新的正确性**

这为后续 Svelte 5 迁移、功能扩展等奠定了坚实基础。
