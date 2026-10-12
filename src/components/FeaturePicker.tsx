import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent, FocusEvent, KeyboardEvent, PointerEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { Feature } from '../shared/types';
import './FeaturePicker.css';

export interface FeaturePickerProps {
  value: Feature[];
  onChange: (features: Feature[]) => void;
  disabled?: boolean;
}

const MAX_FEATURES = 7;
const FEATURE_MIME = 'application/x-p99-feature';
const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const suggestion = (id: string, name: string, description: string): Feature => ({ id, name, description });
const SUGGESTIONS: Feature[] = [
  suggestion('streaks', 'Daily streaks', 'Encourage consistency with a visible daily streak.'),
  suggestion('widgets', 'Home screen widgets', 'Show useful app information and actions on the home screen.'),
  suggestion('progress', 'Progress tracking', 'Make progress toward a goal easy to understand.'),
  suggestion('reminders', 'Smart reminders', 'Let people choose useful, timely reminders.'),
  suggestion('focus', 'Focus timer', 'Help people start and complete a focused session.'),
  suggestion('insights', 'Personal insights', 'Turn activity into useful trends and insights.'),
  suggestion('offline', 'Offline mode', 'Keep important actions available without a connection.'),
  suggestion('sync', 'Cloud sync', 'Keep user data consistent across devices.'),
  suggestion('onboarding', 'Guided onboarding', 'Guide new users toward their first useful result.'),
  suggestion('logging', 'Quick logging', 'Make it easy to record an activity or entry.'),
  suggestion('personalization', 'Personalization', 'Adapt the experience to user preferences.'),
  suggestion('social', 'Social circles', 'Help people share activity with a chosen group.'),
  suggestion('gamification', 'Rewards & badges', 'Recognize meaningful milestones with rewards.'),
  suggestion('subscriptions', 'Subscriptions', 'Offer clear subscription plans and account controls.'),
  suggestion('custom-ai-assistant', 'AI assistant', 'Help users complete tasks with an AI assistant.'),
  suggestion('custom-dark-mode', 'Dark mode', 'Offer a comfortable dark appearance.'),
  suggestion('search', 'Powerful search', 'Help people find the right content quickly.'),
  suggestion('custom-mood-tracking', 'Mood tracking', 'Record moods and reflect on changes over time.'),
  suggestion('custom-calendar-view', 'Calendar view', 'Organize activities in a useful calendar view.'),
  suggestion('custom-barcode-scanning', 'Barcode scanning', 'Find an item by scanning its barcode.'),
  suggestion('custom-voice-notes', 'Voice notes', 'Capture and revisit short voice recordings.'),
  suggestion('custom-photo-journal', 'Photo journal', 'Keep a journal of photos and reflections.'),
  suggestion('custom-shared-lists', 'Shared lists', 'Collaborate on a list with other people.'),
  suggestion('custom-map-discovery', 'Map discovery', 'Explore relevant places on an interactive map.'),
];
const ROWS = [SUGGESTIONS.slice(0, 8), SUGGESTIONS.slice(8, 16), SUGGESTIONS.slice(16)];
