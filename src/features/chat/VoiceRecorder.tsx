import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';

interface VoiceRecorderProps {
  receiverId: string;
  onSend: (formData: FormData) => Promise<any>;
}

export default function VoiceRecorder({ receiverId, onSend }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

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

      mediaRecorder.onstop = async () => {
        const duration = Date.now() - startTimeRef.current;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Stop typing indicator
        const socket = getSocket();
        socket?.emit(EVENTS.CLIENT_TYPING_STOP, { receiver_id: receiverId });

        await handleSend(blob, duration);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
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
    }
  };

  const handleSend = async (blob: Blob, duration: number) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'voice.webm');
      formData.append('receiver_id', receiverId);
      formData.append('duration_ms', duration.toString());

      await onSend(formData);
    } catch (err) {
      console.error('Error uploading voice:', err);
      alert('Failed to send voice message');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 border-t bg-background">
      {isRecording ? (
        <Button
          variant="destructive"
          size="icon"
          onClick={stopRecording}
          disabled={isUploading}
          className="animate-pulse"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="icon"
          onClick={startRecording}
          disabled={isUploading}
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
      
      {isUploading && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Sending...
        </span>
      )}
      
      {!isRecording && !isUploading && (
        <div className="text-xs text-muted-foreground">
          Hold to record (or click to toggle)
        </div>
      )}
    </div>
  );
}
