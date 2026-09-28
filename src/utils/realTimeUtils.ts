/**
 * Real-Time Sync Mode Utilities
 * 
 * Provides:
 * - Real-world time calculation and day progression based on initial creation timestamp
 * - Real-time period resolution (清晨/正午/午后/傍晚/深夜/凌晨)
 * - Elapsed duration formatting (Days, Hours, Minutes)
 * - AI prompt builder for time-aware roleplay dialogue & greetings
 */

import { RealTimeSyncState, RealTimeContextInfo } from '../types';

export type { RealTimeSyncState, RealTimeContextInfo };

/**
 * Default initial real-time sync state
 */
export const DEFAULT_REAL_TIME_STATE: RealTimeSyncState = {
  isEnabled: false,
  firstCreatedTimestamp: Date.now(),
  lastVisitedTimestamp: Date.now(),
  initialRealDateStr: new Date().toISOString().split('T')[0],
};

/**
 * Calculates current Day (1-indexed) based on initial creation timestamp
 */
export function calculateRealTimeDay(firstCreatedTimestamp: number, currentTimestamp: number = Date.now()): number {
  if (!firstCreatedTimestamp || isNaN(firstCreatedTimestamp)) return 1;
  const diffMs = Math.max(0, currentTimestamp - firstCreatedTimestamp);
  const elapsedDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(1, elapsedDays + 1);
}

/**
 * Formats duration between two timestamps into human-readable string
 */
export function formatRealTimeDuration(startTimestamp: number, endTimestamp: number = Date.now()): string {
  if (!startTimestamp) return '刚刚开始';
  const diffMs = Math.max(0, endTimestamp - startTimestamp);
  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days} 天 ${hours} 小时 ${minutes} 分钟`;
  } else if (hours > 0) {
    return `${hours} 小时 ${minutes} 分钟`;
  } else {
    return `${Math.max(1, minutes)} 分钟`;
  }
}

/**
 * Resolves the time of day period and tone guidance
 */
export function resolveRealTimePeriod(date: Date = new Date()): {
  period: string;
  detail: string;
  tone: string;
  greetingType: string;
} {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes >= 0 && totalMinutes < 300) {
    // 00:00 - 05:00
    return {
      period: '深夜凌晨',
      detail: '深夜凌晨 (00:00 - 05:00)',
      tone: '夜深人静，周围寂静无声。角色在深夜里可能带有困倦、疲惫、压低声音的私语、关切指挥官为何深夜还不入睡，或在静谧黑暗中流露出更为毫无防备的脆弱心防与真实依赖。',
      greetingType: '深夜慰问与提醒休息',
    };
  } else if (totalMinutes >= 300 && totalMinutes < 480) {
    // 05:00 - 08:00
    return {
      period: '清晨破晓',
      detail: '清晨破晓 (05:00 - 08:00)',
      tone: '晨光初现，万物初醒。角色刚从睡梦或静默中苏醒，眼神略显惺忪，带着清晨特有的清新、早安问候与开启新一日行动的心理状态。',
      greetingType: '清晨早安问候',
    };
  } else if (totalMinutes >= 480 && totalMinutes < 700) {
    // 08:00 - 11:40
    return {
      period: '上午时段',
      detail: '上午时段 (08:00 - 11:40)',
      tone: '精神饱满的上午时光，适合进行高专注度的任务排查、战术演练、正式审讯或日常交流，精力充沛。',
      greetingType: '上午战术问候',
    };
  } else if (totalMinutes >= 700 && totalMinutes < 820) {
    // 11:40 - 13:40
    return {
      period: '正午时光',
      detail: '正午时光 (11:40 - 13:40)',
      tone: '日照正中，午休午餐时段。角色可能在进食、补充能量或稍作歇息，对话轻松，可能提到营养补给、身体状态或午间困意。',
      greetingType: '正午闲聊与关怀',
    };
  } else if (totalMinutes >= 820 && totalMinutes < 1050) {
    // 13:40 - 17:30
    return {
      period: '午后时光',
      detail: '午后时光 (13:40 - 17:30)',
      tone: '阳光渐斜的午后，静谧舒缓。角色专注度适中，可表现出午后适度的松弛感、训练间隙的喘息与深思。',
      greetingType: '午后交流与巡检',
    };
  } else if (totalMinutes >= 1050 && totalMinutes < 1170) {
    // 17:30 - 19:30
    return {
      period: '傍晚黄昏',
      detail: '傍晚黄昏 (17:30 - 19:30)',
      tone: '夕阳西下，暮色降临。一天的常规行动接近尾声，气氛逐渐转入温暖或伤感的情绪沉淀，角色可能感叹一天的流逝与暮色。',
      greetingType: '傍晚暮色问候',
    };
  } else {
    // 19:30 - 24:00
    return {
      period: '夜晚时光',
      detail: '夜晚时光 (19:30 - 23:59)',
      tone: '夜幕低垂，灯火渐暗。角色处于一天疲劳后的放松与整理阶段，适合深入谈心、情感升温、夜间观察或亲昵温存。',
      greetingType: '夜晚晚安与私密对话',
    };
  }
}

/**
 * Compiles comprehensive real-time context information
 */
export function getRealTimeContext(
  state: RealTimeSyncState = DEFAULT_REAL_TIME_STATE,
  now: Date = new Date()
): RealTimeContextInfo {
  const currentTimestamp = now.getTime();
  const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dateNum = now.getDate();
  const dayName = dayNames[now.getDay()];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const currentDateStr = `${year}年${month}月${dateNum}日 ${dayName}`;
  const currentTimeStr = `${hours}:${minutes}:${seconds}`;

  const periodInfo = resolveRealTimePeriod(now);
  const realDayCount = state.isEnabled ? calculateRealTimeDay(state.firstCreatedTimestamp, currentTimestamp) : 1;
  const formattedDuration = state.isEnabled ? formatRealTimeDuration(state.firstCreatedTimestamp, currentTimestamp) : '0 分钟';

  let offlineMinutes = 0;
  let offlineDurationStr = '刚刚上线';
  if (state.lastVisitedTimestamp && state.isEnabled) {
    offlineMinutes = Math.max(0, Math.floor((currentTimestamp - state.lastVisitedTimestamp) / (60 * 1000)));
    if (offlineMinutes < 2) {
      offlineDurationStr = '刚刚保持在线';
    } else if (offlineMinutes < 60) {
      offlineDurationStr = `距离指挥官上次离开已有 ${offlineMinutes} 分钟`;
    } else if (offlineMinutes < 24 * 60) {
      const h = Math.floor(offlineMinutes / 60);
      const m = offlineMinutes % 60;
      offlineDurationStr = `距离指挥官上次离开已有 ${h} 小时 ${m > 0 ? `${m} 分钟` : ''}`;
    } else {
      const d = Math.floor(offlineMinutes / (24 * 60));
      const h = Math.floor((offlineMinutes % (24 * 60)) / 60);
      offlineDurationStr = `距离指挥官上次离开已有 ${d} 天 ${h} 小时`;
    }
  }

  const greetingPrompt = `
