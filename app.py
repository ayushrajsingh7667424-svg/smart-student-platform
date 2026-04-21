from flask import Flask, request, jsonify, render_template, session
import anthropic
import base64
import json
import os
import datetime
import random

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "smartstudent-secret-key-2024")

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# ── In-memory store (resets on server restart; swap for a DB if needed) ──
store = {
    "streak": 12,
    "study_seconds": 0,
    "targets": ["Study 2 hours daily", "Complete 1 chapter per day"],
    "sessions": [],
    "subjects": ["Mathematics", "Physics", "Chemistry"],
    "chat_history": [],   # global fallback; use session in production
}


# ─────────────────────────────────────────────
# PAGE ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─────────────────────────────────────────────
# /api/performance  – streak + study stats
# ─────────────────────────────────────────────

@app.route("/api/performance")
def performance():
    streak = store["streak"]
    color = "orange" if streak >= 7 else "blue" if streak >= 3 else "green"
    hours = store["study_seconds"] // 3600
    return jsonify({
        "streak": streak,
        "color": color,
        "study_hours": hours,
        "study_label": f"{hours}h this month",
        "progress_pct": min(100, int((streak / 30) * 100)),
    })


# ─────────────────────────────────────────────
# /api/chat  – AI tutor (streaming-compatible)
# ─────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    message = data.get("message", "").strip()
    history = data.get("history", [])   # client sends full history

    if not message:
        return jsonify({"error": "Empty message"}), 400

    # Build messages list
    messages = []
    for h in history[-20:]:             # keep last 20 turns to stay within context
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1024,
            system=(
                "You are a friendly, knowledgeable AI study tutor. "
                "Give clear, well-structured answers suitable for students. "
                "Use bullet points and short paragraphs. "
                "If the question is about a subject (math, science, history, etc.), "
                "explain it step-by-step."
            ),
            messages=messages,
        )
        reply = response.content[0].text
        return jsonify({"reply": reply})

    except anthropic.APIError as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# /api/upload  – PDF upload → AI summary
# ─────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    pdf_bytes = file.read()
    if len(pdf_bytes) > 32 * 1024 * 1024:   # 32 MB guard
        return jsonify({"error": "File too large (max 32 MB)"}), 400

    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "You are a study assistant. Summarize this document for a student. "
                            "Include: 1) A 2-3 sentence overview, "
                            "2) Key topics as bullet points, "
                            "3) 3 suggested study questions. "
                            "Keep it concise and student-friendly."
                        ),
                    },
                ],
            }],
        )
        summary = response.content[0].text
        return jsonify({"msg": "PDF uploaded successfully!", "summary": summary, "filename": file.filename})

    except anthropic.APIError as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# /api/generate_timetable  – AI timetable
# ─────────────────────────────────────────────

@app.route("/api/generate_timetable", methods=["POST"])
def generate_timetable():
    data = request.get_json(force=True) or {}
    subjects = data.get("subjects", store["subjects"])
    hours_per_day = data.get("hours_per_day", 4)
    days = data.get("days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])

    prompt = (
        f"Create a weekly study timetable for a student.\n"
        f"Subjects: {', '.join(subjects)}\n"
        f"Available study hours per day: {hours_per_day}\n"
        f"Days: {', '.join(days)}\n\n"
        "Return ONLY valid JSON in this exact format:\n"
        '{"timetable": [{"day": "Monday", "sessions": [{"time": "9:00 AM", "subject": "Math", "duration": "1h", "topic": "Algebra"}]}]}'
    )

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        timetable_data = json.loads(raw.strip())
        return jsonify(timetable_data)

    except (json.JSONDecodeError, anthropic.APIError) as e:
        # Fallback: generate a simple timetable without AI
        fallback = _fallback_timetable(subjects, days)
        return jsonify({"timetable": fallback, "note": "AI unavailable – showing generated timetable"})


def _fallback_timetable(subjects, days):
    times = ["8:00 AM", "10:00 AM", "2:00 PM", "4:00 PM"]
    result = []
    for day in days:
        sessions = []
        for i, subj in enumerate(subjects[:2]):   # 2 sessions per day
            sessions.append({
                "time": times[i],
                "subject": subj,
                "duration": "1h",
                "topic": "Review & Practice",
            })
        result.append({"day": day, "sessions": sessions})
    return result


# ─────────────────────────────────────────────
# /api/targets  – CRUD for study targets
# ─────────────────────────────────────────────

@app.route("/api/targets", methods=["GET"])
def get_targets():
    return jsonify({"targets": store["targets"]})


@app.route("/api/targets", methods=["POST"])
def add_target():
    data = request.get_json(force=True)
    target = data.get("target", "").strip()
    if not target:
        return jsonify({"error": "Target cannot be empty"}), 400
    store["targets"].append(target)
    return jsonify({"msg": "Target added!", "targets": store["targets"]})


@app.route("/api/targets/<int:idx>", methods=["DELETE"])
def delete_target(idx):
    if 0 <= idx < len(store["targets"]):
        removed = store["targets"].pop(idx)
        return jsonify({"msg": f'Removed "{removed}"', "targets": store["targets"]})
    return jsonify({"error": "Invalid index"}), 404


# ─────────────────────────────────────────────
# /api/timer  – persist study time
# ─────────────────────────────────────────────

@app.route("/api/timer", methods=["POST"])
def save_timer():
    data = request.get_json(force=True)
    seconds = int(data.get("seconds", 0))
    store["study_seconds"] += seconds
    return jsonify({"msg": "Timer saved", "total_seconds": store["study_seconds"]})


# ─────────────────────────────────────────────
# /api/quiz  – AI-generated quiz
# ─────────────────────────────────────────────

@app.route("/api/quiz", methods=["POST"])
def generate_quiz():
    data = request.get_json(force=True) or {}
    subject = data.get("subject", "General Knowledge")
    num_questions = min(int(data.get("num_questions", 5)), 10)

    prompt = (
        f"Generate {num_questions} multiple-choice quiz questions about {subject} for a student.\n"
        "Return ONLY valid JSON:\n"
        '{"questions": [{"question": "...", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "..."}]}'
    )

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        quiz_data = json.loads(raw.strip())
        return jsonify(quiz_data)

    except (json.JSONDecodeError, anthropic.APIError) as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)