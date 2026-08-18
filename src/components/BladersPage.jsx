import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
} from 'lucide-react';
import PublicNavbar from './PublicNavbar';
import { getFromGas } from '../utils/api';
import toast from 'react-hot-toast';

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 20,
  },

  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.4,
      ease: 'easeOut',
    },
  }),
};

const getRoleBadge = (role) => {
  const r = String(role || '').toLowerCase();

  if (r === 'admin') {
    return {
      label: 'ADMIN',
      color:
        'bg-red-500/20 text-red-400 border-red-500/30',
    };
  }

  return {
    label: 'BLADER',
    color:
      'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
};

const getMovementBadge = (status) => {
  const s = String(status || '')
    .toLowerCase()
    .trim();

  if (s === 'up') {
    return {
      label: '↑ UP',
      color: 'text-green-400',
    };
  }

  if (s === 'down') {
    return {
      label: '↓ DOWN',
      color: 'text-red-400',
    };
  }

  if (s === 'stay') {
    return {
      label: '→ STAY',
      color: 'text-gray-400',
    };
  }

  if (s === 'new') {
    return {
      label: '★ NEW',
      color: 'text-yellow-400',
    };
  }

  return null;
};

export default function BladersPage() {
  const [bladers, setBladers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const fetchBladers = async () => {
      setLoading(true);

      try {
        const res = await getFromGas(
          'getBladers',
          false,
          {},
          {
            maxRetries: 1,
          }
        );

        // Component sudah unmount
        if (cancelled) {
          return;
        }

        if (Array.isArray(res?.bladers)) {
          setBladers(res.bladers);
        } else {
          throw new Error(
            'Respons getBladers tidak valid.'
          );
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          'Gagal fetch bladers:',
          err
        );

        setBladers([]);

        toast.error(
          'Gagal memuat data blader. Silakan coba lagi.'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBladers();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBladers = useMemo(() => {
    let list = bladers;

    if (roleFilter !== 'ALL') {
      list = list.filter(
        (b) =>
          String(b.role || '').toUpperCase() ===
          roleFilter
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();

      list = list.filter((b) =>
        String(b.nickname || '')
          .toLowerCase()
          .includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      if (
        a.rank === null &&
        b.rank === null
      ) {
        return 0;
      }

      if (a.rank === null) {
        return 1;
      }

      if (b.rank === null) {
        return -1;
      }

      return a.rank - b.rank;
    });

    return list;
  }, [
    bladers,
    search,
    roleFilter,
  ]);

  const getRankLabel = (rank) => {
    if (
      rank === null ||
      rank === undefined
    ) {
      return 'UNRANKED';
    }

    return 'RANK #' + rank;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        {/* HEADER */}
        <motion.div
          initial={{
            opacity: 0,
            y: -20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-2">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              BLADERS
            </span>
          </h1>

          <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
            Public Blader Directory
          </p>
        </motion.div>

        {/* FILTER */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.1,
          }}
          className="mb-8 space-y-4"
        >
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              size={18}
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search Blader"
              className="w-full bg-gray-900/80 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-blue-400 transition-all"
            />
          </div>

          <div className="flex items-center justify-center gap-2">
            {[
              'ALL',
              'ADMINS',
              'BLADERS',
            ].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() =>
                  setRoleFilter(role)
                }
                className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  roleFilter === role
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-gray-900/80 text-gray-400 border border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </motion.div>

        {/* LOADING */}
        {loading ? (
          <div className="text-center py-20">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
              Memuat blader...
            </p>
          </div>
        ) : filteredBladers.length === 0 ? (
          <div className="text-center py-20">
            <Users
              className="text-gray-700 mx-auto mb-4"
              size={48}
            />

            <p className="text-sm font-black text-gray-600 uppercase tracking-widest">
              {search ||
              roleFilter !== 'ALL'
                ? 'No bladers found.'
                : 'No blader data available.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBladers.map((blader) => {
              const roleBadge =
                getRoleBadge(blader.role);

              const movementBadge =
                getMovementBadge(
                  blader.leaderboardStatus
                );

              return (
                <motion.div
                  key={blader.googleId}
                  custom={0}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-5 md:p-6 flex flex-col items-center text-center hover:border-white/10 transition-all"
                >
                  {/* PHOTO */}
                  <div className="mb-4">
                    {blader.foto ? (
                      <img
                        src={blader.foto}
                        alt={blader.nickname}
                        className="w-20 h-20 rounded-full object-cover border-2 border-white/10"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-white/10 flex items-center justify-center text-gray-400">
                        <Users size={32} />
                      </div>
                    )}
                  </div>

                  {/* ROLE */}
                  <div className="mb-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${roleBadge.color}`}
                    >
                      {roleBadge.label}
                    </span>
                  </div>

                  {/* NAME */}
                  <p className="text-base font-black text-white truncate mb-1">
                    {blader.nickname ||
                      'Unknown Blader'}
                  </p>

                  {/* RANK */}
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
                    {getRankLabel(
                      blader.rank
                    )}
                  </p>

                  {/* POINT */}
                  <p className="text-sm font-black text-gray-300 mb-4">
                    {blader.point} PTS
                  </p>

                  {/* BUTTON */}
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={() => {
                        const profileId =
                          blader.publicProfileId ||
                          blader.public_profile_id;

                        if (!profileId) {
                          toast.error(
                            'Profile belum tersedia untuk blader ini.'
                          );
                          return;
                        }

                        const targetPath =
                          `/bladers/${profileId}`;

                        console.log(
                          '[BLADER PROFILE LINK]',
                          {
                            nickname:
                              blader.nickname,
                            publicProfileId:
                              profileId,
                            targetPath,
                          }
                        );

                        navigate(
                          targetPath
                        );
                      }}
                      className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 rounded-2xl font-black uppercase italic text-sm shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 transition-all active:scale-95 w-full"
                    >
                      View Profile
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}