import React, { useState, useEffect } from 'react';
import { Ultrawoman, Stats, BodyPartId, BodyPartConfig, LogEntry, AiConfig, CustomSettings, EnvironmentTheme, RelationshipSlot } from '../types';
import { FileText, X, Download, ShieldAlert, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';
import { ultraAudio } from '../utils/audio';

import { getStatsPayload, sanitizeHeroForAi } from '../utils/stats';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  hero: Ultrawoman;
  stats: Stats;
  partDamage: Record<BodyPartId, number>;
  partExposure?: Record<BodyPartId, number>;
  customSettings?: CustomSettings;
  environmentTheme?: EnvironmentTheme | string;
  customLights?: any;
  logs: LogEntry[];
  aiConfig?: AiConfig;
  dayCount?: number;
  activeRelationship?: RelationshipSlot;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  hero,
  stats,
  partDamage,
  partExposure,
  customSettings,
  environmentTheme,
  customLights,
  logs,
  aiConfig,
  dayCount,
  activeRelationship,
}) => {
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, hero?.id]);

  const maxHp = stats.maxHp || hero?.defaultStats?.maxHp || 100;
  const maxEnergy = stats.maxEnergy || hero?.defaultStats?.maxEnergy || 100;
  const maxMorale = stats.maxMorale || hero?.defaultStats?.maxMorale || 100;
  const maxObedience = stats.maxObedience || hero?.defaultStats?.maxObedience || 100;

  const hpPct = Math.round(Math.max(0, Math.min(100, (stats.hp / maxHp) * 100)));
  const energyPct = Math.round(Math.max(0, Math.min(100, (stats.energy / maxEnergy) * 100)));
  const moralePct = Math.round(Math.max(0, Math.min(100, (stats.morale / maxMorale) * 100)));
  const obediencePct = Math.round(Math.max(0, Math.min(100, (stats.obedience / maxObedience) * 100)));

  const fetchReport = async () => {
    setIsLoading(true);
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hero: sanitizeHeroForAi(hero),
            stats: getStatsPayload(stats, hero),
            partDamage,
            partExposure,
            customSettings,
            environmentTheme,
            customLights,
            logs: logs.slice(-30),
            aiConfig,
            dayCount,
            activeRelationship,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.reportSummary && data.overallAssessment) {
            setReportData(data);
            setIsLoading(false);
            return;
          }
        }
        throw new Error(`HTTP ${res.status} or incomplete report data`);
      } catch (e) {
        lastErr = e;
        if (attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    }

    // Default Fallback output after 5 retries fail
    console.warn('Report API failed after 5 retries, serving default report:', lastErr);
    setReportData({
      reportSummary: `关于${hero?.name || '该角色'}的战术受损与信任值评估`,
      overallAssessment: `目标当前生命值剩余${hpPct}%，能量值${energyPct}%，信任值为${obediencePct}%。整体战术压制与状态监控正常。`,
      vulnerabilities: [
        `受损弱点部位：${(hero?.weakPart && hero?.bodyParts?.[hero.weakPart]?.name) || '能量核心'}`,
        '能量核心持续消耗',
        '精神防线逐步受压',
      ],
      nextStepRecommendation: '建议继续实施连续电击与脑波干预，全面巩固归顺成果。',
    });
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4 font-mono">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl text-zinc-100 p-5 shadow-2xl flex flex-col space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold tracking-widest text-blue-400 uppercase text-glow-blue">
              战术评估报告 // {hero?.name || '该角色'}
            </h2>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading Indicator */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Sparkles className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-xs text-blue-300 uppercase">AI正在生成全盘遥测评估报告...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top Summary Card */}
            <div className="bg-zinc-950 p-3 rounded border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>测试对象：<strong className="text-blue-300">{hero?.name}</strong> ({hero?.title})</span>
                <span>身高/体重：{hero?.height} / {hero?.weight}</span>
              </div>
              <h3 className="text-xs font-bold text-rose-300 uppercase">
                {reportData?.reportSummary || '战术受损与心理状态评估报告'}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {reportData?.overallAssessment}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">生命值</span>
                <span className="text-xs font-bold text-rose-400">{hpPct}%</span>
              </div>
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">能量值</span>
                <span className="text-xs font-bold text-blue-400">{energyPct}%</span>
              </div>
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">精神意志</span>
                <span className="text-xs font-bold text-purple-400">{moralePct}%</span>
              </div>
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">信任值</span>
                <span className="text-xs font-bold text-emerald-400">{obediencePct}%</span>
              </div>
            </div>

            {/* Vulnerabilities Breakdown */}
            <div className="bg-zinc-950 p-3 rounded border border-zinc-800 space-y-1.5">
              <h4 className="text-xs font-bold text-amber-300 flex items-center space-x-1 uppercase">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>识别到的身体与心理防线破绽</span>
              </h4>
              <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                {reportData?.vulnerabilities?.map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Regional Body Damage Table */}
            <div className="bg-zinc-950 p-3 rounded border border-zinc-800 space-y-1.5">
              <h4 className="text-xs font-bold text-blue-300 uppercase">区域解剖部位受损细则</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                {(Object.entries(hero?.bodyParts || {}) as [BodyPartId, BodyPartConfig][]).map(([pId, conf]) => (
                  <div key={pId} className="bg-zinc-900 p-1.5 rounded border border-zinc-800 flex justify-between">
                    <span className="text-zinc-400">{(conf?.name || pId).split(' ')[0]}:</span>
                    <span className="font-bold text-rose-400">{Math.round(partDamage[pId] || 0)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic Advice */}
            <div className="bg-emerald-950/20 p-3 rounded border border-emerald-500/30 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 flex items-center space-x-1 uppercase">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>推荐后续审讯与心理转化策略</span>
              </span>
              <p className="text-zinc-300">
                {reportData?.nextStepRecommendation}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
          <button
            onClick={fetchReport}
            className="px-2.5 py-1 rounded border border-zinc-700 text-xs text-blue-300 hover:bg-zinc-800 uppercase font-bold"
          >
            重新生成评估
          </button>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs uppercase"
          >
            关闭报告
          </button>
        </div>
      </div>
    </div>
  );
};

