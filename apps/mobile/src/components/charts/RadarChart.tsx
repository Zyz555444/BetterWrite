import { Text, View } from 'react-native';
import { Circle, Line, Polygon, Svg, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/dark-mode';

interface RadarChartProps {
  data: Array<{ label: string; value: number; max?: number }>;
  size?: number;
}

export function RadarChart({ data, size = 240 }: RadarChartProps) {
  const { colors } = useTheme();

  if (!data || data.length < 3) {
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: colors.textTertiary }}>暂无数据</Text>
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const angleStep = (2 * Math.PI) / data.length;
  const startAngle = -Math.PI / 2;

  const levels = [0.25, 0.5, 0.75, 1];

  const pointAt = (index: number, ratio: number) => {
    const angle = startAngle + index * angleStep;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  };

  const axisLines = data.map((_, i) => {
    const p = pointAt(i, 1);
    return { x1: cx, y1: cy, x2: p.x, y2: p.y };
  });

  const gridPolygons = levels.map((level) => {
    const pts = data
      .map((_, i) => {
        const p = pointAt(i, level);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(' ');
    return pts;
  });

  const dataPoints = data.map((d, i) => {
    const max = d.max ?? 25;
    const ratio = Math.max(0, Math.min(1, d.value / max));
    return pointAt(i, ratio);
  });

  const dataPolygon = dataPoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  return (
    <Svg width={size} height={size} viewBox={`-24 -24 ${size + 48} ${size + 48}`}>
      {gridPolygons.map((pts, i) => (
        <Polygon
          key={`grid-${levels[i]}`}
          points={pts}
          fill="none"
          stroke={colors.border}
          strokeWidth={1}
          opacity={0.6}
        />
      ))}

      {axisLines.map((line, i) => (
        <Line
          key={`axis-${data[i].label}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={colors.border}
          strokeWidth={1}
          opacity={0.6}
        />
      ))}

      <Polygon
        points={dataPolygon}
        fill={colors.accent}
        fillOpacity={0.18}
        stroke={colors.accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {dataPoints.map((p, i) => (
        <Circle key={`dp-${data[i].label}`} cx={p.x} cy={p.y} r={3} fill={colors.accent} />
      ))}

      {data.map((d, i) => {
        const p = pointAt(i, 1.18);
        return (
          <SvgText
            key={`label-${d.label}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            fontSize={11}
            fill={colors.textSecondary}
          >
            {d.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
