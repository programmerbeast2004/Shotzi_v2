/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "-apple-system", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
      },
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          soft: "var(--surface-soft)",
          card: "var(--surface-card)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          soft: "var(--primary-soft)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
        },
        ink: {
          DEFAULT: "var(--text)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        border: {
          DEFAULT: "var(--border)",
          light: "var(--border-light)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          hover: "var(--danger-hover)",
          soft: "var(--danger-soft)",
        },
        success: {
          DEFAULT: "var(--success)",
          soft: "var(--success-soft)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          soft: "var(--warning-soft)",
        },
      },
      borderRadius: {
        "sm": "6px",
        "md": "10px",
        "lg": "14px",
        "xl": "16px",
        "2xl": "20px",
        "3xl": "24px",
        "pill": "999px",
      },
      boxShadow: {
        "subtle": "0 1px 3px rgba(36, 35, 33, 0.05), 0 1px 2px rgba(36, 35, 33, 0.03)",
        "card": "0 2px 8px rgba(36, 35, 33, 0.04), 0 1px 3px rgba(36, 35, 33, 0.02)",
        "hover": "0 8px 24px rgba(36, 35, 33, 0.07), 0 3px 8px rgba(36, 35, 33, 0.03)",
        "modal": "0 20px 48px rgba(36, 35, 33, 0.15), 0 8px 16px rgba(36, 35, 33, 0.06)",
      },
    },
  },
  plugins: [],
};
