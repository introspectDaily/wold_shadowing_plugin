import { Icon } from './Icon';
import { useSettings } from '../lib/settings';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, setSetting } = useSettings();
  if (!open) return null;
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <span className="settings-title">设置</span>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="关闭"
          >
            <Icon name="close" size={14} />
          </button>
        </header>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">消除跟读录音开头的“du”杂音</div>
            <div className="setting-desc">
              开启后：新录音在源头就不录入开头的瞬态杂音（du），已保存的旧录音播放时也会自动跳过。
              关闭后：完全按麦克风原始声音录制和播放。
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.noDuEnabled}
              onChange={(e) =>
                void setSetting('noDuEnabled', e.target.checked)
              }
            />
            <span className="slider" />
          </label>
        </div>
      </div>
    </div>
  );
}
