# 🎉 聚会小游戏（party-games）

电脑浏览器 + 手机浏览器都能玩的多人在线聚会小游戏合集，面向朋友聚会与情侣互动。
支持**同一 WiFi 局域网直连**与**远程部署连接**。

仓库地址：<https://github.com/susevenci/PartyGame>（默认分支 `main`）

## 已内置游戏

| 游戏 | 人数 | 玩法 |
|------|------|------|
| 🕵️ 谁是卧底 | 4–10 | 一人拿相近词，其余拿同一个词；描述 + 投票放逐 |
| 🎨 你画我猜 | 2–8 | 轮流看词作画，其他人文字猜词计分 |
| 🎲 真心话大冒险 | 2–10 | 轮流抽卡、自报结果、全场围观 |

## 快速开始

```bash
# 0. 克隆仓库
git clone https://github.com/susevenci/PartyGame.git
cd PartyGame

# 1. 安装依赖（需要 Node >= 20）
npm install

# 2. 开发模式（server 3000 + client 5173 热更新）
npm run dev
# 手机与电脑同一 WiFi：访问终端打印的 http://<电脑局域网IP>:5173（或 3000）
# 电脑访问 http://localhost:5173

# 3. 生产模式（server 直接托管构建产物，一个地址搞定）
npm run build
npm start
# 手机/电脑统一访问 http://<电脑局域网IP>:3000
```

### 远程连接（不同网络）

任选其一，让朋友拿到一个公网地址即可：

1. **内网穿透（最省事，临时用）**：本机跑 `npm start`，再用
   [ngrok](https://ngrok.com) / [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) /
   [cpolar](https://www.cpolar.com) 等把 3000 端口暴露出去，把公网地址发给朋友。
2. **部署到小 VPS / 云函数**：`npm run build` 后把 `party-games/` 整个目录（含 `node_modules`）
   传到服务器，`npm start` 即可；1 核 1G 的小机器可支撑很多房间。
3. **托管平台**：Vercel/Netlify 只支持前端静态，不适用（本项目需要 WebSocket 服务端）；
   推荐 Render / Railway / 自建。

## 房间规则

- 房主在大厅选游戏 → 创建房间 → 把 6 位房间号发给朋友。
- 朋友在同一个地址输入房间号加入（加入时以房主选的游戏为准）。
- 房主点“开始游戏”；结束后房主可“再来一局”。

## 工程结构

```
packages/shared   协议类型 + 游戏元信息 + 词库（前后端共用的唯一“合同”）
packages/server   纯 Node + ws 服务端：房间系统 + 游戏插件
packages/client   Vite + React 18 + TS 前端
```

**新增一个小游戏只需 4 步**（详见 `CLAUDE.md`）：

1. `shared/src/protocol.ts` 加状态/消息类型；
2. `server/src/games/xxx.ts` 实现 `Game` 接口并在 `games/index.ts` 注册；
3. `shared/src/meta.ts` 加游戏元信息（名称/人数/玩法说明）；
4. `client/src/games/XxxGameView.tsx` 写视图并在 `App.tsx` 挂载。

## 技术选型说明

- **纯 `ws` 而非 socket.io**：消息量极小（文字/回合事件），自定 JSON 协议足够，
  依赖更少、协议更透明，方便后续换传输层。
- **服务端权威状态机**：发词、计时、判定、投票全在服务端，防作弊且断线行为可控。
- **React + 原生 CSS**：聚会场景 UI 以文字/表情/画布为主，不引 UI 组件库，体积最小。

## 已知限制（v1）

- 游戏中断线重连不会补发私密信息（重连后该玩家可能看不到自己的词），v2 优化。
- 谁是卧底的“夜晚击杀”由系统随机执行（卧底不能手动选刀），v2 可开放卧底手动选。
- 无账号体系与房间持久化（进程重启房间即消失），定位为朋友自建临时房。

## 规范

项目规范见 [CLAUDE.md](./CLAUDE.md)（整合自 awesome-cursorrules-zh 的
react-typescript / 通用代码规范 / Node 后端规范 / 实时通信章节 / 约定式提交）。
