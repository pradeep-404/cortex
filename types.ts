export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64 string or text content
  name?: string;
  isText?: boolean; // For extracted text from docx/txt
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
  attachments?: Attachment[];
  latency?: number; // Time in ms
  groundingSources?: { title: string; uri: string }[]; // For research model results
  modelUsed?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  lastModelId?: string;
}

export type ModelId = 'flash' | 'reasoning' | 'research';

export interface ModelConfig {
  id: ModelId;
  name: string;
  description: string;
  apiModel: string;
  useGrounding?: boolean;
}