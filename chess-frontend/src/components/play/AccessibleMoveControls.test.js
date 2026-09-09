import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Chess } from 'chess.js';
import AccessibleMoveControls from './AccessibleMoveControls';

test('confirms a legal move through the shared move handler', async () => {
  const onMove = jest.fn(() => true);
  render(<AccessibleMoveControls fen={new Chess().fen()} onMove={onMove} />);
  const option = screen.getByRole('option', { name: 'pawn e2 to e4 (e4)' });
  fireEvent.change(screen.getByLabelText('Legal move'), { target: { value: option.value } });
  fireEvent.click(screen.getByRole('button', { name: 'Make move' }));
  await waitFor(() => expect(onMove).toHaveBeenCalledWith('e2', 'e4', 'q'));
  expect(screen.getByRole('status').textContent).toContain('Played pawn e2 to e4');
});

test('includes underpromotion, not only queen promotion', async () => {
  const onMove = jest.fn(() => true);
  render(<AccessibleMoveControls fen="7k/P7/8/8/8/8/8/7K w - - 0 1" onMove={onMove} />);
  const option = screen.getByRole('option', { name: /promote to knight/ });
  fireEvent.change(screen.getByLabelText('Legal move'), { target: { value: option.value } });
  fireEvent.click(screen.getByRole('button', { name: 'Make move' }));
  await waitFor(() => expect(onMove).toHaveBeenCalledWith('a7', 'a8', 'n'));
});

test('rejects stale selections after the position changes and disables unavailable turns', () => {
  const game = new Chess();
  const onMove = jest.fn();
  const { rerender } = render(<AccessibleMoveControls fen={game.fen()} onMove={onMove} />);
  fireEvent.change(screen.getByLabelText('Legal move'), { target: { value: screen.getByRole('option', { name: 'pawn e2 to e4 (e4)' }).value } });
  game.move('e4');
  rerender(<AccessibleMoveControls fen={game.fen()} onMove={onMove} disabled />);
  expect(screen.getByRole('button', { name: 'Make move' }).disabled).toBe(true);
  expect(screen.getByLabelText('Legal move').disabled).toBe(true);
  fireEvent.submit(screen.getByRole('form', { name: 'Accessible move entry' }));
  expect(onMove).not.toHaveBeenCalled();
});

test('reports rejected moves instead of announcing success', async () => {
  render(<AccessibleMoveControls fen={new Chess().fen()} onMove={() => false} />);
  fireEvent.change(screen.getByLabelText('Legal move'), { target: { value: screen.getByRole('option', { name: 'pawn e2 to e4 (e4)' }).value } });
  fireEvent.click(screen.getByRole('button', { name: 'Make move' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Move not accepted'));
});
