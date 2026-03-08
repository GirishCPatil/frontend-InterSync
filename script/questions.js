const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

// ── Auth & Premium Check ──
if (!token) {
    window.location.href = '../index.html';
} else if (!user.isPremium) {
    window.location.href = './premium.html';
}

// ── Premium Question Bank Data ──
const questions = [
    {
        id: 1,
        title: "Explain the concept of closures in JavaScript and provide a practical use case.",
        category: "JavaScript",
        difficulty: "medium",
        hint: "A closure is the combination of a function bundled together (enclosed) with references to its surrounding state (the lexical environment). Use cases include data privacy (emulating private methods) and currying."
    },
    {
        id: 2,
        title: "How does the event loop work in Node.js?",
        category: "JavaScript",
        difficulty: "hard",
        hint: "Discuss the Call Stack, the Web/Node APIs, the Callback Queue (Macrotasks), and the Microtask Queue. Mention how promises resolve before setTimeout."
    },
    {
        id: 3,
        title: "What is the Virtual DOM in React and why is it faster?",
        category: "React",
        difficulty: "medium",
        hint: "It's an in-memory representation of the real DOM. React batches updates and uses a reconciliation algorithm (diffing) to determine the minimum number of changes required, avoiding expensive browser repaints."
    },
    {
        id: 4,
        title: "Explain the difference between SQL and NoSQL databases.",
        category: "System Design",
        difficulty: "easy",
        hint: "SQL uses structured tabular relational schemas and scales vertically (usually). NoSQL (like MongoDB) is document/key-value based, schema-less, and scales horizontally well."
    },
    {
        id: 5,
        title: "How do you handle pagination in MongoDB for millions of records?",
        category: "MongoDB",
        difficulty: "hard",
        hint: "Using skip() and limit() is slow for deep pagination. Use cursor-based pagination by sorting and querying `_id > last_seen_id`."
    },
    {
        id: 6,
        title: "Design a URL shortener system like Bitly.",
        category: "System Design",
        difficulty: "medium",
        hint: "Focus on the hashing algorithm (base62 encoding), handling hash collisions, read vs write heavy loads, and caching lookups using Redis."
    },
    {
        id: 7,
        title: "Tell me about a time you had a fundamental disagreement with a colleague on a technical approach.",
        category: "Behavioral",
        difficulty: "medium",
        hint: "Use the STAR method (Situation, Task, Action, Result). Emphasize empathy, active listening, backing arguments with data, and willingness to compromise for the team's success."
    },
    {
        id: 8,
        title: "What are React Server Components?",
        category: "React",
        difficulty: "hard",
        hint: "Components that run only on the server and stream a serialized tree to the client. They reduce bundle size by keeping heavy dependencies on the server and allow direct backend access."
    }
];

// ── Render Logic ──
const container = document.getElementById('questionList');
const filters = document.getElementById('filterContainer');

function renderQuestions(filter = "All") {
    container.innerHTML = '';

    const filtered = filter === "All"
        ? questions
        : questions.filter(q => q.category === filter);

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888;">No questions found for this category.</div>';
        return;
    }

    filtered.forEach(q => {
        const difficultyClass = q.difficulty;

        const markup = `
            <div class="q-card">
                <div class="q-header">
                    <div class="q-title">${q.title}</div>
                    <div class="q-tags">
                        <span class="q-tag tag-category">${q.category}</span>
                        <span class="q-tag tag-difficulty ${difficultyClass}">${q.difficulty.toUpperCase()}</span>
                    </div>
                </div>
                <button class="q-hint-toggle" onclick="toggleHint(${q.id}, this)">
                    💡 Show Answer Hint
                </button>
                <div class="q-hint" id="hint-${q.id}">${q.hint}</div>
            </div>
        `;
        container.innerHTML += markup;
    });
}

// Expose toggleHint to global scope so inline onclick works
window.toggleHint = function (id, btnElement) {
    const hintDiv = document.getElementById(`hint-${id}`);
    const isShowing = hintDiv.classList.contains('show');

    if (isShowing) {
        hintDiv.classList.remove('show');
        btnElement.innerHTML = '💡 Show Answer Hint';
    } else {
        hintDiv.classList.add('show');
        btnElement.innerHTML = '🙈 Hide Answer Hint';
    }
};

// Filter clicking logic
filters.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
        // Remove active from all
        Array.from(filters.children).forEach(btn => btn.classList.remove('active'));

        // Add active to clicked
        e.target.classList.add('active');

        // Render
        renderQuestions(e.target.dataset.filter);
    }
});

// Initial Render
renderQuestions();
