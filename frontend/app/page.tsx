"use client";

import React, { useState, useEffect, useRef } from "react";

// Types
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  language?: string;
  status?: string;
  audioUrl?: string | null;
  timestamp: Date;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
}

export default function Home() {
  // App States
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: "session-1",
      title: "प्राथमिक संवाद (Hindi Welcome)",
      messages: [
        {
          id: "m-1",
          role: "system",
          text: "नमस्ते! मैं 'ध्वनि' (Dhvani) हूँ। मैं हिंदी, मराठी और अन्य भारतीय भाषाओं में बात कर सकती हूँ। आप मुझसे बोलकर या लिखकर संवाद कर सकते हैं।",
          language: "Hindi",
          status: "TTS Generated",
          audioUrl: "/samples/hindi.wav",
          timestamp: new Date(Date.now() - 60000),
        }
      ]
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>("session-1");
  const [inputText, setInputText] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  const [selectedVoice, setSelectedVoice] = useState<string>("mar.wav");
  const [customRefText, setCustomRefText] = useState<string>("भावा, डिझेल से धर घसरलेत वाटायत हो देयत, पुलकुरु तक्तक की.");
  
  // Custom Voice Cloning Upload State
  const [customVoiceFile, setCustomVoiceFile] = useState<File | null>(null);
  const [customVoiceName, setCustomVoiceName] = useState<string>("");
  const [customVoicePath, setCustomVoicePath] = useState<string>("");
  const [isUploadingVoice, setIsUploadingVoice] = useState<boolean>(false);

  // Technical Parameter States
  const [selectedModel, setSelectedModel] = useState<string>("gemma3:4b");
  const [nfeSteps, setNfeSteps] = useState<number>(16);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [safetyMargin, setSafetyMargin] = useState<number>(0.4);
  const [gpuEnabled, setGpuEnabled] = useState<boolean>(true);

  // Sidebar Toggles
  const [showSettings, setShowSettings] = useState<boolean>(true);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Audio Playback State
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Computed Session
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, isProcessing]);

  // Audio recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Canvas visualizer drawing loop
  useEffect(() => {
    if (isRecording && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 64;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        if (analyserRef.current) {
          analyserRef.current.getByteTimeDomainData(dataArray);
        }

        ctx.lineWidth = 3;
        
        // Gradient color for waveform: Saffron to Royal Indigo
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "#ff9933"); // Saffron
        gradient.addColorStop(0.5, "#f5a623"); // Marigold
        gradient.addColorStop(1, "#8a2be2"); // Neon Purple/Royal Indigo
        
        ctx.strokeStyle = gradient;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          let v = dataArray[i] / 128.0; // range 0 to 2
          // If no active audio analyzer, simulate soft breathing sinusoids
          if (!analyserRef.current) {
            v = 1.0 + Math.sin(i * 0.1 + Date.now() * 0.005) * 0.15 * Math.sin(Date.now() * 0.002);
          }
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();

        animationFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clear canvas if not recording
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording]);

  // Audio Playback Helper
  const playResponseAudio = (url: string | null, messageId: string) => {
    if (!url) return;

    if (playingAudioId === messageId && currentAudioRef.current) {
      currentAudioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }

    const audio = new Audio(url);
    currentAudioRef.current = audio;
    setPlayingAudioId(messageId);

    audio.play().catch(err => {
      console.error("Playback failed: ", err);
      setPlayingAudioId(null);
    });

    audio.onended = () => {
      setPlayingAudioId(null);
    };
  };

  // Format Duration
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Start Mic Recording
  const startRecording = async () => {
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        setPlayingAudioId(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      setAudioChunks([]);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Audio contexts setup for visualizer
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
      } catch (err) {
        console.warn("Could not start visualizer audio context (non-critical):", err);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Error accessing microphone: ", err);
      alert("Microphone access denied or unavailable. Please enable microphone permissions.");
    }
  };

  // Stop Mic Recording and Synthesize
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    mediaRecorderRef.current.addEventListener("stop", async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      await processAudioInput(audioBlob);
    });
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Process voice/audio input from recorder
  const processAudioInput = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    // Add user placeholder message
    const userMsgId = `m-user-${Date.now()}`;
    const newUserMessage: Message = {
      id: userMsgId,
      role: "user",
      text: "[ Recording voice query... ]",
      status: "Transcribing ASR...",
      timestamp: new Date()
    };
    
    updateSessionMessages(newUserMessage);

    try {
      // Create form data for API request
      const formData = new FormData();
      formData.append("audio", audioBlob, "query.webm");
      formData.append("model", selectedModel);
      formData.append("nfe_steps", nfeSteps.toString());
      formData.append("speed", ttsSpeed.toString());
      formData.append("safety_margin", safetyMargin.toString());
      formData.append("language", selectedLanguage);
      
      // Pass reference voice paths
      if (selectedVoice === "upload" && customVoicePath) {
        formData.append("ref_audio_path", customVoicePath);
        formData.append("ref_text", customRefText);
      } else {
        formData.append("ref_audio_name", selectedVoice);
      }

      // 1. Try to communicate with backend FastAPI
      let responseData;
      try {
        const response = await fetch("http://localhost:8000/api/chat", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Backend server error");
        responseData = await response.json();
      } catch (backendError) {
        console.warn("Backend API unavailable, falling back to mock response.", backendError);
        // Trigger simulation
        await simulateMockChat(null, userMsgId);
        return;
      }

      // Update user message with the real transcription
      updateMessageText(userMsgId, responseData.user_prompt, "ASR Transcribed");

      // Add assistant response
      const assistantMsg: Message = {
        id: `m-asst-${Date.now()}`,
        role: "assistant",
        text: responseData.response_text,
        language: responseData.language || "Detected",
        status: "TTS Generated",
        audioUrl: `http://localhost:8000${responseData.audio_url}`,
        timestamp: new Date()
      };
      updateSessionMessages(assistantMsg);

      // Play audio automatically
      playResponseAudio(`http://localhost:8000${responseData.audio_url}`, assistantMsg.id);

    } catch (err) {
      console.error("Failed to process voice query:", err);
      updateMessageText(userMsgId, "[ Voice transcription failed ]", "Error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit written text query
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const query = inputText.trim();
    setInputText("");
    setIsProcessing(true);

    const userMsgId = `m-user-${Date.now()}`;
    const newUserMessage: Message = {
      id: userMsgId,
      role: "user",
      text: query,
      timestamp: new Date()
    };
    updateSessionMessages(newUserMessage);

    try {
      // 1. Setup request body
      const bodyPayload: any = {
        prompt: query,
        model: selectedModel,
        nfe_steps: nfeSteps,
        speed: ttsSpeed,
        safety_margin: safetyMargin,
        language: selectedLanguage,
      };

      if (selectedVoice === "upload" && customVoicePath) {
        bodyPayload.ref_audio_path = customVoicePath;
        bodyPayload.ref_text = customRefText;
      } else {
        bodyPayload.ref_audio_name = selectedVoice;
      }

      // 2. Try to communicate with backend FastAPI
      let responseData;
      try {
        const response = await fetch("http://localhost:8000/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        if (!response.ok) throw new Error("Backend server error");
        responseData = await response.json();
      } catch (backendError) {
        console.warn("Backend API offline, launching simulation.", backendError);
        await simulateMockChat(query, null);
        return;
      }

      // Add assistant response from real API
      const assistantMsg: Message = {
        id: `m-asst-${Date.now()}`,
        role: "assistant",
        text: responseData.response_text,
        language: responseData.language || "Output",
        status: "TTS Generated",
        audioUrl: `http://localhost:8000${responseData.audio_url}`,
        timestamp: new Date()
      };
      updateSessionMessages(assistantMsg);

      // Play audio automatically
      playResponseAudio(`http://localhost:8000${responseData.audio_url}`, assistantMsg.id);

    } catch (err) {
      console.error("Text chat failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Custom Voice Reference Audio Upload Handler
  const handleRefVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomVoiceFile(file);
    setCustomVoiceName(file.name);
    setIsUploadingVoice(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Try contacting backend
      try {
        const response = await fetch("http://localhost:8000/api/upload-ref", {
          method: "POST",
          body: formData
        });
        if (!response.ok) throw new Error("Upload failed");
        
        const data = await response.json();
        setCustomVoicePath(data.filepath);
        if (data.transcription) {
          setCustomRefText(data.transcription);
        }
      } catch (err) {
        console.warn("Backend upload failed, simulating locally.", err);
        // Local simulation fallback
        setCustomVoicePath("samples/uploads/" + file.name);
        setCustomRefText("मला मराठी भाषेत बोलायला आवडते, कारण ती माझी मातृभाषा आहे.");
      }
      setSelectedVoice("upload");
    } catch (err) {
      console.error("Reference voice upload failed:", err);
    } finally {
      setIsUploadingVoice(false);
    }
  };

  // Mock API fallback simulator
  const simulateMockChat = async (userText: string | null, placeholderMsgId: string | null) => {
    // 1. Simulating voice transcription if voice input
    if (placeholderMsgId) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      let trans = "महाराष्ट्राची राजधानी कोणती आहे?";
      if (selectedLanguage === "hindi") {
        trans = "भारत के तीन प्रमुख त्योहारों के नाम बताएं।";
      } else if (selectedLanguage === "tamil") {
        trans = "சென்னையின் வானிலை என்ன?";
      }
      updateMessageText(placeholderMsgId, trans, "ASR Transcribed");
      userText = trans;
    }

    // 2. Simulating LLM response generation delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Choose relevant response
    let responseText = "";
    let langLabel = "";
    let demoAudioUrl = "";

    const userTextLower = (userText || "").toLowerCase();
    
    if (selectedLanguage === "marathi" || userTextLower.includes("महाराष्ट्र") || userTextLower.includes("मला")) {
      responseText = "महाराष्ट्राची राजधानी मुंबई आहे. हे भारताचे आर्थिक केंद्र असून इथे मराठी भाषा मोठ्या प्रमाणावर बोलली जाते.";
      langLabel = "Marathi";
      demoAudioUrl = "/samples/mar.wav"; // Play standard Marathi sample
    } else {
      responseText = "भारत के प्रमुख त्योहारों में दीपावली, होली और ईद शामिल हैं। ये त्योहार देश भर में सांस्कृतिक एकता का प्रतीक हैं।";
      langLabel = "Hindi";
      demoAudioUrl = "/samples/hindi.wav"; // Play standard Hindi sample
    }

    // Add assistant response
    const assistantMsgId = `m-asst-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      text: responseText,
      language: langLabel,
      status: "TTS Generated (Demo Mode)",
      audioUrl: demoAudioUrl,
      timestamp: new Date()
    };

    updateSessionMessages(assistantMsg);
    setIsProcessing(false);

    // Auto play audio
    playResponseAudio(demoAudioUrl, assistantMsgId);
  };

  // State Updates helpers
  const updateSessionMessages = (msg: Message) => {
    setSessions(prev => 
      prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: [...s.messages, msg] }
          : s
      )
    );
  };

  const updateMessageText = (msgId: string, newText: string, newStatus: string) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: s.messages.map(m =>
                m.id === msgId
                  ? { ...m, text: newText, status: newStatus }
                  : m
              )
            }
          : s
      )
    );
  };

  const clearChat = () => {
    if (window.confirm("Are you sure you want to clear the conversation history?")) {
      setSessions(prev =>
        prev.map(s =>
          s.id === activeSessionId ? { ...s, messages: [] } : s
        )
      );
    }
  };

  const createNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: Session = {
      id: newId,
      title: `संवाद ${sessions.length + 1}`,
      messages: [
        {
          id: `m-system-${Date.now()}`,
          role: "system",
          text: "नवीन संवाद सुरू झाला आहे। (New session started. How can I assist you?)",
          status: "Ready",
          timestamp: new Date()
        }
      ]
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newId);
  };

  return (
    <div className="flex flex-1 overflow-hidden h-screen bg-[#0a0a0a] text-[#e5e2e1] font-sans relative">
      {/* Ambient Radial Glows */}
      <div className="ambient-bg" />

      {/* LEFT SIDEBAR - Navigation & Voice Settings */}
      <aside className="w-80 border-r border-[rgba(255,255,255,0.06)] glass-panel z-10 flex flex-col justify-between">
        
        {/* Sidebar Top: Branding & Sessions */}
        <div className="p-5 flex flex-col flex-1 overflow-y-auto min-h-0">
          {/* Logo & App Name */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff9933] via-[#f5a623] to-[#4b0082] flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-orange-400 to-amber-200 bg-clip-text text-transparent">ध्वनि / Dhvani</h1>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Indic Voice Assistant</p>
            </div>
          </div>

          {/* Chat Sessions list */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">हालिया बातचीत</span>
              <button 
                onClick={createNewSession}
                className="text-xs p-1 text-zinc-400 hover:text-[#ff9933] rounded-lg hover:bg-white/5 transition-all flex items-center gap-1"
                title="नवीन सत्र"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                नया
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 truncate ${
                    s.id === activeSessionId 
                      ? "bg-white/10 text-white font-medium border border-white/5" 
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 shrink-0 text-[#ff9933]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Language Settings (Chips) */}
          <div className="mb-6">
            <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block mb-3">भाषा चयन (Language)</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { code: "auto", label: "Auto" },
                { code: "hindi", label: "Hindi" },
                { code: "marathi", label: "Marathi" },
                { code: "tamil", label: "Tamil" },
                { code: "telugu", label: "Telugu" },
                { code: "bengali", label: "Bengali" }
              ].map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                    selectedLanguage === lang.code
                      ? "bg-[#ff9933]/15 text-[#ff9933] border-[#ff9933]/40 font-semibold"
                      : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference Voice / Voice Cloning Section */}
          <div className="mt-4 pt-4 border-t border-white/5 flex-1 flex flex-col justify-end">
            <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block mb-3">आवाज़ क्लोनिंग (Voice Cloning)</span>
            
            {/* Standard Samples selector */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              <button
                onClick={() => {
                  setSelectedVoice("mar.wav");
                  setCustomRefText("भावा, डिझेल से धर घसरलेत वाटायत हो देयत, पुलकुरु तक्तक की.");
                }}
                className={`p-2 rounded-lg text-[10px] border transition-all flex flex-col gap-1 items-start ${
                  selectedVoice === "mar.wav"
                    ? "bg-[#ff9933]/10 border-[#ff9933]/30 text-white font-medium"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  Marathi Default
                </div>
                <span className="text-[9px] text-zinc-500 font-mono truncate w-full">mar.wav</span>
              </button>

              <button
                onClick={() => {
                  setSelectedVoice("hindi.wav");
                  setCustomRefText("चीन में मोबाइल फ़ोन की लत के कारण एक युवक बड़ी मुसीबत में फँस गया।");
                }}
                className={`p-2 rounded-lg text-[10px] border transition-all flex flex-col gap-1 items-start ${
                  selectedVoice === "hindi.wav"
                    ? "bg-[#ff9933]/10 border-[#ff9933]/30 text-white font-medium"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Hindi Default
                </div>
                <span className="text-[9px] text-zinc-500 font-mono truncate w-full">hindi.wav</span>
              </button>
            </div>

            {/* Custom file uploader */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`p-3 rounded-xl border border-dashed text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                selectedVoice === "upload"
                  ? "bg-[#ff9933]/5 border-[#ff9933]/35 text-[#ff9933]"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-400 hover:border-white/20"
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleRefVoiceUpload} 
                accept="audio/*" 
                className="hidden" 
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mb-1 text-zinc-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="text-[10px] font-medium leading-none">
                {isUploadingVoice ? "अपलोड हो रहा है..." : (customVoiceName || "नया संदर्भ ऑडियो अपलोड करें")}
              </span>
              <span className="text-[9px] text-zinc-500 mt-1">WAV, MP3, WebM (अधिकतम 10MB)</span>
            </div>

            {/* Script Text Input for style reference */}
            <div className="mt-3">
              <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">आवाज की स्क्रिप्ट (Reference Text)</label>
              <textarea
                value={customRefText}
                onChange={(e) => setCustomRefText(e.target.value)}
                placeholder="संदर्भ ऑडियो की ट्रांसक्रिप्शन या स्क्रिप्ट यहाँ लिखें..."
                className="w-full h-14 bg-zinc-950/60 border border-white/5 rounded-lg p-2 text-[10px] text-zinc-300 focus:outline-none focus:border-[#ff9933]/50 resize-none"
              />
            </div>

          </div>
        </div>

        {/* Sidebar Footer: GPU Info */}
        <div className="p-4 border-t border-white/5 bg-zinc-950/40 text-center flex justify-between items-center">
          <span className="text-[9px] text-zinc-500 font-bold tracking-wider">GPU स्थिति: ACCELERATED</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      </aside>

      {/* MAIN CONTAINER: Conversation and controls */}
      <main className="flex-1 flex flex-col justify-between relative min-w-0 z-10">
        
        {/* Top Header bar */}
        <header className="h-16 border-b border-[rgba(255,255,255,0.06)] glass-panel px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-white">{activeSession?.title}</h2>
            <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md font-mono">
              {activeSession?.messages.length} संदेश
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={clearChat}
              className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all text-xs flex items-center gap-1"
              title="वार्तालाप साफ़ करें"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              खाली करें
            </button>

            <div className="w-[1px] h-4 bg-white/10" />

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg hover:bg-white/5 transition-all text-xs flex items-center gap-1 ${
                showSettings ? "text-[#ff9933]" : "text-zinc-400 hover:text-white"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              विकल्प
            </button>
          </div>
        </header>

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeSession?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4 text-[#ff9933]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
              <h3 className="text-base font-semibold">बातचीत शुरू करें</h3>
              <p className="text-xs max-w-xs mt-2">नीचे दिए गए माइक बटन पर क्लिक करके कुछ बोलें या सीधे संदेश लिखें।</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {activeSession?.messages.map((message) => {
                const isUser = message.role === "user";
                const isSystem = message.role === "system";
                
                if (isSystem) {
                  return (
                    <div key={message.id} className="flex justify-center">
                      <div className="glass-card text-xs text-zinc-300 py-3 px-5 rounded-2xl max-w-lg border border-white/5 flex items-start gap-3 shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#ff9933] shrink-0 mt-0.5 animate-pulse">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l8.982-5.063c.642-.362 1.018-1.034 1.018-1.747 0-3.39-2.761-6.15-6.15-6.15-3.39 0-6.15 2.76-6.15 6.15 0 .713.376 1.385 1.018 1.747Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0-5.799-4.701-10.5-10.5-10.5S-1.5 4.701-1.5 10.5" />
                        </svg>
                        <div>
                          <p className="leading-relaxed">{message.text}</p>
                          <div className="flex gap-2 items-center mt-2">
                            {message.audioUrl && (
                              <button 
                                onClick={() => playResponseAudio(message.audioUrl!, message.id)}
                                className="flex items-center gap-1 text-[9px] bg-orange-500/10 hover:bg-orange-500/20 text-[#ff9933] font-medium py-0.5 px-2 rounded-md transition-all"
                              >
                                {playingAudioId === message.id ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping shrink-0" />
                                    रोकें (Pause)
                                  </>
                                ) : (
                                  <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                                      <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                    </svg>
                                    सुनें (Play)
                                  </>
                                )}
                              </button>
                            )}
                            <span className="text-[8px] text-zinc-500 font-semibold uppercase">{message.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={message.id} 
                    className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {/* Assistant Avatar */}
                    {!isUser && (
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#ff9933]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.128 12.122A10.147 10.147 0 0 1 12 15c-2.9 0-5.508-1.214-7.362-3.176M19.128 12.122A10.147 10.147 0 0 0 12 9c-2.9 0-5.508 1.214-7.362 3.176M19.128 12.122a10.147 10.147 0 0 1-14.256 0M12 15c-2.9 0-5.508-1.214-7.362-3.176M12 3c1.657 0 3 1.343 3 3s-1.343 3-3 3-3-1.343-3-3 1.343-3 3-3Z" />
                        </svg>
                      </div>
                    )}

                    <div className="flex flex-col max-w-[70%]">
                      {/* Bubble */}
                      <div 
                        className={`p-4 rounded-2xl leading-relaxed text-sm shadow-md border ${
                          isUser 
                            ? "bg-gradient-to-tr from-[#3a1d00] to-[#171717] border-orange-500/10 text-white rounded-tr-sm" 
                            : "bg-[#171717]/80 backdrop-blur-sm border-white/5 text-zinc-100 rounded-tl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.text}</p>
                      </div>

                      {/* Message Metadata controls */}
                      <div className={`flex items-center gap-3 mt-1.5 px-1 ${isUser ? "justify-end" : "justify-start"}`}>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {message.language && (
                          <span className="text-[9px] text-[#ff9933] bg-[#ff9933]/15 px-1.5 py-0.5 rounded-md font-medium">
                            {message.language}
                          </span>
                        )}

                        {message.status && (
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wide">
                            {message.status}
                          </span>
                        )}

                        {/* Speech buttons for Assistant responses */}
                        {!isUser && message.audioUrl && (
                          <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                            <button
                              onClick={() => playResponseAudio(message.audioUrl!, message.id)}
                              className="text-[10px] text-orange-400 hover:text-[#ff9933] font-semibold flex items-center gap-1 transition-all"
                            >
                              {playingAudioId === message.id ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 animate-pulse text-red-400">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                                  </svg>
                                  रुकें
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[#ff9933]">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                  </svg>
                                  सुनें
                                </>
                              )}
                            </button>
                            <span className="text-zinc-600 text-xs">|</span>
                            <a
                              href={message.audioUrl}
                              download={`dhvani_response_${message.id}.wav`}
                              className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-all"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-zinc-500 hover:text-white">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                              डाउनलोड
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* User Avatar */}
                    {isUser && (
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-zinc-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* API generating response loading indicator bubble */}
              {isProcessing && (
                <div className="flex gap-4 justify-start">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#ff9933] animate-spin">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <div className="p-4 rounded-2xl bg-[#171717]/80 backdrop-blur-sm border border-white/5 text-zinc-400 text-xs rounded-tl-sm shadow-md">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                        </span>
                        ध्वनि प्रक्रिया जारी है (Synthesizing response...)
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Recording Control / TextInput area */}
        <div className="p-6 border-t border-[rgba(255,255,255,0.06)] bg-zinc-950/20 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            
            {/* Visualizer during recording */}
            {isRecording && (
              <div className="w-full flex flex-col items-center mb-4 transition-all">
                <canvas 
                  ref={canvasRef} 
                  width={600} 
                  height={80} 
                  className="w-full max-w-lg h-14 bg-zinc-900/40 rounded-xl border border-white/5 shadow-inner"
                />
                <span className="text-[11px] text-orange-400 font-semibold tracking-wider uppercase mt-1 animate-pulse">
                  रिकॉर्डिंग चालू है: {formatTime(recordingDuration)}
                </span>
              </div>
            )}

            {/* Controls panel: Mic (Circle) and TextInput */}
            <div className="w-full flex items-center gap-4">
              
              {/* Voice Trigger (Large breathing mic button) */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isRecording 
                      ? "bg-red-500 hover:bg-red-600 text-white mic-active border border-red-400/20 scale-105" 
                      : "bg-gradient-to-tr from-[#ff9933] to-[#f5a623] text-white hover:shadow-orange-500/20 hover:scale-105"
                  }`}
                  title={isRecording ? "रिकॉर्डिंग समाप्त करें" : "बोलना शुरू करें (Microphone)"}
                >
                  {isRecording ? (
                    // Stop button
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    // Mic icon
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Text fallback input */}
              <form onSubmit={handleTextSubmit} className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="यहाँ लिखें या बाईं ओर दिए गए माइक बटन का उपयोग करें..."
                  className="flex-1 h-12 px-4 rounded-xl border border-white/5 bg-[#121212]/80 backdrop-blur-sm text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#ff9933]/50 focus:ring-1 focus:ring-[#ff9933]/25 transition-all shadow-inner"
                  disabled={isRecording || isProcessing}
                />
                
                <button
                  type="submit"
                  disabled={!inputText.trim() || isRecording || isProcessing}
                  className="h-12 w-12 rounded-xl bg-zinc-900 border border-white/10 hover:border-[#ff9933]/30 text-zinc-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:border-white/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              </form>
            </div>
            
            <p className="text-[10px] text-zinc-600 mt-2">वॉयस रिस्पांस जनरेशन के लिए मॉडल लोडिंग में कुछ सेकंड लग सकते हैं।</p>
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR: Parameters Drawer (Collapsible) */}
      {showSettings && (
        <aside className="w-80 border-l border-[rgba(255,255,255,0.06)] glass-panel z-10 p-5 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-4">तकनीकी सेटिंग्स (Configuration)</h3>
            
            {/* Model Selector */}
            <div className="mb-4">
              <label className="text-[10px] text-zinc-400 block mb-1.5 font-medium">चैट मॉडल (Language Model)</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#171717] border border-white/5 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-[#ff9933]/50"
              >
                <option value="gemma3:4b">Gemma 3:4b (Local)</option>
                <option value="qwen2.5:7b">Qwen 2.5:7b (Local)</option>
                <option value="gemma:2b">Gemma:2b (Light)</option>
              </select>
            </div>

            {/* GPU Toggle */}
            <div className="flex justify-between items-center mb-5 p-2.5 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[10px] text-zinc-400 font-medium">GPU त्वरण (GPU Acceleration)</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={gpuEnabled} 
                  onChange={(e) => setGpuEnabled(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-7 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
              </label>
            </div>

            {/* NFE Steps (Flow matching steps) */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] text-zinc-400 font-medium">NFE प्रक्रिया कदम (NFE Steps)</label>
                <span className="text-xs font-mono text-[#ff9933] font-bold">{nfeSteps}</span>
              </div>
              <input
                type="range"
                min="16"
                max="64"
                step="4"
                value={nfeSteps}
                onChange={(e) => setNfeSteps(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-[9px] text-zinc-500 mt-1 block">कम कदम = तेज जनरेशन, अधिक कदम = बेहतर आवाज गुणवत्ता।</span>
            </div>

            {/* TTS Speech rate (Speed) */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] text-zinc-400 font-medium">बोलने की गति (Speech Speed)</label>
                <span className="text-xs font-mono text-[#ff9933] font-bold">{ttsSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.8"
                step="0.1"
                value={ttsSpeed}
                onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Safety margin */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] text-zinc-400 font-medium">सुरक्षा मार्जिन (Safety Margin)</label>
                <span className="text-xs font-mono text-[#ff9933] font-bold">{safetyMargin.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={safetyMargin}
                onChange={(e) => setSafetyMargin(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-[9px] text-zinc-500 mt-1 block">वाक्यों के बीच का विराम अंतराल।</span>
            </div>

          </div>

          {/* Model info panel */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 text-[11px] leading-relaxed text-zinc-400 mt-auto">
            <span className="font-bold text-white block mb-1">IndicF5 - आवाज़ क्लोनिंग</span>
            यह मॉडल संदर्भ स्पीकर के केवल 3-5 सेकंड के ऑडियो इनपुट का उपयोग करके उसकी आवाज़ में किसी भी टेक्स्ट को बोल सकता है।
          </div>
        </aside>
      )}
    </div>
  );
}
