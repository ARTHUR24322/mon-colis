'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import styles from './CommuneSelect.module.css';
import { COMMUNES_KINSHASA } from '@/lib/constants';

interface CommuneSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const ITEM_HEIGHT = 60;

export default function CommuneSelect({ value, onChange }: CommuneSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tempValue, setTempValue] = useState(value || COMMUNES_KINSHASA[0]);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filteredCommunes = useMemo(() => {
    if (!search) return COMMUNES_KINSHASA;
    return COMMUNES_KINSHASA.filter(c =>
      c.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Sync scroll position when opening or when filtered list changes
  useEffect(() => {
    if (isOpen && listRef.current) {
      const index = filteredCommunes.indexOf(tempValue as typeof COMMUNES_KINSHASA[number]);
      if (index !== -1) {
        // Use timeout to allow rendering before scroll
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.scrollTo({
              top: index * ITEM_HEIGHT,
              behavior: 'smooth'
            });
          }
        }, 50);
      } else if (filteredCommunes.length > 0) {
        setTempValue(filteredCommunes[0]);
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.scrollTo({ top: 0 });
          }
        }, 50);
      }
    }
  }, [isOpen, filteredCommunes]);

  const handleScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const index = Math.max(0, Math.min(filteredCommunes.length - 1, Math.round(scrollTop / ITEM_HEIGHT)));
    if (filteredCommunes[index] && filteredCommunes[index] !== tempValue) {
      setTempValue(filteredCommunes[index]);
    }
  };

  const handleSelect = (commune: string, index: number) => {
    setTempValue(commune);
    if (listRef.current) {
      listRef.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: 'smooth'
      });
    }
  };

  const handleConfirm = () => {
    onChange(tempValue);
    setIsOpen(false);
  };

  const hasResults = filteredCommunes.length > 0;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) {
            setSearch('');
            setTempValue(value || COMMUNES_KINSHASA[0]);
          }
          setIsOpen(!isOpen);
        }}
      >
        <div>
          <b>{value || "Sélectionnez une commune"}</b>
          <small>Kinshasa, RDC</small>
        </div>
        <ChevronDown size={20} />
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <input
            type="text"
            className={styles.search}
            placeholder="Rechercher une commune..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <div className={`${styles.wheel} ${!hasResults ? styles.none : ''}`}>
            <div className={styles.band}></div>
            <ul 
              className={styles.list} 
              ref={listRef}
              onScroll={handleScroll}
            >
              {filteredCommunes.map((commune, i) => (
                <li
                  key={commune}
                  className={tempValue === commune ? styles.on : ''}
                  onClick={() => handleSelect(commune, i)}
                >
                  {commune}
                  <small>Kinshasa</small>
                </li>
              ))}
            </ul>
            <div className={styles.empty}>
              Aucune commune trouvée
            </div>
          </div>

          <button
            type="button"
            className={styles.ok}
            onClick={handleConfirm}
            disabled={!hasResults}
          >
            Valider la commune
          </button>
        </div>
      )}
    </div>
  );
}
