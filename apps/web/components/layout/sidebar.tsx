'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/auth-context';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/events/create', label: 'Create Event', icon: '➕' },
  { href: '/events/join', label: 'Join Event', icon: '🔗' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-xl font-bold">
          PollCast
        </Link>
      </div>

      <nav className="space-y-1 p-4">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <span
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-secondary text-secondary-foreground'
                  : 'hover:bg-secondary/50'
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t p-4">
        <div className="mb-3 text-sm">
          <p className="font-medium">{user?.name}</p>
          <p className="text-muted-foreground">{user?.role}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={logout}>
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
