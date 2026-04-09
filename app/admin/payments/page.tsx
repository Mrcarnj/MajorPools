'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/supabase';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MdOutlineEmail } from "react-icons/md";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type Entry = {
  id: string;
  entry_name: string;
  email: string;
  has_paid: boolean;
  created_at: string;
};

type GroupedEntries = {
  [email: string]: {
    entries: Entry[];
    expanded: boolean;
  };
};

export default function PaymentsPage() {
  const [groupedEntries, setGroupedEntries] = useState<GroupedEntries>({});
  const [loading, setLoading] = useState(true);
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, status')
      .eq('is_active', true)
      .single();

    if (!tournament) {
      setGroupedEntries({});
      setLoading(false);
      return;
    }

    setActiveTournament(tournament.name as string);

    const { data: entriesData } = await supabase
      .from('entries')
      .select(`id, entry_name, email, has_paid, created_at`)
      .eq('tournament_id', tournament.id as any)
      .order('created_at', { ascending: false });

    // Group entries by email
    const grouped = (entriesData || []).reduce<GroupedEntries>((acc, entry: any) => {
      const email = String(entry.email);
      if (!acc[email]) {
        acc[email] = { entries: [], expanded: false };
      }
      acc[email].entries.push(entry);
      return acc;
    }, {});

    setGroupedEntries(grouped);
    setLoading(false);
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

  const toggleEmailPaymentStatus = async (email: string, entries: Entry[]) => {
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

    const emailSubject = 'Payment Required for Golf Tournament';
    const emailBody = 'test payment email';
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(unpaidEmails.join(','))}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(gmailUrl, '_blank');
  };

  const filterEntries = () => {
    if (!searchTerm && paymentFilter === 'all') return groupedEntries;

    const searchLower = searchTerm.toLowerCase();
    const filtered: GroupedEntries = {};

    Object.entries(groupedEntries).forEach(([email, group]) => {
      // Filter entries within each group
      const matchingEntries = group.entries.filter(entry => {
        // Apply search filter
        const matchesSearch = !searchTerm || 
          entry.email.toLowerCase().includes(searchLower) ||
          entry.entry_name.toLowerCase().includes(searchLower);
        
        // Apply payment filter
        const matchesPayment = 
          paymentFilter === 'all' || 
          (paymentFilter === 'paid' && entry.has_paid) || 
          (paymentFilter === 'unpaid' && !entry.has_paid);
        
        return matchesSearch && matchesPayment;
      });

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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 shrink-0">
            <CardTitle>Payment Management</CardTitle>
            {activeTournament && (
              <p className="text-muted-foreground">
                Tournament: {activeTournament}
              </p>
            )}
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3 md:flex-1 md:max-w-xl md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-2">
            <div className="relative w-full min-w-0 md:flex-1 md:min-w-[12rem]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search email or entry name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-start md:contents">
              <RadioGroup
                value={paymentFilter}
                onValueChange={setPaymentFilter}
                className="flex flex-wrap items-center gap-x-4 gap-y-1"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="all" id="filter-all" />
                  <Label htmlFor="filter-all" className="font-normal">
                    All
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="paid" id="filter-paid" />
                  <Label htmlFor="filter-paid" className="font-normal">
                    Paid
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="unpaid" id="filter-unpaid" />
                  <Label htmlFor="filter-unpaid" className="font-normal">
                    Unpaid
                  </Label>
                </div>
              </RadioGroup>

              <div className="text-sm text-muted-foreground tabular-nums md:whitespace-nowrap">
                {Object.values(filterEntries()).reduce(
                  (acc, group) => acc + group.entries.length,
                  0,
                )}{' '}
                entries
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleSendEmails}
            className="flex w-full shrink-0 items-center justify-center gap-2 md:w-auto"
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
    </div>
  );
} 