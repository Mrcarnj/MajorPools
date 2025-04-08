'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MdOutlineEmail } from "react-icons/md";
import { AlertCircle, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from "@/components/ui/input";

type PaymentEntry = {
  id: string;
  entry_name: string;
  email: string;
  has_paid: boolean;
};

type GroupedEntries = {
  [email: string]: {
    entries: PaymentEntry[];
    expanded: boolean;
  };
};

export default function PaymentsPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [groupedEntries, setGroupedEntries] = useState<GroupedEntries>({});
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (!loading) {
        if (!session) {
          console.log('No session, redirecting to home');
          setIsRedirecting(true);
          router.push('/');
          return;
        }

        // Check if user's email is in authorized_emails table with admin=true
        const { data: authorizedEmail } = await supabase
          .from('authorized_emails')
          .select('admin')
          .eq('email', session.user.email)
          .single();

        if (!authorizedEmail?.admin) {
          console.log('User is not admin, redirecting to home');
          setIsRedirecting(true);
          router.push('/');
          return;
        }

        await fetchEntries();
      }
    };

    checkAuth();
  }, [session, loading, router]);

  const fetchEntries = async () => {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, status')
      .eq('is_active', true)
      .single();

    if (!tournament) {
      setGroupedEntries({});
      return;
    }

    setActiveTournament(tournament.name);

    const { data: entriesData } = await supabase
      .from('entries')
      .select(`id, entry_name, email, has_paid`)
      .eq('tournament_id', tournament.id)
      .order('email');

    // Group entries by email
    const grouped = (entriesData || []).reduce<GroupedEntries>((acc, entry) => {
      if (!acc[entry.email]) {
        acc[entry.email] = { entries: [], expanded: false };
      }
      acc[entry.email].entries.push(entry);
      return acc;
    }, {});

    setGroupedEntries(grouped);
  };

  const toggleExpanded = (email: string) => {
    setGroupedEntries(prev => ({
      ...prev,
      [email]: {
        ...prev[email],
        expanded: !prev[email].expanded
      }
    }));
  };

  const toggleEmailPaymentStatus = async (email: string, entries: PaymentEntry[]) => {
    const allPaid = entries.every(entry => entry.has_paid);
    const newStatus = !allPaid;

    // Update all entries for this email
    await Promise.all(
      entries.map(entry =>
        supabase
          .from('entries')
          .update({ has_paid: newStatus })
          .eq('id', entry.id)
      )
    );

    fetchEntries();
  };

  const toggleEntryPaymentStatus = async (entryId: string, currentStatus: boolean) => {
    await supabase
      .from('entries')
      .update({ has_paid: !currentStatus })
      .eq('id', entryId);
    
    fetchEntries();
  };

  const handleSendEmails = () => {
    const unpaidEmails = Object.entries(groupedEntries)
      .filter(([_, group]) => !group.entries.every(entry => entry.has_paid))
      .map(([email]) => email);

    if (unpaidEmails.length === 0) return;

    const mailtoLink = `mailto:?bcc=${unpaidEmails.join(',')}&subject=Payment Required for Golf Tournament&body=test payment email`;
    window.location.href = mailtoLink;
  };

  const filterEntries = () => {
    if (!searchTerm) return groupedEntries;

    const searchLower = searchTerm.toLowerCase();
    const filtered: GroupedEntries = {};

    Object.entries(groupedEntries).forEach(([email, group]) => {
      // Filter entries within each group
      const matchingEntries = group.entries.filter(entry => 
        entry.email.toLowerCase().includes(searchLower) ||
        entry.entry_name.toLowerCase().includes(searchLower)
      );

      if (matchingEntries.length > 0) {
        filtered[email] = {
          ...group,
          entries: matchingEntries
        };
      }
    });

    return filtered;
  };

  const renderTableRows = () => {
    return Object.entries(filterEntries()).map(([email, group]) => {
      // If only one entry, render a simple row
      if (group.entries.length === 1) {
        const entry = group.entries[0];
        return (
          <TableRow key={entry.id}>
            <TableCell></TableCell>
            <TableCell>{email}</TableCell>
            <TableCell>{entry.entry_name}</TableCell>
            <TableCell>
              <Checkbox
                checked={entry.has_paid}
                onCheckedChange={() => toggleEntryPaymentStatus(entry.id, entry.has_paid)}
              />
            </TableCell>
          </TableRow>
        );
      }

      // For multiple entries, render expandable group
      return (
        <>
          <TableRow 
            key={email}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => toggleExpanded(email)}
          >
            <TableCell>
              {group.expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </TableCell>
            <TableCell>{email}</TableCell>
            <TableCell>{`${group.entries.length} entries`}</TableCell>
            <TableCell onClick={e => e.stopPropagation()}>
              <Checkbox
                checked={group.entries.every(entry => entry.has_paid)}
                onCheckedChange={() => toggleEmailPaymentStatus(email, group.entries)}
              />
            </TableCell>
          </TableRow>
          {group.expanded && group.entries.map(entry => (
            <TableRow key={entry.id} className="bg-muted/50">
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell className="pl-8">{entry.entry_name}</TableCell>
              <TableCell>
                <Checkbox
                  checked={entry.has_paid}
                  onCheckedChange={() => toggleEntryPaymentStatus(entry.id, entry.has_paid)}
                />
              </TableCell>
            </TableRow>
          ))}
        </>
      );
    });
  };

  // Show nothing while redirecting
  if (isRedirecting) {
    return null;
  }

  // Show nothing if no session
  if (!session) {
    return null;
  }

  return (
    <Card className="md:rounded-lg rounded-none">
      <CardHeader className="flex flex-row items-center justify-between space-x-4">
        <div className="flex-shrink-0">
          <CardTitle>Payment Management</CardTitle>
          {activeTournament && (
            <p className="text-muted-foreground">
              Tournament: {activeTournament}
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search email or entry name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {Object.values(filterEntries()).reduce((acc, group) => acc + group.entries.length, 0)} entries
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={handleSendEmails}
          className="flex items-center gap-2 flex-shrink-0"
        >
          <MdOutlineEmail className="h-4 w-4" />
          Email Unpaid
        </Button>
      </CardHeader>
      <CardContent>
        {Object.keys(groupedEntries).length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Entry Name</TableHead>
                <TableHead className="w-[100px]">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableRows()}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            No entries found for the active tournament
          </div>
        )}
      </CardContent>
    </Card>
  );
} 