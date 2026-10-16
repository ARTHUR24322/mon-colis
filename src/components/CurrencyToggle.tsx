"use client";

import React from 'react';
import { useCurrency } from './CurrencyContext';

export default function CurrencyToggle() {
  const { currency, toggleCurrency } = useCurrency();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '20px' }}>
      <button
        onClick={() => currency !== 'USD' && toggleCurrency()}
        style={{
          padding: '0.4rem 0.8rem',
          borderRadius: '16px',
          border: 'none',
          background: currency === 'USD' ? '#38bdf8' : 'transparent',
          color: currency === 'USD' ? '#000' : '#94a3b8',
          fontWeight: currency === 'USD' ? '700' : '500',
          fontSize: '0.8rem',
          cursor: currency === 'USD' ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        USD
      </button>
      <button
        onClick={() => currency !== 'CDF' && toggleCurrency()}
        style={{
          padding: '0.4rem 0.8rem',
          borderRadius: '16px',
          border: 'none',
          background: currency === 'CDF' ? '#38bdf8' : 'transparent',
          color: currency === 'CDF' ? '#000' : '#94a3b8',
          fontWeight: currency === 'CDF' ? '700' : '500',
          fontSize: '0.8rem',
          cursor: currency === 'CDF' ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        FC
      </button>
    </div>
  );
}
