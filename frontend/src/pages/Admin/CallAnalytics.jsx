import { useState, useEffect } from "react";
import api from "../../api/axios";
import { StatCard, Spinner, fmt } from "./AdminHelper.jsx";
import {
  PhoneCall, CheckCircle, PhoneMissed, PhoneOff,
  Wifi, Clock, TrendingUp, Phone,
} from "lucide-react";

const CallAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/call-analytics")
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
    const m = Math.floor(secs / 60), s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const maxBar = Math.max(...(data?.dailyActivity?.map((d) => d.total) ?? [1]), 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Call analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Insights across all calls in your app</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={PhoneCall}   label="Total calls" value={data?.total}     colorClass="text-purple-400" iconBg="bg-purple-500/10" />
        <StatCard icon={CheckCircle} label="Completed"   value={data?.completed} colorClass="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard icon={PhoneMissed} label="Missed"      value={data?.missed}    colorClass="text-rose-400"   iconBg="bg-rose-500/10"    />
        <StatCard icon={PhoneOff}    label="Rejected"    value={data?.rejected}  colorClass="text-amber-400"  iconBg="bg-amber-500/10"   />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Connection rate */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2 lg:col-span-1 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Wifi size={14} className="text-emerald-400" />
            <span className="text-xs text-gray-500">Connection rate</span>
          </div>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
            {data?.connectionRate}<span className="text-lg text-gray-400 ml-0.5">%</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${data?.connectionRate}%` }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">of calls successfully connected</p>
        </div>

        {/* Avg duration */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-blue-400" />
            <span className="text-xs text-gray-500">Avg duration</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{fmtDuration(data?.avgDuration)}</p>
          <p className="text-[11px] text-gray-400 mt-1">per completed call</p>
        </div>

        {/* Avg per day */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-amber-400" />
            <span className="text-xs text-gray-500">Avg calls / day</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{data?.avgCallsPerDay}</p>
          <p className="text-[11px] text-gray-400 mt-1">last 14 days</p>
        </div>

        {/* Peak hour */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Phone size={14} className="text-pink-400" />
            <span className="text-xs text-gray-500">Peak hour</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{data?.peakHour}</p>
          <p className="text-[11px] text-gray-400 mt-1">most calls made</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Type breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-gray-900 dark:border-white/[0.06]">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-4">Call types</p>
          <div className="flex flex-col gap-4">
            {[
              { label: "Video calls", value: data?.video, total: data?.total, color: "bg-purple-500" },
              { label: "Audio calls", value: data?.audio, total: data?.total, color: "bg-blue-500" },
            ].map(({ label, value, total, color }) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {fmt(value)} <span className="text-gray-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}

            <div className="border-t border-gray-100 dark:border-white/[0.06] pt-3 mt-1">
              <p className="text-xs text-gray-400 mb-3">By outcome</p>
              {[
                { label: "Completed", value: data?.completed, color: "bg-emerald-500" },
                { label: "Missed",    value: data?.missed,    color: "bg-rose-500"    },
                { label: "Rejected",  value: data?.rejected,  color: "bg-amber-500"   },
              ].map(({ label, value, color }) => {
                const pct = data?.total > 0 ? Math.round((value / data.total) * 100) : 0;
                return (
                  <div key={label} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
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
                <div className="w-2 h-2 rounded-full bg-purple-500/40" />
                <span className="text-[10px] text-gray-400">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-gray-400">Completed</span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {data?.dailyActivity?.map((d, i) => {
              const totalH     = Math.max(2, (d.total     / maxBar) * 96);
              const completedH = Math.max(2, (d.completed / maxBar) * 96);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-purple-500/30 relative transition-all"
                    style={{ height: `${totalH}px` }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-sm bg-emerald-500 transition-all"
                      style={{ height: `${Math.min(completedH, totalH)}px` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400 whitespace-nowrap">
                    {d.date.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallAnalytics;