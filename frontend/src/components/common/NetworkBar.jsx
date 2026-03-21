import { useEffect, useState } from "react";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";

const NetworkBar = () => {
  const [status, setStatus] = useState("online");
  const [label, setLabel] = useState("");

  useEffect(() => {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    const evaluate = () => {
      if (!navigator.onLine) {
        setStatus("offline");
        setLabel("Offline");
        return;
      }
      const effectiveType = connection?.effectiveType;
      const downlink = connection?.downlink;
      if (
        effectiveType === "slow-2g" ||
        effectiveType === "2g" ||
        downlink < 1
      ) {
        setStatus("poor");
        setLabel("Poor");
      } else if (effectiveType === "3g" || (downlink != null && downlink < 5)) {
        setStatus("weak");
        setLabel("Weak");
      } else {
        setStatus("online");
        setLabel("");
      }
    };

    evaluate();
    window.addEventListener("online", evaluate);
    window.addEventListener("offline", evaluate);
    if (connection) connection.addEventListener("change", evaluate);

    return () => {
      window.removeEventListener("online", evaluate);
      window.removeEventListener("offline", evaluate);
      if (connection) connection.removeEventListener("change", evaluate);
    };
  }, []);

  if (status === "online") return null;

  const config = {
    offline: {
      color: "text-rose-400",
      border: "border-rose-500/30",
      bg: "bg-rose-500/10",
      icon: <WifiOff size={11} />,
    },
    poor: {
      color: "text-amber-400",
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      icon: <AlertTriangle size={11} />,
    },
    weak: {
      color: "text-yellow-400",
      border: "border-yellow-500/30",
      bg: "bg-yellow-500/10",
      icon: <Wifi size={11} />,
    },
  }[status];

  return (
    <div
      className={`flex items-center gap-1.5 ${config.bg} border ${config.border} rounded-full px-3 py-1.5 backdrop-blur-md`}
    >
      <span className={config.color}>{config.icon}</span>
      <span className={`text-[10px] font-medium ${config.color}`}>{label}</span>
      {status === "offline" && (
        <span
          className={`w-2 h-2 rounded-full border ${config.border} border-t-transparent animate-spin ml-0.5`}
        />
      )}
    </div>
  );
};

export default NetworkBar;
