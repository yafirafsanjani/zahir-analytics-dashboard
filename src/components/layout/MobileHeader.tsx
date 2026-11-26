"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

let cachedUserEmail: string | null = null;

interface MobileHeaderProps {
  title: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ title }) => {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>(cachedUserEmail || "analyst@zahir.co.id");
  const [menuOpen, setMenuOpen] = useState(false);

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
        // ignore
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

  return (
    <header className="md:hidden fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(11,28,48,0.04)]">
      <div className="h-14 px-margin flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-7 h-7 rounded bg-primary-container flex items-center justify-center font-headline-md font-bold text-on-primary text-[13px]">
            Z
          </div>
          <div className="flex flex-col">
            <span className="text-on-secondary-fixed font-headline-md text-label-sm uppercase tracking-wider font-bold">
              Zahir Analytics
            </span>
            <span className="text-secondary font-label-sm text-[11px] leading-tight">
              {title}
            </span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary focus:outline-none"
            aria-label="Menu pengguna"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container p-space-sm z-50">
              <div className="px-space-sm py-space-xs border-b border-surface-container">
                <span className="block font-label-sm text-label-sm text-secondary uppercase">
                  Akun Masuk
                </span>
                <span className="block font-body-sm text-body-sm font-semibold text-on-surface truncate">
                  {userEmail}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full mt-space-xs flex items-center gap-space-xs px-space-sm py-space-xs rounded text-error hover:bg-error-container/20 font-label-md text-label-md transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Keluar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
