import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUDIO_CONSTRAINTS,
  getWarmStream,
  waitForWarmUp,
} from '../lib/mic';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'error';

interface UseRecorderResult {
  state: RecorderState;
  /** 开始录音（自动申请麦克风权限） */
  start: () => Promise<void>;
  /** 停止录音并返回音频 Blob；未在录音时返回 null */
  stop: () => Promise<Blob | null>;
  /** 取消录音（丢弃） */
  cancel: () => void;
  /** 当前已录音时长（ms） */
  elapsedMs: number;
  error?: string;
}

export function useRecorder(startDelayMs = 0): UseRecorderResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string>();
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const cancelRef = useRef(false);
  const ownsStreamRef = useRef(false);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanup = useCallback(() => {
    stopTimer();
    // 只停掉自己获取的流；预热的共享流交给 mic.ts 的引用计数管理
    if (ownsStreamRef.current) {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    ownsStreamRef.current = false;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(undefined);
    cancelRef.current = false;
    setState('starting');
    try {
      await waitForWarmUp();
      let stream = getWarmStream();
      let owns = false;
      if (!stream) {
        // 预热不可用（首次使用/未授权），此时才需要现场打开麦克风
        stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
        });
        owns = true;
      }
      ownsStreamRef.current = owns;
      const mime =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      streamRef.current = stream;
      recorderRef.current = recorder;
      // 源头去 du：等麦克风音频处理管线（降噪/回声消除）稳定再开始录制，
      // 让开头的瞬态杂音落在录音之外，而不是录进去
      if (startDelayMs > 0) {
        await new Promise((r) => setTimeout(r, startDelayMs));
      }
      if (cancelRef.current || recorderRef.current !== recorder) {
        cleanup();
        setState('idle');
        return;
      }
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
      setState('recording');
    } catch (e) {
      setState('error');
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? window.self !== window.top
            ? '麦克风权限被拒绝：请在浏览器设置中允许该扩展使用麦克风，或点面板顶部的「书本」按钮到侧边栏录音'
            : '麦克风权限被拒绝，请在浏览器设置中允许'
          : '无法访问麦克风：' + (e instanceof Error ? e.message : String(e)),
      );
    }
  }, [startDelayMs, cleanup]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return null;
    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          }),
        );
      };
    });
    recorder.stop();
    cleanup();
    setState('idle');
    return done;
  }, [cleanup]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    cleanup();
    setState('idle');
  }, [cleanup]);

  return { state, start, stop, cancel, elapsedMs, error };
}
