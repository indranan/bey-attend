import { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, User, ShieldCheck, Swords, LogOut } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton';
import logoLalapan from '../assets/icon.png';
import { AuthContext } from '../context/AuthContext';

const navLinks = [
  { name: 'HOME', path: '/' },
  { name: 'RANKINGS', path: '/ranking' },
  { name: 'EVENTS', path: '/events' },
  { name: 'BLADERS', path: '/bladers' },
];

export default function PublicNavbar({ onGoogleLogin }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, logout, currentPlayer } = useContext(AuthContext);

  const handlePublicGoogleLogin = async (userData) => {
    await login(userData);
  };

  const handleLogin = onGoogleLogin || handlePublicGoogleLogin;

  const handleLogout = async () => {
    await logout();
    setIsProfileOpen(false);
    navigate('/');
  };

  const getNavClass = (path) =>
    location.pathname === path
      ? 'text-white'
      : 'text-gray-400 hover:text-white transition-colors';

  const displayName = currentPlayer?.nickname || user?.name || '';
  const displayPhoto = currentPlayer?.photoUrl || user?.picture || '';
  const isAdmin = String(currentPlayer?.role || user?.role || '').trim().toLowerCase() === 'admin';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 shadow-2xl">
      <div className="w-full max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-3"
            aria-label="Go to home"
          >
            <img
              src={logoLalapan}
              alt="Lalapan Beyblade"
              className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
            />
            <div className="whitespace-nowrap">
              <h1 className="text-sm font-black text-white uppercase italic tracking-tighter leading-none">LALAPAN Beyblade</h1>
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mt-0.5">Lamongan Regional</p>
            </div>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {navLinks.map((link) => (
            <button
              key={link.name}
              type="button"
              onClick={() => navigate(link.path)}
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 ${getNavClass(link.path)}`}
            >
              {link.name}
            </button>
          ))}
          <div className="w-px h-5 bg-white/10 mx-1" />
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1 pr-3 py-1 hover:bg-white/10 transition-colors"
              >
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt={displayName}
                    className="w-7 h-7 rounded-full object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-gray-400">
                    <User size={14} />
                  </div>
                )}
                <span className="text-[10px] font-black text-white uppercase tracking-widest max-w-[100px] truncate">
                  {displayName || 'Profile'}
                </span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { navigate('/profile'); setIsProfileOpen(false); }}
                    className="w-full text-left px-4 py-3 text-xs font-black text-white hover:bg-white/5 transition-colors"
                  >
                    Profile
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { navigate('/admin'); setIsProfileOpen(false); }}
                      className="w-full text-left px-4 py-3 text-xs font-black text-blue-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <ShieldCheck size={14} />
                      Admin
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { navigate('/arena'); setIsProfileOpen(false); }}
                      className="w-full text-left px-4 py-3 text-xs font-black text-cyan-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <Swords size={14} />
                      Arena
                    </button>
                  )}
                  <div className="border-t border-white/5" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-xs font-black text-red-400 hover:bg-white/5 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <GoogleSignInButton onLogin={handleLogin} className="max-w-[148px]" />
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1 pr-2.5 py-1 hover:bg-white/10 transition-colors max-w-[145px]"
                aria-label="Open profile menu"
              >
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt={displayName || 'Profile'}
                    className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-gray-400 shrink-0">
                    <User size={14} />
                  </div>
                )}

                <span className="text-[9px] font-black text-white uppercase tracking-widest truncate max-w-[78px]">
                  {displayName || 'Profile'}
                </span>

                <ChevronDown
                  size={13}
                  className={`text-gray-400 shrink-0 transition-transform ${isProfileOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/profile');
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-xs font-black text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <User size={14} />
                    Profile
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/admin');
                        setIsProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-black text-blue-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <ShieldCheck size={14} />
                      Admin
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/arena');
                        setIsProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-black text-cyan-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <Swords size={14} />
                      Arena
                    </button>
                  )}

                  <div className="border-t border-white/5" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-xs font-black text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <GoogleSignInButton
              onLogin={handleLogin}
              compact
            />
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-gray-950/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-6 py-4 space-y-3">
            {navLinks.map((link) => (
              <button
                key={link.name}
                type="button"
                onClick={() => { navigate(link.path); setIsMobileMenuOpen(false); }}
                className={`block w-full text-left text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-white/5 ${getNavClass(link.path)}`}
              >
                {link.name}
              </button>
            ))}
            <div className="pt-3 border-t border-white/5">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
                    {displayPhoto ? (
                      <img
                        src={displayPhoto}
                        alt={displayName || 'Profile'}
                        className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-gray-400 shrink-0">
                        <User size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Signed in as</p>
                      <p className="text-xs font-black text-white uppercase tracking-wider truncate">{displayName || 'Profile'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-white/5 text-white"
                  >
                    <User size={14} />
                    Profile
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-2 w-full text-left text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-white/5 text-blue-400"
                    >
                      <ShieldCheck size={14} />
                      Admin
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { navigate('/arena'); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-2 w-full text-left text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-white/5 text-cyan-400"
                    >
                      <Swords size={14} />
                      Arena
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-white/5 text-red-400"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              ) : (
                <GoogleSignInButton onLogin={handleLogin} className="w-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
