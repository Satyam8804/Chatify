import { useState } from "react";
import { Link } from "react-router-dom";
import AvatarUpload from "./uploadAvatar";
import Loader from "../utils/Loader";
import { Mail, Lock, User, ArrowRight, ChevronLeft } from "lucide-react";
import GoogleLoginButton from "./common/GoogleLoginButton.jsx";
const AuthForm = ({ mode = "login", onSubmit, loading }) => {
  const isLogin = mode === "login";
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fName: "",
    lName: "",
    avatar: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "register") {
      const formDataToSend = new FormData();
      formDataToSend.append("email", formData.email);
      formDataToSend.append("password", formData.password);
      formDataToSend.append("fName", formData.fName);
      formDataToSend.append("lName", formData.lName);
      if (formData.avatar) formDataToSend.append("avatar", formData.avatar);
      onSubmit(formDataToSend);
    } else {
      onSubmit({ email: formData.email, password: formData.password });
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-slate-900/50 border border-gray-100 dark:border-slate-700 p-8 transition-colors">
        {/* Header */}
        <div className="mb-8">
          {!isLogin && step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 mb-4 transition-colors"
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            {isLogin
              ? "Welcome back"
              : step === 1
              ? "Create account"
              : "Your profile"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {isLogin
              ? "Sign in to continue to Chatify"
              : step === 1
              ? "Start chatting in seconds"
              : "Almost there — set up your profile"}
          </p>
        </div>

        {/* Step indicator for register */}
        {!isLogin && (
          <div className="flex gap-2 mb-6">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  s <= step ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
        )}

        {/* LOGIN */}
        {isLogin && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              icon={<Mail size={16} />}
              label="Email"
              name="email"
              type="email"
              onChange={handleChange}
            />
            <Field
              icon={<Lock size={16} />}
              label="Password"
              name="password"
              type="password"
              onChange={handleChange}
            />
            <SubmitButton loading={loading} text="Sign in" />

            {/* ── Divider ── */}
            <Divider />

            {/* ── Google ── */}
            <GoogleLoginButton />
          </form>
        )}

        {/* REGISTER STEP 1 */}
        {!isLogin && step === 1 && (
          <form onSubmit={handleNext} className="space-y-4">
            <Field
              icon={<Mail size={16} />}
              label="Email"
              name="email"
              type="email"
              onChange={handleChange}
            />
            <Field
              icon={<Lock size={16} />}
              label="Password"
              name="password"
              type="password"
              onChange={handleChange}
            />
            <button
              type="submit"
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/20"
            >
              Continue <ArrowRight size={16} />
            </button>

            {/* ── Divider ── */}
            <Divider />

            {/* ── Google ── */}
            <GoogleLoginButton />
          </form>
        )}

        {/* REGISTER STEP 2 */}
        {!isLogin && step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <AvatarUpload onChange={handleChange} />
              <div className="flex-1 flex flex-col gap-3">
                <Field
                  icon={<User size={16} />}
                  label="First Name"
                  name="fName"
                  onChange={handleChange}
                />
                <Field
                  icon={<User size={16} />}
                  label="Last Name"
                  name="lName"
                  onChange={handleChange}
                />
              </div>
            </div>
            <SubmitButton loading={loading} text="Create Account" />
          </form>
        )}

        {/* Footer link */}
        <p className="text-sm text-center text-gray-500 dark:text-slate-400 mt-6">
          {isLogin ? (
            <>
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

// ── Divider ───────────────────────────────────────────
const Divider = () => (
  <div className="flex items-center gap-3 my-1">
    <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
    <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
      or
    </span>
    <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
  </div>
);

const Field = ({ icon, label, name, type = "text", onChange }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
      {label}
    </label>
    <div className="relative flex items-center">
      <span className="absolute left-3 text-gray-400 dark:text-slate-500">
        {icon}
      </span>
      <input
        type={type}
        name={name}
        onChange={onChange}
        required
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
      />
    </div>
  </div>
);

const SubmitButton = ({ loading, text }) => (
  <button
    disabled={loading}
    className="w-full h-11 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/20 relative"
  >
    {loading ? <Loader /> : text}
  </button>
);

export default AuthForm;
