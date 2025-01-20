const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  displayName: String,
  id: String,
  isOnline: Boolean,
});

const User = mongoose.model('User', userSchema);

module.exports = User;