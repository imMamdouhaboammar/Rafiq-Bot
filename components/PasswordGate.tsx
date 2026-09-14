import React, { useState } from 'react';

const STORAGE_KEY = 'rafiq_app_unlocked';

interface PasswordGateProps {
  children: React.ReactNode;
}

const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError('الباسورد غلط');
        return;
      }

      localStorage.setItem(STORAGE_KEY, 'true');
      setIsUnlocked(true);
      setPassword('');
    } catch {
      setError('مش قادر أتأكد من الباسورد دلوقتي');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUnlocked) return <>{children}</>;

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-[#111b21] p-5 font-sans">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl"
        dir="rtl"
      >
        <h1 className="text-xl font-bold text-[#111b21] mb-2">دخول رفيق</h1>
        <p className="text-sm text-gray-500 mb-5">اكتب الباسورد مرة واحدة عشان تستخدم التطبيق.</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          className="w-full rounded-md border border-gray-300 px-4 py-3 text-right outline-none focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20"
          placeholder="الباسورد"
        />
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
        <button
          type="submit"
          disabled={isSubmitting || !password.trim()}
          className="mt-5 w-full rounded-md bg-[#008069] px-4 py-3 font-bold text-white transition-colors hover:bg-[#006c58] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'جاري التحقق...' : 'دخول'}
        </button>
      </form>
    </div>
  );
};

export default PasswordGate;
