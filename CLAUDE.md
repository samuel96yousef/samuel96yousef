# CLAUDE.md - AI Assistant Development Guide

> **Purpose**: This document provides comprehensive guidance for AI assistants working with this codebase. It covers architecture, conventions, workflows, and best practices to ensure consistent, high-quality contributions.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Architecture & Design Patterns](#architecture--design-patterns)
4. [Code Conventions](#code-conventions)
5. [Development Workflows](#development-workflows)
6. [Testing & Quality Assurance](#testing--quality-assurance)
7. [Common Tasks](#common-tasks)
8. [Best Practices](#best-practices)
9. [Git Workflow](#git-workflow)

---

## Project Overview

**Project Name**: Simple Note App
**Type**: Client-side web application
**Tech Stack**: Vanilla HTML, CSS, JavaScript (ES6)
**Storage**: Browser localStorage API
**Deployment**: Static files (no build process required)

### Key Features

- Create notes with titles and content
- Delete notes with confirmation
- Automatic persistence via localStorage
- Responsive design for mobile and desktop
- Keyboard shortcuts for improved UX
- No external dependencies or frameworks

---

## Codebase Structure

```
samuel96yousef/
├── index.html          # Main HTML structure and DOM elements
├── style.css           # Styling, responsive design, and UI components
├── app.js              # Application logic and data management
└── README.md           # User-facing documentation
```

### File Responsibilities

#### `index.html` (28 lines)
- **Purpose**: Defines the semantic structure and UI layout
- **Key Elements**:
  - Container with max-width for centered layout
  - Note input section with title, content, and submit button
  - Notes display section with dynamic rendering area
- **Dependencies**: Links to `style.css` and `app.js`
- **Modification Guidelines**:
  - Maintain semantic HTML5 structure
  - Keep IDs consistent with JavaScript selectors
  - Preserve accessibility attributes

#### `style.css` (178 lines)
- **Purpose**: Handles all visual presentation and responsive behavior
- **Design System**:
  - Color Palette: Purple gradient (`#667eea` to `#764ba2`)
  - Typography: Segoe UI font family
  - Border Radius: 5-15px for modern look
  - Spacing: Consistent 10-30px margins/padding
- **Key Sections**:
  - Global resets (`* {}`)
  - Layout containers (`.container`)
  - Input forms (`.note-input-section`)
  - Note cards (`.note-card`)
  - Responsive breakpoints (`@media`)
- **Modification Guidelines**:
  - Maintain gradient theme consistency
  - Preserve hover/focus transitions
  - Test responsive behavior at 600px breakpoint

#### `app.js` (109 lines)
- **Purpose**: Core application logic and state management
- **Architecture**: Object-oriented ES6 class (`NoteApp`)
- **Key Responsibilities**:
  - Data persistence (localStorage)
  - Event handling (clicks, keyboard shortcuts)
  - DOM manipulation and rendering
  - Input validation and sanitization
- **Modification Guidelines**:
  - Keep class-based architecture
  - Maintain XSS protection via `escapeHtml()`
  - Preserve localStorage contract

---

## Architecture & Design Patterns

### Design Patterns Used

1. **Singleton Pattern**: Single `NoteApp` instance (`const app = new NoteApp()`)
2. **MVC-like Structure**:
   - **Model**: `this.notes` array, localStorage persistence
   - **View**: `renderNotes()` method
   - **Controller**: Event listeners and methods (`addNote()`, `deleteNote()`)

### Data Model

```javascript
// Note Object Schema
{
    id: Number,           // Unique timestamp-based ID
    title: String,        // Note title (defaults to "Untitled Note")
    content: String,      // Note content (can be empty)
    date: String          // Locale-formatted date string
}
```

### State Management

- **Storage**: Browser localStorage under key `'notes'`
- **Format**: JSON-serialized array of note objects
- **Flow**: Memory → localStorage (on mutations) → DOM (on render)
- **Initialization**: Load from localStorage on app instantiation

### Security Considerations

1. **XSS Protection**: All user input is escaped via `escapeHtml()` method (app.js:100-104)
2. **Input Validation**: Title max-length (50 chars), content required check
3. **No eval()**: No dynamic code execution
4. **Sanitization**: DOM text content API used for safe HTML escaping

---

## Code Conventions

### JavaScript Style

- **Classes**: PascalCase (`NoteApp`)
- **Methods**: camelCase (`addNote`, `renderNotes`)
- **Variables**: camelCase (`titleInput`, `contentInput`)
- **Constants**: Not used currently, but should be UPPER_SNAKE_CASE if added
- **ES6 Features**: Arrow functions, template literals, class syntax, const/let

### HTML Conventions

- **IDs**: camelCase (`noteTitle`, `noteContent`, `notesList`)
- **Classes**: kebab-case (`note-card`, `delete-btn`, `empty-state`)
- **Semantic HTML**: Use `<button>`, `<input>`, `<textarea>` appropriately
- **Accessibility**: Include descriptive placeholders

### CSS Conventions

- **Selectors**: Class-based for components, ID-based for unique elements
- **Organization**: Global → Layout → Components → Media Queries
- **Units**: `px` for borders, `em` for fonts, `%` for widths
- **Colors**: Hex codes for consistency
- **Transitions**: 0.2-0.3s for interactive elements

### Naming Patterns

- **DOM Elements**: Suffix with type (e.g., `addNoteBtn`, `titleInput`)
- **Event Handlers**: Verb-based (e.g., `addNote()`, `deleteNote()`)
- **Render Methods**: Prefix with `render` (e.g., `renderNotes()`)
- **Storage Methods**: Prefix with `save`/`load` (e.g., `saveNotes()`)

---

## Development Workflows

### Adding New Features

1. **Plan the Change**:
   - Identify affected files (HTML structure, CSS styling, JS logic)
   - Consider localStorage schema changes
   - Plan backward compatibility if needed

2. **Implement in Order**:
   - **HTML**: Add necessary DOM elements with appropriate IDs/classes
   - **CSS**: Style new elements following existing design system
   - **JavaScript**: Add logic, event listeners, and rendering

3. **Test Thoroughly**:
   - Test feature in isolation
   - Test with empty state
   - Test with multiple notes
   - Test localStorage persistence (refresh page)
   - Test keyboard shortcuts
   - Test responsive behavior

### Modifying Existing Features

1. **Read Before Editing**: Always read the entire file before making changes
2. **Preserve Contracts**: Maintain existing method signatures and localStorage schema
3. **Update All Layers**: If changing data model, update HTML, CSS, and JS consistently
4. **Regression Testing**: Ensure existing features still work

### Debugging Workflow

1. **Check Console**: Look for JavaScript errors
2. **Inspect localStorage**: Use DevTools → Application → Local Storage
3. **Verify DOM**: Ensure elements exist with correct IDs
4. **Test Event Listeners**: Check if events are properly bound
5. **Validate Data**: Inspect `this.notes` array structure

---

## Testing & Quality Assurance

### Manual Testing Checklist

**Basic Functionality**:
- [ ] Add note with title and content
- [ ] Add note with only title
- [ ] Add note with only content
- [ ] Add note with neither (should show alert)
- [ ] Delete note (confirm dialog appears)
- [ ] Cancel delete (note remains)

**Persistence**:
- [ ] Refresh page, notes persist
- [ ] Close and reopen browser, notes persist
- [ ] Clear localStorage, empty state appears

**Keyboard Shortcuts**:
- [ ] Press Enter in title field → adds note
- [ ] Press Ctrl+Enter in content area → adds note
- [ ] Focus returns to title after adding note

**Responsive Design**:
- [ ] Test at 320px width (mobile)
- [ ] Test at 600px width (breakpoint)
- [ ] Test at 1024px+ width (desktop)

**Edge Cases**:
- [ ] Add 50+ character title (should truncate)
- [ ] Add note with special characters (`<>&"'`)
- [ ] Add note with multiline content
- [ ] Render 100+ notes (performance check)

### Browser Compatibility

**Minimum Requirements**:
- ES6 JavaScript support (Chrome 51+, Firefox 54+, Safari 10+)
- localStorage API
- CSS Grid support

**Testing Browsers**:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

---

## Common Tasks

### Task: Add a New Field to Notes

**Example**: Adding a "category" field

1. **Update Data Model** (app.js:51-56):
```javascript
const note = {
    id: Date.now(),
    title: title || 'Untitled Note',
    content: content,
    category: category || 'General',  // Add this
    date: new Date().toLocaleString()
};
```

2. **Add HTML Input** (index.html:13-16):
```html
<input type="text" id="noteCategory" placeholder="Category...">
```

3. **Style Input** (style.css:43-56):
```css
#noteCategory {
    /* Copy styles from #noteTitle */
}
```

4. **Update Rendering** (app.js:88-96):
```javascript
<div class="note-category">${this.escapeHtml(note.category)}</div>
```

### Task: Add a Feature Button

**Example**: Adding an "Edit" button

1. **Add Button to Template** (app.js:95):
```javascript
<button class="edit-btn" onclick="app.editNote(${note.id})">Edit</button>
```

2. **Style Button** (style.css:140-153):
```css
.edit-btn {
    background: #5f27cd;
    /* Copy from .delete-btn and modify */
}
```

3. **Implement Method** (app.js):
```javascript
editNote(id) {
    const note = this.notes.find(n => n.id === id);
    // Implementation
}
```

### Task: Modify Styling

**Example**: Changing color scheme

1. **Update Gradient Variables**: Search for `#667eea` and `#764ba2`
2. **Replace Consistently**: Use same colors in body gradient, button gradient
3. **Adjust Hover States**: Ensure hover colors still provide good contrast
4. **Test Accessibility**: Verify text contrast ratios (WCAG AA: 4.5:1)

### Task: Fix a Bug

**Standard Approach**:

1. **Reproduce**: Verify the bug exists and note steps to reproduce
2. **Locate**: Use browser DevTools to find error source
3. **Fix**: Make minimal changes to resolve the issue
4. **Test**: Verify fix works and doesn't break other features
5. **Commit**: Write clear commit message describing the bug and fix

---

## Best Practices

### When Adding Features

1. **Keep It Simple**: Avoid over-engineering for a simple note app
2. **Match Existing Patterns**: Follow established naming and structure
3. **Preserve Performance**: Avoid unnecessary re-renders
4. **Maintain Accessibility**: Add proper labels and ARIA attributes
5. **Document Complex Logic**: Add comments for non-obvious code

### When Refactoring

1. **Don't Break localStorage**: Maintain backward compatibility with saved notes
2. **Test Before and After**: Ensure all features work identically
3. **Refactor Incrementally**: Small, testable changes
4. **Keep Class-Based**: Don't convert to functional unless necessary

### Code Quality Standards

1. **DRY Principle**: Avoid duplicating code (use methods)
2. **Single Responsibility**: Each method should do one thing
3. **Readable Names**: Descriptive variable and function names
4. **Error Handling**: Validate inputs, handle edge cases
5. **Security First**: Always escape user input before rendering

### Performance Considerations

1. **Minimize DOM Manipulation**: Batch updates, use `innerHTML` for bulk renders
2. **Efficient localStorage**: Only save when data changes
3. **Event Delegation**: Consider for future features with many elements
4. **Avoid Memory Leaks**: No persistent timers or unbound event listeners

---

## Git Workflow

### Branch Naming Convention

- **Feature branches**: `feature/description` or `add-feature-name`
- **Bug fixes**: `fix/bug-description` or `fix-bug-name`
- **AI branches**: `claude/description-sessionID` (enforced by system)

### Commit Message Format

**Structure**:
```
<type>: <short description>

<optional longer description>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `style`: CSS/styling changes
- `refactor`: Code restructuring without behavior change
- `docs`: Documentation updates
- `chore`: Maintenance tasks

**Examples**:
```
feat: Add edit note functionality

fix: Prevent XSS in note rendering by escaping HTML

style: Update color scheme to blue gradient

refactor: Extract note rendering to separate method

docs: Update README with new keyboard shortcuts
```

### Pre-Commit Checklist

- [ ] Code follows existing conventions
- [ ] No console.log statements (unless debugging)
- [ ] All features tested manually
- [ ] localStorage backward compatible
- [ ] No hardcoded values (use variables)
- [ ] Comments added for complex logic

### Push and PR Guidelines

1. **Always push to feature branch**: Use `git push -u origin <branch-name>`
2. **Branch name must match pattern**: `claude/*-sessionID` for AI commits
3. **Write descriptive PR titles**: Explain what and why
4. **Test locally first**: Never push untested code
5. **Retry on network errors**: Up to 4 times with exponential backoff (2s, 4s, 8s, 16s)

---

## Appendix: Quick Reference

### Important File Locations

- Main app class: `app.js:1-105`
- Event listeners: `app.js:8-28`
- localStorage operations: `app.js:30-37`
- Rendering logic: `app.js:76-98`
- XSS protection: `app.js:100-104`
- Responsive breakpoint: `style.css:165-177`

### Key DOM IDs

- `noteTitle`: Title input field
- `noteContent`: Content textarea
- `addNoteBtn`: Submit button
- `notesList`: Container for rendered notes

### localStorage Schema

- **Key**: `'notes'`
- **Format**: JSON array of note objects
- **Schema**: `{ id, title, content, date }`

### Color Palette

- Primary gradient: `#667eea` → `#764ba2`
- Delete button: `#ff4757`
- Text primary: `#333`
- Text secondary: `#555`
- Text muted: `#999`
- Borders: `#ddd`, `#e0e0e0`

---

**Last Updated**: 2025-12-24
**Version**: 1.0.0
**Maintainer**: AI Assistant (Claude)
