import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, type }) => {
  if (!isOpen) return null;

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`cm-header ${type === 'danger' ? 'cm-danger' : type === 'success' ? 'cm-success' : ''}`}>
          <span className="cm-icon">{type === 'danger' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
          <h3>{title}</h3>
        </div>
        <div className="cm-body">
          <p>{message}</p>
        </div>
        <div className="cm-actions">
          <button className="cm-btn cm-btn-cancel" onClick={onClose}>
            {cancelText || 'Cancel'}
          </button>
          <button
            className={`cm-btn cm-btn-confirm ${type === 'danger' ? 'cm-btn-danger' : type === 'success' ? 'cm-btn-success' : ''}`}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
