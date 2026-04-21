## HW 问题收集

列举在HW 1、HW1.1过程里，你所遇到的2\~3个通过自己学习已经解决的问题，和2\~3个尚未解决的问题与挑战

### 已解决

1. 序列化和反序列化是什么意思？和返回的可读字符串有什么区别？
   1. **上下文**：Coding Agent 说：”写 createSudoku(input):toJSON()：返回纯数据 { grid }、toString()：返回可读字符串（多行）……写 Game 状态机（核心）：toJSON()：序列化当前局面 + undo/redo 栈……createGameFromJSON：把 json.sudoku / undoStack / redoStack 全部还原成 Sudoku 对象，再交给 makeGameState“ 
   2. **解决手段**：直接询问CA+查阅网页资料
2. Svelte store（writable、subscribe、状态同步）是什么意思？
   1. **上下文**：Coding Agent 说：“这两个文件职责不同：src/domain/index.js：领域层，纯业务逻辑（数独状态、落子、撤销重做、序列化），不依赖 UI 框架。src/game.js：应用/适配层，把领域逻辑包装成 Svelte store（writable、subscribe、状态同步）”
   2. **解决手段**：直接询问CA
3. Store Adapter是什么意思？它是怎么作为连接层工作的？
   1. **上下文**：Coding Agent 说：“第 4 步：创建 Store Adapter（关键！连接层）目标： src/stores/gameStore.js内容说明：创建一个新的 store 来连接领域对象和 Svelte UI：”
   2. **解决手段**：直接询问CA+查阅网页资料
4. 可订阅状态是什么意思？是怎么实现通知机制的？
   1. **上下文**：Coding Agent 说：“gameStore 持有领域对象，并把它变成可订阅状态”
   2. **解决手段**：直接询问CA+查阅网页资料

### 未解决

1. 什么情况下采用class形式比factory function的形式要更合适？

   1. **上下文**：下次遇到不同的问题我应该怎么判断在什么情况下采用class形式比factory function的形式要更合适？

      ```javascript
      export { Sudoku, createSudoku, createSudokuFromJSON } from './sudoku.js';
      export { Game, createGame, createGameFromJSON } from './game.js'
      ```

   2. **尝试解决手段**：问CA未果

2. Store Adapter是怎么作为连接层工作的？和方案B领域对象自身实现可订阅接口有什么区别

   1. **上下文**：Store Adapter核心作用：
✅ 是 Svelte 和领域对象之间的桥梁
✅ 提供响应式状态（方案 A - Store Adapter）
✅ UI 不直接接触 Game 对象，而是通过这个 adapter
   2. **尝试解决手段**：问CA未果