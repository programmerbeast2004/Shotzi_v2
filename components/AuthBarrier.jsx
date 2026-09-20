"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Lock } from "lucide-react";
import { useAuthDrawer } from "./AuthDrawer";

export default function AuthBarrier({
  title = "Authentication Required",
  subtitle = "Sign in or create a free account to access this section.",
  icon = null,
  badge = "MEMBERS ONLY",
}) {
  const { openAuth } = useAuthDrawer();

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div className="rounded-3xl border-2 border-black bg-white p-7 sm:p-9 shadow-[6px_6px_0px_#18181B] space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-[#FFD21E] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-2xl mx-auto">
          {icon || <Lock className="w-7 h-7 text-black stroke-[2.5]" />}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF7F0] border border-black/20 text-black text-[11px] font-black uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-[#B45309]" />
          <span>{badge}</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="pt-2 space-y-2.5">
          <button
            type="button"
            onClick={() => openAuth("signup")}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#FFD21E] text-black font-black text-sm border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Join Shotzi — Free Forever</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => openAuth("signin")}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-bold text-xs border-2 border-black hover:bg-zinc-50 transition-all"
          >
            <span>Already have an account? Sign in</span>
          </button>

          <div className="pt-1">
            <Link
              href="/"
              className="text-xs font-bold text-zinc-500 hover:text-black underline underline-offset-4"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
