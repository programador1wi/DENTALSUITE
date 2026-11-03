export type ReleaseCategory = "NEW" | "IMPROVEMENT" | "FIX" | "ANNOUNCEMENT";

export interface ReleaseAuthor {
  name: string;
  role?: string;
  avatarUrl?: string;
}

export interface ReleaseItem {
  id: string;
  version: string;
  title: string;
  summary: string;
  content: string[];
  category: ReleaseCategory;
  tags: string[];
  publishedAt: string; // Formato ISO o YYYY-MM-DD
  author?: ReleaseAuthor;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface NovedadesState {
  isOpen: boolean;
  releases: ReleaseItem[];
  readIds: string[];
  openDrawer: () => void;
  closeDrawer: () => void;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  getUnreadCount: () => number;
  isRead: (id: string) => boolean;
}
