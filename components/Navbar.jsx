"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase, getAuthUser } from "../lib/supabaseClient";
import { useAuthDrawer } from "./AuthDrawer";
import { isAdmin } from "../lib/admin";
import {
  Plus,
  Compass,
  MessageSquare,
  Globe,
  Bell,
  User,
  Shield,
  LogOut,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPlayingMusic, setIsPlayingMusic] = useState(true);
  const audioRef = useRef(null);
  const userManuallyPausedRef = useRef(false);
  const { openAuth } = useAuthDrawer();

  // Autoplay by default, with seamless first-interaction unlock if browser restricts initial autoplay
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.35;
    const playAttempt = audio.play();
    if (playAttempt !== undefined) {
      playAttempt
        .then(() => {
          setIsPlayingMusic(true);
        })
        .catch(() => {
          // If browser restricts unmuted autoplay before interaction,
          // start playing on the very first touch/click anywhere
          const handleFirstInteraction = () => {
            if (userManuallyPausedRef.current) return;
            const audioEl = audioRef.current;
            if (!audioEl) return;
            audioEl.volume = 0.35;
            audioEl
              .play()
              .then(() => setIsPlayingMusic(true))
              .catch(() => {});
          };

          window.addEventListener("pointerdown", handleFirstInteraction, { once: true });
          window.addEventListener("keydown", handleFirstInteraction, { once: true });
        });
    }
  }, []);

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlayingMusic) {
      audioRef.current.pause();
      setIsPlayingMusic(false);
      userManuallyPausedRef.current = true;
    } else {
      userManuallyPausedRef.current = false;
      audioRef.current.volume = 0.35;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlayingMusic(true);
          })
          .catch((err) => {
            console.warn("Audio playback issue:", err);
            setIsPlayingMusic(false);
          });
      }
    }
  };

  useEffect(() => {
    let ignore = false;

    async function load() {
      const u = await getAuthUser();
      if (!ignore) {
        setUser(u);
        setLoading(false);
      }
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      ignore = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const loadUnreadCount = async (userId) => {
    try {
      const { data } = await supabase
        .from("notifications")
        .select("id", { count: "exact" })
        .eq("user_id", userId)
        .eq("read", false);
      setUnreadCount(data?.length || 0);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      loadUnreadCount(user.id);
      const notifSubscription = supabase
        .channel("navbar-notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadUnreadCount(user.id);
          }
        )
        .subscribe();

      const storageHandler = (e) => {
        if (!e) return;
        if (e.key === "shotzi_notification_update") {
          try {
            const payload = JSON.parse(e.newValue || "{}");
            if (!payload.userId || payload.userId !== user.id) return;
          } catch (err) {}
          loadUnreadCount(user.id);
        }
      };
      window.addEventListener("storage", storageHandler);

      const localHandler = (e) => {
        try {
          const payload = e?.detail || {};
          if (!payload.userId || payload.userId !== user.id) return;
        } catch (err) {}
        loadUnreadCount(user.id);
      };
      window.addEventListener("shotzi_notification_update_local", localHandler);

      return () => {
        notifSubscription?.unsubscribe();
        window.removeEventListener("storage", storageHandler);
        window.removeEventListener("shotzi_notification_update_local", localHandler);
      };
    } else {
      setUnreadCount(0);
    }
  }, [user]);

  // Heartbeat: update profiles.last_active periodically so others can see online status
  useEffect(() => {
    if (!user) return;
    const updateLastActive = async () => {
      try {
        await supabase
          .from("profiles")
          .update({ last_active: new Date().toISOString() })
          .eq("id", user.id);
      } catch (err) {}
    };

    updateLastActive();
    const iv = setInterval(updateLastActive, 25 * 1000);
    return () => clearInterval(iv);
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navLinks = user
    ? [
        { label: "Dump", href: "/upload", icon: Plus, highlight: true },
        { label: "Infinite", href: "/reels", icon: Compass },
        { label: "Messages", href: "/chat", icon: MessageSquare },
        { label: "Global", href: "/chat/global", icon: Globe },
        {
          label: "Notifications",
          href: "/notifications",
          icon: Bell,
          badge: unreadCount,
        },
      ]
    : [];

  if (pathname === "/auth") return null;

  return (
    <header className="sticky top-2 z-40 w-full px-2.5 sm:px-6 pointer-events-none transition-all duration-300">
      <nav className="pointer-events-auto max-w-6xl mx-auto h-[58px] sm:h-[66px] px-3 sm:px-6 rounded-full border-2 border-black bg-white shadow-[4px_4px_0px_#18181B] flex items-center justify-between gap-2 sm:gap-3">
        {/* LEFT: OFFICIAL SHOTZI BRAND LOGO (RESPONSIVE) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <Link href="/" prefetch={true} className="group flex items-center gap-2 sm:gap-2.5" title="Shotzi – Home">
            <div className="relative shrink-0">
              <img
                src="/brand/shotzi-icon-app.png"
                alt="Shotzi Mark"
                className="w-7 h-7 sm:w-8.5 sm:h-8.5 object-contain drop-shadow-[1.5px_1.5px_0px_#18181B] group-hover:scale-105 group-hover:rotate-3 transition-all duration-200"
              />
            </div>
            <img
              src="/brand/shotzi-logo-clean.png"
              alt="Shotzi"
              className="h-[24px] xs:h-[27px] sm:h-[31px] md:h-[33px] w-auto object-contain group-hover:scale-102 transition-transform duration-200"
            />
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider hidden xl:inline-block border-l-2 border-black/10 pl-2.5 py-0.5 leading-tight ml-0.5 whitespace-nowrap">
              Soft place for
              <br />
              loud feelings
            </span>
          </Link>
        </div>

        {/* CENTER / RIGHT: DESKTOP NAVIGATION LINKS (ONLY WHEN SIGNED IN) */}
        {user && navLinks.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 shrink-0">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              if (item.highlight) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className="neo-btn neo-btn-yellow px-3 xl:px-4 py-1.5 text-xs font-bold text-black border-2 border-black shadow-[2px_2px_0px_#18181B] whitespace-nowrap shrink-0 flex items-center gap-1.5"
                  >
                    <Icon className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`relative inline-flex items-center gap-1.5 px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-150 whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-[#FFD21E] text-black border-2 border-black shadow-[2px_2px_0px_#18181B]"
                      : "text-zinc-700 hover:text-black hover:bg-zinc-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#FF5376] text-white text-[10px] font-black border border-black shadow-[1px_1px_0px_#000] shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* RIGHT: USER PROFILE, ACTIONS & JOIN BUTTON */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Music Wavy Button (Click to stop, click again to resume) */}
          <button
            type="button"
            onClick={toggleMusic}
            className={`group inline-flex items-center justify-center h-8 sm:h-9 px-2.5 sm:px-3 rounded-full border-2 border-black transition-all cursor-pointer select-none active:translate-x-0.5 active:translate-y-0.5 shrink-0 whitespace-nowrap ${
              isPlayingMusic
                ? "bg-[#FFD21E] text-black shadow-[2px_2px_0px_#18181B]"
                : "bg-white hover:bg-[#FAF7F0] text-zinc-700 hover:text-black shadow-[1.5px_1.5px_0px_#18181B]"
            }`}
            title={isPlayingMusic ? "Click to stop music" : "Click to play music"}
            aria-label={isPlayingMusic ? "Stop background music" : "Play background music"}
          >
            {/* Animated Wavy Equalizer Bars */}
            <div className="flex items-end gap-[2.5px] h-3.5 sm:h-4 w-4 sm:w-5 justify-center overflow-hidden py-0.5">
              <span
                className={`w-[2px] sm:w-[2.5px] rounded-full transition-all duration-200 ${
                  isPlayingMusic
                    ? "bg-black animate-music-bar-1"
                    : "h-1 bg-zinc-400 group-hover:bg-zinc-700"
                }`}
              />
              <span
                className={`w-[2px] sm:w-[2.5px] rounded-full transition-all duration-200 ${
                  isPlayingMusic
                    ? "bg-black animate-music-bar-2"
                    : "h-2 bg-zinc-400 group-hover:bg-zinc-700"
                }`}
              />
              <span
                className={`w-[2px] sm:w-[2.5px] rounded-full transition-all duration-200 ${
                  isPlayingMusic
                    ? "bg-black animate-music-bar-3"
                    : "h-1 bg-zinc-400 group-hover:bg-zinc-700"
                }`}
              />
              <span
                className={`w-[2px] sm:w-[2.5px] rounded-full transition-all duration-200 ${
                  isPlayingMusic
                    ? "bg-black animate-music-bar-4"
                    : "h-2.5 bg-zinc-400 group-hover:bg-zinc-700"
                }`}
              />
              <span
                className={`w-[2px] sm:w-[2.5px] rounded-full transition-all duration-200 ${
                  isPlayingMusic
                    ? "bg-black animate-music-bar-1"
                    : "h-1.5 bg-zinc-400 group-hover:bg-zinc-700"
                }`}
              />
            </div>
          </button>

          {user && (
            <Link
              href="/profile"
              prefetch={true}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                pathname === "/profile"
                  ? "bg-[#18181B] text-white border border-black shadow-[2px_2px_0px_#000]"
                  : "text-zinc-700 hover:text-black hover:bg-zinc-100"
              }`}
            >
              <User className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
              <span>Profile</span>
            </Link>
          )}

          {user && isAdmin(user) && (
            <Link
              href="/admin"
              prefetch={true}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                pathname.startsWith("/admin")
                  ? "bg-[#FF5376] text-white border-2 border-black shadow-[2px_2px_0px_#000]"
                  : "text-zinc-700 hover:text-black hover:bg-zinc-100"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-black shrink-0" />
              <span>Admin</span>
            </Link>
          )}

          {/* Unauthenticated: Show ONLY Join Shotzi on all devices */}
          {!loading && !user && (
            <Link
              href="/auth?mode=signup"
              className="neo-btn neo-btn-black px-3.5 sm:px-4.5 py-1.5 text-xs font-bold shadow-[2px_2px_0px_#FFD21E] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFD21E] shrink-0" />
              <span>Join Shotzi</span>
            </Link>
          )}

          {/* Authenticated Desktop: Sign out */}
          {!loading && user && (
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex p-1.5 rounded-full text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          )}

          {/* Authenticated Mobile: + Dump and Hamburger Menu */}
          {user && (
            <div className="flex lg:hidden items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                href="/upload"
                className="neo-btn neo-btn-yellow px-2.5 xs:px-3 py-1 text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Dump</span>
              </Link>

              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="p-1.5 xs:p-2 rounded-full border-2 border-black bg-zinc-100 text-black shadow-[1.5px_1.5px_0px_#000] hover:bg-zinc-200 transition-colors shrink-0"
                aria-label="Toggle Navigation Menu"
              >
                {mobileOpen ? <X className="w-4 xs:w-5 h-4 xs:h-5 stroke-[2.5]" /> : <Menu className="w-4 xs:w-5 h-4 xs:h-5 stroke-[2.5]" />}
              </button>
            </div>
          )}
        </div>

        {/* Hidden Audio Element for Background Vibe */}
        <audio
          ref={audioRef}
          src="/music/shotzi-vibe.mp3"
          loop
          preload="auto"
          onEnded={() => setIsPlayingMusic(false)}
          onPause={() => setIsPlayingMusic(false)}
          onPlay={() => setIsPlayingMusic(true)}
        />
      </nav>

      {/* MOBILE FLYOUT MENU */}
      {mobileOpen && (
        <div className="pointer-events-auto lg:hidden max-w-6xl mx-auto mt-2 px-3">
          <div className="rounded-3xl border-2 border-black bg-white shadow-[5px_5px_0px_#18181B] p-5 space-y-4">
            {/* Top brand header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
              <div className="flex items-center gap-2">
                <img
                  src="/brand/shotzi-icon-app.png"
                  alt="Shotzi Mark"
                  className="w-7 h-7 object-contain drop-shadow-[1.5px_1.5px_0px_#18181B]"
                />
                <img
                  src="/brand/shotzi-logo-clean.png"
                  alt="Shotzi"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                Soft place for loud feelings
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 p-3 rounded-2xl border-2 text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[#18181B] text-white border-black shadow-[2px_2px_0px_#18181B]"
                        : "bg-zinc-50 text-black border-black/20 hover:border-black"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-[#FF5376] text-white text-[10px] font-black border border-black">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="pt-3 border-t-2 border-black/10 flex flex-col gap-2.5">
              {user ? (
                <>
                  {isAdmin(user) && (
                    <Link
                      href="/admin"
                      prefetch={true}
                      onClick={() => setMobileOpen(false)}
                      className="neo-btn bg-[#FF5376] hover:bg-[#FF3E65] text-white border-2 border-black shadow-[2px_2px_0px_#000] px-4 py-2 text-xs font-black flex items-center justify-center gap-2 w-full"
                    >
                      <Shield className="w-4 h-4 text-black stroke-[2.5]" />
                      <span>Admin Command Center</span>
                    </Link>
                  )}
                  <div className="flex items-center justify-between w-full">
                    <Link
                      href="/profile"
                      prefetch={true}
                      onClick={() => setMobileOpen(false)}
                      className="neo-btn neo-btn-white px-4 py-2 text-xs font-bold"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>My Profile</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        handleLogout();
                      }}
                      className="text-xs font-bold text-red-600 hover:underline px-2 py-1 cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full">
                  <Link
                    href="/auth?mode=signup"
                    prefetch={true}
                    onClick={() => setMobileOpen(false)}
                    className="neo-btn neo-btn-yellow w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0px_#18181B]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Join Shotzi</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
