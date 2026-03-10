const AuthPage = ({ children }) => {
  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2 bg-white dark:bg-slate-950 transition-colors">

      {/* Left branding */}
      <div className="hidden md:flex flex-col justify-center items-center relative overflow-hidden bg-slate-950 p-12">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-teal-400/15 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-green-400/10 rounded-full blur-2xl animate-pulse delay-500" />

        <div className="relative z-10 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
            <span className="text-2xl">💬</span>
          </div>

          <div>
            <h1 className="text-5xl font-black text-white tracking-tight mb-3">Chatify</h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-xs">
              Connect instantly. Chat securely.<br />Share moments in real time.
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {["🔒 End-to-end encrypted", "⚡ Real-time messaging", "👥 Group chats"].map((f) => (
              <div key={f} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-300 text-sm text-left">
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right auth section — scrollable, no min-h-screen */}
      <div className="flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4 py-8 overflow-y-auto transition-colors">
        {children}
      </div>

    </div>
  );
};

export default AuthPage;