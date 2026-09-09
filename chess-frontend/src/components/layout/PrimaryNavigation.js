import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IoPlay, IoSchool, IoTrophy, IoPerson } from 'react-icons/io5';
import { useGameNavigation } from '../../contexts/GameNavigationContext';

export const primarySection = (path) => {
  if (/^\/(learn|tutorial|training|tactical-trainer|puzzles|ebook|daily-challenge|daily-challenges)(\/|$)/.test(path)) return 'learn';
  if (/^\/(championships|leaderboard)(\/|$)/.test(path)) return 'compete';
  if (/^\/(dashboard|profile|history|game-history|friends|subscription)(\/|$)/.test(path)) return 'you';
  return 'play';
};

const items = [
  { id: 'play', label: 'Play', to: '/lobby', Icon: IoPlay },
  { id: 'learn', label: 'Learn', to: '/learn', Icon: IoSchool },
  { id: 'compete', label: 'Compete', to: '/championships', Icon: IoTrophy },
  { id: 'you', label: 'You', to: '/dashboard', Icon: IoPerson },
];

export default function PrimaryNavigation({ mobile = false, onNavigate }) {
  const { pathname } = useLocation();
  const { handleNavigationAttempt } = useGameNavigation();
  return <nav aria-label={mobile ? 'Mobile main navigation' : 'Main navigation'} className={`c99-nav ${mobile ? 'c99-mobile-nav' : 'c99-desktop-nav'}`}>
    {items.map(({ id, label, to, Icon }) => <Link key={id} to={to} aria-current={primarySection(pathname) === id ? 'page' : undefined}
      onClick={event => { event.preventDefault(); if (onNavigate) onNavigate(to); else handleNavigationAttempt(to); }}>
      <Icon size={22} aria-hidden="true" /><span>{label}</span>
    </Link>)}
  </nav>;
}
