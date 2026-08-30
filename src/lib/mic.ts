/**
 * 麦克风预热：进入录音界面时（已授权的情况下）提前打开麦克风采集流并缓存，
 * 这样用户点击「开始跟读」时不再触发设备激活，避免点击瞬间的“du”声。
 * 采用引用计数：最后一个使用方释放后关闭流。
 */

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

let stream: MediaStream | null = null;
let refs = 0;
let warmPromise: Promise<void> | null = null;

/** 组件挂载/显示录音界面时调用：尽量静默预热麦克风 */
export function warmUpMic(): void {
  refs++;
  if (stream || warmPromise) return;
  warmPromise = (async () => {
    try {
      const perm = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      // 只有已授权才预热，避免在打开界面时突然弹出授权框
      if (perm.state !== 'granted') return;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
      });
    } catch {
      /* 预热失败不影响后续点击录音时的正常流程 */
    } finally {
      warmPromise = null;
    }
  })();
}

/** 组件卸载/离开录音界面时调用：最后一个引用释放后关闭预热流 */
export function releaseMic(): void {
  refs = Math.max(0, refs - 1);
  if (refs === 0 && stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

/** 获取已预热的流（可能尚未完成预热） */
export function getWarmStream(): MediaStream | null {
  return stream;
}

/** 等待预热完成（用于点击录音时先等预热再开始） */
export function waitForWarmUp(): Promise<void> {
  return warmPromise ?? Promise.resolve();
}
