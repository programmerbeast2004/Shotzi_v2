"use client";

import Link from "next/link";
import { ArrowLeft, Shield, Database, Eye, Lock, UserCheck, KeyRound, Mail } from "lucide-react";

const highlights = [
  { emoji: "✕", label: "No data selling" },
  { emoji: "🔒", label: "Encrypted & secured" },
  { emoji: "🚫", label: "No ad tracking" },
  { emoji: "🗑️", label: "Delete anytime" },
];

const sections = [
  {
    icon: <Shield className="w-4 h-4 text-emerald-600" />,
    title: "Our Philosophy",
    body: "Shotzi is proudly independent. We do not sell your personal data to advertisers, brokers, or any third party. No cross-site tracking pixels, no behavioural profiling, no rage-bait algorithms — ever.",
  },
  {
    icon: <Database className="w-4 h-4 text-blue-600" />,
    title: "What We Collect",
    body: "Only what's necessary: your username, email, bio, avatar, uploaded photos/reels/captions, interactions (likes, comments, follows, chat messages), and basic technical data (device type, IP for rate-limiting).",
  },
  {
    icon: <Eye className="w-4 h-4 text-amber-600" />,
    title: "How We Use It",
    body: "Solely to render your profile and feeds, power real-time chat rooms, send account security alerts, and detect spam or abuse. Nothing more.",
  },
  {
    icon: <Lock className="w-4 h-4 text-purple-600" />,
    title: "Storage & Security",
    body: "Data stored via Supabase + PostgreSQL with TLS/HTTPS encryption throughout. Passwords are cryptographically salted and hashed — never stored as plain text. Row Level Security policies restrict all access at the database layer.",
  },
  {
    icon: <UserCheck className="w-4 h-4 text-teal-600" />,
    title: "Your Rights",
    body: "Edit or delete any shot instantly. Permanently delete your full account (photos, comments, likes) from Profile Settings — wiped from live databases immediately. Request a data export by emailing us.",
  },
  {
    icon: <KeyRound className="w-4 h-4 text-amber-600" />,
    title: "Cookies",
    body: "Strictly necessary cookies only: keeping you signed in and remembering your UI preferences. No advertising cookies, cross-site trackers, or marketing pixels — zero.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 sm:px-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-zinc-100 text-xs font-black text-black shadow-[2px_2px_0px_#000] transition-all">
          <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" /> Back to Home
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Link href="/guidelines" className="px-3.5 py-1.5 rounded-full border-2 border-black bg-white hover:bg-[#FFF9E6] text-xs font-black shadow-[2px_2px_0px_#000] transition-all">Guidelines</Link>
          <Link href="/terms" className="px-3.5 py-1.5 rounded-full border-2 border-black bg-[#FFF9E6] hover:bg-[#FED136] text-xs font-black shadow-[2px_2px_0px_#000] transition-all">Terms →</Link>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border-[3px] border-black bg-[#FFF9E6] p-6 sm:p-10 shadow-[6px_6px_0px_#18181B] mb-6">
        <span className="inline-block px-3 py-1 rounded-full border border-black bg-[#FED136] text-[11px] font-black tracking-wider uppercase shadow-[1.5px_1.5px_0px_#000] mb-3">
          Security & Your Rights
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-black tracking-tight leading-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-700 font-bold leading-relaxed max-w-lg">
          Plain human language — no 50 pages of jargon. Last updated September 18, 2026.
        </p>
        {/* Inline highlights pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {highlights.map((h, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-1.5 border-black bg-white text-[11px] font-black text-black shadow-[1px_1px_0px_#000]">
              <span>{h.emoji}</span> {h.label}
            </span>
          ))}
        </div>
        <div className="absolute right-5 -bottom-3 text-7xl select-none -rotate-6 opacity-90 hidden sm:block">🛡️</div>
      </div>

      {/* Sections — compact list cards */}
      <div className="divide-y divide-zinc-100 rounded-3xl border-2 border-black bg-white shadow-[4px_4px_0px_#18181B] overflow-hidden mb-6">
        {sections.map((s, i) => (
          <div key={i} className="flex items-start gap-4 p-5 hover:bg-zinc-50 transition-colors">
            <div className="w-8 h-8 rounded-lg border border-black/10 bg-zinc-50 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              {s.icon}
            </div>
            <div>
              <p className="text-xs font-black text-black mb-1">{s.title}</p>
              <p className="text-xs text-zinc-600 font-medium leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Contact strip */}
      <div className="rounded-3xl border-2 border-black bg-[#FDFBF7] p-5 flex items-center justify-between gap-4 flex-wrap shadow-[3px_3px_0px_#000]">
        <div>
          <p className="text-xs font-black text-black">Privacy questions or data requests?</p>
          <p className="text-[11px] text-zinc-500 font-medium">We respond within 48 hours.</p>
        </div>
        <a
          href="mailto:apoorv.mehrotra.work@gmail.com?subject=Privacy%20Inquiry"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-[#FED136] hover:bg-[#ffe169] text-xs font-black text-black shadow-[2px_2px_0px_#000] transition-all shrink-0"
        >
          <Mail className="w-3.5 h-3.5" /> Contact Us
        </a>
      </div>

    </div>
  );
}
