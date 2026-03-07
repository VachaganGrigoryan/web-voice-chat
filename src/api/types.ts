export interface User {
  id: string;
  email: string;
  // Add other user fields if available
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AudioMeta {
  storage: 'local' | 's3';
  key: string;
  url: string;
  mime: string;
  size_bytes: number;
  duration_ms: number | null;
}

export interface MessageDoc {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  type: 'voice';
  audio: AudioMeta;
  status: 'sent' | 'delivered' | 'read';
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    cursor: string | null;
    next_cursor: string | null;
    limit: number | null;
    total: number | null;
  };
}

export interface SuccessResponse<T> {
  success: boolean;
  data: T;
}

export interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details: any;
  };
}
