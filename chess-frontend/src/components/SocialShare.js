// Social sharing component with support for multiple platforms
import React, { useState } from 'react';
import {
  getWhatsAppShareUrl,
  getFacebookShareUrl,
  getTwitterShareUrl,
  getTelegramShareUrl,
  getEmailShareUrl,
  copyToClipboard,
  openNativeShare,
  shareToInstagram
} from '../utils/socialShareUtils';
import './SocialShare.css';

const SocialShare = ({
  url = '',
  title = 'Chess Web',
  text = '',
  hashtags = ['chess', 'chessweb'],
  showLabel = true,
  platforms = ['whatsapp', 'facebook', 'twitter', 'telegram', 'instagram', 'copy'],
  onShare = null, // Callback when share is clicked
  className = '',
  customImageShareHandler = null // Custom handler for sharing images with end card
}) => {
  const [copied, setCopied] = useState(false);
  const [instagramMessage, setInstagramMessage] = useState('');

  const handleCopyLink = async () => {
    const success = await copyToClipboard(url || window.location.href);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShare?.('copy');
    }
  };

  const handleNativeShare = async () => {
    const shareData = {
      title,
      text,
      url
    };
    const success = await openNativeShare(shareData);
    if (success) {
      onShare?.('native');
    }
  };

  const handleInstagramShare = async () => {
    const message = url || text;
    const result = await shareToInstagram(message);
    setInstagramMessage(result.message);
    setTimeout(() => setInstagramMessage(''), 3000);
    if (result.success) {
      onShare?.('instagram');
    }
  };

  const handleSocialClick = async (platform, shareUrl) => {
    console.log(`Sharing to ${platform}:`, shareUrl);
    console.log(`Text being shared:`, text);
    console.log(`URL being shared:`, url);

    // Special handling for WhatsApp to try Web Share API first (for image sharing)
    if (platform === 'whatsapp' && navigator.share && navigator.canShare) {
      try {
        // Try to share using Web Share API for better experience
        const shareData = {
          title: title,
          text: text,
          url: url
        };

        // Check if we can share files (for future image sharing support)
        if (shareData.files && navigator.canShare({ files: shareData.files })) {
          await navigator.share(shareData);
        } else {
          await navigator.share(shareData);
        }

        onShare?.(platform);
        return; // Success, exit early
      } catch (shareError) {
        if (shareError.name !== 'AbortError') {
          console.log('Web Share API failed for WhatsApp, falling back to URL method:', shareError);
        } else {
          return; // User cancelled, exit
        }
      }
    }

    // Fallback: Use URL-based sharing
    const windowWidth = platform === 'whatsapp' ? 800 : 600;
    const windowHeight = platform === 'whatsapp' ? 700 : 400;

    window.open(shareUrl, '_blank', `width=${windowWidth},height=${windowHeight}`);
    onShare?.(platform);
  };

  const shareButtons = {
    whatsapp: {
      icon: '📱',
      label: 'WhatsApp',
      color: '#25D366',
      url: getWhatsAppShareUrl(text, url),
      available: true,
      onClick: customImageShareHandler ? () => customImageShareHandler('whatsapp') : null,
      isCustom: !!customImageShareHandler
    },
    facebook: {
      icon: '👥',
      label: 'Facebook',
      color: '#1877F2',
      url: getFacebookShareUrl(url || window.location.href),
      available: !!url,
      onClick: customImageShareHandler ? () => customImageShareHandler('facebook') : null,
      isCustom: !!customImageShareHandler
    },
    twitter: {
      icon: '🐦',
      label: 'X',
      color: '#000000',
      url: getTwitterShareUrl(text, url, hashtags),
      available: true,
      onClick: customImageShareHandler ? () => customImageShareHandler('twitter') : null,
      isCustom: !!customImageShareHandler
    },
    telegram: {
      icon: '✈️',
      label: 'Telegram',
      color: '#0088cc',
      url: getTelegramShareUrl(text, url),
      available: true,
      onClick: customImageShareHandler ? () => customImageShareHandler('telegram') : null,
      isCustom: !!customImageShareHandler
    },
    instagram: {
      icon: '📷',
      label: 'Instagram',
      color: '#E4405F',
      onClick: handleInstagramShare,
      available: true,
      isCustom: true
    },
    email: {
      icon: '✉️',
      label: 'Email',
      color: '#EA4335',
      url: getEmailShareUrl(title, `${text}\n\n${url}`),
      available: true
    },
    copy: {
      icon: copied ? '✅' : '🔗',
      label: copied ? 'Copied!' : 'Copy Link',
      color: '#6B7280',
      onClick: handleCopyLink,
      available: true,
      isCustom: true
    }
  };

  // Check if Web Share API is available
  const hasNativeShare = navigator.share !== undefined;

  return (
    <div className={`social-share ${className}`}>
      {showLabel && <div className="social-share-label">Share:</div>}
      <div className="social-share-buttons">
        {/* Native share button (mobile) */}
        {hasNativeShare && (
          <button
            className="social-share-btn native-share"
            onClick={handleNativeShare}
            title="Share"
            style={{ backgroundColor: '#007AFF' }}
          >
            <span className="social-icon">📤</span>
            {showLabel && <span className="social-label">Share</span>}
          </button>
        )}

        {/* Platform-specific buttons */}
        {platforms.map(platform => {
          const button = shareButtons[platform];
          if (!button || !button.available) return null;

          if (button.isCustom) {
            return (
              <button
                key={platform}
                className={`social-share-btn ${platform}-btn ${copied && platform === 'copy' ? 'copied' : ''}`}
                onClick={button.onClick}
                title={button.label}
                style={{ backgroundColor: button.color }}
              >
                <span className="social-icon">{button.icon}</span>
                {showLabel && <span className="social-label">{button.label}</span>}
              </button>
            );
          }

          return (
            <button
              key={platform}
              className={`social-share-btn ${platform}-btn`}
              onClick={() => handleSocialClick(platform, button.url)}
              title={button.label}
              style={{ backgroundColor: button.color }}
            >
              <span className="social-icon">{button.icon}</span>
              {showLabel && <span className="social-label">{button.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Instagram message */}
      {instagramMessage && (
        <div className="instagram-message">
          {instagramMessage}
        </div>
      )}
    </div>
  );
};

export default SocialShare;