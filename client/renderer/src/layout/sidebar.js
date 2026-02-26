import { state } from '../core/state.js';

export class Sidebar {
    constructor() {
        this.el = document.createElement('nav');
        this.el.className = 'sidebar glass-effect';
        this.init();
    }

    /**
     * 生命周期初始化函数
     * 包括初次 DOM 建树、事件绑定以及对应用全局状态中未读数变动的响应式订阅
     */
    init() {
        this.render();
        this.bindEvents();

        state.subscribe(({ currentFilter, unreadCount }) => {
            this.updateUnreadBadge(unreadCount);
        });
    }

    /**
     * 组件内的静态 HTML 骨架渲染函数
     */
    render() {
        this.el.innerHTML = `
      <div class="sidebar-logo">
        <span class="icon">📚</span>
      </div>
      <div class="nav-items">
        <button class="nav-item active" data-page="assignments" title="作业">
          <div class="nav-icon">📝</div>
          <span id="nav-unread-badge" class="badge" style="display: none;">0</span>
        </button>
        <button class="nav-item" data-page="settings" title="设置">
          <div class="nav-icon">⚙️</div>
        </button>
      </div>
    `;
    }

    /**
     * 根据传入的未读作业总量增量更新任务栏的红色角标 (Badge) 的显隐和面值
     * @param {number} count 未读数量
     */
    updateUnreadBadge(count) {
        const badge = this.el.querySelector('#nav-unread-badge');
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * 绑定本侧边栏相关元素内的点击代理事件（主要处理侧边 Tab 按钮切换事件）
     */
    bindEvents() {
        this.el.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-item');
            if (btn) {
                const page = btn.dataset.page;
                this.setActive(page);
                // 发送页面切换逻辑
                document.querySelectorAll('.page').forEach(p => {
                    p.classList.toggle('active', p.id === `page-${page}`);
                });
            }
        });
    }

    /**
     * 更新侧边栏导航的高亮选区状态
     * @param {string} pageName 被点击页面的标识(ID)
     */
    setActive(pageName) {
        this.el.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === pageName);
        });
    }
}
