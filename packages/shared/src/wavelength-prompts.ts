/** 波长光谱题库：两端是相反的描述，目标值随机落在 0~100。 */
export const WAVELENGTH_PROMPTS: { left: string; right: string }[] = [
  { left: '难吃', right: '好吃' },
  { left: '便宜', right: '昂贵' },
  { left: '无聊', right: '有趣' },
  { left: '冷门', right: '热门' },
  { left: '土味', right: '高级' },
  { left: '安静', right: '吵闹' },
  { left: '简单', right: '复杂' },
  { left: '传统', right: '前卫' },
  { left: '小众', right: '大众' },
  { left: '温柔', right: '凶猛' },
  { left: '干净', right: '邋遢' },
  { left: '慢', right: '快' },
  { left: '危险', right: '安全' },
  { left: '幼稚', right: '成熟' },
  { left: '实用', right: '花哨' },
  { left: '浪漫', right: '现实' },
  { left: '可爱', right: '可怕' },
  { left: '健康', right: '罪恶' },
  { left: '夏天', right: '冬天' },
  { left: '上班', right: '放假' },
  { left: '猫派', right: '狗派' },
  { left: '甜', right: '咸' },
  { left: '宅', right: '浪' },
  { left: '理性', right: '感性' },
  { left: '复古', right: '未来' },
  { left: '拥挤', right: '空旷' },
  { left: '正式', right: '随意' },
  { left: '有名', right: '无名' },
  { left: '毫无意义', right: '意义重大' },
  { left: '想独处', right: '想聚会' },
];

export function pickWavelengthPrompt(): { left: string; right: string } {
  return WAVELENGTH_PROMPTS[Math.floor(Math.random() * WAVELENGTH_PROMPTS.length)]!;
}
