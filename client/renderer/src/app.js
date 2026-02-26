import { state } from './core/state.js';
import { api } from './core/api.js';
import { events, APP_EVENTS } from './core/events.js';

import { Sidebar } from './layout/sidebar.js';
import { Header } from './layout/header.js';
import { AssignmentsFeature } from './features/assignments/assignments-service.js';
import { AssignmentModal } from './features/assignments/assignment-modal.js';
import { SettingsFeature } from './features/settings/settings-form.js';

class App {
    constructor() {
        this.root = document.getElementById('app');
        this.init();
    }

    /**
     * 异步启动渲染环境容器主生命周期
     * 包括读取设置、组装 UI Shell 及渲染全局组件、触发首次数据抓取
     */
    async init() {
        // 1. 初始化核心状态和配置
        const config = await api.getConfig();
        state.set({ config });

        // 2. 初始化 UI 布局
        this.sidebar = new Sidebar();
        this.header = new Header();

        // 请求初始连接状态并同步到 state
        const wsStatus = await api.getWsStatus();
        state.set({ wsStatus });

        const shell = document.createElement('div');
        shell.className = 'app-shell';

        const main = document.createElement('main');
        main.className = 'main-content';
        main.innerHTML = `
      <div id="page-assignments" class="page active"></div>
      <div id="page-settings" class="page"></div>
    `;

        const footer = document.createElement('footer');
        footer.className = 'app-footer';
        footer.innerHTML = '<span class="copyright">Enigfrank 版权所有</span>';

        shell.appendChild(this.sidebar.el);
        shell.appendChild(this.header.el);
        shell.appendChild(main);
        shell.appendChild(footer);
        this.root.appendChild(shell);

        // 3. 初始化功能特性
        this.assignments = new AssignmentsFeature();
        this.settings = new SettingsFeature();
        this.assignmentModal = new AssignmentModal();

        // 4. 绑定监听器
        this.setupListeners();

        // 5. 初始拉取数据
        if (config.clientId) {
            this.refreshData();
        } else {
            // 如果没注册，跳转到设置
            this.navigateTo('settings');
        }
    }

    /**
     * 设置全生命周期存在的全局或 IPC 转发事件监听
     * 主要处理 Web Socket 的连接状态流转和服务器主动的交互动作推送
     */
    setupListeners() {
        // 监听 WebSocket 状态
        api.onWsStatus((wsStatus) => {
            state.set({ wsStatus });
        });

        // 监听新作业通知
        api.onNewAssignment((data) => {
            console.log('New assignment received:', data);
            this.refreshData();
        });

        // 监听作业取消通知
        api.onAssignmentCancelled((data) => {
            console.log('Assignment cancelled:', data);
            this.refreshData();
        });

        // 监听主进程导航指令
        api.onNavigate((page) => {
            this.navigateTo(page);
        });

        // 监听内部刷新请求
        events.on(APP_EVENTS.ASSIGNMENTS_UPDATED, () => {
            this.refreshData();
        });
    }

    /**
     * 全局核心数据抓取管道
     * 同时通过接口同步获取作业清单和未读数，然后派发至全局 State 进行统一驱动更新
     */
    async refreshData() {
        const { config, currentFilter } = state.get();
        if (!config.clientId) return;

        try {
            const [assignments, unreadData] = await Promise.all([
                api.getAssignments(config.clientId, currentFilter === 'all' ? '' : currentFilter),
                api.getUnreadCount(config.clientId)
            ]);

            state.set({
                assignments,
                unreadCount: unreadData.unread_count
            });
        } catch (e) {
            console.error('Failed to refresh data', e);
        }
    }

    /**
     * 提供视图内页面的顶级哈希切换 / 显隐控制
     * 同步更新侧边栏焦点以及主容器内页显现状态
     * @param {string} pageId 页面映射 ID，如 'assignments' | 'settings'
     */
    navigateTo(pageId) {
        this.sidebar.setActive(pageId);
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${pageId}`);
        });
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
