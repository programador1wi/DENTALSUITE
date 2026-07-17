import axios from 'axios';

async function test() {
  try {
    console.log("Logging in...");
    const loginRes = await axios.post("http://127.0.0.1:3001/api/v1/auth/login", {
      email: "admin@dentalwarner.local",
      password: "Admin123!"
    });
    const token = loginRes.data.accessToken || loginRes.data.data?.accessToken;

    // Test 1: 150KB payload
    console.log("Sending 150KB logo (previously failed)...");
    try {
      const res1 = await axios.patch(
        "http://127.0.0.1:3001/api/v1/settings/organization",
        { logoUrl: "data:image/jpeg;base64," + "A".repeat(150 * 1024) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("Test 1 Result: SUCCESS", res1.status);
    } catch (err: any) {
      console.error("Test 1 Result: FAILED", err.response?.status, err.response?.data);
    }

    // Test 2: 1.5MB payload
    console.log("Sending 1.5MB logo (large file)...");
    try {
      const res2 = await axios.patch(
        "http://127.0.0.1:3001/api/v1/settings/organization",
        { logoUrl: "data:image/jpeg;base64," + "A".repeat(1500 * 1024) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("Test 2 Result: SUCCESS", res2.status);
    } catch (err: any) {
      console.error("Test 2 Result: FAILED", err.response?.status, err.response?.data);
    }

  } catch (error: any) {
    console.error("Setup error:", error.message);
  }
}

test();
