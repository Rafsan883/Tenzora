import Settings from '../models/Settings.js';

// @desc    Get user settings
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update user settings
export const updateSettings = async (req, res) => {
  try {
    const { titleLanguage, videoLanguage, skipSeconds, bookmarksPerPage, autoPlay, autoNext, themeColor } = req.body;

    const settings = await Settings.findOneAndUpdate(
      { user: req.user._id },
      { 
        titleLanguage, 
        videoLanguage, 
        skipSeconds, 
        bookmarksPerPage, 
        autoPlay, 
        autoNext,
        themeColor,
        updatedAt: Date.now() 
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: error.name === 'ValidationError' ? error.message : 'Server error' });
  }
};
