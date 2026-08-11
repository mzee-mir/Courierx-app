const payload = {
  menuItems: [{ name: "Pizza", price: 10 }, { name: "Burger", price: 15 }]
};

console.log(payload); // Logs the payload to the browser console

// Proceed with sending the payload
fetch('your-api-endpoint', {
  method: 'POST',
  body: JSON.stringify(payload),
  headers: {
    'Content-Type': 'application/json'
  }
});