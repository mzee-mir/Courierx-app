const mongoose = require('mongoose');

mongoose.connect("YOUR_MONGODB_URI", {
  serverSelectionTimeoutMS: 10000,
})
  .then(() => {
    console.log("CONNECTED SUCCESSFULLY");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });

