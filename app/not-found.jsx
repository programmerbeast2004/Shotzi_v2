"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="rounded-3xl border-[2.5px] border-black bg-white p-8 sm:p-10 shadow-[8px_8px_0px_#18181B] space-y-5">
          <div className="flex justify-center pb-1">
            <img
              src="/brand/shotzi-logo-clean.png"
              alt="Shotzi"
              className="h-8 w-auto object-contain"
            />
          </div>

          <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-black bg-zinc-50">
            <img
              src="/illustrations/giraffe_scooter.jpg"
              alt="Giraffe on scooter"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black text-black tracking-tight">
              Oh noo!
            </h1>
            <p className="text-sm sm:text-base text-zinc-600 font-medium max-w-sm mx-auto leading-relaxed">
              You've caught us at a bad time. Check back in when we've got ahold of our scooter.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="neo-btn neo-btn-black px-7 py-3 text-xs font-black"
            >
              <ArrowLeft className="w-4 h-4 stroke-[3]" />
              <span>Go Back Home</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
