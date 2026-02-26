import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send, History, LogOut, AlertCircle,
  CheckCircle, XCircle, Eye, BookOpen, RefreshCw
} from 'lucide-react';
import { teacherAPI } from '@/services/api';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import type { Client, Assignment, Subject } from '@/types';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('send');
  const [clients, setClients] = useState<Client[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentMessages, setAssignmentMessages] = useState<any[]>([]);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [refreshing, setRefreshing] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchInitialData();

    // 轮询备用：刷新客户端列表
    const interval = setInterval(() => {
      fetchClients();
    }, 10000); // 延长轮询间隔，主要依赖WS

    // WebSocket 实时更新
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 优先使用 API 服务地址的 host，如果没有则使用当前窗口 host
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log('WebSocket 驱动：已连接到服务器');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'assignment_status_updated') {
          console.log('收到作业更新通知:', data);
          // 如果正在查看详情，刷新详情
          if (detailDialogOpen && selectedAssignment && selectedAssignment.id === data.data.assignment_id) {
            handleViewAssignment(selectedAssignment);
          }
          // 刷新列表（特别是已确认人数）
          if (activeTab === 'history') {
            fetchAssignments();
          }
        }
      } catch (e) {
        console.error('WS 消息解析错误:', e);
      }
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [activeTab, detailDialogOpen, selectedAssignment]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAssignments();
    }
  }, [activeTab, page]);

  /**
   * 初始化挂载时拉取当前教师关联的客户端机器列表以及其负责的科目标签信息
   */
  const fetchInitialData = async () => {
    try {
      const [clientsRes, subjectRes] = await Promise.all([
        teacherAPI.getClients(),
        teacherAPI.getMySubject()
      ]);
      setClients(clientsRes.data);
      setSubject(subjectRes.data.subject);
    } catch (err: any) {
      setError(err.response?.data?.error || '获取数据失败');
    }
  };

  /**
   * 刷新客户端列表
   */
  const fetchClients = async () => {
    try {
      const clientsRes = await teacherAPI.getClients();
      setClients(clientsRes.data);
    } catch (err: any) {
      console.error('刷新客户端列表失败:', err);
    }
  };

  /**
   * 手动刷新客户端列表
   */
  const handleRefreshClients = async () => {
    setRefreshing(true);
    try {
      await fetchClients();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * 分页拉取当前教师曾经下发过的历史作业数据清单
   */
  const fetchAssignments = async () => {
    try {
      const res = await teacherAPI.getAssignments(page);
      setAssignments(res.data.assignments);
      setPagination(res.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || '获取作业列表失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  /**
   * 提交新作业表单给选中客户端群组
   * 验证通过后触发投递并显示系统推送成功反馈提示
   */
  const handleSendAssignment = async () => {
    if (!title.trim() || !content.trim()) {
      setError('请填写标题和内容');
      return;
    }
    if (selectedClients.length === 0) {
      setError('请至少选择一个客户端');
      return;
    }

    setSending(true);
    setError('');

    try {
      const data = {
        title,
        content,
        client_ids: selectedClients
      };

      const res = await teacherAPI.createAssignment(data);
      setSuccess(`作业发布成功！共发送给 ${res.data.targetCount} 个客户端`);

      setTitle('');
      setContent('');
      setSelectedClients([]);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '发布失败');
    } finally {
      setSending(false);
    }
  };

  /**
   * 点击历史卡片查看作业投递详情（签收状态明细）
   * @param {Assignment} assignment 单条作业实体
   */
  const handleViewAssignment = async (assignment: Assignment) => {
    try {
      const res = await teacherAPI.getAssignment(assignment.id);
      setSelectedAssignment(res.data);
      setAssignmentMessages(res.data.messages || []);
      setDetailDialogOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error || '获取详情失败');
    }
  };

  /**
   * 对活跃状态下的作业执行撤回 / 取消下发操作
   * @param {number} id 目标作业 ID
   */
  const handleCancelAssignment = async (id: number) => {
    if (!confirm('确定要取消这个作业吗？')) return;
    try {
      await teacherAPI.cancelAssignment(id);
      fetchAssignments();
    } catch (err: any) {
      setError(err.response?.data?.error || '取消失败');
    }
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const selectAllClients = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.client_id));
    }
  };

  const getMessageStatusBadge = (status: string) => {
    switch (status) {
      case 'unread': return <Badge variant="outline" className="text-gray-500">未读</Badge>;
      case 'read': return <Badge variant="outline" className="text-blue-500">已读</Badge>;
      case 'acknowledged': return <Badge className="bg-green-500">已确认</Badge>;
      default: return <Badge variant="outline">未知</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold">教师工作台</h1>
                {subject && <span className="text-xs" style={{ color: subject.color }}>{subject.name}</span>}
              </div>
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

        {success && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {!subject && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>您还没有分配教学学科，请联系管理员进行设置</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="send"><Send className="w-4 h-4 mr-2" />发布作业</TabsTrigger>
            <TabsTrigger value="history"><History className="w-4 h-4 mr-2" />历史记录</TabsTrigger>
          </TabsList>

          <TabsContent value="send">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>发布新作业</CardTitle>
                    <CardDescription>填写作业信息并选择发送对象</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="title">作业标题</Label>
                      <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：数学作业 - 第3章练习题" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content">作业内容</Label>
                      <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="详细描述作业内容..." rows={8} />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>选择客户端</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshClients}
                            disabled={refreshing}
                          >
                            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                            刷新
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={selectAllClients}>
                            {selectedClients.length === clients.length ? '取消全选' : '全选'}
                          </Button>
                        </div>
                      </div>
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            客户端列表
                            <span className="text-xs text-muted-foreground">
                              (在线: {clients.filter(c => c.is_online).length} / 总计: {clients.length})
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-64">
                            <div className="space-y-2">
                              {clients.length === 0 ? (
                                <div className="text-center text-muted-foreground py-4">
                                  暂无在线客户端
                                </div>
                              ) : (
                                clients.map((client) => (
                                  <div
                                    key={client.client_id}
                                    className={`flex items-center space-x-2 p-2 hover:bg-gray-50 rounded ${!client.is_online ? 'opacity-50' : ''}`}
                                  >
                                    <Checkbox
                                      id={client.client_id}
                                      checked={selectedClients.includes(client.client_id)}
                                      onCheckedChange={() => toggleClientSelection(client.client_id)}
                                    />
                                    <label htmlFor={client.client_id} className="flex-1 text-sm cursor-pointer">
                                      <div className="flex items-center gap-2">
                                        <span>{client.name || '未命名客户端'}</span>
                                        {client.is_online ? (
                                          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
                                            在线
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">
                                            离线
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        ID: {client.client_id.slice(0, 8)}...
                                      </div>
                                    </label>
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                          <div className="mt-2 text-sm text-muted-foreground">已选择 {selectedClients.length} 个客户端</div>
                        </CardContent>
                      </Card>
                    </div>

                    <Button className="w-full" onClick={handleSendAssignment} disabled={sending || !subject}>
                      {sending ? '发送中...' : '发布作业'}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>发送提示</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <p>作业将实时推送到学生客户端</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <p>可以查看学生的阅读状态</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <p>支持选择多个客户端发送</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <p>可随时取消已发布的作业</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>作业历史</CardTitle>
                <CardDescription>查看您发布的所有作业</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>标题</TableHead>
                      <TableHead>发布时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">{assignment.title}</TableCell>
                        <TableCell>{new Date(assignment.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewAssignment(assignment)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {assignment.status === 'active' && (
                              <Button variant="ghost" size="sm" onClick={() => handleCancelAssignment(assignment.id)}>
                                <XCircle className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      上一页
                    </Button>
                    <span className="px-4 py-2 text-sm text-muted-foreground">
                      {page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAssignment?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>作业内容</Label>
              <div className="p-3 bg-gray-50 rounded text-sm mt-1">
                {selectedAssignment?.content}
              </div>
            </div>
            <div>
              <Label>接收状态</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>客户端</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>更新时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentMessages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell>{msg.client_name || msg.client_id}</TableCell>
                      <TableCell>{getMessageStatusBadge(msg.status)}</TableCell>
                      <TableCell>{msg.updated_at ? new Date(msg.updated_at).toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setDetailDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
