import { ClaimView } from '@/components/keepra/ClaimView';

export default async function ClaimPage({ params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  return <ClaimView vaultId={vaultId} />;
}
