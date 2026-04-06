'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserIcon } from 'lucide-react';
import { PiSignOut } from "react-icons/pi";
import { RxDashboard } from "react-icons/rx";
import { RiAdminLine, RiTeamLine } from "react-icons/ri";
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { LoginModal } from '@/components/auth/login-modal';
import { useAuth } from '@/lib/auth/auth-context';
import { MdOutlineLeaderboard } from 'react-icons/md';
import { useRouter } from 'next/navigation';
import mastersLogo from '@/components/icons/masters_logo.png';

export function Header() {
  const [showCreateTeam, setShowCreateTeam] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { session: authSession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function checkTournamentStatus() {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('status')
        .eq('is_active', true)
        .single();

      setShowCreateTeam(!tournament || (tournament.status !== 'In Progress' && tournament.status !== 'Complete'));
    }

    checkTournamentStatus();
  }, []);

  const handleAdminClick = () => {
    const role = authSession?.user?.user_metadata?.role;
    const isAdmin = role === 'admin';
    
    console.log('Admin link clicked:', {
      hasSession: !!authSession,
      user: authSession?.user?.email,
      role: role,
      metadata: JSON.stringify(authSession?.user?.user_metadata || {}),
      isAdmin: isAdmin,
      timestamp: new Date().toISOString()
    });
    
    if (!isAdmin) {
      console.warn('User is not admin, preventing navigation');
      return;
    }
    
    router.push('/admin');
  };

  const handleSignOut = async () => {
    try {
      // Call supabase signOut
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="border-b border-border/80 bg-background/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center justify-start min-w-0">
          <Link href="/" className="text-xl font-bold text-header-link hover:text-header-link/90 transition-colors flex items-center gap-2">
            Majors SZN Pools
            <Image
              src={mastersLogo}
              alt=""
              className="h-[1.75em] w-auto shrink-0 -translate-y-[5px] ml-2"
              role="presentation"
              priority
            />
          </Link>
        </div>

        <nav className="hidden md:flex flex-1 items-center justify-center space-x-4 shrink-0 whitespace-nowrap">
          <Link href="/leaderboard" className="text-header-link hover:text-header-link/80 transition-colors flex items-center whitespace-nowrap">
            <MdOutlineLeaderboard className="mr-2 h-4 w-4"/>
            Leaderboard
          </Link>
          {showCreateTeam && (
            <Link href="/create-team" className="text-header-link hover:text-header-link/80 transition-colors flex items-center whitespace-nowrap">
              <RiTeamLine className="mr-2 h-4 w-4" />
              Create Team
            </Link>
          )}
          {authSession && (
            <>
              <Link href="/dashboard" className="text-header-link hover:text-header-link/80 transition-colors flex items-center whitespace-nowrap">
                <RxDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
              {authSession && authSession.user.user_metadata?.role === 'admin' && (
                <button 
                  onClick={handleAdminClick}
                  className="text-header-link hover:text-header-link/80 transition-colors flex items-center whitespace-nowrap"
                >
                  <RiAdminLine className="mr-2 h-4 w-4" />
                  Admin
                </button>
              )}
            </>
          )}
        </nav>

        <div className="flex flex-1 items-center justify-end space-x-4 min-w-0">
          {authSession ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <UserIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2 text-sm text-muted-foreground border-b">
                  {authSession.user.email}
                </div>
                <DropdownMenuItem asChild className="md:hidden">
                  <Link href="/dashboard">
                    <RxDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                {authSession && authSession.user.user_metadata?.role === 'admin' && (
                  <DropdownMenuItem onClick={handleAdminClick} className="md:hidden">
                    <RiAdminLine className="mr-2 h-4 w-4" />
                    Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <PiSignOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowLoginModal(true)}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>

      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </header>
  );
}