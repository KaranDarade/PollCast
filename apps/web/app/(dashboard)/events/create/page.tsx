'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.length < 3) { setError('Title must be at least 3 characters'); return; }

    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          description: description || undefined,
          maxParticipants: maxParticipants ? parseInt(maxParticipants) : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Event created!', variant: 'success' });
        router.push(`/events/${data.data.id}`);
      } else {
        setError(data.message || 'Failed to create event');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create Event</h1>
        <p className="mt-1 text-muted-foreground">Set up a new event for your audience to join.</p>
      </div>

      <Card className="glass rounded-2xl border-0 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-white/10 pb-4">
          <CardTitle>Event Details</CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 pt-6">
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                placeholder="My Awesome Event"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={4}
                className="flex w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Tell your audience what this event is about..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxParticipants">Max Participants</Label>
              <Input
                id="maxParticipants"
                type="number"
                placeholder="Unlimited"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Leave empty for unlimited participants.</p>
            </div>
          </CardContent>

          <CardFooter className="border-t border-white/10 pt-4">
            <Button
              type="submit"
              className="rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25 transition-all duration-300"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Event'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}
