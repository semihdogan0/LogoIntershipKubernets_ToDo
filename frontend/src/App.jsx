import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");

  const loadTodos = async () => {
    const res = await fetch(`${API}/todos`);
    const data = await res.json();
    setTodos(data);
  };

  useEffect(() => {
    loadTodos();
  }, []);

  const addTodo = async () => {
    if (!title.trim()) return;

    await fetch(`${API}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    setTitle("");
    loadTodos();
  };

  const toggleTodo = async (todo) => {
    await fetch(`${API}/todos/${todo._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        done: !todo.done,
      }),
    });

    loadTodos();
  };

  const deleteTodo = async (id) => {
    await fetch(`${API}/todos/${id}`, {
      method: "DELETE",
    });

    loadTodos();
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Kubernetes Todo App</h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Yeni görev"
      />

      <button onClick={addTodo}>Ekle</button>

      <ul>
        {todos.map((todo) => (
          <li key={todo._id}>
            <span
              onClick={() => toggleTodo(todo)}
              style={{
                cursor: "pointer",
                textDecoration: todo.done ? "line-through" : "none",
                marginRight: "10px",
              }}
            >
              {todo.title}
            </span>

            <button onClick={() => deleteTodo(todo._id)}>
              Sil
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;