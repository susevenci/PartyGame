# 项目规范（CLAUDE.md / AGENTS.md 同源）

> 本规范整合自 awesome-cursorrules-zh 中与本项目技术栈最相关的规则集
> （react-typescript、code-guidelines-comprehensive、express 后端规范、
> es-module-guide、cloud-gaming 的实时通信章节、git-conventions），
> 并按「Vite + React + TS + 纯 ws 服务端」的实际栈做了裁剪。

## 项目结构（npm workspaces monorepo）

```
party-games/
├── package.json          # workspaces 根，只放跨包脚本
├── tsconfig.base.json    # 共享 TS 严格配置
└── packages/
    ├── shared/           # @party-games/shared：协议类型 + 游戏元信息 + 词库（前后端共用，是唯一的“合同”）
    ├── server/           # @party-games/server：纯 Node + ws，零框架
    │   └── src/
    │       ├── index.ts  # HTTP 静态服务 + WebSocketServer 入口
    │       ├── room.ts   # 房间：座位/房主/生命周期，与具体游戏解耦
    │       └── games/    # 游戏插件（每个游戏一个文件，实现 Game 接口后在 index.ts 注册）
    └── client/           # @party-games/client：Vite + React 18 + TS
        └── src/
            ├── net/      # WebSocket hook
            ├── screens/  # 大厅 / 房间等待室
            ├── games/    # 每个游戏一个视图组件
            └── components/ # 共用 UI
```

## 硬性规则

1. **协议唯一来源**：所有前后端消息类型必须定义在 `packages/shared/src/protocol.ts`，
   禁止在 client/server 里另起一套消息结构。改协议必须先改 shared。
2. **服务端是唯一权威**：发词、计时、判定猜中、投票结果全部在服务端计算；
   客户端只做展示与提交意图。客户端收到的状态（GameState）一律视为不可信展示数据。
3. **私密信息只发本人**：卧底身份、要画的词等只能走 `game-private` + `sendTo`，
   严禁混进 `game-state` 或广播消息。
4. **游戏插件化**：新增游戏 = 在 `shared` 加类型/词库 + 在 `server/src/games/` 加实现
   并注册 + 在 `client/src/games/` 加视图。不得为了一个游戏去改 `room.ts` 的主流程
   （如确需扩展 GameContext，先在这里补充说明）。
5. **Timer 必须可清理**：游戏内的所有 `setTimeout` 必须保存句柄、在 `destroy()` 里
   `clearTimeout`；游戏推进前先检查 `ctx.hostLeft`。

## 代码规范

- TypeScript `strict` 全开；禁止 `any`（确需时用 `unknown` 收窄）。
- 命名：类/接口/组件 PascalCase；变量/函数 camelCase；文件组件用 PascalCase.tsx、
  工具/模块用 kebab-case 或 camelCase 保持一致（现仓库：模块 camelCase，游戏视图 PascalCase）。
- 函数尽量 ≤ 50 行、文件 ≤ 400 行；超过就拆。
- 每个函数做且只做一件事；房间与游戏的职责边界见上文。
- 注释只写“为什么”和协议约束，不写“这行在干什么”。
- 错误处理：服务端对未知消息类型静默忽略（向前兼容）；对非法操作回 `error` 消息，
  不向客户端抛 500。
- UI 文案统一中文；emoji 作为图标的主要手段（无图标库依赖）。

## 移动端优先

- 布局基准宽度 ≤ 520px，大屏居中卡片（`.card { max-width: 520px }` 约定）。
- 所有交互必须支持触摸：画布用 Pointer Events + `touch-action: none`；
  按钮可点区域 ≥ 40px；禁止依赖 hover 才出现的功能。
- 注意 iOS 安全区（`env(safe-area-inset-*)`）与 `100dvh` 场景。
- 状态持久化只用 localStorage 存用户偏好（昵称/头像），不存游戏数据。

## 实时通信规范

- 消息格式：单个 JSON 对象，`type` 字段判别（Discriminated Union）。
- 断线策略：客户端指数退避重连（1s→10s 封顶）；服务端保留座位标记离线，
  房间空了才销毁。重连者靠 `room-update` + `getState()` 补状态（当前实现：
  游戏中断线重连不补状态，v2 再做）。
- 广播前检查 `ws.readyState === OPEN`。

## 工程命令

```bash
npm run dev        # 同时起 server(3000) 与 client(5173, 已配 /ws 代理)
npm run build      # shared → client → server 依次构建
npm start          # 生产模式：server 直接托管 client/dist
npm run typecheck  # 全 workspace 类型检查（提交前必跑）
```

- 提交前必须 `npm run typecheck` 通过。
- 不引入未讨论的新运行时依赖；新依赖需说明理由。

## Git 规范（约定式提交）

- `feat: 新增你画我猜`、`fix: 卧底平票死循环`、`docs:`、`refactor:`、`chore:`
- scope 可选：`feat(server): …` / `fix(client): …` / `feat(shared): …`

## 安全基线

- 昵称/消息长度上限（12/200 字符）在服务端强制，不依赖客户端。
- 静态文件服务禁止路径穿越（已在 serveStatic 做前缀校验）。
- 房间号 6 位（去掉易混淆字符），无鉴权——定位为“朋友间自建房”，不做公开房间列表。
