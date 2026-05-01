import React from 'react';

const GROUP_ACCENTS = {
  play: '#81b64c',
  learn: '#e8a93e',
};

const PlayModeGuide = ({
  groups,
  variant = 'dark',
  isAuthenticated = false,
  onAction,
  className = '',
}) => {
  const isCompact = variant === 'compact';

  return (
    <section className={`play-mode-guide ${className}`} data-tour="play-mode-guide" aria-labelledby="play-mode-guide-title">
      <div className={isCompact ? 'max-w-6xl mx-auto' : 'max-w-5xl mx-auto'}>
        <div className={isCompact ? 'mb-5' : 'text-center mb-8'}>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#81b64c] mb-2">
            New to Chess99?
          </p>
          <h2
            id="play-mode-guide-title"
            className={isCompact ? 'text-2xl font-bold text-white mb-2' : 'text-2xl sm:text-3xl font-bold text-white mb-3'}
          >
            Start playing or start improving
          </h2>
          <p className={isCompact ? 'text-[#bababa] text-sm max-w-3xl' : 'text-[#bababa] text-base max-w-2xl mx-auto'}>
            A quick map of the main ways to play, learn, and use CCT inside Chess99.
          </p>
        </div>

        <div className={isCompact ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
          {groups.map(group => {
            const accent = GROUP_ACCENTS[group.id] || '#81b64c';

            return (
              <div key={group.id} className="p-1">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: accent }}>
                    {group.eyebrow}
                  </p>
                  <h3 className="text-xl font-bold text-white mb-1">{group.title}</h3>
                  <p className="text-sm text-[#9b9895] leading-relaxed">{group.description}</p>
                </div>

                <div className={isCompact ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onAction?.(item)}
                      className="text-left rounded-lg border border-[#3d3a37] bg-[#312e2b] p-4 transition-all hover:border-[#81b64c]/60 hover:bg-[#3a3734] focus:outline-none focus:ring-2 focus:ring-[#81b64c]/70"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-white font-semibold text-base leading-tight">{item.title}</h4>
                        {item.requiresAuth && !isAuthenticated && (
                          <span className="shrink-0 text-[11px] font-semibold text-[#e8a93e] border border-[#e8a93e]/40 rounded px-2 py-0.5">
                            Login
                          </span>
                        )}
                      </div>
                      <p className="text-[#bababa] text-sm leading-relaxed mb-3">{item.description}</p>
                      <span className="text-sm font-semibold" style={{ color: accent }}>
                        {item.requiresAuth && !isAuthenticated ? 'Log in to try' : item.cta}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlayModeGuide;
