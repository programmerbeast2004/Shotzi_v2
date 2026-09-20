"use client";

import { useEffect } from "react";
import Link from "next/link";
import { scrollToCurrentHash } from "../../lib/scrollToSection";
import {
  ArrowLeft, Camera, MessageSquare, Video,
  EyeOff, ShieldCheck, Flame, Sparkles,
} from "lucide-react";

const usps = [
  { icon: <Camera className="w-4 h-4 text-amber-600" />,    title: "Scrapbook Aesthetic",       desc: "Tactile textures, polaroid frames, and tape badges — feels like home, not a corporate grid." },
  { icon: <MessageSquare className="w-4 h-4 text-emerald-600" />, title: "Live Drop-in Rooms",  desc: "Real-time community and private rooms. Invite friends, share shots, chat — all in one place." },
  { icon: <Video className="w-4 h-4 text-purple-600" />,    title: "Fluid Reels & Feeds",       desc: "Vertical video reels and high-res carousels with mood tags and zero engagement-bait." },
  { icon: <EyeOff className="w-4 h-4 text-blue-600" />,     title: "Zero Ads or Tracking",      desc: "No ad pixels, no behavioural profiling. Your data is never sold — period." },
  { icon: <ShieldCheck className="w-4 h-4 text-teal-600" />, title: "You Own Your Content",     desc: "100% creator ownership. Delete any shot or your entire account in one click, anytime." },
  { icon: <Flame className="w-4 h-4 text-rose-600" />,      title: "Chronological & Honest",    desc: "Posts in real order. No pay-to-play boosts or shadow restrictions — just real people." },
];

export default function AboutPage() {
  useEffect(() => {
    scrollToCurrentHash();
    const onHashChange = () => scrollToCurrentHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 sm:px-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-zinc-100 text-xs font-black text-black shadow-[2px_2px_0px_#000] transition-all">
          <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" /> Back to Home
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Link href="/guidelines" className="px-3.5 py-1.5 rounded-full border-2 border-black bg-white hover:bg-[#FFF9E6] text-xs font-black shadow-[2px_2px_0px_#000] transition-all">Guidelines</Link>
          <Link href="/contact" className="px-3.5 py-1.5 rounded-full border-2 border-black bg-[#FFF9E6] hover:bg-[#FED136] text-xs font-black shadow-[2px_2px_0px_#000] transition-all">Contact →</Link>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border-[3px] border-black bg-[#FED136] p-6 sm:p-10 shadow-[6px_6px_0px_#18181B] mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black bg-white text-[11px] font-black tracking-wider uppercase shadow-[1.5px_1.5px_0px_#000] mb-3">
          <Sparkles className="w-3 h-3 text-amber-600" /> Project Story
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-black tracking-tight leading-tight mb-2">About Shotzi</h1>
        <p className="text-sm text-black/90 font-bold leading-relaxed max-w-lg">
          A soft place for loud feelings — an indie scrapbook social platform built to bring genuine human warmth back to the internet.
        </p>
        <div className="absolute right-5 -bottom-6 text-8xl select-none rotate-6 opacity-90 hidden sm:block">🎞️</div>
      </div>

      {/* What & Why — single card, two paragraphs */}
      <div className="rounded-3xl border-2 border-black bg-white p-6 sm:p-8 shadow-[4px_4px_0px_#18181B] mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-lg border border-black bg-[#FFF9E6] flex items-center justify-center text-xs font-black shadow-[1px_1px_0px_#000]">?</span>
          <h2 className="text-xl font-black text-black">What is it & why does it exist?</h2>
        </div>
        <div className="space-y-4 text-sm text-zinc-700 font-medium leading-relaxed">
          <p>
            <strong className="text-black">Shotzi</strong> is an indie visual social platform — part photography scrapbook, part live community hub. Upload quiet afternoon light, film-grain memories, street markets, or goofy pets without the pressure of perfection. Everything from polaroid borders to drop-in live rooms is crafted to feel tactile, cozy, and human.
          </p>
          <blockquote className="border-l-4 border-[#FED136] pl-4 italic text-zinc-600">
            &ldquo;We wanted a corner of the web that feels like sitting on the porch with good coffee and a photo album — no ads, no algorithm hiding your friends, no pressure to be anyone other than who you are.&rdquo;
          </blockquote>
          <p>
            Mainstream platforms turned into high-stakes performance arenas. Shotzi strips that away — chronological feeds, real creator ownership, zero behavioural surveillance.
          </p>
        </div>
      </div>

      {/* USP Grid */}
      <div id="how-it-works" className="rounded-3xl border-2 border-black bg-white p-6 sm:p-8 shadow-[4px_4px_0px_#18181B] mb-6 scroll-mt-24">
        <h2 className="text-xl font-black text-black mb-5">What makes Shotzi different</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {usps.map((u, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-[#FFFBEB] hover:border-[#FED136] transition-colors">
              <div className="w-8 h-8 rounded-lg border border-black/10 bg-white flex items-center justify-center shrink-0 shadow-sm">
                {u.icon}
              </div>
              <div>
                <p className="text-xs font-black text-black mb-0.5">{u.title}</p>
                <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">{u.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Strip */}
      <div className="rounded-3xl border-[3px] border-black bg-[#161616] text-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[5px_5px_0px_#18181B]">
        <div>
          <p className="font-mono text-[11px] text-[#FED136] uppercase font-bold tracking-widest mb-0.5">A softer internet is possible ♡</p>
          <p className="text-base font-black">Come capture the world with us.</p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Link href="/auth?mode=signup" className="px-5 py-2.5 rounded-full border-2 border-white bg-[#FED136] hover:bg-[#ffe169] text-xs font-black text-black shadow-[2px_2px_0px_#FFF] transition-all">
            Join Free →
          </Link>
          <Link href="/contact" className="px-5 py-2.5 rounded-full border-2 border-white bg-transparent hover:bg-white/10 text-xs font-black text-white transition-all">
            Contact
          </Link>
        </div>
      </div>

    </div>
  );
}
