import { useMemo, useState } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  badge?: string;
}

interface ModernDonutChartProps {
  data: DonutSegment[];
  centerLabel?: string;
  unit?: string;
  className?: string;
}

export function ModernDonutChart({
  data,
  centerLabel = 'Total',
  unit = '',
  className = '',
}: ModernDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  const segmentsWithAngles = useMemo(() => {
    if (total === 0) return [];
    let accumulated = 0;
    return data.map((item, idx) => {
      const percentage = (item.value / total) * 100;
      const startAngle = (accumulated / total) * 2 * Math.PI - Math.PI / 2;
      accumulated += item.value;
      const endAngle = (accumulated / total) * 2 * Math.PI - Math.PI / 2;
      return {
        ...item,
        index: idx,
        percentage: Number(percentage.toFixed(1)),
        startAngle,
        endAngle,
      };
    });
  }, [data, total]);

  // Center coordinates & radii
  const cx = 110;
  const cy = 110;
  const outerRadius = 82;
  const innerRadius = 56;

  function describeArc(
    startAngle: number,
    endAngle: number,
    isHovered: boolean,
  ) {
    const currentOuterR = isHovered ? outerRadius + 4 : outerRadius;
    const currentInnerR = isHovered ? innerRadius - 2 : innerRadius;

    // Guard against 360 full circle numerical precision
    const angleDiff = endAngle - startAngle;
    const isFullCircle = angleDiff >= 2 * Math.PI - 0.001;
    const safeEndAngle = isFullCircle ? startAngle + 2 * Math.PI - 0.0001 : endAngle;

    const x1 = cx + currentInnerR * Math.cos(startAngle);
    const y1 = cy + currentInnerR * Math.sin(startAngle);
    const x2 = cx + currentOuterR * Math.cos(startAngle);
    const y2 = cy + currentOuterR * Math.sin(startAngle);
    const x3 = cx + currentOuterR * Math.cos(safeEndAngle);
    const y3 = cy + currentOuterR * Math.sin(safeEndAngle);
    const x4 = cx + currentInnerR * Math.cos(safeEndAngle);
    const y4 = cy + currentInnerR * Math.sin(safeEndAngle);

    const largeArcFlag = angleDiff > Math.PI ? 1 : 0;

    return [
      `M ${x1} ${y1}`,
      `L ${x2} ${y2}`,
      `A ${currentOuterR} ${currentOuterR} 0 ${largeArcFlag} 1 ${x3} ${y3}`,
      `L ${x4} ${y4}`,
      `A ${currentInnerR} ${currentInnerR} 0 ${largeArcFlag} 0 ${x1} ${y1}`,
      'Z',
    ].join(' ');
  }

  const activeSegment = hoveredIndex !== null ? data[hoveredIndex] : null;
  const activePercentage =
    hoveredIndex !== null && total > 0
      ? ((data[hoveredIndex].value / total) * 100).toFixed(1)
      : null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-6 ${className}`}>
      {/* SVG Donut Visual */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          viewBox="0 0 220 220"
          className="w-48 h-48 sm:w-52 sm:h-52 drop-shadow-xs overflow-visible"
        >
          {/* Background guide ring */}
          <circle
            cx={cx}
            cy={cy}
            r={(outerRadius + innerRadius) / 2}
            stroke="#f1f5f9"
            strokeWidth={outerRadius - innerRadius}
            fill="none"
          />

          {/* Slices */}
          {segmentsWithAngles.map((seg) => {
            const isHovered = hoveredIndex === seg.index;
            const isAnyHovered = hoveredIndex !== null;
            const opacity = isHovered ? 1 : isAnyHovered ? 0.45 : 0.95;

            return (
              <path
                key={seg.label}
                d={describeArc(seg.startAngle, seg.endAngle, isHovered)}
                fill={seg.color}
                stroke="#ffffff"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200 ease-out"
                style={{
                  opacity,
                  filter: isHovered ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))' : 'none',
                }}
                onMouseEnter={() => setHoveredIndex(seg.index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Central HUD Metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
            {activeSegment
              ? activeSegment.value.toLocaleString()
              : total.toLocaleString()}
            {unit ? <span className="text-xs font-semibold text-slate-500 ml-0.5">{unit}</span> : ''}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1 max-w-[100px] truncate">
            {activeSegment
              ? `${activePercentage}% ${activeSegment.label}`
              : centerLabel}
          </span>
        </div>
      </div>

      {/* Modern Polish Legend */}
      <div className="flex-1 w-full space-y-2">
        {data.map((item, idx) => {
          const isHovered = hoveredIndex === idx;
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';

          return (
            <div
              key={item.label}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                isHovered
                  ? 'bg-slate-50/90 border-slate-300 shadow-xs translate-x-0.5'
                  : 'bg-white border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {item.badge}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold font-mono text-slate-900">
                  {item.value.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
