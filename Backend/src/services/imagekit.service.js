const imagekit = require('../config/imagekit');

/**
 * Uploads a file buffer to ImageKit.
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - Destination file name
 * @param {string} folder - Target folder on ImageKit (default: '/chat_media')
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<Object>} Formatted media object
 */
const uploadMedia = async (buffer, fileName, folder = '/chat_media', mimeType = 'application/octet-stream') => {
  try {
    const uploadResponse = await imagekit.upload({
      file: buffer.toString('base64'),
      fileName,
      folder,
      useUniqueFileName: true,
    });

    return {
      url: uploadResponse.url,
      fileId: uploadResponse.fileId,
      fileName: uploadResponse.name,
      fileType: uploadResponse.fileType || 'non-image',
      mimeType,
      fileSize: uploadResponse.size,
      width: uploadResponse.width || null,
      height: uploadResponse.height || null,
      thumbnailUrl: uploadResponse.thumbnailUrl || null,
    };
  } catch (error) {
    const err = new Error(`ImageKit upload failed: ${error.message}`);
    err.statusCode = 502;
    err.code = 'IMAGEKIT_UPLOAD_ERROR';
    throw err;
  }
};

/**
 * Deletes a file from ImageKit by fileId.
 * @param {string} fileId - The ImageKit fileId
 * @returns {Promise<Object>} Deletion result
 */
const deleteMedia = async (fileId) => {
  if (!fileId) return null;
  try {
    const result = await imagekit.deleteFile(fileId);
    return result;
  } catch (error) {
    // If already deleted or not found, log but do not crash
    console.warn(`[ImageKit] Warning: Failed to delete media with fileId ${fileId}: ${error.message}`);
    return null;
  }
};

/**
 * Generates authentication parameters for client-side uploads.
 * @returns {Object} Auth parameters (token, expire, signature)
 */
const getAuthParams = () => {
  try {
    return imagekit.getAuthenticationParameters();
  } catch (error) {
    const err = new Error(`ImageKit auth params generation failed: ${error.message}`);
    err.statusCode = 500;
    err.code = 'IMAGEKIT_AUTH_ERROR';
    throw err;
  }
};

module.exports = {
  uploadMedia,
  deleteMedia,
  getAuthParams,
};
