# Lifeline - Quick Start Guide (Post-Integration)

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm
- SQLite3 (included with backend)

### Installation & Running

#### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
```
✅ Backend will start on `http://localhost:3000`

#### 2. Frontend Setup (New Terminal)
```bash
cd frontend
npm install
npm run dev
```
✅ Frontend will start on `http://localhost:5174` (or next available port)

### Features Implemented

#### 1. Recurring Tasks ✅
- **Create**: Click "Recurrence" button in task form
- **Select Pattern**: Daily, Weekly, Monthly, or Custom interval
- **Set End Date**: Optional - stops recurrence after date
- **View**: Badge shows "🔄 type" on task cards
- **Auto-Continue**: Completing task auto-creates next occurrence

#### 2. Browser Notifications ✅
- **Enable**: Grant permission when prompted on first load
- **Schedule**: Notifications set for tasks with due times
- **Timing**: Default 10 minutes before due time (customizable)
- **Display**: System notifications appear automatically
- **Tracking**: Marked as sent when displayed

#### 3. Export/Import ✅
- **Access**: Click ⬇️ button in top bar
- **Export**: Choose JSON or CSV format, download your data
- **Import**: Select merge or replace mode, pick file to import
- **Merge**: Adds new tasks, deduplicates tags, keeps existing data
- **Replace**: Clears tasks, imports all from file

## Using New Features

### Create a Recurring Task
1. Fill in task title and description
2. Set due date
3. Click "Recurrence" button
4. Select recurrence type (e.g., "daily")
5. Optionally set end date
6. Click "Apply"
7. Click "Add Task"

### Manage Notifications
1. Grant browser notification permission when prompted
2. Tasks with due times automatically get notifications
3. System will notify 10 minutes before task is due
4. Click notification to focus app

### Export Your Data
1. Click ⬇️ in top bar
2. Select format: JSON (complete) or CSV (spreadsheet)
3. Click Download
4. File saves to your computer

### Import Data
1. Click ⬇️ in top bar
2. Select mode:
   - **Merge**: Combines with existing data
   - **Replace**: Overwrites all tasks
3. Click file picker and select JSON file
4. Import completes automatically

## File Structure

```
testground/
├── backend/
│   ├── src/
│   │   ├── index.js (Main server + API routes)
│   │   ├── application/
│   │   │   ├── RecurrenceService.js (NEW)
│   │   │   ├── CompleteRecurringTodo.js (NEW)
│   │   │   ├── NotificationService.js (NEW)
│   │   │   └── ...
│   │   ├── domain/
│   │   │   └── Todo.js (Updated with recurrence)
│   │   ├── infrastructure/
│   │   │   └── SQLite*.js (Updated for recurrence)
│   │   └── ...
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx (Updated - integrates all features)
│   │   ├── api.js (Updated - new API functions)
│   │   ├── RecurrenceSelector.jsx (NEW)
│   │   ├── ExportImport.jsx (NEW)
│   │   ├── TopBar.jsx (Updated - export button)
│   │   └── ...
│   └── package.json
│
├── INTEGRATION_COMPLETE.md (Feature summary)
├── TESTING_CHECKLIST.md (40+ test scenarios)
└── README.md (Original documentation)
```

## API Endpoints Reference

### Todos
- `GET /api/todos` - List all todos
- `POST /api/todos` - Create todo (supports `recurrence` parameter)
- `PATCH /api/todos/:id` - Update todo
- `DELETE /api/todos/:id` - Delete todo

### Notifications (NEW)
- `GET /api/notifications/pending` - Get notifications ready to show
- `POST /api/notifications/schedule` - Schedule notification for task
- `PATCH /api/notifications/:id/sent` - Mark notification as sent
- `DELETE /api/notifications/:id` - Remove notification

### Export/Import (NEW)
- `GET /api/export?format=json|csv` - Export all data
- `POST /api/import` - Import data (merge or replace mode)

### Tags
- `GET /api/tags` - List all tags
- `POST /api/tags` - Create tag
- And more...

## Database Schema (Updated)

### Todos Table (New Columns)
```sql
CREATE TABLE todos (
  -- ... existing columns ...
  recurrence TEXT,           -- JSON: {type, interval, endDate}
  next_recurrence_due TEXT,  -- ISO date string
  original_id TEXT           -- References parent recurring task
);
```

### Notifications Table (NEW)
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  todoId TEXT,
  todoTitle TEXT,
  title TEXT,
  message TEXT,
  scheduledTime TEXT,        -- ISO datetime
  status TEXT,               -- 'pending' or 'sent'
  createdAt TEXT
);
```

## Keyboard Shortcuts

- **Cmd/Ctrl + N**: Focus task input (existing)
- **Enter**: Add task (existing)
- **Escape**: Cancel editing (existing)

## Troubleshooting

### Backend won't start
```bash
# Clear database and restart
rm backend/todos_v4.db
npm run dev
```

### Frontend can't connect to backend
- Ensure backend is running on `localhost:3000`
- Check CORS settings in `backend/src/index.js`
- Open browser console (F12) for error messages

### Notifications not appearing
- Check browser console for permission status
- Ensure notification permission is granted
- Backend must be running
- Try a task with due time in next 30 seconds

### Export/Import issues
- Ensure JSON file is valid
- File should contain `todos` and `tags` arrays
- Check browser console for detailed errors

## Development Commands

### Backend
```bash
npm run dev        # Development with hot-reload
npm start          # Production
npm test           # Run tests
```

### Frontend
```bash
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Check code style
```

## Code Quality

- ✅ Clean Architecture (Domain/Application/Infrastructure)
- ✅ Repository Pattern for data access
- ✅ Service Pattern for business logic
- ✅ Input validation on all endpoints
- ✅ Error handling throughout
- ✅ Theme system integration
- ✅ Responsive design
- ✅ Performance optimized

## Next Steps

1. **User Testing**: See `TESTING_CHECKLIST.md` for test scenarios
2. **Customization**: Modify recurrence patterns, notification timing, etc.
3. **Deployment**: Build frontend with `npm run build` and deploy
4. **Monitoring**: Check backend logs for errors
5. **Scaling**: Consider adding authentication and multi-user support

## Support & Documentation

- `INTEGRATION_COMPLETE.md` - Complete feature documentation
- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details
- `TESTING_CHECKLIST.md` - Comprehensive test scenarios
- `FEATURES.md` - Feature list and status
- Backend code comments - Detailed inline documentation

## Performance Tips

- Notification polling (30s interval) is optimized for battery life
- Large exports use streaming for efficiency
- Recurrence calculations are cached
- Database queries are optimized with proper indexes

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-25  
**Status**: ✅ Production Ready
