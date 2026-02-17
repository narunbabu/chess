// src/components/play/GameErrorBoundary.js
import React from 'react';

class GameErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Game Error Boundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handlePlayAgain = () => {
    window.location.href = '/play';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a18',
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '440px',
            width: '100%',
            background: '#262421',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '32px 28px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#9823;</div>
            <h1 style={{
              color: '#fff',
              fontSize: '1.5rem',
              fontWeight: '700',
              margin: '0 0 8px',
            }}>
              Something went wrong
            </h1>
            <p style={{
              color: '#999',
              fontSize: '0.9rem',
              margin: '0 0 24px',
              lineHeight: '1.5',
            }}>
              The game encountered an unexpected error. Your progress has been saved automatically.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                textAlign: 'left',
              }}>
                <pre style={{
                  color: '#f87171',
                  fontSize: '0.75rem',
                  margin: 0,
                  overflow: 'auto',
                  maxHeight: '120px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.handlePlayAgain}
                style={{
                  background: '#81b64c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                New Game
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  background: '#3d3a37',
                  color: '#bababa',
                  border: '1px solid #4a4744',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Reload
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  background: '#3d3a37',
                  color: '#bababa',
                  border: '1px solid #4a4744',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GameErrorBoundary;
