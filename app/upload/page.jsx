"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Image as ImageIcon, X, Sparkles, ArrowRight, Camera } from "lucide-react";
import { supabase, getAuthUser } from "../../lib/supabaseClient";
import { useAuthDrawer } from "../../components/AuthDrawer";
import { useToast } from "../../components/Toast";
import { isAdmin } from "../../lib/admin";

export default function UploadPage() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);
  const router = useRouter();
  const { openAuth } = useAuthDrawer();
  const toast = useToast();

  useEffect(() => {
    let ignore = false;
    async function load(providedUser = null) {
      let u = providedUser;
      if (!u) {
        u = await getAuthUser();
      }
      if (!ignore) {
        setUser(u);
        setLoadingUser(false);
      }
    }
    load();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        load(session.user);
      } else {
        load();
      }
    });

    return () => {
      ignore = true;
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  const handleSelectedFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Please choose a valid image file.");
      return;
    }
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    handleSelectedFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    handleSelectedFile(dropped);
  };

  const clearSelection = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      openAuth("signin");
      return;
    }
    if (!file) {
      toast.warning("Please select an image first.");
      return;
    }

    try {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { data: storageData, error: storageErr } = await supabase.storage
        .from("shots")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (storageErr) {
        console.error(storageErr);
        toast.error("Upload failed: " + (storageErr.message || "Storage error"));
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("shots").getPublicUrl(storageData.path);

      // Ensure profile
      try {
        const { data: existingProf } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!existingProf) {
          const username =
            user.user_metadata?.username ||
            user.email?.split("@")[0] ||
            `user_${user.id.slice(0, 6)}`;
          const displayName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            username;
          const avatarUrl = user.user_metadata?.avatar_url || null;

          await supabase.from("profiles").insert({
            id: user.id,
            username,
            display_name: displayName,
            avatar_url: avatarUrl,
            bio: "",
          });
        }
      } catch (e) {}

      // If administrator, publish directly to live feed with zero delay!
      if (isAdmin(user)) {
        const { error: liveErr } = await supabase.from("posts").insert({
          image_url: publicUrl,
          caption: caption.trim() || null,
          user_id: user.id,
          user_email: user.email,
        });

        if (!liveErr) {
          // Record in pending_posts as approved for auditing
          await supabase.from("pending_posts").insert({
            image_url: publicUrl,
            caption: caption.trim() || null,
            user_id: user.id,
            user_email: user.email,
            status: "approved",
          }).catch(() => null);

          setCaption("");
          clearSelection();
          toast.success("Shot published directly to the live feed!");
          router.push("/");
          return;
        }
        console.warn("Direct admin insert error, falling back to moderation queue:", liveErr);
      }

      // Insert pending post for regular users
      const { error: insertErr } = await supabase.from("pending_posts").insert({
        image_url: publicUrl,
        caption: caption.trim() || null,
        user_id: user.id,
        user_email: user.email,
        status: "pending",
      });

      if (insertErr) {
        console.error(insertErr);
        toast.error("Failed to submit shot for moderation.");
        setUploading(false);
        return;
      }

      setCaption("");
      clearSelection();
      toast.success("Shot submitted! It will appear on the feed once reviewed.");
      router.push("/");
    } catch (err) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-[3px] border-black border-t-[#FFD21E] rounded-full animate-spin" />
        <p className="font-black text-sm text-black uppercase tracking-wider">Loading your corner...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="rounded-3xl border-[2.5px] border-black bg-white p-8 shadow-[6px_6px_0px_#18181B] space-y-4">
          <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border-2 border-black mb-3">
            <img
              src="/illustrations/community_crew.jpg"
              alt="Join the community"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-3xl font-black text-black">
            Join the Squad
          </h2>
          <p className="text-xs text-zinc-600 font-medium">
            Sign in to dump a shot. Turn your quiet moments, streets, and sunsets into a living community gallery.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className="neo-btn neo-btn-yellow px-7 py-3 text-xs font-black w-full"
            >
              <span>Sign in to dump</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-8 space-y-6">
      {/* Title & guidance */}
      <div className="space-y-1 text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD21E] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#18181B]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>NEW MOMENT</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-black tracking-tight">
          Dump a new shot
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 font-bold">
          Share a moment, place, or tiny detail that made you pause. Atmosphere over perfection.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white border-[2.5px] border-black rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_#18181B] space-y-6">
        {/* DROPZONE */}
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase tracking-wider text-zinc-700">
            VISUAL SNAPSHOT
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
          />

          {!previewUrl ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed border-black rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "bg-[#FFFDE5] scale-[1.01]"
                  : "bg-zinc-50 hover:bg-[#FFFDF0]"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#FFD21E] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#18181B]">
                <UploadCloud className="w-7 h-7 stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-black">
                  Drop an image here, or <span className="underline decoration-2">browse files</span>
                </p>
                <p className="text-xs text-zinc-500 font-bold">
                  JPEG, PNG, WEBP up to 10MB
                </p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border-2 border-black bg-zinc-100 group">
              <img
                src={previewUrl}
                alt="Upload preview"
                className="w-full max-h-96 object-contain rounded-2xl"
              />
              <button
                type="button"
                onClick={clearSelection}
                className="absolute top-3 right-3 p-2 rounded-full bg-white text-black hover:bg-red-500 hover:text-white border-2 border-black shadow-[2px_2px_0px_#18181B] transition-colors"
                title="Remove image"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
              <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-white text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#18181B]">
                {file?.name}
              </div>
            </div>
          )}
        </div>

        {/* CAPTION */}
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase tracking-wider text-zinc-700">
            CAPTION & ATMOSPHERE
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="What made you stop and look? Tell us the feeling..."
            className="w-full p-3.5 rounded-2xl border-2 border-black bg-zinc-50 text-black text-xs sm:text-sm font-bold focus:bg-white focus:outline-none transition-all resize-none shadow-[2px_2px_0px_#18181B]"
          />
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-2 flex items-center justify-between">
          <p className="text-xs text-zinc-500 font-bold hidden sm:block">
            Reviewed by curators before appearing in live feed.
          </p>

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full sm:w-auto neo-btn neo-btn-yellow px-8 py-3.5 text-xs sm:text-sm font-black disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0px_#18181B]"
          >
            {uploading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Publishing shot...</span>
              </>
            ) : (
              <>
                <span>Publish shot</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
