# Developer Quick Reference - Splitwise Implementation

## Current State Summary

**Phase 1:** 95% Complete ✅  
**Phases 2-6:** Foundation laid, UI implementation remaining

---

## Key Architecture Decisions

### Toast Notifications
```javascript
// Usage everywhere:
import useToast from '../../hooks/useToast.js';

const component = () => {
  const toast = useToast();
  
  toast.success("Action completed!");     // Green, 3s
  toast.error("Something failed!");       // Red, 5s
  toast.warning("Be careful!");           // Orange, 4s
  toast.info("Just so you know...");      // Blue, 3s
};
```

### Group Management Pattern
```javascript
// All group operations available via:
const { updateGroup, deleteGroup, addGroupMember, removeGroupMember } = useExpenses();

// Example:
await updateGroup(groupId, { name: "New Name", type: "trip" });
```

### Settlement Recording (Auto)
```javascript
// When settleDue is called, automatically:
// 1. Marks participant as 'paid' in expense
// 2. Creates Settlement record in database
// 3. Records from, to, amount, date, description
// No manual action needed!
```

---

## What to Build Next (Recommended Order)

### 1. Date Picker Integration (30 mins)

**File:** `client/components/expense/ExpenseForm.jsx`

```javascript
// Add to form after description field:
<Input
  name="expenseDate"
  label="Date"
  type="date"
  value={form.expenseDate}  // Add to useState
  onChange={onChange}
  required
/>

// Update canSubmit to include expenseDate
// Pass to addExpense/updateExpense: { ...form, date: new Date(form.expenseDate) }
```

### 2. Category Filter (45 mins)

**File:** `client/components/expense/ExpenseList.jsx`

```javascript
// Add state:
const [selectedCategory, setSelectedCategory] = useState(null);

// Add filter UI before list:
<div className="chips" style={{ marginBottom: 16 }}>
  <button 
    className={`chip${!selectedCategory ? ' primary' : ''}`}
    onClick={() => setSelectedCategory(null)}
  >
    All
  </button>
  {CATEGORIES.map(cat => (
    <button
      key={cat}
      className={`chip${selectedCategory === cat ? ' primary' : ''}`}
      onClick={() => setSelectedCategory(cat)}
    >
      {cat}
    </button>
  ))}
</div>

// Filter expenses:
const filtered = selectedCategory 
  ? expenses.filter(e => e.category === selectedCategory)
  : expenses;

// Render filtered expenses
```

### 3. Skeleton Loaders (20 mins)

**File:** `client/components/expense/ExpenseList.jsx`

```javascript
import Skeleton from '../ui/Skeleton.jsx';

// In render, while loading show skeletons:
{loading ? (
  <>
    <Skeleton />
    <Skeleton />
    <Skeleton />
  </>
) : (
  // existing list code
)}
```

### 4. Search Bar (1 hour)

**File:** `client/components/dashboard/DashboardPage.jsx`

```javascript
// Add state:
const [searchTerm, setSearchTerm] = useState('');

// Filter function:
const filteredExpenses = useMemo(() => {
  return expenses.filter(e => 
    e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.paidBy?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [expenses, searchTerm]);

// Render search input + filtered results
```

### 5. Split Type Implementation (2-3 hours)

**File:** `client/components/expense/ExpenseForm.jsx`

```javascript
// Add state:
const [splitType, setSplitType] = useState('equal');
const [percentages, setPercentages] = useState({});

// Show UI based on type:
{splitType === 'percentage' && (
  participants.map(p => (
    <Input
      key={p}
      label={`${p} - Percentage`}
      type="number"
      min="0"
      max="100"
      value={percentages[p] || 0}
      onChange={(e) => setPercentages({...percentages, [p]: e.target.value})}
    />
  ))
)}

// Backend: Create split functions in server/services/split.service.js
```

---

## Common Patterns to Reuse

### Form Pattern
```javascript
const [form, setForm] = useState({field: ''});

const onChange = (e) => {
  clearError();
  setForm(prev => ({...prev, [e.target.name]: e.target.value}));
};

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await action(form);
    toast.success("Success!");
    if (onSuccess) onSuccess();
  } catch (err) {
    toast.error(error || "Failed");
  }
};
```

### Modal Pattern
```javascript
const [activeModal, setActiveModal] = useState(null);

<Modal isOpen={activeModal === 'key'} onClose={() => setActiveModal(null)}>
  <Component />
</Modal>
```

