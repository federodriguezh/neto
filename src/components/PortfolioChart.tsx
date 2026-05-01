import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PortfolioHistory, DisplayCurrency } from '../types';
import { formatCurrency, formatCurrencyCompact } from '../utils/currency';

type Range = '30' | '90' | 'max';

interface PortfolioChartProps {
  history: PortfolioHistory[];
  displayCurrency: DisplayCurrency;
}

export default function PortfolioChart({ history, displayCurrency }: PortfolioChartProps) {
  const [range, setRange] = useState<Range>('30');

  const filtered = useMemo(() => {
    if (range === 'max') return history;
    const days = parseInt(range, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return history.filter((h) => h.date >= cutoffStr);
  }, [history, range]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatTooltip = (value: number) => [formatCurrency(value, displayCurrency), 'Value'];

  const formatYAxis = (v: number) => formatCurrencyCompact(v, displayCurrency);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl bg-slate-800 p-6 text-center text-slate-500">
        No history available yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">Portfolio Value</h3>
        <div className="flex gap-1">
          {(['30', '90', 'max'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
            >
              {r === 'max' ? 'Max' : `${r}D`}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
              }}
              formatter={(value: number) => formatTooltip(value)}
              labelFormatter={(label: string) => formatDate(label)}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