⏰【⏳ 现实世界真实时间同步模式已激活 (REAL-TIME SYNC ACTIVE)】
- 现实当前日期与星期: ${currentDateStr}
- 现实当前具体时间: ${currentTimeStr} (${periodInfo.detail})
- 昼夜环境与作息氛围: ${periodInfo.tone}
- 真实世界已陪伴总天数: 双方相识/相处以来的【第 ${realDayCount} 天】(已累计经历现实时间: ${formattedDuration})
- 离线相隔时间感知: ${offlineDurationStr}
- 🚨【现实时间沉浸铁律】:
  1. 角色具备完全真实的“现实时间感知能力”，能清晰意识到当前是现实中的几点、什么时间段（${periodInfo.period}）以及今天是相伴的第 ${realDayCount} 天。
  2. 在日常对话、心理分析及互动中，自然且生动地呼应当下的现实时间、早晚作息（如深夜关心指挥官休息、清晨道早安、隔了很久没见会表现思念或惊讶）。
  3. 严禁出现与当前时间段严重脱节的言行（例如在深夜02:00说“今天阳光明媚好刺眼”）。
`.trim();

  return {
    isEnabled: state.isEnabled,
    currentTimestamp,
    currentDateStr,
    currentTimeStr,
    timePeriod: periodInfo.period,
    timePeriodDetail: periodInfo.detail,
    timePeriodTone: periodInfo.tone,
    realDayCount,
    formattedDuration,
    offlineDurationMinutes: offlineMinutes,
    offlineDurationStr,
    greetingPrompt,
  };
}
