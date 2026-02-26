import { state } from '../core/state.js';

export class Header {
    constructor() {
        this.el = document.createElement('header');
        this.el.className = 'header glass-effect';
        this.init();
    }

    /**
     * 初始化顶部栏实例
     * 绑入 DOM 后建立针对 WebSocket 连接状态变化的响应式关联
     */
    init() {
        this.render();

        state.subscribe(({ wsStatus }) => {
            this.updateStatus(wsStatus);
        });
    }

    /**
     * 渲染顶部标题及当前网络环境/通信状态的骨架徽标
     */
    render() {
        this.el.innerHTML = `
      <div class="header-content">
        <h1 class="header-title">作业中心</h1>
        <div class="header-actions">
          <div id="status-indicator" class="status-indicator disconnected">
            <span class="status-dot"></span>
            <span class="status-text">未连接</span>
          </div>
        </div>
      </div>
    `;
    }

    /**
     * 根据主进程透过 IPC 传递的 WS 连接状态实施 UI 样式变更
     * @param {string} status 预期值例如: 'connected' | 'connecting' | 'disconnected'
     */
    updateStatus(status) {
        const indicator = this.el.querySelector('#status-indicator');
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');

        indicator.className = `status-indicator ${status}`;

        switch (status) {
            case 'connected':
                text.textContent = '已连接';
                break;
            case 'connecting':
                text.textContent = '正在连接...';
                break;
            case 'error':
                text.textContent = '连接错误';
                break;
            default:
                text.textContent = '未连接';
        }
    }
}
