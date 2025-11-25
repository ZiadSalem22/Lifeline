import CosmicBackground from '../components/background/CosmicBackground';
import { Sidebar, TopBar } from '../components/layout';

const DashboardPage = ({ sidebarProps, topBarProps, children, showBackground = false }) => (
  <div style={{ display: 'flex', minHeight: '100vh', background: 'transparent', position: 'relative', overflow: 'hidden' }}>
    {showBackground && <CosmicBackground />}
    <Sidebar {...sidebarProps} />
    <TopBar {...topBarProps} />
    <main className="main-content" style={{ paddingTop: '120px' }}>
      {children}
    </main>
  </div>
);

export default DashboardPage;
