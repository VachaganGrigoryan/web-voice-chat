import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Mic, Square, Loader2, Trash2, Send, StopCircle } from 'lucide-react';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceRecorderProps {
  receiverId: string;
  onSend: (formData: FormData) => Promise<any>;
}

export default function VoiceRecorder({ receiverId, onSend }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Stop typing indicator
        const socket = getSocket();
        socket?.emit(EVENTS.CLIENT_TYPING_STOP, { receiver_id: receiverId });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      setAudioBlob(null);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      // Start typing indicator
      const socket = getSocket();
      socket?.emit(EVENTS.CLIENT_TYPING_START, { receiver_id: receiverId });

    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setDuration(0);
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      // Calculate duration from start time if available, otherwise use timer state * 1000
      const finalDuration = duration * 1000; 
      
      formData.append('file', audioBlob, 'voice.webm');
      formData.append('receiver_id', receiverId);
      formData.append('duration_ms', finalDuration.toString());

      await onSend(formData);
      setAudioBlob(null);
      setDuration(0);
    } catch (err) {
      console.error('Error uploading voice:', err);
      alert('Failed to send voice message');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full bg-background/80 backdrop-blur-md border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <AnimatePresence mode="wait">
          {!isRecording && !audioBlob ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex items-center gap-3"
            >
              <Button
                size="lg"
                className="w-full rounded-full h-12 text-base font-medium shadow-md transition-all active:scale-95"
                onClick={startRecording}
                disabled={isUploading}
              >
                <Mic className="mr-2 h-5 w-5" />
                Tap to Record
              </Button>
            </motion.div>
          ) : isRecording ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex items-center gap-3 bg-red-50/50 p-1 rounded-full border border-red-100"
            >
              <div className="flex-1 flex items-center gap-3 px-4">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </div>
                <span className="font-mono text-sm font-medium text-red-600 min-w-[3rem]">
                  {formatDuration(duration)}
                </span>
                <div className="h-8 flex-1 flex items-center gap-0.5 opacity-50">
                  {/* Fake waveform */}
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [4, 16, 8, 24, 4] }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 1.5, 
                        delay: i * 0.1,
                        ease: "easeInOut" 
                      }}
                      className="w-1 bg-red-400 rounded-full"
                    />
                  ))}
                </div>
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0"
                onClick={stopRecording}
              >
                <StopCircle className="h-5 w-5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex items-center gap-2"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={cancelRecording}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
              
              <div className="flex-1 bg-secondary/50 h-12 rounded-full flex items-center px-4 gap-3 border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 h-1 bg-primary/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-full" />
                </div>
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  {formatDuration(duration)}
                </span>
              </div>

              <Button
                size="icon"
                className="h-12 w-12 rounded-full shadow-md bg-primary hover:bg-primary/90"
                onClick={handleSend}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5 ml-0.5" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
