const imageKitService = require('../services/imagekit.service');
const { validateMagicBytes } = require('../middleware/upload.middleware');
const Message = require('../models/message.model');
const User = require('../models/user.model');

/**
 * POST /api/media/upload
 * Uploads media file to ImageKit from memory buffer.
 * Does not store message in DB yet — client submits returned metadata to message endpoint.
 */
const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file received in request',
        code: 'FILE_MISSING',
      });
    }

    // Secondary validation of file signature (magic bytes)
    const isMagicBytesValid = validateMagicBytes(req.file.buffer, req.file.mimetype);
    if (!isMagicBytesValid) {
      return res.status(400).json({
        success: false,
        message: 'File content does not match its declared type',
        code: 'INVALID_FILE_SIGNATURE',
      });
    }

    // Determine target ImageKit folder
    const folder = req.file.mimetype.startsWith('image/')
      ? '/chat_images'
      : req.file.mimetype.startsWith('video/')
      ? '/chat_videos'
      : req.file.mimetype.startsWith('audio/')
      ? '/chat_audio'
      : '/chat_documents';

    const uploadedMedia = await imageKitService.uploadMedia(
      req.file.buffer,
      req.file.uniqueName || `${Date.now()}_${req.file.originalname}`,
      folder,
      req.file.mimetype
    );

    return res.status(201).json({
      success: true,
      media: uploadedMedia,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/media/:fileId
 * Deletes media from ImageKit after checking user authorization/ownership.
 */
const deleteMedia = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const currentUserId = req.user.id;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'fileId is required',
        code: 'MISSING_FILE_ID',
      });
    }

    // Check if the file is attached to any message
    const message = await Message.findOne({ 'media.fileId': fileId });

    if (message) {
      // Must be sender of the message to delete its media
      if (message.sender.toString() !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not own the message containing this media',
          code: 'FORBIDDEN',
        });
      }

      await imageKitService.deleteMedia(fileId);
      message.media = undefined;
      await message.save();

      return res.status(200).json({
        success: true,
        message: 'Media deleted and removed from message',
      });
    }

    // Check if file is user's profile picture
    const user = await User.findOne({ _id: currentUserId, 'profilePicture.fileId': fileId });
    if (user) {
      await imageKitService.deleteMedia(fileId);
      user.profilePicture = { url: '', fileId: '' };
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Profile picture deleted',
      });
    }

    // If unattached, delete from ImageKit
    await imageKitService.deleteMedia(fileId);

    return res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadMedia,
  deleteMedia,
};
