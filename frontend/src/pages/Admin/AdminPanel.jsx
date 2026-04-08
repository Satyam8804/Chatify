import { useState } from "react";
import { useAuth } from "../../context/authContext.jsx";
import { useTheme } from "../../context/themeContext.jsx";
import { Avatar } from "./AdminHelper.jsx";
import Dashboard    from "./Dashboard.jsx";
import UsersPage    from "./UsersPage.jsx";
import CallAnalytics from "./CallAnalytics.jsx";
import AdminAppeals  from "./AdminAppeals.jsx";
import {
  LayoutDashboard, Users, PhoneCall, Scale,
  LogOut, Sun, Moon, Monitor,
} from "lucide-react";

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: "light",  icon: Sun,     label: "Light"  },
  { value: "dark",   icon: Moon,    label: "Dark"   },
  { value: "system", icon: Monitor, label: "System" },
];

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const current = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[2];
  const Icon = current.icon;

  const cycle = () => {
    const idx  = THEME_OPTIONS.findIndex((o) => o.value === theme);
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

// ─── Nav config ───────────────────────────────────────────────────────────────

const PAGES = [
  { id: "dashboard", label: "Dashboard",     icon: LayoutDashboard },
  { id: "users",     label: "Users",         icon: Users           },
  { id: "calls",     label: "Call analytics",icon: PhoneCall       },
  { id: "appeals",   label: "Users Appeals", icon: Scale           },
];

// ─── AdminPanel ───────────────────────────────────────────────────────────────

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
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">Chatify</p>
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
        {activePage === "dashboard" && <Dashboard    />}
        {activePage === "users"     && <UsersPage    />}
        {activePage === "calls"     && <CallAnalytics />}
        {activePage === "appeals"   && <AdminAppeals  />}
      </main>
    </div>
  );
};

export default AdminPanel;