import type { CSSProperties } from 'react';
import type { UserStatus } from '../api/types';
import { initials } from '../lib/format';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  square?: boolean;
  status?: UserStatus;
  typing?: boolean;
}

export const Avatar = ({ name, src, size = 40, square = false, status, typing = false }: AvatarProps) => (
  <span className={`avatar${square ? ' avatar-square' : ''}`} style={{ '--size': `${size}px` } as CSSProperties}>
    <span className="avatar-face" aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : initials(name)}
    </span>
    {status && <span className={`lamp lamp-${status}${typing ? ' lamp-blink' : ''}`} aria-hidden="true" />}
  </span>
);
