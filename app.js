class NoteApp {
    constructor() {
        this.notes = this.loadNotes();
        this.initEventListeners();
        this.renderNotes();
    }

    initEventListeners() {
        const addBtn = document.getElementById('addNoteBtn');
        const titleInput = document.getElementById('noteTitle');
        const contentInput = document.getElementById('noteContent');

        addBtn.addEventListener('click', () => this.addNote());

        // Allow Enter key in title to add note
        titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addNote();
            }
        });

        // Allow Ctrl+Enter in content to add note
        contentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.addNote();
            }
        });
    }

    loadNotes() {
        const storedNotes = localStorage.getItem('notes');
        return storedNotes ? JSON.parse(storedNotes) : [];
    }

    saveNotes() {
        localStorage.setItem('notes', JSON.stringify(this.notes));
    }

    addNote() {
        const titleInput = document.getElementById('noteTitle');
        const contentInput = document.getElementById('noteContent');

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (!title && !content) {
            alert('Please enter a title or content for your note!');
            return;
        }

        const note = {
            id: Date.now(),
            title: title || 'Untitled Note',
            content: content,
            date: new Date().toLocaleString()
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.renderNotes();

        // Clear inputs
        titleInput.value = '';
        contentInput.value = '';
        titleInput.focus();
    }

    deleteNote(id) {
        if (confirm('Are you sure you want to delete this note?')) {
            this.notes = this.notes.filter(note => note.id !== id);
            this.saveNotes();
            this.renderNotes();
        }
    }

    renderNotes() {
        const notesList = document.getElementById('notesList');

        if (this.notes.length === 0) {
            notesList.innerHTML = `
                <div class="empty-state">
                    <p>📭 No notes yet. Start adding some!</p>
                </div>
            `;
            return;
        }

        notesList.innerHTML = this.notes.map(note => `
            <div class="note-card">
                <div class="note-header">
                    <div class="note-title">${this.escapeHtml(note.title)}</div>
                    <div class="note-date">${note.date}</div>
                </div>
                ${note.content ? `<div class="note-content">${this.escapeHtml(note.content)}</div>` : ''}
                <button class="delete-btn" onclick="app.deleteNote(${note.id})">Delete</button>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when the DOM is loaded
const app = new NoteApp();
