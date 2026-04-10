export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: Date;
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
  last_status?: 'ok' | 'error' | 'unknown';
  last_check_at?: Date | string;
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
