"use client";

import { useEffect, useState } from "react";
import { supabase, getAuthUser } from "../lib/supabaseClient";
import { isAdmin } from "../lib/admin";
import { Check, X, ShieldAlert } from "lucide-react";

export default function AdminNotifier() {
  const [user, setUser] = useState(null);
  const [queue, setQueue] = useState([]); // pending posts to review

  useEffect(() => {
    let ignore = false;
    async function loadUser(providedUser = null) {
      const u = providedUser || (await getAuthUser());
      if (!ignore) setUser(u);
    }
    loadUser();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user);
      } else {
        loadUser();
      }
    });

    return () => {
      ignore = true;
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !isAdmin(user)) return;

    const ch = supabase
      .channel("admin_pending_posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_posts" },
        (payload) => {
          try {
            const evt = payload.eventType || payload.event;
            const newRow = payload.new || payload.record || null;
            const oldRow = payload.old || null;

            if (evt === "INSERT") {
              if (newRow?.status === "pending") {
                setQueue((q) => [newRow, ...q]);
              }
            } else if (evt === "UPDATE") {
              if (oldRow?.status === "pending" && newRow?.status !== "pending") {
                setQueue((q) => q.filter((p) => p.id !== newRow.id));
              }
              if (newRow?.status === "pending") {
                setQueue((q) => [newRow, ...q.filter((p) => p.id !== newRow.id)]);
              }
            } else if (evt === "DELETE") {
              const rec = payload.old || null;
              if (rec) setQueue((q) => q.filter((p) => p.id !== rec.id));
            }
          } catch (err) {
            console.error("AdminNotifier payload error:", err);
          }
        }
      )
      .subscribe();

    (async () => {
      const { data } = await supabase
        .from("pending_posts")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      setQueue(data || []);
    })();

    return () => {
      ch.unsubscribe();
    };
  }, [user]);

  const approve = async (post) => {
    try {
      const { error: insertErr } = await supabase.from("posts").insert({
        image_url: post.image_url,
        caption: post.caption,
        user_id: post.user_id,
        user_email: post.user_email,
      });
      if (insertErr) throw insertErr;

      await supabase.from("pending_posts").update({ status: "approved" }).eq("id", post.id);

      await supabase.from("notifications").insert({
        user_id: post.user_id,
        message: "Your post has been approved and published!",
        read: false,
      });

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "shotzi_notification_update",
            JSON.stringify({ userId: post.user_id, ts: Date.now() })
          );
        }
      } catch (err) {}

      setQueue((q) => q.filter((p) => p.id !== post.id));
    } catch (err) {
      console.error("Admin approve error:", err);
    }
  };

  const reject = async (post) => {
    try {
      await supabase.from("pending_posts").update({ status: "rejected" }).eq("id", post.id);

      await supabase.from("notifications").insert({
        user_id: post.user_id,
        message: "Your post was rejected.",
        read: false,
      });

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "shotzi_notification_update",
            JSON.stringify({ userId: post.user_id, ts: Date.now() })
          );
        }
      } catch (err) {}

      setQueue((q) => q.filter((p) => p.id !== post.id));
    } catch (err) {
      console.error("Admin reject error:", err);
    }
  };

  if (!user || !isAdmin(user)) return null;
  if (queue.length === 0) return null;

  return (
    <div aria-live="polite" className="fixed top-20 right-4 z-50 space-y-3 max-w-sm w-full">
      {queue.slice(0, 3).map((p) => (
        <div
          key={p.id}
          className="bg-surface border border-border rounded-2xl p-3.5 shadow-xl animate-slide-in flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="flex items-center gap-1 font-medium text-accent">
              <ShieldAlert className="w-3.5 h-3.5" /> Moderation Alert
            </span>
            <button
              onClick={() => setQueue((q) => q.filter((x) => x.id !== p.id))}
              className="text-ink-muted hover:text-ink p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-3 items-start">
            <img
              src={p.image_url}
              alt="pending"
              className="w-16 h-16 object-cover rounded-xl border border-border shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink font-medium line-clamp-2 leading-relaxed">
                {p.caption || "(no caption)"}
              </p>
              <p className="text-[11px] text-ink-muted mt-1 truncate">
                By: {p.user_email}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
            <button
              onClick={() => reject(p)}
              className="px-2.5 py-1 rounded-lg border border-danger/30 text-danger text-xs hover:bg-danger-soft transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => approve(p)}
              className="px-3 py-1 rounded-lg bg-success text-white text-xs hover:opacity-90 transition-opacity font-medium"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
