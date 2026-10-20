/** 间谍游戏地点库：所有人拿到同一个地点，间谍只看到地点列表。 */
export const SPYFALL_LOCATIONS: string[] = [
  '飞机场', '银行', '海滩', '电影院', '医院', '酒店', '军事基地',
  '警察局', '学校', '赌场', '大使馆', '加油站', '海底基地', '图书馆',
  '博物馆', '游乐园', '邮局', '餐厅', '空间站', '潜艇', '超市',
  '剧院', '火车站', '大学', '婚礼现场', '动物园', '体育馆', '电视台',
];

export function pickSpyfallLocation(): string {
  return SPYFALL_LOCATIONS[Math.floor(Math.random() * SPYFALL_LOCATIONS.length)]!;
}
