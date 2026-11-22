// Category colours and decorative artwork (never listing photographs).
// Moved over unchanged from the old public/app.js.
export const CAT_STYLE = {
  'Electronics': { emoji: '📱', bg: '#E4ECFF', fg: '#2B4F9B' },
  'Transport': { emoji: '🚗', bg: '#E8EDF9', fg: '#334D7B' },
  'Fashion': { emoji: '👕', bg: '#F7E6EE', fg: '#A33A6B' },
  'Home & Garden': { emoji: '🛋️', bg: '#E8EFF4', fg: '#46647E' },
  'Kids': { emoji: '🧸', bg: '#FFF1CC', fg: '#8F6400' },
  'Sports & Hobbies': { emoji: '🚴', bg: '#E9E6F7', fg: '#5B47A8' },
  'Books & Study': { emoji: '📚', bg: '#E6ECFA', fg: '#37578C' },
  'Services': { emoji: '🛠️', bg: '#FDE9DD', fg: '#B2531F' },
  'Other': { emoji: '📦', bg: '#E8EDF0', fg: '#4A636F' },
};
export const catStyle = (c) => CAT_STYLE[c] || CAT_STYLE.Other;

// Decorative illustrations are category artwork, never listing photographs.
export const PRODUCT_ART = {
  Electronics: `<ellipse cx="120" cy="151" rx="86" ry="9" fill="currentColor" opacity=".08"/><rect x="53" y="33" width="134" height="94" rx="10" fill="#fff" stroke="currentColor" stroke-width="4"/><rect x="62" y="42" width="116" height="76" rx="4" fill="currentColor" opacity=".09"/><path d="M32 130h176l-17 16H49z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M98 131h44l-4 5h-36z" fill="currentColor" opacity=".3"/><path d="m102 68-15 13 15 13m36-26 15 13-15 13m-12-30-12 34" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  Audio: `<ellipse cx="120" cy="153" rx="66" ry="8" fill="currentColor" opacity=".08"/><path d="M65 101V79a55 55 0 0 1 110 0v22" fill="none" stroke="currentColor" stroke-width="15"/><path d="M66 101V79a54 54 0 0 1 108 0" fill="none" stroke="#fff" stroke-width="5" opacity=".55"/><rect x="51" y="87" width="34" height="57" rx="15" fill="#fff" stroke="currentColor" stroke-width="4"/><rect x="155" y="87" width="34" height="57" rx="15" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="M76 97v36m88-36v36" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".4"/>`,
  'Books & Study': `<ellipse cx="120" cy="151" rx="80" ry="8" fill="currentColor" opacity=".08"/><path d="m47 120 105-22 40 22-105 25z" fill="currentColor" opacity=".2"/><path d="M48 119v14l39 20 105-25v-14" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m47 119 105-25 40 20-105 25z" fill="currentColor" opacity=".6"/><path d="M53 89v15l42 19 91-23V85" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m53 89 92-23 41 19-91 23z" fill="currentColor" opacity=".25"/><path d="M65 61v14l42 19 78-20V60" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m65 61 78-20 42 19-78 20z" fill="currentColor" opacity=".8"/><path d="m115 56 27-7 15 7-27 7" fill="#fff" opacity=".8"/>`,
  Fashion: `<ellipse cx="120" cy="155" rx="69" ry="7" fill="currentColor" opacity=".08"/><path d="m88 34-33 22-18 46 28 13 14-27v59h82V88l14 27 28-13-18-46-33-22-18 13h-28z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M97 36q23 37 46 0M107 57v28m26-28v28m-35 24h44v20H98z" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M82 141h76" stroke="currentColor" stroke-width="8" opacity=".15"/>`,
  Transport: `<ellipse cx="120" cy="146" rx="89" ry="8" fill="currentColor" opacity=".08"/><path d="m40 102 16-13 21-37h81l27 38 18 12v27H37v-22z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M85 60h28v29H68zm39 0h28l20 29h-48z" fill="currentColor" opacity=".2"/><circle cx="72" cy="129" r="16" fill="#fff" stroke="currentColor" stroke-width="5"/><circle cx="169" cy="129" r="16" fill="#fff" stroke="currentColor" stroke-width="5"/><path d="M42 106h17m126 0h13m-85-7h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  'Home & Garden': `<ellipse cx="120" cy="153" rx="73" ry="8" fill="currentColor" opacity=".08"/><rect x="68" y="33" width="104" height="82" rx="25" fill="#fff" stroke="currentColor" stroke-width="4"/><rect x="57" y="85" width="126" height="50" rx="13" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="M73 136v17m94-17v17m-81-46h68" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="75" y="42" width="90" height="36" rx="17" fill="currentColor" opacity=".1"/>`,
  'Sports & Hobbies': `<circle cx="63" cy="119" r="32" fill="#fff" stroke="currentColor" stroke-width="4"/><circle cx="181" cy="119" r="32" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="m63 119 35-58 24 58H63l75-47h27l16 47M91 56h23m45 16-9-22h-17" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="122" cy="119" r="8" fill="currentColor"/>`,
  Kids: `<ellipse cx="120" cy="153" rx="75" ry="8" fill="currentColor" opacity=".08"/><rect x="49" y="96" width="68" height="50" rx="8" fill="#fff" stroke="currentColor" stroke-width="4"/><rect x="123" y="96" width="68" height="50" rx="8" fill="currentColor" opacity=".22" stroke="currentColor" stroke-width="4"/><rect x="85" y="39" width="68" height="50" rx="8" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="m104 73 15-21 15 21m-26-6h22" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="82" cy="121" r="12" fill="currentColor" opacity=".25"/><path d="m144 131 13-20 13 20z" fill="currentColor" opacity=".6"/>`,
  Services: `<ellipse cx="120" cy="154" rx="66" ry="8" fill="currentColor" opacity=".08"/><path d="M151 32a35 35 0 0 0-40 45l-55 55a13 13 0 0 0 18 18l55-55a35 35 0 0 0 45-40l-22 21-21-21z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="67" cy="139" r="4" fill="currentColor"/>`,
  Other: `<path d="m50 65 70-31 70 31v73l-70 27-70-27z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="m50 65 70 30 70-30m-70 30v70M85 49l70 30v29l-16 6V85" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="m65 121 31 12" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".3"/>`,
};
export const CATEGORY_ICON = {
  Electronics: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20M9 16v4m6-4v4"/>',
  Transport: '<path d="m4 9 3-5h10l3 5M3 9h18v9H3z"/><path d="M6 18v2m12-2v2M6 13h2m8 0h2"/>',
  Fashion: '<path d="m8 3-6 4 3 6 3-2v10h8V11l3 2 3-6-6-4c0 4-8 4-8 0Z"/>',
  'Home & Garden': '<path d="M5 11V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M3 11h18v8H3zm3 8v2m12-2v2M6 11v4m12-4v4"/>',
  Kids: '<path d="M3 12h9v9H3zM12 12h9v9h-9zM8 3h9v9H8z"/>',
  'Sports & Hobbies': '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="m6 16 4-10 4 10H6l10-7h2m-4-5h3l1 5m-10-3h4"/>',
  'Books & Study': '<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15"/>',
  Services: '<path d="M20 3a6 6 0 0 0-8 8l-8 8a2 2 0 0 0 3 3l8-8a6 6 0 0 0 8-8l-4 4-4-4z"/>',
  Other: '<path d="m3 6 9-4 9 4v12l-9 4-9-4zm0 0 9 4 9-4m-9 4v12M8 4l9 4"/>',
};
