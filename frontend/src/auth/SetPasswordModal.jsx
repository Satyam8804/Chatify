import { useState, useRef } from "react";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import api from "../api/axios";
import Loader from "../utils/Loader";

const SetPasswordModal = ({
  isOpen,
  onClose,
  userEmail,
  onSuccess,
  hasPassword,
}) => {
  const [step, setStep] = useState(1); // 1 = send otp, 2 = enter otp + password
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);

  if (!isOpen) return null;

  // ── Helpers ─────────────────────────────────────────────────────

  const checkStrength = (pwd) => {
    if (pwd.length < 6) return "Weak";
    if (/^(?=.*[A-Z])(?=.*\d).{6,}$/.test(pwd)) return "Strong";
    return "Medium";
  };

  const startCooldown = () => {
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

  const resetModal = () => {
    setStep(1);
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    setPassword("");
    setConfirmPassword("");
    setPasswordStrength("");
    setResendCooldown(0);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // ── OTP input handlers ───────────────────────────────────────────

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value.slice(-1);
    setOtp(updated);
    setOtpError("");
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
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

  // ── API calls ────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    setSending(true);
    try {
      const endpoint = hasPassword
        ? "send-reset-password-otp"
        : "send-set-password-otp";
      await api.post(`/users/${endpoint}`);
      setStep(2);
      startCooldown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      // toast handled by axios interceptor
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    setSending(true);
    try {
      const endpoint = hasPassword
        ? "send-reset-password-otp"
        : "send-set-password-otp";
      await api.post(`/users/${endpoint}`);
      startCooldown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      // toast handled by interceptor
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const enteredOtp = otp.join("");

    if (enteredOtp.length < 6) {
      setOtpError("Please enter all 6 digits.");
      return;
    }
    if (password !== confirmPassword) {
      setOtpError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = hasPassword ? "reset-password" : "set-password";
      await api.post(`/users/${endpoint}`, { otp: enteredOtp, password });
      resetModal();
      onSuccess?.();
    } catch (err) {
      const msg = err?.response?.data?.message;
      if (
        msg?.toLowerCase().includes("otp") ||
        msg?.toLowerCase().includes("invalid")
      ) {
        setOtpError(msg);
      }
      // general toast handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const otpComplete = otp.every((d) => d !== "");
  const canSubmit =
    otpComplete && password.length >= 6 && password === confirmPassword;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500" />

        {/* Step progress */}
        <div className="flex gap-2 px-8 pt-6">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
                step >= s ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>

        <div className="p-8">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>

          {/* ── STEP 1: Confirm + Send OTP ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {hasPassword ? "Change your password" : "Add a password"}
                </h2>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                  {hasPassword
                    ? "We'll send a verification code to confirm it's you before updating."
                    : "We'll send a verification code to confirm it's you."}{" "}
                </p>
              </div>

              {/* Email display */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-gray-200 dark:border-slate-700">
                <Mail size={16} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Code will be sent to
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {userEmail}
                  </p>
                </div>
              </div>

              <button
                onClick={handleSendOtp}
                disabled={sending}
                className="w-full h-11 cursor-pointer bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <Loader />
                ) : (
                  <>
                    <Mail size={15} /> Send verification code
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── STEP 2: OTP + New Password ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  // ✅ fix
                  {hasPassword
                    ? "Verify & change password"
                    : "Verify & set password"}
                </h2>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                  Enter the code sent to{" "}
                  <span className="text-emerald-500 font-medium">
                    {userEmail}
                  </span>
                </p>
              </div>

              {/* OTP boxes */}
              <div>
                <label className="block text-xs font-semibold mb-3 text-center text-gray-600 dark:text-slate-400">
                  Verification code
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
                      style={{ width: "2.75rem", height: "3.25rem" }}
                      className={`text-center text-lg font-bold rounded-xl border-2 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none transition-all duration-200 ${
                        otpError
                          ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/30"
                          : digit
                          ? "border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                          : "border-gray-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                      }`}
                    />
                  ))}
                </div>
                {otpError && (
                  <p className="text-xs text-red-400 mt-2 text-center flex items-center justify-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                    {otpError}
                  </p>
                )}
                <p className="text-xs text-center mt-2 text-gray-400 dark:text-slate-500">
                  Didn't receive it?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || sending}
                    className={`font-medium transition-colors cursor-pointer ${
                      resendCooldown > 0 || sending
                        ? "text-gray-300 dark:text-slate-600 cursor-not-allowed"
                        : "text-emerald-500 hover:text-emerald-400"
                    }`}
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend"}
                  </button>
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-600 dark:text-slate-400">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <Lock size={15} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordStrength(checkStrength(e.target.value));
                    }}
                    placeholder="Enter new password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {["Weak", "Medium", "Strong"].map((level, i) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            passwordStrength === "Weak" && i === 0
                              ? "bg-red-400"
                              : passwordStrength === "Medium" && i <= 1
                              ? "bg-yellow-400"
                              : passwordStrength === "Strong"
                              ? "bg-emerald-400"
                              : "bg-gray-200 dark:bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <p
                      className={`text-xs ${
                        passwordStrength === "Weak"
                          ? "text-red-400"
                          : passwordStrength === "Medium"
                          ? "text-yellow-500"
                          : "text-emerald-500"
                      }`}
                    >
                      {passwordStrength} password
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-600 dark:text-slate-400">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <Lock size={15} />
                  </span>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                    Passwords do not match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader />
                ) : (
                  <>
                    <ShieldCheck size={15} /> Set Password
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetPasswordModal;
