import React from 'react';
import { avatarColor } from '../lib/utils';

export default function Avatar({ name = '?', avatarUrl = null, size = 'md', online = false }) {
  const letter = (name ?? '?').charAt(0).toUpperCase();
  const grad   = avatarColor(name ?? '?');

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div className="relative flex-shrink-0">
      {avatarUrl
        ? <img
            src={avatarUrl}
            alt={name}
            className={`${sizes[size]} rounded-full object-cover`}
          />
        : <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${grad}
                           flex items-center justify-center font-semibold text-white`}>
            {letter}
          </div>
      }
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5
                         bg-green-400 border-2 border-white rounded-full" />
      )}
    </div>
  );
}
