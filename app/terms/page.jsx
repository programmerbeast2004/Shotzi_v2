"use client";

import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Heart, Scale, MessageSquare,
  AlertTriangle, Shield, Sparkles, FileText, Mail,
} from "lucide-react";

const sections = [
  {
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    title: "Acceptance of Terms",
    body: <>
      By creating an account or using any feature on Shotzi, you agree to these Terms and our{" "}
      <Link href="/guidelines" className="font-black underline underline-offset-2 hover:text-[#B45309]">Community Guidelines</Link>.
      If you disagree, please do not use the service.
    </>,
  },
  {
    icon: <Heart className="w-4 h-4 text-rose-500" />,
    title: "Community Code",
    body: "Shotzi thrives on warmth and creative vulnerability. Post authentic moments, treat everyone with kindness, keep rooms free of harassment, and don't bot or spam. Full details in our Guidelines.",
  },
  {
    icon: <Scale className="w-4 h-4 text-amber-600" />,
    title: "Content Ownership",
    body: "You retain 100% ownership of all photos, reels, and content you upload. We never sell your work. You grant Shotzi a non-exclusive license solely to display and operate the platform.",
  },
  {
    icon: <MessageSquare className="w-4 h-4 text-emerald-600" />,
    title: "Chat Rooms",
    body: "Room creators may moderate their spaces and invite or remove members. Do not spam, raid, or distribute harmful links in rooms. Private room conversations must not be leaked without consent.",
  },
  {
    icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
    title: "Prohibited Content",
    body: "Strictly prohibited: sexually explicit imagery, self-harm promotion, doxxing, malware, weapons trade, impersonation, or any illegal activity. Violations result in immediate removal or permanent ban.",
  },
  {
    icon: <Shield className="w-4 h-4 text-blue-600" />,
    title: "Account Security",
    body: "Keep your credentials safe. You must be 13+ to use Shotzi. If you suspect unauthorized access, reset your password immediately via the Sign In page.",
  },
  {
    icon: <Sparkles className="w-4 h-4 text-amber-500" />,
    title: "Moderation",
    body: "Shotzi may remove posts that violate our policies. You can delete any shot or your full account at any time from Profile Settings.",
  },
  {
    icon: <FileText className="w-4 h-4 text-zinc-500" />,
    title: "Liability",
    body: 'Shotzi is provided "as is". We strive for 100% uptime but cannot guarantee it. We are not liable for indirect or consequential damages. Keep your own backups of original files.',
  },
];

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 sm:px-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-zinc-100 text-xs font-black text-black shadow-[2px_2px_0px_#000] transition-all">
          <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" /> Back to Home
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Link href="/guidelines" className="px-3.5 py-1.5 rounded-full border-2 border-black bg-white hover:bg-[#FFF9E6] text-xs font-black shadow-[2px_2px_0px_#000] transition-all">Guidelines</Link>
          <Link href="/privacy" className="px-3.5 py-1.5 rounded-full border-2 border-black bg-[#FFF9E6] hover:bg-[#FED136] text-xs font-black shadow-[2px_2px_0px_#000] transition-all">Privacy →</Link>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border-[3px] border-black bg-[#FED136] p-6 sm:p-10 shadow-[6px_6px_0px_#18181B] mb-8">
        <span className="inline-block px-3 py-1 rounded-full border border-black bg-white text-[11px] font-black tracking-wider uppercase shadow-[1.5px_1.5px_0px_#000] mb-3">
          Legal Agreement
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-black tracking-tight leading-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-black/90 font-bold leading-relaxed max-w-lg">
          A plain-language agreement built on trust, creative ownership, and mutual respect. Last updated September 18, 2026.
        </p>
        <div className="absolute right-5 -bottom-3 text-7xl select-none rotate-6 opacity-90 hidden sm:block">📸</div>
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
          <p className="text-xs font-black text-black">Questions about these terms?</p>
          <p className="text-[11px] text-zinc-500 font-medium">We read every email with care.</p>
        </div>
        <a
          href="mailto:apoorv.mehrotra.work@gmail.com?subject=Terms%20Inquiry"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-[#FED136] hover:bg-[#ffe169] text-xs font-black text-black shadow-[2px_2px_0px_#000] transition-all shrink-0"
        >
          <Mail className="w-3.5 h-3.5" /> Contact Us
        </a>
      </div>

    </div>
  );
}
