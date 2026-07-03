'use client';

interface PieChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  size?: number;
}

const DEFAULT_COLORS = [
  'var(--accent)',
  'var(--info)',
  'var(--success)',
  'var(--warning)',
  'var(--error)',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

export function PieChart({ data, size = 200 }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + (d.value > 0 ? d.value : 0), 0);

  if (!data || data.length === 0 || total <= 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-text-tertiary"
        style={{ width: '100%', minHeight: size }}
      >
        暂无数据
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4;

  let cumulativeAngle = -Math.PI / 2; // start from top

  const slices = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      const x1 = cx + Math.cos(startAngle) * radius;
      const y1 = cy + Math.sin(startAngle) * radius;
      const x2 = cx + Math.cos(endAngle) * radius;
      const y2 = cy + Math.sin(endAngle) * radius;

      const largeArc = angle > Math.PI ? 1 : 0;

      const path = [
        `M ${cx} ${cy}`,
        `L ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        'Z',
      ].join(' ');

      const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];

      // Mid-angle for label positioning
      const midAngle = (startAngle + endAngle) / 2;
      const labelR = radius * 0.6;
      const labelX = cx + Math.cos(midAngle) * labelR;
      const labelY = cy + Math.sin(midAngle) * labelR;
      const percentage = Math.round((d.value / total) * 100);

      return {
        path,
        color,
        label: d.label,
        value: d.value,
        percentage,
        labelX,
        labelY,
      };
    });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label="饼图"
        className="shrink-0"
      >
        {slices.map((s) => (
          <g key={`slice-${s.label}`}>
            <path d={s.path} fill={s.color} stroke="var(--bg-elevated)" strokeWidth={1.5}>
              <title>{`${s.label}: ${s.value} (${s.percentage}%)`}</title>
            </path>
            {s.percentage >= 8 && (
              <text
                x={s.labelX}
                y={s.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill="white"
                fontWeight={600}
              >
                {s.percentage}%
              </text>
            )}
          </g>
        ))}
      </svg>

      <ul className="flex flex-col gap-1.5 text-sm min-w-0 flex-1">
        {slices.map((s) => (
          <li key={`legend-${s.label}`} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-text-primary truncate flex-1">{s.label}</span>
            <span className="text-text-secondary tabular-nums">
              {s.value} · {s.percentage}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
