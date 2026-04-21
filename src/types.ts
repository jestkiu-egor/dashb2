export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: Date;
}

export interface TaskComment {
  id: string;
  task_id: string;
  text: string;
  file_url?: string;
  file_name?: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  comments: Comment[];
  dueDate?: Date;
  amount?: number;
  isPaid?: boolean;
  isAgreed?: boolean;
  externalUrl?: string;
  assignee?: string;
  files?: string[];
  order?: number;
}

export interface Proxy {
  id: string;
  ip: string;
  port: string;
  login: string;
  passwordHash: string;
  type: 'HTTP' | 'SOCKS5' | 'HTTPS';
  ipv6?: string;
  expiresAt: Date;
  comment?: string;
  isShared?: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  usageLocation: string;
  expiresAt: Date;
}

export interface Subscription {
  id: string;
  serviceName: string;
  expiresAt: Date;
}

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Date;
  status: 'Completed' | 'Pending';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  proxies: Proxy[];
  apiKeys: ApiKey[];
  subscriptions: Subscription[];
  tasks: Task[];
  transactions: Transaction[];
  createdAt: Date;
}

export interface AssistantSettings {
  id: string;
  llm_api_url: string;
  llm_model: string;
  llm_api_key: string;
  llm_prompt: string;
  proxy_host: string;
  proxy_port: number;
  proxy_login: string;
  proxy_password: string;
}
