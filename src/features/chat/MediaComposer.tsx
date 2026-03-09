import React, { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Paperclip, Loader2 } from 'lucide-react';
import { getMessageType, validateFile } from '@/utils/fileUtils';

interface MediaComposerProps {
  receiverId: string;
  onSendMedia: (data: {
    type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
  }) => Promise<any>;
  isUploading: boolean;
  setIsUploading: (isUploading: boolean) => void;
}

export default function MediaComposer({ receiverId, onSendMedia, isUploading, setIsUploading }: MediaComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validationError = validateFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    const type = getMessageType(file);
    if (!type) {
      alert('Unsupported file type');
      return;
    }
    
    setIsUploading(true);
    try {
      await onSendMedia({
        type,
        receiver_id: receiverId,
        file,
      });
    } catch (err) {
      console.error('Error uploading file:', err);
      alert('Failed to send file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        title="Send file"
      >
        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*"
      />
    </>
  );
}
