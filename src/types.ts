export type Role = "owner" | "admin" | "operator" | "tester" | "public_user" | "banned";
export type Tab = "map" | "add" | "profile" | "admin";
export type AccessibilityStatus = "green" | "yellow" | "red";
export type ModerationStatus = "published" | "pending" | "hidden";

export interface Profile {
  id: string;
  telegramId: number | null;
  username: string | null;
  displayName: string | null;
  role: Role;
  aiEnabled: boolean;
  karma: number;
  karmaStatus: string | null;
  createdAt: string;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  status: AccessibilityStatus;
  stepsCount: number | null;
  stepHeightCm: number | null;
  rampType: "none" | "permanent" | "portable_on_request" | "portable_available";
  doorWidthCm: number | null;
  entranceNotes: string | null;
  toiletExists: "yes" | "no" | "unknown";
  toiletAccessible: "yes" | "no" | "partial" | "unknown";
  parking: "yes" | "no" | "unknown";
  comment: string | null;
  osmTags: Record<string, any>;
  moderationStatus: ModerationStatus;
  source: "operator" | "public" | "import" | "ai_seed";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Included photo information directly on POI view
  mainPhoto?: string;
}

export interface Photo {
  id: string;
  placeId: string;
  storagePath: string;
  kind: "facade" | "steps" | "ramp" | "toilet" | "interior";
  uploadedBy: string | null;
  createdAt: string;
}

export interface AddDraft {
  photoFile: File | null;
  photoUrl: string | null;
  name: string;
  category: string;
  lat: number | null;
  lng: number | null;
  status: AccessibilityStatus | "";
  stepsCount: string;
  stepHeightCm: string;
  rampType: "none" | "permanent" | "portable_on_request" | "portable_available";
  doorWidthCm: string;
  entranceNotes: string;
  toiletExists: "yes" | "no" | "unknown";
  toiletAccessible: "yes" | "no" | "partial" | "unknown";
  comment: string;
}
