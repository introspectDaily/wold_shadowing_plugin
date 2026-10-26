import { defineConfig } from 'wxt';
import pkg from './package.json' with { type: 'json' };

const BASE_NAME = '单词跟读';
const DESCRIPTION =
  '展示标准发音、录制并回放你的跟读、标记常用跟读，管理单词与记忆进度';

export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  manifest: ({ mode }) => {
    const isDev = mode === 'development';
    return {
      name: isDev ? `${BASE_NAME} (Dev)` : BASE_NAME,
      description: DESCRIPTION,
      // 版本号唯一来源：package.json（由 GitHub Actions 的 version-bump 流程维护）
      version: pkg.version,
      version_name: isDev ? `${pkg.version}-dev` : pkg.version,
      permissions: ['storage', 'contextMenus', 'sidePanel', 'unlimitedStorage'],
      host_permissions: [
        'https://api.dictionaryapi.dev/*',
        'https://dict.youdao.com/*',
      ],
      icons: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
      action: {
        default_title: '单词跟读',
        default_popup: 'popup.html',
        default_icon: {
          '16': 'icon/16.png',
          '32': 'icon/32.png',
          '48': 'icon/48.png',
        },
      },
      side_panel: {
        default_path: 'sidepanel.html',
      },
      web_accessible_resources: [
        {
          resources: ['inject.html'],
          matches: ['<all_urls>'],
        },
      ],
      minimum_chrome_version: '116',
    };
  },
  vite: () => ({
    optimizeDeps: {
      entries: ['src/entrypoints/popup/index.html'],
    },
  }),
  modules: ['@wxt-dev/module-react'],
});
