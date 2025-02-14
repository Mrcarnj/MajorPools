'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

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
  const { user } = useAuth();
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

  const handleGolferSelection = (tierId: string, golferId: string) => {
    setFormData(prev => {
      const currentTierSelections = prev.selections[tierId as keyof typeof prev.selections];
      
      // If golfer is already selected, remove them
      if (currentTierSelections.includes(golferId)) {
        return {
          ...prev,
          selections: {
            ...prev.selections,
            [tierId]: currentTierSelections.filter(id => id !== golferId),
          },
        };
      }
      
      // If tier already has 2 selections, show error
      if (currentTierSelections.length >= 2) {
        toast.error('You can only select 2 golfers per tier');
        return prev;
      }
      
      // Add new selection
      return {
        ...prev,
        selections: {
          ...prev.selections,
          [tierId]: [...currentTierSelections, golferId],
        },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all tiers have exactly 2 selections
    const invalidTiers = Object.entries(formData.selections).filter(
      ([_, selections]) => selections.length !== 2
    );

    if (invalidTiers.length > 0) {
      toast.error('Please select exactly 2 golfers for each tier');
      return;
    }

    // For now, just log the data
    console.log('Form submitted:', formData);
    toast.success('Team created successfully!');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Your Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entryName">Entry Name</Label>
            <Input
              id="entryName"
              value={formData.entryName}
              onChange={(e) => setFormData(prev => ({ ...prev, entryName: e.target.value }))}
              required
              placeholder="Enter your team name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              placeholder="Enter your email"
            />
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

      <Button type="submit" className="w-full">
        Submit Entry
      </Button>
    </form>
  );
} 