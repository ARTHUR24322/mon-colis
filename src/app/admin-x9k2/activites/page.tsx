'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/utils/adminAuth';
import AdminActivitiesView from '@/components/admin/AdminActivitiesView';

export default function AdminActivitiesPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/admin-x9k2');
    }
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020202',
      padding: '2rem',
      color: 'white',
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <AdminActivitiesView onBack={() => router.push('/admin-x9k2/dashboard')} />
    </div>
  );
}
