import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getPlayerAvatar } from '../utils/playerDisplayUtils';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import SocialShare from './SocialShare';
import { getFriendInvitationMessage } from '../utils/socialShareUtils';
import './Profile.css';
import './tutorial/ProfileTutorial.css';

const Profile = () => {
  const { user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [name, setName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tutorialStats, setTutorialStats] = useState(null);
  const [xpProgress, setXpProgress] = useState(null);

  // Image cropping states
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ unit: '%', width: 50, aspect: 1 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      loadFriends();
      loadPendingRequests();
      loadTutorialProgress();
    }
  }, [user]);

  const loadTutorialProgress = async () => {
    try {
      const response = await api.get('/tutorial/progress');
      setTutorialStats(response.data.data.stats);
      setXpProgress(response.data.data.xp_progress);
    } catch (err) {
      console.error('Error loading tutorial progress:', err);
      // Don't set empty arrays, just leave as null if failed
    }
  };

  const loadFriends = async () => {
    try {
      const response = await api.get('/friends');
      setFriends(response.data);
    } catch (err) {
      console.error('Error loading friends:', err);
      setFriends([]);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const response = await api.get('/friends/pending');
      setPendingRequests(response.data);
    } catch (err) {
      console.error('Error loading pending requests:', err);
      setPendingRequests([]);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await api.get('/users', { params: { search: searchQuery } });
      setSearchResults(response.data.filter(u => u.id !== user.id));
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  const handleAddFriend = async (friendId) => {
    try {
      await api.post(`/friends/${friendId}`);
      loadFriends();
    } catch (err) {
      console.error('Error adding friend:', err);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await api.delete(`/friends/${friendId}`);
      loadFriends();
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  const handleAcceptRequest = async (requesterId) => {
    try {
      await api.post(`/friends/${requesterId}/accept`);
      loadPendingRequests();
      loadFriends();
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  const handleRejectRequest = async (requesterId) => {
    try {
      await api.delete(`/friends/${requesterId}/reject`);
      loadPendingRequests();
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  // Image cropping functions
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result);
        setShowCropper(true);
        setCrop({ unit: '%', width: 50, aspect: 1 });
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCroppedImage = async () => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return null;
    }

    const image = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
          resolve(file);
        }
        resolve(null);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleCropConfirm = async () => {
    const croppedFile = await generateCroppedImage();
    if (croppedFile) {
      setAvatarFile(croppedFile);
      setShowCropper(false);
      setSelectedImage(null);
      setCompletedCrop(null);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedImage(null);
    setCompletedCrop(null);
    setAvatarFile(null);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();

      // Log what we're sending
      console.log('Current user data:', { name: user.name, hasAvatar: !!user.avatar_url });
      console.log('Form data:', { name, hasAvatarFile: !!avatarFile });

      // Only append fields that have changed
      if (name !== user.name && name.trim()) {
        formData.append('name', name.trim());
        console.log('Appending name:', name.trim());
      }

      if (avatarFile) {
        console.log('Appending avatar file:', {
          name: avatarFile.name,
          size: avatarFile.size,
          type: avatarFile.type
        });
        formData.append('avatar', avatarFile);
      }

      // If nothing to update, just return
      if (!formData.has('name') && !formData.has('avatar')) {
        setError('No changes to update');
        setLoading(false);
        return;
      }

      // Log FormData contents (for debugging)
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(key, value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value);
      }

      console.log('Sending profile update request...');
      const response = await api.post('/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log('Profile update response:', response.data);

      // Refresh user data from server
      await fetchUser();
      setAvatarFile(null);
      setLoading(false);
    } catch (err) {
      console.error('Profile update error:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.message ||
                          err.response?.data?.error ||
                          err.message ||
                          'Update failed';
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>Profile & Settings</h1>
      </div>

      {/* Profile Update Form */}
      <section className="profile-section">
        <h2>Edit Profile</h2>
        <form onSubmit={handleUpdateProfile} className="profile-form">
          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter display name"
            />
          </div>

          <div className="form-group">
            <label>Avatar</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              disabled={loading}
            />
            {avatarFile && (
              <div className="avatar-preview">
                <p>Avatar ready to upload:</p>
                <img src={URL.createObjectURL(avatarFile)} alt="Avatar preview" className="avatar-preview-img" />
              </div>
            )}
            {!avatarFile && (
              <img src={getPlayerAvatar(user)} alt="Current avatar" className="current-avatar" />
            )}
          </div>

          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </form>
      </section>

      {/* Image Cropping Modal */}
      {showCropper && selectedImage && (
        <div className="crop-modal">
          <div className="crop-modal-content">
            <h3>Crop Your Avatar</h3>
            <div className="crop-container">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
                minHeight={100}
              >
                <img
                  ref={imgRef}
                  src={selectedImage}
                  alt="Upload preview"
                  style={{ maxWidth: '100%', maxHeight: '400px' }}
                />
              </ReactCrop>
            </div>
            <div className="crop-actions">
              <button onClick={handleCropCancel} className="cancel-btn">
                Cancel
              </button>
              <button
                onClick={handleCropConfirm}
                className="confirm-btn"
                disabled={!completedCrop}
              >
                Confirm Crop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Friends Management */}
      <section className="profile-section">
        <h2>Chess Mates (Friends)</h2>
        <div className="friends-list">
          {friends.length > 0 ? (
            friends.map((friend) => (
              <div key={friend.id} className="friend-item">
                <img src={getPlayerAvatar(friend)} alt={friend.name} />
                <span>{friend.name} (Rating: {friend.rating})</span>
                <button onClick={() => handleRemoveFriend(friend.id)}>Remove</button>
              </div>
            ))
          ) : (
            <p style={{ color: '#8b8987', fontStyle: 'italic' }}>No friends yet. Add some chess mates below!</p>
          )}
        </div>

        {/* Search to Add Friends */}
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name..."
          />
          <button type="submit">Search</button>
        </form>

        <div className="search-results">
          {searchResults.map((result) => (
            <div key={result.id} className="search-item">
              <img src={getPlayerAvatar(result)} alt={result.name} />
              <span>{result.name} (Rating: {result.rating})</span>
              <button onClick={() => handleAddFriend(result.id)}>Add Friend</button>
            </div>
          ))}
        </div>
      </section>

      {/* Pending Requests */}
      <section className="profile-section">
        <h2>Pending Friend Requests</h2>
        <div className="requests-list">
          {pendingRequests.length > 0 ? (
            pendingRequests.map((req) => (
              <div key={req.id} className="request-item">
                <img src={getPlayerAvatar(req)} alt={req.name} />
                <span>{req.name} wants to be friends</span>
                <button onClick={() => handleAcceptRequest(req.id)}>Accept</button>
                <button onClick={() => handleRejectRequest(req.id)}>Reject</button>
              </div>
            ))
          ) : (
            <p style={{ color: '#8b8987', fontStyle: 'italic' }}>No pending friend requests.</p>
          )}
        </div>
      </section>

      {/* Tutorial Progress */}
      {tutorialStats && (
        <section className="profile-section">
          <h2>📚 Tutorial Progress</h2>
          <div className="tutorial-stats-grid">
            {/* XP and Level */}
            {xpProgress && (
              <div className="stat-card">
                <div className="stat-title">Level & XP</div>
                <div className="xp-progress">
                  <div className="level-info">
                    <span className="level">Level {Math.floor(xpProgress.current_xp > 0 ? Math.log2(xpProgress.current_xp / 100) + 2 : 1)}</span>
                    <span className="xp">{tutorialStats.xp} XP</span>
                  </div>
                  <div className="xp-bar">
                    <div
                      className="xp-fill"
                      style={{ width: `${xpProgress.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Overall Progress */}
            <div className="stat-card">
              <div className="stat-title">Overall Progress</div>
              <div className="progress-circle">
                <svg width="60" height="60">
                  <circle
                    cx="30"
                    cy="30"
                    r="25"
                    stroke="#3d3a37"
                    strokeWidth="5"
                    fill="none"
                  />
                  <circle
                    cx="30"
                    cy="30"
                    r="25"
                    stroke="#81b64c"
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={`${(tutorialStats.completion_percentage / 100) * 157} 157`}
                    transform="rotate(-90 30 30)"
                  />
                </svg>
                <div className="progress-text">{tutorialStats.completion_percentage}%</div>
              </div>
            </div>

            {/* Lessons Completed */}
            <div className="stat-card">
              <div className="stat-title">Lessons Completed</div>
              <div className="stat-value">{tutorialStats.completed_lessons}</div>
              <div className="stat-subtitle">of {tutorialStats.total_lessons}</div>
            </div>

            {/* Achievements */}
            <div className="stat-card">
              <div className="stat-title">Achievements</div>
              <div className="stat-value">🏆 {tutorialStats.achievements_count}</div>
              <div className="stat-subtitle">earned</div>
            </div>

            {/* Current Streak */}
            <div className="stat-card">
              <div className="stat-title">Daily Streak</div>
              <div className="stat-value">🔥 {tutorialStats.current_streak}</div>
              <div className="stat-subtitle">days</div>
            </div>

            {/* Skill Tier */}
            <div className="stat-card">
              <div className="stat-title">Skill Tier</div>
              <div className="skill-tier-badge">
                {tutorialStats.skill_tier === 'beginner' && '🌱 Beginner'}
                {tutorialStats.skill_tier === 'intermediate' && '🎯 Intermediate'}
                {tutorialStats.skill_tier === 'advanced' && '🏆 Advanced'}
              </div>
            </div>

            {/* Time Spent */}
            <div className="stat-card">
              <div className="stat-title">Time Learning</div>
              <div className="stat-value">⏱️ {tutorialStats.formatted_time_spent}</div>
              <div className="stat-subtitle">total</div>
            </div>
          </div>

          <div className="tutorial-actions">
            <button
              onClick={() => navigate('/tutorial')}
              className="tutorial-btn primary"
            >
              🎓 Continue Learning
            </button>
            <button
              onClick={() => navigate('/tutorial?tier=achievements')}
              className="tutorial-btn secondary"
            >
              🏆 View Achievements
            </button>
          </div>
        </section>
      )}

      {/* Invite Friends via Social Media */}
      <section className="profile-section">
        <h2>Invite Friends</h2>
        <p style={{ color: '#bababa', marginBottom: '16px' }}>
          Share Chess Web with your friends and challenge them to a game!
        </p>
        <SocialShare
          text={getFriendInvitationMessage(user?.name || 'A friend')}
          url={window.location.origin}
          title="Join me on Chess Web!"
          hashtags={['chess', 'chessweb', 'playchess']}
          showLabel={true}
          platforms={['whatsapp', 'facebook', 'twitter', 'telegram', 'instagram', 'email', 'copy']}
          onShare={(platform) => console.log(`Shared via ${platform}`)}
        />
      </section>
    </div>
  );
};

export default Profile;
