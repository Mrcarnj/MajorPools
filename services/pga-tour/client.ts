import fetch from 'node-fetch';

const API_CONFIG = {
  orgId: '1',  // PGA Tour
  baseUrl: 'https://live-golf-data.p.rapidapi.com',
  headers: {
    'x-rapidapi-host': 'live-golf-data.p.rapidapi.com',
    'x-rapidapi-key': '4053a88438msh3d3dd8247f6707fp12e8e0jsne0eb00858f8d',
  }
};

export async function pgaFetch(endpoint: string, params: Record<string, string> = {}) {
  const queryString = new URLSearchParams({
    ...params,
    orgId: API_CONFIG.orgId,
  }).toString();

  const url = `${API_CONFIG.baseUrl}${endpoint}?${queryString}`;
  
  try {
    console.log(`Fetching from URL: ${url}`);
    
    const response = await fetch(url, { 
      method: 'GET',
      headers: API_CONFIG.headers 
    });
    
    // Log response status and headers
    console.log(`Response status: ${response.status}`);
    
    // Check if response is not OK (status code not in 200-299 range)
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API returned error status ${response.status}: ${errorText}`);
      throw new Error(`API returned error status ${response.status}: ${errorText}`);
    }
    
    const result = await response.text();
    
    // Log the first 100 characters of the response to see what we're getting
    console.log(`Response preview: ${result.substring(0, 100)}...`);
    
    // Check if the response is empty
    if (!result || result.trim() === '') {
      console.error('Empty response received from API');
      throw new Error('Empty response received from API');
    }
    
    try {
      // Try to parse as JSON
      return JSON.parse(result);
    } catch (parseError) {
      // If it's not valid JSON, check if it's an error message with single quotes
      if (result.includes("'error'")) {
        // Replace single quotes with double quotes to make it valid JSON
        const fixedJson = result.replace(/'/g, '"');
        try {
          const parsedError = JSON.parse(fixedJson);
          console.error('API returned error:', parsedError);
          throw new Error(`API Error: ${parsedError.error}`);
        } catch (e) {
          console.error('Failed to parse error response:', e);
          throw new Error(`API Error: ${result}`);
        }
      }
      
      console.error('JSON Parse Error:', parseError);
      console.error('Full response:', result);
      throw parseError;
    }
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
} 