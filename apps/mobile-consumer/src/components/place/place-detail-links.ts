import {
  AtSign,
  Bike,
  CalendarCheck,
  Camera,
  Globe,
  MessageCircle,
  Users,
} from 'lucide-react-native';

export const CHANNEL_DEFS = [
  { key: 'website_url' as const, label: 'Website', Icon: Globe },
  { key: 'whatsapp_url' as const, label: 'WhatsApp', Icon: MessageCircle },
  { key: 'instagram_url' as const, label: 'Instagram', Icon: Camera },
  { key: 'facebook_url' as const, label: 'Facebook', Icon: Users },
  { key: 'x_url' as const, label: 'X', Icon: AtSign },
  { key: 'threads_url' as const, label: 'Threads', Icon: AtSign },
  { key: 'reddit_url' as const, label: 'Reddit', Icon: MessageCircle },
];

export const RESERVATION_DEFS = [
  { key: 'opentable_url' as const, label: 'OpenTable', Icon: CalendarCheck },
  { key: 'resy_url' as const, label: 'Resy', Icon: CalendarCheck },
  { key: 'uber_eats_url' as const, label: 'Uber Eats', Icon: Bike },
  { key: 'didi_food_url' as const, label: 'DiDi Food', Icon: Bike },
];

export const CHANNEL_CLAY: Record<string, { bg: string; text: string; border: string }> = {
  phone: { bg: '#ecfdf5', text: '#064e3b', border: '#a7f3d0' },
  website_url: { bg: '#f0f9ff', text: '#0c4a6e', border: '#bae6fd' },
  whatsapp_url: { bg: '#ecfdf5', text: '#064e3b', border: '#a7f3d0' },
  instagram_url: { bg: '#fdf2f8', text: '#831843', border: '#fbcfe8' },
  facebook_url: { bg: '#eff6ff', text: '#1e3a8a', border: '#bfdbfe' },
  x_url: { bg: '#f4f4f5', text: '#18181b', border: '#d4d4d8' },
  threads_url: { bg: '#f4f4f5', text: '#18181b', border: '#d4d4d8' },
  reddit_url: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  opentable_url: { bg: '#fef2f2', text: '#7f1d1d', border: '#fecaca' },
  resy_url: { bg: '#fff1f2', text: '#881337', border: '#fecdd3' },
  uber_eats_url: { bg: '#f0fdf4', text: '#14532d', border: '#bbf7d0' },
  didi_food_url: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  google_maps_url: { bg: '#fffbeb', text: '#78350f', border: '#fde68a' },
};

export const FACET_TINT: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  payment: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', dot: '#10b981' },
  booking: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd', dot: '#0ea5e9' },
  service: { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', dot: '#14b8a6' },
  vibe: { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8', dot: '#ec4899' },
  occasion: { bg: '#fff1f2', text: '#be123c', border: '#fecdd3', dot: '#f43f5e' },
  amenities: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', dot: '#6366f1' },
  dietary: { bg: '#f7fee7', text: '#4d7c0f', border: '#d9f99d', dot: '#84cc16' },
  menu: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  drinks: { bg: '#fdf4ff', text: '#a21caf', border: '#f5d0fe', dot: '#d946ef' },
  entertainment: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', dot: '#8b5cf6' },
  crowd: { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc', dot: '#06b6d4' },
  setting: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  hours: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  dress: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff', dot: '#a855f7' },
  wellness: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  experiences: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
  values: { bg: '#fefce8', text: '#a16207', border: '#fef08a', dot: '#eab308' },
};
