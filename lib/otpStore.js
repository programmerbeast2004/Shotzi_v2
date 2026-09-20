import fs from "fs";
import path from "path";

const OTP_FILE_PATH = path.join(process.cwd(), "data", "password-resets.json");
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper to safely load store from disk
function loadStore() {
  try {
    if (fs.existsSync(OTP_FILE_PATH)) {
      const content = fs.readFileSync(OTP_FILE_PATH, "utf8");
      return JSON.parse(content || "{}");
    }
  } catch (err) {
    console.error("[OTP Store] Failed to read store:", err);
  }
  return {};
}

// Helper to safely persist store to disk
function saveStore(store) {
  try {
    const dir = path.dirname(OTP_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(OTP_FILE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("[OTP Store] Failed to save store:", err);
  }
}

/**
 * Generate a randomized 6-digit OTP for the given email with 5-minute expiry.
 */
export function createOtp(email) {
  const normEmail = email.trim().toLowerCase();
  const store = loadStore();

  // Clean up any old expired tokens
  const now = Date.now();
  for (const [key, val] of Object.entries(store)) {
    if (val.expiresAt < now) {
      delete store[key];
    }
  }

  // Prevent spamming: enforce 15 second cooldown between OTP requests
  const existing = store[normEmail];
  if (existing && (now - existing.createdAt) < 15000) {
    const waitSecs = Math.ceil((15000 - (now - existing.createdAt)) / 1000);
    return {
      rateLimited: true,
      error: `Please wait ${waitSecs} second${waitSecs === 1 ? "" : "s"} before requesting another code.`,
      expiresIn: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
      expiresAt: existing.expiresAt,
    };
  }

  // Generate randomized 6-digit code
  let newOtp;
  const existingOtp = existing?.otp;
  do {
    newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  } while (newOtp === existingOtp);

  store[normEmail] = {
    otp: newOtp,
    expiresAt: now + OTP_EXPIRY_MS,
    createdAt: now,
    attempts: 0,
  };

  saveStore(store);

  return {
    otp: newOtp,
    expiresIn: 300, // seconds
    expiresAt: store[normEmail].expiresAt,
  };
}

/**
 * Verifies an OTP for the given email.
 */
export function verifyOtp(email, inputOtp) {
  const normEmail = email.trim().toLowerCase();
  const cleanOtp = String(inputOtp || "").trim();
  const store = loadStore();

  const entry = store[normEmail];

  if (!entry) {
    return {
      success: false,
      error: "No active reset request found for this email. Please request a new code.",
      code: "NOT_FOUND",
    };
  }

  const now = Date.now();
  if (now > entry.expiresAt) {
    delete store[normEmail];
    saveStore(store);
    return {
      success: false,
      error: "OTP code has expired. Please request a fresh code.",
      code: "EXPIRED",
    };
  }

  if (entry.attempts >= 5) {
    delete store[normEmail];
    saveStore(store);
    return {
      success: false,
      error: "Too many incorrect attempts. For security, please request a new code.",
      code: "MAX_ATTEMPTS",
    };
  }

  if (entry.otp !== cleanOtp) {
    entry.attempts = (entry.attempts || 0) + 1;
    saveStore(store);
    const remaining = 5 - entry.attempts;
    return {
      success: false,
      error: `Invalid OTP code. Please check your email. (${remaining} attempts remaining)`,
      code: "INVALID_OTP",
      remainingAttempts: remaining,
    };
  }

  // Verified successfully - consume token
  delete store[normEmail];
  saveStore(store);

  return {
    success: true,
  };
}

/**
 * Check remaining seconds for an active OTP request
 */
export function getOtpStatus(email) {
  const normEmail = email.trim().toLowerCase();
  const store = loadStore();
  const entry = store[normEmail];

  if (!entry) return { active: false, remainingSeconds: 0 };

  const diffMs = entry.expiresAt - Date.now();
  if (diffMs <= 0) {
    return { active: false, remainingSeconds: 0 };
  }

  return {
    active: true,
    remainingSeconds: Math.ceil(diffMs / 1000),
  };
}
