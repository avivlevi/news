import { useState } from 'react';
import type { SourceId } from '@/types';
import { meta } from '@/lib/sources';

/**
 * Publisher mark, with the brand colour as the fallback so a missing or
 * blocked favicon still reads as that outlet rather than a broken image.
 */
export function OutletLogo({ source, size = 20 }: { source: SourceId; size?: number }) {
  const [failed, setFailed] = useState(false);
  const m = meta(source);
  const style = { width: size, height: size } as const;

  if (failed) {
    return (
      <span
        className="logo logo--fallback"
        style={{ ...style, background: m.color }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      className="logo"
      src={m.logo}
      alt=""
      loading="lazy"
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
