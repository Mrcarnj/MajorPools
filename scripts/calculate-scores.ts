fetch('http://localhost:3000/api/calculate-scores')
  .then(res => console.log('Scores calculated:', res.status))
  .catch(err => console.error('Error:', err)); 