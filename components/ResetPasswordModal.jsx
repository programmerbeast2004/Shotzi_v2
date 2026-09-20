"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useToast } from "./Toast";

export default function ResetPasswordModal({
  isOpen,
  onClose,
  initialEmail = "",
  onSuccess,
}) {
  const [step, setStep] = useState("email"); // "email" | "verify" | "success"
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Timer & loading states
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes = 300 seconds
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const toast = useToast();
  const otpInputsRef = useRef([]);

  // Sync initial email when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail || "");
      setStep("email");
      setOtpDigits(["", "", "", "", "", ""]);
      setNewPassword("");
      setConfirmPassword("");
      setErrorMsg("");
      setTimeLeft(300);
    }
  }, [isOpen, initialEmail]);

  // Countdown timer when on verify step
  useEffect(() => {
    let timer;
    if (isOpen && step === "verify" && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, step, timeLeft]);

  if (!isOpen) return null;

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const timerPercent = Math.max(0, Math.min(100, (timeLeft / 300) * 100));
  const isExpired = step === "verify" && timeLeft === 0;

  // Step 1: Send OTP to email
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/reset-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send reset code.");
      }

      toast.success("6-digit verification code sent to your email!");
      setTimeLeft(data.expiresIn || 300);
      setStep("verify");
      setOtpDigits(["", "", "", "", "", ""]);

      // Auto-focus first OTP digit after transition
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    } catch (err) {
      setErrorMsg(err.message || "Failed to send reset code.");
      toast.error(err.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (resending) return;
    setResending(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/reset-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate new code.");
      }

      toast.success("New randomized 6-digit code sent!");
      setTimeLeft(data.expiresIn || 300);
      setOtpDigits(["", "", "", "", "", ""]);

      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err) {
      setErrorMsg(err.message || "Failed to resend code.");
      toast.error(err.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  // Handle OTP digit input
  const handleOtpChange = (index, value) => {
    // Only accept numeric digit
    const cleaned = value.replace(/[^0-9]/g, "");
    if (!cleaned) {
      const copy = [...otpDigits];
      copy[index] = "";
      setOtpDigits(copy);
      return;
    }

    const singleDigit = cleaned.slice(-1);
    const copy = [...otpDigits];
    copy[index] = singleDigit;
    setOtpDigits(copy);

    // Auto-focus next input
    if (index < 5 && singleDigit) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle OTP backspace navigation
  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
    if (pasteData) {
      const digits = pasteData.slice(0, 6).split("");
      const copy = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 6) copy[i] = d;
      });
      setOtpDigits(copy);
      const focusIndex = Math.min(digits.length, 5);
      otpInputsRef.current[focusIndex]?.focus();
    }
  };

  // Step 2: Verify OTP & Update Password
  const handleVerifyAndUpdate = async (e) => {
    e.preventDefault();
    const fullOtp = otpDigits.join("");

    if (fullOtp.length !== 6) {
      setErrorMsg("Please enter all 6 digits of the OTP code.");
      return;
    }

    if (isExpired) {
      setErrorMsg("This OTP code has expired. Please click 'Resend Code' to get a new one.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/reset-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otp: fullOtp,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      toast.success("Password updated successfully!");
      setStep("success");
    } catch (err) {
      setErrorMsg(err.message || "Failed to reset password.");
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    onClose();
    if (onSuccess) {
      onSuccess(email.trim(), newPassword);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white border-[3px] border-black rounded-3xl p-5 sm:p-7 shadow-[8px_8px_0px_#18181B] my-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
              <KeyRound className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-black leading-tight">
                {step === "success"
                  ? "Password Updated!"
                  : step === "verify"
                  ? "Verify & Reset"
                  : "Reset Password"}
              </h3>
              <p className="text-[11px] font-bold text-zinc-500">
                {step === "verify"
                  ? "Enter the 6-digit OTP code"
                  : "Secure account recovery via SMTP"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center hover:bg-zinc-100 transition-colors cursor-pointer shadow-[1.5px_1.5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Global Error Notice */}
        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-50 border-2 border-red-300 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}


        {/* =================================================================
            STEP 1: ENTER EMAIL TO REQUEST OTP
           ================================================================= */}
        {step === "email" && (
          <form onSubmit={handleSendOtp} className="space-y-4 pt-3">
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">
              Enter your account email. We will send a randomized{" "}
              <strong className="text-black font-bold">6-digit verification code</strong>{" "}
              valid for 5 minutes.
            </p>

            <div>
              <label className="block text-[11px] font-black text-black mb-1 uppercase tracking-wide">
                Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border-2 border-black bg-zinc-50 text-xs font-bold text-black placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B] transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-zinc-100 text-xs font-black text-black cursor-pointer shadow-[1.5px_1.5px_0px_#000]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="neo-btn neo-btn-yellow px-5 py-2 text-xs font-black shadow-[2.5px_2.5px_0px_#000] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    Send OTP Code
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* =================================================================
            STEP 2: ENTER OTP & NEW PASSWORD WITH 5-MINUTE COUNTDOWN TIMER
           ================================================================= */}
        {step === "verify" && (
          <form onSubmit={handleVerifyAndUpdate} className="space-y-4 pt-2">
            {/* Email destination pill + Change button */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-100 border border-black/20 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="text-zinc-600">Sent to:</span>
                <strong className="text-black font-bold truncate">{email}</strong>
              </div>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-[11px] font-bold text-zinc-600 hover:text-black hover:underline shrink-0 ml-2"
              >
                Change
              </button>
            </div>

            {/* Graceful 5-Minute Countdown Timer Widget */}
            <div
              className={`p-3 rounded-2xl border-2 border-black transition-all ${
                isExpired
                  ? "bg-red-50"
                  : timeLeft <= 60
                  ? "bg-amber-50"
                  : "bg-[#FFFDEB]"
              } shadow-[2px_2px_0px_#000]`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-black">
                  <Clock
                    className={`w-4 h-4 ${
                      isExpired
                        ? "text-red-600"
                        : timeLeft <= 60
                        ? "text-amber-600 animate-pulse"
                        : "text-black"
                    }`}
                  />
                  <span>
                    {isExpired
                      ? "OTP Expired"
                      : timeLeft <= 60
                      ? "Expiring Soon!"
                      : "Code Valid For"}
                  </span>
                </div>

                <div
                  className={`font-mono text-sm font-black px-2.5 py-0.5 rounded-full border border-black shadow-2xs ${
                    isExpired
                      ? "bg-red-600 text-white"
                      : timeLeft <= 60
                      ? "bg-amber-500 text-black animate-pulse"
                      : "bg-[#FFD21E] text-black"
                  }`}
                >
                  {formatTime(timeLeft)}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden border border-black/20">
                <div
                  className={`h-full transition-all duration-1000 ${
                    isExpired
                      ? "w-0 bg-red-500"
                      : timeLeft <= 60
                      ? "bg-amber-500"
                      : "bg-[#FFD21E]"
                  }`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>

              {isExpired ? (
                <div className="mt-2 text-[11px] text-red-600 font-bold flex items-center justify-between">
                  <span>Code expired after 5 minutes.</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    className="text-[11px] font-black underline text-black hover:text-red-700 cursor-pointer"
                  >
                    {resending ? "Generating..." : "Generate New OTP ⚡"}
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-zinc-500 font-semibold">
                  <span>Expires in 5 minutes</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    className="font-bold text-black hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {resending ? "Sending..." : "Resend code"}
                  </button>
                </div>
              )}
            </div>

            {/* 6-Digit OTP Inputs */}
            <div>
              <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wide">
                Enter 6-Digit Code
              </label>
              <div
                className="grid grid-cols-6 gap-2"
                onPaste={handleOtpPaste}
              >
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    disabled={isExpired}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className={`w-full h-12 text-center font-mono text-xl font-black rounded-xl border-2 border-black bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[2px_2px_0px_#000] transition-all ${
                      isExpired ? "opacity-50 cursor-not-allowed" : ""
                    } ${digit ? "bg-[#FFF9DB]" : ""}`}
                  />
                ))}
              </div>
            </div>

            {/* New Password Inputs */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-black text-black mb-1 uppercase tracking-wide">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-black bg-zinc-50 text-xs font-bold text-black placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black p-0.5 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-black mb-1 uppercase tracking-wide">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-black bg-zinc-50 text-xs font-bold text-black placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[1.5px_1.5px_0px_#18181B]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black p-0.5 cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="mt-1 text-[10.5px] font-bold">
                    {newPassword === confirmPassword ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 inline" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-red-500">Passwords must match</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-zinc-100 text-xs font-black text-black cursor-pointer shadow-[1.5px_1.5px_0px_#000]"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  isExpired ||
                  otpDigits.join("").length !== 6 ||
                  newPassword.length < 6 ||
                  newPassword !== confirmPassword
                }
                className="neo-btn neo-btn-yellow px-5 py-2 text-xs font-black shadow-[2.5px_2.5px_0px_#000] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    Update Password
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* =================================================================
            STEP 3: SUCCESS CELEBRATION
           ================================================================= */}
        {step === "success" && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#FFD21E] border-[3px] border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
              <CheckCircle2 className="w-8 h-8 text-black stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h4 className="font-serif text-2xl font-bold text-black">
                Password Updated!
              </h4>
              <p className="text-xs text-zinc-600 font-medium leading-relaxed max-w-xs mx-auto">
                Your account password has been updated securely. You can now log in
                with your new password.
              </p>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="neo-btn neo-btn-yellow w-full py-3 text-xs font-black shadow-[3px_3px_0px_#000] cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Sign In Now →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
