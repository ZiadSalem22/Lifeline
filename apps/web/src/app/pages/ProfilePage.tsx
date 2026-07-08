import { ApiKeysCard } from '../../features/profile/ApiKeysCard';
import { ProfileDetailsCard } from '../../features/profile/ProfileDetailsCard';
import { PageShell } from './PageShell';

/** Profile: details card + MCP API keys card (authenticated users only). */
export default function ProfilePage() {
  return (
    <PageShell heading="Profile">
      <ProfileDetailsCard />
      <ApiKeysCard />
    </PageShell>
  );
}
