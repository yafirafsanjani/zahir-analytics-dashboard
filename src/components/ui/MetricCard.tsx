import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  help?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  help,
  className = "",
}) => {
  return (
    <div
      className={`bg-white border border-[#D5E0F8] rounded-[10px] p-5 shadow-[0_4px_20px_rgba(22,48,91,0.04)] hover:shadow-[0_8px_25px_rgba(22,48,91,0.07)] transition-all min-h-[115px] flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#586377] tracking-tight">{label}</p>
        {help && (
          <span
            className="text-[11px] text-[#94A3B8] cursor-help px-1.5 py-0.5 rounded border border-[#E2E8F0]"
            title={help}
          >
            ?
          </span>
        )}
      </div>
      <div className="mt-2">
        <span className="text-[1.75rem] font-extrabold tracking-tight text-[#0B1C30] tabular-nums break-words">
          {value}
        </span>
      </div>
    </div>
  );
};
