import { useState } from "react";

// A dependency-free SVG bar chart with hover tooltips. This project's sandbox
// couldn't install recharts (npm registry access was blocked - see README),
// so this hand-built chart stands in for it. It's a drop-in visual swap if
// recharts becomes available in your environment.
const SignupChart = ({ data }) => {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const width = 600;
  const height = 160;
  const barGap = 4;
  const barWidth = data.length ? width / data.length - barGap : 0;

  if (data.length === 0) {
    return <p className="text-sm text-ink-light/45">No signups in this period.</p>;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full h-40" preserveAspectRatio="none">
        {data.map((d, i) => {
          const barHeight = Math.max(3, (d.count / max) * height);
          const x = i * (barWidth + barGap);
          const y = height - barHeight;
          return (
            <g key={d._id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect
                x={x} y={y} width={barWidth} height={barHeight} rx={3}
                className={hover === i ? "fill-accent-500" : "fill-brand-500"}
                style={{ transition: "fill 0.15s" }}
              />
              <text x={x + barWidth / 2} y={height + 16} textAnchor="middle" fontSize="9" className="fill-ink-light/40 dark:fill-ink-dark/40">
                {d._id.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="absolute top-0 bg-black/80 text-white text-xs rounded-lg px-2 py-1 pointer-events-none" style={{ left: `${(hover / data.length) * 100}%` }}>
          {data[hover]._id}: {data[hover].count} signup{data[hover].count === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
};

export default SignupChart;
