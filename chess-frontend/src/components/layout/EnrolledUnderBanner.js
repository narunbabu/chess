import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'chess99_enrolled_under';
const DISMISS_KEY = 'chess99_enrolled_under_dismissed';

const EnrolledUnderBanner = () => {
  const [referrerName, setReferrerName] = useState(null);

  useEffect(() => {
    const name = localStorage.getItem(STORAGE_KEY);
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (name && !dismissed) setReferrerName(name);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setReferrerName(null);
  };

  if (!referrerName) return null;

  return (
    <div className="bg-[#81b64c]/15 border-b border-[#81b64c]/40 text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="text-[#d8f0c0]">
          🎉 You're enrolled under <b className="text-white">{referrerName}</b>. Welcome to Chess99!
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-[#9b9895] hover:text-white text-lg leading-none px-2"
        >×</button>
      </div>
    </div>
  );
};

export default EnrolledUnderBanner;
