export type Range = '30' | '90' | 'max';

interface RangeSelectorProps {
  range: Range;
  onChange: (range: Range) => void;
}

export default function RangeSelector({ range, onChange }: RangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {(['30', '90', 'max'] as Range[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
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
  );
}
