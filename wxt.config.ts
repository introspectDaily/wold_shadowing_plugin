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
      // onnxruntime-web 需要 WebAssembly 编译权限；MV3 默认 CSP 不允许，
      // 不开这个开关在扩展里跑布局模型会直接抛 EvalError。
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      },
    };
  },
  vite: () => ({
    optimizeDeps: {
      entries: ['src/entrypoints/popup/index.html'],
    },
    resolve: {
      // 让 onnxruntime-web 用「外部 wasm」版本：否则它会把 14MB 的 wasm
      // 内联进产物，和 public/ort/ 下的副本重复，白白多一倍体积。
      conditions: ['onnxruntime-web-use-extern-wasm', 'browser', 'module', 'import', 'default'],
    },
  }),
  modules: ['@wxt-dev/module-react'],
});
