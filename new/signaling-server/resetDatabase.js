const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/videocall', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');

  try {
    await db.dropDatabase();
    console.log('Database reset successfully');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    mongoose.connection.close();
  }
});