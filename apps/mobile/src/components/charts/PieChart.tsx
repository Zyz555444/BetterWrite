import { Text, View } from 'react-native';
import { Path, Svg, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/dark-mode';

interface PieChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  size?: number;
}

export function PieChart({ data, size = 200 }: PieChartProps) {
  const { colors } = useTheme();
  const total = data.reduce((sum, d) => sum + (d.value > 0 ? d.value : 0), 0);

  if (!data || data.length === 0 || total <= 0) {
    return (
      <View
        style={{ width: '100%', minHeight: size, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ fontSize: 14, color: colors.textTertiary }}>暂无数据</Text>
      </View>
    );
  }

  const defaultColors = [
    colors.accent,
    colors.info,
    colors.success,
    colors.warning,
    colors.error,
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
  ];

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4;

  let cumulativeAngle = -Math.PI / 2;

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

      const sliceColor = d.color ?? defaultColors[i % defaultColors.length];

      const midAngle = (startAngle + endAngle) / 2;
      const labelR = radius * 0.6;
      const labelX = cx + Math.cos(midAngle) * labelR;
      const labelY = cy + Math.sin(midAngle) * labelR;
      const percentage = Math.round((d.value / total) * 100);

      return {
        path,
        color: sliceColor,
        label: d.label,
        value: d.value,
        percentage,
        labelX,
        labelY,
      };
    });

  return (
    <View style={{ flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s) => (
          <Path
            key={`slice-${s.label}`}
            d={s.path}
            fill={s.color}
            stroke={colors.bgElevated}
            strokeWidth={1.5}
          />
        ))}
        {slices.map((s) =>
          s.percentage >= 8 ? (
            <SvgText
              key={`pct-${s.label}`}
              x={s.labelX}
              y={s.labelY}
              textAnchor="middle"
              fontSize={11}
              fill="white"
              fontWeight="600"
            >
              {s.percentage}%
            </SvgText>
          ) : null,
        )}
      </Svg>

      <View style={{ width: '100%', gap: 6 }}>
        {slices.map((s) => (
          <View
            key={`legend-${s.label}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View style={{ width: 12, height: 12, backgroundColor: s.color }} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              {s.value} · {s.percentage}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
