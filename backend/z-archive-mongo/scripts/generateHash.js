const bcrypt = require("bcryptjs");

// Replace with your chosen password
const plainTextPassword = "password";

// Generate the hash
bcrypt.hash(plainTextPassword, 10, (err, hash) => {
  if (err) {
    console.error("Error generating hash:", err);
  } else {
    console.log("Generated hash:", hash);
  }
});
