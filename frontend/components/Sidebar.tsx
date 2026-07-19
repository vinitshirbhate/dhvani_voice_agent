'use client';

interface SidebarProps {
  language: string;
  setLanguage: (lang: string) => void;
}

export default function Sidebar({ language, setLanguage }: SidebarProps) {
  return (
    <div className="w-52 bg-gradient-to-b from-yellow-300 to-yellow-400 border-r-4 border-black p-5 flex flex-col overflow-y-auto">
      {/* Logo Section */}
      <div className="flex flex-col items-center pb-5 border-b-2 border-black/20 mb-6">
        <div className="w-24 h-24 bg-white border-3 border-black rounded-lg flex items-center justify-center text-2xl mb-3">
          👤
        </div>
        <h1 className="text-lg font-bold text-black">VĀNI AI</h1>
        <p className="text-xs font-bold text-black uppercase tracking-widest">Premium Voice Assistant</p>
      </div>

      {/* Menu Items */}
      <nav className="flex flex-col gap-2 mb-8">
        <MenuItem icon="📋" label="Recent Chats" />
        <MenuItem icon="🎤" label="Voice Library" />
        <MenuItem icon="📢" label="Voice Cloning" />
        <MenuItem icon="⚙️" label="Regional Settings" />
        <MenuItem icon="👤" label="Account" />
      </nav>

      {/* Language Focus */}
      <div className="bg-white/30 rounded-lg p-3 mb-6">
        <p className="text-xs font-bold text-black uppercase mb-2 tracking-widest">Language Focus</p>
        <div className="flex gap-1">
          <button
            onClick={() => setLanguage('hi')}
            className={`flex-1 py-1 px-2 text-xs font-bold border-2 border-black rounded transition-all ${
              language === 'hi'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            HINDI
          </button>
          <button
            onClick={() => setLanguage('mr')}
            className={`flex-1 py-1 px-2 text-xs font-bold border-2 border-black rounded transition-all ${
              language === 'mr'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            MARATHI
          </button>
          <button
            onClick={() => setLanguage('auto')}
            className={`flex-1 py-1 px-2 text-xs font-bold border-2 border-black rounded transition-all ${
              language === 'auto'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            AUTO
          </button>
        </div>
      </div>

      {/* New Conversation Button */}
      <button className="mt-auto w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 border-2 border-black uppercase tracking-wider flex items-center justify-center gap-2">
        <span className="text-lg">+</span> New Conversation
      </button>
    </div>
  );
}

function MenuItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/30 hover:bg-white/60 rounded-lg cursor-pointer transition-all border-2 border-transparent hover:border-black">
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-bold text-black">{label}</span>
    </div>
  );
}
