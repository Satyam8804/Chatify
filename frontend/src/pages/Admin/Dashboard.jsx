import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import { StatCard, Spinner } from "./AdminHelper.jsx";
import {
  Users,
  UserCheck,
  MessageSquare,
  Phone,
  PhoneCall,
  Ban,
  TrendingUp,
} from "lucide-react";
import { useSocket } from "../../context/socketContext.jsx";

const REFRESH_INTERVAL = 30_000;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const { onlineUser } = useSocket();

  // ─── FETCH STATS ─────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const r = await api.get("/admin/stats");
      setStats(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── INITIAL LOAD + POLLING ──────────────
  useEffect(() => {
    fetchStats();

    const interval = setInterval(fetchStats, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

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
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Overview of your Chatify app
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live · refreshes every 30s
        </div>
      </div>

      {/* STATS */}
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
          value={onlineUser.size} // ✅ single source of truth
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

      {/* MESSAGE ACTIVITY */}
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

      {/* EXTRA STATS */}
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

export default Dashboard;
