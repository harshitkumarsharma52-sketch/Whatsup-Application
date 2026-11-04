import React, { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export const MediaPreview = ({ src, type = 'image', name = 'media', onClose }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!src) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = name;
    a.target = '_blank';
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isVideo = type === 'video' || src.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity">
      {/* Top action bar */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
        {!isVideo && (
          <>
            <button
              onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => setScale(1)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </>
        )}
        <button
          onClick={handleDownload}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Download"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Close (Esc)"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Media container */}
      <div
        className="w-full h-full flex items-center justify-center p-4 select-none overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {isVideo ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl object-contain outline-none"
          />
        ) : (
          <img
            src={src}
            alt={name}
            style={{
              transform: `scale(${scale})`,
              transition: 'transform 0.15s ease-out',
            }}
            className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl object-contain cursor-grab active:cursor-grabbing"
          />
        )}
      </div>
    </div>
  );
};

export default MediaPreview;
