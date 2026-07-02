'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            PollCast
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-24 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold tracking-tight sm:text-6xl"
          >
            Real-Time Live Polling
            <br />
            <span className="text-primary/70">& Q&A Platform</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Engage your audience with live polls and interactive Q&A sessions.
            Perfect for conferences, seminars, classrooms, and corporate meetings.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 flex items-center justify-center gap-4"
          >
            <Link href="/signup">
              <Button size="lg" className="text-base">
                Create Your First Event
              </Button>
            </Link>
            <Link href="/events/join">
              <Button size="lg" variant="outline" className="text-base">
                Join an Event
              </Button>
            </Link>
          </motion.div>
        </section>

        <section className="container py-16">
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="rounded-xl border p-6 text-left"
              >
                <div className="mb-4 text-3xl">{feature.icon}</div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          PollCast &mdash; Real-Time Engagement Platform
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: '📊',
    title: 'Live Polls',
    description: 'Create single or multi-choice polls that update in real-time. Watch results appear as votes come in.',
  },
  {
    icon: '💬',
    title: 'Interactive Q&A',
    description: 'Let your audience ask questions, upvote, and engage. Moderate content with approval controls.',
  },
  {
    icon: '📈',
    title: 'Analytics Dashboard',
    description: 'Track engagement metrics, participant counts, and poll performance with rich visualizations.',
  },
];
