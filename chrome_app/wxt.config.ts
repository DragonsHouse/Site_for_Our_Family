import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Dragon House Family',
    description: 'Приватний Family Hub для Dragon House.',
    version: '0.1.0',
    permissions: ['activeTab', 'tabs', 'storage', 'notifications', 'alarms', 'identity'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'assets/dragon-house/dragon-house-logo.png',
      48: 'assets/dragon-house/dragon-house-logo.png',
      128: 'assets/dragon-house/dragon-house-logo.png'
    },
    action: {
      default_title: 'Dragon House Family',
      default_icon: {
        16: 'assets/dragon-house/dragon-house-logo.png',
        48: 'assets/dragon-house/dragon-house-logo.png'
      }
    },
    options_page: 'options.html',
    web_accessible_resources: [
      {
        resources: ['dashboard.html', 'assets/*', 'chunks/*'],
        matches: ['<all_urls>']
      }
    ]
  }
});
