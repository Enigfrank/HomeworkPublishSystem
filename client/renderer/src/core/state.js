/**
 * 状态管理模块
 * 处理应用的全局状态并通知订阅者
 */

class State {
    constructor() {
        this.data = {
            config: {},
            assignments: [],
            currentFilter: 'all',
            selectedAssignment: null,
            unreadCount: 0,
            wsStatus: 'disconnected'
        };
        this.listeners = new Set();
    }

    /**
     * 当前状态树对象深拷贝或引用的直读访问
     * @returns {Object} 当前完整系统状态快照
     */
    get() {
        return this.data;
    }

    /**
     * 接受需要覆盖的局部状态片（Partial State），浅合并后强制触发通知
     * @param {Object} newData 最新差异属性
     */
    set(newData) {
        this.data = { ...this.data, ...newData };
        this.notify();
    }

    /**
     * 注册全局状态监控回调，在注册即刻同步发放一次现有状态
     * @param {Function} listener 数据更新时的触发句柄
     * @returns {Function} 可调用的注销拦截器
     */
    subscribe(listener) {
        this.listeners.add(listener);
        // 立即执行一次以同步初始状态
        listener(this.data);
        return () => this.listeners.delete(listener);
    }

    /**
     * 遍历并激活 Set 列表中的所有回调
     * (由 set 方法自动触发)
     */
    notify() {
        this.listeners.forEach(listener => listener(this.data));
    }
}

export const state = new State();
