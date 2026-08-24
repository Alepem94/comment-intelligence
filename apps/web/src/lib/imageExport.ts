import type { Comment } from '@ci/shared';

export async function renderNodeToDataUrl(node: HTMLElement, format: 'png' | 'jpeg'): Promise<string> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(node, {
    scale: 3,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false
  });
  return canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
}

export async function exportCommentImage(
  node: HTMLElement,
  comment: Comment,
  format: 'png' | 'jpg'
): Promise<void> {
  const dataUrl = await renderNodeToDataUrl(node, format === 'png' ? 'png' : 'jpeg');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `comentario-${comment.platform}-${(comment.username || comment.display_name || 'usuario').replace(/[^\w.-]+/g, '_')}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyNodeImageToClipboard(node: HTMLElement): Promise<boolean> {
  try {
    const dataUrl = await renderNodeToDataUrl(node, 'png');
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
