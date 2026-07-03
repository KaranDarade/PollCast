'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/store/auth-context';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl py-20 text-center">
        <p>Please log in to view your profile.</p>
      </div>
    );
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max file size is 5MB', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        await updateProfile({ avatar: dataUrl });
        toast({ title: 'Profile picture updated!', variant: 'success' });
      } catch (err: any) {
        toast({ title: 'Failed to update picture', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, phone: phone || undefined });
      toast({ title: 'Profile updated!', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Failed to update profile', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your account details</p>
      </div>

      <Card className="glass rounded-2xl border-0 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-white/10 pb-4">
          <CardTitle>Profile Picture</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          {user.avatar ? (
            <img src={user.avatar} alt="Avatar" className="h-20 w-20 rounded-2xl object-cover shadow-lg" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-2xl font-bold text-white shadow-lg">
              {initials}
            </div>
          )}
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <Button variant="outline" className="rounded-full border-white/10" onClick={() => fileInputRef.current?.click()}>
              Change Picture
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or GIF. Max 5MB.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass rounded-2xl border-0 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-white/10 pb-4">
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled className="h-11 rounded-xl opacity-60" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-11 rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" className="h-11 rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={user.role} disabled className="h-11 rounded-xl opacity-60" />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25 transition-all duration-300"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
