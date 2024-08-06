const express = require("express");
const bcrypt = require('bcrypt');
const app = express();

const password = 'intan'; // Password asli yang diinput oleh user
const saltRounds = 10; // Jumlah putaran salting (semakin tinggi semakin aman, tapi lebih lambat)

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Hashed password:', hash);
  // Anda dapat menyimpan hash ini ke dalam file JSON atau database
});

const PORT = process.env.PORT || 8839;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
