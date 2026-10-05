import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/api';
import Navbar from '../components/layout/Navbar';

export default function VerifyEmail() {
  const { token } = useParams();
  const { user, updateUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const confirm = async () => {
    setBusy(true);
    try {
      const response = await authApi.post('/auth/email/confirm', { token });
      localStorage.setItem('token', response.data.token);
      updateUser(response.data.user);
      setMessage('Your new email address is verified.');
    } catch (error) { setMessage(error.response?.data?.message || 'Email verification failed.'); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-background text-white"><Navbar /><main className="max-w-lg mx-auto px-6 pt-32 space-y-6">
    <h1 className="text-2xl font-bold">Verify your new email</h1>
    {message ? <p role="status">{message}</p> : user ? <button disabled={busy} onClick={confirm} className="bg-discord-600 p-3 rounded disabled:opacity-50">{busy ? 'Verifying...' : 'Confirm email address'}</button> : <p>Sign in using your current email address, then reopen this verification link.</p>}
    <Link to="/profile" className="block text-discord-400">Back to profile</Link>
  </main></div>;
}
