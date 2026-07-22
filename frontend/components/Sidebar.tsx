'use client';

interface SidebarProps {
  audioType: 'hindi' | 'marathi' | 'custom';
  setAudioType: (type: 'hindi' | 'marathi' | 'custom') => void;
}

export default function Sidebar({ audioType, setAudioType }: SidebarProps) {
  return (
    <div className="w-56 bg-gradient-to-b from-yellow-300 to-yellow-400 border-r-4 border-black p-5 flex flex-col overflow-y-auto">
      {/* Logo Section */}
      <div className="flex flex-col items-center pb-5 border-b-2 border-black/20 mb-6">
        <div className="w-20 h-20 bg-white border-3 border-black rounded-lg flex items-center justify-center text-3xl mb-3">
          🎵
        </div>
        <h1 className="text-lg font-bold text-black">IndicF5 TTS</h1>
        <p className="text-xs font-bold text-black uppercase tracking-widest">Voice Synthesis</p>
      </div>

      {/* Audio Type Selection */}
      <div className="bg-white/30 rounded-lg p-4 mb-8">
        <p className="text-xs font-bold text-black uppercase mb-3 tracking-widest">Audio Type</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setAudioType('hindi')}
            className={`py-2 px-3 text-xs font-bold border-2 border-black rounded transition-all ${
              audioType === 'hindi'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-black hover:bg-blue-100'
            }`}
          >
            🇮🇳 Hindi
          </button>
          <button
            onClick={() => setAudioType('marathi')}
            className={`py-2 px-3 text-xs font-bold border-2 border-black rounded transition-all ${
              audioType === 'marathi'
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white text-black hover:bg-orange-100'
            }`}
          >
            🎭 Marathi
          </button>
          <button
            onClick={() => setAudioType('custom')}
            className={`py-2 px-3 text-xs font-bold border-2 border-black rounded transition-all ${
              audioType === 'custom'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-black hover:bg-purple-100'
            }`}
          >
            🎙️ Custom Voice
          </button>
        </div>
      </div>

      {/* Information Section */}
      <div className="bg-white/40 rounded-lg p-3 mb-6">
        <p className="text-xs font-bold text-black uppercase mb-2 tracking-widest">Status</p>
        <div className="space-y-2 text-xs text-gray-800">
          <div>📊 <span className="font-semibold">Model:</span> IndicF5</div>
          <div>🗣️ <span className="font-semibold">Languages:</span> Hindi, Marathi</div>
          <div>⚙️ <span className="font-semibold">Engine:</span> FastAPI</div>
        </div>
      </div>

      {/* API Connection Info */}
      <div className="mt-auto p-3 bg-yellow-300 border-2 border-black rounded-lg">
        <p className="text-xs font-bold text-black text-center uppercase">🔌 API</p>
        <p className="text-xs text-gray-800 text-center mt-1 font-mono">localhost:8000</p>
      </div>
    </div>
  );
}
