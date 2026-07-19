'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatAreaProps {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  isListening: boolean;
  onToggleMicrophone: () => void;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export default function ChatArea({
  messages,
  isListening,
  onToggleMicrophone,
  onSendMessage,
  isLoading,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="flex-1 bg-gray-200 border-l-4 border-r-4 border-black flex flex-col p-6">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto mb-6 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-3xl font-bold text-gray-700 mb-2">Welcome to VĀNI AI</h2>
            <p className="text-sm text-gray-600">Premium Voice Assistant for Indic Languages</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg border-2 border-black ${
                    msg.role === 'user'
                      ? 'bg-yellow-300 text-black'
                      : 'bg-gray-800 text-white'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-white px-4 py-3 rounded-lg border-2 border-black">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Audio Visualization and Mic Button */}
      <div className="flex flex-col items-center gap-4 mb-6">
        <div className="flex items-center justify-center gap-1 h-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-1 rounded transition-all ${
                isListening
                  ? 'animate-pulse bg-black'
                  : 'h-2 bg-black'
              }`}
              style={{
                height: isListening ? '20px' : '10px',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        <button
          onClick={onToggleMicrophone}
          className={`w-20 h-20 rounded-full border-2 border-black font-bold text-2xl transition-all transform flex items-center justify-center ${
            isListening
              ? 'bg-red-600 text-white scale-110 shadow-lg animate-pulse'
              : 'bg-red-500 text-white hover:bg-red-600 hover:scale-105'
          }`}
        >
          🎤
        </button>

        <p className="text-xs text-gray-600 font-semibold text-center">
          {isListening ? 'Listening...' : 'Ready to listen...'}
        </p>
      </div>

      {/* Text Input Section */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 bg-white border-2 border-black rounded-lg px-3 py-2 flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message here..."
            className="flex-1 outline-none text-sm"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-bold py-2 px-4 rounded border-2 border-black transition-all"
        >
          ▶ Send
        </button>
        <button
          className="bg-white hover:bg-gray-100 text-black font-bold py-2 px-4 rounded border-2 border-black transition-all"
        >
          ⬇ Download
        </button>
      </div>
    </div>
  );
}
