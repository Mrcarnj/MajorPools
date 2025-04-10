import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

interface VenmoTransaction {
  ID?: string;
  Datetime?: string;
  Type?: string;
  Status?: string;
  Note?: string;
  From?: string;
  To?: string;
  'Amount (total)'?: string;
  'Amount (tip)'?: string;
  'Amount (tax)'?: string;
  'Amount (fee)'?: string;
  'Funding Source'?: string;
  Destination?: string;
  [key: string]: string | undefined; // Allow any other field names
}

interface Entry {
  teamId: string;
  userId: string;
  username: string;
  amount: number;
  hasPaid: boolean;
  paymentNote?: string;
}

// Function to load team entries from the database for the current active tournament
async function loadEntries(): Promise<Entry[]> {
  try {
    // First, get the current active tournament
    const activeTournament = await prisma.tournament.findFirst({
      where: { 
        status: 'active' // Assuming 'active' is the status value based on schema
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    if (!activeTournament) {
      console.error('No active tournament found');
      return [];
    }

    console.log(`Found active tournament: ${activeTournament.name}`);

    // Get teams that have golfers in this tournament
    const teamsInTournament = await prisma.team.findMany({
      where: {
        golfers: {
          some: {
            tournamentId: activeTournament.id
          }
        }
      },
      include: {
        user: true,
        golfers: {
          where: {
            tournamentId: activeTournament.id
          }
        }
      }
    });

    console.log(`Found ${teamsInTournament.length} teams for tournament: ${activeTournament.name}`);

    // Check if we need to fetch payment status from a custom field
    // This is a placeholder - you'll need to adjust based on where payment status is stored
    const teamEntries = teamsInTournament.map(team => ({
      teamId: team.id,
      userId: team.userId,
      username: team.user.name || team.user.email || '', // Use name or email as fallback
      amount: 25, // Default amount - adjust if you have different entry fees
      hasPaid: false, // Adjust this if you store payment status somewhere
      paymentNote: activeTournament.name // Use tournament name as payment note
    }));

    return teamEntries;
  } catch (error) {
    console.error('Error loading entries from database:', error);
    return [];
  }
}

// Function to update payment status
// You'll need to customize this based on where you store payment information
async function saveResultsToDatabase(paid: Entry[]): Promise<void> {
  try {
    console.log(`Found ${paid.length} paid entries to update`);
    
    // This is a placeholder - you'll need to implement based on your data model
    // If you don't have a payment status field in your schema yet, you might need to add one
    
    // Example: If you had a Payment model or a hasPaid field on Team:
    // for (const entry of paid) {
    //   await prisma.team.update({
    //     where: { id: entry.teamId },
    //     data: { hasPaid: true }
    //   });
    // }
    
    // For now, let's just log the paid entries
    console.log("Teams that have paid:");
    paid.forEach(entry => {
      console.log(`- Team ID: ${entry.teamId}, User: ${entry.username}`);
    });
    
    console.log(`To update your database with payment info, you'll need to customize the saveResultsToDatabase function`);
  } catch (error) {
    console.error('Error saving results to database:', error);
  }
}

// Function to load Venmo transactions from CSV
function loadVenmoTransactions(csvPath: string): VenmoTransaction[] {
  try {
    // Read the file content
    const fileContent = fs.readFileSync(csvPath, 'utf8');
    
    // Split the content into lines
    const lines = fileContent.split('\n');
    
    // Find the actual header row by looking for common fields
    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].includes('ID') && 
          (lines[i].includes('Amount') || lines[i].includes('From') || lines[i].includes('To'))) {
        headerIndex = i;
        break;
      }
    }
    
    if (headerIndex === -1) {
      console.error('Could not find header row in the CSV file');
      return [];
    }
    
    // Extract the actual data (header + data rows)
    const csvData = [lines[headerIndex], ...lines.slice(headerIndex + 1)].join('\n');
    
    // Parse the CSV
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
    
    // Filter out rows without an ID (likely empty or header repeats)
    return records.filter(record => record.ID);
  } catch (error) {
    console.error('Error loading Venmo transactions:', error);
    return [];
  }
}

