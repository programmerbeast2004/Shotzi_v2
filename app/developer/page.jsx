"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

export default function DeveloperPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#18181B] selection:bg-[#FFD21E] selection:text-[#18181B] relative overflow-x-hidden font-sans flex flex-col justify-between">
      {/* Subtle Paper Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.035] mix-blend-multiply z-0"
        style={{
          backgroundImage: `radial-gradient(#18181B 1px, transparent 1px)`,
          backgroundSize: "22px 22px",
        }}
        aria-hidden="true"
      />

      {/* Main Studio Spread (Compact, High-Density Editorial Spread) */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10 flex flex-col justify-center">
        {/* The Master Studio Board */}
        <div className="rounded-3xl bg-white/70 backdrop-blur-sm border-2 border-[#18181B] shadow-[6px_6px_0px_#18181B] p-6 sm:p-8 lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: The Narrative & Identity */}
            <div className="lg:col-span-6 space-y-5">
              {/* Title & Philosophy */}
              <div className="space-y-2.5">
                <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[4.75rem] xl:text-[5.5rem] text-[#18181B] tracking-tight leading-[0.98]">
                  <span className="italic font-light text-[#524E48]">Hi,</span> I’m{" "}
                  <span className="relative inline-block whitespace-nowrap">
                    <span className="relative z-10 italic font-normal text-[#18181B]">Apoorv</span>
                    {/* Oversized Organic Shotzi Yellow Highlighter */}
                    <span
                      className="absolute left-0 -bottom-1 sm:-bottom-1.5 w-full h-4 sm:h-5 md:h-6 bg-[#FFD21E] -rotate-1 -z-10 rounded-xs opacity-95"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-[#FFD21E] font-sans text-2xl sm:text-3xl lg:text-4xl ml-2 inline-block select-none" aria-hidden="true">
                    ✦
                  </span>
                </h1>
                <p className="font-mono text-xs sm:text-sm text-[#B45309] uppercase tracking-[0.18em] font-bold pt-1">
                  Builder. Developer. Curious human.
                </p>
              </div>

              {/* Core Philosophy Quote */}
              <blockquote className="font-serif italic text-xl sm:text-2xl text-[#3F3C36] leading-snug border-l-3 border-[#FFD21E] pl-3.5 py-0.5 bg-[#FAF7F0] rounded-r-md">
                “I built Shotzi because the internet could use a little more room for real moments.”
              </blockquote>

              {/* Why Shotzi & Motive Statement */}
              <div className="space-y-2.5 text-sm sm:text-base text-[#524E48] leading-relaxed font-sans">
                <p>
                  Most social spaces are built around speed — scroll, like, repeat.
                  Shotzi started with a different idea: what if sharing a photo could simply be about capturing a moment without the pressure to perform?
                </p>
                <p className="font-medium text-[#18181B]">
                  Not everything needs to be{" "}
                  <span className="relative inline-block px-1.5 bg-[#FFD21E] text-[#18181B] rounded-xs font-bold -rotate-1">
                    content.
                  </span>{" "}
                  Some things are worth keeping because they meant something to you.
                </p>
                <p className="text-xs sm:text-sm text-[#716D64] pt-0.5">
                  Currently exploring the intersection of full-stack development, AI, and products that people actually enjoy using.
                </p>
              </div>

              {/* Portfolio CTA Button */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <a
                  href="https://its-apoorv.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#FFD21E] text-[#18181B] font-mono text-xs sm:text-sm font-bold tracking-wide border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B] hover:shadow-[5px_5px_0px_#18181B] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#18181B] transition-all group"
                >
                  <span>Visit my portfolio</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>

                <span className="text-xs font-mono text-[#716D64]">
                  Shotzi is only one piece of the story ↗
                </span>
              </div>
            </div>

            {/* Right Column: Character & Cat Illustration Only */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="relative w-full max-w-[360px] sm:max-w-[400px] select-none">
                
                {/* Central Desk Card: Character & Sleeping Cat */}
                <div className="relative z-10 p-3 sm:p-4 rounded-2xl bg-[#FAF7F0] border-2 border-[#18181B] shadow-[5px_5px_0px_#18181B] transition-transform duration-300 hover:-translate-y-1">
                  <div className="relative aspect-[1024/873] w-full overflow-hidden flex items-center justify-center">
                    <img
                      src="/footer/apoorv-beanie-cat-transparent.png"
                      alt="Apoorv Mehrotra working at desk with sleeping ginger cat"
                      className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-transform duration-300 hover:scale-[1.015]"
                    />

                    {/* Subtle Sparkle on Hover */}
                    <div
                      className="absolute top-2 right-2 text-[#FFD21E] opacity-80 hover:opacity-100 transition-opacity pointer-events-none"
                      aria-hidden="true"
                    >
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 fill-[#FFD21E] stroke-[#18181B]" />
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t-2 border-dashed border-[#18181B]/15 px-2 text-center">
                    <p className="font-serif italic text-sm sm:text-base md:text-[17px] text-[#18181B] leading-snug sm:leading-relaxed">
                      “Obsessed with the little details that make technology feel warm, personal, and human.”
                    </p>
                  </div>
                </div>

                {/* Handwritten Note */}
                <div
                  className="mt-3 flex items-center justify-center sm:justify-start"
                  aria-hidden="true"
                >
                  <span className="font-serif italic text-xs sm:text-sm text-[#18181B] font-bold bg-[#FFD21E] px-2.5 py-0.5 rounded shadow-[2px_2px_0px_#18181B] border border-[#18181B] -rotate-2 whitespace-nowrap">
                    yes, the cat helped.
                  </span>
                </div>

              </div>
            </div>

          </div>

          {/* Bottom Banner Inside Card: Shotzi Signature & Return */}
          <div className="mt-8 pt-6 border-t border-[#18181B]/15 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 select-none">
              <img
                src="/brand/shotzi-logo-dark.png"
                alt="Shotzi"
                className="h-11 sm:h-14 md:h-16 w-auto object-contain"
              />
              <span className="font-serif italic text-base sm:text-lg md:text-xl text-[#524E48]">
                “A softer internet is possible.”
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-[#716D64]">Thanks for stopping by.</span>
              <Link
                href="/"
                className="font-bold text-[#18181B] hover:text-[#B45309] underline underline-offset-4 decoration-[#FFD21E] decoration-2 transition-colors"
              >
                ← Back to Shotzi
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer
        role="contentinfo"
        className="relative z-10 border-t border-[#EBE6DC] py-4 text-center bg-[#FAF7F0]"
      >
        <p className="font-mono text-[11px] text-[#716D64] tracking-wider">
          © 2026 Shotzi. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
