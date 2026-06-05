import { ExternalLink } from 'lucide-react';
import { truncateId } from '@/lib/keepra/format';
import { cn } from '@/lib/utils';

export function ExplorerLink({
  id,
  label,
  className,
}: {
  id: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`https://suiscan.xyz/testnet/object/${id}`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-primary transition-colors',
        className,
      )}
    >
      {label ?? truncateId(id)}
      <ExternalLink className="size-3" />
    </a>
  );
}
