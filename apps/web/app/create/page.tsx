import type { Metadata } from 'next';

import { CreateWizard } from '@/components/keepra/CreateWizard';

export const metadata: Metadata = {
  title: 'Create a vault — Keepra',
  description:
    'Seal a message, keys, or files into a programmable on-chain vault that releases only when your conditions are met.',
};

export default function CreatePage() {
  return <CreateWizard />;
}
