import type { ChatMediaUpload, MarketplaceCategory, MarketplaceCondition, MarketplaceInstallmentFrequency, MarketplaceListing, MarketplaceShopType } from "@/lib/api";

export const CATEGORIES: Array<{ value: MarketplaceCategory | ''; label: string }> = [
  { value: '', label: 'All listings' },
  { value: 'PHONES_TABLETS', label: 'Phones & tablets' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'FASHION', label: 'Fashion' },
  { value: 'VEHICLES', label: 'Vehicles' },
  { value: 'HOME_GARDEN', label: 'Home & garden' },
  { value: 'PROPERTY', label: 'Property' },
  { value: 'BEAUTY', label: 'Beauty' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'OTHER', label: 'Other' },
];

export const CONDITIONS: Array<{ value: MarketplaceCondition; label: string }> = [
  { value: 'NEW', label: 'Brand new' },
  { value: 'LIKE_NEW', label: 'Like new' },
  { value: 'USED', label: 'Used' },
  { value: 'REFURBISHED', label: 'Refurbished' },
];

export const categoryLabel = (value: MarketplaceCategory) =>
  CATEGORIES.find((category) => category.value === value)?.label ?? 'Other';
export const conditionLabel = (value: MarketplaceCondition) =>
  CONDITIONS.find((condition) => condition.value === value)?.label ?? value;
export const money = (value: string | number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value));
export const relativeDate = (value: string) => {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};

export const SHOP_TYPES: Array<{ value: MarketplaceShopType; label: string; description: string }> = [
  { value: 'PLAZA', label: 'Plaza', description: 'A plaza offering a range of goods.' },
  { value: 'STORE', label: 'Store', description: 'Your own shop and product collection.' },
  { value: 'SUPERMARKET', label: 'Supermarket', description: 'Groceries, essentials, and everyday goods.' },
];
export const shopTypeLabel = (type: MarketplaceShopType) => SHOP_TYPES.find((item) => item.value === type)?.label ?? type;
// Pay small small orders are handed over only once fully paid, so delivery is not "pay on delivery".
export const fulfillmentLabel = (value: string, plan = 'FULL') =>
  plan === 'INSTALLMENT' ? (value === 'PAY_ON_DELIVERY' ? 'Delivery when fully paid' : 'Pickup when fully paid')
    : value === 'PAY_ON_DELIVERY' ? 'Pay on delivery' : 'Pickup';
export const messageHref = (username: string) => `/app/messages?with=${encodeURIComponent(username)}`;

export const PAY_SMALL_SMALL = 'Pay small small';
export const frequencyLabel = (value: MarketplaceInstallmentFrequency, count = 1) =>
  value === 'WEEKLY' ? (count === 1 ? 'week' : 'weeks') : (count === 1 ? 'month' : 'months');

// Mirrors the API schedule in kobo: the deposit is the larger of an equal share
// and the seller's minimum, the rest splits equally, and the last payment takes the remainder.
export function installmentPreview(total: number, count: number, depositPercent: number) {
  const totalKobo = Math.round(total * 100);
  const deposit = Math.max(Math.ceil(totalKobo / count), Math.ceil((totalKobo * depositPercent) / 100));
  const each = Math.floor((totalKobo - deposit) / (count - 1));
  const last = totalKobo - deposit - each * (count - 2);
  return { deposit: deposit / 100, each: each / 100, last: last / 100 };
}

// The listing's lead photo, attached to a chat as-is: it is already public on the
// Marketplace, so it needs no second upload or moderation pass.
export function listingChatMedia(listing: MarketplaceListing): ChatMediaUpload | undefined {
  const url = listing.imageUrls[0];
  if (!url) return undefined;
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase();
  const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  return { url, type: 'image', mimeType, name: listing.title, moderationStatus: 'approved' };
}
