import { Text, View } from 'react-native';
import { G, Line, Rect, Svg, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/dark-mode';

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

export function BarChart({ data, height = 200, color }: BarChartProps) {
  const { colors } = useTheme();
  const barColor = color ?? colors.accent;

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
            {Number.isInteger(tick.val) ? tick.val.toFixed(0) : tick.val.toFixed(1)}
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

      {data.map((d, i) => {
        const slotX = PADDING_LEFT + i * slotWidth;
        const barX = slotX + (slotWidth - barWidth) / 2;
        const barHeight = (d.value / niceMax) * chartHeight;
        const barY = PADDING_TOP + chartHeight - barHeight;
        const labelText = d.label.length > 8 ? `${d.label.slice(0, 7)}…` : d.label;
        return (
          <G key={`bar-${d.label}-${d.value}`}>
            <Rect
              x={barX}
              y={barY}
              width={barWidth}
              height={Math.max(barHeight, 0)}
              fill={barColor}
              opacity={0.85}
              rx={2}
            />
            <SvgText
              x={barX + barWidth / 2}
              y={barY - 4}
              textAnchor="middle"
              fontSize={10}
              fill={colors.textSecondary}
            >
              {Number.isInteger(d.value) ? d.value : d.value.toFixed(1)}
            </SvgText>
            {i % labelStep === 0 && (
              <SvgText
                x={slotX + slotWidth / 2}
                y={PADDING_TOP + chartHeight + 14}
                textAnchor="middle"
                fontSize={10}
                fill={colors.textSecondary}
              >
                {labelText}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}
