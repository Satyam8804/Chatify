import Background from "../models/background.model.js";
import UserBackground from "../models/userBackground.model.js";
import User from "../models/user.model.js";
import Chat from "../models/chat.model.js";
import {
  uploadPresetBackground,
  uploadUserBackground,
} from "../utils/cloudinaryUpload.js";

export const createPresetBackground = async (req, res) => {
  try {
    const { name, category, type, tags, sortOrder } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const { assetUrl, thumbnailUrl } = await uploadPresetBackground(
      req.file.buffer,
      req.file.originalname
    );

    const background = await Background.create({
      name,
      category,
      type,
      tags: tags ? JSON.parse(tags) : [],
      sortOrder: sortOrder || 0,
      assetUrl,
      thumbnailUrl,
    });

    res.status(201).json(background);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllPresetBackgrounds = async (req, res) => {
  try {
    const { category, type, isActive } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const backgrounds = await Background.find(filter).sort({ sortOrder: 1 });

    res.status(200).json(backgrounds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePresetBackground = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, type, tags, sortOrder } = req.body;

    const background = await Background.findById(id);
    if (!background) {
      return res.status(404).json({ message: "Background not found" });
    }

    if (req.file) {
      const { assetUrl, thumbnailUrl } = await uploadPresetBackground(
        req.file.buffer,
        req.file.originalname
      );
      background.assetUrl = assetUrl;
      background.thumbnailUrl = thumbnailUrl;
    }

    if (name) background.name = name;
    if (category) background.category = category;
    if (type) background.type = type;
    if (tags) background.tags = JSON.parse(tags);
    if (sortOrder !== undefined) background.sortOrder = sortOrder;

    await background.save();

    res.status(200).json(background);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const togglePresetBackground = async (req, res) => {
  try {
    const { id } = req.params;

    const background = await Background.findById(id);
    if (!background) {
      return res.status(404).json({ message: "Background not found" });
    }

    background.isActive = !background.isActive;
    await background.save();

    res.status(200).json(background);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePresetBackground = async (req, res) => {
  try {
    const { id } = req.params;

    const background = await Background.findByIdAndDelete(id);
    if (!background) {
      return res.status(404).json({ message: "Background not found" });
    }

    res.status(200).json({ message: "Background deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadCustomBackground = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const { assetUrl, thumbnailUrl, fileSize, fileName } =
      await uploadUserBackground(
        req.file.buffer,
        req.file.originalname,
        req.user._id
      );

    const userBackground = await UserBackground.create({
      user: req.user._id,
      assetUrl,
      thumbnailUrl,
      fileSize,
      fileName,
    });

    res.status(201).json(userBackground);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyUploadedBackgrounds = async (req, res) => {
  try {
    const backgrounds = await UserBackground.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json(backgrounds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCustomBackground = async (req, res) => {
  try {
    const { id } = req.params;

    const background = await UserBackground.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!background) {
      return res.status(404).json({ message: "Background not found" });
    }

    await background.deleteOne();

    res.status(200).json({ message: "Background deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setDefaultBackground = async (req, res) => {
  try {
    const { backgroundType, backgroundRef } = req.body;

    if (backgroundType === null && backgroundRef === null) {
      await User.findByIdAndUpdate(req.user._id, {
        defaultBackground: { backgroundType: null, backgroundRef: null },
      });
      return res.status(200).json({ message: "Default background cleared" });
    }

    if (!["Background", "UserBackground"].includes(backgroundType)) {
      return res.status(400).json({ message: "Invalid background type" });
    }

    if (backgroundType === "Background") {
      const exists = await Background.findById(backgroundRef);
      if (!exists)
        return res.status(404).json({ message: "Preset background not found" });
    }

    if (backgroundType === "UserBackground") {
      const exists = await UserBackground.findOne({
        _id: backgroundRef,
        user: req.user._id,
      });
      if (!exists)
        return res.status(404).json({ message: "Custom background not found" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      defaultBackground: { backgroundType, backgroundRef },
    });

    res.status(200).json({ message: "Default background updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setChatBackground = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { backgroundType, backgroundRef } = req.body;

    const chat = await Chat.findOne({ _id: chatId, users: req.user._id });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (backgroundType === null && backgroundRef === null) {
      chat.backgroundOverride = { backgroundType: null, backgroundRef: null };
      await chat.save();
      return res.status(200).json({ message: "Chat background reset to default" });
    }

    if (!["Background", "UserBackground"].includes(backgroundType)) {
      return res.status(400).json({ message: "Invalid background type" });
    }

    if (backgroundType === "Background") {
      const exists = await Background.findById(backgroundRef);
      if (!exists)
        return res.status(404).json({ message: "Preset background not found" });
    }

    if (backgroundType === "UserBackground") {
      const exists = await UserBackground.findOne({
        _id: backgroundRef,
        user: req.user._id,
      });
      if (!exists)
        return res.status(404).json({ message: "Custom background not found" });
    }

    chat.backgroundOverride = { backgroundType, backgroundRef };
    await chat.save();

    res.status(200).json({ message: "Chat background updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBackgroundsForPicker = async (req, res) => {
  try {
    const [presets, myUploads] = await Promise.all([
      Background.find({ isActive: true }).sort({ sortOrder: 1 }),
      UserBackground.find({ user: req.user._id }).sort({ createdAt: -1 }),
    ]);

    const user = await User.findById(req.user._id).select("defaultBackground");

    res.status(200).json({
      presets,
      myUploads,
      currentDefault: user.defaultBackground,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};