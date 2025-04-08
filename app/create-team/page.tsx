'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/auth/auth-context';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';
import { IoIosCloseCircle, IoIosCheckmarkCircle } from "react-icons/io";

type Golfer = {
  first_name: string;
  last_name: string;
  ranking: number;
  player_id: string;
  is_amateur: boolean;
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
  const { session } = useAuth();
  const [activeTournament, setActiveTournament] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    entryName: '',
    email: session?.user?.email || '',
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
  const [hasActiveTournament, setHasActiveTournament] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const router = useRouter();
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Define createEntry mutation before any conditional returns

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Check if we have an active tournament
      if (!activeTournament?.id) {
        setError('No active tournament found');
        setSubmitting(false);
        return;
      }

      setSubmittedEmail(formData.email);
      // First check if email exists in email_list
      const { data: emailExists } = await supabase
        .from('email_list')
        .select('email')
        .eq('email', formData.email)
        .single();

      // If email doesn't exist, add it to email_list
      if (!emailExists) {
        await supabase
          .from('email_list')
          .insert({ email: formData.email });
      }

      // Check if an entry with the same name already exists for this tournament
      const normalizedEntryName = formData.entryName.toLowerCase().replace(/\s+/g, ' ').trim();
      const { data: existingEntry } = await supabase
        .from('entries')
        .select('id, email')
        .eq('tournament_id', activeTournament.id)
        .ilike('entry_name', normalizedEntryName)
        .maybeSingle();

      // If entry exists but with a different email, reject it
      if (existingEntry && existingEntry.email !== formData.email) {
        setError('An entry with this name already exists for this tournament by another user');
        setEntryNameError('An entry with this name already exists for this tournament by another user');
        entryNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setSubmitting(false);
        return;
      }

      // If entry exists with the same email, update it
      if (existingEntry && existingEntry.email === formData.email) {
        const { error: updateError } = await supabase
          .from('entries')
          .update({
            email: formData.email,
            tier1_golfer1: formData.selections.tier1[0],
            tier1_golfer2: formData.selections.tier1[1],
            tier2_golfer1: formData.selections.tier2[0],
            tier2_golfer2: formData.selections.tier2[1],
            tier3_golfer1: formData.selections.tier3[0],
            tier3_golfer2: formData.selections.tier3[1],
            tier4_golfer1: formData.selections.tier4[0],
            tier5_golfer1: formData.selections.tier5[0]
          })
          .eq('id', existingEntry.id as any);

        if (updateError) throw updateError;
        
        setShowPaymentModal(true);
        return;
      }

      // If no existing entry, create a new one
      const { data: entry, error } = await supabase
        .from('entries')
        .insert([
          {
            entry_name: formData.entryName,
            email: formData.email,
            tournament_id: activeTournament.id,
            tier1_golfer1: formData.selections.tier1[0],
            tier1_golfer2: formData.selections.tier1[1],
            tier2_golfer1: formData.selections.tier2[0],
            tier2_golfer2: formData.selections.tier2[1],
            tier3_golfer1: formData.selections.tier3[0],
            tier3_golfer2: formData.selections.tier3[1],
            tier4_golfer1: formData.selections.tier4[0],
            tier5_golfer1: formData.selections.tier5[0]
          }
        ]);

      if (error) throw error;

      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error:', error);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
      if (!activeTournament?.id) {
        console.log('No active tournament ID available');
        setLoading(false);
        return;
      }

      console.log('Fetching golfers for tournament ID:', activeTournament.id);

      // Fetch all golfers with the tournament_id, including those with NULL rankings
      const { data, error } = await supabase
        .from('golfer_scores')
        .select('first_name, last_name, ranking, player_id, is_amateur')
        .eq('tournament_id', activeTournament.id)
        .order('ranking', { ascending: true, nullsFirst: false }); // Put NULL rankings at the end

      if (error) {
        console.error('Error fetching golfers:', error);
        return;
      }

      console.log(`Found ${data.length} golfers for tournament ID ${activeTournament.id}`);

      if (data.length === 0) {
        console.log('No golfers found for this tournament. Make sure to run the test-leaderboard script first.');
        toast.error('No golfers found for this tournament. Please contact the administrator.');
        return;
      }

      // Separate golfers with rankings and those without
      const golfersWithRanking = data.filter(golfer => golfer.ranking !== null);
      const golfersWithoutRanking = data.filter(golfer => golfer.ranking === null);

      console.log(`${golfersWithRanking.length} golfers with ranking, ${golfersWithoutRanking.length} without ranking`);

      // Combine the lists, with ranked golfers first, then unranked
      const sortedGolfers = [...golfersWithRanking, ...golfersWithoutRanking];

      // Organize golfers into tiers
      const tieredGolfers = {
        tier1: sortedGolfers.slice(0, 8),                    // Top 8
        tier2: sortedGolfers.slice(8, 23),                   // Next 15
        tier3: sortedGolfers.slice(23, 48),                  // Next 30
        tier4: sortedGolfers.slice(48, 68),                  // Next 30
        tier5: sortedGolfers.slice(68)                       // Remaining (including all unranked golfers)
      };

      setGolfers(tieredGolfers as TieredGolfers);
    }

    fetchGolfers();
  }, [activeTournament]);

  useEffect(() => {
    async function checkTournamentStatus() {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('status')
        .eq('is_active', true)
        .single();

      setHasActiveTournament(!!tournament);
      setShowForm(!tournament || (tournament.status !== 'In Progress' && tournament.status !== 'Complete'));
      setLoading(false);
    }

    checkTournamentStatus();
  }, []);

  useEffect(() => {
    if (mounted && session?.user?.email) {
      setFormData(prev => ({
        ...prev,
        email: session.user.email || prev.email
      }));
    }
  }, [mounted, session?.user?.email]);

  // Add these handler functions before the return statement
  const handleSignup = async () => {
    setAuthError('');
    
    if (signupPassword !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    if (signupPassword.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: submittedEmail,
        password: signupPassword,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data?.user?.identities?.length === 0) {
        setAuthError('This email is already registered. Please log in instead.');
        return;
      }

      toast.success('Account created successfully!');
      setShowAuthModal(false);
      router.push('/dashboard');
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleLogin = async () => {
    setAuthError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: submittedEmail,
        password: loginPassword,
      });

      if (error) throw error;

      toast.success('Logged in successfully!');
      setShowAuthModal(false);
      router.push('/dashboard');
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  // Add this function to check if passwords match
  const doPasswordsMatch = () => {
    return signupPassword && confirmPassword && signupPassword === confirmPassword;
  };

  // Add useEffect to fetch active tournament
  useEffect(() => {
    async function fetchActiveTournament() {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('is_active', true)
          .single();
        
        if (error) throw error;
        setActiveTournament(data);
      } catch (error) {
        console.error('Error fetching active tournament:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchActiveTournament();
  }, []);

  if (loading) return null;

  if (!hasActiveTournament) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">No Entry Form Available</h1>
        <p className="text-muted-foreground">
          There is no entry form due to it not being a major's week.
        </p>
      </div>
    );
  }

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
    <div className="space-y-8 max-w-4xl mx-auto p-0 md:p-6">
      <h1 className="text-3xl font-bold text-center">
        {activeTournament?.name} {activeTournament?.start_date ? new Date(activeTournament.start_date).getFullYear() : ''}
      </h1>

      <div className="prose dark:prose-invert max-w-none">
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Entry Instructions</h3>
            <ul className="list-disc pl-4 space-y-1 text-sm md:text-base">
              <li>Entry fee: $25 via Venmo (@dieter21)</li>
              <li>Include your entry name in Venmo description</li>
              <li>Payment must be received before last group finishes 2nd round</li>
              <li>Multiple entries encouraged</li>
            </ul>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Rules</h3>
            <p className="text-sm md:text-base">Select 8 golfers across 5 tiers:</p>
            <ul className="list-disc pl-4 space-y-1 text-sm md:text-base">
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
                    {golfer.first_name} {golfer.last_name}{golfer.is_amateur ? ' (A)' : ''}
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
                    {golfer.first_name} {golfer.last_name}{golfer.is_amateur ? ' (A)' : ''}
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
                    {golfer.first_name} {golfer.last_name}{golfer.is_amateur ? ' (A)' : ''}
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
                    {golfer.first_name} {golfer.last_name}{golfer.is_amateur ? ' (A)' : ''}
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
                    {golfer.first_name} {golfer.last_name}{golfer.is_amateur ? ' (A)' : ''}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full"
          disabled={!isFormValid() || submitting}
        >
          Submit Entry
        </Button>
      </form>

      <Dialog 
        open={showPaymentModal} 
        onOpenChange={(open) => {
          setShowPaymentModal(open);
          if (!open) {  // When payment dialog is closed
            if (!session) {  // If user is not logged in
              setShowAuthModal(true);  // Show auth dialog
            }
            setFormData({
              entryName: '',
              email: session?.user?.email || '',
              selections: {
                tier1: [],
                tier2: [],
                tier3: [],
                tier4: [],
                tier5: [],
              },
            });
            // Scroll to top smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });
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

      {/* Add new Auth Dialog */}
      <Dialog 
        open={showAuthModal} 
        onOpenChange={(open) => {
          setShowAuthModal(open);
          if (!open) {  // When auth dialog is closed (either by "No Thank You" or X button)
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Access Your Dashboard</DialogTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Log in or create account to access your dashboard! View current entries, historical entries and much more!
            </p>
          </DialogHeader>

          <Tabs defaultValue="signup" className="pt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="login">Log In</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input 
                    id="signup-email" 
                    type="email" 
                    value={submittedEmail} 
                    disabled 
                    className="opacity-100 cursor-not-allowed bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input 
                    id="signup-password" 
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Enter a password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input 
                    id="confirm-password" 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                  />
                  {confirmPassword && (
                    <div className="flex items-center gap-2 mt-1">
                      {doPasswordsMatch() ? (
                        <>
                          <IoIosCheckmarkCircle className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-500">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <IoIosCloseCircle className="h-5 w-5 text-red-500" />
                          <span className="text-sm text-red-500">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {authError && (
                  <p className="text-sm text-red-500">{authError}</p>
                )}
                <Button 
                  className="w-full" 
                  onClick={handleSignup}
                  disabled={!signupPassword || !confirmPassword}
                >
                  Create Account
                </Button>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  No Thank You
                </button>
              </div>
            </TabsContent>

            <TabsContent value="login" className="space-y-4">
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input 
                    id="login-email" 
                    type="email" 
                    value={submittedEmail} 
                    disabled 
                    className="opacity-100 cursor-not-allowed bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input 
                    id="login-password" 
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
                {authError && (
                  <p className="text-sm text-red-500">{authError}</p>
                )}
                <Button 
                  className="w-full" 
                  onClick={handleLogin}
                  disabled={!loginPassword}
                >
                  Log In
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
} 