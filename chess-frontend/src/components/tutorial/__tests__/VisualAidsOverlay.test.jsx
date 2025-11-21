import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VisualAidsOverlay from '../VisualAidsOverlay';

describe('VisualAidsOverlay', () => {
  const mockArrows = [
    { start: 'e2', end: 'e4', color: 'green' },
    { start: 'g1', end: 'f3', color: 'blue' },
  ];

  const mockHighlights = ['e4', 'd4', 'f3'];

  const mockGhostPieces = [
    { square: 'e4', piece: 'wP', opacity: 0.5 }
  ];

  const defaultProps = {
    boardSize: 400,
    arrows: mockArrows,
    highlights: mockHighlights,
    ghostPieces: mockGhostPieces
  };

  it('renders arrows correctly', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const arrows = screen.getAllByTestId(/arrow-/);
    expect(arrows).toHaveLength(2);

    // Check first arrow
    expect(arrows[0]).toHaveAttribute('x1');
    expect(arrows[0]).toHaveAttribute('y1');
    expect(arrows[0]).toHaveAttribute('x2');
    expect(arrows[0]).toHaveAttribute('y2');
    expect(arrows[0]).toHaveAttribute('stroke', 'green');
  });

  it('renders highlights correctly', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const highlights = screen.getAllByTestId(/highlight-/);
    expect(highlights).toHaveLength(3);

    // Check first highlight
    expect(highlights[0]).toHaveAttribute('fill', 'rgba(74, 222, 128, 0.4)');
  });

  it('renders ghost pieces correctly', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const ghostPieces = screen.getAllByTestId(/ghost-piece-/);
    expect(ghostPieces).toHaveLength(1);

    const ghostPiece = ghostPieces[0];
    expect(ghostPiece).toHaveAttribute('opacity', '0.5');
    expect(ghostPiece).toHaveAttribute('data-piece', 'wP');
    expect(ghostPiece).toHaveAttribute('data-square', 'e4');
  });

  it('calculates correct coordinates for arrows', () => {
    render(<VisualAidsOverlay {...defaultProps} boardSize={400} />);

    const firstArrow = screen.getByTestId('arrow-0');

    // For board size 400, each square is 50x50 pixels
    // e2: file 'e' = 4, rank '2' = 6, so x = (4 + 0.5) * 50 = 225, y = (8 - 2 + 0.5) * 50 = 325
    // e4: file 'e' = 4, rank '4' = 4, so x = (4 + 0.5) * 50 = 225, y = (8 - 4 + 0.5) * 50 = 225

    expect(firstArrow).toHaveAttribute('x1', '225');
    expect(firstArrow).toHaveAttribute('y1', '325');
    expect(firstArrow).toHaveAttribute('x2', '225');
    expect(firstArrow).toHaveAttribute('y2', '225');
  });

  it('calculates correct positions for highlights', () => {
    render(<VisualAidsOverlay {...defaultProps} boardSize={400} />);

    const e4Highlight = screen.getByTestId('highlight-e4');

    // e4: x = 225, y = 225, size = 50
    expect(e4Highlight).toHaveAttribute('x', '200');
    expect(e4Highlight).toHaveAttribute('y', '200');
    expect(e4Highlight).toHaveAttribute('width', '50');
    expect(e4Highlight).toHaveAttribute('height', '50');
  });

  it('adjusts coordinates based on board size', () => {
    render(<VisualAidsOverlay {...defaultProps} boardSize={800} />);

    const firstArrow = screen.getByTestId('arrow-0');

    // For board size 800, each square is 100x100 pixels
    // e2: x = (4 + 0.5) * 100 = 450, y = (8 - 2 + 0.5) * 100 = 650
    expect(firstArrow).toHaveAttribute('x1', '450');
    expect(firstArrow).toHaveAttribute('y1', '650');
  });

  it('handles empty props gracefully', () => {
    const { container } = render(<VisualAidsOverlay boardSize={400} />);

    expect(screen.queryByTestId(/arrow-/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/highlight-/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/ghost-piece-/)).not.toBeInTheDocument();
  });

  it('applies correct arrow colors', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const firstArrow = screen.getByTestId('arrow-0');
    const secondArrow = screen.getByTestId('arrow-1');

    expect(firstArrow).toHaveAttribute('stroke', 'green');
    expect(secondArrow).toHaveAttribute('stroke', 'blue');
  });

  it('applies correct highlight opacity', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const highlights = screen.getAllByTestId(/highlight-/);
    highlights.forEach(highlight => {
      expect(highlight).toHaveAttribute('fill', 'rgba(74, 222, 128, 0.4)');
    });
  });

  it('applies correct ghost piece opacity', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const ghostPiece = screen.getByTestId('ghost-piece-0');
    expect(ghostPiece).toHaveAttribute('opacity', '0.5');
  });

  it('renders arrow heads correctly', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const arrows = screen.getAllByTestId(/arrow-/);
    arrows.forEach(arrow => {
      const marker = arrow.querySelector('marker');
      expect(marker).toBeInTheDocument();
      expect(marker).toHaveAttribute('markerWidth', '10');
      expect(marker).toHaveAttribute('markerHeight', '10');
    });
  });

  it('has proper pointer events disabled', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const overlay = screen.getByTestId('visual-aids-overlay');
    expect(overlay).toHaveStyle('pointer-events: none');
  });

  it('has correct z-index for layering', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const overlay = screen.getByTestId('visual-aids-overlay');
    expect(overlay).toHaveStyle('z-index: 10');
  });

  it('handles invalid square coordinates gracefully', () => {
    const invalidArrows = [
      { start: 'z9', end: 'a1', color: 'green' }, // Invalid start square
      { start: 'a1', end: 'z9', color: 'blue' },  // Invalid end square
    ];

    render(<VisualAidsOverlay {...defaultProps} arrows={invalidArrows} />);

    // Should not crash and may filter out invalid arrows
    const arrows = screen.queryAllByTestId(/arrow-/);
    expect(Array.isArray(arrows)).toBe(true);
  });

  it('renders multiple ghost pieces', () => {
    const multipleGhostPieces = [
      { square: 'e4', piece: 'wP', opacity: 0.5 },
      { square: 'f3', piece: 'wN', opacity: 0.7 },
      { square: 'g2', piece: 'wB', opacity: 0.3 },
    ];

    render(<VisualAidsOverlay {...defaultProps} ghostPieces={multipleGhostPieces} />);

    const ghostPieces = screen.getAllByTestId(/ghost-piece-/);
    expect(ghostPieces).toHaveLength(3);
  });

  it('uses correct SVG namespace', () => {
    render(<VisualAidsOverlay {...defaultProps} />);

    const svg = screen.getByRole('img'); // SVG elements have role="img"
    expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
  });

  it('maintains aspect ratio', () => {
    render(<VisualAidsOverlay {...defaultProps} boardSize={400} />);

    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '400');
    expect(svg).toHaveAttribute('height', '400');
  });
});