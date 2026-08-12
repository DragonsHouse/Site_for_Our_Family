import { defineConfig } from 'wxt';
import { DRAGON_HOUSE_HUB_PRODUCT_NAME, DRAGON_HOUSE_HUB_SHORT_NAME } from './lib/extension-branding';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    build: {
      modulePreload: false
    }
  }),
  manifest: {
    name: DRAGON_HOUSE_HUB_PRODUCT_NAME,
    short_name: DRAGON_HOUSE_HUB_SHORT_NAME,
    description: 'Приватний Family Hub для Dragon House.',
    version: '0.1.0',
    permissions: ['activeTab', 'tabs', 'storage', 'notifications', 'alarms', 'identity'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
      256: 'icon/256.png',
      512: 'icon/512.png'
    },
    action: {
      default_title: DRAGON_HOUSE_HUB_PRODUCT_NAME,
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png'
      }
    },
    options_page: 'options.html'
  }
});
