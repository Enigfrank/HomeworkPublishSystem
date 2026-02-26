// 用户类型
export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'teacher';
  subject?: Subject;
  subject_id?: number;
  subject_name?: string;
  subject_color?: string;
  created_at?: string;
}

// 学科类型
export interface Subject {
  id: number;
  name: string;
  code: string;
  color: string;
}

// 客户端类型
export interface Client {
  id?: number;
  client_id: string;
  name?: string;
  created_at?: string;
  last_seen?: string;
  is_online?: boolean;
}

// 作业类型
export interface Assignment {
  id: number;
  title: string;
  content: string;
  teacher_id: number;
  teacher_name?: string;
  subject_id: number;
  subject_name?: string;
  subject_color?: string;
  client_id?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
  target_count?: number;
  acknowledged_count?: number;
  recipient_count?: number;
  read_count?: number;
}

// 消息类型
export interface Message {
  id: number;
  assignment_id: number;
  client_id: string;
  client_name?: string;
  status: 'unread' | 'read' | 'acknowledged';
  created_at: string;
  read_at?: string;
  updated_at?: string;
}

// 统计数据
export interface Stats {
  teacherCount: number;
  subjectCount: number;
  clientCount: number;
  assignmentCount: number;
}

// API响应类型
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// 分页类型
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
