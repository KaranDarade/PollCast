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

export default function JoinEventPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Please enter an event code'); return; }

    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch(`${API_URL}/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.toUpperCase().trim(), password: password || undefined }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Joined event!', variant: 'success' });
        router.push(`/event/${code.toUpperCase().trim()}`);
      } else {
        setError(data.message || 'Failed to join event');
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
      className="mx-auto max-w-md"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Join Event</h1>
        <p className="mt-1 text-muted-foreground">Enter the event code to join.</p>
      </div>

      <Card className="glass rounded-2xl border-0 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-white/10 pb-4">
          <CardTitle>Event Code</CardTitle>
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
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="e.g. ABC12345"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={8}
                className="h-12 rounded-xl text-center font-mono text-lg tracking-widest uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password (if required)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Event password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </CardContent>

          <CardFooter className="border-t border-white/10 pt-4">
            <Button
              type="submit"
              className="w-full rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25 transition-all duration-300"
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join Event'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}
