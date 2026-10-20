import WebSocket from 'ws';
import { URL, connect, finish, joinGame, send, waitFor } from './lib.mjs';

const { clients, code } = await joinGame('werewolf', ['Host', 'Guest']);
const [host, guest] = clients;
console.log('房号:', code);

// 1. 非房主不能开始游戏
send(guest, { type: 'start-game' });
await waitFor(() => Boolean(guest.error));
console.log('非房主开始提示:', guest.error);

// 2. 一人退出不应销毁房间，只移除自己的座位
send(guest, { type: 'leave' });
const guestLeft = await waitFor(() => host.room?.players?.length === 1);
console.log('一人退出后人数:', host.room?.players?.length);

// 3. 同名玩家可以重新加入（座位已释放）
const guest2 = await connect('Guest', code);
const rejoined = await waitFor(() => host.room?.players?.length === 2);
console.log('同名重进:', guest2.joined, '人数:', host.room?.players?.length);

// 4. 房主退出后转让给下一位在线玩家
send(host, { type: 'leave' });
const transferred = await waitFor(
  () => guest2.room?.players?.length === 1 && guest2.room?.players?.[0]?.isHost === true,
);
console.log('房主转让:', transferred, '新房主:', guest2.room?.players?.[0]?.name);

// 5. 最后一人退出后房间销毁，旧房号不可再加入
send(guest2, { type: 'leave' });
const probe = await connect('Probe', code);
const destroyed = await waitFor(() => Boolean(probe.error), 3000);
console.log('空房回收:', destroyed, probe.error);

// 6. 缺字段 / 非对象报文不再让进程崩溃
const raw = new WebSocket(URL);
await new Promise((resolve, reject) => {
  raw.on('open', resolve);
  raw.on('error', reject);
});
raw.send(JSON.stringify({ type: 'join', name: 'NoCode' }));
raw.send('null');
await waitFor(() => false, 300);
raw.close();

const alive = await connect('Alive', '', 'werewolf');
console.log('异常报文后仍可建房:', alive.joined, alive.room?.code);

const ok =
  Boolean(guest.error) &&
  guestLeft &&
  rejoined &&
  guest2.joined &&
  transferred &&
  destroyed &&
  alive.joined;
finish([...clients, guest2, probe, alive], ok, ok ? '房间生命周期与异常报文处理正常' : '房间生命周期异常');
