import { useParams } from 'react-router';
import { ReviewView } from '../../features/review/ReviewView';

/**
 * Review — /review (this week), /review/:token where token is a date
 * (weekly, normalized to its Monday) or 'YYYY-MM' (monthly).
 */
export default function ReviewPage() {
  const { weekStart } = useParams();
  return <ReviewView weekToken={weekStart} />;
}
