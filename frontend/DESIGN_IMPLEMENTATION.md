# VĀNI AI - Premium Voice Assistant UI

This is a modern, responsive frontend implementation of the VĀNI AI voice assistant interface matching the design provided.

## Features

### 🎨 Design Implementation
- **3-Column Layout**: Left sidebar navigation, center chat area, right parameters panel
- **Color Scheme**: Gold/Yellow (#f4c430, #ffd700), Black text, Red accents (#c84f3f)
- **Bold Borders**: 2-3px black borders for retro/modern aesthetic
- **Responsive**: Adapts to different screen sizes

### 🧩 Components

#### VaniAI.tsx (Main Component)
- Manages overall application state
- Handles API communication with backend
- Integrates Web Speech API for voice recognition
- Manages conversation history

#### Sidebar.tsx (Left Navigation)
- **Logo Section**: Profile avatar with branding
- **Menu Items**: 
  - Recent Chats
  - Voice Library
  - Voice Cloning
  - Regional Settings
  - Account
- **Language Selection**: Hindi, Marathi, Auto-detect
- **New Conversation Button**: Creates new chat sessions

#### ChatArea.tsx (Main Content)
- **Message Display**: User and assistant messages with timestamps
- **Audio Visualization**: Animated bars for listening state
- **Microphone Button**: Large circular button for voice input
  - Shows "Listening..." status
  - Animated pulse when recording
  - Integrates with browser Web Speech API
- **Text Input**: Type messages manually
- **Control Buttons**: Play and Download audio responses

#### ParametersPanel.tsx (Right Settings)
- **Acoustic Model**: Dropdown selector
  - GEMMA 3-8 (Default)
  - GEMMA 2-27
  - PHI-3
- **MFE Steps**: Range slider (8-64 steps)
  - Affects speech synthesis quality
- **Speech Rate**: Range slider (0.5x - 2.0x)
  - Controls playback speed
- **GPU Acceleration**: Toggle button for optimization
- **Reference Audio**: Upload section for voice cloning
  - WAV/MP3 file upload
  - Max 10 seconds
- **Reference Transcript**: Text area for cloning reference text

## Technologies Used

- **Next.js 16**: React framework with TypeScript
- **React 19**: UI component library
- **Tailwind CSS 4**: Utility-first CSS framework
- **TypeScript**: Type-safe JavaScript
- **Web Speech API**: Browser-native voice recognition
- **shadcn/ui**: Component library

## Installation & Setup

```bash
# Navigate to the frontend directory
cd e:\project\audio_tts\gemma_tts\frontend

# Dependencies are already installed via pnpm
# To run development server:
pnpm dev

# To build for production:
pnpm build

# To start production server:
pnpm start
```

## Development Server

The dev server runs on `http://localhost:3000`

## API Integration

The frontend expects these backend endpoints:

```
POST /api/chat
- Request: { message, language, mfe_steps, speech_rate }
- Response: { response, conversation_id }

POST /api/generate-speech
- Request: { text, nfe_steps, speech_rate, ref_audio_path, ref_text }
- Response: Audio WAV file

POST /api/transcribe
- Request: FormData with audio file + language
- Response: { transcription }

POST /api/upload-reference
- Request: FormData with audio + transcript
- Response: { file_path, transcript }
```

## File Structure

```
frontend/
├── app/
│   ├── page.tsx           # Main page (imports VaniAI)
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── VaniAI.tsx         # Main application component
│   ├── Sidebar.tsx        # Left navigation panel
│   ├── ChatArea.tsx       # Chat interface
│   └── ParametersPanel.tsx # Settings panel
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Color Palette

- **Primary Yellow**: #f4c430, #ffd700
- **Background**: #f5f5f5, #e8e8e8
- **Text**: #333 (dark)
- **Accent Red**: #c84f3f, #a73a2a
- **Accent Blue**: #0066cc
- **Chat Background (Dark)**: #1a1a1a, #333

## Customization

### Changing Colors
Update the Tailwind classes in each component. Primary colors are:
- `bg-yellow-300`, `bg-yellow-400`, `bg-yellow-500`
- `bg-red-500`, `bg-red-600`
- `bg-gray-*` for neutrals

### Adding More Languages
Modify the language buttons in `Sidebar.tsx` and update the Web Speech API language codes in `VaniAI.tsx`

### Updating API Endpoints
Modify the fetch URLs in `VaniAI.tsx` `handleSendMessage()` function

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Web Speech API support required for voice input

## Notes

- Voice recognition uses the browser's Web Speech API
- Audio playback integrates with backend TTS engine
- All styling uses Tailwind CSS for consistency
- Components are fully typed with TypeScript
- Responsive design works on mobile, tablet, and desktop
