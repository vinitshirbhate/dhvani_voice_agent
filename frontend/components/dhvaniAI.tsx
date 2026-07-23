'use client';

import { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import ParametersPanel from './ParametersPanel';

interface SynthesisState {
  text: string;
  audioType: 'hindi' | 'marathi' | 'custom';
  refAudio?: File;
  refText?: string;
  sampleRate: number;
  device?: string;
  outputPath: string;
}

export default function DhvaniAI() {
  const [synthesisState, setSynthesisState] = useState<SynthesisState>({
    text: '',
    audioType: 'hindi',
    sampleRate: 24000,
    outputPath: 'output.wav',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastAudioPath, setLastAudioPath] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleSynthesizeAudio = async () => {
    if (!synthesisState.text.trim()) {
      setError('Please enter text to synthesize');
      return;
    }

    if (synthesisState.audioType === 'custom' && !synthesisState.refAudio && !synthesisState.refText) {
      setError('Custom audio mode requires either a reference audio file or reference text');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('text', synthesisState.text);
      formData.append('audio_type', synthesisState.audioType);
      formData.append('output_path', synthesisState.outputPath);
      formData.append('sample_rate', synthesisState.sampleRate.toString());
      
      if (synthesisState.refAudio) {
        formData.append('audio_file', synthesisState.refAudio);
      }
      if (synthesisState.refText) {
        formData.append('ref_text', synthesisState.refText);
      }
      if (synthesisState.device) {
        formData.append('device', synthesisState.device);
      }

      const response = await fetch('http://localhost:8000/synthesize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Synthesis failed');
      }

      const data = await response.json();
      setLastAudioPath(data.output_path);
      setSuccess(`Audio generated successfully in ${data.generation_time_seconds}s`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      console.error('Error during synthesis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAudio = async () => {
    if (!lastAudioPath) {
      setError('No audio generated yet');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/synthesize-and-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: synthesisState.text,
          audio_type: synthesisState.audioType,
          output_path: synthesisState.outputPath,
          sample_rate: synthesisState.sampleRate,
          ref_text: synthesisState.refText,
          device: synthesisState.device,
        }),
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated_audio.wav';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Download failed');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar audioType={synthesisState.audioType} setAudioType={(type) => setSynthesisState({...synthesisState, audioType: type})} />
      <ChatArea
        text={synthesisState.text}
        onTextChange={(text) => setSynthesisState({...synthesisState, text})}
        isLoading={isLoading}
        onSynthesize={handleSynthesizeAudio}
        onDownload={handleDownloadAudio}
        lastAudioPath={lastAudioPath}
        error={error}
        success={success}
      />
      <ParametersPanel
        audioType={synthesisState.audioType}
        sampleRate={synthesisState.sampleRate}
        setSampleRate={(rate) => setSynthesisState({...synthesisState, sampleRate: rate})}
        refAudio={synthesisState.refAudio}
        setRefAudio={(file) => setSynthesisState({...synthesisState, refAudio: file})}
        refText={synthesisState.refText}
        setRefText={(text) => setSynthesisState({...synthesisState, refText: text})}
      />
    </div>
  );
}
