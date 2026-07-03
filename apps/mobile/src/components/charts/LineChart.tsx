import { Text, View } from 'react-native';
import { Circle, G, Line, Path, Svg, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/dark-mode';

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

export function LineChart({ data, height = 200, color }: LineChartProps) {
  const { colors } = useTheme();
  const lineColor = color ?? colors.accent;

  if (!data || data.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: colors.textTertiary }}>暂无数据</Text>
      </View>
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

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = paddedMin + t * paddedRange;
    const y = PADDING_TOP + chartHeight - t * chartHeight;
    return { val, y };
  });

  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      preserveAspectRatio="none"
    >
      {yTicks.map((tick) => (
        <G key={`y-${tick.val.toFixed(2)}`}>
          <Line
            x1={PADDING_LEFT}
            y1={tick.y}
            x2={VIEWBOX_WIDTH - PADDING_RIGHT}
            y2={tick.y}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
          <SvgText
            x={PADDING_LEFT - 6}
            y={tick.y + 3}
            textAnchor="end"
            fontSize={10}
            fill={colors.textTertiary}
          >
            {tick.val.toFixed(1)}
          </SvgText>
        </G>
      ))}

      <Line
        x1={PADDING_LEFT}
        y1={PADDING_TOP + chartHeight}
        x2={VIEWBOX_WIDTH - PADDING_RIGHT}
        y2={PADDING_TOP + chartHeight}
        stroke={colors.border}
        strokeWidth={1}
      />

      <Path d={areaPath} fill={lineColor} opacity={0.1} />

      <Path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((p, i) => (
        <G key={`pt-${p.label}-${p.value}`}>
          <Circle cx={p.x} cy={p.y} r={3} fill={lineColor} />
          {i % labelStep === 0 && (
            <SvgText
              x={p.x}
              y={PADDING_TOP + chartHeight + 14}
              textAnchor="middle"
              fontSize={10}
              fill={colors.textSecondary}
            >
              {p.label.length > 8 ? `${p.label.slice(0, 7)}…` : p.label}
            </SvgText>
          )}
        </G>
      ))}
    </Svg>
  );
}
