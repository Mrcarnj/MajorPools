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

// Temporary mock data until we set up the API
const mockGolfers = {
  tier1: [
    { id: '1', name: 'Scottie Scheffler', world_ranking: 1 },
    { id: '2', name: 'Rory McIlroy', world_ranking: 2 },
    { id: '3', name: 'Jon Rahm', world_ranking: 3 },
  ],
  tier2: [
    { id: '4', name: 'Viktor Hovland', world_ranking: 4 },
    { id: '5', name: 'Xander Schauffele', world_ranking: 5 },
    { id: '6', name: 'Patrick Cantlay', world_ranking: 6 },
  ],
  tier3: [
    { id: '7', name: 'Matt Fitzpatrick', world_ranking: 7 },
    { id: '8', name: 'Brian Harman', world_ranking: 8 },
    { id: '9', name: 'Max Homa', world_ranking: 9 },
  ],
  tier4: [
    { id: '10', name: 'Jordan Spieth', world_ranking: 10 },
    { id: '11', name: 'Tommy Fleetwood', world_ranking: 11 },
    { id: '12', name: 'Justin Thomas', world_ranking: 12 },
  ],
  tier5: [
    { id: '13', name: 'Shane Lowry', world_ranking: 13 },
    { id: '14', name: 'Justin Rose', world_ranking: 14 },
    { id: '15', name: 'Tony Finau', world_ranking: 15 },
  ],
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
      
      if (currentTierSelections.length >= 2) {
        toast.error('You can only select 2 golfers per tier');
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

    // Validate all tiers have exactly 2 selections
    const invalidTiers = Object.entries(formData.selections).filter(
      ([_, selections]) => selections.length !== 2
    );

    if (invalidTiers.length > 0) {
      toast.error('Please select exactly 2 golfers for each tier');
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
      tier4_golfer2: formData.selections.tier4[1],
      tier5_golfer1: formData.selections.tier5[0],
      tier5_golfer2: formData.selections.tier5[1],
    };

    try {
      await createEntry.mutateAsync(entry);
      // Reset form after successful submission
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
    } catch (error) {
      console.error('Error submitting entry:', error);
    }
  }, [activeTournament, formData, createEntry.mutateAsync, user]);

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
    return Object.values(formData.selections).every(
      selections => selections.length === 2
    );
  }, [formData, entryNameError, emailError]);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center">
        {activeTournament?.name} {activeTournament?.start_date ? new Date(activeTournament.start_date).getFullYear() : ''}
      </h1>

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

        {Object.entries(mockGolfers).map(([tier, golfers]) => (
          <Card key={tier}>
            <CardHeader>
              <CardTitle>
                Tier {tier.replace('tier', '')} Golfers
                <span className="text-sm font-normal ml-2 text-muted-foreground">
                  (Select 2)
                  <span className="ml-1">
                    - {formData.selections[tier as keyof typeof formData.selections].length}/2 selected
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {golfers.map((golfer) => (
                  <div key={golfer.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`golfer-${golfer.id}`}
                      checked={formData.selections[tier as keyof typeof formData.selections].includes(golfer.id)}
                      onCheckedChange={() => handleGolferSelection(tier, golfer.id)}
                    />
                    <Label 
                      htmlFor={`golfer-${golfer.id}`}
                      className="flex items-center gap-2"
                    >
                      {golfer.name}
                      <span className="text-sm text-muted-foreground">
                        (Rank: {golfer.world_ranking})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <Button 
          type="submit" 
          className="w-full"
          disabled={!isFormValid()}
        >
          Submit Entry
        </Button>
      </form>
    </div>
  );
} 