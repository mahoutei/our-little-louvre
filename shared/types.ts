export type Role = 'OWNER' | 'PARTNER';
export type Origin = 'ORIGINAL' | 'WING';

export type ExhibitBase = {
  id: string;
  slug: string;
  origin: Origin;
  title: string;
  caption: string;
  alt: string;
  dateLabel?: string;
  thumbnailUrl: string;
  imageUrl: string;
  width?: number;
  height?: number;
  published: boolean;
  authorName?: string;
};

export type Exhibit = ExhibitBase & {
  anchor: string;
};

export type WingExhibit = ExhibitBase & {
  alleyIndex: number;
  slotIndex: number;
};

export type Manifest = {
  exhibits: Exhibit[];
  finale: { exhibitId: string; letterParagraphs: string[] };
};

export type WingAlley = {
  index: number;
  exhibits: WingExhibit[];
};

export type Wing = {
  capacity: number;
  alleys: WingAlley[];
  total: number;
};

export type MemberView = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type Collection = {
  museum: { name: string };
  member: MemberView;
  manifest: Manifest;
  wing: Wing;
};

export type ExhibitFields = {
  title: string;
  caption: string;
  alt: string;
  dateLabel?: string;
};

export type NewExhibitInput = ExhibitFields & {
  imagePath: string;
  thumbPath: string;
  width?: number;
  height?: number;
};

export type ExhibitPatch = Partial<ExhibitFields> & {
  published?: boolean;
};

export type WingSlot = {
  alleyIndex: number;
  slotIndex: number;
  newAlley: boolean;
  remainingInAlley: number;
};

export type LetterView = {
  title: string;
  paragraphs: string[];
  updatedAt: string;
};

export type StudioData = {
  collection: Collection;
  letter: LetterView;
  stats: {
    originals: number;
    wing: number;
    published: number;
    alleys: number;
    capacity: number;
  };
};

export type ApiErrorBody = { error: string; fields?: Record<string, string> };
