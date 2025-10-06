import React from 'react';

/**
 * LobbyTabs - Generic tab container component
 * Pure UI component with no business logic
 *
 * @param {string} activeTab - Currently active tab identifier
 * @param {function} onTabChange - Callback when tab is changed
 * @param {array} tabs - Array of tab objects with { id, label, badge }
 */
const LobbyTabs = ({ activeTab, onTabChange, tabs }) => {
  return (
    <>
      <div className="lobby-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
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
