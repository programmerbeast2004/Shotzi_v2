import { Camera } from "lucide-react";

export default function PostLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-20 text-center gap-3 animate-in fade-in duration-150">
      <div className="relative w-12 h-12 bg-accent border-2 border-ink rounded-2xl flex items-center justify-center shadow-[3px_3px_0px_#000] animate-bounce">
        <Camera className="w-6 h-6 text-ink" />
      </div>
      <p className="font-black text-xs text-ink uppercase tracking-wider">
        Loading shot...
      </p>
    </div>
  );
}
