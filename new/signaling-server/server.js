const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const User = require('./models/User');
const setupSignaling = require('./services/signaling');

const app = express();
app.use(bodyParser.json());

mongoose.connect('mongodb://localhost:27017/videocall', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const server = http.createServer(app);
setupSignaling(server);

const guests = new Map();
const onlineUsers = new Map();

const generateId = () => uuidv4();

app.post('/register', async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password || !displayName) {
    return res.status(400).json({ success: false, message: 'Username, password, and display name are required' });
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Username already exists' });
  }

  const id = generateId();
  const newUser = new User({ username, password, displayName, id, isOnline: false });
  await newUser.save();
  res.json({ success: true, message: 'Account created successfully', id });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const user = await User.findOne({ username, password });
  if (user) {
    user.isOnline = true;
    await user.save();
    return res.json({ success: true, id: user.id, username: user.username, displayName: user.displayName });
  }
  res.status(400).json({ success: false, message: 'Invalid credentials' });
});

app.post('/guest', (req, res) => {
  const { displayName } = req.body;
  if (!displayName) {
    return res.status(400).json({ success: false, message: 'Display name is required' });
  }

  const id = generateId();
  guests.set(id, { displayName });
  res.json({ success: true, id, displayName, message: 'Guest account created successfully' });
});

app.post('/logout', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, message: 'ID is required' });
  }

  if (guests.has(id)) {
    guests.delete(id);
    return res.json({ success: true, message: 'Guest account deleted successfully' });
  }

  const user = await User.findOne({ id });
  if (user) {
    user.isOnline = false;
    await user.save();
    return res.json({ success: true, message: 'User logged out successfully' });
  }

  res.status(404).json({ success: false, message: 'Account not found' });
});

app.post('/updatePassword', async (req, res) => {
  const { callerId, password, newPassword } = req.body;
  if (!callerId || !password || !newPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const user = await User.findOne({ id: callerId, password });
  if (user) {
    user.password = newPassword;
    await user.save();
    return res.json({ success: true, message: 'Password updated successfully' });
  }
  res.status(400).json({ success: false, message: 'Invalid credentials' });
});

app.post('/updateDisplayName', async (req, res) => {
  const { callerId, displayName } = req.body;
  if (!callerId || !displayName) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const user = await User.findOne({ id: callerId });
  if (user) {
    user.displayName = displayName;
    await user.save();
    return res.json({ success: true, message: 'Display name updated successfully' });
  }
  res.status(400).json({ success: false, message: 'User not found' });
});

app.get('/user/:id', async (req, res) => {
  const { id } = req.params;
  const user = await User.findOne({ id });
  if (user) {
    return res.json({ username: user.username, displayName: user.displayName });
  }
  res.status(404).json({ success: false, message: 'User not found' });
});

app.get('/contacts', async (req, res) => {
  const users = await User.find({});
  const contacts = [
    ...users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      isOnline: user.isOnline,
    })),
    ...Array.from(guests.entries()).map(([id, guest]) => ({
      id,
      displayName: guest.displayName,
      isOnline: true,
    })),
  ];
  res.json(contacts);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://192.168.219.75:${PORT}`);
});