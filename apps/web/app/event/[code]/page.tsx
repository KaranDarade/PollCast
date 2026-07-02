'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/store/auth-context';
import { useSocket } from '@/hooks/useSocket';
import { formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface EventData {
  id: string;
  title: string;
  description: string;
  code: string;
  status: string;
  host: { id: string; name: string };
}

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  sortOrder: number;
}

interface Poll {
  id: string;
  title: string;
  status: string;
  isMultipleChoice: boolean;
  timerSeconds: number | null;
  options: PollOption[];
}

interface Question {
  id: string;
  content: string;
  isAnonymous: boolean;
  isApproved: boolean;
  isPinned: boolean;
  upvoteCount: number;
  createdAt: string;
  author: { id: string; name: string };
}

export default function EventPage() {
  const params = useParams();
  const { user, accessToken } = useAuth();
  const { isConnected, castVote, askQuestion, upvoteQuestion, on } = useSocket();

  const [event, setEvent] = useState<EventData | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [questionText, setQuestionText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch event data
  useEffect(() => {
    if (!params.code) return;

    fetch(`${API_URL}/events/code/${params.code}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEvent(data.data);
      })
      .catch(console.error);
  }, [params.code, accessToken]);

  // Fetch polls and questions
  useEffect(() => {
    if (!event?.id || !accessToken) return;

    Promise.all([
      fetch(`${API_URL}/polls/event/${event.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/questions/event/${event.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()),
    ])
      .then(([pollsData, questionsData]) => {
        if (pollsData.success) setPolls(pollsData.data);
        if (questionsData.success) setQuestions(questionsData.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [event?.id, accessToken]);

  // Socket event listeners
  useEffect(() => {
    if (!event?.id) return;

    const unsubVote = on('poll:vote_updated', (data: { pollId: string; results: any }) => {
      setPolls((prev) =>
        prev.map((p) => (p.id === data.pollId ? data.results : p))
      );
    });

    const unsubQuestion = on('question:created', (q: Question) => {
      setQuestions((prev) => [q, ...prev]);
    });

    const unsubUpvote = on('question:upvoted', (data: { questionId: string; upvoteCount: number }) => {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === data.questionId ? { ...q, upvoteCount: data.upvoteCount } : q
        )
      );
    });

    return () => {
      unsubVote?.();
      unsubQuestion?.();
      unsubUpvote?.();
    };
  }, [event?.id, on]);

  const handleVote = useCallback(
    async (pollId: string) => {
      const options = selectedOptions[pollId];
      if (!options || options.length === 0) return;
      try {
        await castVote(pollId, options);
        toast({ title: 'Vote recorded!', variant: 'success' });
      } catch (err: any) {
        toast({ title: 'Vote failed', description: err.message, variant: 'destructive' });
      }
    },
    [selectedOptions, castVote]
  );

  const handleAskQuestion = useCallback(async () => {
    if (!event?.id || !questionText.trim()) return;
    setSubmittingQuestion(true);
    try {
      await askQuestion(event.id, questionText, isAnonymous);
      setQuestionText('');
      toast({ title: 'Question submitted!', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Failed to submit', description: err.message, variant: 'destructive' });
    } finally {
      setSubmittingQuestion(false);
    }
  }, [event?.id, questionText, isAnonymous, askQuestion]);

  const handleUpvote = useCallback(
    async (questionId: string) => {
      try {
        await upvoteQuestion(questionId);
      } catch (err: any) {
        toast({ title: 'Failed to upvote', variant: 'destructive' });
      }
    },
    [upvoteQuestion]
  );

  const toggleOption = (pollId: string, optionId: string, isMultiple: boolean) => {
    setSelectedOptions((prev) => {
      const current = prev[pollId] || [];
      if (isMultiple) {
        const exists = current.includes(optionId);
        return {
          ...prev,
          [pollId]: exists ? current.filter((id) => id !== optionId) : [...current, optionId],
        };
      }
      return { ...prev, [pollId]: [optionId] };
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto max-w-4xl p-6 text-center">
        <h1 className="text-2xl font-bold">Event not found</h1>
        <p className="text-muted-foreground">Check your join code and try again.</p>
      </div>
    );
  }

  const activePolls = polls.filter((p) => p.status === 'ACTIVE');
  const closedPolls = polls.filter((p) => p.status === 'CLOSED');

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto max-w-4xl px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
              {event.description && (
                <p className="mt-2 text-muted-foreground">{event.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span>Hosted by {event.host.name}</span>
                <Badge variant={event.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {event.status}
                </Badge>
                {isConnected && (
                  <Badge variant="outline" className="text-green-600">
                    Connected
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-6 py-8">
        <Tabs defaultValue={activePolls.length > 0 ? 'polls' : 'qa'}>
          <TabsList className="mb-6">
            <TabsTrigger value="polls">
              Polls {activePolls.length > 0 && `(${activePolls.length})`}
            </TabsTrigger>
            <TabsTrigger value="qa">Q&A ({questions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="polls" className="space-y-6">
            {polls.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No polls yet. The host will launch one shortly.
                </CardContent>
              </Card>
            )}

            <AnimatePresence>
              {activePolls.map((poll) => (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {poll.title}
                        <Badge variant="default" className="animate-pulse">Live</Badge>
                      </CardTitle>
                      {poll.timerSeconds && (
                        <p className="text-sm text-muted-foreground">
                          Timer: {poll.timerSeconds}s
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {poll.options.map((option) => (
                        <motion.button
                          key={option.id}
                          onClick={() => toggleOption(poll.id, option.id, poll.isMultipleChoice)}
                          className={`w-full rounded-lg border p-4 text-left transition-all hover:border-primary/50 ${
                            (selectedOptions[poll.id] || []).includes(option.id)
                              ? 'border-primary bg-primary/5'
                              : ''
                          }`}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{option.text}</span>
                            <span className="text-sm text-muted-foreground">
                              {option.voteCount} votes
                            </span>
                          </div>
                          {option.voteCount > 0 && (
                            <div className="mt-2 h-2 w-full rounded-full bg-secondary">
                              <motion.div
                                className="h-full rounded-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${Math.min(
                                    (option.voteCount / Math.max(...poll.options.map((o) => o.voteCount), 1)) * 100,
                                    100
                                  )}%`,
                                }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          )}
                        </motion.button>
                      ))}
                      <Button
                        className="w-full mt-4"
                        onClick={() => handleVote(poll.id)}
                        disabled={!(selectedOptions[poll.id]?.length > 0)}
                      >
                        {poll.isMultipleChoice ? 'Cast Votes' : 'Cast Vote'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {closedPolls.length > 0 && (
              <div>
                <h3 className="mb-4 text-lg font-semibold text-muted-foreground">Past Polls</h3>
                {closedPolls.map((poll) => (
                  <Card key={poll.id} className="opacity-75">
                    <CardHeader>
                      <CardTitle className="text-base">{poll.title}</CardTitle>
                      <Badge variant="secondary">Closed</Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {poll.options
                        .sort((a, b) => b.voteCount - a.voteCount)
                        .map((option) => {
                          const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
                          const pct = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
                          return (
                            <div key={option.id} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{option.text}</span>
                                <span className="text-muted-foreground">
                                  {option.voteCount} ({pct.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-secondary">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="qa" className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="question">Ask a Question</Label>
                    <textarea
                      id="question"
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                      placeholder="Type your question..."
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Ask anonymously
                    </label>
                    <Button
                      onClick={handleAskQuestion}
                      disabled={!questionText.trim() || submittingQuestion}
                    >
                      {submittingQuestion ? 'Submitting...' : 'Submit Question'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {questions.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No questions yet. Be the first to ask!
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <AnimatePresence>
                {questions.map((question) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Card
                      className={`transition-all ${
                        question.isPinned ? 'border-primary/40 bg-primary/5' : ''
                      }`}
                    >
                      <CardContent className="flex items-start gap-4 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex flex-col items-center gap-1 px-2"
                          onClick={() => handleUpvote(question.id)}
                        >
                          <span className="text-lg font-bold">{question.upvoteCount}</span>
                          <span className="text-xs text-muted-foreground">▲</span>
                        </Button>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <p className="font-medium">{question.content}</p>
                            {question.isPinned && (
                              <Badge variant="default" className="ml-2 shrink-0">
                                Pinned
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {question.isAnonymous ? 'Anonymous' : question.author.name}
                            </span>
                            <span>&middot;</span>
                            <span>{formatDate(question.createdAt)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
