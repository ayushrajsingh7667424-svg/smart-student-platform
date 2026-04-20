# 1. Project Folder Structure

```
/project
│── app.py
│── /templates
│   │── index.html
│   │── login.html
│   │── register.html
│   │── dashboard.html
│── /static
│   │── style.css
│   │── script.js
│── /database
│   │── app.db
```

---

# 2. app.py (Flask Backend)

```python
from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import datetime

app = Flask(__name__)
app.secret_key = 'secret123'

# DB Connection

def get_db():
    conn = sqlite3.connect('database/app.db')
    conn.row_factory = sqlite3.Row
    return conn

# Home
@app.route('/')
def index():
    return render_template('index.html')

# Register
@app.route('/register', methods=['GET','POST'])
def register():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = generate_password_hash(request.form['password'])

        db = get_db()
        db.execute('INSERT INTO users (name,email,password) VALUES (?,?,?)',
                   (name,email,password))
        db.commit()
        return redirect('/login')

    return render_template('register.html')

# Login
@app.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        db = get_db()
        user = db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()

        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['name'] = user['name']
            return redirect('/dashboard')

    return render_template('login.html')

# Dashboard
@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect('/login')

    db = get_db()

    tasks = db.execute('SELECT * FROM tasks WHERE user_id=?',
                       (session['user_id'],)).fetchall()

    return render_template('dashboard.html',
                           name=session['name'],
                           tasks=tasks,
                           date=datetime.date.today())

# Add Task
@app.route('/add_task', methods=['POST'])
def add_task():
    title = request.form['title']
    db = get_db()
    db.execute('INSERT INTO tasks (title,status,user_id) VALUES (?,?,?)',
               (title,'pending',session['user_id']))
    db.commit()
    return redirect('/dashboard')

# Complete Task
@app.route('/complete_task/<int:id>')
def complete_task(id):
    db = get_db()
    db.execute('UPDATE tasks SET status="done" WHERE id=?',(id,))
    db.commit()
    return redirect('/dashboard')

# Timetable Generator
@app.route('/generate_timetable', methods=['POST'])
def generate_timetable():
    subjects = request.json['subjects']
    hours = int(request.json['hours'])

    timetable = []
    per_subject = hours // len(subjects)

    for s in subjects:
        timetable.append({"subject": s, "hours": per_subject})

    return jsonify(timetable)

if __name__ == '__main__':
    app.run(debug=True)
```

---

# 3. HTML Templates

## index.html

```html
<!DOCTYPE html>
<html>
<head>
<title>Smart Student</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<h1>Welcome to Smart Student Platform</h1>
<a href="/login">Login</a>
<a href="/register">Register</a>
</body>
</html>
```

## login.html

```html
<form method="POST">
<input name="email" placeholder="Email">
<input name="password" type="password" placeholder="Password">
<button>Login</button>
</form>
```

## register.html

```html
<form method="POST">
<input name="name" placeholder="Name">
<input name="email" placeholder="Email">
<input name="password" type="password" placeholder="Password">
<button>Register</button>
</form>
```

## dashboard.html

```html
<h2>Hello {{name}}</h2>
<p>{{date}}</p>

<form method="POST" action="/add_task">
<input name="title" placeholder="New Task">
<button>Add</button>
</form>

<ul>
{% for task in tasks %}
<li>
{{task.title}} - {{task.status}}
<a href="/complete_task/{{task.id}}">Done</a>
</li>
{% endfor %}
</ul>
```

---

# 4. CSS (style.css)

```css
body {
    font-family: Arial;
    background: #0f172a;
    color: white;
}

input, button {
    padding: 10px;
    margin: 5px;
}
```

---

# 5. JavaScript (script.js)

```javascript
async function generateTimetable() {
    let subjects = ["Math","DBMS","OS"]

    let res = await fetch('/generate_timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: subjects, hours: 6 })
    })

    let data = await res.json()
    console.log(data)
}
```

---

# 6. Database Models (SQLite)

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    password TEXT
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    status TEXT,
    user_id INTEGER
);
```

---

# 7. Run Instructions

1. Install dependencies:

```
pip install flask
```

2. Run app:

```
python app.py
```

3. Open browser:

```
http://127.0.0.1:5000
```

---

# BONUS IDEAS TO UPGRADE

* Add Chart.js for analytics
* Add ML model for prediction
* Add JWT authentication
* Deploy on Render / AWS
* Add dark/light toggle

---

This is your base INDUSTRY PROJECT. Next step: I can upgrade this into a FULL AI SaaS with advanced UI, analytics, and ML predictions.
