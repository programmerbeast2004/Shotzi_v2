"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, getAuthUser } from "../../lib/supabaseClient";
import HomePage from "../page";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    getAuthUser().then((u) => {
      if (!u) {
        router.replace("/auth?mode=signin");
      }
    });
  }, [router]);

  return <HomePage />;
}
