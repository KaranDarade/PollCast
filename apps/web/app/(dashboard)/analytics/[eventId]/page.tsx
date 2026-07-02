'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatCount } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

interface PollSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  options: { id: string; text: string; voteCount: number }[];
}

interface EventDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  host: { name: string };
  _count: { polls: number; questions: number; accessList: number };
}

export default function AnalyticsPage() {
  const params = useParams();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!params.eventId) return;

    Promise.all([
      fetch(`${API_URL}/events/${params.eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/polls/event/${params.eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([eventData, pollsData]) => {
        if (eventData.success) setEvent(eventData.data);
        if (pollsData.success) setPolls(pollsData.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.eventId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!event) return <p>Event not found</p>;

  const totalVotes = polls.reduce((s, p) => s + p.options.reduce((o, v) => o + v.voteCount, 0), 0);
  const totalPolls = polls.length;
  const closedPolls = polls.filter((p) => p.status === 'CLOSED');

  // Poll engagement data
  const pollEngagement = polls.map((p) => ({
    name: p.title.length > 20 ? p.title.slice(0, 20) + '...' : p.title,
    votes: p.options.reduce((s, o) => s + o.voteCount, 0),
  }));

  // Poll option distribution (last closed poll)
  const lastPoll = closedPolls[closedPolls.length - 1];
  const pieData = lastPoll?.options.map((o) => ({
    name: o.text,
    value: o.voteCount,
  })) || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">{event.title}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCount(event._count.accessList)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Polls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalPolls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Votes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCount(totalVotes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCount(event._count.questions)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {pollEngagement.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Poll Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={pollEngagement}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="votes" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Last Poll Results</CardTitle>
              <p className="text-sm text-muted-foreground">{lastPoll?.title}</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {polls.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No poll data available yet. Create polls to see analytics.
          </CardContent>
        </Card>
      )}

      {polls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Poll History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {polls.map((poll) => {
                const total = poll.options.reduce((s, o) => s + o.voteCount, 0);
                return (
                  <div key={poll.id} className="border-b pb-4 last:border-0">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">{poll.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {total} votes &middot; {formatDate(poll.createdAt)}
                      </span>
                    </div>
                    {poll.options.map((opt) => {
                      const pct = total > 0 ? (opt.voteCount / total) * 100 : 0;
                      return (
                        <div key={opt.id} className="mb-1 flex items-center gap-2 text-sm">
                          <span className="w-40 truncate">{opt.text}</span>
                          <div className="flex-1 h-4 rounded bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-muted-foreground">
                            {opt.voteCount} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
