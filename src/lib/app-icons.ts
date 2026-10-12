/** Apple image CDN thumbnails sized for interface icons, not full store artwork. */
export function iconThumbnail(url: string): string {
  return url.replace(/\/512x512bb\.(jpg|png|webp)(\?.*)?$/, '/128x128bb.$1$2');
}

