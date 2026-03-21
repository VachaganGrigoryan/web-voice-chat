import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder as CapacitorVoiceRecorder } from 'capacitor-voice-recorder';
import { Button } from '@/components/ui/Button';
import { Mic, Square, Loader2, Trash2, Send, StopCircle, Smile, Pause, Play, X } from 'lucide-react';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { ComposerReplyTarget } from './types/message';

interface VoiceRecorderProps {
  receiverId: string;
  onSendVoice: (data: {
    type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
  }) => Promise<any>;
  onSendText: (data: { receiver_id: string; text: string }) => Promise<any>;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
}

export default function VoiceRecorder({
  receiverId,
  onSendVoice,
  onSendText,
  replyTarget,
  onClearReplyTarget,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  const [audioFileName, setAudioFileName] = useState('voice.webm');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingPausedRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
      setIsPlayingPreview(false);
      setPreviewProgress(0);
    }
  }, [audioBlob]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const emitTypingStop = () => {
    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT_TYPING_STOP, { to: receiverId, receiver_id: receiverId });
  };

  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  const getFileExtension = (mimeType: string) => {
    if (mimeType.includes('aac') || mimeType.includes('mp4')) return 'm4a';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    return 'webm';
  };

  const blobFromBase64 = (base64: string, mimeType: string) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
  };

  const startRecording = async () => {
    try {
      if (isNativeAndroid) {
        const permission = await CapacitorVoiceRecorder.requestAudioRecordingPermission();
        if (!permission.value) {
          alert('Microphone permission is required to record voice messages.');
          return;
        }

        const canRecord = await CapacitorVoiceRecorder.canDeviceVoiceRecord();
        if (!canRecord.value) {
          alert('This Android device cannot record audio.');
          return;
        }

        await CapacitorVoiceRecorder.startRecording();
        setAudioBlob(null);
        setAudioMimeType('audio/aac');
        setAudioFileName('voice.m4a');
        setIsRecording(true);
        setIsRecordingPaused(false);
        isRecordingPausedRef.current = false;
        setDuration(0);

        timerRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);

        const socket = getSocket();
        socket?.emit(EVENTS.CLIENT_TYPING_START, { to: receiverId, receiver_id: receiverId });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioMimeType('audio/webm');
        setAudioFileName('voice.webm');
        
        const socket = getSocket();
        socket?.emit(EVENTS.CLIENT_TYPING_STOP, { to: receiverId, receiver_id: receiverId });
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      setDuration(0);
      setAudioBlob(null);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      const socket = getSocket();
      socket?.emit(EVENTS.CLIENT_TYPING_START, { to: receiverId, receiver_id: receiverId });

    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not start recording. Please allow microphone access and try again.');
    }
  };

  const pauseRecording = async () => {
    if (!isRecording || isRecordingPaused) return;

    try {
      if (isNativeAndroid) {
        await CapacitorVoiceRecorder.pauseRecording();
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.pause();
      } else {
        return;
      }

      setIsRecordingPaused(true);
      isRecordingPausedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) {
      console.error('Error pausing recording:', err);
    }
  };

  const resumeRecording = async () => {
    if (!isRecording || !isRecordingPaused) return;

    try {
      if (isNativeAndroid) {
        await CapacitorVoiceRecorder.resumeRecording();
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.resume();
      } else {
        return;
      }

      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error resuming recording:', err);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      if (isNativeAndroid) {
        const { value } = await CapacitorVoiceRecorder.stopRecording();
        if (value.recordDataBase64) {
          setAudioBlob(blobFromBase64(value.recordDataBase64, value.mimeType));
        }
        setAudioMimeType(value.mimeType);
        setAudioFileName(`voice.${getFileExtension(value.mimeType)}`);
        setDuration(Math.max(1, Math.round(value.msDuration / 1000)));
        emitTypingStop();
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
      alert('Failed to finish recording.');
    } finally {
      setIsRecording(false);
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = async () => {
    await stopRecording();
    setAudioBlob(null);
    setAudioMimeType('audio/webm');
    setAudioFileName('voice.webm');
    setDuration(0);
  };

  const togglePreviewPlayback = () => {
    if (audioRef.current) {
      if (isPlayingPreview) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlayingPreview(!isPlayingPreview);
    }
  };

  const handleSendVoice = async () => {
    if (!audioBlob) return;
    
    setIsUploading(true);
    try {
      const file = new File([audioBlob], audioFileName, { type: audioMimeType });
      
      await onSendVoice({
        type: 'voice',
        receiver_id: receiverId,
        file,
        duration_ms: duration * 1000,
      });
      setAudioBlob(null);
      setDuration(0);
    } catch (err) {
      console.error('Error uploading voice:', err);
      alert('Failed to send voice message');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    
    if (!typingTimeoutRef.current) {
      const socket = getSocket();
      socket?.emit(EVENTS.CLIENT_TYPING_START, { to: receiverId, receiver_id: receiverId });
    } else {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop();
      typingTimeoutRef.current = null;
    }, 2000);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  };

  const handleSendText = async () => {
    if (!text.trim()) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    emitTypingStop();
    
    setIsUploading(true);
    try {
      await onSendText({ receiver_id: receiverId, text: text.trim() });
      setText('');
      setShowEmojiPicker(false);
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

  const onEmojiClick = (emojiObject: any) => {
    setText((prev) => prev + emojiObject.emoji);
    
    if (!typingTimeoutRef.current) {
      const socket = getSocket();
      socket?.emit(EVENTS.CLIENT_TYPING_START, { to: receiverId, receiver_id: receiverId });
    } else {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop();
      typingTimeoutRef.current = null;
    }, 2000);
  };

  return (
    <div className="w-full bg-background/80 backdrop-blur-md border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] transition-all duration-300">
      {replyTarget ? (
        <div className="max-w-3xl mx-auto mb-3 flex items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              {replyTarget.mode === 'thread' ? 'Thread Reply' : 'Reply'}
            </div>
            <div className="text-xs text-muted-foreground">{replyTarget.senderLabel}</div>
            <div className="truncate text-sm text-foreground">{replyTarget.previewText}</div>
          </div>
          {onClearReplyTarget ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClearReplyTarget}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 w-full">
        <AnimatePresence mode="wait">
          {!isRecording && !audioBlob ? (
            <motion.div 
              key="text-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex items-end gap-2 relative"
            >
              <div className="flex items-end gap-2 w-full">
                {(!isFocused && text.trim().length === 0) && (
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
                )}
                
                <div className="flex-1 bg-muted/50 rounded-2xl border border-border/50 focus-within:border-primary/50 focus-within:bg-background transition-colors flex items-end min-h-[40px] relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    disabled={isUploading}
                    title="Add emoji"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-50">
                      <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.AUTO} width={window.innerWidth < 768 ? window.innerWidth - 32 : 300} height={400} />
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextareaChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setIsFocused(false), 200);
                    }}
                    placeholder="Message..."
                    className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none resize-none py-2.5 px-2 text-sm max-h-32 min-h-[40px] leading-relaxed"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendText();
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
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
              </div>
            </motion.div>
          ) : isRecording ? (
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex items-center gap-2 bg-red-500/10 p-1 rounded-full border border-red-500/20"
            >
              <div className="flex-1 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 h-10 min-w-0">
                <div className="relative flex h-3 w-3 shrink-0">
                  {!isRecordingPaused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                  <span className={cn("relative inline-flex rounded-full h-3 w-3", isRecordingPaused ? "bg-red-300" : "bg-red-500")}></span>
                </div>
                <span className="font-mono text-xs sm:text-sm font-medium text-red-500 min-w-[2.5rem] sm:min-w-[3rem] shrink-0">
                  {formatDuration(duration)}
                </span>
                <div className="flex-1 h-8 flex items-center justify-around gap-0.5 sm:gap-1 opacity-60 overflow-hidden px-1 sm:px-2">
                  {[...Array(30)].map((_, i) => {
                    const height1 = 4 + (i % 3) * 4;
                    const height2 = 12 + (i % 5) * 4;
                    return (
                      <motion.div
                        key={i}
                        animate={isRecordingPaused ? { height: 4 } : { height: [height1, height2, height1] }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 1 + (i % 3) * 0.2, 
                          delay: (i % 5) * 0.1,
                          ease: "easeInOut" 
                        }}
                        className="w-1 sm:w-1.5 bg-red-400 rounded-full flex-shrink-0"
                      />
                    );
                  })}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/20"
                onClick={isRecordingPaused ? resumeRecording : pauseRecording}
              >
                {isRecordingPaused ? <Mic className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              
              <Button
                variant="destructive"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0"
                onClick={stopRecording}
              >
                <Square className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex items-center gap-1 sm:gap-2"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={cancelRecording}
              >
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              
              <div className="flex-1 bg-secondary/50 h-10 sm:h-12 rounded-full flex items-center px-1 sm:px-2 gap-1 sm:gap-2 border overflow-hidden min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full shrink-0 text-primary hover:bg-primary/10"
                  onClick={togglePreviewPlayback}
                >
                  {isPlayingPreview ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>
                
                <div className="flex-1 h-1.5 bg-primary/20 rounded-full overflow-hidden relative cursor-pointer min-w-[50px]" onClick={(e) => {
                  if (audioRef.current) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    audioRef.current.currentTime = pos * audioRef.current.duration;
                  }
                }}>
                  <div className="h-full bg-primary absolute left-0 top-0 bottom-0 transition-all duration-75" style={{ width: `${previewProgress}%` }} />
                </div>
                
                <span className="font-mono text-[10px] sm:text-xs font-medium text-muted-foreground shrink-0 px-1 sm:px-2">
                  {formatDuration(duration)}
                </span>
              </div>

              <Button
                size="icon"
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full shadow-md bg-primary hover:bg-primary/90 shrink-0"
                onClick={handleSendVoice}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 sm:h-5 sm:w-5 ml-0.5" />
                )}
              </Button>
              
              {audioUrl && (
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onTimeUpdate={() => {
                    if (audioRef.current) {
                      setPreviewProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
                    }
                  }}
                  onEnded={() => {
                    setIsPlayingPreview(false);
                    setPreviewProgress(0);
                  }}
                  className="hidden" 
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
