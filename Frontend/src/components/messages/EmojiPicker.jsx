import React, { useEffect, useRef } from 'react';
import Picker, { Theme } from 'emoji-picker-react';
import { useTheme } from '../../hooks/useTheme';

export const EmojiPicker = ({ isOpen, onEmojiSelect, onClose }) => {
  const { isDark } = useTheme();
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target) &&
        !event.target.closest('[data-emoji-trigger]')
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 mb-3 z-40 shadow-2xl rounded-2xl animate-fade-in"
    >
      <Picker
        onEmojiClick={(emojiData) => {
          onEmojiSelect(emojiData.emoji);
        }}
        theme={isDark ? Theme.DARK : Theme.LIGHT}
        autoFocusSearch={false}
        searchPlaceHolder="Search emoji..."
        width={340}
        height={400}
        previewConfig={{
          showPreview: false,
        }}
      />
    </div>
  );
};

export default EmojiPicker;
