import React, { useEffect, useRef } from 'react';

/**
 * LobbyTabs - Generic tab container component
 * Pure UI component with auto-centering functionality
 *
 * @param {string} activeTab - Currently active tab identifier
 * @param {function} onTabChange - Callback when tab is changed
 * @param {array} tabs - Array of tab objects with { id, label, badge }
 */
const LobbyTabs = ({ activeTab, onTabChange, tabs }) => {
  const tabsRef = useRef(null);

  // Auto-center active tab when it changes or component mounts
  useEffect(() => {
    if (tabsRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        const activeTabElement = tabsRef.current.querySelector('.tab-button.active');
        if (activeTabElement) {
          activeTabElement.scrollIntoView({
            inline: 'center',
            behavior: 'smooth',
            block: 'nearest'
          });
        }
      });
    }
  }, [activeTab]); // Re-run when activeTab changes

  const handleTabClick = (tabId) => {
    onTabChange(tabId);
  };

  return (
    <>
      <div className="lobby-tabs" ref={tabsRef}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            aria-label={`${tab.label}${tab.badge ? ` (${tab.badge})` : ''}`}
            title={tab.label}
          >
            <span className="tab-ico" aria-hidden="true">{tab.icon}</span>
            <span className="tab-text-full">{tab.label}</span>
            <span className="tab-text-short">{tab.short}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="tab-badge">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
};

export default LobbyTabs;
