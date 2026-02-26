import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyRound, AlertCircle, CheckCircle } from 'lucide-react';
import { authAPI } from '@/services/api';

interface ChangePasswordDialogProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * 封装为一个纯控态 React Dialog 组件的修改密码交互体
 * 当内置表单验证并成功响应后，弹窗会主动浮现执行通知后隐没
 */
export default function ChangePasswordDialog({
  variant = 'outline',
  size = 'sm',
}: ChangePasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * 表单受控提交主控函数
   * 拦截长度及二次确认比对后才尝试拉起远端更换请求
   */
  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    // 验证
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码至少需要6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (oldPassword === newPassword) {
      setError('新密码不能与旧密码相同');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(oldPassword, newPassword);
      setSuccess('密码修改成功！');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // 2秒后自动关闭
      setTimeout(() => {
        setOpen(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 强行重置状态数据并隐蔽弹窗
   */
  const handleClose = () => {
    setOpen(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <KeyRound className="w-4 h-4 mr-2" />
          修改密码
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-green-500 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="oldPassword">当前密码</Label>
            <Input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入当前密码"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '修改中...' : '确认修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
