import { useParams } from 'react-router';
import { ReviewView } from '../../features/review/ReviewView';

/** Weekly Review — served at /review (this week) and /review/:weekStart. */
export default function ReviewPage() {
  const { weekStart } = useParams();
  return <ReviewView weekToken={weekStart} />;
}
