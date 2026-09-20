import { Bell } from "lucide-react";

export default function NotificationsLoading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center py-20 text-center gap-3 animate-in fade-in duration-150">
      <div className="relative w-12 h-12 bg-[#FFD21E] border-2 border-black rounded-2xl flex items-center justify-center shadow-[3px_3px_0px_#000] animate-bounce">
        <Bell className="w-6 h-6 text-black" />
      </div>
      <p className="font-black text-xs text-black uppercase tracking-wider">
        Loading notifications...
      </p>
    </div>
  );
}
