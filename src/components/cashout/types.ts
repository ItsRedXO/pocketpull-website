export interface CashOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  userEmail: string;
}

export interface InventoryItem {
  id: string;
  userId: string;
  cardId: string;
  cardName: string;
  rarity: string;
  value: number;
  emoji?: string;
  cardImageUrl?: string;
  packName?: string;
  isFavorite?: boolean;
}

export interface ShippingForm {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
}
