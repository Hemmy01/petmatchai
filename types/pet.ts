export type PetCardData = {
  id: string;
  name: string;
  breed: string;
  age_months?: number;
  age?: number;
  gender: string;
  price: number;
  location: string;
  vaccinated?: boolean;
  matchScore?: number;
  seller?: { name?: string; is_verified?: boolean } | null;
  sellerName?: string;
  status?: string;
  species?: string;
  type?: string;
  image_url?: string | null;
  initialSaved?: boolean;
};
