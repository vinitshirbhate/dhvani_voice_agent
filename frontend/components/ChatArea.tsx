'use client';

import { useRef } from 'react';

interface ChatAreaProps {
  text: string;
  onTextChange: (text: string) => void;
  isLoading: boolean;
  onSynthesize: () => void;
  onDownload: () => void;
  lastAudioPath: string;
  error: string;
  success: string;
}

export default function ChatArea({
  text,
  onTextChange,
  isLoading,
  onSynthesize,
  onDownload,
  lastAudioPath,
  error,
  success,
}: ChatAreaProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex-1 bg-gray-200 border-l-4 border-r-4 border-black flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-black mb-2">IndicF5 TTS</h1>
        <p className="text-sm text-gray-700">Text-to-Speech for Hindi & Marathi</p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-300 border-2 border-red-600 rounded text-red-900 text-sm font-semibold">
          ❌ {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-300 border-2 border-green-600 rounded text-green-900 text-sm font-semibold">
          ✅ {success}
        </div>
      )}

      {/* Text Input Area */}
      <div className="mb-6 flex-1 flex flex-col">
        <label className="text-xs font-bold text-black mb-2 uppercase tracking-wider">Text to Synthesize</label>
        <textarea
          ref={textAreaRef}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Enter the text you want to convert to speech..."
          className="flex-1 border-2 border-black bg-white text-black p-3 rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Audio Preview */}
      {lastAudioPath && (
        <div className="mb-6 p-4 bg-white border-2 border-black rounded">
          <label className="text-xs font-bold text-black mb-3 block uppercase tracking-wider">Generated Audio Preview</label>
          <audio
            controls
            className="w-full border-2 border-black rounded"
          >
            <source src={`/${lastAudioPath}`} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
          <p className="text-xs text-gray-600 mt-2">📁 {lastAudioPath}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 items-center">
        <button
          onClick={onSynthesize}
          disabled={isLoading || !text.trim()}
          className={`flex-1 font-bold py-3 px-4 rounded border-2 border-black transition-all uppercase text-sm ${
            isLoading || !text.trim()
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-yellow-400 hover:bg-yellow-500 text-black hover:scale-105'
          }`}
        >
          {isLoading ? '⏳ Generating...' : '🎵 Synthesize'}
        </button>
        <button
          onClick={onDownload}
          disabled={!lastAudioPath}
          className={`flex-1 font-bold py-3 px-4 rounded border-2 border-black transition-all uppercase text-sm ${
            !lastAudioPath
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-green-400 hover:bg-green-500 text-black hover:scale-105'
          }`}
        >
          ⬇ Download
        </button>
      </div>
    </div>
  );
}
