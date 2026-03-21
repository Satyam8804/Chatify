import { useEffect, useState } from "react";

const getSignalLevel = () => {
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  if (!navigator.onLine) return 0;
  if (!connection) return 4; // assume good if API unavailable

  const { effectiveType, downlink, rtt } = connection;

  // use rtt as primary signal — most reliable cross-network indicator
  if (rtt != null) {
    if (rtt === 0)   return 4; // no data yet, assume good
    if (rtt < 100)   return 4;
    if (rtt < 250)   return 3;
    if (rtt < 500)   return 2;
    return 1;
  }

  // fallback to effectiveType
  if (effectiveType === "4g") return 4;
  if (effectiveType === "3g") return 3;
  if (effectiveType === "2g") return 2;
  return 1;
};

const barConfig = [
  { level: 1, height: "h-[5px]"  },
  { level: 2, height: "h-[9px]"  },
  { level: 3, height: "h-[13px]" },
  { level: 4, height: "h-[17px]" },
];

const NetworkBar = () => {
  const [signalLevel, setSignalLevel] = useState(4);

  useEffect(() => {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    const update = () => setSignalLevel(getSignalLevel());

    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (connection) connection.addEventListener("change", update);

    const interval = setInterval(update, 3000);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (connection) connection.removeEventListener("change", update);
      clearInterval(interval);
    };
  }, []);

  const getBarColor = (barLevel) => {
    if (!navigator.onLine) return "bg-rose-500";
    if (barLevel > signalLevel) return "bg-slate-600";
    if (signalLevel === 4) return "bg-emerald-400";
    if (signalLevel === 3) return "bg-emerald-400";
    if (signalLevel === 2) return "bg-orange-400";
    return "bg-rose-500";
  };

  return (
    <div className="flex items-end gap-[3px]" title={`Signal: ${signalLevel}/4`}>
      {barConfig.map(({ level, height }) => (
        <div
          key={level}
          className={`w-[4px] rounded-sm transition-colors duration-500 ${height} ${getBarColor(level)}`}
        />
      ))}
    </div>
  );
};

export default NetworkBar;