'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

const joinSchema = z.object({
  code: z.string().min(1, 'Join code is required'),
  password: z.string().optional(),
});

type JoinForm = z.infer<typeof joinSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function JoinEventPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<JoinForm>({
    resolver: zodResolver(joinSchema),
  });

  const onSubmit = async (data: JoinForm) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/events/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: data.code.toUpperCase(),
          password: data.password || undefined,
        }),
      });

      const json = await res.json();

      if (res.status === 403 && json.message?.includes('password')) {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(json.message || 'Failed to join event');

      router.push(`/event/${data.code.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join Event</CardTitle>
          <CardDescription>Enter the event code shared by the host.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Event Code</Label>
              <Input
                id="code"
                placeholder="e.g. ABC12345"
                className="text-center text-lg font-mono uppercase tracking-widest"
                {...register('code')}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  register('code').onChange(e);
                }}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>
            {needsPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Event Password</Label>
                <Input id="password" type="password" {...register('password')} />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Joining...' : 'Join Event'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
