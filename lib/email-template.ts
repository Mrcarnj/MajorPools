export function getEmailTemplate(tournamentName: string, createTeamUrl: string, tournamentYear: number) {
  return `HELLO FRIENDS AND GOLF FANS,

Another major week is upon us and this week it's ${tournamentName.toUpperCase()} ${tournamentYear}!

Some of you may have done pools with us previously and, by now, you know the general format. Others may be joining us for the first time, so please follow along for some important information on how to join the pool. We strive to make this process as painless as possible.

ENTRY SUBMISSION FORM:
${createTeamUrl}

--------------------
THE ENTRY FORM
--------------------

First, please provide us with a valid email address. This serves several functions:
  • The form will send you confirmation that your entry has been received
  • This allows you to receive important pool updates and factoids
  • This will enable us to get in touch with you about future pools

Next, provide a name for your entry:
  • Please use your full name
  • For multiple entries, add a number (example: "John Smith 1", "John Smith 2")
  • Use the exact same entry name if you need to make changes
  • Your most recent submission per unique entry name will be your final entry
  • Different names will be treated as additional entries
  • Changes accepted until the first tee time on Thursday

--------------------
RULES
--------------------

As part of your entry, you will select 8 different golfers from 5 different groups based upon Las Vegas odds to win ${tournamentName}:

  • 2 Golfers from Tier 1
  • 2 Golfers from Tier 2
  • 2 Golfers from Tier 3
  • 1 Golfer from Tier 4
  • 1 Golfer from Tier 5

The five of your eight golfers with the lowest scores to par will comprise your score. If you don't have five eligible golfers in the tournament (golfers who did not make the cut, were otherwise disqualified, or withdrew from the tournament for any reason), you are cut from the tournament and are ineligible for any winnings. The lowest pool score to par at the conclusion of the tournament will be declared the winner.

Note that playoff holes are not considered in the pool score calculation.

Tiebreaker pool standings will be determined using the following criteria
  1. Best Golfer
  2. Second Best Golfer
  3. Third Best Golfer...
  .... 8. Eighth Best Golfer

Each tiebreaker is evaluated separately, and the tiebreaker procedure is terminated as soon as the tie is broken.

--------------------
ENTRY FEE
--------------------

ENTRY FEE: $25

Payment Methods:
  • Venmo: @dieter21
  • Zelle: mike.f.dietrich@gmail.com

!!! IMPORTANT !!!
If payment is not received BEFORE the last group finishes the 2nd round, then your entry is nullified, and you will be barred from future pools.

Have fun, and good luck!

Cheers,
Mike`;
} 