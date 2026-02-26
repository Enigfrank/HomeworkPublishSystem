import { state } from '../../core/state.js';
import { api } from '../../core/api.js';
import { events, APP_EVENTS } from '../../core/events.js';
import { formatDate, escapeHtml } from '../../core/utils.js';

export class AssignmentModal {
    constructor() {
        this.el = document.createElement('div');
        this.el.className = 'modal-backdrop';
        this.el.style.display = 'none';
        this.init();
    }

    /**
     * 弹窗容器初始化
     * 绑入 DOM 树根级，拦截全局总线派发的展示请求
     */
    init() {
        this.render();
        this.bindEvents();
        document.body.appendChild(this.el);

        events.on(APP_EVENTS.NOTIFICATION, (detail) => {
            if (detail && detail.type === 'show-detail') {
                this.show(detail.id);
            }
        });
    }

    /**
     * 从当前全局 State 中取得详细信息并主动展开模态框
     * 附带自动调用已读的上报接口行为
     * @param {number|string} id 所点击作业的唯一 ID
     */
    show(id) {
        const { assignments, config } = state.get();
        const item = assignments.find(a => a.id === id);
        if (!item) return;

        this.currentItem = item;
        this.renderContent(item);
        this.el.style.display = 'flex';

        // 自动标记已读
        if (item.message_status === 'unread') {
            this.markAsRead(item.id, config.clientId);
        }
    }

    /**
     * 触发异步的已读接口上报，并在成功后命令全局 State 刷新
     * @param {number|string} id 
     * @param {string} clientId 
     */
    async markAsRead(id, clientId) {
        try {
            await api.markRead(id, clientId);
            events.emit(APP_EVENTS.ASSIGNMENTS_UPDATED);
        } catch (e) {
            console.error('Failed to mark as read', e);
        }
    }

    /**
     * 初始化空白的模态框骨架容器
     */
    render() {
        this.el.innerHTML = `
      <div class="modal-content glass-effect">
        <div id="modal-body-container"></div>
      </div>
    `;
    }

    /**
     * 根据传入的单条详情对象渲染正文、属性和底部操作按钮
     * @param {Object} item 作业详情数据
     */
    renderContent(item) {
        const container = this.el.querySelector('#modal-body-container');
        container.innerHTML = `
      <div class="modal-header">
        <button class="close-btn">&times;</button>
        <div class="modal-meta">
          <span class="subject-tag" style="background: ${item.subject_color}">${item.subject_name}</span>
          <span class="time">${formatDate(item.created_at)}</span>
        </div>
        <h2 class="modal-title">${escapeHtml(item.title)}</h2>
        <div class="teacher-info">教师: ${item.teacher_name}</div>
      </div>
      <div class="modal-body">
        <div class="content-text">${escapeHtml(item.content)}</div>
      </div>
      <div class="modal-footer">
        ${item.message_status !== 'acknowledged' ? `
          <button class="btn btn-primary" id="btn-ack">确认收到</button>
        ` : `
          <div class="status-msg success">已确认收到</div>
        `}
      </div>
    `;
    }

    /**
     * 处理学生点击底部"确认收到"按钮的交互
     */
    async acknowledge() {
        const { config } = state.get();
        try {
            await api.acknowledge(this.currentItem.id, config.clientId);
            this.hide();
            events.emit(APP_EVENTS.ASSIGNMENTS_UPDATED);
        } catch (e) {
            alert('确认收到失败: ' + e.message);
        }
    }

    /**
     * 隐藏当前模态框
     */
    hide() {
        this.el.style.display = 'none';
    }

    /**
     * 挂载阴影遮罩点击、X 按钮以及底部确认按钮的复合事件代理池
     */
    bindEvents() {
        this.el.addEventListener('click', (e) => {
            if (e.target === this.el || e.target.closest('.close-btn')) {
                this.hide();
            }
            if (e.target.id === 'btn-ack') {
                this.acknowledge();
            }
        });
    }
}
