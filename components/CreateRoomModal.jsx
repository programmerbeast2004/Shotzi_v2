"use client";

import { useState } from "react";
import {
  X,
  Globe,
  Lock,
  Sparkles,
  Moon,
  Camera,
  Music,
  Leaf,
  GraduationCap,
  Flame,
  Coffee,
  Palette,
  Heart,
  Image as ImageIcon,
} from "lucide-react";
import { useToast } from "./Toast";
import { authFetch } from "../lib/apiClient";

const ICONS = [
  { id: "globe", label: "Globe", icon: Globe },
  { id: "moon", label: "Moon", icon: Moon },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "music", label: "Music", icon: Music },
  { id: "leaf", label: "Leaf", icon: Leaf },
  { id: "sparkles", label: "Sparkles", icon: Sparkles },
  { id: "heart", label: "Heart", icon: Heart },
  { id: "graduation", label: "College", icon: GraduationCap },
  { id: "flame", label: "Flame", icon: Flame },
  { id: "coffee", label: "Coffee", icon: Coffee },
  { id: "palette", label: "Palette", icon: Palette },
];

export default function CreateRoomModal({ isOpen, onClose, currentUser, onRoomCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("globe");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || loading) return;

    try {
      setLoading(true);
      const res = await authFetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: name.trim(),
          description: description.trim(),
          image_url: imageUrl.trim(),
          icon: selectedIcon,
          is_private: isPrivate,
          creator_id: currentUser?.id,
          creator_username: currentUser?.user_metadata?.username || currentUser?.email?.split("@")[0] || "Curator",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room.");

      toast.success(
        isPrivate
          ? "Private room created! Only you can accept members."
          : "Global public room created!"
      );
      onRoomCreated?.(data.room);
      onClose();
    } catch (error) {
      console.error("Create room error:", error);
      toast.error(error.message || "Could not create room.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#FAF7F0] border-2 border-black rounded-3xl shadow-[6px_6px_0px_#18181B] p-6 max-h-[90vh] overflow-y-auto soft-scroll">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#18181B]">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-black text-xl text-black">Create a Room</h2>
              <p className="text-xs text-zinc-600 font-medium">
                Set up a new space with custom permissions & picture
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full border-2 border-black bg-white hover:bg-zinc-100 transition-colors shadow-[1.5px_1.5px_0px_#18181B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Room Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Room Name *
            </label>
            <input
              type="text"
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vintage Camera Club"
              className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[2px_2px_0px_#18181B]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Description / Rules
            </label>
            <textarea
              rows={2}
              maxLength={140}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this room about?"
              className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[2px_2px_0px_#18181B] resize-none"
            />
          </div>

          {/* Picture URL (User requested) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Room Picture URL (optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... or any image URL"
                className="flex-1 px-3.5 py-2 rounded-xl border-2 border-black bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD21E] shadow-[2px_2px_0px_#18181B]"
              />
              {imageUrl.trim() && (
                <div className="w-10 h-10 rounded-xl border-2 border-black overflow-hidden shrink-0 shadow-[1px_1px_0px_#18181B]">
                  <img
                    src={imageUrl}
                    alt="preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 block">
              Give an image URL for your room banner/icon.
            </span>
          </div>

          {/* Icon Selector (Fallback if no picture URL) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Fallback Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    className={`p-2 rounded-xl border-2 transition-all flex items-center ${
                      isSelected
                        ? "bg-[#FFD21E] border-black text-black shadow-[2px_2px_0px_#18181B] scale-105"
                        : "bg-white border-black/30 hover:border-black text-zinc-700"
                    }`}
                    title={item.label}
                  >
                    <IconComponent className="w-4 h-4 stroke-[2]" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group Type Selector */}
          <div className="pt-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Group Access Option
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Global / Public */}
              <div
                onClick={() => setIsPrivate(false)}
                className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                  !isPrivate
                    ? "bg-[#FFD21E]/30 border-black shadow-[2px_2px_0px_#18181B]"
                    : "bg-white border-black/20 hover:border-black/60"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Globe className="w-4 h-4 text-black" />
                  <span className="font-black text-xs text-black">Global Public</span>
                </div>
                <p className="text-[10px] text-zinc-600 font-medium leading-tight">
                  Anyone on Shotzi can see this room, join, and post.
                </p>
              </div>

              {/* Option 2: Creator-Managed Private */}
              <div
                onClick={() => setIsPrivate(true)}
                className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                  isPrivate
                    ? "bg-[#FF5376]/20 border-black shadow-[2px_2px_0px_#18181B]"
                    : "bg-white border-black/20 hover:border-black/60"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Lock className="w-4 h-4 text-black" />
                  <span className="font-black text-xs text-black">Private / Approval</span>
                </div>
                <p className="text-[10px] text-zinc-600 font-medium leading-tight">
                  Only <strong>you</strong> (the group creator) can accept new people.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t-2 border-black/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-full border-2 border-black bg-white hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_#18181B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="neo-btn neo-btn-yellow px-5 py-2 text-xs font-black text-black shadow-[2px_2px_0px_#18181B] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
