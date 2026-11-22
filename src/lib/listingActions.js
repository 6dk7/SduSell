import { api } from './api.js';

// Shared by the listing page and "My listings".
export async function toggleSold(listing, { toast }) {
  try {
    const next = listing.status === 'sold' ? 'active' : 'sold';
    await api(`/listings/${listing.id}/status`, { method: 'PATCH', body: { status: next } });
    toast(next === 'sold' ? 'Marked as sold' : 'Listing is available again');
    return true;
  } catch (ex) { toast(ex.message); return false; }
}

export async function deleteListing(listing, { toast, confirmAction }) {
  const ok = await confirmAction({
    title: 'Delete this listing?',
    text: `“${listing.title}” and its photos will be removed. This cannot be undone.`,
    confirmLabel: 'Delete listing',
  });
  if (!ok) return false;
  try {
    await api(`/listings/${listing.id}`, { method: 'DELETE' });
    toast('Listing deleted');
    return true;
  } catch (ex) { toast(ex.message); return false; }
}
