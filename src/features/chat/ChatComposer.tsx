import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mic, Send, Paperclip } from 'lucide-react';

interface ChatComposerProps {
  receiverId: string;
  onSendVoice: (blob: Blob, durationMs: number) => void;
  onSendText: (text: string) => void;
  onSendMedia: (file: File) => void;
}

export default function ChatComposer({ receiverId, onSendVoice, onSendText, onSendMedia }: ChatComposerProps) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim()) {
      onSendText(text);
      setText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSendMedia(e.target.files[0]);
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 border-t">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange} 
        accept="image/*,video/*"
      />
      <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
        <Paperclip className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon">
        <Mic className="h-4 w-4" />
      </Button>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
      />
      <Button onClick={handleSend} disabled={!text.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
