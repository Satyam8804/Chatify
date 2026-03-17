import { useState } from "react";
import { Link } from "react-router-dom";
import AvatarUpload from "./uploadAvatar";
import Loader from "../utils/Loader";
import {
  Mail,
  Lock,
  User,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import GoogleLoginButton from "./common/GoogleLoginButton.jsx";
import logo from "../assets/logo.png";

const AuthForm = ({ mode = "login", onSubmit, loading }) => {
  const isLogin = mode === "login";
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fName: "",
    lName: "",
    avatar: null,
  });

  const [emailError, setEmailError] = useState("");

  const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const checkStrength = (password) => {
    if (password.length < 6) return "Weak";
    if (password.match(/^(?=.*[A-Z])(?=.*\d).{6,}$/)) return "Strong";
    return "Medium";
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    const val = files?.length ? files[0] : value;

    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));

    if (name === "email") {
      if (!val) setEmailError("");
      else if (!isValidEmail(val)) setEmailError("Enter a valid email");
      else setEmailError("");
    }

    if (name === "password") {
      setPasswordStrength(checkStrength(val));
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || emailError) return;
    setStep(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (mode === "register") {
      const formDataToSend = new FormData();
      formDataToSend.append("email", formData.email.toLowerCase());
      formDataToSend.append("password", formData.password);
      formDataToSend.append("fName", formData.fName);
      formDataToSend.append("lName", formData.lName);
      if (formData.avatar)
        formDataToSend.append("avatar", formData.avatar);

      onSubmit(formDataToSend);
    } else {
      onSubmit({
        email: formData.email.toLowerCase(),
        password: formData.password,
      });
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Mobile Logo */}
      <div className="mb-6 md:hidden flex flex-col items-center">
        <img
          src={logo}
          alt="Chatify"
          className="w-16 h-16 object-contain mb-2 drop-shadow-lg drop-shadow-emerald-500/40"
        />
        <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          Chatify
        </h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-8">
        {/* Header */}
        <div className="mb-8">
          {!isLogin && step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-600 mb-4"
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isLogin
              ? "Welcome back"
              : step === 1
              ? "Create account"
              : "Your profile"}
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isLogin
              ? "Sign in to continue"
              : step === 1
              ? "Start chatting"
              : "Set up your profile"}
          </p>
        </div>

        {/* LOGIN */}
        {isLogin && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              icon={<Mail size={16} />}
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={emailError}
            />

            <PasswordField
              value={formData.password}
              onChange={handleChange}
              show={showPassword}
              setShow={setShowPassword}
              strength={passwordStrength}
            />

            <SubmitButton
              loading={loading}
              text="Sign in"
              disabled={
                !formData.email || !formData.password || emailError
              }
            />

            <Divider />
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
              value={formData.email}
              onChange={handleChange}
              error={emailError}
            />

            <PasswordField
              value={formData.password}
              onChange={handleChange}
              show={showPassword}
              setShow={setShowPassword}
              strength={passwordStrength}
            />

            {/* Confirm Password */}
            <div>
              <label className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Confirm Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />

              {confirmPassword &&
                confirmPassword !== formData.password && (
                  <p className="text-xs text-red-500 mt-1">
                    Passwords do not match
                  </p>
                )}
            </div>

            <button
              type="submit"
              disabled={
                !formData.email ||
                !formData.password ||
                !confirmPassword ||
                emailError ||
                confirmPassword !== formData.password
              }
              className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl"
            >
              Continue
            </button>

            <Divider />
            <GoogleLoginButton />
          </form>
        )}

        {/* REGISTER STEP 2 */}
        {!isLogin && step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <AvatarUpload onChange={handleChange} />

            <Field
              icon={<User size={16} />}
              label="First Name"
              name="fName"
              value={formData.fName}
              onChange={handleChange}
            />

            <Field
              icon={<User size={16} />}
              label="Last Name"
              name="lName"
              value={formData.lName}
              onChange={handleChange}
            />

            <SubmitButton loading={loading} text="Create Account" />
          </form>
        )}

        {/* Footer */}
        <p className="text-sm text-center mt-6 text-gray-600 dark:text-gray-400">
          {isLogin ? (
            <>
              Don't have an account?{" "}
              <Link to="/register" className="text-emerald-500">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link to="/login" className="text-emerald-500">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

/* ================= COMPONENTS ================= */

const Field = ({
  icon,
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
}) => (
  <div>
    <label className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
      {label}
    </label>

    <div className="relative">
      <span className="absolute left-3 top-2.5 text-gray-400">
        {icon}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        required
        onChange={onChange}
        autoComplete={name}
        className={`w-full pl-10 pr-3 py-2 rounded border ${
          error
            ? "border-red-400"
            : "border-gray-300 dark:border-slate-600"
        } bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500`}
      />
    </div>

    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

const PasswordField = ({
  value,
  onChange,
  show,
  setShow,
  strength,
}) => (
  <div>
    <label className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
      Password
    </label>

    <div className="relative">
      <span className="absolute left-3 top-2.5 text-gray-400">
        <Lock size={16} />
      </span>

      <input
        type={show ? "text" : "password"}
        name="password"
        value={value}
        onChange={onChange}
        className="w-full pl-10 pr-10 py-2 rounded border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
      />

      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>

    {value && (
      <p
        className={`text-xs mt-1 ${
          strength === "Weak"
            ? "text-red-500"
            : strength === "Medium"
            ? "text-yellow-500"
            : "text-green-500"
        }`}
      >
        {strength} password
      </p>
    )}
  </div>
);

const SubmitButton = ({ loading, text, disabled }) => (
  <button
    disabled={loading || disabled}
    className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white rounded-xl transition"
  >
    {loading ? <Loader /> : text}
  </button>
);

const Divider = () => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
    <span className="text-xs text-gray-400">or</span>
    <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
  </div>
);

export default AuthForm;