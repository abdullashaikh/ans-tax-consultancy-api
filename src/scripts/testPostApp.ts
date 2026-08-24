async function testPostApp() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul.sharma@example.com', password: 'Password@2026!' }),
    });

    const loginData: any = await loginRes.json();
    console.log('LOGIN DATA:', JSON.stringify(loginData, null, 2));
    const token = loginData?.data?.accessToken || loginData?.data?.tokens?.accessToken || loginData?.data?.token;

    const payload = {
      serviceId: 3,
      financialYear: '2024-2025',
      assessmentYear: '2025-2026',
      notes: 'Testing filing submission from client portal',
    };

    const appRes = await fetch('http://localhost:5000/api/v1/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const appData: any = await appRes.json();
    console.log('STATUS:', appRes.status);
    console.log('RESPONSE:', JSON.stringify(appData, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testPostApp();
