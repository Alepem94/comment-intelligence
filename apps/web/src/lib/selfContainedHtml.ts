import type { Comment } from '@ci/shared';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok'
};

export function buildSelfContainedHtml(comments: Comment[], title?: string): string {
  const rows = comments
    .map(
      (c) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:56px;">
          ${c.profile_image_url ? `<img src="${esc(c.profile_image_url)}" width="48" height="48" alt="" style="border-radius:24px;display:block;" />` : ''}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          <div style="font:600 13px/1.4 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
            @${esc(c.username || c.display_name || 'usuario')}${c.display_name && c.username ? ` &middot; ${esc(c.display_name)}` : ''}
          </div>
          <div style="font:400 14px/1.55 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;margin-top:2px;">${esc(c.comment_text)}</div>
          <div style="font:400 12px/1.4 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#6b7280;margin-top:4px;">
            &#10084;&#65039; ${c.likes ?? 0} &nbsp;&middot;&nbsp; ${esc(c.timestamp || '')} &nbsp;&middot;&nbsp; ${PLATFORM_LABEL[c.platform] || esc(c.platform)}${c.is_reply ? ' &middot; respuesta' : ''}
          </div>
        </td>
      </tr>`
    )
    .join('\n');

  return `<div style="max-width:640px;margin:0 auto;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;border-collapse:separate;overflow:hidden;background:#ffffff;">
    <tr><td style="padding:14px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font:700 15px/1.3 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
      ${esc(title || 'Comentarios')}&nbsp;
      <span style="font:400 12px/1.3 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#6b7280;">(${comments.length})</span>
    </td></tr>
    ${rows}
  </table>
</div>`;
}

export function buildSingleCommentHtml(c: Comment): string {
  return buildSelfContainedHtml([c], `@${c.username || c.display_name || 'usuario'}`);
}

export async function copyHtmlToClipboard(html: string, plainFallback: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainFallback], { type: 'text/plain' })
        })
      ]);
      return true;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(html);
    return true;
  } catch {
    return false;
  }
}
