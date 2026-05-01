import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ComparisonPoint } from '../hooks/useSpyComparison';

interface ComparisonChartProps {
  data: ComparisonPoint[];
}

export default function ComparisonChart({ data }: ComparisonChartProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatValue = (v: number) => `${v.toFixed(2)}x`;

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center rounded-xl bg-slate-800 text-slate-500">
        No comparison data available.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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
            tickFormatter={formatValue}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={50}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
            }}
            formatter={(value: number, name: string) => [formatValue(value), name]}
            labelFormatter={(label: string) => formatDate(label)}
          />
          <Legend
            wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="portfolio"
            name="Portfolio"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="spy"
            name="SPY"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
