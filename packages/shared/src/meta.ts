import type { GameId, GameMeta } from './protocol';

export const AVATARS = [
  '🐰', '🐱', '🐶', '🦊', '🐼', '🐨',
  '🐸', '🐵', '🦁', '🐯', '🐷', '🐮',
  '🦄', '🐙', '🦉', '🐧', '🦖', '👻',
  '🎩', '🤖', '👽', '🎃', '🍀', '⭐',
] as const;

export const GAME_META: Record<GameId, GameMeta> = {
  werewolf: {
    id: 'werewolf',
    name: '谁是卧底',
    icon: '🕵️',
    tagline: '4-10 人 · 词卡 + 描述 + 投票',
    minPlayers: 4,
    maxPlayers: 10,
    howToPlay: [
      '每人抽到一张词卡，其中一人（卧底）的词与多数人略有不同。',
      '按顺序每人用一句话描述自己的词，不能说出词本身。',
      '描述完毕后投票，票最多者出局：若是卧底，平民胜利；若是平民，继续下一轮。',
      '卧底坚持到最后即卧底胜利。',
    ],
  },
  drawing: {
    id: 'drawing',
    name: '你画我猜',
    icon: '🎨',
    tagline: '2-8 人 · 画布 + 文字猜测',
    minPlayers: 2,
    maxPlayers: 8,
    howToPlay: [
      '每轮一位玩家根据抽到的词语在画布上作画，其他人输入文字猜测。',
      '第一个猜中得 2 分，其余猜中各得 1 分；画家本人看得到答案，也可以放弃换题。',
      '每人画一轮后总分最高者获胜。',
    ],
  },
  'truth-dare': {
    id: 'truth-dare',
    name: '真心话大冒险',
    icon: '🎲',
    tagline: '2-10 人 · 抽卡 + 自报结果',
    minPlayers: 2,
    maxPlayers: 10,
    howToPlay: [
      '按顺序轮流抽卡：选“真心话”或“大冒险”中的一张随机卡。',
      '完成后自己填写结果（或主持人代填），全场围观。',
      '所有人轮完一圈为一轮，可无限加圈，随时结束。',
    ],
  },
};

export const GAME_LIST: GameMeta[] = [
  GAME_META.werewolf,
  GAME_META.drawing,
  GAME_META['truth-dare'],
];
