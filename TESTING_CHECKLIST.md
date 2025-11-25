# Testing Checklist - Recurring Tasks, Notifications, Export/Import

## Environment Setup
- ✅ Backend running on `http://localhost:3000`
- ✅ Frontend running on `http://localhost:5174`
- ✅ date-fns installed in backend
- ✅ SQLite database initialized with new columns

## Feature 1: Recurring Tasks

### Backend Tests
- [ ] Create task with recurrence pattern
  - [ ] Create daily recurring task
  - [ ] Create weekly recurring task
  - [ ] Create monthly recurring task
  - [ ] Create custom interval task
- [ ] Verify recurrence data persisted in database
  - [ ] Check `recurrence` column contains JSON
  - [ ] Check `next_recurrence_due` has calculated date
  - [ ] Check `original_id` is set for tracking
- [ ] Complete recurring task triggers next occurrence
  - [ ] Verify next task is auto-created
  - [ ] Verify subtasks are reset
  - [ ] Verify new task has same properties (tags, priority, etc.)
- [ ] Recurrence ends when end date reached
  - [ ] Set end date on recurring task
  - [ ] Complete task after end date
  - [ ] Verify no new task created

### Frontend Tests
- [ ] Recurrence selector button appears in task form
  - [ ] Click "Recurrence" button opens modal
  - [ ] Modal displays recurrence options
- [ ] Set recurrence pattern for new task
  - [ ] Select daily/weekly/monthly
  - [ ] Set custom interval
  - [ ] Set end date (optional)
  - [ ] Apply recurrence - button shows selected type
  - [ ] Clear recurrence - button resets
- [ ] Task list displays recurrence badge
  - [ ] Badge shows "🔄 daily"
  - [ ] Badge shows "🔄 weekly"
  - [ ] Badge shows "🔄 monthly"
- [ ] Complete recurring task - next occurrence appears
  - [ ] Double-click to complete task
  - [ ] New task appears in list with same properties
  - [ ] New task shows next due date

## Feature 2: Browser Notifications

### Backend Tests
- [ ] Notification endpoints accessible
  - [ ] GET `/api/notifications/pending` returns array
  - [ ] POST `/api/notifications/schedule` creates notification
  - [ ] PATCH `/api/notifications/:id/sent` updates status
  - [ ] DELETE `/api/notifications/:id` removes notification
- [ ] Notifications stored in database
  - [ ] Verify `notifications` table created
  - [ ] Verify notification records persist
  - [ ] Check status updates work (pending → sent)
- [ ] Notifications calculated for due times
  - [ ] Task with time 14:30 creates notification 10min before (14:20)
  - [ ] Past due times don't create notifications
  - [ ] Correct minutesBefore calculation

### Frontend Tests
- [ ] Browser notification permission requested
  - [ ] Permission dialog appears on first load
  - [ ] Can grant or deny permission
- [ ] Notification polling starts
  - [ ] Polls every 30 seconds when permission granted
  - [ ] Makes GET request to `/api/notifications/pending`
- [ ] Browser notifications displayed
  - [ ] Notification appears in system tray
  - [ ] Shows correct task title
  - [ ] Shows reminder message
- [ ] Mark notification as sent
  - [ ] When shown, PATCH request sent
  - [ ] Notification removed from pending list
- [ ] Notification click focus app
  - [ ] Click notification brings app to foreground
  - [ ] Closes notification after click

## Feature 3: Export/Import

### Backend Tests
- [ ] Export endpoint with JSON format
  - [ ] GET `/api/export?format=json` returns data
  - [ ] Includes all todos with properties
  - [ ] Includes all tags
  - [ ] Proper JSON structure
  - [ ] Content-Disposition header set for download
- [ ] Export endpoint with CSV format
  - [ ] GET `/api/export?format=csv` returns data
  - [ ] CSV has headers
  - [ ] Proper comma escaping
  - [ ] Content-Type: text/csv
- [ ] Import endpoint - merge mode
  - [ ] POST `/api/import` with merge mode
  - [ ] Existing tags not duplicated
  - [ ] New tags created
  - [ ] Existing todos updated or kept
  - [ ] Tag mapping maintained
- [ ] Import endpoint - replace mode
  - [ ] POST `/api/import` with replace mode
  - [ ] Clears existing todos (except tags)
  - [ ] Imports new todos from file
  - [ ] Tag deduplication still works
- [ ] Data validation on import
  - [ ] Invalid JSON rejected
  - [ ] Missing required fields handled gracefully
  - [ ] Subtasks properly reconstructed

### Frontend Tests
- [ ] Export/Import button in top bar
  - [ ] Button visible in header
  - [ ] Button click opens modal
- [ ] Export functionality
  - [ ] Select JSON format
  - [ ] Select CSV format
  - [ ] Click download
  - [ ] File downloaded to computer
  - [ ] File contains correct data
- [ ] Import functionality
  - [ ] Click import section
  - [ ] Select merge mode
  - [ ] Select replace mode
  - [ ] File picker opens
  - [ ] Select JSON file
  - [ ] Import completes
  - [ ] Success message shown (auto-dismiss after 3s)
  - [ ] Todos list refreshed with imported data
- [ ] Error handling
  - [ ] Invalid file rejected with error message
  - [ ] Network error shows message
  - [ ] Empty file handled gracefully

## Integration Tests

- [ ] All three features work together
  - [ ] Create recurring task with tags
  - [ ] Set notification for recurring task
  - [ ] Export data including recurring tasks and notifications
  - [ ] Import data restores all properties
- [ ] UI consistency
  - [ ] Theme colors applied correctly
  - [ ] Responsive design maintained
  - [ ] Mobile view works
- [ ] Data persistence
  - [ ] Refresh page - recurring tasks still show
  - [ ] Refresh page - recurrence badge still shows
  - [ ] Refresh page - can still edit/delete
  - [ ] Browser notifications setting persists

## Performance Tests

- [ ] Notification polling doesn't lag UI
  - [ ] 30-second interval reasonable
  - [ ] No memory leaks over time
- [ ] Export/import handles large datasets
  - [ ] 100+ todos export quickly
  - [ ] 100+ tags import without issues
- [ ] Recurrence calculations are fast
  - [ ] Creating task with recurrence sub-100ms
  - [ ] Completing recurring task sub-100ms

## Edge Cases

- [ ] Leap year handling for recurrence
- [ ] Timezone handling for notifications
- [ ] Import file with duplicate IDs
- [ ] Recurrence end date in past
- [ ] Notification for task with no due time
- [ ] Export with special characters in task names
- [ ] Import with missing notification data
