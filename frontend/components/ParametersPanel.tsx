'use client';

interface ParametersPanelProps {
  mfeSteps: number;
  setMfeSteps: (value: number) => void;
  speechRate: number;
  setSpeechRate: (value: number) => void;
}

export default function ParametersPanel({
  mfeSteps,
  setMfeSteps,
  speechRate,
  setSpeechRate,
}: ParametersPanelProps) {
  return (
    <div className="w-56 bg-gradient-to-b from-yellow-300 to-yellow-400 border-l-4 border-black p-5 flex flex-col overflow-y-auto">
      {/* Header */}
      <h2 className="text-xs font-bold text-black mb-6 uppercase tracking-wider">⚙ Parameters</h2>

      {/* Acoustic Model */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-black mb-2 uppercase tracking-wide">
          Acoustic Model
        </label>
        <select className="w-full border-2 border-black bg-white text-black p-2 rounded text-xs font-semibold">
          <option>GEMMA 3-8 (MDIC)</option>
          <option>GEMMA 2-27</option>
          <option>PHI-3</option>
        </select>
      </div>

      {/* MFE Steps */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-black mb-2 uppercase tracking-wide">
          MFE Steps
        </label>
        <div className="flex gap-3 items-center">
          <input
            type="range"
            min="8"
            max="64"
            value={mfeSteps}
            onChange={(e) => setMfeSteps(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gradient-to-r from-red-500 to-blue-500 rounded-lg appearance-none cursor-pointer accent-black"
          />
          <span className="text-xs font-bold text-black bg-white px-2 py-1 rounded border border-black min-w-12 text-center">
            {mfeSteps}
          </span>
        </div>
      </div>

      {/* Speech Rate */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-black mb-2 uppercase tracking-wide">
          Speech Rate
        </label>
        <div className="flex gap-3 items-center">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gradient-to-r from-red-500 to-blue-500 rounded-lg appearance-none cursor-pointer accent-black"
          />
          <span className="text-xs font-bold text-black bg-white px-2 py-1 rounded border border-black min-w-12 text-center">
            {speechRate.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* GPU Acceleration */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-black mb-2 uppercase tracking-wide">
          GPU Acceleration
        </label>
        <button className="w-full bg-yellow-300 hover:bg-yellow-500 border-2 border-black text-black font-bold py-2 px-3 rounded text-xs uppercase transition-all transform hover:scale-105">
          ⚡ Tensor Optimize3
        </button>
      </div>

      {/* Divider */}
      <div className="h-1 bg-black my-4"></div>

      {/* Reference Audio Section */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-black mb-3 uppercase tracking-wide">
          Reference Audio (Clone)
        </label>
        <div className="border-2 border-dashed border-black rounded-lg p-6 bg-white/20 text-center cursor-pointer hover:bg-white/40 transition-all">
          <div className="text-2xl mb-2">📁</div>
          <p className="text-xs font-bold text-black">Upload WAV/MP3</p>
          <small className="text-xs text-gray-700">Max 10S</small>
          <input type="file" accept="audio/*" className="hidden" />
        </div>
      </div>

      {/* Reference Transcript */}
      <div>
        <label className="block text-xs font-bold text-black mb-2 uppercase tracking-wide">
          Reference Transcript
        </label>
        <textarea
          placeholder="Enter reference transcript here..."
          className="w-full border-2 border-black bg-white text-black p-2 rounded text-xs resize-none h-24"
        />
      </div>
    </div>
  );
}
