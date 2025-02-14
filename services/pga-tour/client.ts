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
    const response = await fetch(url, { 
      method: 'GET',
      headers: API_CONFIG.headers 
    });
    
    const result = await response.text();
    return JSON.parse(result);
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
} 