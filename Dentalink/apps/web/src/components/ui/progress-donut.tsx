import React from "react";
import { cn } from "@/lib/utils/cn";

interface ProgressDonutProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  subLabel?: string;
  className?: string;
  isAlert?: boolean;
}

export function ProgressDonut({
  percentage,
  size = 120,
  strokeWidth = 12,
  color = "text-sky-500",
  trackColor = "text-slate-200",
  label,
  subLabel,
  className,
  isAlert = false
}: ProgressDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safePercentage = Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage)) : 0;
  const offset = circumference - (safePercentage / 100) * circumference;

  const actualColor = isAlert ? "text-amber-500" : color;

  return (
    <div className={cn("relative flex flex-col items-center justify-center shrink-0", className)} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          className={trackColor}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress */}
        <circle
          className={cn("transition-all duration-1000 ease-out", actualColor)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {/* Center content */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        {label ? (
          <span className="text-2xl font-bold text-slate-800">{label}</span>
        ) : (
          <span className="text-2xl font-bold text-slate-800">{Math.round(safePercentage)}%</span>
        )}
        {subLabel && <span className="text-xs text-slate-500 font-medium mt-1 leading-tight">{subLabel}</span>}
      </div>
    </div>
  );
}
