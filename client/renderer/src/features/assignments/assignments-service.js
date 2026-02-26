import { state } from '../../core/state.js';
import { api } from '../../core/api.js';
import { events, APP_EVENTS } from '../../core/events.js';
import { formatDate, escapeHtml } from '../../core/utils.js';

export class AssignmentsFeature {
  constructor() {
    this.el = document.getElementById('page-assignments');
    this.init();
  }

  /**
   * 初始化每日作业流组件
   * 自动挂载骨架并侦听全局 State 中的作业列表和筛选器变动
   */
  async init() {
    this.renderSkeleton();
    this.bindEvents();

    state.subscribe(({ assignments, currentFilter }) => {
      this.renderList(assignments);
      this.updateFilterUI(currentFilter);
    });
  }

  /**
   * 渲染主作业流框架的静态 HTML 骨架结构
   * 包含带状态的筛选器按钮（药丸UI）及瀑布流占位
   */
  renderSkeleton() {
    this.el.innerHTML = `
      <div class="feature-header">
        <h2 class="feature-title">每日作业</h2>
        <div class="filter-pills">
          <button class="pill active" data-filter="all">全部</button>
          <button class="pill" data-filter="unread">未读</button>
          <button class="pill" data-filter="read">已读</button>
          <button class="pill" data-filter="acknowledged">已确认</button>
        </div>
      </div>
      <div id="assignments-container" class="assignments-grid">
        <div class="loading-placeholder">正在加载作业...</div>
      </div>
    `;
  }

  /**
   * 动态生成并挂载真实的数据列表到容器
   * 支持空状态 (Empty State) 的降级占位展示
   * @param {Array} assignments 作业数据对象数组
   */
  renderList(assignments) {
    const container = this.el.querySelector('#assignments-container');
    if (!assignments || assignments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>当前暂无作业</p>
        </div>
      `;
      return;
    }

    container.innerHTML = assignments.map(item => this.createCardHtml(item)).join('');
  }

  /**
   * 根据单条作业数据拼装卡片 HTML 字符串
   * 涵盖红点未读逻辑、科目颜色章及 HTML 实体字符的安全转义
   * @param {Object} item 单条作业记录
   * @returns {string} 可用的 HTML 片段
   */
  createCardHtml(item) {
    const isUnread = item.message_status === 'unread';
    return `
      <div class="card assignment-card glass-effect ${item.message_status}" data-id="${item.id}">
        ${isUnread ? '<span class="unread-dot"></span>' : ''}
        <div class="card-header">
          <span class="subject-tag" style="background: ${item.subject_color}">${item.subject_name}</span>
          <span class="time-stamp">${formatDate(item.created_at)}</span>
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-excerpt">${escapeHtml(item.content)}</p>
        <div class="card-footer">
          <span class="teacher-name">来自: ${item.teacher_name}</span>
          <span class="status-label">${this.getStatusText(item.message_status)}</span>
        </div>
      </div>
    `;
  }

  /**
   * 返回标准化的前端汉化阅读状态短语
   * @param {string} status 如: 'unread', 'read', 'acknowledged'
   * @returns {string} 对应的中文说明
   */
  getStatusText(status) {
    const dict = {
      'unread': '未查看',
      'read': '已查看',
      'acknowledged': '已确认'
    };
    return dict[status] || status;
  }

  /**
   * 根据 State 下发的 filter 指标驱动界面上方药丸按钮的 active 态流转
   * @param {string} currentFilter 当前活跃分类键
   */
  updateFilterUI(currentFilter) {
    this.el.querySelectorAll('.pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.filter === currentFilter);
    });
  }

  /**
   * 事件代理型绑定函数：
   * 拦截类别按钮的点击并向 EventBus 触发数据刷新操作；
   * 拦截个体卡片的点击并向总线抛出弹窗呈现指令
   */
  bindEvents() {
    this.el.addEventListener('click', async (e) => {
      // 滤镜点击
      const pill = e.target.closest('.pill');
      if (pill) {
        const filter = pill.dataset.filter;
        state.set({ currentFilter: filter });
        events.emit(APP_EVENTS.ASSIGNMENTS_UPDATED);
        return;
      }

      // 卡片点击
      const card = e.target.closest('.assignment-card');
      if (card) {
        const id = parseInt(card.dataset.id);
        events.emit(APP_EVENTS.NOTIFICATION, { type: 'show-detail', id });
      }
    });
  }
}
