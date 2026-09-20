"use client";

import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Lock, Mail, Sparkles, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ResetPasswordModal from "./ResetPasswordModal";
import { THEMES, useTheme } from "./ThemeProvider";
import { useToast } from "./Toast";

const AuthDrawerContext = createContext(null);

export function AuthDrawerProvider({ children }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const toast = useToast();

  const openAuth = useCallback((initialMode = "signin") => {
    const targetMode = initialMode === "signup" ? "signup" : "signin";
    router.push(`/auth?mode=${targetMode}`);
  }, [router]);

  const closeAuth = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AuthDrawerContext.Provider value={{ isOpen, mode, openAuth, closeAuth, setMode, setIsOpen }}>
      {children}
      <AuthDrawer isOpen={isOpen} mode={mode} onClose={closeAuth} setMode={setMode} />
    </AuthDrawerContext.Provider>
  );
}

export function useAuthDrawer() {
  const ctx = useContext(AuthDrawerContext);
  if (!ctx) {
    return {
      isOpen: false,
      mode: "signin",
      openAuth: () => {},
      closeAuth: () => {},
      setMode: () => {},
    };
  }
  return ctx;
}

function AuthDrawer({ isOpen, mode, onClose, setMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const { currentTheme, setTheme } = useTheme();
  const toast = useToast();

  // Reset errors and fields on open/mode switch
  useEffect(() => {
    setErrorMessage("");
    setSuccessMessage("");
  }, [mode, isOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.href : undefined,
        },
      });
      if (error) throw error;
    } catch (err) {
      setErrorMessage(err.message || "Failed to initiate Google sign-in.");
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please fill in both email and password.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      toast.success("Welcome back to Shotzi!");
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const cleanUsername = (username || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9_]/g, "");
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanUsername,
            name: username || cleanUsername,
          },
        },
      });
      if (error) throw error;

      // If user profile needs to be created or updated
      if (data?.user) {
        try {
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              username: cleanUsername,
              display_name: username || cleanUsername,
            },
            { onConflict: "id" }
          );
        } catch (profileErr) {
          console.warn("Profile creation deferred to trigger:", profileErr);
        }
      }

      toast.success("Account created successfully!");
      // Proceed to optional theme selection step
      setMode("theme");
    } catch (err) {
      setErrorMessage(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-[480px] h-full bg-surface text-ink border-l border-border shadow-2xl flex flex-col justify-between overflow-y-auto z-10 animate-slide-left">
        {/* Top bar with close button */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/shotzi-logo-clean.png"
              alt="Shotzi"
              className="h-7 w-auto object-contain"
            />
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFD21E] text-black border border-black shadow-2xs">
              Community
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-soft transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
          {mode === "signin" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-3xl md:text-4xl text-ink font-normal leading-tight">
                  Sign in
                </h2>
                <p className="text-sm text-ink-secondary mt-2">
                  Welcome back to your little corner of the internet.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl border border-danger/30 bg-danger-soft text-danger text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{errorMessage}</span>
                </div>
              )}

              {/* Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-12 rounded-xl border border-border hover:border-ink/40 bg-surface-soft hover:bg-surface text-ink font-medium text-sm flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                Continue with Google
              </button>

              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-border w-full" />
                <span className="bg-surface px-3 text-xs uppercase tracking-wider text-ink-muted absolute">
                  or with email
                </span>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5 uppercase tracking-wide">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-surface-soft focus:bg-surface text-ink text-sm focus:border-accent focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wide">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotPasswordOpen(true)}
                      className="text-xs text-accent font-medium hover:underline transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-10 rounded-xl border border-border bg-surface-soft focus:bg-surface text-ink text-sm focus:border-accent focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-ink-muted hover:text-ink p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all duration-200 shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-2">
                <p className="text-sm text-ink-secondary">
                  Don’t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-accent font-medium hover:underline transition-colors ml-1"
                  >
                    Create one
                  </button>
                </p>
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-3xl md:text-4xl text-ink font-normal leading-tight">
                  Create your Shotzi
                </h2>
                <p className="text-sm text-ink-secondary mt-2">
                  Share moments, places, and tiny details that make you pause.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl border border-danger/30 bg-danger-soft text-danger text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{errorMessage}</span>
                </div>
              )}

              {/* Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-12 rounded-xl border border-border hover:border-ink/40 bg-surface-soft hover:bg-surface text-ink font-medium text-sm flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                Sign up with Google
              </button>

              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-border w-full" />
                <span className="bg-surface px-3 text-xs uppercase tracking-wider text-ink-muted absolute">
                  or with email
                </span>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5 uppercase tracking-wide">
                    Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. wanderer"
                      className="w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-surface-soft focus:bg-surface text-ink text-sm focus:border-accent focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5 uppercase tracking-wide">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-surface-soft focus:bg-surface text-ink text-sm focus:border-accent focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5 uppercase tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full h-11 pl-10 pr-10 rounded-xl border border-border bg-surface-soft focus:bg-surface text-ink text-sm focus:border-accent focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-ink-muted hover:text-ink p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all duration-200 shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-2">
                <p className="text-sm text-ink-secondary">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-accent font-medium hover:underline transition-colors ml-1"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          )}

          {mode === "theme" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-soft text-success text-xs font-medium mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> Account created
                </div>
                <h2 className="font-serif text-3xl text-ink font-normal leading-tight">
                  Choose your Shotzi
                </h2>
                <p className="text-sm text-ink-secondary mt-1">
                  Pick your initial atmosphere. You can change this anytime.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {THEMES.map((t) => {
                  const isSelected = currentTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-accent ring-2 ring-accent/20 bg-surface shadow-xs"
                          : "border-border bg-surface-soft hover:bg-surface"
                      }`}
                    >
                      <div
                        className="w-full h-8 rounded-lg mb-2 flex items-center justify-between px-2"
                        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: t.accent }}
                        />
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                      </div>
                      <div className="font-medium text-xs text-ink truncate">{t.name}</div>
                      <div className="text-[10px] text-ink-muted truncate">{t.palette}</div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2"
              >
                Enter Shotzi
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/60 text-xs text-ink-muted flex items-center justify-between">
          <span>“A soft place for loud feelings.”</span>
          <span className="font-mono text-[11px]">v2.0</span>
        </div>
      </div>

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        initialEmail={email}
        onSuccess={async (updatedEmail, updatedPassword) => {
          if (updatedEmail) setEmail(updatedEmail);
          if (updatedPassword) setPassword(updatedPassword);
          setMode("signin");

          if (updatedEmail && updatedPassword) {
            try {
              const { error } = await supabase.auth.signInWithPassword({
                email: updatedEmail,
                password: updatedPassword,
              });
              if (!error) {
                toast.success("Password updated & signed in! Welcome back.");
                onClose();
                return;
              }
            } catch (loginErr) {
              console.warn("Auto-login deferred:", loginErr);
            }
          }
          toast.success("Password updated in Supabase! Please sign in.");
        }}
      />
    </div>
  );
}
