export type LeadStatus = "new" | "saved" | "sent" | "contacted" | "ignored";

export type LeadSource = "google_places" | "google_maps_scrape" | "openstreetmap";
export type CompanySize = "pequena" | "media" | "grande";

export type Lead = {
  id: string;
  source: LeadSource;
  sourceId: string;
  name: string;
  category: string;
  niche: string;
  address: string;
  city: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  email?: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
  status: LeadStatus;
  score: number;
  companySize: CompanySize;
  diagnosis: string;
  nextAction: string;
  tags: string[];
  raw?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SearchResponse = {
  leads: Lead[];
  source: LeadSource;
  message: string;
  coverageNote: string;
};
