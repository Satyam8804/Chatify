import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axios";

export default function BannedPage() {
  const { state } = useLocation(); // { userId, reason, bannedAt, hasActiveAppeal }
  const [appealText, setAppealText] = useState("");
  const [submitted, setSubmitted] = useState(state?.hasActiveAppeal || false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!appealText.trim()) return setError("Please write your appeal reason.");
    setLoading(true);
    setError("");
    try {
      await api.post("/appeals", {
        userId: state?.userId,
        reason: appealText.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit appeal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">

        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold mb-2">Account suspended</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your account has been suspended by an administrator.
        </p>

        {/* Ban details */}
        <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Reason</span>
            <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-medium">
              Suspended
            </span>
          </div>
          <p className="text-sm">{state?.reason || "No reason provided"}</p>
          <hr className="border-gray-200" />
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Suspended on</span>
            <span className="text-sm">
              {state?.bannedAt
                ? new Date(state.bannedAt).toLocaleDateString("en-US", { dateStyle: "medium" })
                : "—"}
            </span>
          </div>
        </div>

        {/* Appeal section */}
        {submitted ? (
          <div className="bg-green-50 text-green-800 rounded-xl p-4 text-sm">
            <p className="font-medium mb-1">Appeal submitted</p>
            <p className="text-green-700">
              Your appeal is under review. You'll be notified once a decision is made.
            </p>
          </div>
        ) : (
          <div className="text-left">
            <p className="text-sm text-gray-500 mb-4 text-center">
              If you believe this was a mistake, submit an appeal below.
            </p>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}
            <label className="text-xs text-gray-500 block mb-1.5">Your appeal reason</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-28 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="Explain why you believe your account should be reinstated..."
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="cursor-pointer w-full mt-3 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition"
            >
              {loading ? "Submitting..." : "Submit appeal"}
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-5">
          Need help? Contact{" "}
          <a href="mailto:support@yourapp.com" className="text-blue-500">
            support@chatify.com
          </a>
        </p>
      </div>
    </div>
  );
}