import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackCard from '../FeedbackCard';

describe('FeedbackCard', () => {
  const mockSuccessFeedback = {
    type: 'success',
    message: 'Excellent move! You mastered this technique.',
    scoreChange: 10
  };

  const mockErrorFeedback = {
    type: 'error',
    message: 'That square is dangerous. Try again.',
    scoreChange: -5
  };

  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders success feedback correctly', () => {
    render(<FeedbackCard feedback={mockSuccessFeedback} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Excellent!')).toBeInTheDocument();
    expect(screen.getByText('Excellent move! You mastered this technique.')).toBeInTheDocument();
    expect(screen.getByText('+10 points')).toBeInTheDocument();
  });

  it('renders error feedback correctly', () => {
    render(<FeedbackCard feedback={mockErrorFeedback} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Not quite!')).toBeInTheDocument();
    expect(screen.getByText('That square is dangerous. Try again.')).toBeInTheDocument();
    expect(screen.getByText('-5 points')).toBeInTheDocument();
  });

  it('shows close button when onDismiss is provided', () => {
    render(<FeedbackCard feedback={mockSuccessFeedback} onDismiss={mockOnDismiss} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('does not show close button when onDismiss is not provided', () => {
    render(<FeedbackCard feedback={mockSuccessFeedback} />);

    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', () => {
    render(<FeedbackCard feedback={mockSuccessFeedback} onDismiss={mockOnDismiss} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismiss functionality works by default', () => {
    render(<FeedbackCard feedback={mockSuccessFeedback} onDismiss={mockOnDismiss} />);

    // Timer should not have been called yet
    expect(mockOnDismiss).not.toHaveBeenCalled();

    // Fast-forward 3 seconds (default auto-dismiss time)
    jest.advanceTimersByTime(3000);

    // onDismiss should have been called after auto-dismiss time
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not auto-dismiss when autoDismiss is false', () => {
    render(<FeedbackCard feedback={mockSuccessFeedback} onDismiss={mockOnDismiss} autoDismiss={false} />);

    // Fast-forward 3 seconds
    jest.advanceTimersByTime(3000);

    // onDismiss should not have been called when autoDismiss is false
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('applies correct CSS classes for success feedback', () => {
    const { container } = render(
      <FeedbackCard feedback={mockSuccessFeedback} onDismiss={mockOnDismiss} />
    );

    expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
    expect(container.querySelector('.border-green-200')).toBeInTheDocument();
    expect(container.querySelector('.text-green-800')).toBeInTheDocument();
  });

  it('applies correct CSS classes for error feedback', () => {
    const { container } = render(
      <FeedbackCard feedback={mockErrorFeedback} onDismiss={mockOnDismiss} />
    );

    expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
    expect(container.querySelector('.border-red-200')).toBeInTheDocument();
    expect(container.querySelector('.text-red-800')).toBeInTheDocument();
  });

  it('renders subtext when provided', () => {
    const feedbackWithSubtext = {
      ...mockSuccessFeedback,
      subtext: 'Keep practicing this technique!'
    };

    render(<FeedbackCard feedback={feedbackWithSubtext} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Keep practicing this technique!')).toBeInTheDocument();
  });

  it('renders without feedback gracefully', () => {
    const { container } = render(<FeedbackCard feedback={null} onDismiss={mockOnDismiss} />);

    // Should render empty container when feedback is null
    expect(container.firstChild).toBeNull();
  });

  it('handles unknown feedback type gracefully', () => {
    const unknownFeedback = {
      type: 'unknown',
      message: 'Unknown feedback message.',
    };

    render(<FeedbackCard feedback={unknownFeedback} onDismiss={mockOnDismiss} />);

    // Should still render the message even with unknown type
    expect(screen.getByText('Unknown feedback message.')).toBeInTheDocument();
    // Falls back to some default styling
  });

  it('has proper accessibility attributes', () => {
    render(<FeedbackCard feedback={mockSuccessFeedback} onDismiss={mockOnDismiss} />);

    const feedbackCard = screen.getByRole('status'); // Using status role for feedback
    expect(feedbackCard).toBeInTheDocument();
  });

  it('clears timeout on unmount', () => {
    const { unmount } = render(<FeedbackCard feedback={mockSuccessFeedback} onDismiss={mockOnDismiss} />);

    // Unmount before timeout completes
    unmount();

    // Fast-forward 3 seconds
    jest.advanceTimersByTime(3000);

    // onDismiss should not have been called after unmount
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });
});