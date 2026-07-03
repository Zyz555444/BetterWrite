'use client';

interface LineChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
}

const PADDING_LEFT = 36;
const PADDING_RIGHT = 12;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 32;
const VIEWBOX_WIDTH = 600;

export function LineChart({ data, height = 200, color = 'currentColor' }: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-copy-14 text-neutral-7"
        style={{ height }}
      >
        暂无数据
      </div>
    );
  }

  const chartWidth = VIEWBOX_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;
  const paddedMax = maxVal + range * 0.1;
  const paddedMin = minVal - range * 0.1;
  const paddedRange = paddedMax - paddedMin || 1;

  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PADDING_LEFT + i * stepX;
    const y = PADDING_TOP + chartHeight - ((d.value - paddedMin) / paddedRange) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(
    PADDING_TOP + chartHeight
  ).toFixed(2)} L ${points[0].x.toFixed(2)} ${(PADDING_TOP + chartHeight).toFixed(2)} Z`;

  // Y axis ticks (4 segments)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = paddedMin + t * paddedRange;
    const y = PADDING_TOP + chartHeight - t * chartHeight;
    return { val, y };
  });

  // X axis labels: avoid overlap when many points
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="折线图"
    >
      {/* Y grid + labels */}
      {yTicks.map((tick) => (
        <g key={`y-${tick.val.toFixed(2)}`}>
          <line
            x1={PADDING_LEFT}
            y1={tick.y}
            x2={VIEWBOX_WIDTH - PADDING_RIGHT}
            y2={tick.y}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
          <text
            x={PADDING_LEFT - 6}
            y={tick.y + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--color-neutral-7)"
          >
            {tick.val.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X axis */}
      <line
        x1={PADDING_LEFT}
        y1={PADDING_TOP + chartHeight}
        x2={VIEWBOX_WIDTH - PADDING_RIGHT}
        y2={PADDING_TOP + chartHeight}
        stroke="var(--color-border)"
        strokeWidth={1}
      />

      {/* Area fill */}
      <path d={areaPath} fill={color} opacity={0.1} />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Points + hover tooltip */}
      {points.map((p, i) => (
        <g key={`pt-${p.label}-${p.value}`}>
          <circle cx={p.x} cy={p.y} r={3} fill={color}>
            <title>{`${p.label}: ${p.value.toFixed(1)}`}</title>
          </circle>
          {i % labelStep === 0 && (
            <text
              x={p.x}
              y={PADDING_TOP + chartHeight + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-neutral-8)"
            >
              {p.label.length > 8 ? `${p.label.slice(0, 7)}…` : p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
