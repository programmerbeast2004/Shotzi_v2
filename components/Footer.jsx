"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { scrollToSection } from "../lib/scrollToSection";
import { getAuthUser, supabase } from "../lib/supabaseClient";

export default function Footer() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const shouldHideFooter = pathname === "/auth" || pathname === "/developer";

  useEffect(() => {
    setMounted(true);
    let ignore = false;
    getAuthUser().then((u) => {
      if (!ignore) setUser(u);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ignore) setUser(session?.user ?? null);
    });

    return () => {
      ignore = true;
      subscription?.unsubscribe();
    };
  }, []);

  /**
   * Smart click handler for footer hash links.
   * - If we're already on the target page (e.g. clicking /#moments while on /),
   *   intercept and scroll directly — no Next.js navigation, no page reload.
   * - If we're on a different page, let Next.js navigate normally;
   *   page.jsx's useEffect will handle the scroll after loading finishes.
   */
  const handleHashLink = useCallback((e, href) => {
    const url = new URL(href, window.location.origin);
    const targetPath = url.pathname;
    const hash = url.hash; // e.g. "#moments"

    if (!hash) return; // plain link — let it go normally

    const currentPath = window.location.pathname;

    if (currentPath === targetPath) {
      // Same page — prevent full navigation and scroll directly
      e.preventDefault();
      const id = hash.replace(/^#/, "");
      // Update URL hash so back button and bookmarking still work
      window.history.pushState(null, "", hash);
      scrollToSection(id);
    }
    // Different page — do nothing; Next.js router will navigate and
    // page.jsx hash useEffect will handle the scroll on arrival.
  }, []);

  // Do not render footer on dedicated auth page or developer page (which has its own minimal editorial footer)
  if (shouldHideFooter) {
    return null;
  }

  const currentYear = mounted ? new Date().getFullYear() : 2026;

  const productLinks = user
    ? [
        { name: "Feed & Shots", href: "/#feed" },
        { name: "Live Chat Rooms", href: "/chat" },
        { name: "Infinite Reels", href: "/reels" },
        { name: "How It Works", href: "/about#how-it-works" },
        { name: "Guidelines", href: "/guidelines" },
      ]
    : [
        { name: "Home Feed", href: "/" },
        { name: "Daily Moments", href: "/#moments" },
        { name: "How It Works", href: "/#how-it-works" },
        { name: "Community Guidelines", href: "/guidelines" },
      ];

  return (
    <footer
      role="contentinfo"
      className="relative w-full overflow-hidden bg-[#F6F4ED] text-[#18181A] font-sans border-t border-[#E5E0D6] mt-12 sm:mt-20 select-none transition-colors duration-300"
    >
      {/* Keyframe Micro-Animations */}
      <style jsx global>{`
        @keyframes lampGlowPulse {
          0%, 100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.12);
          }
        }
        @keyframes starTwinkleGlint {
          0%, 100% {
            transform: scale(1) rotate(0deg);
            filter: drop-shadow(0 0 3px rgba(254, 209, 54, 0.5));
          }
          50% {
            transform: scale(1.25) rotate(10deg);
            filter: drop-shadow(0 0 12px rgba(254, 209, 54, 1)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
          }
        }
        @keyframes boyBreathe {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-4px) scale(1.01);
          }
        }
        @keyframes cameraLensGlint {
          0%, 80%, 100% {
            opacity: 0;
            transform: scale(0.8);
          }
          90% {
            opacity: 0.9;
            transform: scale(1.2);
          }
        }
        @keyframes calligraphySheen {
          0% {
            transform: translateX(-100%) rotate(25deg);
            opacity: 0;
          }
          30% {
            opacity: 0.8;
          }
          60%, 100% {
            transform: translateX(200%) rotate(25deg);
            opacity: 0;
          }
        }
        .animate-lamp-cone {
          animation: lampGlowPulse 4s ease-in-out infinite;
        }
        .animate-star-twinkle {
          animation: starTwinkleGlint 3.2s ease-in-out infinite;
        }
        .animate-boy-breathe {
          animation: boyBreathe 4.5s ease-in-out infinite;
        }
        .animate-lens-glint {
          animation: cameraLensGlint 6s ease-in-out infinite;
        }
        .animate-calligraphy-sheen {
          animation: calligraphySheen 5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* =======================================================================
          1. DESKTOP & TABLET VIEW (md: >= 768px)
          Full-width Panoramic Desk Artwork with Ambient Micro-Animations & Links
          ======================================================================= */}
      <div className="hidden md:block w-full select-none">
        <div className="relative w-full max-w-[1920px] mx-auto overflow-hidden bg-[#F6F4ED] aspect-[1024/436]">
          
          {/* --- LAYER 1: Full-Width Master Panoramic Desk Artwork (1024x436) --- */}
          <div className="relative w-full h-full select-none pointer-events-none">
            <img
              src="/footer/panoramic-desk-bg.png"
              alt="Shotzi illustrated desk with vintage camera, lamp, polaroids, vinyl, and blackboard wave"
              className="w-full h-full object-cover object-center pointer-events-none select-none"
              priority="true"
            />

            {/* --- LAYER 2: Ambient Lighting Micro-Animations --- */}
            {/* Lamp Glow Cone (Top Right) */}
            <div
              className="absolute top-[2%] right-[8%] w-[18%] aspect-square rounded-full bg-[#FED136]/35 blur-2xl pointer-events-none animate-lamp-cone mix-blend-multiply"
              aria-hidden="true"
            />
            <div
              className="absolute top-[7%] right-[10%] w-[10%] aspect-square rounded-full bg-[#FFF8E7]/40 blur-xl pointer-events-none animate-lamp-cone"
              aria-hidden="true"
            />

            {/* Camera Lens Sparkle (Bottom Left) */}
            <div
              className="absolute top-[71%] left-[8.2%] w-4 h-4 rounded-full bg-white/90 blur-[1px] pointer-events-none animate-lens-glint shadow-[0_0_12px_#FED136]"
              aria-hidden="true"
            />

            {/* Chalkboard Star Twinkles */}
            <div
              className="absolute top-[75.5%] left-[29.5%] w-4 h-4 pointer-events-none animate-star-twinkle text-[#FED136] text-xs"
              aria-hidden="true"
            >
              ✦
            </div>
            <div
              className="absolute top-[82%] right-[10.5%] w-4 h-4 pointer-events-none animate-star-twinkle text-[#FED136] text-xs"
              aria-hidden="true"
            >
              ✦
            </div>
          </div>

          {/* --- LAYER 3: Character Asset (Apoorv with Green Beanie, Camera & Sleeping Cat) --- */}
          <Link
            href="/developer"
            className="group pointer-events-auto absolute bottom-[2%] right-[17%] w-[36%] max-w-[500px] aspect-[1024/873] z-30 cursor-pointer select-none"
            title="Meet Apoorv Mehrotra - Creator of Shotzi (Click to visit developer page)"
            aria-label="Meet Apoorv Mehrotra - Creator of Shotzi"
          >
            {/* Double-bordered "Meet the developer" Design Callout with Curvy Arrow */}
            <div className="absolute -top-12 -left-8 lg:-top-16 lg:-left-12 z-30 pointer-events-none flex flex-col items-start select-none">
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FFD21E] text-black font-black text-xs uppercase tracking-wider rounded-full border-2 border-black ring-2 ring-black ring-offset-2 ring-offset-[#FAF7F0] shadow-[3px_3px_0px_#18181B] -rotate-3 group-hover:rotate-0 transition-transform duration-200">
                <span>Meet the developer</span>
                <span className="text-sm">👋</span>
              </div>
              
              {/* Curvy hand-drawn arrow pointing towards the guy with cat */}
              <svg
                className="w-14 h-12 text-black ml-8 mt-1 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
                viewBox="0 0 60 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M 6 6 C 18 10, 36 14, 40 32 C 41 38, 48 42, 54 44"
                  stroke="#18181B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 42 43 L 54 44 L 51 32"
                  stroke="#18181B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="relative w-full h-full animate-boy-breathe origin-bottom group-hover:scale-103 transition-transform duration-300">
              <img
                src="/footer/apoorv-beanie-cat-transparent.png"
                alt="Apoorv Mehrotra with vintage Shotzi camera and sleeping ginger cat"
                className="w-full h-full object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.45)] cursor-pointer"
              />
            </div>
          </Link>

          {/* --- LAYER 4: Calligraphy "Shotzi" Signature Across Black Wave --- */}
          <div
            className="absolute bottom-[2.5%] left-[10%] w-[54%] max-w-[760px] z-15 pointer-events-none select-none"
            aria-hidden="true"
          >
            <div className="relative w-full">
              <img
                src="/footer/oversized_shotzi_cutout.png"
                alt="Shotzi calligraphy signature - A softer internet is possible"
                className="w-full h-auto object-contain pointer-events-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
              />

              {/* Twinkling Star above the 'i' */}
              <div
                className="absolute top-[5%] right-[27.5%] w-6 h-6 pointer-events-none animate-star-twinkle flex items-center justify-center text-[#FED136] text-lg"
                aria-hidden="true"
              >
                ✦
              </div>

              {/* Light Sheen Sweep */}
              <div
                className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-40 mix-blend-overlay"
                aria-hidden="true"
              >
                <div className="w-[40%] h-[150%] bg-gradient-to-r from-transparent via-white to-transparent transform -rotate-25 animate-calligraphy-sheen" />
              </div>
            </div>
          </div>

          {/* --- LAYER 5: Interactive HTML UI Elements & Links (Desktop) --- */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            
            {/* 1. Official Shotzi Logo & Mission in Upper Part (Cream Wall) */}
            <div
              style={{ top: "5.5%", left: "17%", width: "33%" }}
              className="pointer-events-auto absolute flex flex-col justify-start"
            >
              <div className="flex items-center gap-3">
                <Link href="/" className="inline-block group" title="Shotzi Home">
                  <img
                    src="/brand/shotzi-logo-clean.png"
                    alt="Shotzi Official Logo"
                    className="h-10 lg:h-12 w-auto object-contain select-none group-hover:scale-102 transition-transform duration-200"
                  />
                </Link>
              </div>
              <p className="font-serif italic text-base lg:text-lg text-[#3F3C36] leading-tight font-medium mt-1">
                A soft place for loud feelings.
              </p>
              <p className="text-xs lg:text-sm text-[#524E48] leading-tight font-normal mt-0.5">
                Capture a brighter you, one unfiltered shot at a time.
              </p>
            </div>

            {/* 3. Navigation Columns (Product & Company) */}
            <div
              style={{ top: "31%", left: "17%", width: "36%" }}
              className="pointer-events-auto absolute flex items-start gap-8 lg:gap-12"
            >
              {/* Product Column */}
              <nav aria-label="Product navigation" className="w-1/2">
                <span className="font-mono text-xs uppercase tracking-widest text-[#B45309] font-bold block pb-1 mb-1.5 border-b border-[#B45309]/20">
                  Product
                </span>
                <ul className="space-y-0.5">
                  {productLinks.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={(e) => handleHashLink(e, item.href)}
                        className="group flex items-center justify-between text-xs lg:text-sm py-1 px-1.5 rounded-md hover:bg-[#FED136]/35 hover:text-[#B45309] font-semibold text-[#18181A] transition-all"
                      >
                        <span className="group-hover:translate-x-0.5 transition-transform">{item.name}</span>
                        <span className="opacity-0 group-hover:opacity-100 text-[#B45309] font-bold transition-opacity">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Company Column */}
              <nav aria-label="Company navigation" className="w-1/2">
                <span className="font-mono text-xs uppercase tracking-widest text-[#B45309] font-bold block pb-1 mb-1.5 border-b border-[#B45309]/20">
                  Company
                </span>
                <ul className="space-y-0.5">
                  {[
                    { name: "About Shotzi", href: "/about" },
                    { name: "Privacy Policy", href: "/privacy" },
                    { name: "Terms of Service", href: "/terms" },
                    { name: "Contact Us", href: "/contact" },
                  ].map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="group flex items-center justify-between text-xs lg:text-sm py-1 px-1.5 rounded-md hover:bg-[#FED136]/35 hover:text-[#B45309] font-semibold text-[#18181A] transition-all"
                      >
                        <span className="group-hover:translate-x-0.5 transition-transform">{item.name}</span>
                        <span className="opacity-0 group-hover:opacity-100 text-[#B45309] font-bold transition-opacity">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* 4. Bottom Chalkboard Legal Bar (Desktop) */}
            <div
              style={{ bottom: "3%", left: "3%", right: "3%" }}
              className="pointer-events-auto absolute flex items-center justify-between text-xs text-[#A1A1AA] font-sans"
            >
              <Link
                href="/terms"
                className="hover:text-white transition-colors"
                title="Terms of Service & Copyright"
              >
                © {currentYear} Shotzi. All rights reserved.
              </Link>

              <div className="flex items-center gap-4">
                <Link
                  href="/developer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                  title="Made with curiosity in India - Developer Profile"
                >
                  <span>Made with curiosity</span>
                  <span className="text-[#FED136]">♡</span>
                  <span>in India</span>
                </Link>

              </div>
            </div>

          </div>
        </div>
      </div>

      {/* =======================================================================
          2. TOUCH-OPTIMIZED MOBILE LAYOUT (< md: < 768px)
          Spacious vertical layout with zero overlapping, 48px+ touch targets,
          and gorgeous brand cards designed specifically for small screens.
          ======================================================================= */}
      <div className="md:hidden flex flex-col w-full px-4 sm:px-6 pt-7 pb-6 space-y-6">
        
        {/* Mobile Header: Logo & Mission Statement */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 max-w-[75%]">
            <Link href="/" className="inline-block" title="Shotzi Home">
              <img
                src="/brand/shotzi-logo-clean.png"
                alt="Shotzi Official Logo"
                className="h-8 w-auto object-contain select-none"
              />
            </Link>
            <p className="font-serif italic text-base text-[#18181A] font-medium leading-tight">
              A soft place for loud feelings.
            </p>
            <p className="text-xs text-[#524E48] leading-relaxed">
              Capture a brighter you, one unfiltered shot at a time.
            </p>
          </div>

          {/* Sticky Note Badge */}
          <div className="w-20 shrink-0 transform -rotate-3">
            <div className="p-2.5 bg-[#FFE066] text-[#18181A] rounded-md shadow-xs border-t border-white/60 text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-[#78350F] font-bold">
                Note
              </p>
              <p className="font-serif italic font-bold text-xs leading-tight mt-0.5">
                Same skies ♡
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Meet Developer Card: Apoorv & Sleeping Cat */}
        <div className="relative w-full rounded-3xl overflow-hidden border-2 border-black bg-[#FFFDF7] shadow-[3px_3px_0px_#18181B] p-5 flex flex-col items-center text-center space-y-2">

          {/* Double-bordered "Meet the developer" Callout & Curvy Arrow */}
          <div className="flex flex-col items-center select-none pointer-events-none pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD21E] text-black font-black text-xs uppercase tracking-wider border-2 border-black ring-2 ring-black ring-offset-2 ring-offset-[#FFFDF7] shadow-[2px_2px_0px_#18181B] -rotate-2">
              <span>Meet the developer</span>
              <span className="text-xs">👋</span>
            </div>
            <svg
              className="w-10 h-7 text-black mt-0.5 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
              viewBox="0 0 60 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 14 6 C 22 12, 32 18, 36 32 C 37 36, 42 40, 48 42"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M 38 41 L 48 42 L 46 32"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Character Illustration Linking Directly to /developer */}
          <Link
            href="/developer"
            className="relative block w-56 xs:w-64 aspect-[1024/873] group cursor-pointer"
            title="Meet Apoorv Mehrotra (Developer of Shotzi) - Click to view profile"
          >
            <div className="w-full h-full animate-boy-breathe origin-bottom group-hover:scale-103 transition-transform">
              <img
                src="/footer/apoorv-beanie-cat-transparent.png"
                alt="Apoorv Mehrotra with vintage Shotzi camera and sleeping ginger cat"
                className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] cursor-pointer"
              />
            </div>
          </Link>

          <p className="font-serif italic text-xs text-zinc-600 font-medium">
            "A softer internet is possible."
          </p>
        </div>

        {/* Product & Company Links: Clean 2-Column Card with Large Touch Targets */}
        <div className="grid grid-cols-2 gap-3 p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[3px_3px_0px_#18181B]">
          {/* Product Links */}
          <nav aria-label="Mobile product links" className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#B45309] font-bold block pb-1 border-b border-[#B45309]/20">
              Product
            </span>
            <ul className="space-y-1 text-xs xs:text-sm font-semibold text-[#18181A]">
              {productLinks.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={(e) => handleHashLink(e, item.href)}
                    className="flex items-center justify-between py-2 px-2 -mx-1 rounded-lg active:bg-[#FED136]/30 hover:text-[#B45309] transition-colors min-h-[40px]"
                  >
                    <span>{item.name}</span>
                    <span className="text-xs text-[#FED136] font-bold">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company Links */}
          <nav aria-label="Mobile company links" className="space-y-2 border-l border-zinc-200 pl-3 sm:pl-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#B45309] font-bold block pb-1 border-b border-[#B45309]/20">
              Company
            </span>
            <ul className="space-y-1 text-xs xs:text-sm font-semibold text-[#18181A]">
              {[
                { name: "About Shotzi", href: "/about" },
                { name: "Privacy Policy", href: "/privacy" },
                { name: "Terms of Service", href: "/terms" },
                { name: "Contact Us", href: "/contact" },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between py-2 px-2 -mx-1 rounded-lg active:bg-[#FED136]/30 hover:text-[#B45309] transition-colors min-h-[40px]"
                  >
                    <span>{item.name}</span>
                    <span className="text-xs text-[#FED136] font-bold">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Mobile Chalkboard Signature Card: Calligraphy Signature, Legal & Credits */}
        <div className="relative -mx-4 sm:-mx-6 p-5 pt-6 bg-[#161616] text-white overflow-hidden space-y-4 rounded-t-3xl shadow-lg text-center border-t-2 border-black">
          <div className="space-y-1">
            <p className="text-xs font-mono tracking-widest text-[#FED136] uppercase font-bold">
              See you around 〰
            </p>
            <p className="font-serif italic text-xs text-[#A1A1AA]">
              A softer internet is possible. ♡
            </p>
          </div>

          <div className="flex justify-center py-1">
            <img
              src="/footer/oversized_shotzi_cutout.png"
              alt="Shotzi calligraphy signature"
              className="w-full max-w-[240px] xs:max-w-[280px] h-auto object-contain select-none filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            />
          </div>

          <div className="pt-3 border-t border-white/10 text-xs text-[#A1A1AA] flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-3">
              <Link href="/terms" className="hover:text-white underline py-1">
                Terms of Service
              </Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-white underline py-1">
                Privacy Policy
              </Link>
            </div>
            <p className="text-[11px] text-[#71717A]">
              © {currentYear} Shotzi. All rights reserved.
            </p>
            <div className="flex items-center justify-between w-full pt-2 text-[11px] text-[#A1A1AA]">
              <Link
                href="/developer"
                className="hover:text-white flex items-center gap-1"
                title="Made with curiosity in India - Developer Profile"
              >
                <span>Made with curiosity</span>
                <span className="text-[#FED136]">♡</span>
                <span>in India</span>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
