'use client';

interface RadarChartProps {
  data: Array<{ label: string; value: number; max?: number }>;
  size?: number;
}

export function RadarChart({ data, size = 240 }: RadarChartProps) {
  if (!data || data.length < 3) {
    return (
      <div
        className="flex items-center justify-center text-sm text-text-tertiary"
        style={{ width: size, height: size }}
      >
        暂无数据
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const angleStep = (2 * Math.PI) / data.length;
  // Start from top (-90deg)
  const startAngle = -Math.PI / 2;

  // Concentric grid rings (4 levels)
  const levels = [0.25, 0.5, 0.75, 1];

  const pointAt = (index: number, ratio: number) => {
    const angle = startAngle + index * angleStep;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  };

  // Axis lines + outer polygon
  const axisLines = data.map((_, i) => {
    const p = pointAt(i, 1);
    return { x1: cx, y1: cy, x2: p.x, y2: p.y };
  });

  const gridPolygons = levels.map((level) => {
    const pts = data.map((_, i) => {
      const p = pointAt(i, level);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    });
    return pts.join(' ');
  });

  // Data polygon
  const dataPoints = data.map((d, i) => {
    const max = d.max ?? 25;
    const ratio = Math.max(0, Math.min(1, d.value / max));
    return pointAt(i, ratio);
  });

  const dataPolygon = dataPoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="雷达图">
      {/* Grid polygons */}
      {gridPolygons.map((pts, i) => (
        <polygon
          key={`grid-${levels[i]}`}
          points={pts}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
          opacity={0.6}
        />
      ))}

      {/* Axis lines */}
      {axisLines.map((line, i) => (
        <line
          key={`axis-${data[i].label}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="var(--border)"
          strokeWidth={1}
          opacity={0.6}
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={dataPolygon}
        fill="var(--accent)"
        fillOpacity={0.18}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data points + labels */}
      {dataPoints.map((p, i) => (
        <circle key={`dp-${data[i].label}`} cx={p.x} cy={p.y} r={3} fill="var(--accent)">
          <title>{`${data[i].label}: ${data[i].value.toFixed(1)}`}</title>
        </circle>
      ))}

      {/* Axis labels */}
      {data.map((d, i) => {
        const p = pointAt(i, 1.18);
        return (
          <text
            key={`label-${d.label}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--text-secondary)"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
