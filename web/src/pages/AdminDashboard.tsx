import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Users, BookOpen, LayoutDashboard,
  Plus, Edit, Trash2, LogOut, AlertCircle, School, Monitor
} from 'lucide-react';
import { adminAPI } from '@/services/api';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import FirstLoginPasswordDialog from '@/components/FirstLoginPasswordDialog';
import type { User, Subject, Client, Stats } from '@/types';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState('');

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [firstLoginDialogOpen, setFirstLoginDialogOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  /**
   * 初始化组件数据并建立 WebSocket 实时监听
   * 同时检查是否为首次登录
   */
  useEffect(() => {
    // 检查是否为首次登录
    const isFirstLogin = localStorage.getItem('first_login_pending');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (isFirstLogin === 'true' || currentUser.first_login) {
      setFirstLoginDialogOpen(true);
    }

    fetchData();

    // 建立 WebSocket 连接以获取实时状态更新
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log('管理员 WebSocket：已建立同步通道');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // 当收到客户端状态变更通知时，局部或全局刷新数据
        if (data.type === 'client_status_changed') {
          console.log('检测到客户端状态变动:', data.data);
          // 刷新统计信息和客户端列表
          refreshDashboardData();
        }
      } catch (e) {
        console.error('WS 消息解析错误:', e);
      }
    };

    // 兜底方案：每 30 秒全量刷新一次数据
    const interval = setInterval(fetchData, 30000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  /**
   * 仅刷新仪表盘概览和客户端列表相关的实时数据
   */
  const refreshDashboardData = async () => {
    try {
      const [statsRes, clientsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getClients()
      ]);
      setStats(statsRes.data);
      setClients(clientsRes.data);
    } catch (err: any) {
      console.error('刷新实时数据失败:', err);
    }
  };

  /**
   * 获取管理员面板所需的所有初始数据
   */
  const fetchData = async () => {
    try {
      const [statsRes, usersRes, subjectsRes, clientsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers(),
        adminAPI.getSubjects(),
        adminAPI.getClients()
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setSubjects(subjectsRes.data);
      setClients(clientsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '获取数据失败');
    }
  };

  /**
   * 执行退出登录逻辑，清除本地存储并重定向
   */
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('auto_login');
    localStorage.removeItem('saved_username');
    localStorage.removeItem('saved_password');
    localStorage.removeItem('first_login_pending');
    navigate('/login');
  };

  /**
   * 提交表单以创建新的教师账户
   */
  const handleCreateUser = async () => {
    try {
      await adminAPI.createUser(formData);
      setUserDialogOpen(false);
      setFormData({});
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || '创建失败');
    }
  };

  /**
   * 提提交表单以更新现有的教师账户
   */
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await adminAPI.updateUser(editingUser.id, formData);
      setUserDialogOpen(false);
      setEditingUser(null);
      setFormData({});
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || '更新失败');
    }
  };

  /**
   * 根据 ID 删除指定的教师账户
   * @param id 用户 ID
   */
  const handleDeleteUser = async (id: number) => {
    if (!confirm('确定要删除这个老师账户吗？')) return;
    try {
      await adminAPI.deleteUser(id);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  /**
   * 提交表单以创建新的学科
   */
  const handleCreateSubject = async () => {
    try {
      await adminAPI.createSubject(formData);
      setSubjectDialogOpen(false);
      setFormData({});
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || '创建失败');
    }
  };

  /**
   * 提交表单以更新现有的学科信息
   */
  const handleUpdateSubject = async () => {
    if (!editingSubject) return;
    try {
      await adminAPI.updateSubject(editingSubject.id, formData);
      setSubjectDialogOpen(false);
      setEditingSubject(null);
      setFormData({});
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || '更新失败');
    }
  };

  /**
   * 根据 ID 删除指定的学科
   * @param id 学科 ID
   */
  const handleDeleteSubject = async (id: number) => {
    if (!confirm('确定要删除这个学科吗？')) return;
    try {
      await adminAPI.deleteSubject(id);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  /**
   * 根据客户端ID删除指定的客户端
   * @param clientId 客户端ID
   */
  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('确定要删除这个客户端吗？\n\n注意：删除后该客户端将无法接收作业推送。')) return;
    try {
      await adminAPI.deleteClient(clientId);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <School className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold">管理后台</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">欢迎，{user.name}</span>
              <ChangePasswordDialog />
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-2" />概览</TabsTrigger>
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" />老师管理</TabsTrigger>
            <TabsTrigger value="subjects"><BookOpen className="w-4 h-4 mr-2" />学科管理</TabsTrigger>
            <TabsTrigger value="clients"><Monitor className="w-4 h-4 mr-2" />客户端管理</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard title="老师数量" value={stats?.teacherCount || 0} icon={Users} color="bg-blue-500" />
              <StatCard title="学科数量" value={stats?.subjectCount || 0} icon={BookOpen} color="bg-green-500" />
              <StatCard title="客户端数量" value={stats?.clientCount || 0} icon={LayoutDashboard} color="bg-orange-500" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>系统信息</CardTitle>
                <CardDescription>远程作业发布系统管理后台</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>系统版本：</strong>v1.0.0</p>
                  <p><strong>当前用户：</strong>{user.name} ({user.username})</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>老师管理</CardTitle>
                  <CardDescription>管理老师账户和分配学科</CardDescription>
                </div>
                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingUser(null); setFormData({}); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      添加老师
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingUser ? '编辑老师' : '添加老师'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>用户名</Label>
                        <Input value={formData.username || ''} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="请输入用户名" />
                      </div>
                      <div className="space-y-2">
                        <Label>姓名</Label>
                        <Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="请输入姓名" />
                      </div>
                      <div className="space-y-2">
                        <Label>密码{editingUser && '（留空则不修改）'}</Label>
                        <Input type="password" value={formData.password || ''} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="请输入密码" />
                      </div>
                      <div className="space-y-2">
                        <Label>教学学科</Label>
                        <Select value={formData.subject_id?.toString()} onValueChange={(v) => setFormData({ ...formData, subject_id: parseInt(v) })}>
                          <SelectTrigger><SelectValue placeholder="选择学科" /></SelectTrigger>
                          <SelectContent>
                            {subjects.map((s) => (
                              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setUserDialogOpen(false)}>取消</Button>
                      <Button onClick={editingUser ? handleUpdateUser : handleCreateUser}>{editingUser ? '保存' : '创建'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户名</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>学科</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter(u => u.role === 'teacher').map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>
                          {user.subject_name ? (
                            <Badge style={{ backgroundColor: user.subject_color }}>{user.subject_name}</Badge>
                          ) : (<span className="text-muted-foreground">未分配</span>)}
                        </TableCell>
                        <TableCell>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingUser(user); setFormData({ name: user.name, subject_id: user.subject_id }); setUserDialogOpen(true); }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subjects">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>学科管理</CardTitle>
                  <CardDescription>管理系统学科</CardDescription>
                </div>
                <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingSubject(null); setFormData({}); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      添加学科
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingSubject ? '编辑学科' : '添加学科'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>学科名称</Label>
                        <Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="如：数学" />
                      </div>
                      <div className="space-y-2">
                        <Label>学科代码</Label>
                        <Input value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="如：math" />
                      </div>
                      <div className="space-y-2">
                        <Label>颜色</Label>
                        <Input type="color" value={formData.color || '#3b82f6'} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSubjectDialogOpen(false)}>取消</Button>
                      <Button onClick={editingSubject ? handleUpdateSubject : handleCreateSubject}>{editingSubject ? '保存' : '创建'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>学科名称</TableHead>
                      <TableHead>代码</TableHead>
                      <TableHead>颜色</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjects.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell>{subject.name}</TableCell>
                        <TableCell>{subject.code}</TableCell>
                        <TableCell><div className="w-8 h-8 rounded" style={{ backgroundColor: subject.color }} /></TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingSubject(subject); setFormData({ ...subject }); setSubjectDialogOpen(true); }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteSubject(subject.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>客户端管理</CardTitle>
                  <CardDescription>查看和管理已注册的客户端设备</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户端ID</TableHead>
                      <TableHead>客户端名称</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>最后在线时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          暂无客户端注册
                        </TableCell>
                      </TableRow>
                    ) : (
                      clients.map((client) => (
                        <TableRow key={client.client_id}>
                          <TableCell>{client.client_id}</TableCell>
                          <TableCell>{client.name || '未命名客户端'}</TableCell>
                          <TableCell>
                            {client.is_online ? (
                              <Badge className="bg-green-500">在线</Badge>
                            ) : (
                              <Badge variant="secondary">离线</Badge>
                            )}
                          </TableCell>
                          <TableCell>{client.last_seen ? new Date(client.last_seen).toLocaleString() : '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteClient(client.client_id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* 首次登录强制修改密码对话框 */}
      <FirstLoginPasswordDialog
        open={firstLoginDialogOpen}
        onOpenChange={setFirstLoginDialogOpen}
        onSuccess={() => {
          setFirstLoginDialogOpen(false);
          localStorage.removeItem('first_login_pending');
          // 更新用户信息
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          currentUser.first_login = false;
          localStorage.setItem('user', JSON.stringify(currentUser));
        }}
      />
    </div>
  );
}
