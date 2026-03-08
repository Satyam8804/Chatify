const AuthPage = ({ children }) => {
  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2">
      
      {/* Left branding section */}
      <div className="hidden md:flex flex-col justify-center items-center bg-gradient-to-br from-blue-600 to-green-700 text-white p-10">
        <h1 className="text-4xl font-bold mb-4">Chatify 💬</h1>
        <p className="text-lg text-center max-w-sm opacity-90">
          Connect instantly. Chat securely. Share moments in real time.
        </p>
      </div>

      {/* Right auth section */}
      <div className="flex items-center justify-center bg-gray-100">
        {children}
      </div>
    </div>
  );
};

export default AuthPage;
