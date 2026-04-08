// ─── Shared helpers for Admin Panel ─────────────────────────────────────────

export const fmt = (n) => (n ?? 0).toLocaleString();

export const Avatar = ({ user, size = "md" }) => {
  const initials = `${user?.fName?.[0] ?? ""}${
    user?.lName?.[0] ?? ""
  }`.toUpperCase();
  const palettes = [
    "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
    "bg-blue-500/20 text-blue-400 ring-blue-500/30",
    "bg-amber-500/20 text-amber-400 ring-amber-500/30",
    "bg-rose-500/20 text-rose-400 ring-rose-500/30",
    "bg-purple-500/20 text-purple-400 ring-purple-500/30",
    "bg-pink-500/20 text-pink-400 ring-pink-500/30",
  ];
  const palette = palettes[(user?.fName?.charCodeAt(0) ?? 0) % palettes.length];
  const sizeClass =
    size === "sm"
      ? "w-7 h-7 text-[10px]"
      : size === "lg"
      ? "w-10 h-10 text-sm"
      : "w-8 h-8 text-xs";

  if (user?.avatar)
    return (
      <img
        src={user.avatar}
        alt={user.fName}
        className={`${sizeClass} rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10 flex-shrink-0`}
      />
    );
  return (
    <div
      className={`${sizeClass} ${palette} rounded-full ring-1 flex items-center justify-center font-medium flex-shrink-0`}
    >
      {initials || "?"}
    </div>
  );
};

export const StatCard = ({ icon: Icon, label, value, colorClass, iconBg }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3.5 dark:bg-gray-900 dark:border-white/[0.06]">
    <div
      className={`w-11 h-11 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}
    >
      <Icon size={18} className={colorClass} />
    </div>
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
        {fmt(value)}
      </p>
    </div>
  </div>
);

export const Spinner = () => (
  <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
);