// Function to match Venmo transactions with entries
function matchTransactions(
  entries: Entry[],
  transactions: VenmoTransaction[]
): {
  paid: Entry[];
  unpaid: Entry[];
} {
  const paid: Entry[] = [];
  const unpaid: Entry[] = [];

  if (transactions.length === 0) {
    console.error('No valid transactions found in the CSV file');
    return { paid: [], unpaid: entries };
  }

  // Print a sample transaction to understand structure
  console.log('\nSample transaction:');
  const sample = transactions[0];
  Object.keys(sample).forEach(key => {
    if (sample[key]) {
      console.log(`- ${key}: ${sample[key]}`);
    }
  });
  
  // Create a map for easier lookup - map usernames to their transactions
  const transactionMap = new Map<string, VenmoTransaction[]>();
  
  // Group transactions by sender
  transactions.forEach(transaction => {
    if (!transaction.From) {
      return; // Skip transactions without sender
    }
    
    const sender = transaction.From.toLowerCase().trim();
    if (!transactionMap.has(sender)) {
      transactionMap.set(sender, []);
    }
    transactionMap.get(sender)?.push(transaction);
  });

  // Debug: Show all senders in transactions
  console.log('\nSenders found in transactions:');
  Array.from(transactionMap.keys()).sort().forEach(sender => {
    console.log(`- ${sender} (${transactionMap.get(sender)?.length} transactions)`);
  });

  // Check each entry against transactions
  entries.forEach(entry => {
    // Try to find by username
    const username = entry.username.toLowerCase();
    const userTransactions = transactionMap.get(username) || [];
    
    // Search transaction notes for this user
    const matchedTransaction = userTransactions.find(transaction => {
      // Check if transaction amount matches expected amount
      if (!transaction['Amount (total)']) {
        return false;
      }
      
      // Clean up and parse the amount
      const amountStr = transaction['Amount (total)'] as string;
      // Remove the '+' or '-' prefix and any currency symbols, then parse as float
      const cleanAmount = amountStr.replace(/[^0-9.-]+/g, '');
      const transactionAmount = parseFloat(cleanAmount);
      
      // Check for a match
      const statusOk = transaction.Status === 'Complete';
      const amountMatches = Math.abs(transactionAmount) === entry.amount;
      const noteMatches = !entry.paymentNote || 
                         (transaction.Note && 
                          transaction.Note.toLowerCase().includes(entry.paymentNote.toLowerCase()));
      
      return statusOk && amountMatches && noteMatches;
    });

    if (matchedTransaction) {
      paid.push({
        ...entry,
        hasPaid: true
      });
    } else {
      unpaid.push({
        ...entry,
        hasPaid: false
      });
    }
  });

  return { paid, unpaid };
}

// Main function
async function main() {
  // Path to your Venmo CSV export file
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Please provide path to Venmo CSV file');
    process.exit(1);
  }

  // Load data
  const entries = await loadEntries();
  const transactions = loadVenmoTransactions(csvPath);

  console.log(`Loaded ${entries.length} entries and ${transactions.length} Venmo transactions`);

  // Match transactions with entries
  const { paid, unpaid } = matchTransactions(entries, transactions);

  // Save results to database
  await saveResultsToDatabase(paid);

  console.log('\n=== Payment Status ===');
  console.log(`Paid (${paid.length}):`);
  paid.forEach(entry => {
    console.log(`- ${entry.username} ($${entry.amount})`);
  });

  console.log(`\nUnpaid (${unpaid.length}):`);
  unpaid.forEach(entry => {
    console.log(`- ${entry.username} ($${entry.amount})`);
  });

  // Save results to file
  const results = {
    timestamp: new Date().toISOString(),
    paid,
    unpaid,
    summary: {
      totalEntries: entries.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      paidAmount: paid.reduce((sum, entry) => sum + entry.amount, 0),
      unpaidAmount: unpaid.reduce((sum, entry) => sum + entry.amount, 0),
    }
  };

  const resultsPath = path.join(process.cwd(), 'data', 'payment-status.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${resultsPath}`);

  // Close Prisma connection
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
}); 