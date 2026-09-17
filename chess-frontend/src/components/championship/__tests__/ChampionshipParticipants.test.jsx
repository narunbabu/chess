import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChampionshipParticipants from '../ChampionshipParticipants';

// The component only needs the two contexts for loading/error state and the
// "(You)" highlight; the participant rows come in as a prop.
const mockUser = { id: 7 };
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('../../../contexts/ChampionshipContext', () => ({
  useChampionship: () => ({
    fetchParticipants: jest.fn(),
    loading: false,
    error: null,
  }),
}));

const participant = (overrides = {}) => ({
  id: overrides.user_id ?? 1,
  user_id: 1,
  payment_status: 'completed',
  registration_status: 'registered',
  registered_at: '2026-09-01T10:00:00Z',
  dropped: false,
  dropped_at: null,
  dropped_reason: null,
  user: { id: 1, name: 'Player One', rating: 1500, email: 'one@example.com' },
  ...overrides,
});

const droppedPlayer = participant({
  id: 2,
  user_id: 2,
  dropped: true,
  dropped_at: '2026-09-14T09:00:00Z',
  dropped_reason: 'forfeit_limit',
  user: { id: 2, name: 'Dropped Dan', rating: 1400, email: 'dan@example.com' },
});

const renderList = (participants) =>
  render(<ChampionshipParticipants championshipId={1} participants={participants} />);

describe('ChampionshipParticipants — dropped players', () => {
  it('marks a dropped participant as withdrawn with the reason', () => {
    renderList([participant(), droppedPlayer]);

    expect(screen.getByText(/Withdrawn — Too many forfeits/i)).toBeInTheDocument();
    // The player who is still in carries no badge.
    expect(screen.getAllByText(/Withdrawn —/i)).toHaveLength(1);
  });

  it('counts still-in and withdrawn players separately from the total', () => {
    renderList([participant(), droppedPlayer]);

    const stat = (label) => screen.getByRole('group', { name: label });

    expect(stat('Total')).toHaveTextContent('2');
    expect(stat('Still In')).toHaveTextContent('1');
    expect(stat('Withdrawn')).toHaveTextContent('1');
    // A dropped player stays paid, so the payment stats must not move.
    expect(stat('Paid')).toHaveTextContent('2');
  });

  it('filters the list down to still-in or withdrawn players', () => {
    renderList([participant(), droppedPlayer]);

    const filter = screen.getByDisplayValue('All Participants');

    fireEvent.change(filter, { target: { value: 'active' } });
    expect(screen.getByText('Player One')).toBeInTheDocument();
    expect(screen.queryByText('Dropped Dan')).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: 'dropped' } });
    expect(screen.queryByText('Player One')).not.toBeInTheDocument();
    expect(screen.getByText('Dropped Dan')).toBeInTheDocument();
  });

  it('tells the signed-in player when they are the one who was withdrawn', () => {
    const me = participant({
      id: 7,
      user_id: 7,
      dropped: true,
      dropped_at: '2026-09-14T09:00:00Z',
      dropped_reason: 'forfeit_limit',
      user: { id: 7, name: 'Me', rating: 1300, email: 'me@example.com' },
    });

    renderList([participant(), me]);

    expect(
      screen.getByText(/You have been withdrawn from this championship/i)
    ).toBeInTheDocument();
  });

  it('shows no drop notice when the signed-in player is still in', () => {
    const me = participant({
      id: 7,
      user_id: 7,
      user: { id: 7, name: 'Me', rating: 1300, email: 'me@example.com' },
    });

    renderList([participant(), me, droppedPlayer]);

    expect(
      screen.queryByText(/You have been withdrawn from this championship/i)
    ).not.toBeInTheDocument();
  });

  it('treats a payload with only dropped_at as dropped', () => {
    // Older/partial payloads may not carry the appended boolean alias.
    const rawColumnOnly = participant({
      id: 3,
      user_id: 3,
      dropped: undefined,
      dropped_at: '2026-09-14T09:00:00Z',
      user: { id: 3, name: 'Raw Row', rating: 1200, email: 'raw@example.com' },
    });

    renderList([participant(), rawColumnOnly]);

    expect(screen.getByText(/Withdrawn — Removed from the tournament/i)).toBeInTheDocument();
  });
});
