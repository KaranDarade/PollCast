'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
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

interface PollItem {
  id: string;
  title: string;
  status: string;
  timerSeconds: number | null;
  isMultipleChoice: boolean;
  createdAt: string;
  options: { id: string; text: string; voteCount: number; sortOrder: number }[];
}

interface Participant {
  user: { id: string; name: string; avatar: string | null };
  role: string;
  joinedAt: string;
}

interface QuestionItem {
  id: string;
  content: string;
  isAnonymous: boolean;
  isApproved: boolean;
  isPinned: boolean;
  upvoteCount: number;
  createdAt: string;
  author: { id: string; name: string };
}

const SHARE_PLATFORMS = [
  { name: 'Twitter', color: 'bg-[#1DA1F2] hover:bg-[#1a8cd8]', share: (url: string, text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { name: 'Facebook', color: 'bg-[#1877F2] hover:bg-[#166fe5]', share: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { name: 'LinkedIn', color: 'bg-[#0A66C2] hover:bg-[#095aab]', share: (url: string, text: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}` },
  { name: 'WhatsApp', color: 'bg-[#25D366] hover:bg-[#21bd5b]', share: (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}` },
];

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchData = () => {
    if (!params.id || !token) return;
    Promise.all([
      fetch(`${API_URL}/events/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/polls/event/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/events/${params.id}/participants`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/questions/event/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([e, p, pt, q]) => {
        if (e.success) setEvent(e.data);
        if (p.success) setPolls(p.data);
        if (pt.success) setParticipants(pt.data);
        if (q.success) setQuestions(q.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [params.id, token]);

  const copyCode = () => {
    if (event) {
      navigator.clipboard.writeText(event.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startPoll = async (pollId: string) => {
    const res = await fetch(`${API_URL}/polls/${pollId}/start`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) { toast({ title: 'Poll started!', variant: 'success' }); fetchData(); }
    else toast({ title: 'Error', description: data.message, variant: 'destructive' });
  };

  const closePoll = async (pollId: string) => {
    const res = await fetch(`${API_URL}/polls/${pollId}/close`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) { toast({ title: 'Poll closed', variant: 'success' }); fetchData(); }
    else toast({ title: 'Error', description: data.message, variant: 'destructive' });
  };

  const moderateQuestion = async (questionId: string, action: string) => {
    const res = await fetch(`${API_URL}/questions/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ questionId, action }),
    });
    const data = await res.json();
    if (data.success) { toast({ title: 'Question moderated', variant: 'success' }); fetchData(); }
  };

  const handleSendInvite = async () => {
    if (!event?.id || !inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      const res = await fetch(`${API_URL}/events/${event.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `Invite sent to ${inviteEmail}`, variant: 'success' });
        setInviteEmail('');
      } else {
        toast({ title: 'Failed to send invite', description: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Failed to send invite', description: err.message, variant: 'destructive' });
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64" /><div className="skeleton h-4 w-96" /><div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }
  if (!event) return <p className="text-center text-muted-foreground py-20">Event not found</p>;

  const eventUrl = typeof window !== 'undefined' ? `${window.location.origin}/event/${event.code}` : '';
  const shareText = `Join me on PollCast for "${event.title}"! Use code: ${event.code}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
          {event.description && <p className="mt-1 text-muted-foreground">{event.description}</p>}
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span>Host: {event.host.name}</span>
            <span>Created: {formatDate(event.createdAt)}</span>
            <Badge>{event.status}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        {[
          { label: 'Join Code', value: event.code, icon: '🔗' },
          { label: 'Participants', value: event._count.accessList, icon: '👥' },
          { label: 'Polls', value: event._count.polls, icon: '📊' },
          { label: 'Questions', value: event._count.questions, icon: '💬' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span>{stat.icon}</span>
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stat.label === 'Join Code' ? (
                  <div className="flex items-center gap-2">
                    <code className="rounded-xl bg-primary/10 px-3 py-1.5 text-lg font-mono font-bold tracking-widest text-primary">
                      {stat.value as string}
                    </code>
                    <Button variant="outline" size="sm" className="rounded-full border-white/10" onClick={copyCode}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-3xl font-bold">{stat.value}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button className="rounded-full bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/25" onClick={() => router.push(`/polls/create?eventId=${event.id}`)}>
          Create Poll
        </Button>
        <Button variant="outline" className="rounded-full border-white/10" onClick={() => router.push(`/analytics/${event.id}`)}>
          Analytics
        </Button>
        <Button variant="outline" className="rounded-full border-white/10" onClick={() => router.push(`/event/${event.code}`)}>
          View as Participant
        </Button>
      </div>

      <Tabs defaultValue="polls">
        <TabsList className="glass rounded-xl border-0 p-1">
          <TabsTrigger value="polls">Polls ({polls.length})</TabsTrigger>
          <TabsTrigger value="participants">Participants ({participants.length})</TabsTrigger>
          <TabsTrigger value="moderation">Moderation ({questions.filter(q => !q.isApproved).length})</TabsTrigger>
          <TabsTrigger value="share">Share & Invite</TabsTrigger>
        </TabsList>

        <TabsContent value="polls" className="space-y-4 mt-6">
          {polls.length === 0 ? (
            <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
              <CardContent className="py-12 text-center text-muted-foreground">No polls yet</CardContent>
            </Card>
          ) : polls.map((poll, i) => (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`glass rounded-2xl border-0 shadow-lg shadow-black/5 transition-all ${poll.status === 'ACTIVE' ? 'ring-2 ring-primary/30' : ''}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{poll.title}</h3>
                      <Badge variant={poll.status === 'ACTIVE' ? 'default' : 'secondary'}>{poll.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {poll.options.length} options &middot; {poll.isMultipleChoice ? 'Multi-choice' : 'Single-choice'}
                      {poll.timerSeconds && ` &middot; ${poll.timerSeconds}s timer`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {poll.status === 'DRAFT' && <Button size="sm" className="rounded-full" onClick={() => startPoll(poll.id)}>Start</Button>}
                    {poll.status === 'ACTIVE' && <Button size="sm" variant="outline" className="rounded-full border-white/10" onClick={() => closePoll(poll.id)}>Close</Button>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="participants" className="space-y-4 mt-6">
          {participants.length === 0 ? (
            <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
              <CardContent className="py-12 text-center text-muted-foreground">No participants yet</CardContent>
            </Card>
          ) : (
            <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
              <CardContent className="py-4">
                <div className="divide-y divide-white/10">
                  {participants.map((p) => (
                    <div key={`${p.user.id}-${p.joinedAt}`} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        {p.user.avatar ? (
                          <img src={p.user.avatar} alt="" className="h-9 w-9 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-sm font-medium">
                            {p.user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{p.user.name}</p>
                          <p className="text-xs text-muted-foreground">{p.role}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(p.joinedAt)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="moderation" className="space-y-4 mt-6">
          {questions.filter(q => !q.isApproved).length === 0 ? (
            <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
              <CardContent className="py-12 text-center text-muted-foreground">No pending questions</CardContent>
            </Card>
          ) : (
            questions.filter(q => !q.isApproved).map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
                  <CardContent className="flex items-start justify-between py-4">
                    <div className="flex-1">
                      <p>{q.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{q.author.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-full" onClick={() => moderateQuestion(q.id, 'approve')}>Approve</Button>
                      <Button size="sm" className="rounded-full" variant="destructive" onClick={() => moderateQuestion(q.id, 'reject')}>Reject</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>

        <TabsContent value="share" className="space-y-6 mt-6">
          <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle>Invite by Email</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-xl sm:flex-1"
                />
                <Button className="rounded-full bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/25 sm:w-auto w-full" onClick={handleSendInvite} disabled={!inviteEmail.trim() || sendingInvite}>
                  {sendingInvite ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                They will receive an email with a link to join. New users will be prompted to sign up.
              </p>
            </CardContent>
          </Card>

          <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle>Share on Social Media</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {SHARE_PLATFORMS.map((platform) => (
                  <a key={platform.name} href={platform.share(eventUrl, shareText)} target="_blank" rel="noopener noreferrer">
                    <Button className={`text-white rounded-full ${platform.color} shadow-lg`}>
                      Share on {platform.name}
                    </Button>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass rounded-2xl border-0 shadow-lg shadow-black/5">
            <CardHeader>
              <CardTitle>Event Code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Share this code with friends so they can join:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded-xl bg-primary/10 px-4 py-2 text-xl font-mono font-bold tracking-widest text-primary">{event.code}</code>
                <Button variant="outline" className="rounded-full border-white/10" onClick={copyCode}>{copied ? 'Copied!' : 'Copy'}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
