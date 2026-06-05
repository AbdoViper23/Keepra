import { VaultDetailView } from '@/components/keepra/VaultDetailView';

export default async function VaultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VaultDetailView id={id} />;
}
