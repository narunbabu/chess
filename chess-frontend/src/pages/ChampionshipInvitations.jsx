import React, { useState } from 'react';
import { useChampionshipInvitations } from '../contexts/ChampionshipInvitationContext';
import ChampionshipMatchInvitation from '../components/championship/ChampionshipMatchInvitation';
import { useAuth } from '../contexts/AuthContext';

const ChampionshipInvitations = () => {
  const { user } = useAuth();
  const { invitations, loading, createAcceptHandler, createDeclineHandler } = useChampionshipInvitations();

  if (!user) {
    return (
      <div className="container text-center py-5">
        <h3>Please log in to view your championship invitations</h3>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row mb-4">
        <div className="col">
          <h2>
            <i className="fas fa-trophy me-2"></i>
            Championship Invitations
          </h2>
          <p className="text-muted">
            Manage your tournament match invitations
          </p>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading invitations...</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="row mb-4">
            <div className="col">
              <div className="card">
                <div className="card-body">
                  <div className="row align-items-center">
                    <div className="col-md-8">
                      <h5 className="mb-0">
                        <i className="fas fa-envelope-open-text me-2"></i>
                        Pending Invitations
                      </h5>
                      <p className="text-muted mb-0">
                        {invitations.length} pending championship match invitation{invitations.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="col-md-4 text-end">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => window.location.reload()}
                        disabled={loading}
                      >
                        <i className="fas fa-sync-alt me-1"></i>
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col">
              {invitations.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                  <h4>No Pending Invitations</h4>
                  <p className="text-muted">
                    You don't have any championship match invitations at the moment.
                    Check back later or contact tournament organizers.
                  </p>
                </div>
              ) : (
                <div className="row">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="col-md-6 col-lg-4 mb-4">
                      <ChampionshipMatchInvitation
                        invitation={invitation}
                        match={invitation.championship_match}
                        championship={invitation.championship_match?.championship}
                        onAccept={createAcceptHandler(invitation)}
                        onDecline={createDeclineHandler(invitation)}
                        onCancel={() => {/* No cancel action needed */}}
                        isProcessing={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="row mt-4">
        <div className="col">
          <div className="alert alert-info" role="alert">
            <h6 className="alert-heading">
              <i className="fas fa-info-circle me-2"></i>
              How Championship Invitations Work
            </h6>
            <hr />
            <ul className="mb-0">
              <li>When tournament organizers generate matches, you'll receive invitations here</li>
              <li>Accept an invitation to automatically create and join your championship game</li>
              <li>Decline if you're unable to play at the scheduled time</li>
              <li>Invitations expire automatically after the tournament's time window</li>
              <li>Games will use the tournament's time control settings (e.g., 10+5)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChampionshipInvitations;