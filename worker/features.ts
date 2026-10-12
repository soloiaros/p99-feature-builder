import type { Feature } from '../src/shared/types';

export interface FeatureDefinition extends Feature {
  keywords: string[];
  goal: string;
  entities: string[];
  flow: string[];
  rules: string[];
  edgeCases: string[];
  acceptance: string[];
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    id: 'streaks', name: 'Daily streaks', description: 'A forgiving daily loop that makes consistency visible.',
    keywords: ['streak', 'habit', 'daily', 'consistency', 'routine', 'language', 'learn'],
    goal: 'Help a person repeat one meaningful action without turning a missed day into punishment.',
    entities: ['ActivityCompletion: id, userId, activityId, occurredAtUTC, localDate, timeZone, idempotencyKey', 'StreakState: userId, currentCount, longestCount, lastCompletedLocalDate, updatedAt', 'StreakPolicy: timeZone, qualifyingActivityType, dailyThreshold; version policies explicitly'],
    flow: ['Home shows today’s qualifying action and the current run.', 'Person finishes a qualifying action; persist it once before showing a celebration.', 'Completion state shows the updated count, a seven-day history, and the next action.', 'On a missed day, show a neutral restart action and preserve their longest run.'],
    rules: ['Use the user’s IANA time zone and local calendar dates; never divide UTC milliseconds by 24 hours to count days.', 'Multiple completions on one local date count once; a duplicate network retry must not increment again.', 'Keep a completion ledger as the source of truth and derive streak state from consecutive dates.', 'Permit a user to opt out of streak emphasis without deleting their activity history.'],
    edgeCases: ['Daylight saving transitions and travel across time zones; explain which local day receives a completion.', 'Offline completion synced after midnight; preserve captured time while bounding client clock skew.', 'Deletion or correction of a completion recalculates the derived count.', 'First use, no qualifying activity, a year-long run, and a missed day all have clear states.'],
    acceptance: ['Given two completions on one date, the count increases once.', 'Given consecutive local dates spanning a DST transition, the streak remains consecutive.', 'Given a missed date, currentCount restarts at one on the next completion while longestCount is retained.', 'The same idempotency key cannot produce two completion records.'],
  },
  {
    id: 'widgets', name: 'Home screen widgets', description: 'Keep the next useful action one glance away.',
    keywords: ['widget', 'home screen', 'lock screen', 'glance', 'quick action'],
    goal: 'Let people understand their current state and reach a useful action without opening a full app session.',
    entities: ['WidgetSnapshot: schemaVersion, userId, primaryValue, subtitle, nextActionRoute, generatedAt, expiresAt', 'WidgetPreference: widgetInstanceId, configuration, privacyMode', 'WidgetAction: idempotencyKey, actionType, targetId, requestedAt, outcome'],
    flow: ['Person adds a small or medium widget and chooses what it displays.', 'The widget reads a compact cached snapshot and shows when it was updated.', 'Tap opens a deep link to the relevant item; supported quick actions apply safely.', 'The app updates the shared snapshot after changes and requests a timeline refresh.'],
    rules: ['On iOS use a WidgetKit extension and a shared App Group container; never require the main process to remain alive.', 'Respect platform refresh budgets; derive a useful timeline instead of polling frequently.', 'Treat cached widget data as stale unless timestamps and user identity match.', 'On Web provide a compact installable home view; do not promise an unsupported native widget.'],
    edgeCases: ['Signed out user, revoked account, empty dataset and stale snapshot.', 'Deep link target was deleted or belongs to another account.', 'Offline action retries, app upgrades and old snapshot schema versions.', 'Lock screen privacy hides sensitive values by default.'],
    acceptance: ['Widget renders meaningful cached content with no network.', 'Every tap opens the correct screen or a safe empty state.', 'Account switch removes snapshots from the previous user.', 'Small and medium layouts fit large text and display a stale indicator after expiry.'],
  },
  {
    id: 'onboarding', name: 'Personalized onboarding', description: 'Turn a few useful answers into a better first session.',
    keywords: ['onboarding', 'quiz', 'assessment', 'beginner', 'welcome', 'goal', 'personalized plan'],
    goal: 'Collect only the answers that change the first useful experience, then deliver value immediately.',
    entities: ['OnboardingSession: id, userId?, version, currentStep, answers, startedAt, completedAt?', 'OnboardingQuestion: id, version, type, allowedAnswers, required, branchingRule', 'InitialPlan: userId, preferencesVersion, recommendedItems, explanation'],
    flow: ['Welcome explains the outcome and approximate effort.', 'Ask at most three essential questions, one per screen, with progress and back navigation.', 'Show an editable preview of the resulting setup and why it was chosen.', 'Confirm, persist the session once, and open the first useful action.'],
    rules: ['Every question must map to an actual rule in the resulting experience; remove questions without consequences.', 'Allow skipping optional questions and resume a partially completed session.', 'Use explicit bounded options; validate free text separately and do not infer sensitive traits.', 'Persist answers on each step; completion and plan creation form one idempotent operation.'],
    edgeCases: ['App killed between steps, browser refresh, returning user and account switch.', 'No recommendation fits the answers; offer a neutral editable starting point.', 'Backtracking changes a branch; clear answers that no longer apply.', 'Screen reader reading order, keyboard navigation and text expansion.'],
    acceptance: ['A skipped optional step never blocks reaching the first useful action.', 'Restarting the app resumes the saved step and answers.', 'Changing an answer updates the preview deterministically.', 'Submitting twice creates exactly one initial plan.'],
  },
  {
    id: 'reminders', name: 'Thoughtful reminders', description: 'Timely, controllable nudges tied to real intent.',
    keywords: ['remind', 'notification', 'alert', 'schedule', 'nudge', 'habit', 'routine'],
    goal: 'Help people act at a time they choose while protecting their attention.',
    entities: ['Reminder: id, userId, targetId, scheduleType, localTime, timeZone, weekdays, enabled', 'ReminderDelivery: reminderId, scheduledForUTC, status, deliveredAt?, dedupeKey', 'NotificationPreference: userId, permissionState, quietHours, channel'],
    flow: ['After a person creates a goal, offer a reminder with an explicit benefit.', 'Let them choose days and local time before asking for system permission.', 'A notification deep links to the relevant action with snooze or complete when supported.', 'Settings provide pause, reschedule, and disable controls.'],
    rules: ['Request permission after an intentional action, never on initial page load.', 'Resolve recurring local schedules with an IANA time zone and adapt to DST.', 'Cancel a pending notification when its target is completed or deleted.', 'Deduplicate sends and honor quiet hours and current permission state.'],
    edgeCases: ['Permission denied or later revoked; present settings help without nagging.', 'Travel, clock changes, DST missing/repeated hours.', 'Device offline, duplicate delivery and stale deep link.', 'Account logout cancels personally scoped local notifications.'],
    acceptance: ['Declining permission leaves the core feature usable.', 'Completing the target cancels its pending reminder.', 'A single scheduled occurrence produces at most one delivery.', 'Editing a reminder cancels the old schedule and installs the new one.'],
  },
  {
    id: 'progress', name: 'Progress tracking', description: 'Make small wins and the next milestone legible.',
    keywords: ['progress', 'track', 'goal', 'milestone', 'learn', 'workout', 'course'],
    goal: 'Show how far the person has moved toward an explicit goal and what action moves them forward.',
    entities: ['Goal: id, userId, metric, targetValue, startDate, dueDate?, archivedAt?', 'ProgressEvent: id, goalId, value, unit, occurredAt, source, idempotencyKey', 'ProgressSummary: goalId, total, percentage, latestEventAt, aggregationVersion'],
    flow: ['Person chooses a concrete target and a unit they understand.', 'The home view shows current value, target, period and next useful action.', 'Each completed action updates the total with a short explanation.', 'History reveals individual events and supports correcting mistakes.'],
    rules: ['Keep raw events immutable where possible and aggregate server-side or from a single deterministic function.', 'Distinguish zero from unavailable data; do not render a zero-filled chart for failed loads.', 'Label units and date boundaries; never mix incompatible metrics.', 'Percentages cap visually at 100 while raw overachievement remains available.'],
    edgeCases: ['Target of zero, target edited mid-period, negative corrections and overachievement.', 'Duplicate or late events; multiple devices editing concurrently.', 'Empty state, sparse history and dates with genuinely no events.', 'Archived goal with historical data remains readable.'],
    acceptance: ['Displayed totals equal the sum of valid events for the chosen interval.', 'Deleting or correcting an event updates all derived summaries.', 'Loading, empty, error and success states are visually distinct.', 'Charts have a text summary with the same values.'],
  },
