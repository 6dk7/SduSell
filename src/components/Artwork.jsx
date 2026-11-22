import { CATEGORY_ICON, PRODUCT_ART, catStyle } from '../lib/categories.js';

// The SVG markup comes from constants in lib/categories.js, never from user input.
export function Artwork({ type, className = 'product-art' }) {
  const isIcon = className === 'category-icon';
  const inner = isIcon ? CATEGORY_ICON[type] || CATEGORY_ICON.Other : PRODUCT_ART[type] || PRODUCT_ART.Other;
  return (
    <svg className={className} viewBox={isIcon ? '0 0 24 24' : '0 0 240 180'}
      fill={isIcon ? 'none' : 'currentColor'} stroke={isIcon ? 'currentColor' : 'none'}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: inner }} />
  );
}

export function Placeholder({ category }) {
  const s = catStyle(category);
  return (
    <div className="ph" style={{ '--ph-bg': s.bg, '--ph-fg': s.fg }}>
      <Artwork type={category} />
      <span className="ph-label">No photo</span>
    </div>
  );
}

export function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 4.8 6.6 4.8c1.9 0 3.5 1 4.4 2.6.2.3.8.3 1 0 .9-1.6 2.5-2.6 4.4-2.6 3.2 0 5.1 3.2 3.9 6.5-1.8 4.6-9.3 9.2-9.3 9.2z" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
