export default function Loading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center py-20 text-center space-y-3 animate-in fade-in duration-150">
      <div className="relative inline-flex items-center justify-center">
        <div className="w-9 h-9 border-[3px] border-black border-t-[#FFD21E] rounded-full animate-spin shadow-[2px_2px_0px_#000]" />
      </div>
      <p className="font-black text-xs text-black uppercase tracking-wider">
        Loading...
      </p>
    </div>
  );
}
