'use client';

import { useState } from 'react';
import type { Comment } from '@ci/shared';

export interface CardProps {
  comment: Comment;
  avatarSrc: string | null;
  innerRef?: (el: HTMLDivElement | null) => void;
}

function initials(c: Comment): string {
  const base = c.username || c.display_name || '?';
  return base.slice(0, 2).toUpperCase();
}

function Avatar({ src, fallback, size }: { src: string | null; fallback: string; size: number }): JSX.Element {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        style={{ width: size, height: size, fontSize: size * 0.38 }}
        className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white"
      >
        {fallback}
      </div>
    );
  }
  return (
        <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover"
    />
  );
}

const SYS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function InstagramCommentCard({ comment: c, avatarSrc, innerRef }: CardProps): JSX.Element {
  return (
    <div ref={innerRef} style={{ fontFamily: SYS, width: 420 }} className="rounded-xl bg-white p-3 text-left">
      <div className="flex items-start gap-2.5">
        <Avatar src={avatarSrc} fallback={initials(c)} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[18px] text-black">
            <span className="font-semibold">{c.username || c.display_name || 'usuario'}</span>{' '}
            <span className="text-[#262626]">{c.comment_text}</span>
          </p>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-[#8e8e8e]">
            <span>{c.timestamp || ''}</span>
            {(c.likes ?? 0) > 0 && <strong className="font-normal">{c.likes?.toLocaleString('es')} Me gusta</strong>}
            {(c.replies_count ?? 0) > 0 && <span>Ver respuestas ({c.replies_count})</span>}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" className="mt-1 shrink-0">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>
    </div>
  );
}

export function FacebookCommentCard({ comment: c, avatarSrc, innerRef }: CardProps): JSX.Element {
  return (
    <div ref={innerRef} style={{ fontFamily: SYS, width: 420 }} className="bg-white p-2.5 text-left">
      <div className="flex items-start gap-2">
        <Avatar src={avatarSrc} fallback={initials(c)} size={36} />
        <div className="min-w-0 flex-1">
          <div className="inline-block rounded-2xl bg-[#f0f2f5] px-3 py-2">
            <p className="text-[13px] font-semibold leading-[17px] text-[#050505]">{c.display_name || c.username || 'Usuario'}</p>
            <p className="text-[14.5px] leading-[19px] text-[#050505]">{c.comment_text}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 pl-2 text-[12px] font-medium text-[#65676b]">
            <span>{(c.likes ?? 0) > 0 ? `${c.likes?.toLocaleString('es')} Me gusta` : 'Me gusta'}</span>
            <span>Responder</span>
            <span>{c.timestamp || ''}</span>
            {c.is_reply && <span className="italic">respuesta</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TiktokCommentCard({ comment: c, avatarSrc, innerRef }: CardProps): JSX.Element {
  return (
    <div ref={innerRef} style={{ fontFamily: SYS, width: 420 }} className="bg-white p-3 text-left">
      <div className="flex items-start gap-2.5">
        <Avatar src={avatarSrc} fallback={initials(c)} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-[18px] text-[#161823]">
            {c.username ? `@${c.username}` : c.display_name || 'usuario'}
            {c.is_reply && <span className="ml-2 rounded bg-gray-100 px-1.5 text-[11px] font-medium text-gray-500">respuesta</span>}
          </p>
          <p className="mt-0.5 text-[14px] leading-[19px] text-[#161823]">{c.comment_text}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[13px] text-[rgba(22,24,35,0.5)]">{c.timestamp || ''}</span>
            <span className="flex items-center gap-1 text-[13px] text-[rgba(22,24,35,0.5)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              {c.likes?.toLocaleString('es') ?? ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlatformCommentCard(props: CardProps): JSX.Element {
  if (props.comment.platform === 'facebook') return <FacebookCommentCard {...props} />;
  if (props.comment.platform === 'tiktok') return <TiktokCommentCard {...props} />;
  return <InstagramCommentCard {...props} />;
}
