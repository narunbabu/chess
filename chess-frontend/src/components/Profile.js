import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { getPlayerAvatar } from '../utils/playerDisplayUtils';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import SocialShare from './SocialShare';
import { getFriendInvitationMessage } from '../utils/socialShareUtils';
import { BOARD_THEMES } from '../config/boardThemes';
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from './common/UpgradePrompt';
import './Profile.css';
import './tutorial/ProfileTutorial.css';

// DiceBear avatar styles and seed generator
const DICEBEAR_STYLES = ['adventurer', 'avataaars', 'bottts', 'fun-emoji'];
const generateDiceBearAvatars = () => {
  const avatars = [];
  for (const style of DICEBEAR_STYLES) {
    for (let i = 0; i < 3; i++) {
      const seed = `${style}-${Math.random().toString(36).substring(2, 8)}`;
      avatars.push({
        url: `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`,
        style,
        seed,
      });
    }
  }
  return avatars;
};

const Profile = () => {
  const { user, fetchUser } = useAuth();
  const { isStandard, currentTier, isPremium } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSetupMode = searchParams.get('setup') === 'true';
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [classOfStudy, setClassOfStudy] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tutorialStats, setTutorialStats] = useState(null);
  const [xpProgress, setXpProgress] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // DiceBear avatar picker state
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [diceBearAvatars, setDiceBearAvatars] = useState(() => generateDiceBearAvatars());
  const [selectedDiceBear, setSelectedDiceBear] = useState(null);
  const [fileSizeInfo, setFileSizeInfo] = useState(null);
  const fileInputRef = useRef(null);

  // Profile tab navigation (PR-R1)
  const [profileTab, setProfileTab] = useState(isSetupMode ? 'settings' : 'overview');

  // Organization affiliation state
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [orgSearchResults, setOrgSearchResults] = useState([]);
  const [orgSearchLoading, setOrgSearchLoading] = useState(false);
  const [orgError, setOrgError] = useState('');
  const orgSearchTimeout = useRef(null);

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
      setBirthday(user.birthday ? user.birthday.split('T')[0] : '');
      setClassOfStudy(user.class_of_study ? String(user.class_of_study) : '');
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

  const MAX_AVATAR_SIZE = 100 * 1024; // 100KB

  const generateCroppedImage = async () => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return null;
    }

    const image = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    let cropW = completedCrop.width * scaleX;
    let cropH = completedCrop.height * scaleY;

    // Try quality reduction first, then dimension halving
    for (let scale = 1; scale >= 0.25; scale *= 0.5) {
      canvas.width = cropW * scale;
      canvas.height = cropH * scale;
      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        cropW,
        cropH,
        0,
        0,
        canvas.width,
        canvas.height
      );

      for (let quality = 0.9; quality >= 0.1; quality -= 0.1) {
        const blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
        );
        if (blob && blob.size <= MAX_AVATAR_SIZE) {
          setFileSizeInfo(`${(blob.size / 1024).toFixed(1)}KB`);
          return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        }
      }
    }

    // Final fallback: smallest possible
    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.1)
    );
    if (blob) {
      setFileSizeInfo(`${(blob.size / 1024).toFixed(1)}KB`);
      return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    }
    return null;
  };

  const handleCropConfirm = async () => {
    const croppedFile = await generateCroppedImage();
    if (croppedFile) {
      setAvatarFile(croppedFile);
      setSelectedDiceBear(null); // Clear DiceBear when uploading photo
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

  // Organization affiliation handlers
  const handleOrgSearch = (query) => {
    setOrgSearchQuery(query);
    setOrgError('');

    if (orgSearchTimeout.current) clearTimeout(orgSearchTimeout.current);

    if (query.length < 2) {
      setOrgSearchResults([]);
      return;
    }

    orgSearchTimeout.current = setTimeout(async () => {
      setOrgSearchLoading(true);
      try {
        const response = await api.get('/v1/organizations/search', { params: { q: query } });
        setOrgSearchResults(response.data);
      } catch (err) {
        console.error('Org search error:', err);
        setOrgSearchResults([]);
      } finally {
        setOrgSearchLoading(false);
      }
    }, 300);
  };

  const handleJoinOrg = async (orgId) => {
    try {
      setOrgError('');
      await api.post(`/v1/organizations/${orgId}/join`);
      await fetchUser();
      setOrgSearchQuery('');
      setOrgSearchResults([]);
    } catch (err) {
      setOrgError(err.response?.data?.error || 'Failed to join organization');
    }
  };

  const handleLeaveOrg = async () => {
    try {
      setOrgError('');
      await api.post('/v1/organizations/leave');
      await fetchUser();
    } catch (err) {
      setOrgError(err.response?.data?.error || 'Failed to leave organization');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Setup mode validation
    if (isSetupMode) {
      if (!name.trim()) {
        setError('Please enter a display name');
        setLoading(false);
        return;
      }
      if (!selectedDiceBear && !avatarFile && !user?.avatar_url) {
        setError('Please pick an avatar or upload a photo');
        setLoading(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      let hasChanges = false;

      // Only append fields that have changed
      if (name !== user.name && name.trim()) {
        formData.append('name', name.trim());
        hasChanges = true;
      }

      if (avatarFile) {
        formData.append('avatar', avatarFile);
        hasChanges = true;
      } else if (selectedDiceBear) {
        formData.append('avatar_url', selectedDiceBear);
        hasChanges = true;
      }

      // Birthday
      const currentBirthday = user.birthday ? user.birthday.split('T')[0] : '';
      if (birthday !== currentBirthday) {
        formData.append('birthday', birthday || '');
        hasChanges = true;
      }

      // Class of study
      const currentClass = user.class_of_study ? String(user.class_of_study) : '';
      if (classOfStudy !== currentClass) {
        formData.append('class_of_study', classOfStudy || '');
        hasChanges = true;
      }

      // If nothing to update and not setup mode, just return
      if (!hasChanges) {
        if (isSetupMode) {
          formData.append('name', name.trim() || user.name);
        } else {
          setError('No changes to update');
          setLoading(false);
          return;
        }
      }

      await api.post('/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Refresh user data from server
      await fetchUser();
      setAvatarFile(null);
      setSelectedDiceBear(null);
      setLoading(false);

      // In setup mode, navigate to lobby after saving
      if (isSetupMode) {
        navigate('/lobby');
      }
    } catch (err) {
      console.error('Profile update error:', err);
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

  const handleShuffleAvatars = () => {
    setDiceBearAvatars(generateDiceBearAvatars());
    setSelectedDiceBear(null);
  };

  const handleSelectDiceBear = (url) => {
    setSelectedDiceBear(url);
    setAvatarFile(null); // Clear file upload if DiceBear selected
    setFileSizeInfo(null);
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>{isSetupMode ? 'Welcome! Set up your profile' : 'Profile & Settings'}</h1>
        {isSetupMode && (
          <p style={{ color: '#bababa', marginTop: '8px' }}>
            Choose a display name and pick an avatar to get started.
          </p>
        )}
      </div>

      {/* Tab Navigation (PR-R1) */}
      {!isSetupMode && (
        <nav style={{ display: 'flex', gap: '4px', margin: '0 0 24px', borderBottom: '2px solid #3d3a37', flexWrap: 'wrap' }}>
          {[
            { key: 'overview', label: '👤 Overview' },
            { key: 'settings', label: '⚙️ Settings' },
            { key: 'appearance', label: '🎨 Appearance' },
            { key: 'friends', label: '🤝 Friends' },
            { key: 'progress', label: '📊 Progress' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setProfileTab(tab.key)}
              style={{
                padding: '10px 18px',
                background: 'none',
                border: 'none',
                borderBottom: profileTab === tab.key ? '3px solid #81b64c' : '3px solid transparent',
                color: profileTab === tab.key ? '#fff' : '#8b8987',
                fontWeight: profileTab === tab.key ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                marginBottom: '-2px',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {/* Subscription Plan Section — Overview tab */}
      {!isSetupMode && profileTab === 'overview' && (
      <section className="profile-section">
        <h2>Subscription Plan</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '700',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              background: isPremium ? 'linear-gradient(135deg, #e8a93e, #f0c060)' :
                           isStandard ? 'linear-gradient(135deg, #81b64c, #a3d160)' :
                           'rgba(100,96,92,0.4)',
              color: currentTier === 'free' ? '#bababa' : '#1a1a18',
            }}>
              {currentTier === 'premium' ? '★ Premium' : currentTier === 'standard' ? '✓ Standard' : 'Free'}
            </span>
            <span style={{ color: '#8b8987', fontSize: '13px' }}>
              {isPremium ? 'All features unlocked' :
               isStandard ? 'Unlimited games & tournaments' :
               'Limited to 5 games/day online'}
            </span>
          </div>
          {!isPremium && (
            <button
              onClick={() => navigate('/pricing')}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #81b64c, #a3d160)',
                color: '#fff',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {isStandard ? '⬆ Upgrade to Premium' : '⬆ Upgrade Plan'}
            </button>
          )}
        </div>
      </section>
      )}

      {/* Profile Update Form — Settings tab (always in setup mode) */}
      {(isSetupMode || profileTab === 'settings') && (
      <section className="profile-section">
        <h2>{isSetupMode ? 'Your Profile' : 'Edit Profile'}</h2>
        <form onSubmit={handleUpdateProfile} className="profile-form">
          {/* Display Name */}
          <div className="form-group">
            <label>Display Name {isSetupMode && <span style={{ color: '#e74c3c' }}>*</span>}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter display name"
              required={isSetupMode}
            />
          </div>

          {/* Avatar Section — Compact row with current preview + action buttons */}
          <div className="form-group">
            <label>Avatar</label>
            <div className="avatar-action-row">
              <img
                src={
                  avatarFile
                    ? URL.createObjectURL(avatarFile)
                    : selectedDiceBear || getPlayerAvatar(user)
                }
                alt="Current avatar"
                className="avatar-action-preview"
              />
              <div className="avatar-action-buttons">
                <button
                  type="button"
                  className="avatar-action-btn"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                >
                  {showAvatarPicker ? 'Hide Avatars' : 'Choose Avatar'}
                </button>
                <button
                  type="button"
                  className="avatar-action-btn avatar-action-btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  Choose Photo
                </button>
              </div>
              {avatarFile && fileSizeInfo && (
                <span className="avatar-size-info">({fileSizeInfo})</span>
              )}
            </div>
            {/* Hidden file input triggered by Choose Photo */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                setSelectedDiceBear(null);
                setShowAvatarPicker(false);
                handleImageSelect(e);
              }}
              disabled={loading}
            />
          </div>

          {/* Collapsible DiceBear Avatar Grid */}
          {showAvatarPicker && (
            <div className="avatar-picker-collapsible">
              <div className="avatar-picker-grid">
                {diceBearAvatars.map((avatar) => (
                  <div
                    key={avatar.seed}
                    onClick={() => handleSelectDiceBear(avatar.url)}
                    className={`avatar-picker-item ${selectedDiceBear === avatar.url ? 'selected' : ''}`}
                  >
                    <img
                      src={avatar.url}
                      alt={`Avatar ${avatar.style}`}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleShuffleAvatars}
                className="avatar-shuffle-btn"
              >
                Shuffle Avatars
              </button>
            </div>
          )}

          {/* Birthday & Class of Study */}
          <div className="profile-field-row">
            <div className="form-group profile-field-half">
              <label>Birthday</label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                min="1950-01-01"
              />
            </div>
            <div className="form-group profile-field-half">
              <label title="Your school class (Grade 1–12). Used to find age-appropriate opponents and tournaments.">
                Class of Study
                <span style={{ marginLeft: '4px', color: '#8b8987', fontSize: '0.8em', cursor: 'help' }} title="Your school class (Grade 1–12). Used to match you with age-appropriate opponents and tournaments.">ⓘ</span>
              </label>
              <select
                value={classOfStudy}
                onChange={(e) => setClassOfStudy(e.target.value)}
                className="profile-select"
              >
                <option value="">Select Class</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((cls) => (
                  <option key={cls} value={cls}>Class {cls}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading
              ? 'Saving...'
              : isSetupMode
                ? 'Continue to Lobby'
                : 'Update Profile'
            }
          </button>
        </form>
      </section>
      )}

      {/* Image Cropping Modal — shown when avatar crop is active in Settings */}
      {(isSetupMode || profileTab === 'settings') && showCropper && selectedImage && (
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

      {/* School / Organization Affiliation — Settings tab */}
      {(isSetupMode || profileTab === 'settings') && (
      <section className="profile-section">
        <h2>School / Organization</h2>
        {user.organization ? (
          <div className="org-current">
            <div className="org-badge">
              {user.organization.logo_url && (
                <img src={user.organization.logo_url} alt="" className="org-badge-logo" />
              )}
              <div className="org-badge-info">
                <span className="org-badge-name">{user.organization.name}</span>
                <span className="org-badge-type">{user.organization.type}</span>
              </div>
              <button
                type="button"
                onClick={handleLeaveOrg}
                className="org-leave-btn"
              >
                Leave
              </button>
            </div>
          </div>
        ) : (
          <div className="org-search-wrapper">
            <p style={{ color: '#bababa', marginBottom: '10px', fontSize: '14px' }}>
              Search and join your school or organization.
            </p>
            <input
              type="text"
              value={orgSearchQuery}
              onChange={(e) => handleOrgSearch(e.target.value)}
              placeholder="Type to search organizations..."
              className="org-search-input"
            />
            {orgSearchLoading && (
              <p style={{ color: '#8b8987', fontSize: '13px', marginTop: '6px' }}>Searching...</p>
            )}
            {orgSearchResults.length > 0 && (
              <div className="org-search-results">
                {orgSearchResults.map((org) => (
                  <div key={org.id} className="org-search-item" onClick={() => handleJoinOrg(org.id)}>
                    {org.logo_url && (
                      <img src={org.logo_url} alt="" className="org-search-item-logo" />
                    )}
                    <div className="org-search-item-info">
                      <span className="org-search-item-name">{org.name}</span>
                      <span className="org-search-item-meta">{org.type} &middot; {org.users_count} members</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {orgSearchQuery.length >= 2 && !orgSearchLoading && orgSearchResults.length === 0 && (
              <p style={{ color: '#8b8987', fontSize: '13px', marginTop: '6px' }}>No organizations found.</p>
            )}
          </div>
        )}
        {orgError && <p className="error" style={{ marginTop: '8px' }}>{orgError}</p>}
      </section>
      )}

      {/* Board Theme Selector — Appearance tab */}
      {!isSetupMode && profileTab === 'appearance' && (
      <>
      <section className="profile-section">
        <h2>Board Theme</h2>
        <p style={{ color: '#bababa', marginBottom: '12px', fontSize: '14px' }}>
          Choose your board colors. Premium themes require a subscription.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '16px',
        }}>
          {Object.entries(BOARD_THEMES).map(([key, theme]) => {
            const isSelected = (user?.board_theme || 'classic') === key;
            const isLocked = theme.tier === 'standard' && !isStandard;
            return (
              <button
                key={key}
                onClick={async () => {
                  if (isLocked) {
                    setShowUpgradePrompt(true);
                    return;
                  }
                  try {
                    await api.post('/profile', { board_theme: key });
                    await fetchUser();
                  } catch (err) {
                    console.error('Error saving board theme:', err);
                  }
                }}
                style={{
                  position: 'relative',
                  padding: '10px',
                  borderRadius: '12px',
                  border: `2px solid ${isSelected ? '#81b64c' : '#4a4744'}`,
                  backgroundColor: isSelected ? 'rgba(129, 182, 76, 0.12)' : '#2b2927',
                  cursor: 'pointer',
                  opacity: isLocked ? 0.75 : 1,
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 0 1px rgba(129,182,76,0.4)' : 'none',
                }}
              >
                {/* Mini board preview: 8x8 checkerboard */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '8px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {Array.from({ length: 64 }).map((_, i) => {
                    const row = Math.floor(i / 8);
                    const col = i % 8;
                    const isLight = (row + col) % 2 === 0;
                    return (
                      <div
                        key={i}
                        style={{ backgroundColor: isLight ? theme.light : theme.dark }}
                      />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {isLocked && <span style={{ fontSize: '12px' }}>🔒</span>}
                  {isSelected && <span style={{ fontSize: '10px', color: '#81b64c' }}>✓</span>}
                  <span style={{ color: isSelected ? '#81b64c' : '#bababa', fontSize: '12px', fontWeight: isSelected ? '700' : '500' }}>
                    {theme.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      {showUpgradePrompt && (
        <UpgradePrompt
          feature="Premium Board Theme"
          requiredTier="Premium"
          onDismiss={() => setShowUpgradePrompt(false)}
        />
      )}
      </>
      )}

      {/* Friends Management — Friends tab */}
      {!isSetupMode && profileTab === 'friends' && (
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
      )}

      {/* Pending Requests — Friends tab */}
      {!isSetupMode && profileTab === 'friends' && (
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
      )}

      {/* Tutorial Progress — Progress tab */}
      {!isSetupMode && profileTab === 'progress' && tutorialStats && (
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

      {/* Account Security — Settings tab */}
      {!isSetupMode && profileTab === 'settings' && (
      <section className="profile-section">
        <h2>🔒 Account Security</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#2b2927', borderRadius: '10px', border: '1px solid #3d3a37' }}>
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: '600', fontSize: '14px' }}>Password</div>
              <div style={{ color: '#8b8987', fontSize: '12px' }}>Change your account password</div>
            </div>
            <button
              onClick={() => navigate('/settings')}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #4a4744', background: 'transparent', color: '#bababa', fontSize: '13px', cursor: 'pointer' }}
            >
              Change
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#2b2927', borderRadius: '10px', border: '1px solid #3d3a37' }}>
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: '600', fontSize: '14px' }}>Email</div>
              <div style={{ color: '#8b8987', fontSize: '12px' }}>{user?.email}</div>
            </div>
            <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(129,182,76,0.15)', color: '#81b64c', fontSize: '12px', fontWeight: '600' }}>
              ✓ Verified
            </span>
          </div>
          {user?.google_id && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#2b2927', borderRadius: '10px', border: '1px solid #3d3a37' }}>
              <div>
                <div style={{ color: '#e5e7eb', fontWeight: '600', fontSize: '14px' }}>Google Account</div>
                <div style={{ color: '#8b8987', fontSize: '12px' }}>Linked for sign-in</div>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(129,182,76,0.15)', color: '#81b64c', fontSize: '12px', fontWeight: '600' }}>
                ✓ Linked
              </span>
            </div>
          )}
        </div>
      </section>
      )}

      {/* Invite Friends via Social Media — Friends tab */}
      {!isSetupMode && profileTab === 'friends' && (
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
      )}
    </div>
  );
};

export default Profile;
