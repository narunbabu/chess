import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
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
  const postSetupRedirect = searchParams.get('redirect');
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

  // Mobile / tournament contact fields
  const [mobileCountryCode, setMobileCountryCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [tournamentConsent, setTournamentConsent] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [locationCountryId, setLocationCountryId] = useState('');
  const [locationStateId, setLocationStateId] = useState('');
  const [locationDistrictId, setLocationDistrictId] = useState('');
  const [locationMandalId, setLocationMandalId] = useState('');
  const [locationVillageId, setLocationVillageId] = useState('');
  const [locationOther, setLocationOther] = useState('');
  const [locationCountries, setLocationCountries] = useState([]);
  const [locationStates, setLocationStates] = useState([]);
  const [locationDistricts, setLocationDistricts] = useState([]);
  const [locationMandals, setLocationMandals] = useState([]);
  const [locationVillages, setLocationVillages] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const PHONE_DIGIT_LENGTHS = {
    '+1': { min: 10, max: 10 },   // US/Canada
    '+7': { min: 10, max: 10 },   // Russia/Kazakhstan
    '+20': { min: 10, max: 10 },  // Egypt
    '+27': { min: 9, max: 9 },    // South Africa
    '+30': { min: 10, max: 10 },  // Greece
    '+31': { min: 9, max: 9 },    // Netherlands
    '+33': { min: 9, max: 9 },    // France
    '+34': { min: 9, max: 9 },    // Spain
    '+39': { min: 9, max: 10 },   // Italy
    '+44': { min: 10, max: 10 },  // UK
    '+49': { min: 10, max: 11 },  // Germany
    '+61': { min: 9, max: 9 },    // Australia
    '+62': { min: 10, max: 12 },  // Indonesia
    '+63': { min: 10, max: 10 },  // Philippines
    '+65': { min: 8, max: 8 },    // Singapore
    '+66': { min: 9, max: 9 },    // Thailand
    '+81': { min: 9, max: 10 },   // Japan
    '+82': { min: 9, max: 10 },   // South Korea
    '+86': { min: 11, max: 11 },  // China
    '+90': { min: 10, max: 10 },  // Turkey
    '+91': { min: 10, max: 10 },  // India
    '+92': { min: 10, max: 10 },  // Pakistan
    '+93': { min: 9, max: 9 },    // Afghanistan
    '+94': { min: 9, max: 9 },    // Sri Lanka
    '+95': { min: 9, max: 10 },   // Myanmar
    '+960': { min: 7, max: 7 },   // Maldives
    '+966': { min: 9, max: 9 },   // Saudi Arabia
    '+968': { min: 8, max: 8 },   // Oman
    '+971': { min: 9, max: 9 },   // UAE
    '+974': { min: 8, max: 8 },   // Qatar
    '+977': { min: 10, max: 10 }, // Nepal
    '+880': { min: 10, max: 11 }, // Bangladesh
  };

  const validateMobileNumber = (digits, code) => {
    if (!digits) return '';
    const rule = PHONE_DIGIT_LENGTHS[code];
    const len = digits.length;
    if (rule) {
      if (len < rule.min) return `Too short — ${rule.min} digits expected for ${code}`;
      if (len > rule.max) return `Too long — ${rule.max} digits expected for ${code}`;
    } else if (len < 7 || len > 15) {
      return 'Phone number should be 7–15 digits';
    }
    return '';
  };

  // Profile tab navigation (PR-R1)
  const [profileTab, setProfileTab] = useState('settings');

  // Organization affiliation state
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [orgSearchResults, setOrgSearchResults] = useState([]);
  const [orgSearchLoading, setOrgSearchLoading] = useState(false);
  const [orgError, setOrgError] = useState('');
  const orgSearchTimeout = useRef(null);
  const [showOrgRequestModal, setShowOrgRequestModal] = useState(false);
  const [orgRequestForm, setOrgRequestForm] = useState({ name: '', type: 'school', city: '', state: '', website: '' });
  const [orgRequestSubmitting, setOrgRequestSubmitting] = useState(false);
  const [orgRequestSuccess, setOrgRequestSuccess] = useState(false);
  const [orgRequestError, setOrgRequestError] = useState('');

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
      setMobileCountryCode(user.mobile_country_code || '+91');
      setMobileNumber(user.mobile_number || '');
      // Default to India (id=1) if no country chosen yet but a state is set,
      // otherwise leave blank for the user to pick.
      const inferredCountry = user.location_country_id
        ? String(user.location_country_id)
        : (user.location_state_id ? '1' : '');
      setLocationCountryId(inferredCountry);
      setLocationStateId(user.location_state_id ? String(user.location_state_id) : '');
      setLocationDistrictId(user.location_district_id ? String(user.location_district_id) : '');
      setLocationMandalId(user.location_mandal_id ? String(user.location_mandal_id) : '');
      setLocationVillageId(user.location_village_id ? String(user.location_village_id) : '');
      setLocationOther(user.location_other || '');
      setTournamentConsent(!!user.tournament_contact_consent_at);
      setWhatsappOptIn(!!user.whatsapp_updates_opt_in);
      loadFriends();
      loadPendingRequests();
      loadTutorialProgress();
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadCountries = async () => {
      try {
        setLocationError('');
        const response = await api.get('/locations/countries');
        if (active) setLocationCountries(response.data || []);
      } catch (err) {
        if (active) setLocationError('Could not load countries');
      }
    };
    loadCountries();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadStates = async () => {
      if (!locationCountryId || locationCountryId === 'other') {
        setLocationStates([]);
        return;
      }
      try {
        setLocationError('');
        const response = await api.get('/locations/states', { params: { country_id: locationCountryId } });
        if (active) setLocationStates(response.data || []);
      } catch (err) {
        if (active) setLocationError('Could not load states');
      }
    };

    loadStates();
    return () => { active = false; };
  }, [locationCountryId]);

  useEffect(() => {
    let active = true;
    const loadDistricts = async () => {
      if (!locationStateId || locationStateId === 'other') {
        setLocationDistricts([]);
        return;
      }
      try {
        setLocationLoading(true);
        setLocationError('');
        const response = await api.get('/locations/districts', { params: { state_id: locationStateId } });
        if (active) setLocationDistricts(response.data || []);
      } catch (err) {
        if (active) setLocationError('Could not load districts');
      } finally {
        if (active) setLocationLoading(false);
      }
    };

    loadDistricts();
    return () => { active = false; };
  }, [locationStateId]);

  useEffect(() => {
    let active = true;
    const loadMandals = async () => {
      if (!locationDistrictId || locationDistrictId === 'other') {
        setLocationMandals([]);
        return;
      }
      try {
        setLocationLoading(true);
        setLocationError('');
        const response = await api.get('/locations/mandals', { params: { district_id: locationDistrictId } });
        if (active) setLocationMandals(response.data || []);
      } catch (err) {
        if (active) setLocationError('Could not load mandals');
      } finally {
        if (active) setLocationLoading(false);
      }
    };

    loadMandals();
    return () => { active = false; };
  }, [locationDistrictId]);

  useEffect(() => {
    let active = true;
    const loadVillages = async () => {
      if (!locationMandalId || locationMandalId === 'other') {
        setLocationVillages([]);
        return;
      }
      try {
        setLocationLoading(true);
        setLocationError('');
        const response = await api.get('/locations/villages', { params: { mandal_id: locationMandalId } });
        if (active) setLocationVillages(response.data || []);
      } catch (err) {
        if (active) setLocationError('Could not load villages');
      } finally {
        if (active) setLocationLoading(false);
      }
    };

    loadVillages();
    return () => { active = false; };
  }, [locationMandalId]);

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

  const handleOrgRequestSubmit = async (e) => {
    e.preventDefault();
    if (!orgRequestForm.name.trim()) {
      setOrgRequestError('Organization name is required.');
      return;
    }
    setOrgRequestSubmitting(true);
    setOrgRequestError('');
    try {
      await api.post('/organizations/request', orgRequestForm);
      setOrgRequestSuccess(true);
      setOrgRequestForm({ name: '', type: 'school', city: '', state: '', website: '' });
    } catch (err) {
      const data = err.response?.data;
      const firstMsg = data?.messages ? Object.values(data.messages)[0]?.[0] : null;
      setOrgRequestError(firstMsg || data?.error || 'Failed to submit request. Please try again.');
    } finally {
      setOrgRequestSubmitting(false);
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

      // 'other' sentinel → empty (NULL) FK; the free-text goes in location_other.
      const idOrNull = (v) => (v && v !== 'other' ? String(v) : '');
      const locationFields = [
        ['location_country_id', idOrNull(locationCountryId), user.location_country_id],
        ['location_state_id', idOrNull(locationStateId), user.location_state_id],
        ['location_district_id', idOrNull(locationDistrictId), user.location_district_id],
        ['location_mandal_id', idOrNull(locationMandalId), user.location_mandal_id],
        ['location_village_id', idOrNull(locationVillageId), user.location_village_id],
      ];

      locationFields.forEach(([field, value, currentValue]) => {
        const normalizedCurrent = currentValue ? String(currentValue) : '';
        if (value !== normalizedCurrent) {
          formData.append(field, value);
          hasChanges = true;
        }
      });

      const currentOther = user.location_other || '';
      if (locationOther !== currentOther) {
        formData.append('location_other', locationOther || '');
        hasChanges = true;
      }

      // Mobile fields
      const currentCountryCode = user.mobile_country_code || '';
      const currentMobileNumber = user.mobile_number || '';
      const currentWhatsappOptIn = !!user.whatsapp_updates_opt_in;
      const currentTournamentConsent = !!user.tournament_contact_consent_at;

      const digitsOnly = mobileNumber.replace(/\D/g, '');
      if (digitsOnly) {
        const validationError = validateMobileNumber(digitsOnly, mobileCountryCode);
        if (validationError) {
          setMobileError(validationError);
          setLoading(false);
          return;
        }
        formData.append('mobile_country_code', mobileCountryCode);
        if (mobileNumber !== currentMobileNumber) {
          formData.append('mobile_number', mobileNumber);
        }
        hasChanges = true;
      } else if (!digitsOnly && currentMobileNumber) {
        // User cleared the number — send empty to clear on backend
        formData.append('mobile_country_code', mobileCountryCode);
        formData.append('mobile_number', '');
        hasChanges = true;
      }
      if (tournamentConsent !== currentTournamentConsent) {
        formData.append('tournament_contact_consent', tournamentConsent ? '1' : '0');
        hasChanges = true;
      }
      if (whatsappOptIn !== currentWhatsappOptIn) {
        formData.append('whatsapp_updates_opt_in', whatsappOptIn ? '1' : '0');
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

      // In setup mode, navigate to pending redirect (e.g. /pricing) or lobby
      if (isSetupMode) {
        navigate(postSetupRedirect || '/lobby');
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
      <Helmet>
        <title>Profile & Settings — Chess99</title>
        <meta name="description" content="Manage your Chess99 profile, customize your board, track progress, and configure account settings." />
        <meta property="og:title" content="Profile & Settings — Chess99" />
        <meta property="og:description" content="Manage your chess profile, track rating progress, and customize your experience on Chess99." />
        <meta property="og:image" content="https://chess99.com/og-image.png" />
        <meta property="og:url" content="https://chess99.com/profile" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://chess99.com/profile" />
      </Helmet>
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

      {/* Subscription Plan Section — Settings tab */}
      {!isSetupMode && profileTab === 'settings' && (
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
              {isPremium ? '★ Gold' : isStandard ? '✓ Silver' : 'Free'}
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
              {isStandard ? '⬆ Upgrade to Gold' : '⬆ Upgrade Plan'}
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
              <label title="Your education level. Used to find age-appropriate opponents and tournaments.">
                Class of Study
                <span style={{ marginLeft: '4px', color: '#8b8987', fontSize: '0.8em', cursor: 'help' }} title="Your education level. Used to match you with age-appropriate opponents and tournaments.">ⓘ</span>
              </label>
              <select
                value={classOfStudy}
                onChange={(e) => setClassOfStudy(e.target.value)}
                className="profile-select"
              >
                <option value="">Select Class</option>
                {['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12','Undergraduate','Postgraduate/Masters','PhD/Research','Working Professional','Senior/Retired','Other'].map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile Number & Tournament Contact */}
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Mobile Number
              {isSetupMode && <span style={{ color: '#8b8987', fontWeight: '400', fontSize: '12px', marginLeft: '6px' }}>(optional)</span>}
            </label>
            <div className="profile-field-row" style={{ marginBottom: '0' }}>
              <div className="form-group profile-field-half">
                <input
                  type="text"
                  value={mobileCountryCode}
                  onChange={(e) => {
                    setMobileCountryCode(e.target.value);
                    setMobileError(validateMobileNumber(mobileNumber.replace(/\D/g, ''), e.target.value));
                  }}
                  placeholder="+91"
                  style={{ maxWidth: '90px', textAlign: 'center' }}
                />
              </div>
              <div className="form-group profile-field-half" style={{ flex: '1' }}>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => {
                    setMobileNumber(e.target.value);
                    setMobileError(validateMobileNumber(e.target.value.replace(/\D/g, ''), mobileCountryCode));
                  }}
                  placeholder="Enter mobile number"
                />
              </div>
            </div>
            {mobileError && (
              <p style={{ color: '#e74c3c', fontSize: '13px', margin: '6px 0 0', lineHeight: '1.4' }}>
                {mobileError}
              </p>
            )}
          </div>

          {/* Tournament Contact Consent Checkbox */}
          <div className="form-group" style={{ marginTop: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#bababa', lineHeight: '1.5' }}>
              <input
                type="checkbox"
                checked={tournamentConsent}
                onChange={(e) => setTournamentConsent(e.target.checked)}
                style={{ marginTop: '3px', accentColor: '#81b64c', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span>
                I agree to be contacted via phone/WhatsApp for tournament updates and announcements
              </span>
            </label>
          </div>

          {/* WhatsApp Updates Opt-in Checkbox */}
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#bababa', lineHeight: '1.5' }}>
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                style={{ marginTop: '3px', accentColor: '#81b64c', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span>
                Send me chess tips, puzzle challenges, and event reminders via WhatsApp
              </span>
            </label>
          </div>

          <div style={{ marginTop: '22px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Area
              <span style={{ color: '#8b8987', fontWeight: '400', fontSize: '12px', marginLeft: '6px' }}>
                (country, state, district, mandal, village — pick "Other" to type your own)
              </span>
            </label>
            {(() => {
              const countryIsOther = locationCountryId === 'other';
              const stateIsOther = locationStateId === 'other';
              const districtIsOther = locationDistrictId === 'other';
              const mandalIsOther = locationMandalId === 'other';
              const showOtherText = countryIsOther || stateIsOther || districtIsOther || mandalIsOther;
              const otherOption = <option value="other">— Other (type below) —</option>;
              return (
                <>
                  <div className="profile-field-row">
                    <div className="form-group profile-field-half">
                      <select
                        value={locationCountryId}
                        onChange={(e) => {
                          setLocationCountryId(e.target.value);
                          setLocationStateId('');
                          setLocationDistrictId('');
                          setLocationMandalId('');
                          setLocationVillageId('');
                        }}
                        className="profile-select"
                      >
                        <option value="">Select Country</option>
                        {locationCountries.map((country) => (
                          <option key={country.id} value={country.id}>{country.name}</option>
                        ))}
                        {otherOption}
                      </select>
                    </div>
                    {!countryIsOther && (
                      <div className="form-group profile-field-half">
                        <select
                          value={locationStateId}
                          onChange={(e) => {
                            setLocationStateId(e.target.value);
                            setLocationDistrictId('');
                            setLocationMandalId('');
                            setLocationVillageId('');
                          }}
                          className="profile-select"
                          disabled={!locationCountryId}
                        >
                          <option value="">Select State</option>
                          {locationStates.map((state) => (
                            <option key={state.id} value={state.id}>{state.name}</option>
                          ))}
                          {otherOption}
                        </select>
                      </div>
                    )}
                  </div>
                  {!countryIsOther && !stateIsOther && (
                    <div className="profile-field-row">
                      <div className="form-group profile-field-half">
                        <select
                          value={locationDistrictId}
                          onChange={(e) => {
                            setLocationDistrictId(e.target.value);
                            setLocationMandalId('');
                            setLocationVillageId('');
                          }}
                          className="profile-select"
                          disabled={!locationStateId}
                        >
                          <option value="">Select District</option>
                          {locationDistricts.map((district) => (
                            <option key={district.id} value={district.id}>{district.name}</option>
                          ))}
                          {otherOption}
                        </select>
                      </div>
                      {!districtIsOther && (
                        <div className="form-group profile-field-half">
                          <select
                            value={locationMandalId}
                            onChange={(e) => {
                              setLocationMandalId(e.target.value);
                              setLocationVillageId('');
                            }}
                            className="profile-select"
                            disabled={!locationDistrictId}
                          >
                            <option value="">Select Mandal</option>
                            {locationMandals.map((mandal) => (
                              <option key={mandal.id} value={mandal.id}>{mandal.name}</option>
                            ))}
                            {otherOption}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  {!countryIsOther && !stateIsOther && !districtIsOther && !mandalIsOther && (
                    <div className="profile-field-row">
                      <div className="form-group profile-field-half">
                        <select
                          value={locationVillageId}
                          onChange={(e) => setLocationVillageId(e.target.value)}
                          className="profile-select"
                          disabled={!locationMandalId}
                        >
                          <option value="">Select Village / Area</option>
                          {locationVillages.map((village) => (
                            <option key={village.id} value={village.id}>{village.name}</option>
                          ))}
                          {otherOption}
                        </select>
                      </div>
                    </div>
                  )}
                  {(showOtherText || locationVillageId === 'other') && (
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <input
                        type="text"
                        value={locationOther}
                        onChange={(e) => setLocationOther(e.target.value)}
                        placeholder="Type your country / state / city / area"
                        maxLength={255}
                        className="profile-select"
                      />
                    </div>
                  )}
                </>
              );
            })()}
            {locationLoading && (
              <p style={{ color: '#8b8987', fontSize: '13px', margin: '4px 0 0' }}>Loading area options...</p>
            )}
            {locationError && (
              <p style={{ color: '#e74c3c', fontSize: '13px', margin: '4px 0 0' }}>{locationError}</p>
            )}
          </div>

          {error && <p className="error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
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
            <button
              type="button"
              onClick={() => { setShowOrgRequestModal(true); setOrgRequestSuccess(false); setOrgRequestError(''); }}
              style={{
                background: 'none', border: 'none', color: '#4fc3f7', cursor: 'pointer',
                fontSize: '13px', marginTop: '10px', padding: 0, textDecoration: 'underline',
              }}
            >
              Can't find your school? Request it
            </button>
          </div>
        )}
        {orgError && <p className="error" style={{ marginTop: '8px' }}>{orgError}</p>}
      </section>
      )}

      {/* Organization Request Modal */}
      {showOrgRequestModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '28px',
            width: '90%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto',
            color: '#e0e0e0',
          }}>
            {orgRequestSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <h3 style={{ color: '#4caf50', marginBottom: '12px' }}>Request Submitted!</h3>
                <p style={{ color: '#bababa', fontSize: '14px', lineHeight: 1.6 }}>
                  Your organization request has been sent for admin approval. You'll be notified once it's approved.
                </p>
                <button
                  type="button"
                  onClick={() => setShowOrgRequestModal(false)}
                  style={{
                    marginTop: '20px', padding: '10px 28px', borderRadius: '8px',
                    border: 'none', backgroundColor: '#4caf50', color: '#fff',
                    cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                  }}
                >
                  Got it
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Request an Organization</h3>
                  <button
                    type="button"
                    onClick={() => setShowOrgRequestModal(false)}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
                  >
                    &times;
                  </button>
                </div>
                <form onSubmit={handleOrgRequestSubmit}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>
                    Name <span style={{ color: '#ef5350' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={orgRequestForm.name}
                    onChange={(e) => setOrgRequestForm({ ...orgRequestForm, name: e.target.value })}
                    placeholder="e.g. Delhi Public School"
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#e0e0e0', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' }}
                  />
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>Type</label>
                  <select
                    value={orgRequestForm.type}
                    onChange={(e) => setOrgRequestForm({ ...orgRequestForm, type: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#e0e0e0', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' }}
                  >
                    <option value="school">School</option>
                    <option value="club">Club</option>
                    <option value="company">Company</option>
                    <option value="federation">Federation</option>
                    <option value="community">Community</option>
                    <option value="other">Other</option>
                  </select>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>City</label>
                      <input
                        type="text"
                        value={orgRequestForm.city}
                        onChange={(e) => setOrgRequestForm({ ...orgRequestForm, city: e.target.value })}
                        placeholder="City"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#e0e0e0', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>State</label>
                      <input
                        type="text"
                        value={orgRequestForm.state}
                        onChange={(e) => setOrgRequestForm({ ...orgRequestForm, state: e.target.value })}
                        placeholder="State"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#e0e0e0', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>Website (optional)</label>
                  <input
                    type="url"
                    value={orgRequestForm.website}
                    onChange={(e) => setOrgRequestForm({ ...orgRequestForm, website: e.target.value })}
                    placeholder="https://example.com"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#e0e0e0', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' }}
                  />
                  {orgRequestError && (
                    <p style={{ color: '#ef5350', fontSize: '13px', margin: '0 0 10px' }}>{orgRequestError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={orgRequestSubmitting}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                      backgroundColor: orgRequestSubmitting ? '#555' : '#4fc3f7', color: '#111',
                      cursor: orgRequestSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '15px', fontWeight: 600,
                    }}
                  >
                    {orgRequestSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Board Theme Selector — Appearance tab */}
      {!isSetupMode && profileTab === 'appearance' && (
      <>
      <section className="profile-section">
        <h2>Board Theme</h2>
        <p style={{ color: '#bababa', marginBottom: '12px', fontSize: '14px' }}>
          Choose your board colors. Themed boards require Silver or higher.
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
          feature="Custom Board Theme"
          requiredTier="Silver"
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
                <button className="btn-primary" onClick={() => handleRemoveFriend(friend.id)}>Remove</button>
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
          <button className="btn-primary" type="submit">Search</button>
        </form>

        <div className="search-results">
          {searchResults.map((result) => (
            <div key={result.id} className="search-item">
              <img src={getPlayerAvatar(result)} alt={result.name} />
              <span>{result.name} (Rating: {result.rating})</span>
              <button className="btn-primary" onClick={() => handleAddFriend(result.id)}>Add Friend</button>
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
                <button className="btn-primary" onClick={() => handleAcceptRequest(req.id)}>Accept</button>
                <button className="btn-primary" onClick={() => handleRejectRequest(req.id)}>Reject</button>
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
