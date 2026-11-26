import React from "react";

interface PanelProps {
  title?: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  caption,
  children,
  className = "",
  action,
}) => {
  return (
    <div
      className={`bg-white border border-[#D5E0F8] rounded-[10px] p-5 shadow-[0_4px_16px_rgba(22,48,91,0.035)] ${className}`}
    >
      {(title || caption || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-[1.05rem] font-bold text-[#0B1C30] tracking-tight">
                {title}
              </h3>
            )}
            {caption && (
              <p className="text-[12px] text-[#586377] mt-0.5 leading-relaxed">
                {caption}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
