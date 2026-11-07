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

// Shared button look: works without any custom Tailwind config
const ICON_BTN =
  'p-2.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ' +
  'hover:bg-gray-100 dark:hover:bg-dark-input transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50';

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
  const sendingRef = useRef(false); // blocks double-send (fast Enter / double tap)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [text]);

  // Clean up typing indicator and recording on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        discardRecordingRef.current = true;
        mediaRecorderRef.current.stop();
      }
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
    // reset input so the same file can be picked again
    e.target.value = '';
  };

  const uploadTo = async (endpoint, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(endpoint, formData, {
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
  };

  const uploadSelectedFile = async (file) => {
    try {
      return await uploadTo('/media/upload', file);
    } catch {
      // Fallback endpoint
      return await uploadTo('/upload', file);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !selectedFile) return;
    if (sendingRef.current) return;
    sendingRef.current = true;

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
      if (onCancelReply) onCancelReply();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to send message');
      console.error(error);
    } finally {
      sendingRef.current = false;
      setUploadProgress(null);
      // keep the keyboard open on mobile after sending
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e) => {
    // ignore Enter while an IME (Hindi/Chinese keyboards) is composing text
    if (e.nativeEvent?.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
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
    // pb uses the phone's home-bar inset directly, so no custom CSS class is needed
    <div className="sticky bottom-0 z-30 shrink-0 border-t border-gray-200 bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-colors dark:border-gray-800 dark:bg-dark-header">
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
        <div className="flex items-center justify-between rounded-full border border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 animate-ping rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Recording {formatRecordTime(recordingSeconds)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="rounded px-3 py-1 text-xs text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={toggleRecording}
              className="rounded-full bg-red-500 p-2 text-white hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              title="Stop and send"
              aria-label="Stop recording"
            >
              <MicOff className="h-4 w-4" />
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
            className={ICON_BTN}
            title="Choose emoji"
            aria-label="Choose emoji"
          >
            <Smile className="h-5 w-5" />
          </button>

          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={ICON_BTN}
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Auto-expanding Textarea */}
          <div className="min-w-0 flex-1 rounded-2xl border border-transparent bg-gray-100 px-4 py-2 transition-colors focus-within:border-primary-500 dark:bg-dark-input">
            <textarea
              ref={textareaRef}
              style={{ outline: 'none', boxShadow: 'none' }} // beats the global textarea:focus-visible outline
              rows={1}
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={disabled || isUploading}
              placeholder="Type a message..."
              aria-label="Type a message"
              className="max-h-32 w-full resize-none bg-transparent text-sm leading-5 text-gray-900 placeholder-gray-500 outline-none dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>

          {/* Send or Voice Record button */}
          {text.trim() || selectedFile ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || isUploading}
              className="transform rounded-full bg-primary-500 p-2.5 text-white shadow-md transition-all hover:scale-105 hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-95 active:bg-primary-700 disabled:opacity-50"
              title="Send message"
              aria-label="Send message"
            >
              <Send className="ml-0.5 h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleRecording}
              className={ICON_BTN}
              title="Record voice message"
              aria-label="Record voice message"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageInput;