export interface CashoutCard {
  card_name: string;
  rarity?: string;
  value: number;
  card_image_url?: string;
}

export interface CashoutRequest {
  id: string;
  userId: string;
  username: string;
  confirmationNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'partial' | 'completed' | 'cancelled' | 'returned';
  totalValue: number | string;
  totalCards: number | string;
  cardsJson: string;
  fulfilledCardIds?: string;
  trackingNumber?: string;
  shippingName?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
  notes?: string;
  idImageUrl?: string;
  createdAt: string;
  processedAt?: string;
  updatedAt?: string;
}

export interface IndividualCard {
  card_name: string;
  rarity?: string;
  value: number;
  card_image_url?: string;
}

export interface GroupedCard {
  card_name: string;
  quantity: number;
  value: number;
  rarity?: string;
}

export type SortKey = 'value-desc' | 'value-asc' | 'name-asc' | 'name-desc';
