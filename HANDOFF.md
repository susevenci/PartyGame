# 交接文档（HANDOFF）

> 面向后续开发者 / AI Agent：读完 README + 本文 + `CLAUDE.md`，即可继续开发。
> 更新时间：2026-10-16

## 一句话现状

**v1 已完成并验证**：3 个聚会小游戏（谁是卧底 / 你画我猜 / 真心话大冒险）的
完整多人在线功能已实现，服务端协议通过自动化冒烟测试（`npm test` 全绿），
生产构建可一键运行（`npm run build && npm start`），手机/电脑浏览器均可玩。
代码已推送至 GitHub：<https://github.com/susevenci/PartyGame>（默认分支 `main`）。

## 新机器上手（克隆 → 验证 → 继续开发）

```bash
git clone https://github.com/susevenci/PartyGame.git
cd PartyGame
npm install          # 依赖由 package-lock.json 锁定，Node >= 20
npm run typecheck    # 应全绿
npm test             # 自动构建 shared+server 并跑 3 个协议冒烟测试，应全 PASS
npm run dev          # 开发：server:3000 + client:5173
```

提交规范：Conventional Commits（见文末）；推送前先 `npm run typecheck && npm test`。

## 环境要求

- Node.js ≥ 20（开发机当前为 Node 24 / npm 11）
- 无数据库、无额外服务依赖，纯 Node 进程
- Windows / macOS / Linux 均可（开发于 Windows 10 + Git Bash）

## 常用命令

```bash
npm install                 # 安装依赖
npm run dev                 # 开发模式：server:3000 + client:5173（热更新）
npm run typecheck           # 全 workspace 类型检查（提交前必跑）
npm run build               # 构建 shared → client → server
npm start                   # 生产模式：http://localhost:3000（server 托管前端产物）
npm test                    # 冒烟测试（自动构建 shared+server，起 :3100 测试服务器，跑完自动关）
```

## 已完成清单（v1）

- [x] Monorepo 工程化（npm workspaces：shared / server / client）
- [x] 通信协议：`packages/shared/src/protocol.ts`（Discriminated Union，前后端唯一契约）
- [x] 房间系统：6 位房号、房主制、房主掉线自动转让、空房回收、断线保留座位
- [x] 游戏插件机制：`Game` 接口 + 工厂注册（见 `server/src/games/`）
- [x] 谁是卧底（4–10 人）：发密牌、夜晚击杀、白天描述、投票放逐、胜负判定
- [x] 你画我猜（2–8 人）：Canvas 画板（Pointer Events 触摸支持）、笔迹广播、猜词计分、换词
- [x] 真心话大冒险（2–10 人）：抽卡、自报结果、房主代填/跳过、翻牌回顾
- [x] 词库：卧底词对 ~95 组、画词 ~96 个、真心话 30 + 大冒险 30
- [x] 房间等待室：房号复制、局域网地址自动探测（`/api/lan`）、就绪机制
- [x] 移动端适配：≤520px 布局、safe-area、触摸画布
- [x] 冒烟测试：`tests/`（多进程 WebSocket 客户端模拟真人流程）
- [x] 规范文档：CLAUDE.md（整合自 awesome-cursorrules-zh）
- [x] 生产静态托管 + 路径穿越防护

## 已知限制（v1，续作时先看这里）

1. **断线重连不补私密信息**：游戏中断线后重连，该玩家收不到自己的词牌/画词
   （`Room.syncTo` 只补公开状态）。修法方向：`hello` 时若 `room.status==='playing'`，
   服务端重新对该玩家 sendTo 私密信息（服务端需把私密信息缓存在 Game 实例上，
   目前只有开局时发过一次，未持久保存）。
2. **卧底夜晚不能手动选刀**：当前由服务端随机击杀一个平民（`werewolf.ts` 的
   `nightKill`）。开放手动选刀：给卧底加 `type:'night-target'` 消息 + 夜晚阶段超时兜底。
3. **你画我猜的画布历史上限 300 笔**（App.tsx 里 `slice(-300)`），超长局可能丢旧笔画。
4. **无 PWA**：手机只能从地址访问，无法添加到主屏。后续可加 manifest + Service Worker
   （注意 `/ws` 与动态地址，SW 只做缓存不拦截 WS）。
