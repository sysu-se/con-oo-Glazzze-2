# con-oo-Glazzze-2 - Review

## Review 结论

当前实现已经把 `Sudoku` / `Game` 接入到了主渲染、输入、Undo/Redo 链路，方向是对的；但接入层没有把“整局游戏状态”真正收口，`newGame` / `importCode` 与若干独立 UI store 之间存在明显脱节，因此整体更像“主要流程已接上，但会话边界还没设计完整”。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | good |
| JS Convention | fair |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. 导入流程只替换 Game，对整局会话状态没有重置

- 严重程度：core
- 位置：src/stores/gameStore.js:210-229
- 原因：`importCode()` 在恢复 `Game` 后直接 `gameInstance.set(restoredGame)` 返回，没有同步重置计时器、暂停态以及其他与局面绑定的 UI 状态。静态阅读下，这意味着“加载一局游戏”可能继承上一局的 elapsed time 和交互上下文，破坏了作业要求里的“创建或加载 Sudoku”这一完整游戏流程。

### 2. 新开局只更换领域对象，未收拢外部 UI store，导致跨局污染

- 严重程度：core
- 位置：src/stores/gameStore.js:136-143
- 原因：`newGame()` 只新建 `Sudoku/Game` 并重置 timer/pause，但棋盘选择、候选数、提示次数、notes 等状态仍由领域对象之外的独立 store 维护。结果是同一份 UI 还依赖多套状态源，开新局后旧局残留状态仍可能继续影响当前局面，这说明 Svelte 接入尚未真正形成单一的游戏会话边界。

### 3. 反序列化对非法存档过于宽松，会悄悄吞掉对 givens 的非法修改

- 严重程度：major
- 位置：src/domain/sudoku.js:327-355
- 原因：`createSudokuFromJSON()` 通过 `guess()` 回放用户输入，而 `guess()` 对初始 givens 的修改是静默忽略而不是显式报错。这样一来，损坏或伪造的 payload 会被“部分接受、部分丢弃”，调用方无法区分“合法无变化”和“非法数据被吞掉”，领域对象契约不够清晰，也削弱了序列化设计的可靠性。

### 4. Header 中的新游戏流程与 Welcome 流程不一致，确认后会停在暂停态

- 严重程度：major
- 位置：src/components/Header/Dropdown.svelte:15-24
- 原因：这里的确认弹窗 `onHide` 是空函数，而 `gameStore.startNew()` 内部又把游戏设为 `paused=true`。因此从 Header 菜单开始新游戏后，弹窗关闭并不会像 Welcome 流程那样自动恢复，用户还得再额外点一次播放。这属于真实 Svelte 游戏流程上的接线不一致。

### 5. 领域校验结果用字符串坐标表达，向视图层泄漏了表示细节

- 严重程度：minor
- 位置：src/domain/sudoku.js:56-116
- 原因：`validate()` 返回的是 `"row,col"` 形式的字符串数组，视图层再用字符串拼接和 `includes()` 消费。这个接口更像为当前组件写的临时协议，而不是稳定的领域建模；如果返回结构化坐标对象或值对象，`Sudoku` 与 Svelte 视图的耦合会更低。

### 6. 同步读取 store 的方式不符合 Svelte 生态惯例

- 严重程度：minor
- 位置：src/stores/gameStore.js:269-272
- 原因：`getGame()` 通过“立即订阅再立刻取消订阅”来拿当前值，属于可工作但不地道的写法；同文件里 `pausedValue` 也靠手工订阅镜像状态。对 Svelte 3 来说，这类场景更适合直接使用 `get(store)` 或收敛为单一 store 读写接口。

## 优点

### 1. 初始题面不可变，用户输入采用稀疏变更存储

- 位置：src/domain/sudoku.js:15-24
- 原因：`initialGrid` 经过深拷贝和冻结，`userMoves` 只记录玩家改动，避免了 UI 或外部代码意外污染 givens，也让序列化和回放更清晰。

### 2. 历史建模为操作日志而不是整盘快照

- 位置：src/domain/game.js:30-35
- 原因：`Game` 用 `history + currentIndex` 记录可重放操作，职责边界比“每步都塞整盘 Sudoku”更清楚，也更接近 Undo/Redo 领域模型本身。

### 3. 新输入会正确截断 redo 分支

- 位置：src/domain/game.js:64-75
- 原因：在 `currentIndex < history.length` 时先裁剪历史再写入新操作，Undo/Redo 语义是对的，没有把过期未来分支错误保留下来。

### 4. 采用了明确的 Store Adapter，把领域对象转成 Svelte 可消费状态

- 位置：src/stores/gameStore.js:66-93
- 原因：`grid`、`givenGrid`、`invalidCells`、`won`、`canUndo`、`canRedo` 都是从 `Game/Sudoku` 派生出来的订阅态，符合题目推荐的 adapter 方案，也回答了“View 如何消费领域对象”。

### 5. 用户输入已经不再直接改二维数组

- 位置：src/components/Controls/Keyboard.svelte:28-30
- 原因：键盘输入明确走 `gameStore.guess()`，把 UI 事件转发到 `Game -> Sudoku`，而不是在组件里直接 mutate 棋盘，这是这次作业最关键的接入点之一。

### 6. 棋盘渲染确实来自领域导出的视图状态

- 位置：src/components/Board/index.svelte:47-58
- 原因：Board 使用 `$gridStore`、`$givenGridStore` 和 `$invalidCellsStore` 渲染局面、givens 与冲突态，说明界面显示的核心棋盘状态已经由领域对象驱动。

## 补充说明

- 未运行测试；以上结论全部基于对 `src/domain/*`、`src/stores/gameStore.js` 以及相关 Svelte 组件的静态阅读。
- 关于“导入后计时器/提示/候选数等状态可能残留”的判断，来自代码路径分析：在 `newGame()` / `importCode()` 中未看到对应 UI store 的重置调用。
- 本次审查未展开到无关目录，也未依据运行时行为修正静态推断；若某些弹窗或外部 store 在别处有隐式副作用，这里没有将其计入结论。