### Chips Pattern
```javascript
<div className="chips">
  {items.map(item => (
    <div key={item} className="chip primary">
      {item}
      <span onClick={() => remove(item)}>×</span>
    </div>
  ))}
</div>
```

---

## Database Query Helpers

### Get settlements for user
```javascript
// GET /api/settlements/history/mine
const settlements = await fetch('/api/settlements/history/mine');
```

### Update group
```javascript
// PUT /api/groups/:id
const updated = await fetch(`/api/groups/${id}`, {
  method: 'PUT',
  body: JSON.stringify({name, type})
});
```

### Delete group
```javascript
// DELETE /api/groups/:id
await fetch(`/api/groups/${id}`, {method: 'DELETE'});
```

---

## Files You'll Be Modifying Most

1. `client/components/expense/ExpenseForm.jsx` - For date/split features
2. `client/components/expense/ExpenseList.jsx` - For filters/skeletons
3. `client/components/dashboard/DashboardPage.jsx` - For search/modals
4. `client/styles/global.css` - For responsive tweaks
5. `client/utils/export.js` - For more export formats
6. `server/services/split.service.js` - For split calculations

---

## Testing Checklist

```
Phase 1 Features:
☐ Create expense → shows toast
☐ Edit expense → modal opens, updates work
☐ Delete expense → confirmation, removes
☐ Create group → works
☐ Edit group → name/type updates
☐ Delete group → archived
☐ Add member → appears in list
☐ Remove member → disappears
☐ Settle due → records settlement

Phase 2-3 (When Built):
☐ Select date when creating
☐ Filter by category
☐ Search by description
☐ Choose split type
☐ Assign percentages
☐ View settlement history
☐ Export to CSV

Phase 5 (When Built):
☐ Skeletons show while loading
☐ Dark mode toggle works
☐ Mobile responsive (375px)
☐ Error messages user-friendly
```

---

## Common Issues & Solutions

### Toast not showing
**Solution:** Verify `<Toast />` in App.jsx and toast store creates properly

### Edit modal not opening
**Solution:** Check `onEdit={openEditExpense}` prop passed to ExpenseList

### Group delete not working
**Solution:** Verify DELETE route in `group.routes.js` and updateGroup/deleteGroup in store

### Settlement not recording
**Solution:** Check Settlement model imported in expense controller

### Imports failing
**Solution:** Verify file paths match exactly (case-sensitive), use `.js` extension

---

## Performance Optimization Tips

1. **Memoization:** Use `useMemo` for filtered lists
2. **Lazy Load:** Use React.lazy for modals/heavy components
3. **Virtualization:** For very long lists, use `react-window`
4. **Debounce:** Search input with 300ms debounce
5. **Pagination:** Add pagination for 100+ expenses

---

## CSS Classes Ready to Use

```css
/* Layouts */
.stack          /* flex column with gap */
.stack-lg       /* larger gap */
.flex           /* flex container */
.items-center   /* align-items: center */
.justify-between /* space-between */

/* Colors */
--primary       /* Teal */
--success       /* Green */
--danger        /* Red */
--warning       /* Orange */
--muted         /* Gray text */

/* Components */
.badge          /* Status badges */
.badge-green    /* Green badge */
.badge-red      /* Red badge */
.chip           /* Selectable items */
.chip.primary   /* Selected chip */
.banner         /* Messages */
.banner.error   /* Error message */
.banner.success /* Success message */
```

---

## Deployment Checklist

Before going to production:
- [ ] All Phase 1 features tested
- [ ] Error handling on all API calls
- [ ] Toast notifications on all user actions
- [ ] Mobile responsiveness verified
- [ ] Database migrations run
- [ ] Environment variables set
- [ ] API rate limiting enabled
- [ ] CORS properly configured
- [ ] Error logging setup (Sentry)
- [ ] Analytics tracking added

---

## Support & Documentation

- **Implementation Plan:** `.claude/plans/groovy-roaming-pixel.md`
- **Progress Report:** `IMPLEMENTATION_PROGRESS.md`
- **Setup Guide:** `SETUP_GUIDE.md` (this document)
- **Original Plan:** Covered all 6 phases in detail

---

## Key Reminders

✅ Always use `toast` for user feedback  
✅ Test on mobile (375px width)  
✅ Validate permissions on backend  
✅ Pre-populate forms when editing  
✅ Show confirmation for destructive actions  
✅ Keep loading/error states updated  
✅ Export data when requested  
✅ Track settlements automatically  

---

Good luck! The foundation is solid. Focus on UI implementation and testing. 🚀
