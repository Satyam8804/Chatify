import { useEffect, useState } from "react";
import api from "../api/axios";

const STATUS_STYLES = {
  pending:
    "bg-yellow-50 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400",
  approved:
    "bg-green-50 text-green-800 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-red-50 text-red-800 dark:bg-rose-500/10 dark:text-rose-400",
};

export default function AdminAppeals() {
  const [appeals, setAppeals] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  const fetchAppeals = async (status) => {
    setLoading(true);
    const { data } = await api.get(`/appeals?status=${status}`);
    setAppeals(data?.appeals);
    setLoading(false);
  };

  useEffect(() => {
    fetchAppeals(filter);
  }, [filter]);

  const handleReview = async (id, action) => {
    await api.patch(`/appeals/${id}`, { action });
    fetchAppeals(filter);
  };

  const initials = (u) =>
    `${u.fName?.[0] ?? ""}${u.lName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Ban appeals
        </h1>
        <div className="flex gap-2">
          {["pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border capitalize transition ${
                filter === s
                  ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-400 dark:hover:bg-white/[0.04]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 dark:bg-gray-900 dark:border-white/[0.06] dark:divide-white/[0.06]">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading...</p>
        ) : appeals?.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            No {filter} appeals
          </p>
        ) : (
          appeals?.map((appeal) => (
            <div key={appeal._id} className="p-5">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-xs font-semibold shrink-0 dark:bg-purple-500/10 dark:text-purple-400">
                  {initials(appeal.user)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {appeal.user.fName} {appeal.user.lName}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-lg font-medium capitalize ${
                        STATUS_STYLES[appeal.status]
                      }`}
                    >
                      {appeal.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {appeal.user.email} · Banned{" "}
                    {new Date(appeal.user.bannedAt).toLocaleDateString(
                      "en-US",
                      { dateStyle: "medium" }
                    )}
                  </p>

                  {/* Details */}
                  <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2 text-sm dark:bg-white/[0.04]">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Ban reason</p>
                      <p className="text-gray-900 dark:text-gray-200">
                        {appeal.user.banReason || "—"}
                      </p>
                    </div>
                    <hr className="border-gray-200 dark:border-white/[0.06]" />
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        User's appeal
                      </p>
                      <p className="text-gray-900 dark:text-gray-200">
                        {appeal.reason}
                      </p>
                    </div>
                  </div>

                  {/* Admin note if reviewed */}
                  {appeal.adminNote && (
                    <p className="text-xs text-gray-500 mt-2">
                      Admin note: {appeal.adminNote}
                    </p>
                  )}

                  {/* Actions — only for pending */}
                  {appeal.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleReview(appeal._id, "approved")}
                        className="cursor-pointer text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        Approve & unban
                      </button>
                      <button
                        onClick={() => handleReview(appeal._id, "rejected")}
                        className="cursor-pointer text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
