'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

const createPollSchema = z.object({
  title: z.string().min(3, 'Poll question is required').max(300),
  eventId: z.string().min(1, 'Please select an event'),
  isMultipleChoice: z.boolean().default(false),
  timerSeconds: z.coerce.number().int().positive().max(3600).optional().or(z.literal('')),
  options: z
    .array(z.object({ value: z.string().min(1, 'Option is required').max(300) }))
    .min(2, 'At least 2 options')
    .max(10, 'Maximum 10 options'),
});

type CreatePollForm = z.infer<typeof createPollSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function CreatePollPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl pt-20 text-center text-muted-foreground">Loading...</div>}>
      <CreatePollForm />
    </Suspense>
  );
}

function CreatePollForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get('eventId');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<CreatePollForm>({
    resolver: zodResolver(createPollSchema),
    defaultValues: {
      title: '',
      eventId: eventIdParam || '',
      isMultipleChoice: false,
      timerSeconds: undefined,
      options: [{ value: '' }, { value: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'options' });

  useEffect(() => {
    if (eventIdParam) {
      setValue('eventId', eventIdParam);
      return;
    }
    const token = localStorage.getItem('accessToken');
    fetch(`${API_URL}/events/my`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEvents(data.data || []);
      })
      .catch(console.error);
  }, [eventIdParam, setValue]);

  const onSubmit = async (data: CreatePollForm) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/polls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId: data.eventId,
          title: data.title,
          isMultipleChoice: data.isMultipleChoice,
          timerSeconds: data.timerSeconds ? Number(data.timerSeconds) : undefined,
          options: data.options.map((o) => o.value.trim()).filter(Boolean),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        const details = json.error?.details?.map((d: any) => d.message).join('; ');
        throw new Error(details || json.message || 'Failed to create poll');
      }

      toast({ title: 'Poll created!', variant: 'success' });
      router.push(`/events/${data.eventId}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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
        <h1 className="text-3xl font-bold tracking-tight">Create Poll</h1>
        <p className="mt-1 text-muted-foreground">Create a poll for your audience to vote on.</p>
      </div>

      <Card className="glass rounded-2xl border-0 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-white/10 pb-4">
          <CardTitle>Poll Details</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 pt-6">
            {!eventIdParam && events.length > 0 && (
              <div className="space-y-2">
                <Label>Event</Label>
                <select
                  {...register('eventId')}
                  className="flex h-11 w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select an event</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Poll Question *</Label>
              <Input
                id="title"
                placeholder="e.g. What's your favorite framework?"
                {...register('title')}
                className="h-11 rounded-xl"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-4">
              <Label>Options *</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    placeholder={`Option ${index + 1}`}
                    {...register(`options.${index}.value`)}
                    className="h-11 rounded-xl"
                  />
                  {fields.length > 2 && (
                    <Button type="button" variant="outline" size="sm" className="rounded-xl border-white/10" onClick={() => remove(index)}>
                      ✕
                    </Button>
                  )}
                </div>
              ))}
              {fields.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-white/10"
                  onClick={() => append({ value: '' })}
                >
                  + Add Option
                </Button>
              )}
              {errors.options && (
                <p className="text-sm text-destructive">{errors.options.message}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isMultipleChoice"
                {...register('isMultipleChoice')}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
              <Label htmlFor="isMultipleChoice">Allow multiple choices</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timerSeconds">Timer (seconds, optional)</Label>
              <Input
                id="timerSeconds"
                type="number"
                placeholder="e.g. 60"
                {...register('timerSeconds')}
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Poll will auto-close after this many seconds.</p>
            </div>
          </CardContent>
          <CardFooter className="flex gap-4 border-t border-white/10 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25 transition-all duration-300"
            >
              {loading ? 'Creating...' : 'Create Poll'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-white/10"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}
