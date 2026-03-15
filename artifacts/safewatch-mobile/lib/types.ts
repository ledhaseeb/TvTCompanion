export interface AppUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  role: string;
  parentAccountId: string | null;
  isFoundingMember?: number;
}

export interface Child {
  id: string;
  userId: string;
  name: string;
  birthMonth: number;
  birthYear: number;
  entertainmentMinutes: number;
  ageRestrictionOverride: number | null;
  favouritesAgeBypass: number;
  eveningProtectionEnabled: number;
  eveningProtectionStartHour: number;
  eveningProtectionMaxStim: number;
  sensitivity: string | null;
}

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  channelId: string | null;
  youtubeChannelId: string | null;
  youtubeChannelTitle: string | null;
  seriesId: string | null;
  seriesName: string | null;
  durationSeconds: number;
  stimulationLevel: number;
  ageMin: number | null;
  ageMax: number | null;
  thumbnailUrl: string | null;
  customThumbnailUrl: string | null;
  isPublished: number;
  isEmbeddable: number;
}

export interface Session {
  id: string;
  userId: string;
  childIds: string[];
  startTime: string;
  endTime: string | null;
  totalMinutesWatched: number;
  status: string;
  taperMode: string;
  flatlineLevel: number;
  includeWindDown: number;
  finishMode: string;
}

export type TaperMode =
  | "taper_down"
  | "taper_up"
  | "taper_up_down"
  | "flatline";
export type BehaviorRating = "great" | "okay" | "upset" | "tantrum";

export interface PlaylistResponse {
  playlist: Video[];
  calmingVideos: Video[];
  replacementCandidates?: Record<number, Video[]>;
}

export const TAPER_MODES: {
  value: TaperMode;
  label: string;
  description: string;
  icon: "trending-down" | "trending-up" | "activity" | "minus";
}[] = [
  {
    value: "taper_down",
    label: "Calm Down",
    description: "Starts exciting, gradually calms",
    icon: "trending-down",
  },
  {
    value: "taper_up",
    label: "Build Up",
    description: "Starts calm, gradually energizes",
    icon: "trending-up",
  },
  {
    value: "taper_up_down",
    label: "Peak & Calm",
    description: "Builds up then calms down",
    icon: "activity",
  },
  {
    value: "flatline",
    label: "Steady",
    description: "Consistent energy throughout",
    icon: "minus",
  },
];

export const BEHAVIOR_OPTIONS: {
  value: BehaviorRating;
  label: string;
  color: string;
  icon: string;
}[] = [
  { value: "great", label: "Great", color: "#22c55e", icon: "smile" },
  { value: "okay", label: "Okay", color: "#3b82f6", icon: "meh" },
  { value: "upset", label: "Upset", color: "#f59e0b", icon: "frown" },
  { value: "tantrum", label: "Tantrum", color: "#ef4444", icon: "alert-circle" },
];
