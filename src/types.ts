export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  status: 'Ativo' | 'Inativo';
  createdAt?: any;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: any;
  updatedAt: any;
  lastMessage?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: any;
  metadata?: any;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: any;
}

export interface WhatsAppInstance {
  id: string;
  userId: string;
  instanceName: string;
  name: string; // Friendly name for display
  status: 'open' | 'close' | 'connecting';
  apikey: string;
  agentId?: string;
  createdAt: any;
}

export interface AIAgent {
  id: string;
  userId: string;
  name: string;
  systemPrompt: string;
  useRAG: boolean;
  responseDelayMs?: number;
  useTyping?: boolean;
  callOtherAgents?: boolean;
  tools_enabled?: string[];
  catalogs?: string[];
  createdAt: any;
}

export interface Catalog {
  id: string;
  userId: string;
  name: string;
  currency: string;
  items: CatalogItem[];
  createdAt: any;
  updatedAt: any;
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  duration_min?: number;
  description?: string;
}
