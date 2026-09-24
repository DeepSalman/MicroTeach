import React, { useState, useEffect } from 'react';
import { fetchWalletBalance, fetchTransactions, topUpWallet } from './api';
import './WalletModal.css';

const WalletModal = ({ isOpen, onClose, user, onBalanceUpdate }) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      loadWalletData();
    }
  }, [isOpen, user]);

  const loadWalletData = async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        fetchWalletBalance(user.user_id),
        fetchTransactions(user.user_id)
      ]);
      setBalance(balRes.data.balance || 0);
      setTransactions(txRes.data || []);
    } catch (error) {
      console.error('Failed to load wallet:', error);
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) return;

    setLoading(true);
    setMessage('');
    try {
      const res = await topUpWallet({ user_id: user.user_id, amount });
      setBalance(res.data.balance);
      setTopUpAmount('');
      setMessage(`৳${amount} added successfully!`);
      await loadWalletData();
      if (onBalanceUpdate) onBalanceUpdate(res.data.balance);
    } catch (error) {
      setMessage('Failed to top up. Please try again.');
    }
    setLoading(false);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'top_up': return '💳';
      case 'bounty_payment': return '📤';
      case 'bounty_received': return '📥';
      case 'refund': return '🔄';
      default: return '📝';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'top_up': return 'Top Up';
      case 'bounty_payment': return 'Bounty Paid';
      case 'bounty_received': return 'Bounty Received';
      case 'refund': return 'Refund';
      default: return type;
    }
  };

  const getAmountColor = (type) => {
    if (type === 'top_up' || type === 'bounty_received' || type === 'refund') return 'wallet-tx-positive';
    return 'wallet-tx-negative';
  };

  if (!isOpen) return null;

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wallet-modal-header">
          <h2>Wallet</h2>
          <button className="wallet-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="wallet-balance-section">
          <span className="wallet-balance-label">Current Balance</span>
          <span className="wallet-balance-amount">৳{Number(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        <form className="wallet-topup-form" onSubmit={handleTopUp}>
          <div className="wallet-topup-row">
            <input
              type="number"
              placeholder="Enter amount"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              min="1"
              step="any"
              className="wallet-topup-input"
              disabled={loading}
            />
            <button type="submit" className="wallet-topup-btn" disabled={loading || !topUpAmount}>
              {loading ? '...' : 'Top Up'}
            </button>
          </div>
          {message && <div className={`wallet-message ${message.includes('Failed') ? 'wallet-message-error' : ''}`}>{message}</div>}
        </form>

        <div className="wallet-transactions">
          <h3>Transaction History</h3>
          {transactions.length === 0 ? (
            <p className="wallet-empty">No transactions yet.</p>
          ) : (
            <div className="wallet-tx-list">
              {transactions.map((tx) => (
                <div key={tx.transaction_id} className="wallet-tx-item">
                  <span className="wallet-tx-icon">{getTypeIcon(tx.type)}</span>
                  <div className="wallet-tx-details">
                    <span className="wallet-tx-type">{getTypeLabel(tx.type)}</span>
                    <span className="wallet-tx-desc">{tx.description}</span>
                    <span className="wallet-tx-date">{new Date(tx.created_at).toLocaleString()}</span>
                  </div>
                  <div className="wallet-tx-right">
                    <span className={`wallet-tx-amount ${getAmountColor(tx.type)}`}>
                      {tx.type === 'top_up' || tx.type === 'bounty_received' || tx.type === 'refund' ? '+' : '-'}৳{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="wallet-tx-balance">Bal: ৳{Number(tx.balance_after).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
