# Venmo Payment Checker

This script compares your Venmo transactions with a list of expected payments to determine who has paid and who hasn't.

## Prerequisites

- Node.js (v16 or higher)
- TypeScript
- A Venmo account with transactions to check

## Setup

1. Make sure all dependencies are installed:
   ```
   npm install
   ```

2. Prepare your entries data:
   - Edit `data/entries.json` with the expected payments
   - Each entry should have:
     - `userId`: A unique identifier
     - `username`: Name matching the Venmo sender name 
     - `amount`: Payment amount to match
     - `hasPaid`: Initially set to false
     - `paymentNote` (optional): Keywords to match in the transaction note

## How to Export Venmo Transactions

1. **From Venmo Web Interface:**
   - Login to your Venmo account at [venmo.com](https://venmo.com)
   - Click "Statements" in the sidebar
   - Select the month/year you want to download
   - Click "Download CSV"
   - Note: You can only download 90 days of history at a time

2. **For Longer History:**
   - You can request a full data export through Venmo:
     - Go to Settings > Privacy > "Request your data"
     - Select transaction data
     - This may take 1-2 days to process

3. **Alternative Methods:**
   - For a complete transaction history, you can use third-party tools:
     - [Venmo-History-CSV](https://github.com/Ryderpro/Venmo-History-CSV)
     - Follow the instructions on the GitHub repo

## Running the Script

```bash
# Run with npx to compile TypeScript on the fly
npx tsx scripts/venmo-payment-checker.ts path/to/your/venmo-transactions.csv
```

Example:
```bash
npx tsx scripts/venmo-payment-checker.ts data/sample-venmo-transactions.csv
```

## Understanding Results

The script will:

1. Load your entries from `data/entries.json`
2. Load and parse the Venmo CSV file
3. Match transactions with entries based on:
   - Sender name matching the entry username
   - Transaction amount matching the entry amount
   - Optional note keywords if specified
   - Only "Complete" (not "Pending") transactions
4. Generate a report showing:
   - Who has paid
   - Who hasn't paid
   - Summary statistics
5. Save results to `data/payment-status.json`

## Notes

- The script is case-insensitive when matching names
- It checks for exact amounts
- Only completed transactions are counted as paid
- Pending transactions are not counted as paid
- Make sure the name in your entries matches the sender name in Venmo 