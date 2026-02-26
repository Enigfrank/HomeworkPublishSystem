import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';

/**
 * 基于 React Router 的高阶权限守卫组件 (HOC)
 * 检查本地 Token 有效性并对比载荷内的角色标识，非法访问一律重定向拦截至页脚 Login
 * @param {object} props 包含子组件及期待鉴定的 allowedRole 等属性
 */
const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode; allowedRole?: string }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && userStr) {
    const user = JSON.parse(userStr);
    if (user.role !== allowedRole && user.role !== 'admin') {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

/**
 * 前端应用的最顶层入口组件
 * 构建 Router Hash 层级森林并挂载对应的子组件及相关鉴权守卫
 */
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/*"
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
