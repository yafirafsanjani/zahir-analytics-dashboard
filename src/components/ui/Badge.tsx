import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  className = "",
}) => {
  let style = "bg-[#EFF4FF] border-[#D5E0F8] text-[#475569]";
  if (variant === "success") {
    style = "bg-[#F3FFF5] border-[#BCE8C3] text-[#00622A]";
  } else if (variant === "danger") {
    style = "bg-[#FEF2F2] border-[#FCA5A5] text-[#D2231C]";
  } else if (variant === "warning") {
    style = "bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]";
  }

  return (
    <span
      className={`inline-block border rounded-[4px] px-2 py-0.5 text-[11px] font-medium tracking-tight ${style} ${className}`}
    >
      {children}
    </span>
  );
};
