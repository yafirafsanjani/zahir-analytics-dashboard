"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Kedua kolom email dan kata sandi wajib diisi.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login belum berhasil. Periksa kredensial atau konfirmasi email.");
        setLoading(false);
        return;
      }

      router.push("/segmentasi");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan atau layanan autentikasi. Silakan coba lagi.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 md:p-margin-desktop bg-surface relative overflow-hidden">
      {/* Ambient architectural focus */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3zl pointer-events-none -z-10" />

    <div className="flex flex-col w-full items-center justify-center py-space-xl relative z-10">
      {/* Main Authentication Container (Elevated Enterprise Card) */}
      <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-xl shadow-xl p-6 sm:p-space-2xl relative overflow-hidden border border-surface-container-high/60">
        {/* Top Accent Bar: Zahir Brand Red */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary-container" />

        {/* Header: Identity & Telemetry */}
        <div className="flex flex-col mb-space-xl">
          <div className="flex items-center justify-between mb-space-lg">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-on-secondary-fixed flex items-center justify-center text-on-secondary shadow-sm">
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  query_stats
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-on-secondary-fixed leading-tight tracking-tight">
                  Zahir Analytics
                </span>
              </div>
            </div>

            {/* Version Badge */}
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-data-mono-sm text-data-mono-sm text-secondary">v2.4-int</span>
            </div>
          </div>

          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-xs">
            Masuk
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Akses dashboard analitik internal Zahir terhubung ke Supabase
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-space-lg p-space-md bg-error-container/40 border border-error/30 rounded-lg flex items-start gap-space-sm text-error">
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
            <span className="font-body-sm text-body-sm leading-snug">{error}</span>
          </div>
        )}
        {/* Authentication Form */}
        <form className="flex flex-col gap-space-lg" onSubmit={handleSubmit}>
          {/* Email Input */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label
                htmlFor="email"
                className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                Email Perusahaan
              </label>
              <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                SSO Aktif
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">
                mail
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@zahir.co.id"
                className="w-full h-11 bg-surface-container-lowest text-on-surface pl-10 pr-3 rounded-lg font-body-md text-body-md shadow-sm border border-secondary/20 outline-none focus:border-primary-container focus:ring-1 focus-ring-primary-container transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                Kata Sandi
              </label>
              <button
                type="button"
                tabIndex={-1}
                className="font-label-md text-label-md text-primary-container hover:text-primary transition-colors cursor-pointer"
                onClick={() => setError("Hubungi administrator Zahir untuk reset kredensial.")}
              >
                Lupa kata sandi?
              </button>
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">
                key
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-11 bg-surface-container-lowest text-on-surface pl-10 pr-11 rounded-lg font-data-mono-md text-data-mono-md tracking-wider shadow-sm border border-secondary/20 outline-none focus:border-primary-container focus:ring-1 focus-ring-primary-container transition-all"
              />
              <button
                type="button"
                aria-label="Tampilkan kata sandi"
                onClick={() => showPassword ? setShowPassword(false) : setShowPassword(true)}
                className="absolute right-3 text-secondary hover:text-on-surface p-1 rounded transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>
          {/* Meta Controls: Remember & Server ID */}
          <div className="flex items-center justify-between pt-space-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-primary-container accent-primary-container cursor-pointer"
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Ingat saya
              </span>
            </label>
            <div className="flex items-center gap-1 font-data-mono-sm text-data-mono-sm text-secondary bg-surface-container px-2 py-0.5 rounded">
              <span className="material-symbols-outlined text-[14px]">dns</span>
              <span>ID-JKT-</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary-container hover:bg-primary active:scale-[0.99] text-on-primary font-headline-md text-headline-md rounded-lg flex items-center justify-center gap-space-sm shadow-md transition-all cursor-pointer mt-space-xs disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[20px]">
                  progress_activity
                </span>
                <span>Memverifikasi SSO...</span>
              </>
            ) : (
              <>
                <span>Masuk</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Internal Workspace Security Ribbon */}
        <div className="mt-space-xl p-space-md bg-surface-container-low rounded-lg flex items-center gap-space-sm text-on-secondary-fixed">
          <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wide truncate">
              Sistem Internal Terotenrikasi
            </span>
            <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
              Koneksi aman terenkripsi • Zahir Internal System
            </span>
          </div>
        </div>
      </div>

      {/* Institutional Footer Links */}
      <div className="w-full max-w-[440px] flex flex-col items-center gap-space-sm mt-space-lg text-center">
        <div className="flex items-center justify-center gap-space-md text-secondary">
          <span className="font-body-sm text-body-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">support_agent</span>
            Panduan IT Support
          </span>
          <span className="text-surface-dim font-body-sm">•</span>
          <span className="font-body-sm text-body-sm">Kebijakan Privasi Data</span>
        </div>
        <div className="font-label-sm text-label-sm text-secondary">
          © 2025 PT Zahir Internasional. Hak Cipta Dilindungi Undang-Undang.
        </div>
      </div>
    </div>
  </main>
  );
}
