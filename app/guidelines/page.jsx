"use client";

import Link from "next/link";
import { ArrowLeft, Heart, Camera, ShieldAlert, EyeOff, MessageSquare, Flag } from "lucide-react";

const rules = [
  {
    icon: <Heart className="w-4 h-4 text-rose-500" />,
    title: "Be Kind & Respectful",
    dos: ["Encourage, compliment, and uplift fellow creators.", "Welcome newcomers warmly into rooms and feeds."],
    donts: ["No harassment, hate speech, slurs, or targeted bullying.", "No dogpiling or malicious name-calling."],
  },
  {
    icon: <Camera className="w-4 h-4 text-amber-600" />,
    title: "Post Authentic Work",
    dos: ["Share photos and reels you took or have rights to.", "Credit collaborators and featured subjects."],
    donts: ["No stealing photography or claiming it as your own.", "No bot uploads, follow-churning, or comment spam."],
  },
  {
    icon: <ShieldAlert className="w-4 h-4 text-red-600" />,
    title: "Keep It Safe",
    dos: ["Keep visuals appropriate for a wide creative audience.", "Report distressing content or users in crisis."],
    donts: ["Zero tolerance for sexual, violent, or self-harm content.", "No illegal activity, doxxing, or gore."],
  },
  {
    icon: <EyeOff className="w-4 h-4 text-blue-600" />,
    title: "Respect Privacy",
    dos: ["Obtain consent when photographing private individuals.", "Respect users who decline room invites."],
    donts: ["No sharing private contact info, addresses, or DMs.", "No stalking or repeated unwanted messages."],
  },
  {
    icon: <MessageSquare className="w-4 h-4 text-emerald-600" />,
    title: "Room Etiquette",
    dos: ["Keep conversations friendly and open.", "Respect the room creator's vibe and moderation."],
    donts: ["No spam flooding or copy-paste trolling.", "No phishing links or unsolicited promotions."],
  },
];

export default function GuidelinesPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 sm:px-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-zinc-100 text-xs font-black text-black shadow-[2px_2px_0px_#000] transition-all">
          <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" /> Back to Home
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Link href="/terms" className="px-3.5 py-1.5 rounded-full border-2 border-black bg-white hover:bg-[#FFF9E6] text-xs font-black shadow-[2px_2px_0px_#000] transition-all">Terms</Link>
          <Link href="/privacy" className="px-3.5 py-1.5 rounded-full border-2 border-black bg-[#FFF9E6] hover:bg-[#FED136] text-xs font-black shadow-[2px_2px_0px_#000] transition-all">Privacy →</Link>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border-[3px] border-black bg-[#FED136] p-6 sm:p-10 shadow-[6px_6px_0px_#18181B] mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black bg-white text-[11px] font-black tracking-wider uppercase shadow-[1.5px_1.5px_0px_#000] mb-3">
          <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> Community Culture
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-black tracking-tight leading-tight mb-2">Community Guidelines</h1>
        <p className="text-sm text-black/90 font-bold leading-relaxed max-w-lg">
          Simple rules to keep Shotzi warm, safe, and genuinely human for everyone. Last updated September 18, 2026.
        </p>
        <div className="absolute right-5 -bottom-5 text-8xl select-none -rotate-6 opacity-90 hidden sm:block">🌱</div>
      </div>

      {/* Core Principle */}
      <div className="p-5 rounded-3xl border-2 border-black bg-[#FDFBF7] shadow-[3px_3px_0px_#000] mb-6">
        <p className="text-sm font-medium text-zinc-700 leading-relaxed">
          <strong className="text-black font-black">Our philosophy:</strong> Shotzi exists so you can post without anxiety — a blurry window, a vibrant market, an intimate poem — without wondering if it fits a sterile grid. To keep this alive, treat every person here with the same warmth you would offer a friend.
        </p>
      </div>

      {/* Rules — compact cards */}
      <div className="space-y-4 mb-6">
        {rules.map((r, i) => (
          <div key={i} className="rounded-2xl border-2 border-black bg-white p-5 shadow-[3px_3px_0px_#18181B]">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg border border-black/10 bg-zinc-50 flex items-center justify-center shadow-sm">{r.icon}</div>
              <h3 className="text-sm font-black text-black">{r.title}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {/* Dos */}
              <div className="space-y-1">
                {r.dos.map((d, j) => (
                  <p key={j} className="flex items-start gap-1.5 text-zinc-700 font-medium">
                    <span className="text-emerald-600 font-black mt-px">✓</span> {d}
                  </p>
                ))}
              </div>
              {/* Don'ts */}
              <div className="space-y-1">
                {r.donts.map((d, j) => (
                  <p key={j} className="flex items-start gap-1.5 text-zinc-700 font-medium">
                    <span className="text-rose-500 font-black mt-px">✕</span> {d}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report strip */}
      <div className="rounded-3xl border-2 border-black bg-white p-5 shadow-[3px_3px_0px_#000] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border-1.5 border-black bg-[#FFF9E6] flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
            <Flag className="w-4 h-4 text-[#B45309]" />
          </div>
          <div>
            <p className="text-xs font-black text-black">See something off?</p>
            <p className="text-[11px] text-zinc-500 font-medium">Tap ••• → Report on any post, or email us directly.</p>
          </div>
        </div>
        <a
          href="mailto:apoorv.mehrotra.work@gmail.com?subject=Community%20Report"
          className="px-4 py-2 rounded-full border-2 border-black bg-[#FED136] hover:bg-[#ffe169] text-xs font-black text-black shadow-[2px_2px_0px_#000] transition-all shrink-0"
        >
          Report →
        </a>
      </div>

    </div>
  );
}
