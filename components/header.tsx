'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoonIcon, SunIcon, UserIcon } from 'lucide-react';
import { PiSignOut } from "react-icons/pi";
import { RxDashboard } from "react-icons/rx";
import { RiAdminLine, RiTeamLine } from "react-icons/ri";
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { LoginModal } from '@/components/auth/login-modal';
import { useAuth } from '@/lib/auth/auth-context';
import { MdOutlineLeaderboard } from 'react-icons/md';
import { useRouter } from 'next/navigation';

export function Header() {
  const { theme, setTheme } = useTheme();
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
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          Majors SZN Pools
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/leaderboard" className="hover:text-primary flex items-center">
            <MdOutlineLeaderboard className="mr-2 h-4 w-4"/>
            Leaderboard
          </Link>
          {showCreateTeam && (
            <Link href="/create-team" className="hover:text-primary flex items-center">
              <RiTeamLine className="mr-2 h-4 w-4" />
              Create Team
            </Link>
          )}
          {authSession && (
            <>
              <Link href="/dashboard" className="hover:text-primary flex items-center">
                <RxDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
              {authSession && authSession.user.user_metadata?.role === 'admin' && (
                <button 
                  onClick={handleAdminClick}
                  className="hover:text-primary flex items-center"
                >
                  <RiAdminLine className="mr-2 h-4 w-4" />
                  Admin
                </button>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <SunIcon className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

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