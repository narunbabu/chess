import React, { useEffect, useMemo, useState } from 'react';
import './IntroVideo.css';

const INTRO_STEPS = [
  {
    label: 'Login',
    title: 'Start with your Chess99 account',
    note: 'Use Google sign-in or email/password. Email registrations verify before the first manual login.',
    screen: 'login',
  },
  {
    label: 'Profile',
    title: 'Complete profile setup',
    note: 'Add name, avatar, class, mobile, school or organization, and your area details.',
    screen: 'profile',
  },
  {
    label: 'Play',
    title: 'Choose casual or rated play',
    note: 'Quick match looks for online players near your rating, then falls back to beginner-friendly synthetic players.',
    screen: 'play',
  },
  {
    label: 'Coach',
    title: 'Use CCT, Best, and Companion correctly',
    note: 'CCT counts work in rated games; CCT arrows, Best moves, and Companion help are for casual learning games.',
    screen: 'cct',
  },
  {
    label: 'Learn',
    title: 'Train with puzzles, drills, and lessons',
    note: 'Use Tactical Progression, Training Drills, Interactive Lessons, and Daily Challenges for structured progress.',
    screen: 'learn',
  },
];

const ScreenMock = ({ screen }) => {
  if (screen === 'login') {
    return (
      <div className="intro-mock intro-mock-login">
        <div className="intro-window-bar" />
        <div className="intro-login-panel">
          <button className="intro-google-button">Continue with Google</button>
          <span />
          <span />
          <button>Email login</button>
        </div>
      </div>
    );
  }

  if (screen === 'profile') {
    return (
      <div className="intro-mock intro-mock-profile">
        <div className="intro-avatar-ring" />
        <div className="intro-profile-lines">
          <span />
          <span />
          <span />
          <span />
        </div>
        <button>Save profile</button>
      </div>
    );
  }

  if (screen === 'play') {
    return (
      <div className="intro-mock intro-mock-play">
        <button className="intro-play-button">Play Online</button>
        <div className="intro-mode-grid">
          <span>Casual</span>
          <span>Rated</span>
          <span>800-1000 bots</span>
        </div>
      </div>
    );
  }

  if (screen === 'cct') {
    return (
      <div className="intro-mock intro-mock-cct">
        <div className="intro-board-mini">
          {Array.from({ length: 16 }).map((_, index) => (
            <span key={index} className="intro-board-mini-square" />
          ))}
          <span className="intro-board-piece intro-board-piece--white intro-board-piece--knight" aria-hidden="true">♘</span>
          <span className="intro-board-piece intro-board-piece--white intro-board-piece--queen" aria-hidden="true">♕</span>
          <span className="intro-board-piece intro-board-piece--black intro-board-piece--king" aria-hidden="true">♚</span>
          <span className="intro-board-piece intro-board-piece--black intro-board-piece--rook" aria-hidden="true">♜</span>
          <span className="intro-board-target intro-board-target--capture" aria-hidden="true" />
          <span className="intro-board-target intro-board-target--check" aria-hidden="true" />
          <span className="intro-cct-arrow intro-cct-arrow--check" aria-hidden="true" />
          <span className="intro-cct-arrow intro-cct-arrow--capture" aria-hidden="true" />
          <span className="intro-cct-arrow intro-cct-arrow--threat" aria-hidden="true" />
        </div>
        <div className="intro-cct-panel">
          <strong>CCT</strong>
          <span>Checks</span>
          <span>Captures</span>
          <span>Threats</span>
          <span>Best top 3</span>
          <span>Companion tab</span>
        </div>
      </div>
    );
  }

  return (
    <div className="intro-mock intro-mock-learn">
      <div className="intro-learn-card">Tactical Puzzles</div>
      <div className="intro-learn-card">Training Drills</div>
      <div className="intro-learn-card">Interactive Lessons</div>
      <div className="intro-learn-card">Daily Challenges</div>
    </div>
  );
};

const IntroVideo = ({ onLogin, onPlay, variant = 'section', showCopy = true }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const activeStep = INTRO_STEPS[activeIndex];

  useEffect(() => {
    if (!isPlaying) return undefined;

    const timer = setInterval(() => {
      setActiveIndex(index => (index + 1) % INTRO_STEPS.length);
    }, 2800);

    return () => clearInterval(timer);
  }, [isPlaying]);

  const progressWidth = useMemo(() => {
    return `${((activeIndex + 1) / INTRO_STEPS.length) * 100}%`;
  }, [activeIndex]);

  return (
    <section
      className={`intro-video-section intro-video-section--${variant}`}
      aria-labelledby={showCopy ? 'intro-video-title' : undefined}
      aria-label={showCopy ? undefined : 'Animated Chess99 journey preview'}
    >
      <div className={`intro-video-shell ${showCopy ? '' : 'intro-video-shell--visual-only'}`}>
        {showCopy && (
          <div className="intro-video-copy">
            <p className="intro-video-eyebrow">Animated intro</p>
            <h2 id="intro-video-title">See the Chess99 journey before you start</h2>
            <p>
              A quick guided preview from login and profile setup to casual games,
              rated play, CCT, Best Moves, Companion, Tactical Progression,
              Training Drills, Interactive Lessons, and Daily Challenges.
            </p>

            <div className="intro-video-actions">
              <button type="button" onClick={onLogin}>Log in</button>
              <button type="button" onClick={onPlay}>Play now</button>
            </div>
          </div>
        )}

        <div className="intro-video-player" aria-live="polite">
          <div className="intro-video-topbar">
            <div>
              <span className="intro-dot" />
              <span className="intro-dot" />
              <span className="intro-dot" />
            </div>
            <button type="button" onClick={() => setIsPlaying(value => !value)}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>

          <div className="intro-video-stage">
            <ScreenMock screen={activeStep.screen} />
            <div className="intro-demo-cursor" />
          </div>

          <div className="intro-video-caption">
            <p>{activeStep.label}</p>
            <h3>{activeStep.title}</h3>
            <span>{activeStep.note}</span>
          </div>

          <div className="intro-video-progress" aria-hidden="true">
            <span style={{ width: progressWidth }} />
          </div>

          <div className="intro-video-timeline">
            {INTRO_STEPS.map((step, index) => (
              <button
                key={step.label}
                type="button"
                className={index === activeIndex ? 'active' : ''}
                onClick={() => {
                  setActiveIndex(index);
                  setIsPlaying(false);
                }}
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntroVideo;
