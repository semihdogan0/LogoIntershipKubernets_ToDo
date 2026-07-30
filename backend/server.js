const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_HOST = process.env.MONGO_HOST || 'localhost';
const MONGO_DB = process.env.MONGO_DB || 'tododb';
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD;

const MONGO_URI = (MONGO_USER && MONGO_PASS)
  ? `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:27017/${MONGO_DB}?authSource=admin`
  : `mongodb://${MONGO_HOST}:27017/${MONGO_DB}`;

// --- Şema ---
const todoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Todo = mongoose.model('Todo', todoSchema);

// --- Mongo bağlantısı ---
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB bağlantısı kuruldu:', MONGO_URI.replace(/:[^:@]+@/, ':****@')))
  .catch((err) => console.error('MongoDB bağlantı hatası:', err.message));

// --- Probe'lar ---
// Liveness: süreç ayakta mı (Mongo'ya bakmaz — bakarsa Mongo kesintisinde pod gereksiz restart olur)
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Readiness: Mongo'ya gerçekten bağlı mı (değilse pod trafik almasın)
app.get('/readyz', (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'not ready', db: 'disconnected' });
  }
  res.status(200).json({ status: 'ready' });
});

// --- CRUD ---
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title zorunlu' });
    }
    const todo = await Todo.create({ title: title.trim() });
    res.status(201).json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  try {
    const { done, title } = req.body;
    const update = {};
    if (typeof done === 'boolean') update.done = done;
    if (typeof title === 'string') update.title = title;

    const todo = await Todo.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!todo) return res.status(404).json({ error: 'bulunamadı' });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  try {
    const result = await Todo.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'bulunamadı' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend ${PORT} portunda çalışıyor (v2)`);
});
