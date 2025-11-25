import Auth from '../components/auth/Auth';

const AuthPage = ({ onBack }) => (
  <section style={{ padding: '32px 0' }}>
    <Auth onBack={onBack} />
  </section>
);

export default AuthPage;
