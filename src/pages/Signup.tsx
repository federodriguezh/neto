import { useState, type FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';

export default function Signup() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate('/login', { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDontMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-md rounded-xl bg-slate-800 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-slate-100">{t('auth.accountCreated')}</h1>
          <p className="text-sm text-slate-400">{t('auth.redirectingToLogin')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-100">{t('auth.signUp')}</h1>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-900/30 border border-rose-800 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-400">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-400">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              placeholder={t('auth.passwordPlaceholder')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-400">
              {t('auth.confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              placeholder={t('auth.passwordPlaceholder')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.signUpLoading') : t('auth.signUp')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
