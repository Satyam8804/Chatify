import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "../../context/themeContext";

const ThemeModal = ({ onClose }) => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-[340px] shadow-2xl border border-gray-200 dark:border-gray-700 transition-colors">
        <h2 className="text-xl font-semibold mb-5 text-gray-800 dark:text-gray-100">
          Choose Theme
        </h2>

        <div className="flex flex-col gap-3">
          <ThemeOption
            label="System"
            value="system"
            icon={<Laptop size={18} />}
            theme={theme}
            setTheme={setTheme}
          />

          <ThemeOption
            label="Light"
            value="light"
            icon={<Sun size={18} />}
            theme={theme}
            setTheme={setTheme}
          />

          <ThemeOption
            label="Dark"
            value="dark"
            icon={<Moon size={18} />}
            theme={theme}
            setTheme={setTheme}
          />
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const ThemeOption = ({ label, value, theme, icon, setTheme }) => {
  const selected = theme === value;

  return (
    <label
      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition
      ${
        selected
          ? "border-green-500 bg-green-50 dark:bg-green-900/30"
          : "border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <div className="flex items-center gap-3 text-gray-800 dark:text-gray-200">
        {icon}
        <span>{label}</span>
      </div>

      <input
        type="radio"
        name="theme"
        checked={selected}
        onChange={() => setTheme(value)}
        className="accent-green-600 w-4 h-4 cursor-pointer"
      />
    </label>
  );
};

export default ThemeModal;
