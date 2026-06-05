import type { Metadata } from 'next';

import { DashboardView } from '@/components/keepra/DashboardView';

export const metadata: Metadata = {
  title: 'Your vaults — Keepra',
  description: 'Manage your sealed vaults, send heartbeats, and view release status.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
