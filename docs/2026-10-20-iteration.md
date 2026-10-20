# 2026-10-20 迭代记录：从 3 款到 12 款

本文记录本轮迭代的目标、决策、交付与验证，便于后续接手者快速还原上下文。
逐项变更见 [CHANGELOG.md](../CHANGELOG.md)，后续计划见 [ROADMAP.md](../ROADMAP.md)。

## 背景与目标

- 起点：v1 已有 3 款游戏（谁是卧底、你画我猜、真心话大冒险），需要扩充玩法。
- 方式：先调研 10 款候选游戏并核实链接，再由用户决定纳入范围。
- 结果：排除海龟汤，其余 9 款全部纳入，内置游戏达到 12 款。
- 额外目标：借扩容做一次工程化体检，修复房间生命周期、隐私与稳定性问题。

## 选型与参考链接

以下链接仅用于玩法调研，未复制其题库、美术或代码；词库与题库均为自建。

| 候选 | 参考链接 | 决策 | 说明 |
|---|---|---|---|
| 假画家 Fake Artist | [在线版](https://fake-artist-online.games.asta.uni-goettingen.de/) · [原版规则](https://oinkgames.com/en/games/analog/a-fake-artist-goes-to-new-york/) | 加入 | 复用画布，成本最低、笑点高 |
| 一字提示 Just One | [BGA](https://en.boardgamearena.com/gamepanel?game=justone) · [oneword.games](https://oneword.games/) | 加入 | 纯文字，重复提示作废 |
| 波长 Wavelength | [wavelengthonline.io](https://wavelengthonline.io/) | 加入 | 滑杆交互，规则简单 |
| 编瞎话 Fibbage 类 | [Jackbox 官方](https://www.jackboxgames.com/games) | 加入 | 纯文字，编答案 + 投票 |
| 间谍游戏 Spyfall | [spyfall.adrianocola.com](https://spyfall.adrianocola.com/) | 加入 | 地点私密信息 + 投票 |
| 词语炸弹 BombParty | [jklm.fun](https://jklm.fun/) | 加入 | 改为中文「含字组词」 |
| 行动代号 Codenames | [codenames.game](https://codenames.game/) | 加入 | 团队 + 队长私密视角 |
| 传话画图 Gartic Phone | [garticphone.com/zh-CN](https://garticphone.com/zh-CN) | 加入 | 写画猜多阶段接力 |
| 阿瓦隆 Avalon | [netgames.io/games/avalon](https://netgames.io/games/avalon/) | 加入 | 组队 / 任务 / 刺杀 |
| 海龟汤 | [haiguitang.net](https://haiguitang.net/) | 排除 | 用户明确不要 |

关键取舍：

- 阿瓦隆做简化版，只保留梅林 / 刺客 / 爪牙 / 忠臣，避免手机端信息密度过高。
- 词语炸弹做中文改编版，只校验「含指定汉字 + 不重复 + 纯中文 + 2~8 字」，不做词典校验。
- 不引入 AI 主持、外部数据库或第三方运行时依赖，保持纯 Node + ws 的部署形态。

## 交付内容

### 共享协议（packages/shared）

- `src/base.ts`：`PlayerId`、`GameId`（12 款）、`RoomInfo`、`DrawOp` 等基础结构。
- `src/states/`：12 个游戏的状态与私密类型，`protocol.ts` 汇总为 `GameState` / `GamePrivate`。
- `src/meta.ts`：12 款游戏的名称、图标、人数、玩法说明与大厅列表。
- 新增词库/题库：`fake-artist-words.ts`、`just-one-words.ts`、`wavelength-prompts.ts`、
  `fibbage-questions.ts`、`codenames-words.ts`、`spyfall-locations.ts`、`bombparty-prompts.ts`。
- `ClientMessage` 新增：`submit`、`choose`、`submit-drawing`、`toggle`、`submit-team`、
  `vote-team`、`quest-vote`、`assassinate`、`codename-clue`。

### 服务端（packages/server）

- `games/util.ts`：`Timer`、`normalizeText` / `compactText`、`sanitizeDrawOp`、`shuffle`。
- 新增 9 个游戏状态机：`fake-artist.ts`、`just-one.ts`、`wavelength.ts`、`fibbage.ts`、
  `spyfall.ts`、`bombparty.ts`、`codenames.ts`、`telephone.ts`、`avalon.ts`。
- `games/index.ts`：`Record<GameId, () => Game>` 工厂，新增游戏时编译期强制补全。
- `index.ts`：报文校验、异常兜底、WebSocket `maxPayload`、会话回收、路径前缀防护。
- `room.ts`：座位移除、房主转让、空房销毁、动态 `hostLeft`、房主权限提示。

### 客户端（packages/client）

- `components/CanvasBoard.tsx`：可交互 `CanvasBoard` + 只读 `StaticCanvas`。
- 新增 9 个视图：`FakeArtistGameView`、`JustOneGameView`、`WavelengthGameView`、
  `FibbageGameView`、`SpyfallGameView`、`BombPartyGameView`、`CodenamesGameView`、
  `TelephoneGameView`、`AvalonGameView`。
- `App.tsx` 按 `game.game` 挂载 12 个视图；断线自动回大厅。
- `net/useSocket.ts`：指数退避重连、卸载时清理重连定时器。
- `styles.css`：词卡、光谱、词阵、炸弹、命数、任务轨道、链路回放等样式。

### 测试与工程化

- `tests/lib.mjs`：连接、建房、`waitFor`、统一收尾。
- `tests/room.mjs`：退出、同名重进、房主转让、空房回收、畸形报文。
- 9 个游戏冒烟测试 + 原有 3 个，`npm test` 共 13 个用例。
- `npm run verify`：typecheck + test + build。
- `.github/workflows/ci.yml`：push / PR 执行 `npm ci && npm run verify`。
- 文档：README、HANDOFF、CLAUDE、CHANGELOG、ROADMAP、本记录、`.qoder/repowiki/wiki_plan.yaml`。

## 审查阶段修复

| 严重度 | 问题 | 修复 |
|---|---|---|
| Critical | 编瞎话用 `truth` / `f-<playerId>` 作为候选 id，泄漏真答案与作者 | 改为不透明 `o0..oN`，服务端保留 correct/author 映射 |
| Critical | 缺少 `code` 的 join 报文触发 TypeError，进程退出 | `String(msg.code ?? '')` + 报文对象校验 + try/catch |
| Critical | 房主掉线后旧 `isHost` 未清除，`hostId` 指向离线玩家，计时器停摆 | 转移时清理旧标记；`hostId` 只认在线者；`hostLeft` 动态 getter |
| High | 任一玩家退出会销毁整个房间，session / seat 泄漏 | `removePlayer` + 关闭连接回收 session + 空房才销毁 |
| High | 阿瓦隆未投票按名册人数计入否决，掉线会拖垮投票 | 分母改为在线玩家；布尔字段严格校验 |
| High | 传话画图单幅画无上限，reveal 全量广播放大 | 40 笔 / 1500 点上限 + WebSocket 512 KB 单帧限制 |
| Medium | 波长未提交者按 50 分白拿分 | 未提交不计分、不参与最接近判定 |
| Medium | 12 款游戏三套计时实现并存 | 统一使用 `Timer`，移除 `Game.tick` 死接口 |
| Low | 阿瓦隆结束不公开身份，无法复盘 | gameover 公开 `revealedRoles` |
| Low | 断线重连定时器在卸载后仍可能触发 | `disposed` 标记 + `clearTimeout` |

## 验证记录

```bash
npm run verify
# typecheck: client / server / shared 全部通过
# test: room + 12 款游戏 = 13/13 PASS
# build: shared → client → server 通过
```

- 前端产物：业务 JS 约 58 KB（gzip 16.6 KB），React 约 142 KB（gzip 45.5 KB）。
- 浏览器实测：大厅展示 12 款游戏；两个客户端完成波长完整流程；控制台无 error。
- 静态盘点：无 `any`、`@ts-ignore`、TODO/FIXME；最大源文件 297 行。

## 已知限制

- 断线释放座位且没有重连令牌，需要重新加入；私密信息不补发。
- 阿瓦隆为简化角色集；词语炸弹不做真实词典校验。
- 房间与游戏状态驻留内存，单进程部署，重启即清空。
- 浏览器人工点验只覆盖波长，其余 11 款为协议级验证。
- 两张浏览器验收截图留在仓库根目录（`shot-guest-game*.png`），未提交，可手动删除。

## 后续方向

见 [ROADMAP.md](../ROADMAP.md)。近期优先级：P1 工程化（ESLint/Prettier、测试升级、
Error Boundary、shared watch、GameBase），其次 P0 公网加固（Origin 白名单、限流、
优雅退出、`/healthz`）。
