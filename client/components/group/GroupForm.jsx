import { useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth.js";
import useExpenses from "../../hooks/useExpenses.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import { normalizeEmail, isValidEmail } from "../../utils/validation.js";
import { getCategoryEmoji } from "../../utils/categoryUtils.js";

const GROUP_TYPES = [
  { value: "trip", label: "🚞Trip" },
  { value: "home", label: "🏠Home" },
  { value: "couple", label: "💓Couple" },
  { value: "office", label: "💼Office" },
  { value: "friends", label: "🫂Friends" },
  { value: "other", label: "Other" }
];

const EXPENSE_CATEGORIES = [
  { label: "Food" },
  { label: "Travel" },
  { label: "Events" },
  { label: "Utilities" },
  { label: "Shopping" },
];

export default function GroupForm({ onSuccess }) {
  const { user } = useAuth();
  const { createGroup, addExpense, loading, error, clearError } = useExpenses();

  const currentUserEmail = normalizeEmail(user?.email || sessionStorage.getItem("email") || "");

  const [name, setName] = useState("");
  const [type, setType] = useState("other");
  const [description, setDescription] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [success, setSuccess] = useState("");
  const [localError, setLocalError] = useState("");
  const [warning, setWarning] = useState("");

  // Expense form state
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState("equal");

  const allMembers = useMemo(() => {
    const unique = [...new Set(members.map(normalizeEmail))];
    return currentUserEmail ? [currentUserEmail, ...unique] : unique;
  }, [members, currentUserEmail]);

  // ➕ Add member
  const handleAddMember = () => {
    const email = normalizeEmail(memberInput);

    setLocalError("");
    setSuccess("");

    if (!email) {
      setLocalError("Enter an email");
      return;
    }

    if (!isValidEmail(email)) {
      setLocalError("Invalid email format");
      return;
    }

    if (email === currentUserEmail) {
      setLocalError("You are already included");
      setMemberInput("");
      return;
    }

    if (members.includes(email)) {
      setLocalError("Already added");
      setMemberInput("");
      return;
    }

    setMembers((prev) => [...prev, email]);
    setMemberInput("");
  };

  // ❌ Remove
  const removeMember = (email) => {
    setMembers((prev) => prev.filter((m) => m !== email));
  };

  // 🚀 Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    setSuccess("");
    setLocalError("");
    setWarning("");
    clearError();

    if (!name.trim()) {
      setLocalError("Group name is required");
      return;
    }

    if (members.length === 0) {
      setLocalError("Add at least one member");
      return;
    }

    // Validate expense form if shown
    if (showExpenseForm) {
      if (!expenseDescription.trim()) {
        setLocalError("Expense description is required");
        return;
      }
      if (!expenseAmount || isNaN(expenseAmount) || Number(expenseAmount) <= 0) {
        setLocalError("Please enter a valid expense amount");
        return;
      }
      if (!expensePaidBy) {
        setLocalError("Please select who paid for the expense");
        return;
      }
    }

    try {
      const result = await createGroup({
        name: name.trim(),
        type,
        description: description.trim(),
        members,
      });

      const groupId = result?.group?._id || result?.group?.id;

      // Add initial expense if requested
      if (showExpenseForm && groupId) {
        try {
          const participants = allMembers;
          await addExpense({
            description: expenseDescription.trim(),
            amount: Number(expenseAmount),
            groupId,
            paidBy: expensePaidBy,
            participants,
            category: expenseCategory,
            splitType: expenseSplitType,
          });
          setSuccess("Group and initial expense created successfully!");
        } catch (expenseError) {
          console.error("Error adding initial expense:", expenseError);
          setWarning("Group created, but failed to add initial expense");
        }
      } else {
        // Check if backend returned a warning about existing group
        if (result?.warning) {
          setWarning(result.warning);
          setSuccess("Group created successfully");
        } else {
          setSuccess("Group created successfully");
        }
      }

      // Reset form
      setName("");
      setType("other");
      setDescription("");
      setMembers([]);
      setShowExpenseForm(false);
      setExpenseDescription("");
      setExpenseAmount("");
      setExpenseCategory("");
      setExpensePaidBy("");
      setExpenseSplitType("equal");

      if (onSuccess) {
        onSuccess();
      }
    } catch (_) {}
  };

  const totalPeople = allMembers.length;
  const displayTitle = name.trim() || "Untitled group";

  return (
    <Card title="Create Group" subtitle="Split expenses with your crew">
      <form className="stack" onSubmit={handleSubmit}>

        {/* Group Name */}
        <Input
          label="Group Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Flatmates April"
          required
        />

        {/* Description */}
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Monthly rent and utilities"
          multiline
        />

        <div className="input-block">
          <span className="input-label">Group Type</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {GROUP_TYPES.map((groupType) => (
              <option key={groupType.value} value={groupType.value}>
                {groupType.label}
              </option>
            ))}
          </select>
        </div>

        <div className="group-setup-preview">
          <div className="group-setup-preview-title">{displayTitle}</div>
          <div className="group-setup-preview-meta">
            <span className="badge badge-violet">Type: {GROUP_TYPES.find(gt => gt.value === type)?.label || type}</span>
            <span className="badge badge-green">People: {totalPeople}</span>
          </div>
        </div>

        {/* Members Section */}
        <div className="section">
          <label className="label">Members</label>

          {/* Input Row */}

          <div className="row">
            <input
              type="email"
              className="input"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="Enter email"
            />
            <Button type="button" onClick={handleAddMember}>
              Add
            </Button>
          </div>

          {localError && <p className="banner error">{localError}</p>}

          <div className="chips">
            {currentUserEmail && (
              <div className="chip primary">
                You
                <span className="chip-sub">{currentUserEmail}</span>
              </div>
            )}

            {members.map((email) => (
              <div key={email} className="chip">
                {email}
                <span onClick={() => removeMember(email)}>×</span>
              </div>
            ))}
          </div>

          {allMembers.length > 0 && (
            <p className="text-sm muted" style={{ marginTop: 8 }}>
              People in this group ({totalPeople}): {allMembers.join(' · ')}
            </p>
          )}
        </div>

        {/* Initial Expense Section */}
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <input
              type="checkbox"
              id="add-initial-expense"
              checked={showExpenseForm}
              onChange={(e) => setShowExpenseForm(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="add-initial-expense" style={{ cursor: 'pointer', fontWeight: '500' }}>
              Add initial expense
            </label>
          </div>
          <p className="text-sm muted" style={{ marginTop: '-8px', marginBottom: '8px' }}>
            Perfect for recording the first expense right after creating a group (e.g., trip booking, initial supplies)
          </p>

          {showExpenseForm && (
            <div style={{
              padding: '16px',
              background: 'var(--bg2)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              marginTop: '8px'
            }}>
              <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                Initial Expense Details
              </div>

              <Input
                label="Description"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="What was this for?"
                required={showExpenseForm}
                style={{ marginBottom: '12px' }}
              />

              <Input
                label="Amount (₹)"
                type="number"
                min="1"
                step="0.01"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="1000"
                required={showExpenseForm}
                style={{ marginBottom: '12px' }}
              />

              <div style={{ marginBottom: '12px' }}>
                <span className="input-label">Category</span>
                <div className="chips" style={{ marginTop: 6 }}>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.label}
                      type="button"
                      className={`chip${expenseCategory === cat.label ? " primary" : ""}`}
                      onClick={() => setExpenseCategory(prev => prev === cat.label ? "" : cat.label)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span className="input-label">Paid by</span>
                <select
                  className="input"
                  value={expensePaidBy}
                  onChange={(e) => setExpensePaidBy(e.target.value)}
                  required={showExpenseForm}
                  style={{ marginTop: 4 }}
                >
                  <option value="">Select who paid</option>
                  {allMembers.map((email) => (
                    <option key={email} value={email}>
                      {email === currentUserEmail ? `You (${email})` : email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="input-label">Split Type</span>
                <div className="chips" style={{ marginTop: 6 }}>
                  {[
                    { label: 'Equal', value: 'equal' },
                    { label: 'Exact', value: 'exact' },
                    { label: 'Percentage', value: 'percentage' }
                  ].map((split) => (
                    <button
                      key={split.value}
                      type="button"
                      className={`chip${expenseSplitType === split.value ? " primary" : ""}`}
                      onClick={() => setExpenseSplitType(split.value)}
                    >
                      {split.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm muted" style={{ marginTop: 12 }}>
                {expenseSplitType === 'equal'
                  ? (() => {
                      const splitCount = expensePaidBy
                        ? allMembers.filter(email => email !== expensePaidBy).length + 1
                        : allMembers.length;
                      const perPerson = (Number(expenseAmount) / splitCount).toFixed(2);
                      return `Splitting ₹${expenseAmount || 0} equally among ${splitCount} people (₹${perPerson}/person)`;
                    })()
                  : expenseSplitType === 'exact'
                  ? `Enter exact amounts for each person (total: ₹${expenseAmount || 0})`
                  : expenseSplitType === 'percentage'
                  ? `Enter percentage for each person (total: 100%)`
                  : `Custom split for ₹${expenseAmount || 0}`}
              </p>
            </div>
          )}
        </div>

        {error && <p className="banner error">{error}</p>}
        {warning && <p className="banner warning">{warning}</p>}
        {success && <p className="banner success">{success}</p>}

        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Creating..." : (showExpenseForm ? "Create Group & Add Expense" : "Create Group")}
        </Button>
      </form>
    </Card>
  );
}