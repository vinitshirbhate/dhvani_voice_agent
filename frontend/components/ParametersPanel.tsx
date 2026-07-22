'use client';

import { useRef } from 'react';

interface ParametersPanelProps {
  audioType: 'hindi' | 'marathi' | 'custom';
  sampleRate: number;
  setSampleRate: (rate: number) => void;
  refAudio?: File;
  setRefAudio: (file: File | undefined) => void;
  refText?: string;
  setRefText: (text: string) => void;
}

export default function ParametersPanel({
  audioType,
  sampleRate,
  setSampleRate,
  refAudio,
  setRefAudio,
  refText,
  setRefText,
}: ParametersPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefAudio(file);
    }
  };

  const handleClearFile = () => {
    setRefAudio(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-64 bg-gradient-to-b from-yellow-300 to-yellow-400 border-l-4 border-black p-5 flex flex-col overflow-y-auto">
      {/* Header */}
      <h2 className="text-xs font-bold text-black mb-6 uppercase tracking-wider">⚙ Parameters</h2>

      {/* Audio Type Display */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-black mb-2 uppercase tracking-wide">
          Audio Type
        </label>
        <div className="bg-white border-2 border-black rounded p-2 text-xs font-bold text-black uppercase text-center">
          {audioType === 'hindi' && '🇮🇳 Hindi'}
          {audioType === 'marathi' && '🇮🇳 Marathi'}
          {audioType === 'custom' && '🎙️ Custom Voice'}
        </div>
      </div>

      {/* Sample Rate */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-black mb-2 uppercase tracking-wide">
          Sample Rate (Hz)
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min="16000"
            max="44100"
            step="1000"
            value={sampleRate}
            onChange={(e) => setSampleRate(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gradient-to-r from-red-500 to-blue-500 rounded-lg appearance-none cursor-pointer accent-black"
          />
          <span className="text-xs font-bold text-black bg-white px-2 py-1 rounded border border-black min-w-20 text-center">
            {sampleRate}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-1 bg-black my-4"></div>

      {/* Conditional: Custom Voice Mode */}
      {audioType === 'custom' && (
        <>
          {/* Reference Audio Upload */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-black mb-3 uppercase tracking-wide">
              Reference Audio
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-black rounded-lg p-4 bg-white/40 text-center cursor-pointer hover:bg-white/60 transition-all"
            >
              <div className="text-2xl mb-2">📁</div>
              <p className="text-xs font-bold text-black">Click to upload</p>
              <small className="text-xs text-gray-700">WAV, MP3, OGG</small>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {refAudio && (
              <div className="mt-2 p-2 bg-white border-2 border-black rounded">
                <p className="text-xs font-bold text-black truncate">✅ {refAudio.name}</p>
                <button
                  onClick={handleClearFile}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold mt-1"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Reference Transcript */}
          <div>
            <label className="block text-xs font-bold text-black mb-2 uppercase tracking-wide">
              Reference Transcript
            </label>
            <textarea
              value={refText || ''}
              onChange={(e) => setRefText(e.target.value)}
              placeholder="Enter the text corresponding to the reference audio (optional for ASR)..."
              className="w-full border-2 border-black bg-white text-black p-2 rounded text-xs resize-none h-20 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <small className="text-xs text-gray-700 block mt-1">
              If not provided, ASR will transcribe the audio automatically.
            </small>
          </div>
        </>
      )}

      {/* Info for Non-Custom Modes */}
      {audioType !== 'custom' && (
        <div className="p-3 bg-white/40 border-2 border-black rounded text-xs text-gray-800">
          <p className="font-semibold mb-1">📌 Using Default Settings</p>
          <p>
            {audioType === 'hindi'
              ? 'Using Hindi reference audio from samples/hindi.wav'
              : 'Using Marathi reference audio from samples/mar.wav'}
          </p>
        </div>
      )}
    </div>
  );
}
