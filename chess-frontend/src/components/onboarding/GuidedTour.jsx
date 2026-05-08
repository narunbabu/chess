import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './GuidedTour.css';

const getTargetRect = (selector) => {
  if (!selector || typeof document === 'undefined') return null;
  const candidates = Array.from(document.querySelectorAll(selector));
  const element = candidates.find(candidate => {
    const rect = candidate.getBoundingClientRect();
    const style = window.getComputedStyle(candidate);
    return rect.width > 0
      && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.opacity !== '0';
  });
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return {
    top: Math.max(12, rect.top - 8),
    left: Math.max(12, rect.left - 8),
    width: rect.width + 16,
    height: rect.height + 16,
  };
};

const GuidedTour = ({
  steps,
  isOpen,
  onClose,
  storageKey,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const activeStep = steps[activeIndex];

  const updateTarget = useCallback(() => {
    setTargetRect(getTargetRect(activeStep?.target));
  }, [activeStep]);

  useEffect(() => {
    if (!isOpen) return undefined;

    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);

    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [isOpen, updateTarget]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(updateTarget, 80);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isOpen, updateTarget]);

  const finishTour = useCallback(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, 'completed');
    }
    onClose?.();
    setActiveIndex(0);
  }, [onClose, storageKey]);

  const tooltipStyle = useMemo(() => {
    const isMobile = window.innerWidth <= 560;
    if (isMobile) {
      return {
        left: '50%',
        top: '50%',
        width: 'calc(100vw - 32px)',
        transform: 'translate(-50%, -50%)',
      };
    }

    if (!targetRect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const tooltipWidth = Math.min(380, window.innerWidth - 32);
    const placeBelow = targetRect.top + targetRect.height + 20 + 260 < window.innerHeight;
    const top = placeBelow
      ? targetRect.top + targetRect.height + 18
      : Math.max(18, targetRect.top - 278);
    const left = Math.min(
      Math.max(16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2),
      window.innerWidth - tooltipWidth - 16
    );

    return {
      width: tooltipWidth,
      left,
      top,
    };
  }, [targetRect]);

  if (!isOpen || !activeStep) return null;

  const isLast = activeIndex === steps.length - 1;
  const cursorStyle = targetRect
    ? {
        left: targetRect.left + targetRect.width * 0.72,
        top: targetRect.top + targetRect.height * 0.58,
      }
    : {
        left: '50%',
        top: '42%',
      };

  return (
    <div className="guided-tour" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
      <div className="guided-tour-scrim" />

      {targetRect && (
        <div
          className="guided-tour-spotlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}

      <div className="guided-tour-cursor" style={cursorStyle} aria-hidden="true" />

      <div className="guided-tour-card" style={tooltipStyle}>
        <div className="guided-tour-step">
          Step {activeIndex + 1} of {steps.length}
        </div>
        <h2 id="guided-tour-title">{activeStep.title}</h2>
        <p>{activeStep.description}</p>

        <div className="guided-tour-dots" aria-hidden="true">
          {steps.map((step, index) => (
            <span key={step.title} className={index === activeIndex ? 'active' : ''} />
          ))}
        </div>

        <div className="guided-tour-actions">
          <button type="button" className="secondary" onClick={finishTour}>
            Skip
          </button>
          <div>
            <button
              type="button"
              className="secondary"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex(index => Math.max(0, index - 1))}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  finishTour();
                  return;
                }
                setActiveIndex(index => index + 1);
              }}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
