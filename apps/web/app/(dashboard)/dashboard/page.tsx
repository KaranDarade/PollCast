'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatCount } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface EventSummary {
  id: string;
  title: string;
  code: string;
  status: string;
  createdAt: string;
  _count: { polls: number; accessList: number; questions: number };
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  SCHEDULED: 'outline',
  ENDED: 'destructive',
};

export default function DashboardPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    fetch(`${API_URL}/events/my`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEvents(data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Total Events', value: events.length, icon: '📋', gradient: 'from-primary/20 via-primary/10 to-transparent' },
    { label: 'Active Events', value: events.filter((e) => e.status === 'ACTIVE').length, icon: '🔴', gradient: 'from-success/20 via-success/10 to-transparent' },
    { label: 'Total Participants', value: events.reduce((s, e) => s + e._count.accessList, 0), icon: '👥', gradient: 'from-secondary/20 via-secondary/10 to-transparent' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage your events and view analytics.</p>
        </div>
        <Link href="/events/create">
          <Button className="rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25">
            Create Event
          </Button>
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <Card className="glass overflow-hidden rounded-2xl border-0 shadow-lg shadow-black/5">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} pointer-events-none`} />
              <CardHeader className="relative pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span className="text-lg">{stat.icon}</span>
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <p className="text-4xl font-bold tracking-tight">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Your Events</h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardContent className="flex flex-col items-center py-20 text-center">
              <span className="mb-4 text-5xl">📊</span>
              <p className="mb-2 text-lg font-medium">No events yet</p>
              <p className="mb-6 text-sm text-muted-foreground">Create your first event to get started.</p>
              <Link href="/events/create">
                <Button size="lg" className="rounded-full bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/25">
                  Create Event
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Link href={`/events/${event.id}`}>
                  <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
                    <CardContent className="py-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold truncate">{event.title}</h3>
                            <Badge variant={statusColors[event.status] || 'secondary'} className="shrink-0">
                              {event.status}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-mono tracking-wider">Code: {event.code}</span>
                            <span>Created: {formatDate(event.createdAt)}</span>
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{event._count.polls} polls</span>
                            <span>&middot;</span>
                            <span>{formatCount(event._count.accessList)} participants</span>
                            <span>&middot;</span>
                            <span>{event._count.questions} questions</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
