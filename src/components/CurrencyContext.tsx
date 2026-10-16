"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';

type CurrencyMode = 'USD' | 'CDF';

interface CurrencyContextType {
  currency: CurrencyMode;
  exchangeRate: number;
  toggleCurrency: () => void;
  setCurrency: (mode: CurrencyMode) => void;
  formatPrice: (priceInUsd: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyMode>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(2800);

  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem('moncolis_currency') as CurrencyMode;
    if (saved && (saved === 'USD' || saved === 'CDF')) {
      setCurrencyState(saved);
    }

    // Fetch exchange rate from DB (silently falls back to 2800 if table doesn't exist yet)
    const fetchRate = async () => {
      // Don't attempt to fetch if the Supabase URL is the dummy placeholder to avoid 'Failed to fetch' errors in dev overlay
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('xxxxxxxxxxxx')) {
        return;
      }

      try {
        const res = await supabase
          .from('system_settings')
          .select('exchange_rate')
          .eq('id', 'global')
          .single();
        if (res?.data && !res?.error) {
          setExchangeRate(res.data.exchange_rate || 2800);
        }
      } catch {
        // Table may not exist yet or network error — use default rate
      }
    };
    fetchRate();
  }, []);

  const setCurrency = (mode: CurrencyMode) => {
    setCurrencyState(mode);
    localStorage.setItem('moncolis_currency', mode);
  };

  const toggleCurrency = () => {
    setCurrency(currency === 'USD' ? 'CDF' : 'USD');
  };

  const formatPrice = (priceInUsd: number) => {
    if (currency === 'USD') {
      return `$${priceInUsd.toFixed(2)}`;
    } else {
      const priceInCdf = priceInUsd * exchangeRate;
      return `${priceInCdf.toLocaleString('fr-FR')} Fc`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, exchangeRate, toggleCurrency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
