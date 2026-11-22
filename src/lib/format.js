const nf = new Intl.NumberFormat('ru-RU');
export const formatNumber = (n) => nf.format(n);
export const money = (n) => (n === 0 ? 'Free' : `${nf.format(n)} ₸`);

const parseSqlDate = (sqlDate) => new Date(sqlDate.replace(' ', 'T') + 'Z');

export function timeAgo(sqlDate) {
  const d = parseSqlDate(sqlDate);
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? 'yesterday' : `${day} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const memberSince = (sqlDate) =>
  parseSqlDate(sqlDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export function prettyPhone(p) {
  const d = (p || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('7')) return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  return p;
}

export function whatsappLink(phone, title) {
  let d = (phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  const text = `Hi! Is "${title}" still available? (from SduSell)`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

// Resize photos in the browser so uploads stay small.
export async function readImage(file) {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Use PNG, JPEG or WebP photos.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
