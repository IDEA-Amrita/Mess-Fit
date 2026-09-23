"use client";

import { useId } from "react";
import { format, parseISO } from "date-fns";
import { useReducedMotion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface TrendChartProps {
  /** `date` is an ISO day (YYYY-MM-DD). */
  series: { date: string; weight: number }[];
  lo: number;
  hi: number;
}

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

const shortDate = (iso: string) => format(parseISO(iso), "d MMM");

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {format(parseISO(label), "EEE, d MMM yyyy")}
      </p>
      <p className="mt-0.5 text-[15px] font-black tabular-nums text-white">{payload[0].value.toFixed(1)} kg</p>
    </div>
  );
}

export default function TrendChart({ series, lo, hi }: TrendChartProps) {
  // Unique per instance so two charts on one page can't share a gradient id.
  const gradientId = `trend-fill-${useId().replace(/:/g, "")}`;
  const reduceMotion = useReducedMotion();

  const first = series[0];
  const last = series[series.length - 1];
  const summary =
    first && last
      ? `Weight trend from ${first.weight} kg on ${shortDate(first.date)} to ${last.weight} kg on ${shortDate(last.date)}`
      : "Weight trend";

  return (
    <div role="img" aria-label={summary} style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={AXIS_TICK}
            tickFormatter={shortDate}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
            tickMargin={10}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis domain={[lo, hi]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "4 4" }} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="var(--accent)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={!reduceMotion}
            animationDuration={1100}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
