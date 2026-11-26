import React from "react";
import { formatNumber } from "@/lib/segmentation/formatters";

interface ProgressItem {
  label: string;
  value: number;
}

interface ProgressListProps {
  rows: ProgressItem[];
  total: number;
  unit?: string;
  colors?: string[];
}

const DEFAULT_PALETTE = ["#D2231C", "#2563EB", "#F59E0B", "#10B981", "#8B5CF6"];

export const ProgressList: React.FC<ProgressListProps> = ({
  rows,
  total,
  unit = "",
  colors = DEFAULT_PALETTE,
}) => {
  return (
    <div className="flex flex-col gap-4 py-1">
      {rows.map((row, idx) => {
        const pct = total > 0 ? (row.value / total) * 100 : 0;
        const color = colors[idx % colors.length];
        return (
          <div key={idx} className="flex flex-col">
            <div className="flex justify-between items-center text-[12px] mb-1.5 gap-2">
              <span className="flex items-center gap-2 max-w-[65%] truncate text-[#1E293B] font-medium">
                <i
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="text-right font-semibold text-[#0B1C30] tabular-nums flex-shrink-0">
                {formatNumber(row.value)} {unit}{" "}
                <small className="text-[#64748B] font-normal">
                  ({pct.toFixed(1).replace(".", ",")}%)
                </small>
              </span>
            </div>
            <div className="w-full bg-[#E7EFFD] h-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, pct))}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
