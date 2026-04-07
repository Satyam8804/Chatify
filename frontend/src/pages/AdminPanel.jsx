import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/authContext";
import { useTheme } from "../context/themeContext";
import api from "../api/axios";
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  LogOut,
  Search,
  Ban,
  Trash2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  UserCheck,
  Phone,
  Clock,
  PhoneMissed,
  PhoneOff,
  Wifi,
  Scale,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import AdminAppeals from "./AdminAppeals";

const fmt = (n) => (n ?? 0).toLocaleString();

// ─── Theme Toggle ────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const current =
    THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[2];
  const Icon = current.icon;

  const cycle = () => {
    const idx = THEME_OPTIONS.findIndex((o) => o.value === theme);
    const next = THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length];
    setTheme(next.value);
  };

  return (
    <button
      onClick={cycle}
      title={`Theme: ${current.label} — click to cycle`}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-white/[0.04] transition-colors"
    >
      <Icon size={14} />
      <span className="text-xs">{current.label}</span>
    </button>
  );
};

// ─── Shared primitives ───────────────────────────────────────────────────────

const Avatar = ({ user, size = "md" }) => {
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

const StatCard = ({ icon: Icon, label, value, colorClass, iconBg }) => (
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

const Badge = ({ children, variant = "gray" }) => {
  const variants = {
    green:
      "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
    blue: "bg-blue-500/15 text-blue-600 ring-blue-500/25 dark:text-blue-400",
    amber:
      "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-400",
    red: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-400",
    purple:
      "bg-purple-500/15 text-purple-600 ring-purple-500/25 dark:text-purple-400",
    gray: "bg-gray-100 text-gray-500 ring-gray-200 dark:bg-white/5 dark:text-gray-400 dark:ring-white/10",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-[0.5px] ${variants[variant]}`}
    >
      {children}
    </span>
  );
};

const Spinner = () => (
  <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
);

const Pagination = ({ page, totalPages, onPrev, onNext }) => (
  <div className="flex items-center justify-center gap-2">
    <button
      onClick={onPrev}
      disabled={page === 1}
      className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-opacity dark:bg-gray-900 dark:border-white/[0.06] dark:text-gray-400 dark:hover:text-white"
    >
      <ChevronLeft size={15} />
    </button>
    <span className="text-xs text-gray-500">
      Page {page} of {totalPages}
    </span>
    <button
      onClick={onNext}
      disabled={page === totalPages}
      className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-opacity dark:bg-gray-900 dark:border-white/[0.06] dark:text-gray-400 dark:hover:text-white"
    >
      <ChevronRight size={15} />
    </button>
  </div>
);

// ─── Dashboard ───────────────────────────────────────────────────────────────

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/stats")
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );

  const maxMsg = Math.max(
    ...(stats?.messageActivity?.map((d) => d.messages) ?? [1]),
    1
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Overview of your Chatify app
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Total users"
          value={stats?.totalUsers}
          colorClass="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          icon={UserCheck}
          label="Online now"
          value={stats?.activeUsers}
          colorClass="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          icon={MessageSquare}
          label="Messages today"
          value={stats?.messagesToday}
          colorClass="text-amber-400"
          iconBg="bg-amber-500/10"
        />
        <StatCard
          icon={Phone}
          label="Calls today"
          value={stats?.callsToday}
          colorClass="text-purple-400"
          iconBg="bg-purple-500/10"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-gray-900 dark:border-white/[0.06]">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={15} className="text-emerald-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Message activity — last 7 days
          </span>
        </div>
        <div className="flex items-end gap-2 h-28">
          {stats?.messageActivity?.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-gray-400">{d.messages}</span>
              <div
                className="w-full rounded bg-emerald-500 transition-all duration-300"
                style={{
                  height: `${Math.max(4, (d.messages / maxMsg) * 88)}px`,
                  opacity: 0.5 + i / (stats.messageActivity.length * 1.5),
                }}
              />
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                {d.date.split(",")[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={PhoneCall}
          label="Total calls"
          value={stats?.totalCalls}
          colorClass="text-pink-400"
          iconBg="bg-pink-500/10"
        />
        <StatCard
          icon={Ban}
          label="Banned users"
          value={stats?.bannedUsers}
          colorClass="text-rose-400"
          iconBg="bg-rose-500/10"
        />
        <StatCard
          icon={MessageSquare}
          label="Total chats"
          value={stats?.totalChats}
          colorClass="text-indigo-400"
          iconBg="bg-indigo-500/10"
        />
      </div>
    </div>
  );
};

// ─── Users ───────────────────────────────────────────────────────────────────

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const fetchUsers = useCallback(
    async (p = 1, q = search) => {
      setLoading(true);
      try {
        const r = await api.get(
          `/admin/users?page=${p}&limit=15&search=${encodeURIComponent(q)}`
        );
        setUsers(r.data.users);
        setTotal(r.data.total);
        setTotalPages(r.data.totalPages);
        setPage(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    fetchUsers(1, "");
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1, search);
  };

  const handleBan = async (u) => {
    setActionId(u._id);
    try {
      if (u.isBanned) await api.patch(`/admin/users/${u._id}/unban`);
      else
        await api.patch(`/admin/users/${u._id}/ban`, {
          reason: "Admin action",
        });
      fetchUsers(page, search);
    } catch (e) {
      console.error(e);
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user permanently?")) return;
    setActionId(id);
    try {
      await api.delete(`/admin/users/${id}`);
      fetchUsers(page, search);
    } catch (e) {
      console.error(e);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Users
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {fmt(total)} total users
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="h-9 pl-8 pr-3 rounded-lg text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-500/50 w-52 transition-colors dark:bg-gray-900 dark:border-white/[0.08] dark:text-white dark:placeholder-gray-600"
            />
          </div>
          <button
            type="submit"
            className="h-9 px-4 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden dark:bg-gray-900 dark:border-white/[0.06]">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center py-12 text-sm text-gray-500">
            No users found
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                  {[
                    "User",
                    "Email",
                    "Provider",
                    "Status",
                    "Joined",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u._id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors dark:border-white/[0.04] dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar user={u} size="sm" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {u.fName} {u.lName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={u.authProvider === "google" ? "blue" : "green"}
                      >
                        {u.authProvider}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.isBanned ? (
                        <Badge variant="red">Banned</Badge>
                      ) : u.isOnline ? (
                        <Badge variant="green">Online</Badge>
                      ) : (
                        <Badge variant="gray">Offline</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleBan(u)}
                          disabled={actionId === u._id}
                          title={u.isBanned ? "Unban" : "Ban"}
                          className={`w-7 h-7 rounded-md flex items-center justify-center ring-[0.5px] transition-opacity disabled:opacity-40 ${
                            u.isBanned
                              ? "bg-emerald-500/10 ring-emerald-500/25 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-rose-500/10 ring-rose-500/25 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                          }`}
                        >
                          {u.isBanned ? (
                            <CheckCircle size={13} />
                          ) : (
                            <Ban size={13} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(u._id)}
                          disabled={actionId === u._id}
                          title="Delete user"
                          className="w-7 h-7 rounded-md flex items-center justify-center ring-[0.5px] bg-rose-500/10 ring-rose-500/25 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 transition-opacity disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => fetchUsers(page - 1)}
          onNext={() => fetchUsers(page + 1)}
        />
      )}
    </div>
  );
};

// ─── Call Analytics ──────────────────────────────────────────────────────────

const CallAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/call-analytics")
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );

  const fmtDuration = (secs) => {
    if (!secs) return "0s";
    const m = Math.floor(secs / 60),
      s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const maxBar = Math.max(
    ...(data?.dailyActivity?.map((d) => d.total) ?? [1]),
    1
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Call analytics
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Insights across all calls in your app
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={PhoneCall}
          label="Total calls"
          value={data?.total}
          colorClass="text-purple-400"
          iconBg="bg-purple-500/10"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed"
          value={data?.completed}
          colorClass="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          icon={PhoneMissed}
          label="Missed"
          value={data?.missed}
          colorClass="text-rose-400"
          iconBg="bg-rose-500/10"
        />
        <StatCard
          icon={PhoneOff}
          label="Rejected"
          value={data?.rejected}
          colorClass="text-amber-400"
          iconBg="bg-amber-500/10"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Connection rate */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2 lg:col-span-1 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Wifi size={14} className="text-emerald-400" />
            <span className="text-xs text-gray-500">Connection rate</span>
          </div>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
            {data?.connectionRate}
            <span className="text-lg text-gray-400 ml-0.5">%</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${data?.connectionRate}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            of calls successfully connected
          </p>
        </div>

        {/* Avg duration */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-blue-400" />
            <span className="text-xs text-gray-500">Avg duration</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {fmtDuration(data?.avgDuration)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">per completed call</p>
        </div>

        {/* Avg per day */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-amber-400" />
            <span className="text-xs text-gray-500">Avg calls / day</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {data?.avgCallsPerDay}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">last 14 days</p>
        </div>

        {/* Peak hour */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Phone size={14} className="text-pink-400" />
            <span className="text-xs text-gray-500">Peak hour</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {data?.peakHour}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">most calls made</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Type breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-gray-900 dark:border-white/[0.06]">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Call types
          </p>
          <div className="flex flex-col gap-4">
            {[
              {
                label: "Video calls",
                value: data?.video,
                total: data?.total,
                color: "bg-purple-500",
              },
              {
                label: "Audio calls",
                value: data?.audio,
                total: data?.total,
                color: "bg-blue-500",
              },
            ].map(({ label, value, total, color }) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {fmt(value)}{" "}
                      <span className="text-gray-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="border-t border-gray-100 dark:border-white/[0.06] pt-3 mt-1">
              <p className="text-xs text-gray-400 mb-3">By outcome</p>
              {[
                {
                  label: "Completed",
                  value: data?.completed,
                  color: "bg-emerald-500",
                },
                { label: "Missed", value: data?.missed, color: "bg-rose-500" },
                {
                  label: "Rejected",
                  value: data?.rejected,
                  color: "bg-amber-500",
                },
              ].map(({ label, value, color }) => {
                const pct =
                  data?.total > 0 ? Math.round((value / data.total) * 100) : 0;
                return (
                  <div key={label} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Daily activity chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={15} className="text-purple-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Call activity — last 14 days
            </span>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-[10px] text-gray-400">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-gray-400">Completed</span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {data?.dailyActivity?.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full flex flex-col justify-end gap-0.5"
                  style={{ height: 96 }}
                >
                  <div
                    className="w-full rounded-sm bg-purple-500/40 transition-all"
                    style={{
                      height: `${Math.max(2, (d.total / maxBar) * 96)}px`,
                    }}
                  />
                  <div
                    className="w-full rounded-sm bg-emerald-500 transition-all relative"
                    style={{
                      height: `${Math.max(2, (d.completed / maxBar) * 96)}px`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-gray-400 whitespace-nowrap">
                  {d.date.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Shell ───────────────────────────────────────────────────────────────────

const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "calls", label: "Call analytics", icon: PhoneCall },
  { id: "appeals", label: "Users Appeals", icon: Scale },
];

const AdminPanel = () => {
  const [activePage, setActivePage] = useState("dashboard");
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col dark:bg-gray-900 dark:border-white/[0.06]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200 dark:border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <LayoutDashboard size={15} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">
              Chatify
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Admin panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 flex flex-col gap-0.5">
          {PAGES.map(({ id, label, icon: Icon }) => {
            const active = activePage === id;
            return (
              <button
                key={id}
                onClick={() => setActivePage(id)}
                className={`cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left ${
                  active
                    ? "bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Bottom: theme + user + logout */}
        <div className="border-t border-gray-200 dark:border-white/[0.06] p-2">
          {/* Theme toggle */}
          <ThemeToggle />

          <div className="flex items-center gap-2 px-2 py-2 mt-1 mb-1">
            <Avatar user={user} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {user?.fName} {user?.lName}
              </p>
              <p className="text-[10px] text-emerald-500">Admin</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-white/[0.04] transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {activePage === "dashboard" && <Dashboard />}
        {activePage === "users" && <UsersPage />}
        {activePage === "calls" && <CallAnalytics />}
        {activePage === "appeals" && <AdminAppeals />}
      </main>
    </div>
  );
};

export default AdminPanel;
