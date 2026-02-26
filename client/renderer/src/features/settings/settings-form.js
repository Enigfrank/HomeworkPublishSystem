import { state } from '../../core/state.js';
import { api } from '../../core/api.js';
import { events, APP_EVENTS } from '../../core/events.js';

export class SettingsFeature {
  constructor() {
    this.el = document.getElementById('page-settings');
    this.init();
  }

  /**
   * 初始化设置中心表单实例
   * 将其内部状态与最顶层的 State 对象完成响应式绑定
   */
  init() {
    this.render();
    this.bindEvents();

    state.subscribe(({ config }) => {
      this.fillForm(config);
    });
  }

  /**
   * 构建并在内存中填充有关服务器地址和设备表示名称相关的 DOM 结构
   */
  render() {
    this.el.innerHTML = `
      <div class="feature-header">
        <h2 class="feature-title">客户端设置</h2>
      </div>
      <div class="settings-container glass-effect">
        <form id="settings-form">
          <div class="form-section">
            <h3 class="section-title">连接配置</h3>
            <div class="form-group">
              <label>服务器地址</label>
              <input type="text" name="serverURL" placeholder="http://localhost:3000" />
              <p class="hint">例如: http://192.168.1.100:3000</p>
            </div>
          </div>
          
          <div class="form-section">
            <h3 class="section-title">客户端信息</h3>
            <div class="form-group">
              <label>设备显示名称</label>
              <input type="text" name="clientName" placeholder="例如：我的电脑" />
            </div>
            <div class="form-group">
              <label>唯一标识符 (ID)</label>
              <div class="id-wrapper">
                <input type="text" name="clientId" readonly />
                <span class="lock-icon">🔒</span>
              </div>
              <p class="hint">首次注册后由系统自动生成</p>
            </div>
          </div>

          <div id="settings-msg" class="form-message" style="display: none;"></div>

          <div class="form-actions">
            <button type="button" id="btn-test" class="btn btn-secondary">测试连接</button>
            <button type="submit" class="btn btn-primary">保存并应用</button>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * 将从主进程或状态树获取下来的存量配置数据挂载推送到对应的 input 表单标签中
   * @param {Object} config 配置存储片段
   */
  fillForm(config) {
    const form = this.el.querySelector('#settings-form');
    if (!form || !config) return;

    form.serverURL.value = config.serverURL || '';
    form.clientName.value = config.clientName || '';
    form.clientId.value = config.clientId || '';
  }

  /**
   * 为表单中各项元素附加事件，例如包含 HTTP 测试握手以及提交时的格式验证及 IPC 通知
   */
  bindEvents() {
    const form = this.el.querySelector('#settings-form');

    // 保存设置
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const serverURL = form.serverURL.value.trim();
      const clientName = form.clientName.value.trim();

      if (!serverURL) return this.showMessage('请输入服务器地址', 'error');
      if (!clientName) return this.showMessage('请输入设备显示名称', 'error');

      try {
        const { config } = state.get();
        // 1. 注册/更新后端记录
        const regResult = await api.registerClient({
          client_id: config.clientId,
          name: clientName
        });

        // 2. 保存到本地配置
        const newConfig = {
          serverURL,
          wsURL: serverURL.replace('http', 'ws'),
          clientName,
          clientId: regResult.client_id
        };

        await api.saveConfig(newConfig);
        state.set({ config: newConfig });

        this.showMessage('配置已成功保存并同步', 'success');
        events.emit(APP_EVENTS.ASSIGNMENTS_UPDATED);
      } catch (err) {
        this.showMessage('保存失败: ' + (err.message || '未知错误'), 'error');
      }
    });

    // 测试连接
    this.el.querySelector('#btn-test').addEventListener('click', async () => {
      const url = form.serverURL.value.trim();
      if (!url) return this.showMessage('请先输入服务器地址', 'error');

      try {
        await api.testConnection(url);
        this.showMessage('连接成功！服务器响应正常', 'success');
      } catch (err) {
        this.showMessage('无法连接到该地址，请检查网络或 URL', 'error');
      }
    });
  }

  /**
   * 在操作栏下方动态呈现带有自动消隐能力的文字反馈提示
   * @param {string} msg 呈现文字内容
   * @param {string} type 视觉主题 ('error' | 'success')
   */
  showMessage(msg, type) {
    const el = this.el.querySelector('#settings-msg');
    el.textContent = msg;
    el.className = `form-message ${type}`;
    el.style.display = 'block';
    setTimeout(() => {
      el.style.display = 'none';
    }, 4000);
  }
}
