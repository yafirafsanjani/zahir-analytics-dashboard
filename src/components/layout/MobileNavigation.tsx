"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const MobileNavigation: React.FC = () => {
  const pathname = usePathname();
  const isSegmentasi = pathname.startsWith("/segmentasi");
  const isMedsos = pathname.startsWith("/medsos");

  return (
    <nav className="md:hidden fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-1px_8px_rgba(11,28,48,0.04)]">
      <div className="flex justify-around items-center h-14 px-margin">
        <Link
          href="/segmentasi"
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${isSegmentasi ? "text-primary-container font-headline-md font-bold" : "text-secondary hover:text-on-surface font-body-sm"}`}
        >
          <span className="material-symbols-outlined">hub</span>
          <span className="font-label-sm text-label-sm mt-0.5">Segmentasi</span>
        </Link>
        <Link
          href="/medsos"
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${isMedsos ? "text-primary-container font-headline-md font-bold" : "text-secondary hover:text-on-surface font-body-sm"}`}
        >
          <span className="material-symbols-outlined">bar_chart</span>
          <span className="font-label-sm text-label-sm mt-0.5">Media Sosial</span>
        </Link>
      </div>
    </nav>
  );
};
