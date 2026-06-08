import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-100">{t('auth.signIn')}</h1>

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

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.signInLoading') : t('auth.signIn')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" className="text-emerald-400 hover:text-emerald-300">
            {t('auth.createAccount')}
          </Link>
        </p>
      </div>
    </div>
  );
}
