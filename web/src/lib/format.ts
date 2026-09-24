import type { Chat, User } from '../api/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const shortDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const daysAgo = (date: Date): number => Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);

export const formatTime = (iso: string): string => timeFormat.format(new Date(iso));

export const formatDay = (iso: string): string => {
  const date = new Date(iso);
  const age = daysAgo(date);
  if (age === 0) {
    return 'Today';
  }
  if (age === 1) {
    return 'Yesterday';
  }
  return dayFormat.format(date);
};

export const formatListTime = (iso: string): string => {
  const date = new Date(iso);
  const age = daysAgo(date);
  if (age === 0) {
    return formatTime(iso);
  }
  if (age === 1) {
    return 'Yesterday';
  }
  return shortDateFormat.format(date);
};

export const isSameDay = (a: string, b: string): boolean => startOfDay(new Date(a)) === startOfDay(new Date(b));

export const lastSeenText = (iso: string): string => {
  const date = new Date(iso);
  const age = daysAgo(date);
  if (age === 0) {
    return `Last seen ${formatTime(iso)}`;
  }
  if (age === 1) {
    return `Last seen yesterday ${formatTime(iso)}`;
  }
  return `Last seen ${shortDateFormat.format(date)}`;
};

export const presenceText = (user: User | undefined): string => {
  if (!user) {
    return '';
  }
  if (user.status === 'online') {
    return 'Online';
  }
  if (user.status === 'away') {
    return 'Away';
  }
  return lastSeenText(user.lastSeen);
};

export const otherMember = (chat: Chat, meId: string, users: Record<string, User>): User | undefined => {
  const member = chat.members.find((candidate) => candidate.id !== meId);
  return member ? (users[member.id] ?? member) : undefined;
};

export const chatTitle = (chat: Chat, meId: string, users: Record<string, User>): string =>
  chat.type === 'group' ? (chat.name ?? 'Group') : (otherMember(chat, meId, users)?.displayName ?? 'Unknown');

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

export const formatBytes = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
