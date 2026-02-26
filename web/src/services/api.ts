import axios, { type AxiosInstance, type AxiosError } from 'axios';

// 从环境变量或本地存储获取API基础URL
const getBaseURL = () => {
  const savedURL = localStorage.getItem('api_url');
  if (savedURL) return savedURL;

  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }

  return '/api';
};

const api: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isLoginRequest = requestUrl.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * 账号认证系列接口
 * 包含基础的登录鉴权、信息获取和密码变更请求
 */
export const authAPI = {
  login: (username: string, password: string, autoLogin?: boolean) =>
    api.post('/auth/login', { username, password, autoLogin }),

  getMe: () => api.get('/auth/me'),

  changePassword: (oldPassword: string, newPassword: string, isFirstLogin?: boolean) =>
    api.post('/auth/change-password', { oldPassword, newPassword, isFirstLogin }),

  // 首次登录修改密码（不需要旧密码）
  changePasswordFirstLogin: (newPassword: string) =>
    api.post('/auth/change-password', { newPassword, isFirstLogin: true })
};

/**
 * 管理员特权业务系列接口
 * 针对系统用户(教师)列表的管理、全局学科 CRUD，以及系统状态与客户端一览
 */
export const adminAPI = {
  getUsers: () => api.get('/admin/users'),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: number, data: any) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),

  getSubjects: () => api.get('/admin/subjects'),
  createSubject: (data: any) => api.post('/admin/subjects', data),
  updateSubject: (id: number, data: any) => api.put(`/admin/subjects/${id}`, data),
  deleteSubject: (id: number) => api.delete(`/admin/subjects/${id}`),

  getClients: () => api.get('/admin/clients'),
  deleteClient: (clientId: string) => api.delete(`/admin/clients/${clientId}`),

  getStats: () => api.get('/admin/stats')
};

/**
 * 教师专属系列业务接口
 * 包括针对自身所分配科目的查阅、作业列表管理及核心的推送下发能力实现
 */
export const teacherAPI = {
  getClients: () => api.get('/teacher/clients'),

  getAssignments: (page = 1, limit = 20) =>
    api.get(`/teacher/assignments?page=${page}&limit=${limit}`),
  getAssignment: (id: number) => api.get(`/teacher/assignments/${id}`),
  createAssignment: (data: any) => api.post('/teacher/assignments', data),
  cancelAssignment: (id: number) => api.put(`/teacher/assignments/${id}/cancel`),

  getMySubject: () => api.get('/teacher/my-subject')
};

/**
 * 专为 Electron 下发端提供的辅助系列 HTTP 接口
 * （注意：实际的实时消息通信多循 WebSocket 通道，但心跳及强刷可借由以下端点）
 */
export const clientAPI = {
  register: (data: any) => api.post('/client/register', data),
  getInfo: (clientId: string) => api.get(`/client/info/${clientId}`),
  getAssignments: (clientId: string, status?: string) =>
    api.get(`/client/assignments/${clientId}${status ? `?status=${status}` : ''}`),
  markRead: (assignmentId: number, clientId: string) =>
    api.post(`/client/assignments/${assignmentId}/read`, { client_id: clientId }),
  acknowledge: (assignmentId: number, clientId: string) =>
    api.post(`/client/assignments/${assignmentId}/acknowledge`, { client_id: clientId }),
  getUnreadCount: (clientId: string) => api.get(`/client/unread-count/${clientId}`),
  heartbeat: (clientId: string) => api.post('/client/heartbeat', { client_id: clientId })
};

export default api;
