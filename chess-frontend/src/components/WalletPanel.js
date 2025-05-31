
import React, { useState, useEffect } from 'react';
import { getTransactions } from '../services/walletService';
import CreditDisplay from './CreditDisplay';
import './WalletPanel.css';

const WalletPanel = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const data = await getTransactions();
        setTransactions(data.data);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const formatReason = (reason) => {
    return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="wallet-panel">
      <div className="wallet-header">
        <h3>Wallet</h3>
        <CreditDisplay size="large" />
      </div>

      <div className="recent-transactions">
        <h4>Recent Transactions</h4>
        {loading ? (
          <div className="loading">Loading transactions...</div>
        ) : transactions.length > 0 ? (
          <div className="transaction-list">
            {transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="transaction-item">
                <div className="transaction-info">
                  <span className="transaction-reason">
                    {formatReason(transaction.reason)}
                  </span>
                  {transaction.description && (
                    <span className="transaction-description">
                      {transaction.description}
                    </span>
                  )}
                </div>
                <div className="transaction-details">
                  <span className={`transaction-amount ${transaction.delta > 0 ? 'positive' : 'negative'}`}>
                    {transaction.delta > 0 ? '+' : ''}{transaction.delta}
                  </span>
                  <span className="transaction-date">
                    {formatDate(transaction.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-transactions">No transactions yet</div>
        )}
      </div>

      <div className="wallet-actions">
        <button className="btn-primary">Buy Credits</button>
        <button className="btn-secondary">Invite Friends</button>
      </div>
    </div>
  );
};

export default WalletPanel;
