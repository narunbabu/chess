import React, { useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './AvatarQuickEdit.css';

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

const AvatarQuickEdit = ({ currentAvatar, onSave, onCancel }) => {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [diceBearAvatars, setDiceBearAvatars] = useState(generateDiceBearAvatars);
  const [selectedDiceBear, setSelectedDiceBear] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [fileSizeInfo, setFileSizeInfo] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ unit: '%', width: 50, aspect: 1 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  const MAX_AVATAR_SIZE = 100 * 1024; // 100KB

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
      setSelectedDiceBear(null);
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

  const handleShuffleAvatars = () => {
    setDiceBearAvatars(generateDiceBearAvatars());
    setSelectedDiceBear(null);
  };

  const handleSelectDiceBear = (url) => {
    setSelectedDiceBear(url);
    setAvatarFile(null);
    setFileSizeInfo(null);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (avatarFile) {
        await onSave(avatarFile, null);
      } else if (selectedDiceBear) {
        await onSave(null, selectedDiceBear);
      } else {
        // No changes
        onCancel();
      }
    } finally {
      setLoading(false);
    }
  };

  const previewUrl = avatarFile
    ? URL.createObjectURL(avatarFile)
    : selectedDiceBear || currentAvatar;

  return (
    <div className="avatar-quick-edit">
      <h3>Change Avatar</h3>

      {/* Preview */}
      <div className="avatar-preview-large">
        <img src={previewUrl} alt="Preview" />
      </div>

      {/* Action Buttons */}
      <div className="avatar-edit-actions">
        <button
          type="button"
          className="avatar-edit-btn"
          onClick={() => setShowAvatarPicker(!showAvatarPicker)}
        >
          {showAvatarPicker ? 'Hide Avatars' : '🎭 Choose Avatar'}
        </button>
        <button
          type="button"
          className="avatar-edit-btn avatar-edit-btn-outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          📷 Upload Photo
        </button>
      </div>

      {avatarFile && fileSizeInfo && (
        <p className="avatar-size-info">New: {fileSizeInfo}</p>
      )}

      {/* Hidden file input */}
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

      {/* DiceBear Avatar Grid */}
      {showAvatarPicker && (
        <div className="avatar-picker-collapsible">
          <div className="avatar-picker-grid">
            {diceBearAvatars.map((avatar) => (
              <div
                key={avatar.seed}
                onClick={() => handleSelectDiceBear(avatar.url)}
                className={`avatar-picker-item ${selectedDiceBear === avatar.url ? 'selected' : ''}`}
              >
                <img src={avatar.url} alt={`Avatar ${avatar.style}`} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleShuffleAvatars}
            className="avatar-shuffle-btn"
          >
            🔀 Shuffle
          </button>
        </div>
      )}

      {/* Crop Modal */}
      {showCropper && selectedImage && (
        <div className="crop-modal-overlay">
          <div className="crop-modal-content">
            <h4>Crop Your Photo</h4>
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
                  style={{ maxWidth: '100%', maxHeight: '300px' }}
                />
              </ReactCrop>
            </div>
            <div className="crop-actions">
              <button onClick={handleCropCancel} className="crop-btn crop-btn-cancel">
                Cancel
              </button>
              <button
                onClick={handleCropConfirm}
                className="crop-btn crop-btn-confirm"
                disabled={!completedCrop}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save/Cancel */}
      <div className="avatar-edit-footer">
        <button
          onClick={onCancel}
          className="avatar-edit-footer-btn avatar-edit-footer-btn-cancel"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="avatar-edit-footer-btn avatar-edit-footer-btn-save"
          disabled={loading || (!avatarFile && !selectedDiceBear)}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default AvatarQuickEdit;
