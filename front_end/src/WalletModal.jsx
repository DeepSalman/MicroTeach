import React, { useState, useEffect } from 'react';
import { fetchWalletBalance, fetchTransactions, topUpWallet } from './api';
import './WalletModal.css';

const PRESET_AMOUNTS = [200, 500, 1000, 2000];

const WalletModal = ({ isOpen, onClose, user, initialBalance, onBalanceUpdate }) => {
  const [balance, setBalance] = useState(() => {
    if (initialBalance !== undefined && initialBalance !== null && !isNaN(Number(initialBalance))) {
      return Number(initialBalance);
    }
    if (user?.wallet_balance !== undefined && user?.wallet_balance !== null && !isNaN(Number(user.wallet_balance))) {
      return Number(user.wallet_balance);
    }
    return 0;
  });
  const [transactions, setTransactions] = useState([]);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialBalance !== undefined && initialBalance !== null && !isNaN(Number(initialBalance))) {
      setBalance(Number(initialBalance));
    } else if (user?.wallet_balance !== undefined && user?.wallet_balance !== null && !isNaN(Number(user.wallet_balance))) {
      setBalance(Number(user.wallet_balance));
    }
  }, [initialBalance, user?.wallet_balance, isOpen]);

  useEffect(() => {
    if (isOpen && user) {
      loadWalletData();
    }
  }, [isOpen, user]);

  const loadWalletData = async () => {
    const userId = user?.user_id || user?.id;
    if (!userId) return;

    try {
      const balRes = await fetchWalletBalance(userId);
      const rawBal = balRes.data?.balance;
      if (rawBal !== undefined && rawBal !== null) {
        const parsed = Number(rawBal);
        if (!isNaN(parsed)) {
          setBalance(parsed);
          if (onBalanceUpdate) onBalanceUpdate(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load wallet balance:', error);
    }

    try {
      const txRes = await fetchTransactions(userId);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
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
      setMessage(`৳${Number(amount).toLocaleString('en-IN')} added successfully!`);
      await loadWalletData();
      if (onBalanceUpdate) onBalanceUpdate(res.data.balance);
    } catch (error) {
      setMessage('Failed to process top up. Please try again.');
    }
    setLoading(false);
  };

  const renderTransactionIcon = (type) => {
    switch (type) {
      case 'top_up':
        return (
          <div className="tx-icon-bubble tx-inflow" title="Wallet Deposit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </div>
        );
      case 'bounty_received':
        return (
          <div className="tx-icon-bubble tx-inflow" title="Tutor Earnings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </div>
        );
      case 'bounty_payment':
        return (
          <div className="tx-icon-bubble tx-outflow" title="Bounty Escrow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
          </div>
        );
      case 'refund':
        return (
          <div className="tx-icon-bubble tx-refund" title="Escrow Refund">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </div>
        );
      default:
        return (
          <div className="tx-icon-bubble tx-default" title="Transaction">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
          </div>
        );
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'top_up': return 'Wallet Deposit';
      case 'bounty_payment': return 'Bounty Escrow';
      case 'bounty_received': return 'Tutor Earnings';
      case 'refund': return 'Escrow Refund';
      default: return type ? type.replace(/_/g, ' ') : 'Transaction';
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  const displayBalance = (() => {
    if (balance !== undefined && balance !== null && !isNaN(Number(balance))) {
      return Number(balance);
    }
    if (initialBalance !== undefined && initialBalance !== null && !isNaN(Number(initialBalance))) {
      return Number(initialBalance);
    }
    if (user?.wallet_balance !== undefined && user?.wallet_balance !== null && !isNaN(Number(user.wallet_balance))) {
      return Number(user.wallet_balance);
    }
    return 0;
  })();

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wallet-modal-header">
          <div className="wallet-header-info">
            <h2>Wallet</h2>
            <span className="wallet-status-chip">
              <span className="wallet-status-dot"></span>
              Escrow Active
            </span>
          </div>
          <button className="wallet-modal-close" onClick={onClose} aria-label="Close wallet">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Clean Minimal Balance Box */}
        <div className="wallet-balance-box">
          <span className="wallet-balance-label">Available Balance</span>
          <div className="wallet-balance-amount">
            <span className="wallet-balance-currency">৳</span>
            <span className="wallet-balance-value">
              {displayBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Top Up Form */}
        <div className="wallet-topup-section">
          <div className="wallet-section-header">
            <h3>Add Funds</h3>
            <span className="wallet-section-sub">Quick top up to fund student bounties</span>
          </div>

          {/* Quick preset chips */}
          <div className="wallet-presets">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                className={`wallet-preset-btn ${parseFloat(topUpAmount) === amt ? 'active' : ''}`}
                onClick={() => setTopUpAmount(String(amt))}
              >
                +৳{amt}
              </button>
            ))}
          </div>

          <form className="wallet-topup-form" onSubmit={handleTopUp}>
            <div className="wallet-topup-row">
              <div className="wallet-input-wrapper">
                <span className="wallet-input-prefix">৳</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  min="1"
                  step="any"
                  className="wallet-topup-input"
                  disabled={loading}
                />
                {topUpAmount && (
                  <button
                    type="button"
                    className="wallet-input-clear"
                    onClick={() => setTopUpAmount('')}
                    aria-label="Clear amount"
                  >
                    &times;
                  </button>
                )}
              </div>
              <button type="submit" className="wallet-topup-btn" disabled={loading || !topUpAmount}>
                {loading ? (
                  <span className="wallet-btn-loader"></span>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Top Up
                  </>
                )}
              </button>
            </div>
            {message && (
              <div className={`wallet-message ${message.includes('Failed') ? 'wallet-message-error' : 'wallet-message-success'}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {message.includes('Failed') ? (
                    <>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </>
                  ) : (
                    <>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </>
                  )}
                </svg>
                <span>{message}</span>
              </div>
            )}
          </form>
        </div>

        {/* Transaction History */}
        <div className="wallet-transactions">
          <div className="wallet-transactions-header">
            <h3>Recent Activity</h3>
            {transactions.length > 0 && <span className="wallet-tx-count">{transactions.length} items</span>}
          </div>

          {transactions.length === 0 ? (
            <div className="wallet-empty-state">
              <div className="wallet-empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              </div>
              <p className="wallet-empty-title">No transactions yet</p>
              <p className="wallet-empty-sub">Your deposits and bounty transactions will appear here.</p>
            </div>
          ) : (
            <div className="wallet-tx-list">
              {transactions.map((tx) => {
                const isPositive = tx.type === 'top_up' || tx.type === 'bounty_received' || tx.type === 'refund';
                return (
                  <div key={tx.transaction_id} className="wallet-tx-item">
                    {renderTransactionIcon(tx.type)}
                    <div className="wallet-tx-details">
                      <div className="wallet-tx-top-row">
                        <span className="wallet-tx-type">{getTypeLabel(tx.type)}</span>
                        <span className={`wallet-tx-amount ${isPositive ? 'tx-positive' : 'tx-negative'}`}>
                          {isPositive ? '+' : '-'}৳{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="wallet-tx-bottom-row">
                        <span className="wallet-tx-desc">{tx.description}</span>
                        <span className="wallet-tx-date">{formatDate(tx.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