5. **猜测匹配偏宽松**：`drawing.ts` 的 `handleGuess` 允许子串匹配，"猫" 能猜中 "熊猫"。
6. **无前端组件测试**：目前只有服务端协议冒烟测试。
7. 谁是卧底的描述阶段是 30s 计时提示（口头描述），未做"轮到谁发言"的强提示高亮。

## 规划中的 v2 候选（按建议优先级）

1. 海龟汤（纯文字推理，房间框架可直接复用，成本最低）
2. 断线重连补状态 + 卧底手动选刀（补齐 v1 缺口）
3. PWA 化（手机加桌面图标）
4. 情侣模式（2 人特化词库/卡片）
5. 表情头像上传 / 房间名 / 音效

## 关键架构决策（为什么这么做，改之前先想清楚）

- **纯 `ws` + JSON 而非 socket.io**：消息量极小（文字/回合事件），自定协议更透明，
  依赖更少。换传输层只需改 `client/src/net/useSocket.ts` 与 `server/src/index.ts` 的收发。
- **服务端权威状态机**：所有判定（发词、猜中、投票、胜负）都在服务端；
  客户端发的是"意图"（vote/answer/pick-card），服务端验证后广播"事实"（game-state）。
- **游戏插件化**：房间（room.ts）不认识具体游戏；游戏只通过 `GameContext`
  与房间交互。新增游戏不改房间代码——这是项目可扩展性的核心。
- **shared 包同时服务类型检查与运行时**：`exports.types` 指向 `.ts` 源（IDE/类型检查），
  `exports.import` 指向 `dist`（运行时）。因此**改完 shared 必须先
  `npm run build -w @party-games/shared`**（根 `npm run dev` / `npm run build` 已自动处理）。
- **ESM + `.ts` 扩展名相对导入**：tsc 用 `rewriteRelativeImportExtensions` 编译出
  `.js` 引用。**新增/修改 import 时必须带 `.ts` 扩展名**（server 与 shared 包内），
  否则 Node 运行时解析失败。

## 目录速查

```
party-games/
├── CLAUDE.md            ★ 项目规范（先读）
├── README.md            用户向：玩法/部署
├── HANDOFF.md           ← 本文（开发者/Agent 向：现状/坑/路线）
├── packages/
│   ├── shared/          协议契约 + 元信息 + 词库
│   │   └── src/{protocol,meta,words,drawing-words,truth-dare}.ts
│   ├── server/          纯 Node + ws
│   │   └── src/{index.ts(入口/HTTP/WS), room.ts(房间), games/(三个游戏+types+注册)}
│   └── client/          Vite + React 18
│       └── src/{App.tsx, main.tsx, styles.css, net/useSocket.ts,
│                 screens/{Lobby,Room}.tsx, games/{三个视图}.tsx, components/common.tsx}
└── tests/               冒烟测试（run-all.mjs 自动起停服务器）
```

## 添加一个新小游戏的标准步骤（照抄）

1. `shared/src/protocol.ts`：在 `GameId` 联合类型加 id；新增 `XxxState`（进 `GameState`
   联合）；如需新消息加进 `ClientMessage` / `ServerMessage`。
2. `shared/src/`：加词库/数据文件并在 `index.ts` re-export。
3. `shared/src/meta.ts`：`GAME_META` 加条目（名称/人数/玩法说明，大厅自动展示）。
4. `server/src/games/xxx.ts`：实现 `Game` 接口（参考 `truth-dare.ts`，最简单的一个）；
   在 `server/src/games/index.ts` 工厂注册。**Timer 必须保存句柄并在 destroy() 清理。**
5. `client/src/games/XxxGameView.tsx`：视图组件；`client/src/App.tsx` 的
   `GameScreen` 里按 `game.game === 'xxx'` 挂载。
6. `tests/xxx.mjs` + 把文件名加进 `tests/run-all.mjs` 的循环数组。
7. `npm run typecheck && npm test` 全绿后提交。

## 部署提醒

- 生产：`npm run build && npm start`，把 3000 端口暴露出去（局域网 IP / 内网穿透 / VPS）。
- 环境变量：`PORT`（默认 3000）、`STATIC_DIR`（默认 `packages/client/dist`）。
- 房间存内存：进程重启即清空（v1 定位是临时房，可接受）。

## 提交信息（Conventional Commits）

`feat(scope): 描述` / `fix(scope): 描述`，scope ∈ server | client | shared | tests | docs。
