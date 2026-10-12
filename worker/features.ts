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
