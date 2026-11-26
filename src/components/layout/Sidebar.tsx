"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

let cachedUserEmail: string | null = null;

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>(cachedUserEmail || "analyst@zahir.co.id");

  useEffect(() => {
    if (cachedUserEmail) {
      setUserEmail(cachedUserEmail);
      return;
    }
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) {
          cachedUserEmail = data.user.email;
          setUserEmail(data.user.email);
        }
      } catch {
        // keep default
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore
    } finally {
      cachedUserEmail = null;
      router.push("/login");
      router.refresh();
    }
  };

  const isSegmentasi = pathname.startsWith("/segmentasi");
  const isMedsos = pathname.startsWith("/medsos");
  const currentTab = (searchParams?.get("tab") || "").toLowerCase().trim();

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-on-secondary-fixed text-on-secondary z-50 hidden md:flex flex-col justify-between select-none">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-14 px-space-lg flex items-center gap-space-sm bg-on-secondary-fixed border-b border-on-secondary-fixed-variant/20">
          <div className="w-6 h-6 rounded bg-primary-container flex items-center justify-center font-headline-md font-bold text-on-primary text-[14px]">
            Z
          </div>
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md font-bold tracking-tight text-on-secondary">
              Zahir <span className="text-primary-fixed-dim font-normal">Analytics</span>
            </span>
          </div>
        </div>

        {/* Navigation Groups */}
        <div className="px-space-md py-space-sm">
          <nav className="space-y-space-md">
            {/* Segmentasi Pelanggan Group */}
            <div className="space-y-space-xs">
              <div className="px-space-sm py-space-xs flex items-center gap-space-xs text-secondary-fixed-dim font-label-sm text-label-sm uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">group</span>
                <span>Segmentasi Pelanggan</span>
              </div>
              <div className="pl-space-md space-y-space-xs flex flex-col">
                <Link
                  href="/segmentasi?tab=ikhtisar"
                  className={`px-space-sm py-space-xs rounded font-body-sm text-body-sm transition-colors ${
                    isSegmentasi && (!currentTab || currentTab === "ikhtisar")
                      ? "bg-on-secondary-fixed-variant text-on-secondary font-semibold"
                      : "text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant hover:text-on-secondary"
                  }`}
                >
                  Ikhtisar Segmen
                </Link>
                <Link
                  href="/segmentasi?tab=perbandingan"
                  className={`px-space-sm py-space-xs rounded font-body-sm text-body-sm transition-colors ${
                    isSegmentasi && currentTab === "perbandingan"
                      ? "bg-on-secondary-fixed-variant text-on-secondary font-semibold"
                      : "text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant hover:text-on-secondary"
                  }`}
                >
                  Perbandingan Model
                </Link>
                <Link
                  href="/segmentasi?tab=detail"
                  className={`px-space-sm py-space-xs rounded font-body-sm text-body-sm transition-colors ${
                    isSegmentasi && currentTab === "detail"
                      ? "bg-on-secondary-fixed-variant text-on-secondary font-semibold"
                      : "text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant hover:text-on-secondary"
                  }`}
                >
                  Detail Faktur
                </Link>
              </div>
            </div>

            {/* Analisis Media Sosial Group */}
            <div className="space-y-space-xs">
              <div className="px-space-sm py-space-xs flex items-center gap-space-xs text-secondary-fixed-dim font-label-sm text-label-sm uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">share</span>
                <span>Analisis Media Sosial</span>
              </div>
              <div className="pl-space-md space-y-space-xs flex flex-col">
                <Link
                  href="/medsos?tab=playstore"
                  className={`px-space-sm py-space-xs rounded font-body-sm text-body-sm transition-colors ${
                    isMedsos && (!currentTab || currentTab === "playstore")
                      ? "bg-on-secondary-fixed-variant text-on-secondary font-semibold"
                      : "text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant hover:text-on-secondary"
                  }`}
                >
                  Play Store
                </Link>
                <Link
                  href="/medsos?tab=instagram"
                  className={`px-space-sm py-space-xs rounded font-body-sm text-body-sm transition-colors ${
                    isMedsos && currentTab === "instagram"
                      ? "bg-on-secondary-fixed-variant text-on-secondary font-semibold"
                      : "text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant hover:text-on-secondary"
                  }`}
                >
                  Instagram
                </Link>
                <Link
                  href="/medsos?tab=evaluasi"
                  className={`px-space-sm py-space-xs rounded font-body-sm text-body-sm transition-colors ${
                    isMedsos && (currentTab === "evaluasi" || currentTab === "eksplorasi")
                      ? "bg-on-secondary-fixed-variant text-on-secondary font-semibold"
                      : "text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant hover:text-on-secondary"
                  }`}
                >
                  Evaluasi & Eksplorasi
                </Link>
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-space-md bg-on-secondary-fixed">
        <div className="p-space-sm rounded bg-on-secondary-fixed-variant/40 space-y-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-label-sm text-label-sm text-on-secondary truncate">
                {userEmail}
              </span>
              <span className="font-body-sm text-body-sm text-secondary-fixed-dim truncate text-[10px]">
                Zahir Internal
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-space-xs px-space-sm py-space-xs rounded bg-on-secondary-fixed-variant hover:bg-error hover:text-on-error text-secondary-fixed-dim transition-colors font-label-sm text-label-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
