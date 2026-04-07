import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";

export const getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      totalChats,
      messagesToday,
      callsToday,
      totalCalls,
    ] = await Promise.all([
      User.countDocuments({ isAdmin: { $ne: true } }),
      User.countDocuments({ isOnline: true, isAdmin: { $ne: true } }),
      User.countDocuments({ isBanned: true }),
      Chat.countDocuments(),
      Message.countDocuments({
        createdAt: { $gte: startOfDay },
        messageType: { $ne: "call" },
      }),
      Message.countDocuments({
        createdAt: { $gte: startOfDay },
        messageType: "call",
      }),
      Message.countDocuments({ messageType: "call" }),
    ]);

    // Messages per day for last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const messageActivity = await Promise.all(
      last7Days.map(async (day) => {
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        const count = await Message.countDocuments({
          createdAt: { $gte: day, $lt: nextDay },
          messageType: { $ne: "call" },
        });
        return {
          date: day.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          messages: count,
        };
      })
    );

    res.json({
      totalUsers,
      activeUsers,
      bannedUsers,
      totalChats,
      messagesToday,
      callsToday,
      totalCalls,
      messageActivity,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch stats", error: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const query = {
      isAdmin: { $ne: true },
      ...(search && {
        $or: [
          { fName: { $regex: search, $options: "i" } },
          { lName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -refreshToken")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      users,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isAdmin)
      return res.status(403).json({ message: "Cannot delete admin" });

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete user", error: error.message });
  }
};

export const banUser = async (req, res) => {
  try {
    const { reason = "" } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isAdmin)
      return res.status(403).json({ message: "Cannot ban admin" });

    user.isBanned = true;
    user.bannedAt = new Date();
    user.banReason = reason;
    await user.save();

    res.json({ message: "User banned", user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to ban user", error: error.message });
  }
};

export const unbanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.isBanned = false;
    user.bannedAt = null;
    user.banReason = "";
    await user.save();

    res.json({ message: "User unbanned", user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to unban user", error: error.message });
  }
};

export const getCallAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // ── Totals ──
    const [total, completed, missed, rejected, audio, video] =
      await Promise.all([
        Message.countDocuments({ messageType: "call" }),
        Message.countDocuments({
          messageType: "call",
          "callData.status": "completed", // ✅ was callDetails.status
        }),
        Message.countDocuments({
          messageType: "call",
          "callData.status": "missed", // ✅
        }),
        Message.countDocuments({
          messageType: "call",
          "callData.status": "rejected", // ✅
        }),
        Message.countDocuments({
          messageType: "call",
          "callData.callType": "audio", // ✅ was callDetails.callType
        }),
        Message.countDocuments({
          messageType: "call",
          "callData.callType": "video", // ✅
        }),
      ]);

    // ── Average duration (completed calls only) ──
    const durationAgg = await Message.aggregate([
      { $match: { messageType: "call", "callData.status": "completed" } }, // ✅
      {
        $group: {
          _id: null,
          avg: { $avg: "$callData.duration" }, // ✅ was $callDetails.duration
          total: { $sum: "$callData.duration" }, // ✅
        },
      },
    ]);
    const avgDuration = Math.round(durationAgg[0]?.avg ?? 0);
    const totalDuration = durationAgg[0]?.total ?? 0;

    // ── Calls per day — last 14 days ──
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const dailyActivity = await Promise.all(
      last14Days.map(async (day) => {
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        const [dayTotal, dayCompleted] = await Promise.all([
          Message.countDocuments({
            messageType: "call",
            createdAt: { $gte: day, $lt: nextDay },
          }),
          Message.countDocuments({
            messageType: "call",
            "callData.status": "completed", // ✅
            createdAt: { $gte: day, $lt: nextDay },
          }),
        ]);
        return {
          date: day.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          total: dayTotal,
          completed: dayCompleted,
        };
      })
    );

    // ── Average calls per day (last 14 days) ──
    const avgCallsPerDay = +(
      dailyActivity.reduce((s, d) => s + d.total, 0) / 14
    ).toFixed(1);

    // ── Peak hour (hour of day with most calls) ──
    const hourAgg = await Message.aggregate([
      { $match: { messageType: "call" } },
      { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);
    const peakHour = hourAgg[0]?._id ?? null;
    const formatHour = (h) => {
      if (h === null) return "—";
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:00 ${ampm}`;
    };

    res.json({
      total,
      completed,
      missed,
      rejected,
      audio,
      video,
      avgDuration,
      totalDuration,
      avgCallsPerDay,
      peakHour: formatHour(peakHour),
      connectionRate: total > 0 ? +((completed / total) * 100).toFixed(1) : 0,
      dailyActivity,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch call analytics",
      error: error.message,
    });
  }
};
