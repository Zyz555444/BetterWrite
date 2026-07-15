'use client';

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
}

const PADDING_LEFT = 36;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 36;
const VIEWBOX_WIDTH = 600;

export function BarChart({ data, height = 200, color = 'currentColor' }: BarChartProps) {
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
  const niceMax = maxVal === 0 ? 1 : maxVal * 1.15;

  const barCount = data.length;
  const slotWidth = chartWidth / barCount;
  const barWidth = Math.min(slotWidth * 0.6, 40);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = t * niceMax;
    const y = PADDING_TOP + chartHeight - t * chartHeight;
    return { val, y };
  });

  const labelStep = Math.max(1, Math.ceil(barCount / 8));

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="柱状图"
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
            {Number.isInteger(tick.val) ? tick.val.toFixed(0) : tick.val.toFixed(1)}
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

      {/* Bars + labels */}
      {data.map((d, i) => {
        const slotX = PADDING_LEFT + i * slotWidth;
        const barX = slotX + (slotWidth - barWidth) / 2;
        const barHeight = (d.value / niceMax) * chartHeight;
        const barY = PADDING_TOP + chartHeight - barHeight;
        const labelText = d.label.length > 8 ? `${d.label.slice(0, 7)}…` : d.label;
        return (
          <g key={`bar-${d.label}-${d.value}`}>
            <rect
              x={barX}
              y={barY}
              width={barWidth}
              height={Math.max(barHeight, 0)}
              fill={color}
              opacity={0.85}
              rx={2}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text
              x={barX + barWidth / 2}
              y={barY - 4}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-neutral-8)"
            >
              {Number.isInteger(d.value) ? d.value : d.value.toFixed(1)}
            </text>
            {i % labelStep === 0 && (
              <text
                x={slotX + slotWidth / 2}
                y={PADDING_TOP + chartHeight + 14}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-neutral-8)"
              >
                {labelText}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
