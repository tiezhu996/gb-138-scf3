// 与前端 src/data/symptoms.js 中已有症状保持一致，服务端据此校验提交是否来自已有症状
const symptoms = [
  { id: 'pain', title: '疼痛缓解' },
  { id: 'breathing', title: '呼吸困难' },
  { id: 'nausea', title: '恶心呕吐' },
  { id: 'fatigue', title: '疲劳乏力' },
  { id: 'constipation', title: '便秘困扰' },
  { id: 'sleep', title: '睡眠障碍' },
];

const symptomMap = new Map(symptoms.map((item) => [item.id, item]));

module.exports = {
  symptoms,
  symptomMap,
  URGENT_SYMPTOM_ID: 'breathing',
  URGENT_SEVERITY: 4,
};
