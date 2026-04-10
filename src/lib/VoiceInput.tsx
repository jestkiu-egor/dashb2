import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Upload, Loader2 } from 'lucide-react';
import { cn } from './utils';
import { transcribeAudio } from './groq';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onFileTranscript: (text: string) => void;
  isProcessing: boolean;
}

export function VoiceInput({ onTranscript, onFileTranscript, isProcessing }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Ваш браузер не поддерживает голосовой ввод. Используйте Chrome.');
      return;
    }

    finalTranscriptRef.current = '';

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'ru-RU';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript + ' ';
        }
      }
    };

    recognitionRef.current.onend = () => {
      if (finalTranscriptRef.current.trim()) {
        onTranscript(finalTranscriptRef.current.trim());
      }
      setIsListening(false);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await transcribeAudio(file);
    if (text) {
      onFileTranscript(text);
    } else {
      alert('Не удалось распознать аудио. Попробуйте другой файл.');
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing}
        title={isListening ? 'Остановить запись' : 'Начать запись'}
        className={cn(
          "p-3 rounded-xl transition-all",
          isListening 
            ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
            : "bg-indigo-600 hover:bg-indigo-500 text-white",
          isProcessing && "opacity-50 cursor-not-allowed"
        )}
      >
        {isListening ? (
          <MicOff size={20} />
        ) : (
          <Mic size={20} />
        )}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        title="Загрузить аудио/видео"
        className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
      >
        <Upload size={20} />
      </motion.button>
    </>
  );
}
