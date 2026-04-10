import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";

import { onlineUsers } from "../sockets/presence.socket.js";

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
      bannedUsers,
      totalChats,
      messagesToday,
      callsToday,
      totalCalls,
    ] = await Promise.all([
      User.countDocuments({ isAdmin: { $ne: true } }),
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

    // ✅ Real-time count from in-memory map — always accurate
    const activeUsers = onlineUsers.size;

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const messageAgg = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days[0] },
          messageType: { $ne: "call" },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const messageMap = Object.fromEntries(
      messageAgg.map((m) => [m._id, m.count])
    );

    const messageActivity = last7Days.map((day) => {
      const key = day.toISOString().slice(0, 10);
      return {
        date: day.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        messages: messageMap[key] || 0,
      };
    });

    res.json({
      totalUsers,
      activeUsers, // ✅ from onlineUsers Map
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
    const {
      page = 1,
      limit = 20,
      search = "",
      filter = "all",
      sort = "newest",
    } = req.query;

    const base = { isAdmin: { $ne: true } };

    if (search) {
      base.$or = [
        { fName: { $regex: search, $options: "i" } },
        { lName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const onlineIds = Array.from(onlineUsers.keys());

    const filterMap = {
      online: onlineIds.length ? { _id: { $in: onlineIds } } : { _id: null },
      banned: { isBanned: true },
      google: { authProvider: { $in: ["google", "both"] } },
      local: { authProvider: "local" },
    };
    const query = { ...base, ...(filterMap[filter] ?? {}) };

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { fName: 1, lName: 1 },
      online: { createdAt: -1 }, // sorted client-side after online overlay
    };
    const sortOption = sortMap[sort] ?? { createdAt: -1 };

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -refreshToken")
        .sort(sortOption)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    res.json({
      users,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      // ✅ Always send the live online set so frontend can override DB field
      onlineUserIds: Array.from(onlineUsers.keys()),
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

    const userId = req.params.id;

    // 1. Find all chats this user is part of
    const userChats = await Chat.find({ users: userId });
    const chatIds = userChats.map((chat) => chat._id);

    // 2. Delete all messages in those chats
    await Message.deleteMany({ chat: { $in: chatIds } });

    // 3. Delete 1-on-1 chats — remove group chats user from users array instead
    await Chat.deleteMany({ isGroupChat: false, users: userId });

    // 4. For group chats, just pull the user out
    await Chat.updateMany(
      { isGroupChat: true, users: userId },
      { $pull: { users: userId } }
    );

    // 5. Delete user's sent messages in any other chats
    await Message.deleteMany({ sender: userId });

    // 6. Delete user's appeals
    await Appeal.deleteMany({ user: userId });

    // 7. Finally delete the user
    await User.findByIdAndDelete(userId);

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
    const [total, completed, missed, rejected, audio, video] =
      await Promise.all([
        Message.countDocuments({ messageType: "call" }),
        Message.countDocuments({
          messageType: "call",
          "callData.status": "completed",
        }),
        Message.countDocuments({
          messageType: "call",
          "callData.status": "missed",
        }),
        Message.countDocuments({
          messageType: "call",
          "callData.status": "rejected",
        }),
        Message.countDocuments({
          messageType: "call",
          "callData.callType": "audio",
        }),
        Message.countDocuments({
          messageType: "call",
          "callData.callType": "video",
        }),
      ]);

    const durationAgg = await Message.aggregate([
      { $match: { messageType: "call", "callData.status": "completed" } },
      {
        $group: {
          _id: null,
          avg: { $avg: "$callData.duration" },
          total: { $sum: "$callData.duration" },
        },
      },
    ]);
    const avgDuration = Math.round(durationAgg[0]?.avg ?? 0);

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
            "callData.status": "completed",
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

    const avgCallsPerDay = +(
      dailyActivity.reduce((s, d) => s + d.total, 0) / 14
    ).toFixed(1);

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
