import requests
import json
from supabase import create_client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

def fetch_datagolf_odds():
    url = "https://feeds.datagolf.com/betting-tools/outrights"
    params = {
        "tour": "pga",
        "market": "win",
        "odds_format": "american",
        "key": "f699a70c027aa740baffa1afcd2b"
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Process each player's odds
        for player in data['odds']:
            # Find FanDuel odds
            fanduel_odds = None
            for book in player.get('books', []):
                if book.get('book') == 'fanduel':
                    fanduel_odds = book.get('odds')
                    break
            
            if fanduel_odds is not None:
                # Format odds with + or - sign
                odds_str = f"+{fanduel_odds}" if fanduel_odds > 0 else str(fanduel_odds)
                
                # Update golfer_scores table
                result = supabase.table('golfer_scores').update({
                    'odds': odds_str
                }).eq('player_id', player['player_id']).execute()
                
                if result.error:
                    print(f"Error updating odds for player {player['player_name']}: {result.error}")
                else:
                    print(f"Updated odds for {player['player_name']}: {odds_str}")
            else:
                print(f"No FanDuel odds found for {player['player_name']}")
                
    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")

if __name__ == "__main__":
    fetch_datagolf_odds() 