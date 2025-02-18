'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";

type Golfer = {
  first_name: string;
  last_name: string;
  ranking: number;
  player_id: string;
};

type TieredGolfers = {
  tier1: Golfer[];
  tier2: Golfer[];
  tier3: Golfer[];
  tier4: Golfer[];
  tier5: Golfer[];
};

export default function CreateTeam() {
  // All hooks must be at the top level, before any conditional returns
  const { user } = useAuth();
  const { data: activeTournament, isLoading } = trpc.entries.getActiveTournament.useQuery();
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    entryName: '',
    email: user?.email || '',
    selections: {
      tier1: [] as string[],
      tier2: [] as string[],
      tier3: [] as string[],
      tier4: [] as string[],
      tier5: [] as string[],
    },
  });
  const [emailError, setEmailError] = useState('');
  const [entryNameError, setEntryNameError] = useState('');
  const [serverEntryNameError, setServerEntryNameError] = useState('');
  const entryNameRef = useRef<HTMLInputElement>(null);
  const [golfers, setGolfers] = useState<TieredGolfers>({
    tier1: [],
    tier2: [],
    tier3: [],
    tier4: [],
    tier5: []
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [loading, setLoading] = useState(true);

  // Define createEntry mutation before any conditional returns
  const createEntry = trpc.entries.create.useMutation({
    onSuccess: () => {
      toast.success('Team created successfully!');
      setServerEntryNameError('');
    },
    onError: (error) => {
      if (error.message.includes('entry with this name already exists')) {
        setServerEntryNameError(error.message);
        entryNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        toast.error(error.message || 'Failed to create team');
      }
    },
  });

  // Define all your callbacks before any conditional returns
  const handleGolferSelection = useCallback((tierId: string, golferId: string) => {
    setFormData(prev => {
      const currentTierSelections = prev.selections[tierId as keyof typeof prev.selections];
      
      if (currentTierSelections.includes(golferId)) {
        return {
          ...prev,
          selections: {
            ...prev.selections,
            [tierId]: currentTierSelections.filter(id => id !== golferId),
          },
        };
      }
      
      // Different max selections for different tiers
      const maxSelections = ['tier4', 'tier5'].includes(tierId) ? 1 : 2;
      
      if (currentTierSelections.length >= maxSelections) {
        toast.error(`You can only select ${maxSelections} golfer${maxSelections > 1 ? 's' : ''} in ${tierId}`);
        return prev;
      }
      
      return {
        ...prev,
        selections: {
          ...prev.selections,
          [tierId]: [...currentTierSelections, golferId],
        },
      };
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeTournament) {
      toast.error('No active tournament found');
      return;
    }

    const entry = {
      tournament_id: activeTournament.id,
      entry_name: formData.entryName,
      email: formData.email,
      tier1_golfer1: formData.selections.tier1[0],
      tier1_golfer2: formData.selections.tier1[1],
      tier2_golfer1: formData.selections.tier2[0],
      tier2_golfer2: formData.selections.tier2[1],
      tier3_golfer1: formData.selections.tier3[0],
      tier3_golfer2: formData.selections.tier3[1],
      tier4_golfer1: formData.selections.tier4[0],
      tier5_golfer1: formData.selections.tier5[0]
    };

    try {
      await createEntry.mutateAsync(entry);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error submitting entry:', error);
    }
  }, [activeTournament, formData, createEntry.mutateAsync]);

  const validateEmail = useCallback((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  }, []);

  const validateEntryName = useCallback((name: string) => {
    const nameRegex = /^[a-zA-Z0-9\s]*$/;
    if (!name) {
      setEntryNameError('Entry name is required');
      return false;
    }
    if (!nameRegex.test(name)) {
      setEntryNameError('Entry name can only contain letters and numbers');
      return false;
    }
    setEntryNameError('');
    return true;
  }, []);

  const isFormValid = useCallback(() => {
    if (!formData.entryName || !formData.email) return false;
    if (entryNameError || emailError) return false;
    
    return (
      formData.selections.tier1.length === 2 &&
      formData.selections.tier2.length === 2 &&
      formData.selections.tier3.length === 2 &&
      formData.selections.tier4.length === 1 &&
      formData.selections.tier5.length === 1
    );
  }, [formData, entryNameError, emailError]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchGolfers() {
      const { data, error } = await supabase
        .from('golfer_scores')
        .select('first_name, last_name, ranking, player_id')
        .not('ranking', 'is', null)
        .order('ranking', { ascending: true });

      if (error) {
        console.error('Error fetching golfers:', error);
        return;
      }

      // Organize golfers into tiers
      const tieredGolfers = {
        tier1: data.slice(0, 6),                    // Top 6
        tier2: data.slice(6, 21),                   // Next 15
        tier3: data.slice(21, 41),                  // Next 20
        tier4: data.slice(41, 61),                  // Next 20
        tier5: data.slice(61)                       // Remaining
      };

      setGolfers(tieredGolfers);
    }

    fetchGolfers();
  }, []);

  useEffect(() => {
    async function checkTournamentStatus() {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('status')
        .eq('is_active', true)
        .single();

      setShowForm(!tournament || tournament.status !== 'In Progress');
      setLoading(false);
    }

    checkTournamentStatus();
  }, []);

  if (loading) return null;

  if (!showForm) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Submissions Closed</h1>
        <p className="text-muted-foreground">
          Team submissions are closed due to tournament being in progress.
        </p>
      </div>
    );
  }

  // Now we can have our conditional returns
  if (!mounted) {
    return <div className="min-h-screen" />; // Return empty div instead of null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // The rest of your render logic
  return (
    <div className="space-y-8 max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center">
        {activeTournament?.name} {activeTournament?.start_date ? new Date(activeTournament.start_date).getFullYear() : ''}
      </h1>

      <div className="prose dark:prose-invert max-w-none">
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Entry Instructions</h3>
            <ul className="list-disc pl-4 space-y-1">
              <li>Entry fee: $25 via Venmo (@dieter21)</li>
              <li>Include your entry name in Venmo description</li>
              <li>Payment must be received before last group finishes 2nd round</li>
              <li>Multiple entries encouraged</li>
            </ul>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Rules</h3>
            <p>Select 8 golfers across 5 tiers:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>2 Golfers from Tier 1</li>
              <li>2 Golfers from Tier 2</li>
              <li>2 Golfers from Tier 3</li>
              <li>1 Golfer from Tier 4</li>
              <li>1 Golfer from Tier 5</li>
            </ul>
            <p className="text-sm mt-2">Your score will be based on your best 5 golfers. Playoff holes not included.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Create Your Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entryName">Entry Name</Label>
              <Input
                ref={entryNameRef}
                id="entryName"
                value={formData.entryName}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, entryName: value }));
                  validateEntryName(value);
                  setServerEntryNameError('');
                }}
                onBlur={(e) => validateEntryName(e.target.value)}
                required
                placeholder="Enter your team name"
                className={entryNameError || serverEntryNameError ? 'border-red-500' : ''}
              />
              {(entryNameError || serverEntryNameError) && (
                <p className="text-sm text-red-500 mt-1">
                  {entryNameError || serverEntryNameError}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, email: value }));
                  validateEmail(value);
                }}
                onBlur={(e) => validateEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className={emailError ? 'border-red-500' : ''}
              />
              {emailError && (
                <p className="text-sm text-red-500 mt-1">
                  {emailError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Tier 1 <span className="text-sm font-normal">({formData.selections.tier1.length}/2)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {golfers.tier1.map((golfer) => (
                <div key={golfer.player_id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Checkbox
                    id={golfer.player_id}
                    checked={formData.selections.tier1.includes(golfer.player_id)}
                    onCheckedChange={() => handleGolferSelection('tier1', golfer.player_id)}
                  />
                  <label htmlFor={golfer.player_id} className="text-sm">
                    {golfer.first_name} {golfer.last_name} ({golfer.ranking})
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Tier 2 <span className="text-sm font-normal">({formData.selections.tier2.length}/2)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {golfers.tier2.map((golfer) => (
                <div key={golfer.player_id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Checkbox
                    id={golfer.player_id}
                    checked={formData.selections.tier2.includes(golfer.player_id)}
                    onCheckedChange={() => handleGolferSelection('tier2', golfer.player_id)}
                  />
                  <label htmlFor={golfer.player_id} className="text-sm">
                    {golfer.first_name} {golfer.last_name} ({golfer.ranking})
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Tier 3 <span className="text-sm font-normal">({formData.selections.tier3.length}/2)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {golfers.tier3.map((golfer) => (
                <div key={golfer.player_id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Checkbox
                    id={golfer.player_id}
                    checked={formData.selections.tier3.includes(golfer.player_id)}
                    onCheckedChange={() => handleGolferSelection('tier3', golfer.player_id)}
                  />
                  <label htmlFor={golfer.player_id} className="text-sm">
                    {golfer.first_name} {golfer.last_name} ({golfer.ranking})
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Tier 4 <span className="text-sm font-normal">({formData.selections.tier4.length}/1)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {golfers.tier4.map((golfer) => (
                <div key={golfer.player_id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Checkbox
                    id={golfer.player_id}
                    checked={formData.selections.tier4.includes(golfer.player_id)}
                    onCheckedChange={() => handleGolferSelection('tier4', golfer.player_id)}
                  />
                  <label htmlFor={golfer.player_id} className="text-sm">
                    {golfer.first_name} {golfer.last_name} ({golfer.ranking})
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Tier 5 <span className="text-sm font-normal">({formData.selections.tier5.length}/1)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {golfers.tier5.map((golfer) => (
                <div key={golfer.player_id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Checkbox
                    id={golfer.player_id}
                    checked={formData.selections.tier5.includes(golfer.player_id)}
                    onCheckedChange={() => handleGolferSelection('tier5', golfer.player_id)}
                  />
                  <label htmlFor={golfer.player_id} className="text-sm">
                    {golfer.first_name} {golfer.last_name} ({golfer.ranking})
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full"
          disabled={!isFormValid()}
        >
          Submit Entry
        </Button>
      </form>

      <Dialog 
        open={showPaymentModal} 
        onOpenChange={(open) => {
          setShowPaymentModal(open);
          if (!open) {  // When dialog is closed
            setFormData({
              entryName: '',
              email: user?.email || '',
              selections: {
                tier1: [],
                tier2: [],
                tier3: [],
                tier4: [],
                tier5: [],
              },
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Pay Now!</DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            </DialogClose>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <img 
              src="/images/venmo.jpg" 
              alt="Venmo QR Code" 
              className="w-64 h-64 object-contain"
            />
            <p className="text-center text-sm text-muted-foreground">
              Please send $25 to @dieter21 with your entry name in the description
            </p>
            <DialogClose asChild>
              <Button variant="outline" className="w-full">
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 