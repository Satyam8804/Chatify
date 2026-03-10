import { MessageCircle } from "lucide-react";

const EmptyChatState = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
        <MessageCircle size={28} className="text-white" />
      </div>

      <div className="text-center">
        <p className="text-gray-800 dark:text-slate-100 font-semibold text-lg">
          No chat selected
        </p>
        <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
          Pick a conversation to start messaging
        </p>
      </div>
    </div>
  );
};

export default EmptyChatState;
