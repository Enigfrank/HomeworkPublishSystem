import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { authAPI } from '@/services/api';

interface FirstLoginPasswordDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * 首次登录强制修改密码对话框
 * 用于 admin 用户首次登录时强制修改默认密码
 * 此对话框无法被关闭，必须完成密码修改
 */
export default function FirstLoginPasswordDialog({
  open,
  onOpenChange,
  onSuccess,
}: FirstLoginPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // 清空状态当对话框打开时
  useEffect(() => {
    if (open) {
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('');
    }
  }, [open]);

  // 拦截关闭请求：只允许打开，不允许通过任何方式关闭（包括 X 按钮、ESC、外部点击）
  const handleOpenChange = (newOpen: boolean) => {
    // 如果父组件想要打开（通常不会发生），允许；如果试图关闭，直接忽略
    if (newOpen) {
      onOpenChange?.(newOpen);
    }
    // 当 newOpen 为 false 时，什么都不做，对话框保持打开
  };

  /**
   * 表单提交处理
   * 验证新密码并提交修改
   */
  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    // 验证
    if (!newPassword || !confirmPassword) {
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

    if (newPassword === 'admin') {
      setError('新密码不能为默认密码"admin"');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePasswordFirstLogin(newPassword);
      setSuccess('密码修改成功！');
      
      // 更新本地存储的用户信息
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.first_login = false;
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      // 1秒后关闭并通知成功
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={true}>
      <DialogContent
        className="sm:max-w-[425px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">首次登录安全设置</DialogTitle>
          <DialogDescription className="text-center">
            检测到这是您首次登录系统，为了账户安全，请修改默认密码
          </DialogDescription>
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
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-medium">安全提示：</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>密码长度至少6位</li>
              <li>不要使用默认密码"admin"</li>
              <li>建议使用字母、数字组合</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="firstNewPassword">新密码</Label>
            <Input
              id="firstNewPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstConfirmPassword">确认新密码</Label>
            <Input
              id="firstConfirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="w-full"
          >
            {loading ? '修改中...' : '确认修改并进入系统'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}