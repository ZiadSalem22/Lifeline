import type { DayName } from '@lifeline/shared';

/**
 * Country → default week start (old OnboardingPage rule): United States,
 * Canada, and Mexico start on Sunday; everywhere else defaults to Monday.
 */
export function startDayForCountry(country: string): DayName {
  const value = country.trim().toLowerCase();
  if (
    value.includes('united states') ||
    value === 'us' ||
    value === 'usa' ||
    value.includes('america') ||
    value.includes('canada') ||
    value.includes('mexico')
  ) {
    return 'Sunday';
  }
  return 'Monday';
}
