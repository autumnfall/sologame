import type { Job } from './types';

// ---------- 职业阶梯（覆盖全部六维，终点需全属性 Ⅳ） ----------
export const JOBS: readonly Job[] = [
  { id: 'tryout', name: '桌游试玩员', req: {}, auto: false, rate: 0, desc: '手动玩桌游本身产出微薄收入（每次游玩结算给钱）' },
  { id: 'calc', name: '计分陪练', req: { 演算: 1 }, auto: true, rate: 0.2, desc: '入门岗 · 自动收入 ¥0.2/秒' },
  { id: 'dicehost', name: '骰子活动主持', req: { 应变: 1 }, auto: true, rate: 0.2, desc: '入门岗 · 自动收入 ¥0.2/秒' },
  { id: 'stockboy', name: '库房理货员', req: { 运筹: 1 }, auto: true, rate: 0.2, desc: '入门岗 · 自动收入 ¥0.2/秒' },
  { id: 'teacher', name: '规则讲解员', req: { 沉浸: 2 }, auto: true, rate: 0.5, desc: '自动收入 ¥0.5/秒' },
  { id: 'clerk', name: '桌游店店员', req: { 沉浸: 2, 运筹: 1 }, auto: true, rate: 1.0, desc: '自动收入 ¥1.0/秒' },
  { id: 'streamer', name: '主播带货', req: { 沉浸: 3, 应变: 2 }, auto: true, rate: 2.2, volatile: true, desc: '自动收入 ¥2.2/秒，波动 ±50%，触发直播事件' },
  { id: 'editor', name: '评测编辑', req: { 沉浸: 3, 谋略: 2, 演算: 1 }, auto: true, rate: 3.2, desc: '自动收入 ¥3.2/秒' },
  { id: 'designer', name: '设计师助理', req: { 谋略: 3, 演算: 3, 运筹: 2 }, auto: true, rate: 4.5, desc: '自动收入 ¥4.5/秒' },
  { id: 'master', name: '桌游设计师', req: { 谋略: 4, 演算: 4, 应变: 4, 运筹: 4, 洞察: 4, 沉浸: 4 }, auto: true, rate: 8, desc: '全属性 Ⅳ 方可胜任 · 自动收入 ¥8/秒' },
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
