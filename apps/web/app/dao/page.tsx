import { Suspense } from 'react';
import type { Metadata } from 'next';

import { DaoConsole } from '@/components/keepra/DaoConsole';

export const metadata: Metadata = {
  title: 'DAO release console — Keepra',
  description: 'Create a DAO and vote a Keepra vault open.',
};

export default function DaoPage() {
  return (
    <Suspense fallback={null}>
      <DaoConsole />
    </Suspense>
  );
}
