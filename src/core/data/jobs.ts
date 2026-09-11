import type { Job } from './types';

// ---------- 职业阶梯（周期制；六维均衡，每属性一条线，终点全属性 Ⅳ） ----------
// 周期最长 5 分钟（300s）；酬劳按周期时长等比设定，等效速率 0.15/s → 1.67/s。
// 游玩本身产出入门收入，职业从第一个自动岗起步。
export const JOBS: readonly Job[] = [
  { id: 'calc', name: '计分陪练', req: { 演算: 1 }, auto: true, cycleSec: 100, cyclePay: 15, desc: '入门岗 · 每 100 秒 ¥15' },
  { id: 'dicehost', name: '骰子活动主持', req: { 应变: 1 }, auto: true, cycleSec: 100, cyclePay: 15, desc: '入门岗 · 每 100 秒 ¥15' },
  { id: 'stockboy', name: '库房理货员', req: { 运筹: 1 }, auto: true, cycleSec: 100, cyclePay: 15, desc: '入门岗 · 每 100 秒 ¥15' },
  { id: 'puzzlehost', name: '谜题主持', req: { 洞察: 2 }, auto: true, cycleSec: 160, cyclePay: 50, desc: '洞察线 · 每 160 秒 ¥50' },
  { id: 'teacher', name: '规则讲解员', req: { 沉浸: 2 }, auto: true, cycleSec: 160, cyclePay: 50, desc: '沉浸线 · 每 160 秒 ¥50' },
  { id: 'writer', name: '攻略作者', req: { 谋略: 2 }, auto: true, cycleSec: 160, cyclePay: 60, desc: '谋略线 · 每 160 秒 ¥60' },
  { id: 'analyst', name: '数据分析师', req: { 演算: 2, 运筹: 1 }, auto: true, cycleSec: 200, cyclePay: 90, desc: '演算线 · 每 200 秒 ¥90' },
  { id: 'streamer', name: '主播带货', req: { 沉浸: 3, 应变: 2 }, auto: true, cycleSec: 200, cyclePay: 100, volatile: true, desc: '每 200 秒结算一次，酬劳在（沉浸下限~1.5）间波动，触发直播事件' },
  { id: 'scenarist', name: '推理剧本策划', req: { 洞察: 3, 演算: 1 }, auto: true, cycleSec: 240, cyclePay: 140, desc: '洞察线 · 每 240 秒 ¥140' },
  { id: 'consultant', name: '桌游顾问', req: { 谋略: 3, 演算: 2 }, auto: true, cycleSec: 240, cyclePay: 165, desc: '谋略线 · 每 240 秒 ¥165' },
  { id: 'master', name: '桌游设计师', req: { 谋略: 4, 演算: 4, 应变: 4, 运筹: 4, 洞察: 4, 沉浸: 4 }, auto: true, cycleSec: 300, cyclePay: 500, desc: '全属性 Ⅳ 方可胜任 · 每 300 秒 ¥500' },
];

const JOB_MAP = new Map(JOBS.map(j => [j.id, j]));

export function jobById(id: string): Job | undefined {
  return JOB_MAP.get(id);
}

export const STREAM_EVENTS: readonly string[] = [
  '观众刷了一波「买买买」！带货效果拔群',
  '直播间翻车：规则讲错被弹幕纠正',
  '金主爸爸送来火箭，本场收入暴涨',
  '连麦嘉宾迟到，干聊了十分钟',
  '某款桌游突然爆单，佣金翻倍',
  '网络卡顿掉线五分钟，心态小崩',
];
