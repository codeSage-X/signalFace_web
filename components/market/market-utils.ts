import type { MarketplaceCategory, MarketplaceCondition, MarketplaceShopType } from "@/lib/api";

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
export const fulfillmentLabel = (value: string) => value === 'PAY_ON_DELIVERY' ? 'Pay on delivery' : 'Pickup';
export const messageHref = (username: string) => `/app/messages?with=${encodeURIComponent(username)}`;
