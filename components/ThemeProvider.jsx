"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase, getAuthUser } from "../lib/supabaseClient";

export const THEMES = [
  {
    id: "warm-editorial",
    name: "Warm Editorial",
    palette: "Cream / Plum / Charcoal",
    description: "The default Shotzi atmosphere. Warm paper tones, deep plum accents, and timeless editorial contrast.",
    bg: "#F7F5F0",
    surface: "#FFFFFF",
    accent: "#6B4E71",
    text: "#242321",
    border: "#DDD9D1",
  },
  {
    id: "botanical",
    name: "Botanical",
    palette: "Ivory / Sage / Forest",
    description: "Calm organic tones inspired by morning light, wild eucalyptus, and deep moss.",
    bg: "#F5F6F2",
    surface: "#FFFFFF",
    accent: "#3E5A47",
    text: "#1E2B22",
    border: "#D8DFD7",
  },
  {
    id: "coastal",
    name: "Coastal",
    palette: "Crisp Sand / Ocean / Slate",
    description: "Cool ocean breezes, slate typography, and maritime clarity for wide open perspectives.",
    bg: "#F4F6F8",
    surface: "#FFFFFF",
    accent: "#2A5C7A",
    text: "#1F2937",
    border: "#D8E0E8",
  },
  {
    id: "lavender",
    name: "Lavender Milk",
    palette: "Milk / Lavender / Deep Heather",
    description: "Soft lilac undertones, warm milk surfaces, and contemplative twilight feelings.",
    bg: "#F8F6FA",
    surface: "#FFFFFF",
    accent: "#7B5C96",
    text: "#2B2036",
    border: "#E0D8E8",
  },
  {
    id: "sunset",
    name: "Sunset Paper",
    palette: "Warm Paper / Terracotta / Umber",
    description: "Golden hour warmth, sun-baked terracotta, and intimate late-afternoon glow.",
    bg: "#FAF4EE",
    surface: "#FFFFFF",
    accent: "#B25A38",
    text: "#2E1E16",
    border: "#E4D5C7",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    palette: "Off-White / Pure Black / Charcoal",
    description: "High-contrast minimalist gallery aesthetic where photography commands full focus.",
    bg: "#F6F6F6",
    surface: "#FFFFFF",
    accent: "#111111",
    text: "#111111",
    border: "#DDDDDD",
  },
];

const ThemeContext = createContext({
  theme: "warm-editorial",
  setTheme: () => {},
  themes: THEMES,
  currentTheme: THEMES[0],
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("warm-editorial");
  const [mounted, setMounted] = useState(false);

  // Apply theme to HTML tag immediately
  const applyTheme = (themeId) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", themeId);
    }
  };

  useEffect(() => {
    setMounted(true);
    // 1. Initial cached theme from localStorage
    const saved = localStorage.getItem("shotzi_theme");
    const initialTheme = THEMES.some((t) => t.id === saved) ? saved : "warm-editorial";
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    // 2. Fetch authenticated user's remote preference
    async function loadUserTheme() {
      try {
        const u = await getAuthUser();
        if (!u) return;

        // Check user_metadata first
        const userMetaTheme = u.user_metadata?.theme;
        if (userMetaTheme && THEMES.some((t) => t.id === userMetaTheme)) {
          setThemeState(userMetaTheme);
          applyTheme(userMetaTheme);
          localStorage.setItem("shotzi_theme", userMetaTheme);
          return;
        }

        // Check profiles table
        const { data: prof } = await supabase
          .from("profiles")
          .select("theme")
          .eq("id", u.id)
          .maybeSingle();

        if (prof?.theme && THEMES.some((t) => t.id === prof.theme)) {
          setThemeState(prof.theme);
          applyTheme(prof.theme);
          localStorage.setItem("shotzi_theme", prof.theme);
        }
      } catch (err) {
        // Silently fallback to cached theme
      }
    }

    loadUserTheme();
  }, []);

  const setTheme = async (newThemeId) => {
    if (!THEMES.some((t) => t.id === newThemeId)) return;
    setThemeState(newThemeId);
    applyTheme(newThemeId);
    try {
      localStorage.setItem("shotzi_theme", newThemeId);
    } catch (e) {}

    // Persist to Supabase Auth & Profile in background
    try {
      const u = await getAuthUser();
      if (u) {
        // Update user metadata in Supabase Auth
        await supabase.auth.updateUser({
          data: { theme: newThemeId },
        });

        // Attempt updating profiles table (if theme column exists)
        try {
          await supabase
            .from("profiles")
            .update({ theme: newThemeId })
            .eq("id", u.id);
        } catch (e) {
          // Column might not exist yet, metadata is already saved
        }
      }
    } catch (err) {
      console.warn("Theme sync notice:", err?.message);
    }
  };

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, currentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
