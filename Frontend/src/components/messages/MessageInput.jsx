import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import {
  Smile,
  Paperclip,
  Send,
  Mic,
  MicOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReplyPreview from './ReplyPreview';
import FileUploadPreview from '../media/FileUploadPreview';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const EmojiPicker = lazy(() => import('./EmojiPicker'));

export const MessageInput = ({
  conversationId,
  onSendMessage,
  replyTo,
  onCancelReply,
  disabled = false,
}) => {
  const { emitTypingStart, emitTypingStop } = useSocket();

  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const discardRecordingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [text]);

  // Clean up typing indicator on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      if (isTypingRef.current && conversationId) {
        emitTypingStop(conversationId);
      }
    };
  }, [conversationId, emitTypingStop]);

  // Handle typing emissions
  const handleTyping = () => {
    if (!conversationId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTypingStart(conversationId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emitTypingStop(conversationId);
    }, 1800);
  };

  const handleInputChange = (e) => {
    setText(e.target.value);
    handleTyping();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = file.type.startsWith('video/')
        ? 100 * 1024 * 1024
        : file.type.startsWith('audio/')
          ? 20 * 1024 * 1024
          : file.type.startsWith('image/')
            ? 10 * 1024 * 1024
            : 25 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`This file exceeds the ${Math.round(maxSize / 1024 / 1024)}MB limit`);
        return;
      }
      setSelectedFile(file);
    }
    // reset input
    e.target.value = '';
  };

  const uploadSelectedFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(percent);
        },
      });

      const media = res.data?.media || res.data;
      return {
        url: media?.url || media?.fileUrl || res.data?.url,
        fileId: media?.fileId,
        fileName: media?.fileName || file.name,
        fileType: media?.fileType,
        mimeType: media?.mimeType || file.type,
        fileSize: media?.fileSize || file.size,
        thumbnailUrl: media?.thumbnailUrl,
      };
    } catch (err) {
      // Fallback try /upload
      const res2 = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(percent);
        },
      });
      const media2 = res2.data?.media || res2.data;
      return {
        url: media2?.url || media2?.fileUrl || res2.data?.url,
        fileId: media2?.fileId,
        fileName: media2?.fileName || file.name,
        fileType: media2?.fileType,
        mimeType: media2?.mimeType || file.type,
        fileSize: media2?.fileSize || file.size,
        thumbnailUrl: media2?.thumbnailUrl,
      };
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !selectedFile) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    emitTypingStop(conversationId);

    try {
      let uploadedMedia = null;
      if (selectedFile) {
        setUploadProgress(0);
        uploadedMedia = await uploadSelectedFile(selectedFile);
        if (!uploadedMedia?.url) {
          throw new Error('Upload succeeded but no media URL was returned');
        }
      }

      await onSendMessage({
        content: trimmed,
        mediaUrl: uploadedMedia?.url || null,
        mediaType: uploadedMedia?.mimeType || selectedFile?.type || null,
        mediaSize: uploadedMedia?.fileSize || selectedFile?.size || null,
        mediaName: uploadedMedia?.fileName || selectedFile?.name || null,
        media: uploadedMedia || undefined,
        replyTo,
      });

      // Clear input fields
      setText('');
      setSelectedFile(null);
      setUploadProgress(null);
      if (onCancelReply) onCancelReply();

      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to send message');
      console.error(error);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      clearInterval(recordingTimerRef.current);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      discardRecordingRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0);
        if (!discardRecordingRef.current && recordingChunksRef.current.length) {
          const type = recorder.mimeType || 'audio/webm';
          const extension = type.includes('ogg') ? 'ogg' : 'webm';
          setSelectedFile(new File(recordingChunksRef.current, `voice-message.${extension}`, { type }));
        }
      };
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (error) {
      toast.error(error.name === 'NotAllowedError' ? 'Allow microphone access to record audio' : 'Could not start audio recording');
    }
  };

  const cancelRecording = () => {
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatRecordTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isUploading = uploadProgress !== null;

  return (
    <div className="safe-area-bottom sticky bottom-0 z-30 flex-shrink-0 border-t border-gray-200 bg-white p-3 transition-colors dark:border-gray-800 dark:bg-dark-header">
      {/* Reply Preview */}
      <ReplyPreview replyTo={replyTo} onCancel={onCancelReply} />

      {/* File Upload Preview */}
      <FileUploadPreview
        file={selectedFile}
        onRemove={() => setSelectedFile(null)}
        uploadProgress={uploadProgress}
      />

      {/* Emoji Picker Popup */}
      <Suspense fallback={null}>
        <EmojiPicker
          isOpen={showEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      </Suspense>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf"
      />

      {/* Input controls row */}
      {isRecording ? (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-950/30 rounded-full border border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Recording {formatRecordTime(recordingSeconds)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={toggleRecording}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full"
              title="Stop and send"
            >
              <MicOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-end space-x-2">
          {/* Emoji trigger button */}
          <button
            type="button"
            data-emoji-trigger
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="p-2.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors focus:outline-none"
            title="Choose emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors focus:outline-none disabled:opacity-50"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Auto-expanding Textarea */}
          <div className="flex-1 min-w-0 bg-chat-input dark:bg-dark-input rounded-2xl px-4 py-2 border border-transparent focus-within:border-primary-500 transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={disabled || isUploading}
              placeholder="Type a message..."
              className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none resize-none max-h-32 leading-5"
            />
          </div>

          {/* Send or Voice Record button */}
          {text.trim() || selectedFile ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || isUploading}
              className="p-2.5 rounded-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white shadow-md transition-all transform hover:scale-105 active:scale-95 focus:outline-none disabled:opacity-50"
              title="Send message"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleRecording}
              className="p-2.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-input transition-colors focus:outline-none"
              title="Record voice message"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageInput;
