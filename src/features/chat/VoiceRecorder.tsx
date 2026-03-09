import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Mic, Square, Loader2, Trash2, Send, StopCircle } from 'lucide-react';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceRecorderProps {
  receiverId: string;
  onSendVoice: (formData: FormData) => Promise<any>;
  onSendText: (data: { receiver_id: string; text: string }) => Promise<any>;
}

export default function VoiceRecorder({ receiverId, onSendVoice, onSendText }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [text, setText] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSendVoice = async () => {
    if (!audioBlob) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      // Calculate duration from start time if available, otherwise use timer state * 1000
      const finalDuration = duration * 1000; 
      
      formData.append('file', audioBlob, 'voice.webm');
      formData.append('receiver_id', receiverId);
      formData.append('duration_ms', finalDuration.toString());

      await onSendVoice(formData);
      setAudioBlob(null);
      setDuration(0);
    } catch (err) {
      console.error('Error uploading voice:', err);
      alert('Failed to send voice message');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendText = async () => {
    if (!text.trim()) return;
    
    setIsUploading(true);
    try {
      await onSendText({ receiver_id: receiverId, text: text.trim() });
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Error sending text:', err);
      alert('Failed to send text message');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  };

  return (
    <div className="w-full bg-background/80 backdrop-blur-md border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <AnimatePresence mode="wait">
          {!isRecording && !audioBlob ? (
            <motion.div 
              key="text-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex items-end gap-2"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={startRecording}
                disabled={isUploading}
                title="Record voice message"
              >
                <Mic className="h-5 w-5" />
              </Button>
              
              <div className="flex-1 bg-muted/50 rounded-2xl border border-border/50 focus-within:border-primary/50 focus-within:bg-background transition-colors flex items-end min-h-[40px]">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextareaChange}
                  placeholder="Message..."
                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none resize-none py-2.5 px-4 text-sm max-h-32 min-h-[40px] leading-relaxed"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                />
              </div>
              
              <Button
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full shrink-0 transition-all duration-200",
                  text.trim() ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                )}
                onClick={handleSendText}
                disabled={!text.trim() || isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-0.5" />
                )}
              </Button>
            </motion.div>
          ) : isRecording ? (
            <motion.div
              key="recording"
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
              key="preview"
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
                onClick={handleSendVoice}
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
