"use client";

import React, { Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { MobileNavigation } from "./MobileNavigation";

interface AppLayoutProps {
  title: string;
  description: string;
  section: string;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  title, description, section, children }) => {
  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop Sidebar */}
      <Suspense fallback={<div className="hidden md:block w-[240px] bg-on-secondary-fixed fixed h-full" />}>
        <Sidebar />
      </Suspense>

      {/* Desktop Top Header Bar */}
      <header className="fixed top-0 left-[240px] right-0 h-14 bg-surface-container-lowest/90 backdrop-blur-md shadow-[0_1px_8px_rgba(11,28,48,0.04)] z-40 hidden md:flex items-center justify-between px-space-xl">
        <div className="flex items-center gap-space-sm font-body-sm text-body-sm text-secondary">
          <span className="font-label-sm text-label-sm uppercase tracking-wide text-secondary">
            Analytics
          </span>
          <span className="text-secondary/40">/</span>
          <span className="font-medium text-on-surface">{section}</span>
        </div>
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded-full bg-surface-container text-tertiary font-label-sm text-label-sm">
            <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse" />
            <span>Terhubung ke Supabase</span>
          </div>
          <div className="w-px h-4 bg-surface-container-high" />
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </header>

      {/* Mobile Top Header */}
      <MobileHeader title={title} />

      {/* Main Content Area */}
      <div className="md:pl-[240px] pt-14 flex flex-col min-h-screen">
        <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-margin-desktop pb-20 md:pb-8 bg-surface">
          {children}
        </main>
        <MobileNavigation />
      </div>
    </div>
  );
};
