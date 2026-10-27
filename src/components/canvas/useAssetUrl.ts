import { useEffect, useState } from 'react';
import { getAsset } from '../../lib/canvas/db';

/**
 * 把 IndexedDB 里的图片转成可渲染的 object URL。
 * 用 Blob 而不是 dataURL：后面 PDF 裁切块一张就可能几 MB，
 * dataURL 会让节点状态和数据库记录成倍膨胀。
 */
export function useAssetUrl(assetId: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void getAsset(assetId).then((asset) => {
      if (!asset) return;
      objectUrl = URL.createObjectURL(asset.blob);
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  return url;
}
