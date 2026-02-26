import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookOpen, Server, AlertCircle } from 'lucide-react';
import { authAPI } from '@/services/api';

/**
 * 系统单点登录页通用组件
 * 包含账户密码表单及用于调整跨域/部署环境的前端 API 端点配置区
 * 支持自动登录功能
 */
export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(false);
  const [serverURL, setServerURL] = useState(localStorage.getItem('api_url') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  // 检查是否有保存的自动登录凭据，并自动执行登录
  useEffect(() => {
    const savedAutoLogin = localStorage.getItem('auto_login');
    if (savedAutoLogin === 'true') {
      const savedUsername = localStorage.getItem('saved_username') || '';
      const savedPassword = localStorage.getItem('saved_password') || '';
      if (savedUsername && savedPassword) {
        setUsername(savedUsername);
        setPassword(savedPassword);
        setAutoLogin(true);
        setIsAutoLoggingIn(true);
        // 自动执行登录
        autoLoginUser(savedUsername, savedPassword);
      }
    }
  }, []);

  // 自动登录函数
  const autoLoginUser = async (savedUsername: string, savedPassword: string) => {
    if (serverURL) {
      localStorage.setItem('api_url', serverURL);
    }

    try {
      const response = await authAPI.login(savedUsername, savedPassword, true);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // 如果是首次登录，保存标记到本地存储
      if (user.first_login) {
        localStorage.setItem('first_login_pending', 'true');
      }

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/teacher');
      }
    } catch (err: any) {
      // 自动登录失败，清除保存的凭据并显示错误
      localStorage.removeItem('auto_login');
      localStorage.removeItem('saved_username');
      localStorage.removeItem('saved_password');
      setError('自动登录失败，请重新输入用户名和密码');
      setUsername(savedUsername);
      setIsAutoLoggingIn(false);
      setLoading(false);
    }
  };

  /**
   * 处理登录表单的默认提交防反转及接口回传鉴权
   * 支持自动登录功能，保存凭据到本地存储
   * @param {React.FormEvent} e
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (serverURL) {
      localStorage.setItem('api_url', serverURL);
    }

    try {
      const response = await authAPI.login(username, password, autoLogin);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // 处理自动登录设置
      if (autoLogin) {
        localStorage.setItem('auto_login', 'true');
        localStorage.setItem('saved_username', username);
        // 注意：实际项目中应该加密存储密码
        localStorage.setItem('saved_password', password);
      } else {
        localStorage.removeItem('auto_login');
        localStorage.removeItem('saved_username');
        localStorage.removeItem('saved_password');
      }

      // 如果是首次登录，保存标记到本地存储
      if (user.first_login) {
        localStorage.setItem('first_login_pending', 'true');
      }

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/teacher');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">远程作业发布系统</CardTitle>
            <CardDescription>Made By Enigfrank</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 自动登录状态提示 */}
          {isAutoLoggingIn && !error && (
            <Alert className="mb-4">
              <AlertDescription>正在自动登录...</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || isAutoLoggingIn}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || isAutoLoggingIn}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoLogin"
                checked={autoLogin}
                onCheckedChange={(checked) => setAutoLogin(checked as boolean)}
                disabled={loading || isAutoLoggingIn}
              />
              <Label
                htmlFor="autoLogin"
                className="text-sm font-normal cursor-pointer"
              >
                自动登录（7天内免密登录）
              </Label>
            </div>

            {showSettings && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <Label htmlFor="server" className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  服务器地址
                </Label>
                <Input
                  id="server"
                  type="text"
                  placeholder="http://localhost:3000/api"
                  value={serverURL}
                  onChange={(e) => setServerURL(e.target.value)}
                  disabled={loading || isAutoLoggingIn}
                />
                <p className="text-xs text-muted-foreground">
                  默认使用当前域名，仅在需要时修改
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowSettings(!showSettings)}
              disabled={loading || isAutoLoggingIn}
            >
              {showSettings ? '隐藏高级设置' : '高级设置'}
            </Button>

            <Button type="submit" className="w-full" disabled={loading || isAutoLoggingIn}>
              {loading || isAutoLoggingIn ? '登录中...' : '登录'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>超级管理员账户: admin 密码: admin  </p>
            <p>首次登录后请立即修改密码,如已修改请忽略  </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
