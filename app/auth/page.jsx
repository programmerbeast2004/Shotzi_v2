"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, getAuthUser } from "../../lib/supabaseClient";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  Lock,
  Sparkles,
  X,
  KeyRound,
  Check,
} from "lucide-react";
import { useToast } from "../../components/Toast";
import ResetPasswordModal from "../../components/ResetPasswordModal";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signin" ? "signin" : "signup";

  const [mode, setMode] = useState(initialMode); // "signup" | "signin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Forgot password modal state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const toast = useToast();

  // Prevent any body/page scrolling on auth page
  useEffect(() => {
    const origHtmlOverflow = document.documentElement.style.overflow;
    const origBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = origHtmlOverflow;
      document.body.style.overflow = origBodyOverflow;
    };
  }, []);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    getAuthUser().then((u) => {
      if (u) {
        router.replace("/");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace("/");
      }
    });

    return () => subscription?.unsubscribe();
  }, [router]);

  // Sync mode with query params if changed externally
  useEffect(() => {
    const qMode = searchParams.get("mode");
    if (qMode === "signin" || qMode === "signup") {
      setMode(qMode);
    }
  }, [searchParams]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMessage("");
    window.history.replaceState(null, "", `/auth?mode=${newMode}`);
  };

  const handleSocialAuth = async (provider) => {
    try {
      setSocialLoading(provider);
      setErrorMessage("");
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/`
              : undefined,
        },
      });
      if (error) throw error;
    } catch (err) {
      setErrorMessage(err.message || `Failed to continue with ${provider}`);
      toast.error(err.message || `Failed to sign in with ${provider}`);
    } finally {
      setSocialLoading("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Welcome back to Shotzi!");
        router.replace("/");
      } else {
        // Sign up: Generate unique default username from email initials / prefix
        const rawPrefix = email.split("@")[0] || "user";
        const baseUsername = rawPrefix.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "user";

        // Check uniqueness in profiles table and assign suffix if taken
        let finalUsername = baseUsername;
        try {
          const { data: existingUser } = await supabase
            .from("profiles")
            .select("username")
            .eq("username", baseUsername)
            .maybeSingle();

          if (existingUser) {
            let uniqueFound = false;
            for (let i = 0; i < 5; i++) {
              const randomSuffix = Math.floor(100 + Math.random() * 900);
              const candidate = `${baseUsername.slice(0, 14)}_${randomSuffix}`;
              const { data: collision } = await supabase
                .from("profiles")
                .select("username")
                .eq("username", candidate)
                .maybeSingle();

              if (!collision) {
                finalUsername = candidate;
                uniqueFound = true;
                break;
              }
            }
            if (!uniqueFound) {
              finalUsername = `${baseUsername.slice(0, 12)}_${Date.now().toString().slice(-4)}`;
            }
          }
        } catch (checkErr) {
          console.warn("Username uniqueness check non-fatal:", checkErr);
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: finalUsername,
              name: finalUsername,
            },
          },
        });
        if (error) throw error;

        if (data?.user) {
          try {
            await supabase.from("profiles").upsert(
              {
                id: data.user.id,
                username: finalUsername,
                display_name: finalUsername,
                last_active: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
          } catch (profileErr) {
            console.warn("Profile creation handled via trigger:", profileErr);
          }
        }

        toast.success(`Account created as @${finalUsername}! Welcome to Shotzi.`);
        router.replace("/");
      }
    } catch (err) {
      setErrorMessage(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 h-screen max-h-screen w-screen overflow-hidden bg-[#FBF9F2] flex items-center justify-center p-3 sm:p-5 selection:bg-[#FFD21E]">
      {/* Background ambient warm glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#FFEAA7]/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#FFD21E]/25 rounded-full blur-3xl pointer-events-none" />

      {/* ================================================================
          1. DESKTOP & TABLET LANDSCAPE VIEW (>= 1024px)
          - Perfectly fits within viewport height (ZERO window scrolling)
          - Well-paced, airy vertical breathing room inside the card
          - 3D Card Rotation Flip Animation on mode switch
          ================================================================ */}
      <div
        className="hidden lg:block relative rounded-[32px] sm:rounded-[36px] border-2 sm:border-3 border-black shadow-[8px_8px_0px_#18181B] overflow-hidden bg-[#FAF7EE] select-none shrink-0"
        style={{
          height: "min(676px, calc(100vh - 28px))",
          width: "calc(min(676px, calc(100vh - 28px)) * 1.501)",
          maxWidth: "1024px",
        }}
      >
        {/* Full Complete Background Artwork */}
        <img
          src="/auth/auth_full_bg.png"
          alt="Shotzi Background Canvas"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* 3D PERSPECTIVE FLIPPER CONTAINER IN THE EMPTY SPACE */}
        <div
          className="absolute top-[2.8%] bottom-[2.8%] left-[54.8%] w-[32.2%] z-20"
          style={{ perspective: "1200px" }}
        >
          {/* Flip Card Inner (Rotates 180deg when in signin mode) */}
          <div
            className={`relative w-full h-full transition-transform duration-700 ease-[cubic-bezier(0.34,1.25,0.64,1)] ${
              mode === "signin" ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
            }`}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* ========================================================
                FRONT FACE: SIGN UP - SPACIOUS & ELEGANT
                ======================================================== */}
            <div
              className="absolute inset-0 w-full h-full bg-white rounded-[28px] border-2 border-black shadow-[4.5px_4.5px_0px_#18181B] p-5.5 xl:p-6 flex flex-col justify-between"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div>
                {/* Header: Clean Back Button */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full border-1.5 border-black bg-zinc-100 hover:bg-zinc-200 text-black shadow-[1px_1px_0px_#000] active:scale-95 transition-all"
                    title="Back to home"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  </Link>
                </div>

                {/* Title & Subtitle with Airy Pacing */}
                <h1 className="text-xl xl:text-[22px] font-black text-[#18181B] tracking-tight leading-tight mb-1">
                  Let's get you started
                </h1>
                <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mb-3.5">
                  Create your Shotzi account and share real, unfiltered moments.
                </p>

                {/* Social Login: Google Only */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => handleSocialAuth("google")}
                    disabled={!!socialLoading || loading}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-full border-1.5 border-black bg-white hover:bg-zinc-50 text-xs font-bold text-[#18181B] shadow-[2px_2px_0px_#18181B] hover:shadow-[3px_3px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2 my-2.5">
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                  <span className="text-[9.5px] text-zinc-400 font-bold uppercase tracking-wider">
                    or continue with email
                  </span>
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                </div>

                {/* Error Alert */}
                {errorMessage && (
                  <div className="p-2 mb-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[10.5px] font-medium flex items-center gap-1.5 leading-tight">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Form Inputs with Proper Labels & Breathing Room */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-full border border-black/30 focus:border-black bg-zinc-50/90 focus:bg-white text-xs font-semibold text-black placeholder:text-zinc-400 outline-none transition-all shadow-2xs focus:shadow-[1.5px_1.5px_0px_#000]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-3.5 pr-9 py-2.5 rounded-full border border-black/30 focus:border-black bg-zinc-50/90 focus:bg-white text-xs font-semibold text-black placeholder:text-zinc-400 outline-none transition-all shadow-2xs focus:shadow-[1.5px_1.5px_0px_#000]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 rounded-full bg-[#FFD21E] text-black font-black text-xs sm:text-sm border-2 border-black shadow-[2.5px_2.5px_0px_#000] hover:shadow-[3.5px_3.5px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <span>{loading ? "Creating your corner..." : "Create Account →"}</span>
                  </button>

                  {/* Friendly default username note */}
                  <div className="pt-1">
                    <div className="py-2 px-3 rounded-2xl bg-[#FFF9E6] border border-black/15 flex items-center gap-2 text-[10.5px] text-zinc-700 font-bold">
                      <span className="text-sm select-none">✨</span>
                      <span>Default username assigned from your email. Edit anytime in profile!</span>
                    </div>
                  </div>
                </form>

                {/* Mode Switch: Down below the form */}
                <div className="text-center text-xs font-bold text-zinc-600 pt-3">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-black text-black underline decoration-1.5 underline-offset-2 hover:text-[#D97706] transition-colors cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
              </div>

              {/* Natural Bottom Terms & Privacy Notice */}
              <div className="pt-2.5 mt-auto border-t border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                  By continuing, you agree to our{" "}
                  <Link
                    href="/terms"
                    className="font-bold text-black underline decoration-1 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="font-bold text-black underline decoration-1 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            </div>

            {/* ========================================================
                BACK FACE: SIGN IN - ROTATED 180 DEG
                ======================================================== */}
            <div
              className="absolute inset-0 w-full h-full bg-white rounded-[28px] border-2 border-black shadow-[4.5px_4.5px_0px_#18181B] p-5.5 xl:p-6 flex flex-col justify-between [transform:rotateY(180deg)]"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div>
                {/* Header: Clean Back Button */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full border-1.5 border-black bg-zinc-100 hover:bg-zinc-200 text-black shadow-[1px_1px_0px_#000] active:scale-95 transition-all"
                    title="Back to home"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  </Link>
                </div>

                {/* Title & Subtitle with Airy Pacing */}
                <h1 className="text-xl xl:text-[22px] font-black text-[#18181B] tracking-tight leading-tight mb-1">
                  Welcome back
                </h1>
                <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mb-3.5">
                  Enter your details to sign in and reconnect with your people.
                </p>

                {/* Social Login: Google Only */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => handleSocialAuth("google")}
                    disabled={!!socialLoading || loading}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-full border-1.5 border-black bg-white hover:bg-zinc-50 text-xs font-bold text-[#18181B] shadow-[2px_2px_0px_#18181B] hover:shadow-[3px_3px_0px_#18181B] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2 my-2.5">
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                  <span className="text-[9.5px] text-zinc-400 font-bold uppercase tracking-wider">
                    or continue with email
                  </span>
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                </div>

                {/* Error Alert */}
                {errorMessage && (
                  <div className="p-2 mb-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[10.5px] font-medium flex items-center gap-1.5 leading-tight">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Form Inputs with Generous Padding */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-full border border-black/30 focus:border-black bg-zinc-50/90 focus:bg-white text-xs font-semibold text-black placeholder:text-zinc-400 outline-none transition-all shadow-2xs focus:shadow-[1.5px_1.5px_0px_#000]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black text-black uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotPasswordOpen(true);
                        }}
                        className="text-[11px] font-bold text-zinc-500 hover:text-black hover:underline transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-3.5 pr-9 py-2.5 rounded-full border border-black/30 focus:border-black bg-zinc-50/90 focus:bg-white text-xs font-semibold text-black placeholder:text-zinc-400 outline-none transition-all shadow-2xs focus:shadow-[1.5px_1.5px_0px_#000]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 rounded-full bg-[#FFD21E] text-black font-black text-xs sm:text-sm border-2 border-black shadow-[2.5px_2.5px_0px_#000] hover:shadow-[3.5px_3.5px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <span>{loading ? "Signing in..." : "Sign in →"}</span>
                  </button>

                  {/* Cozy Brand Micro-Badge */}
                  <div className="pt-1">
                    <div className="py-2 px-3 rounded-2xl bg-[#FFF9E6] border border-black/15 flex items-center gap-2 text-[10.5px] text-zinc-700 font-bold">
                      <span className="text-sm select-none">✨</span>
                      <span>No feeds. No ads. Just raw, unfiltered moments.</span>
                    </div>
                  </div>
                </form>

                {/* Mode Switch: Down below the form */}
                <div className="text-center text-xs font-bold text-zinc-600 pt-3">
                  New to Shotzi?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="font-black text-black underline decoration-1.5 underline-offset-2 hover:text-[#D97706] transition-colors cursor-pointer"
                  >
                    Create account
                  </button>
                </div>
              </div>

              {/* Natural Bottom Terms & Privacy Notice */}
              <div className="pt-2.5 mt-auto border-t border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                  By continuing, you agree to our{" "}
                  <Link
                    href="/terms"
                    className="font-bold text-black underline decoration-1 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="font-bold text-black underline decoration-1 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          2. SMALL DEVICES / MOBILE & TABLET PORTRAIT (< 1024px)
          - Vibrant, non-dull, full-featured Shotzi neo-brutalist experience
          - 3D Card Rotation Flip Animation
          - Playful Peeking Cat Mascot
          - Fits comfortably within screen with ZERO annoying window scroll
          ================================================================ */}
      <div className="lg:hidden w-full max-w-[390px] h-full max-h-[96vh] flex flex-col justify-between py-1 sm:py-2 select-none relative z-10">
        {/* Top Playful Brand Header Bar */}
        <div className="flex items-center justify-between gap-2 px-1">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <img
              src="/brand/shotzi-icon-app.png"
              alt="Shotzi"
              className="w-7 h-7 object-contain drop-shadow-xs group-hover:rotate-3 transition-transform"
            />
            <img
              src="/brand/shotzi-logo-clean.png"
              alt="Shotzi"
              className="h-6 w-auto object-contain"
            />
            <span className="text-[9px] font-black tracking-wider text-black bg-[#FFD21E] px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
              UNFILTERED
            </span>
          </Link>
          <span className="text-[10px] font-bold text-black bg-[#FFD21E] px-2.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
            {mode === "signup" ? "SIGN UP" : "SIGN IN"}
          </span>
        </div>

        {/* 3D Flip Card Container on Mobile */}
        <div className="relative w-full my-auto" style={{ perspective: "1000px" }}>
          <div
            className={`relative w-full transition-transform duration-700 ease-[cubic-bezier(0.34,1.25,0.64,1)] ${
              mode === "signin" ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
            }`}
            style={{ transformStyle: "preserve-3d" }}
          >

            {/* ========================================================
                MOBILE FRONT FACE: SIGN UP
                ======================================================== */}
            <div
              className="w-full rounded-[28px] border-2 sm:border-3 border-black bg-white p-5 sm:p-6 shadow-[5px_5px_0px_#18181B] flex flex-col justify-between"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div>
                {/* Mobile Card Header: Clean Back Button */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Link
                    href="/"
                    className="w-7 h-7 rounded-full border-1.5 border-black bg-zinc-100 flex items-center justify-center text-black active:scale-95 transition-transform"
                    title="Home"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  </Link>
                </div>

                <h1 className="text-xl font-black text-[#18181B] tracking-tight leading-tight mb-1">
                  Let's get you started
                </h1>
                <p className="text-[11.5px] text-zinc-500 font-medium leading-relaxed mb-3">
                  Create your Shotzi account and value real moments.
                </p>

                {/* Social Login Buttons */}
                <div className="space-y-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocialAuth("google")}
                    disabled={!!socialLoading || loading}
                    className="w-full flex items-center justify-center gap-2.5 py-2 px-3.5 rounded-full border-1.5 border-black bg-white hover:bg-zinc-50 text-xs font-bold text-[#18181B] shadow-[1.5px_1.5px_0px_#000] active:scale-[0.99] transition-all"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    or
                  </span>
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                </div>

                {/* Error Alert */}
                {errorMessage && (
                  <div className="p-2 mb-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Mobile Inputs */}
                <form onSubmit={handleSubmit} className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-0.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2 rounded-full border-1.5 border-black bg-zinc-50/90 focus:bg-white text-xs font-semibold text-black placeholder:text-zinc-400 outline-none transition-all shadow-2xs focus:shadow-[1.5px_1.5px_0px_#000]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-0.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-3.5 pr-9 py-2 rounded-full border-1.5 border-black bg-zinc-50/90 focus:bg-white text-xs font-semibold text-black placeholder:text-zinc-400 outline-none transition-all shadow-2xs focus:shadow-[1.5px_1.5px_0px_#000]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 rounded-full bg-[#FFD21E] text-black font-black text-xs sm:text-sm border-2 border-black shadow-[2.5px_2.5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <span>{loading ? "Creating your corner..." : "Create Account →"}</span>
                  </button>
                </form>

                {/* Mode Switch: Down below the form */}
                <div className="text-center text-xs font-bold text-zinc-600 pt-2.5">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-black text-black underline decoration-1.5 underline-offset-2 hover:text-[#D97706] transition-colors cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
              </div>

              {/* Legal Notice */}
              <div className="pt-2 mt-auto border-t border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                  By continuing, you agree to our{" "}
                  <Link
                    href="/terms"
                    className="font-bold text-black underline decoration-1 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="font-bold text-black underline decoration-1 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            </div>

            {/* ========================================================
                MOBILE BACK FACE: SIGN IN - ROTATED 180 DEG
                ======================================================== */}
            <div
              className="absolute inset-0 w-full rounded-[28px] border-2 sm:border-3 border-black bg-white p-5 sm:p-6 shadow-[5px_5px_0px_#18181B] flex flex-col justify-between [transform:rotateY(180deg)]"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div>
                {/* Mobile Card Header: Clean Back Button */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Link
                    href="/"
                    className="w-7 h-7 rounded-full border-1.5 border-black bg-zinc-100 flex items-center justify-center text-black active:scale-95 transition-transform"
                    title="Home"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  </Link>
                </div>

                <h1 className="text-xl font-black text-[#18181B] tracking-tight leading-tight mb-1">
                  Welcome back
                </h1>
                <p className="text-[11.5px] text-zinc-500 font-medium leading-relaxed mb-3">
                  Enter your details to sign in and reconnect with your people.
                </p>

                {/* Social Login: Google Only */}
                <div className="mb-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocialAuth("google")}
                    disabled={!!socialLoading || loading}
                    className="w-full flex items-center justify-center gap-2.5 py-2 px-3.5 rounded-full border-1.5 border-black bg-white hover:bg-zinc-50 text-xs font-bold text-[#18181B] shadow-[1.5px_1.5px_0px_#000] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    or
                  </span>
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                </div>

                {/* Error Alert */}
                {errorMessage && (
                  <div className="p-2 mb-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Mobile Inputs */}
                <form onSubmit={handleSubmit} className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-black text-black uppercase tracking-wider mb-0.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-3.5 py-2 rounded-full border-1.5 border-black bg-zinc-50/90 focus:bg-white text-xs font-semibold text-black placeholder:text-zinc-400 outline-none transition-all shadow-2xs focus:shadow-[1.5px_1.5px_0px_#000]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] font-black text-black uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotPasswordOpen(true);
                        }}
                        className="text-[11px] font-bold text-zinc-500 hover:text-black hover:underline transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-3.5 pr-9 py-2 rounded-full border-1.5 border-black bg-zinc-50/90 focus:bg-white text-xs font-semibold text-black placeholder:text-zinc-400 outline-none transition-all shadow-2xs focus:shadow-[1.5px_1.5px_0px_#000]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 rounded-full bg-[#FFD21E] text-black font-black text-xs sm:text-sm border-2 border-black shadow-[2.5px_2.5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <span>{loading ? "Signing in..." : "Sign in →"}</span>
                  </button>
                </form>

                {/* Mode Switch: Down below the form */}
                <div className="text-center text-xs font-bold text-zinc-600 pt-2.5">
                  New to Shotzi?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="font-black text-black underline decoration-1.5 underline-offset-2 hover:text-[#D97706] transition-colors cursor-pointer"
                  >
                    Create account
                  </button>
                </div>
              </div>

              {/* Legal Notice */}
              <div className="pt-2 mt-auto border-t border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                  By continuing, you agree to our{" "}
                  <Link
                    href="/terms"
                    className="font-bold text-black underline decoration-1 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="font-bold text-black underline decoration-1 underline-offset-2 hover:text-[#D97706] transition-colors"
                  >
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="text-center text-[10.5px] font-bold text-zinc-500 px-2">
          Capture, share, and connect • A community for real moments
        </div>
      </div>

      {/* ================================================================
      {/* ================================================================
          3. FORGOT PASSWORD MODAL DIALOG WITH 5-MINUTE SMTP OTP & TIMER
          - Graceful 5-minute countdown timer with progress bar
          - 6-digit individual OTP input boxes with auto-focus & paste
          - Password update directly into Supabase Auth
          ================================================================ */}
      <ResetPasswordModal
        isOpen={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        initialEmail={forgotEmail || email}
        onSuccess={async (updatedEmail, updatedPassword) => {
          if (updatedEmail) setEmail(updatedEmail);
          if (updatedPassword) setPassword(updatedPassword);
          switchMode("signin");

          if (updatedEmail && updatedPassword) {
            try {
              const { error } = await supabase.auth.signInWithPassword({
                email: updatedEmail,
                password: updatedPassword,
              });
              if (!error) {
                toast.success("Password updated & signed in! Welcome back.");
                router.replace("/");
                return;
              }
            } catch (loginErr) {
              console.warn("Auto-login deferred to form button:", loginErr);
            }
          }
          toast.success("Password updated in Supabase! You can now sign in.");
        }}
      />

    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FBF9F2]">
          <div className="w-10 h-10 rounded-full border-3 border-black border-t-[#FFD21E] animate-spin" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
