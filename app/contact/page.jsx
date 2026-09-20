"use client";

import Link from "next/link";
import { ArrowLeft, Mail, Sparkles } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 sm:py-16 px-4 sm:px-6">

      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-zinc-100 text-xs font-black text-black shadow-[2px_2px_0px_#000] transition-all mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" />
        Back to Home
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border-[3px] border-black bg-[#FED136] p-6 sm:p-10 shadow-[6px_6px_0px_#18181B] mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black bg-white text-[11px] font-black tracking-wider uppercase shadow-[1.5px_1.5px_0px_#000] mb-3">
          <Sparkles className="w-3 h-3 text-amber-600" /> Say Hello
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-black tracking-tight leading-tight mb-2">
          Contact Us
        </h1>
        <p className="text-sm text-black/80 font-bold leading-relaxed max-w-md">
          Got a question, a bug, a feature idea, or interested in collaborating on a project? Drop us a line — we read every message.
        </p>
        <div className="absolute right-5 -bottom-4 text-7xl select-none rotate-12 opacity-80 hidden sm:block">
          ✉️
        </div>
      </div>

      {/* Single Contact Card */}
      <div className="rounded-3xl border-2 border-black bg-white p-6 sm:p-8 shadow-[4px_4px_0px_#18181B] space-y-5">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border-1.5 border-black bg-[#FFF9E6] flex items-center justify-center shadow-[1.5px_1.5px_0px_#000]">
            <Mail className="w-5 h-5 text-[#B45309]" />
          </div>
          <div>
            <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#B45309]">Reach Out For Anything</p>
            <p className="text-base font-black text-black">apoorv.mehrotra.work@gmail.com</p>
          </div>
        </div>

        <p className="text-sm text-zinc-700 font-medium leading-relaxed border-t border-zinc-100 pt-5">
          Whether it&apos;s a bug, a suggestion, a general question about Shotzi, or you want to see more of our work and projects — one email does it all. We typically reply within <strong className="text-black">24–48 hours</strong>.
        </p>

        {/* Topics hint pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {["Bug Report", "Feature Idea", "General Query", "Collaboration", "More Projects"].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full border border-black/20 bg-zinc-50 text-[11px] font-bold text-zinc-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <a
          href="mailto:apoorv.mehrotra.work@gmail.com"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-black bg-[#FED136] hover:bg-[#ffe169] text-sm font-black text-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          <Mail className="w-4 h-4" />
          Send an Email
        </a>
      </div>

      {/* Quick Links */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500 font-medium">
        <Link href="/about" className="hover:text-black underline underline-offset-2 transition-colors">About Shotzi</Link>
        <span>·</span>
        <Link href="/developer" className="hover:text-black underline underline-offset-2 transition-colors">Developer Portfolio</Link>
        <span>·</span>
        <Link href="/guidelines" className="hover:text-black underline underline-offset-2 transition-colors">Guidelines</Link>
      </div>

    </div>
  );
}
