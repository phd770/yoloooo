export type MissionStatus = 'sent' | 'locked' | 'opened' | 'completed' | 'rejected' | 'saved_for_later' | 'pending';

export interface CustomButton {
  id: string;
  label: string;
  actionText: string;
  maleActionText?: string;
  femaleActionText?: string;
  fullText?: string;
  maleFullText?: string;
  femaleFullText?: string;
  pointsValue: number;
  isMandatory?: boolean;
  tier?: number;
  icon?: any;
  isViewOnce?: boolean;
}

export interface User {
  id: string;
  name: string;
  gender: 'male' | 'female';
  pin?: string;
  points?: number;
  buttons?: CustomButton[];
  stealthMode?: boolean;
  highestTierReached?: number;
  lastSeen?: number;
  isOnline?: boolean;
}

export interface Mission {
  id: string;
  sender: string;
  receiver: string;
  title: string;
  shortText: string;
  maleShortText?: string;
  femaleShortText?: string;
  fullText?: string;
  maleFullText?: string;
  femaleFullText?: string;
  status: MissionStatus;
  createdAt: number;
  unlockAt?: number;
  snoozeUntil?: number;
  pointsValue?: number;
  isSpecialRequest?: boolean;
  specialRequestLevel?: number;
  isMandatory?: boolean;
  mandatoryPenalty?: number;
  mandatoryTimeLimit?: number; // in hours
  response?: string;
  tier?: number;
  imageUrl?: string;
  isViewOnce?: boolean;
  isViewed?: boolean;
  isMystery?: boolean;
  isMysteryRevealed?: boolean;
  teaseTimer?: number;
  completedAt?: number;
}

export interface Session {
  id: string;
  mode: 'together' | 'remote';
  chemistryScore: number;
  streak: number;
  heatMeter: number;
  lastComboDate?: number;
  dailyChallenge?: {
    id: string;
    description: string;
    target: number;
    progress: number;
    completed: boolean;
    date: string;
  };
  updatedAt: number;
}

export type PrivacyMode = 'normal' | 'discreet' | 'super_discreet';

export interface ChatSession {
  id: string;
  participants: string[];
  privacyMode: PrivacyMode;
  autoExpireTimer?: number; // in milliseconds
  lastMessageAt: number;
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: number;
  deletedAtByUser?: { [userId: string]: number };
  typingUsers?: { [userId: string]: number };
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  receiverId: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  audioUrl?: string;
  location?: { lat: number; lng: number; address?: string };
  reactions?: Record<string, string>;
  createdAt: number;
  expiresAt?: number; // For auto-expire
  isViewOnce?: boolean;
  viewDuration?: number;
  viewedAt?: number;
  isDeleted?: boolean; // Soft delete
  deletedBy?: string;
  deletedAt?: number;
  replyToId?: string;
  replyToText?: string;
  isPing?: boolean;
  editedAt?: number;
}
