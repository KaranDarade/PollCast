'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface EventDetail {
  id: string;
  title: string;
  description: string;
  code: string;
  status: string;
  createdAt: string;
  host: { id: string; name: string; email: string };
  _count: { polls: number; questions: number; accessList: number };
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    fetch(`${API_URL}/events/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setEvent(data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const copyCode = () => {
    if (event) {
      navigator.clipboard.writeText(event.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-96" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (!event) {
    return <p>Event not found</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
          {event.description && (
            <p className="mt-1 text-muted-foreground">{event.description}</p>
          )}
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span>Host: {event.host.name}</span>
            <span>Created: {formatDate(event.createdAt)}</span>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {event.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/events/join`)}>
            Switch View
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Join Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="rounded-md bg-secondary px-3 py-1 text-lg font-mono font-bold tracking-widest">
                {event.code}
              </code>
              <Button variant="outline" size="sm" onClick={copyCode}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{event._count.accessList}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Polls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{event._count.polls}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button onClick={() => router.push(`/polls/create?eventId=${event.id}`)}>
          Create Poll
        </Button>
        <Button variant="outline" onClick={() => router.push(`/analytics/${event.id}`)}>
          View Analytics
        </Button>
      </div>
    </div>
  );
}
