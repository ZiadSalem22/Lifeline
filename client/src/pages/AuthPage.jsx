import Auth from '../components/auth/Auth';

const AuthPage = () => (
  <section style={{ padding: '32px 0' }}>
    <Auth onBack={() => window.history.back()} />
  </section>
);

export default AuthPage;
