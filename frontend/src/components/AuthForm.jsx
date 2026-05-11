import { useState, useRef } from "react";
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
  ShieldCheck,
} from "lucide-react";
import GoogleLoginButton from "./common/GoogleLoginButton.jsx";
import logo from "../assets/logo.png";
import api from "../api/axios.js";

const AuthForm = ({ mode = "login", onSubmit, loading }) => {
  const isLogin = mode === "login";
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fName: "",
    lName: "",
    avatar: null,
  });

  const [emailError, setEmailError] = useState("");

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const checkStrength = (password) => {
    if (password.length < 6) return "Weak";
    if (password.match(/^(?=.*[A-Z])(?=.*\d).{6,}$/)) return "Strong";
    return "Medium";
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    const val = files?.length ? files[0] : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
    if (name === "email") {
      if (!val) setEmailError("");
      else if (!isValidEmail(val)) setEmailError("Enter a valid email");
      else setEmailError("");
    }
    if (name === "password") setPasswordStrength(checkStrength(val));
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || emailError) return;
    setStep(2);
  };

  // Handle OTP digit input
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const updated = [...otp];
    updated[index] = value.slice(-1); // one digit per box
    setOtp(updated);
    setOtpError("");
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const updated = [...otp];
    pasted.split("").forEach((char, i) => {
      updated[i] = char;
    });
    setOtp(updated);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setOtpSending(true);
    try {
      await api.post("/users/send-otp", { email: formData.email });
      setOtpSent(true);
      setStep(3);
      startResendCooldown();
    } catch (err) {
      setOtpError(err?.response?.data?.message || "Failed to send OTP");
    } finally {
      setOtpSending(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(30);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    setOtpSending(true);
    try {
      await api.post("/users/send-otp", { email: formData.email });
      startResendCooldown();
    } catch (err) {
      setOtpError(err?.response?.data?.message || "Failed to resend OTP");
    } finally {
      setOtpSending(false);
      otpRefs.current[0]?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (mode === "register") {
      const enteredOtp = otp.join("");
      if (enteredOtp.length < 6) {
        setOtpError("Please enter all 6 digits.");
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append("email", formData.email.toLowerCase());
      formDataToSend.append("password", formData.password);
      formDataToSend.append("fName", formData.fName);
      formDataToSend.append("lName", formData.lName);
      formDataToSend.append("otp", enteredOtp);
      if (formData.avatar) formDataToSend.append("avatar", formData.avatar);
      onSubmit(formDataToSend);
    } else {
      onSubmit({
        email: formData.email.toLowerCase(),
        password: formData.password,
      });
    }
  };

  const otpComplete = otp.every((d) => d !== "");

  return (
    <div className="w-full max-w-sm">
      {/* Mobile Logo */}
      <div className="mb-8 md:hidden flex flex-col items-center gap-2">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-400/30 rounded-2xl blur-xl" />
          <img
            src={logo}
            alt="Chatify"
            className="relative w-14 h-14 object-contain drop-shadow-lg"
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Chatify
        </h1>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 border border-gray-100 dark:border-slate-800 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500" />

        <div className="p-8">
          {/* Step indicator for register — now 3 steps */}
          {!isLogin && (
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
                    step >= s
                      ? "bg-emerald-500"
                      : "bg-gray-200 dark:bg-slate-700"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Header */}
          <div className="mb-7">
            {!isLogin && step > 1 && (
              <button
                onClick={() => {
                  if (step === 3) {
                    setOtp(["", "", "", "", "", ""]);
                    setOtpError("");
                  }
                  setStep(step - 1);
                }}
                className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-emerald-500 mb-4 transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLogin
                ? "Welcome back"
                : step === 1
                ? "Create account"
                : step === 2
                ? "Your profile"
                : "Verify email"}
            </h2>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              {isLogin
                ? "Sign in to continue to Chatify"
                : step === 1
                ? "Fill in your details to get started"
                : step === 2
                ? "Almost done — add your name"
                : `Enter the 6-digit code sent to ${formData.email}`}
            </p>
          </div>

          {/* LOGIN */}
          {isLogin && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field
                icon={<Mail size={15} />}
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
                disabled={!formData.email || !formData.password || !!emailError}
              />
              <Divider />
              <GoogleLoginButton />
            </form>
          )}

          {/* REGISTER STEP 1 — credentials */}
          {!isLogin && step === 1 && (
            <form onSubmit={handleNext} className="space-y-4">
              <Field
                icon={<Mail size={15} />}
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

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-600 dark:text-slate-400">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <Lock size={15} />
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                  />
                </div>
                {confirmPassword && confirmPassword !== formData.password && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
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
                  !!emailError ||
                  confirmPassword !== formData.password
                }
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25"
              >
                Continue →
              </button>

              <Divider />
              <GoogleLoginButton />
            </form>
          )}

          {/* REGISTER STEP 2 — profile + Send OTP */}
          {!isLogin && step === 2 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <AvatarUpload onChange={handleChange} />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  icon={<User size={15} />}
                  label="First Name"
                  name="fName"
                  value={formData.fName}
                  onChange={handleChange}
                />
                <Field
                  icon={<User size={15} />}
                  label="Last Name"
                  name="lName"
                  value={formData.lName}
                  onChange={handleChange}
                />
              </div>

              <button
                type="submit"
                disabled={otpSending || !formData.fName || !formData.lName}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                {otpSending ? (
                  <Loader />
                ) : (
                  <>
                    <Mail size={15} />
                    Send OTP
                  </>
                )}
              </button>
            </form>
          )}

          {/* REGISTER STEP 3 — OTP verification */}
          {!isLogin && step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Shield icon */}
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck size={26} className="text-emerald-500" />
                </div>
              </div>

              {/* 6-digit OTP boxes */}
              <div>
                <label className="block text-xs font-semibold mb-3 text-center text-gray-600 dark:text-slate-400">
                  Enter verification code
                </label>
                <div
                  className="flex justify-center gap-2.5"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-11 h-13 text-center text-lg font-bold rounded-xl border-2 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none transition-all duration-200 ${
                        otpError
                          ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/30"
                          : digit
                          ? "border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                          : "border-gray-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                      }`}
                      style={{ width: "2.75rem", height: "3.25rem" }}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-xs text-red-400 mt-2.5 text-center flex items-center justify-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                    {otpError}
                  </p>
                )}
              </div>

              {/* Resend */}
              <p className="text-xs text-center text-gray-400 dark:text-slate-500">
                Didn't receive a code?{" "}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || otpSending}
                  className={`font-medium transition-colors ${
                    resendCooldown > 0 || otpSending
                      ? "text-gray-300 dark:text-slate-600 cursor-not-allowed"
                      : "text-emerald-500 hover:text-emerald-400 cursor-pointer"
                  }`}
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend OTP"}
                </button>
              </p>

              <SubmitButton
                loading={loading}
                text="Verify & Create Account"
                disabled={!otpComplete}
              />
            </form>
          )}

          {/* Footer */}
          <p className="text-xs text-center mt-6 text-gray-400 dark:text-slate-500">
            {isLogin ? (
              <>
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

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
    <label className="block text-xs font-semibold mb-1.5 text-gray-600 dark:text-slate-400">
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-2.5 text-gray-400">{icon}</span>
      <input
        type={type}
        name={name}
        value={value}
        required
        onChange={onChange}
        autoComplete={name}
        placeholder={label}
        className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm placeholder-gray-300 dark:placeholder-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all ${
          error
            ? "border-red-400 focus:ring-red-400/30"
            : "border-gray-200 dark:border-slate-700"
        }`}
      />
    </div>
    {error && (
      <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
        <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
        {error}
      </p>
    )}
  </div>
);

const PasswordField = ({ value, onChange, show, setShow, strength }) => (
  <div>
    <label className="block text-xs font-semibold mb-1.5 text-gray-600 dark:text-slate-400">
      Password
    </label>
    <div className="relative">
      <span className="absolute left-3 top-2.5 text-gray-400">
        <Lock size={15} />
      </span>
      <input
        type={show ? "text" : "password"}
        name="password"
        value={value}
        onChange={onChange}
        placeholder="Enter password"
        className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
      />
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
    {value && (
      <div className="mt-2 space-y-1">
        <div className="flex gap-1">
          {["Weak", "Medium", "Strong"].map((level, i) => (
            <div
              key={level}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                strength === "Weak" && i === 0
                  ? "bg-red-400"
                  : strength === "Medium" && i <= 1
                  ? "bg-yellow-400"
                  : strength === "Strong"
                  ? "bg-emerald-400"
                  : "bg-gray-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <p
          className={`text-xs ${
            strength === "Weak"
              ? "text-red-400"
              : strength === "Medium"
              ? "text-yellow-500"
              : "text-emerald-500"
          }`}
        >
          {strength} password
        </p>
      </div>
    )}
  </div>
);

const SubmitButton = ({ loading, text, disabled }) => (
  <button
    disabled={loading || disabled}
    className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 flex items-center justify-center"
  >
    {loading ? <Loader /> : text}
  </button>
);

const Divider = () => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800" />
    <span className="text-xs text-gray-300 dark:text-slate-600">or</span>
    <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800" />
  </div>
);

export default AuthForm;
