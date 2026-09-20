"use client";

import { Camera } from "lucide-react";

export default function SkeletonCard() {
  return (
    <article className="relative bg-white border-2 border-black rounded-2xl overflow-hidden flex flex-col shadow-[2px_2px_0px_#18181B] sm:shadow-[3.5px_3.5px_0px_#18181B] animate-pulse">
      {/* Image container skeleton */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-200 border-b-2 border-black flex items-center justify-center">
        <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-300 stroke-[1.5]" />

        {/* Creator tag badge skeleton */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white border-[1.5px] sm:border-2 border-black shadow-[1.5px_1.5px_0px_#18181B]">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-zinc-300 border border-black/30" />
          <div className="h-2 sm:h-2.5 w-10 sm:w-16 bg-zinc-200 rounded-full" />
        </div>

        {/* Shimmer sweep */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
      </div>

      {/* Card Information skeleton */}
      <div className="p-2.5 sm:p-3.5 flex flex-col justify-between flex-1 gap-2 sm:gap-3">
        {/* Caption lines */}
        <div className="space-y-1.5 pt-0.5">
          <div className="h-3 sm:h-3.5 bg-zinc-200 rounded-md w-4/5" />
          <div className="h-2.5 sm:h-3 bg-zinc-100 rounded-md w-3/5" />
        </div>

        {/* Bottom interaction pills & timestamp skeleton */}
        <div className="pt-1.5 sm:pt-2 border-t-2 border-black/10 flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div className="h-5 sm:h-7 w-9 sm:w-12 rounded-full border border-black/30 bg-zinc-100 shadow-[1px_1px_0px_#00000030]" />
            <div className="h-5 sm:h-7 w-9 sm:w-12 rounded-full border border-black/30 bg-zinc-100 shadow-[1px_1px_0px_#00000030]" />
          </div>
          <div className="h-2.5 sm:h-3 w-10 sm:w-14 bg-zinc-200 rounded-full" />
        </div>
      </div>
    </article>
  );
}
