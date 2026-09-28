import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { ultraAudio } from '../utils/audio';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  heroName: string;
  scenarioName?: string;
  activeTeamNames?: string[];
  onConfirmReset: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  heroName,
  scenarioName,
  activeTeamNames,
  onConfirmReset,
}) => {
  if (!isOpen) return null;

  const isMultiTeam = activeTeamNames && activeTeamNames.length > 1;
  const teamNamesStr = activeTeamNames?.join('、');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="relative w-full max-w-md bg-zinc-950 border border-amber-500/60 rounded-xl shadow-[0_0_35px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col">
        {/* Top Warning Banner */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-950/90 via-red-950/90 to-amber-950/90 border-b border-amber-500/40">
          <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
            <span>高能警报：确定执行一键彻底重置？</span>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-1 rounded text-zinc-400 hover:text-amber-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs text-zinc-300 leading-relaxed">
          <p className="text-zinc-200">
            {isMultiTeam ? (
              <>
                即将对出阵战术小队全员 <strong className="text-amber-300 font-bold">【{teamNamesStr}】</strong> 进行全量战术档案一键彻底重置：
              </>
            ) : (
              <>
                即将对角色 <strong className="text-amber-300 font-bold">【{heroName}】</strong> 进行全量战术档案重置：
              </>
            )}
          </p>

          <div className="bg-zinc-900/90 border border-amber-500/30 rounded-lg p-3 space-y-2 text-[11px]">
            <div className="flex items-center space-x-2 text-amber-400 font-bold">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置项（基于剧情预设【{scenarioName || '默认剧情'}】）：</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>{isMultiTeam ? '小队全员关押天数重置为' : '关押天数重置为'} <strong className="text-amber-300">第 1 天</strong></li>
              <li>{isMultiTeam ? '小队全员各项属性 (HP/能量/信任/意志等) 按照' : '各项属性 (HP/能量/信任/意志等) 按照'} <strong className="text-emerald-400">剧情开局预设</strong> 决定并重置</li>
              <li>羁绊状态自动联动归位至当前剧情开局关联契约</li>
              <li>{isMultiTeam ? '小队全员部位受损与外甲破损度归零' : '全身部位受损与外甲破损度归零'}</li>
              <li>清空历史控制台战报与对话日志，重新载入剧情开局开场白</li>
            </ul>
          </div>

          <p className="text-amber-400/80 text-[11px] font-bold">
            ⚠️ 此操作不可撤销，{isMultiTeam ? '出阵战队全员' : '该战士'}的所有受虐与折磨记录将被重置。
          </p>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 bg-zinc-900 border-t border-zinc-800">
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs font-bold cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onConfirmReset();
              onClose();
            }}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.4)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>确认执行彻底重置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
