import React from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

const ICONS = {
  success: <FiCheckCircle className="toast-icon" />,
  error:   <FiAlertCircle className="toast-icon" />,
  info:    <FiInfo        className="toast-icon" />,
};

export const ToastContainer = ({ toasts, onDismiss }) => (
  <div className="toast-container" role="region" aria-label="Notifications">
    {toasts.map(t => (
      <div key={t.id} className={`toast ${t.type}`} role="alert">
        {ICONS[t.type] || ICONS.info}
        <span style={{ flex: 1, fontSize: 13 }}>{t.message}</span>
        <button className="toast-dismiss" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
          <FiX size={14} />
        </button>
      </div>
    ))}
  </div>
);
