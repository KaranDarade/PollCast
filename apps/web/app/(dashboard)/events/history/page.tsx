'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatCount } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface EventSummary {
  id: string;
  title: string;
  description: string | null;
  code: string;
  status: string;
  createdAt: string;
  joinedAt: string;
  host: { id: string; name: string; email: string };
  _count: { polls: number; accessList: number; questions: number };
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  SCHEDULED: 'outline',
  ENDED: 'destructive',
};

export default function EventHistoryPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    fetch(`${API_URL}/events/joined`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEvents(data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Event History</h1>
        <p className="mt-1 text-muted-foreground">Events you've joined as a participant.</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
          <CardContent className="flex flex-col items-center py-20 text-center">
            <span className="mb-4 text-5xl">🎫</span>
            <p className="mb-2 text-lg font-medium">No joined events yet</p>
            <p className="mb-6 text-sm text-muted-foreground">Join an event with a code to see it here.</p>
            <Link href="/events/join">
              <Button size="lg" className="rounded-full bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/25">
                Join an Event
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
              <Link href={`/event/${event.code}`}>
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
                        {event.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{event.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span>Host: {event.host.name}</span>
                          <span className="font-mono tracking-wider">Code: {event.code}</span>
                          <span>Joined: {formatDate(event.joinedAt)}</span>
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
    </motion.div>
  );
}
