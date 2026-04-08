import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api/axios.js";
import { Avatar, fmt } from "./AdminHelper.jsx";
import {
  Users,
  Search,
  Ban,
  Trash2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useSocket } from "../../context/socketContext.jsx";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "online", label: "Online" },
  { id: "banned", label: "Banned" },
  { id: "google", label: "Google" },
  { id: "local", label: "Local" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "online", label: "Online first" },
];

const PAGE_SIZE = 15;

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [allUsersCount, setAllUsersCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [actionId, setActionId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [selected, setSelected] = useState(new Set());
  const [filterCounts, setFilterCounts] = useState({});
  const [bulkLoading, setBulkLoading] = useState(false);

  const { onlineUser } = useSocket();

  const abortRef = useRef(null);
  const pageRef = useRef(1);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchFilterCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const [all, banned, google, local] = await Promise.all([
        api.get("/admin/users?limit=1"),
        api.get("/admin/users?limit=1&filter=banned"),
        api.get("/admin/users?limit=1&filter=google"),
        api.get("/admin/users?limit=1&filter=local"),
      ]);

      const counts = {
        all: all.data.total ?? 0,
        online: onlineUser.size ?? 0,
        banned: banned.data.total ?? 0,
        google: google.data.total ?? 0,
        local: local.data.total ?? 0,
      };

      setFilterCounts(counts);
      setAllUsersCount(counts.all);
    } catch (e) {
      console.error("fetchFilterCounts:", e);
    } finally {
      setCountsLoading(false);
    }
  }, [onlineUser]);

  useEffect(() => {
    fetchFilterCounts();
  }, [fetchFilterCounts]);

  const fetchUsers = useCallback(
    async (p = 1) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ page: p, limit: PAGE_SIZE, sort });

        if (debouncedSearch) params.append("search", debouncedSearch);
        if (activeFilter !== "all") params.append("filter", activeFilter);

        const r = await api.get(`/admin/users?${params}`, {
          signal: abortRef.current.signal,
        });

        const nextUsers = r.data.users ?? [];
        
        setUsers(nextUsers);
        setTotal(r.data.total ?? 0);
        setTotalPages(r.data.totalPages ?? 1);
        setPage(p);
        setSelected(new Set());
      } catch (e) {
        if (e?.code !== "ERR_CANCELED" && e?.name !== "CanceledError") {
          console.error(e);
          setError("Failed to load users. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, activeFilter, sort]
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleBan = async (u) => {
    setActionId(u._id);
    try {
      if (u.isBanned) {
        await api.patch(`/admin/users/${u._id}/unban`);
      } else {
        await api.patch(`/admin/users/${u._id}/ban`, {
          reason: "Admin action",
        });
      }
      fetchUsers(pageRef.current);
      fetchFilterCounts();
    } catch (e) {
      console.error(e);
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user permanently? This cannot be undone."))
      return;

    setActionId(id);
    try {
      await api.delete(`/admin/users/${id}`);
      const nextPage =
        users.length === 1 && pageRef.current > 1
          ? pageRef.current - 1
          : pageRef.current;
      fetchUsers(nextPage);
      fetchFilterCounts();
    } catch (e) {
      console.error(e);
    } finally {
      setActionId(null);
    }
  };

  const handleBulkBan = async () => {
    const unbannedIds = [...selected].filter(
      (id) => !users.find((u) => u._id === id)?.isBanned
    );

    if (unbannedIds.length === 0) {
      alert("All selected users are already banned.");
      return;
    }

    if (!window.confirm(`Ban ${unbannedIds.length} user(s)?`)) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        unbannedIds.map((id) =>
          api.patch(`/admin/users/${id}/ban`, { reason: "Bulk admin action" })
        )
      );
      fetchUsers(pageRef.current);
      fetchFilterCounts();
    } catch (e) {
      console.error(e);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Permanently delete ${selected.size} user(s)?`)) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        [...selected].map((id) => api.delete(`/admin/users/${id}`))
      );
      const nextPage =
        selected.size >= users.length && pageRef.current > 1
          ? pageRef.current - 1
          : pageRef.current;
      fetchUsers(nextPage);
      fetchFilterCounts();
    } catch (e) {
      console.error(e);
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelected(
      selected.size === users.length
        ? new Set()
        : new Set(users.map((u) => u._id))
    );

  const pageNumbers = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, i) => {
      if (totalPages <= 5) return i + 1;
      if (page <= 3) return i + 1;
      if (page >= totalPages - 2) return totalPages - 4 + i;
      return page - 2 + i;
    }
  );

  const hasActiveFilters = Boolean(search.trim()) || activeFilter !== "all";
  const displayedOnlineCount = onlineUser.size;
  const displayedFilterCounts = {
    ...filterCounts,
    online: displayedOnlineCount,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Users
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage and monitor all registered users
          </p>
        </div>
        <button
          onClick={() => {
            fetchUsers(pageRef.current);
            fetchFilterCounts();
          }}
          disabled={loading || countsLoading}
          title="Refresh"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40 transition-all dark:bg-gray-900 dark:border-white/[0.08] dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/[0.04]"
        >
          <RefreshCw
            size={13}
            className={loading || countsLoading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total users",
            value: allUsersCount,
            color: "text-gray-900 dark:text-white",
          },
          {
            label: "Online",
            value: displayedOnlineCount,
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Banned",
            value: filterCounts.banned ?? 0,
            color: "text-rose-600 dark:text-rose-400",
          },
          {
            label: "Google auth",
            value: filterCounts.google ?? 0,
            color: "text-blue-600 dark:text-blue-400",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white border border-gray-200 rounded-xl p-3.5 dark:bg-gray-900 dark:border-white/[0.06]"
          >
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            {countsLoading ? (
              <div className="h-7 w-12 rounded-md bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
            ) : (
              <p className={`text-xl font-semibold ${color}`}>{fmt(value)}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveFilter(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeFilter === id
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                  : "bg-transparent text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-100 dark:border-white/[0.08] dark:hover:text-gray-300 dark:hover:bg-white/[0.04]"
              }`}
            >
              {label}
              {displayedFilterCounts[id] != null && (
                <span
                  className={`px-1.5 rounded-full text-[10px] ${
                    activeFilter === id
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-600"
                  }`}
                >
                  {displayedFilterCounts[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="h-9 pl-8 pr-8 rounded-lg text-sm bg-white border border-gray-200 text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-500/60 w-48 transition-colors dark:bg-gray-900 dark:border-white/[0.08] dark:text-white dark:placeholder-gray-600 dark:focus:border-emerald-500/40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 px-3 rounded-lg text-sm bg-white border border-gray-200 text-gray-600 outline-none focus:border-emerald-500/60 transition-colors dark:bg-gray-900 dark:border-white/[0.08] dark:text-gray-400 dark:focus:border-emerald-500/40"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-emerald-500/[0.07] border border-emerald-500/20 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center justify-center">
              {selected.size}
            </span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              {selected.size} user{selected.size > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkBan}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              <Ban size={12} /> Ban all
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} /> Delete all
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden dark:bg-gray-900 dark:border-white/[0.06]">
        {!loading && !error && users.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-white/[0.06]">
            <input
              type="checkbox"
              checked={selected.size === users.length && users.length > 0}
              onChange={toggleSelectAll}
              className="accent-emerald-500 flex-shrink-0"
            />
            <span className="text-xs font-medium text-gray-400 flex-1">
              User
            </span>
            <span className="text-xs font-medium text-gray-400 w-32 hidden sm:block">
              Email
            </span>
            <span className="text-xs font-medium text-gray-400 w-20 hidden md:block">
              Provider
            </span>
            <span className="text-xs font-medium text-gray-400 w-20">
              Status
            </span>
            <span className="text-xs font-medium text-gray-400 w-24 hidden lg:block">
              Joined
            </span>
            <span className="text-xs font-medium text-gray-400 w-16 text-right">
              Actions
            </span>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <span className="text-sm text-gray-400">Loading users...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
              <AlertCircle size={20} className="text-rose-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {error}
            </p>
            <button
              onClick={() => fetchUsers(pageRef.current)}
              className="text-xs text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {hasActiveFilters ? (
                <Search size={20} className="text-gray-400" />
              ) : (
                <Users size={20} className="text-gray-400" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {hasActiveFilters
                  ? "No users match your filters"
                  : "No users found"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {hasActiveFilters
                  ? "Try adjusting your search or filter criteria"
                  : "Users will appear here once they register"}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setActiveFilter("all");
                }}
                className="text-xs text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <div>
            {users.map((u, i) => {
              const isSelected = selected.has(u._id);
              const isActing = actionId === u._id;

              return (
                <div
                  key={u._id}
                  onClick={() => toggleSelect(u._id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                    ${
                      i < users.length - 1
                        ? "border-b border-gray-100 dark:border-white/[0.04]"
                        : ""
                    }
                    ${
                      isSelected
                        ? "bg-emerald-500/[0.06]"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(u._id)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-emerald-500 flex-shrink-0"
                  />

                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Avatar user={u} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {u.fName} {u.lName}
                      </p>
                      <p className="text-xs text-gray-400 truncate sm:hidden">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 w-32 truncate hidden sm:block">
                    {u.email}
                  </p>

                  <div className="w-20 hidden md:block">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-[0.5px] ${
                        u.authProvider === "google"
                          ? "bg-blue-500/10 text-blue-600 ring-blue-500/25 dark:text-blue-400"
                          : "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400"
                      }`}
                    >
                      {u.authProvider}
                    </span>
                  </div>

                  <div className="w-20">
                    {u.isBanned ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 ring-[0.5px] ring-rose-500/25 dark:text-rose-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400 flex-shrink-0" />
                        Banned
                      </span>
                    ) : onlineUser.has(u._id) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 ring-[0.5px] ring-emerald-500/25 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse flex-shrink-0" />
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 ring-[0.5px] ring-gray-200 dark:bg-white/[0.04] dark:ring-white/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 flex-shrink-0" />
                        Offline
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 w-24 whitespace-nowrap hidden lg:block">
                    {new Date(u.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                  </p>

                  <div
                    className="flex gap-1.5 w-16 justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleBan(u)}
                      disabled={isActing}
                      title={u.isBanned ? "Unban user" : "Ban user"}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ring-[0.5px] transition-all disabled:opacity-40 ${
                        u.isBanned
                          ? "bg-emerald-500/10 ring-emerald-500/25 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-rose-500/10 ring-rose-500/25 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                      }`}
                    >
                      {isActing ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : u.isBanned ? (
                        <CheckCircle size={13} />
                      ) : (
                        <Ban size={13} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(u._id)}
                      disabled={isActing}
                      title="Delete user"
                      className="w-7 h-7 rounded-lg flex items-center justify-center ring-[0.5px] bg-rose-500/10 ring-rose-500/25 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} of {fmt(total)}{" "}
            {hasActiveFilters ? "results" : "users"}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => fetchUsers(page - 1)}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-all dark:bg-gray-900 dark:border-white/[0.06] dark:text-gray-400 dark:hover:text-white"
            >
              <ChevronLeft size={14} />
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => fetchUsers(n)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                  n === page
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-gray-200 text-gray-500 hover:text-gray-900 dark:bg-gray-900 dark:border-white/[0.06] dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => fetchUsers(page + 1)}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-all dark:bg-gray-900 dark:border-white/[0.06] dark:text-gray-400 dark:hover:text-white"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
