/**
 * 编瞎话题库：question 用 ____ 表示留空，answer 是唯一正确答案。
 * 只收录答案明确、不易产生争议的常识题。
 */
export const FIBBAGE_QUESTIONS: { question: string; answer: string }[] = [
  { question: '世界上最大的哺乳动物是____。', answer: '蓝鲸' },
  { question: '人体面积最大的器官是____。', answer: '皮肤' },
  { question: '太阳系中体积最大的行星是____。', answer: '木星' },
  { question: '标准大气压下，水的沸点是____℃。', answer: '100' },
  { question: '一打等于____个。', answer: '12' },
  { question: '光年其实是____的单位。', answer: '长度' },
  { question: '大熊猫的主要食物是____。', answer: '竹子' },
  { question: '章鱼有____颗心脏。', answer: '3' },
  { question: '彩虹通常被分为____种颜色。', answer: '7' },
  { question: '世界上海拔最高的山峰是____。', answer: '珠穆朗玛峰' },
  { question: '夏季奥运会每____年举办一次。', answer: '4' },
  { question: '蝙蝠主要依靠____来定位。', answer: '超声波' },
  { question: '咖啡豆其实是咖啡树的____。', answer: '种子' },
  { question: '现存体型最大的鸟类是____。', answer: '鸵鸟' },
  { question: '中国面积最大的省级行政区是____。', answer: '新疆' },
  { question: '地球上面积最大的海洋是____。', answer: '太平洋' },
  { question: '企鹅全部生活在____半球。', answer: '南' },
  { question: '蜂蜜的主要成分是____。', answer: '糖' },
  { question: '北半球一年中白天最长的节气是____。', answer: '夏至' },
  { question: '足球比赛每队同时上场____人。', answer: '11' },
  { question: '标准围棋棋盘是____路。', answer: '19' },
  { question: '马拉松全程约____公里。', answer: '42' },
  { question: '人类正常体温约为____℃。', answer: '37' },
  { question: '标准钢琴通常有____个琴键。', answer: '88' },
  { question: '一副扑克牌共有____张。', answer: '54' },
  { question: '地球绕太阳公转一圈约需要____天。', answer: '365' },
  { question: '中国农历新年又叫____。', answer: '春节' },
  { question: '世界上面积最大的沙漠是____。', answer: '南极洲' },
  { question: '蜂蜜是蜜蜂采集花蜜后酿成的____。', answer: '食物' },
  { question: '动物界中跑得最快的陆地动物是____。', answer: '猎豹' },
  { question: '成年人全身骨骼共有____块。', answer: '206' },
  { question: '标准吉他通常有____根弦。', answer: '6' },
];

export function pickFibbageQuestion(): { question: string; answer: string } {
  return FIBBAGE_QUESTIONS[Math.floor(Math.random() * FIBBAGE_QUESTIONS.length)]!;
}
