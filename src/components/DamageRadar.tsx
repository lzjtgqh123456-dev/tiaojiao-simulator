import React from 'react';
import { BodyPartId, BodyPartConfig, Ultrawoman, LogEntry } from '../types';
import { DEFAULT_ANATOMY_PARTS } from '../utils/cardUtils';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';

interface DamageRadarProps {
  hero: Ultrawoman;
  partDamage: Record<BodyPartId, number>;
  logs: LogEntry[];
}

const BaseDamageRadar: React.FC<DamageRadarProps> = ({ hero, partDamage, logs }) => {
  // Format Radar Data with safe fallbacks
  const safeBodyParts = hero?.bodyParts || DEFAULT_ANATOMY_PARTS;
  const safePartDamage = partDamage || {};
  const radarData = (Object.entries(safeBodyParts) as [BodyPartId, BodyPartConfig][]).map(([partId, config]) => ({
    subject: (config?.name || partId).split(' ')[0],
    damage: Math.round(safePartDamage[partId as BodyPartId] || 0),
    fullMark: 100,
  }));

  // Format Line Chart Data from recent logs
  const timelineData = (logs || []).slice(-10).map((log, idx) => ({
    step: `#${idx + 1}`,
    damage: log?.damageDealt ?? 0,
    obedience: log?.obedienceGained ?? 0,
  }));

  return (
    <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-3.5 text-zinc-100 flex flex-col space-y-3 shadow-2xl font-mono overflow-hidden min-w-0 max-w-full">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold tracking-widest text-blue-400 uppercase text-glow-blue">
            身体部位损伤分布与信任值变化遥测
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-w-0">
        {/* Radar Chart: Regional Body Damage */}
        <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800 flex flex-col items-center min-w-0 overflow-hidden">
          <h3 className="text-xs font-bold text-zinc-300 mb-2 self-start uppercase">
            部位损伤分布比例 (%)
          </h3>
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="subject" stroke="#a1a1aa" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#3f3f46" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                <Radar
                  name="部位损伤度"
                  dataKey="damage"
                  stroke="#f43f5e"
                  fill="#f43f5e"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart: Conversion & Impact Trend */}
        <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800 flex flex-col items-center">
          <h3 className="text-xs font-bold text-zinc-300 mb-2 self-start flex items-center space-x-1 uppercase">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>信任值与打击效果实时遥测</span>
          </h3>
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <XAxis dataKey="step" stroke="#52525b" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis stroke="#52525b" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#3b82f6',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                <Line
                  type="monotone"
                  dataKey="damage"
                  name="造成伤害"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="obedience"
                  name="信任值增长"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DamageRadar = React.memo(BaseDamageRadar);

