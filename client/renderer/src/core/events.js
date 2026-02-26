/**
 * 事件总线模块
 * 用于跨组件的解耦通信
 */

class EventBus {
    constructor() {
        this.bus = document.createElement('div');
    }

    /**
     * 注册持久化的自定义事件监听器
     * @param {string} event 事件名称
     * @param {Function} callback 触发时的回调（接收解包后的 detail 数据）
     */
    on(event, callback) {
        this.bus.addEventListener(event, (e) => callback(e.detail));
    }

    /**
     * 注册一次性的自定义事件监听器
     * @param {string} event 事件名称
     * @param {Function} callback 触发时的回调
     */
    once(event, callback) {
        this.bus.addEventListener(event, (e) => callback(e.detail), { once: true });
    }

    /**
     * 广播/抛出自定义事件
     * @param {string} event 事件名称
     * @param {any} detail 附加到事件对象上的有效载荷数据
     */
    emit(event, detail) {
        this.bus.dispatchEvent(new CustomEvent(event, { detail }));
    }

    /**
     * 取消注册先前添加的事件监听器
     * @param {string} event 事件名称
     * @param {Function} callback 对应需要移除的回调引用
     */
    off(event, callback) {
        this.bus.removeEventListener(event, callback);
    }
}

export const events = new EventBus();

// 定义标准事件名常量
export const APP_EVENTS = {
    NAVIGATE: 'app:navigate',
    NOTIFICATION: 'app:notification',
    WS_STATUS_CHANGE: 'app:ws-status',
    ASSIGNMENTS_UPDATED: 'app:assignments-updated'
};
