'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: '📊',
    title: 'Live Polls',
    description: 'Create single or multi-choice polls that update in real-time. Watch results appear as votes come in.',
    gradient: 'from-primary/10 via-primary/5 to-transparent',
  },
  {
    icon: '💬',
    title: 'Interactive Q&A',
    description: 'Let your audience ask questions, upvote, and engage. Moderate content with approval controls.',
    gradient: 'from-secondary/10 via-secondary/5 to-transparent',
  },
  {
    icon: '📈',
    title: 'Analytics Dashboard',
    description: 'Track engagement metrics, participant counts, and poll performance with rich visualizations.',
    gradient: 'from-accent/10 via-accent/5 to-transparent',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass-strong sticky top-0 z-50 border-b border-white/10">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="gradient-text text-2xl font-bold tracking-tight">
            PollCast
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="rounded-full">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button className="rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-28 md:py-36 text-center relative">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10"
          >
            <motion.div variants={itemVariants} className="inline-block">
              <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-primary mb-6">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Real-Time Engagement Platform
              </span>
            </motion.div>

            <motion.h1 variants={itemVariants} className="text-5xl font-bold tracking-tight sm:text-7xl leading-tight">
              <span className="gradient-text">Real-Time</span>
              <br />
              Live Polling & Q&A
            </motion.h1>

            <motion.p variants={itemVariants} className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Engage your audience with live polls and interactive Q&A sessions.
              Perfect for conferences, seminars, classrooms, and corporate meetings.
            </motion.p>

            <motion.div variants={itemVariants} className="mt-10 flex items-center justify-center gap-4 flex-wrap">
              <Link href="/signup">
                <Button size="lg" className="rounded-full text-base h-12 px-8 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:scale-105">
                  Create Your First Event
                </Button>
              </Link>
              <Link href="/events/join">
                <Button size="lg" variant="outline" className="rounded-full text-base h-12 px-8 border-2 hover:bg-primary/5 transition-all duration-300 hover:scale-105">
                  Join an Event
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        <section className="container pb-28">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid gap-6 md:grid-cols-3"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="glass group relative overflow-hidden rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative z-10">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl shadow-sm">
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </main>

      <footer className="glass-strong border-t border-white/10 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          PollCast &mdash; Real-Time Engagement Platform
        </div>
      </footer>
    </div>
  );
}
