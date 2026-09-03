const fetch = require('node-fetch');

async function test() {
  const res = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Vendeur',
      email: 'test@test.com',
      password: 'password123',
      phone: '123456789',
      address: 'Test Address',
      zone: 'Test Zone',
      role: 'vendeur'
    })
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', data);
}

test();
