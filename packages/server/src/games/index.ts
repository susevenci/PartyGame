import type { GameId } from '@party-games/shared';
import type { Game } from './types.ts';
import { WerewolfGame } from './werewolf.ts';
import { DrawingGame } from './drawing.ts';
import { TruthDareGame } from './truth-dare.ts';
import { FakeArtistGame } from './fake-artist.ts';
import { JustOneGame } from './just-one.ts';
import { WavelengthGame } from './wavelength.ts';
import { FibbageGame } from './fibbage.ts';
import { SpyfallGame } from './spyfall.ts';
import { BombPartyGame } from './bombparty.ts';
import { CodenamesGame } from './codenames.ts';
import { TelephoneGame } from './telephone.ts';
import { AvalonGame } from './avalon.ts';

export type { Game, GameContext } from './types.ts';

/** 游戏工厂：新增游戏时在此注册 */
const FACTORIES: Record<GameId, () => Game> = {
  werewolf: () => new WerewolfGame(),
  drawing: () => new DrawingGame(),
  'truth-dare': () => new TruthDareGame(),
  'fake-artist': () => new FakeArtistGame(),
  'just-one': () => new JustOneGame(),
  wavelength: () => new WavelengthGame(),
  fibbage: () => new FibbageGame(),
  spyfall: () => new SpyfallGame(),
  bombparty: () => new BombPartyGame(),
  codenames: () => new CodenamesGame(),
  telephone: () => new TelephoneGame(),
  avalon: () => new AvalonGame(),
};

export function createGame(id: GameId): Game {
  const factory = FACTORIES[id];
  if (!factory) throw new Error(`unknown game: ${id}`);
  return factory();
}
