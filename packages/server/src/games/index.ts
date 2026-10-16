import type { GameId } from '@party-games/shared';
import type { Game } from './types.ts';
import { WerewolfGame } from './werewolf.ts';
import { DrawingGame } from './drawing.ts';
import { TruthDareGame } from './truth-dare.ts';

export type { Game, GameContext } from './types.ts';

/** 游戏工厂：新增游戏时在此注册 */
const FACTORIES: Record<GameId, () => Game> = {
  werewolf: () => new WerewolfGame(),
  drawing: () => new DrawingGame(),
  'truth-dare': () => new TruthDareGame(),
};

export function createGame(id: GameId): Game {
  const factory = FACTORIES[id];
  if (!factory) throw new Error(`unknown game: ${id}`);
  return factory();
}
