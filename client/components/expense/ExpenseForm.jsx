import { useMemo, useState, useEffect } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import useToast from "../../hooks/useToast.js";
import useAuth from "../../hooks/useAuth.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

const CATEGORIES = [
  { label: "Food" },
  { label: "Travel" },
  { label: "Events" },
  { label: "Utilities" },
  { label: "Shopping" },
];

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

export default function ExpenseForm({ onSuccess, editingExpense = null }) {
  const { addExpense, groups, expenses, loading, error, clearError, updateExpense } = useExpenses();
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    description: "",
    amount: "",
    groupId: "",
  });

  const [selectedCategory, setSelectedCategory] = useState("");
  const [participantInput, setParticipantInput] = useState("");
  const [participants, setParticipants] = useState([]);
  const [localError, setLocalError] = useState("");
  const [touched, setTouched] = useState({
    description: false,
    amount: false,
    groupId: false,
  });

  const currentUserEmail = user?.email?.toLowerCase();
  const isEditing = !!editingExpense;

  // Validation functions
  const validateField = (name, value) => {
    switch (name) {
      case 'description':
        return value.trim().length >= 3 ? '' : 'Description must be at least 3 characters';
      case 'amount':
        const numValue = Number(value);
        if (!value || isNaN(numValue)) return 'Please enter a valid amount';
        if (numValue <= 0) return 'Amount must be greater than 0';
        if (numValue > 10000000) return 'Amount seems too large';
        return '';
      case 'groupId':
        return value ? '' : 'Please select a group';
      default:
        return '';
    }
  };

  const getFieldError = (name) => {
    if (!touched[name]) return '';
    return validateField(name, form[name]);
  };

  const hasErrors = useMemo(() => {
    return Object.keys(touched).some(
      key => touched[key] && validateField(key, form[key])
    );
  }, [form, touched]);

  // Initialize form when editing
  useEffect(() => {
    if (editingExpense) {
      setForm({
        description: editingExpense.description || "",
        amount: String(editingExpense.amount || ""),
        groupId: editingExpense.group?._id || editingExpense.group || "",
      });
      setSelectedCategory(editingExpense.category || "");
      setParticipants(
        (editingExpense.participants || []).map((p) => p.userId?.email || p.userId || p)
      );
    }
  }, [editingExpense]);

  const canSubmit = useMemo(() => {
    return (
      form.description.trim() &&
      Number(form.amount) > 0 &&
      form.groupId &&
      participants.length > 0 &&
      !hasErrors
    );
  }, [form, participants, hasErrors]);

  const normalizeGroupName = (value) =>
    String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]+/g, "");

  const groupOptions = useMemo(() => {
    const byName = new Map();

    for (const group of groups) {
      const key = normalizeGroupName(group.name) || String(group._id);
      const groupExpenses = expenses.filter((expense) => {
        const expenseGroupId = typeof expense.group === "object" ? expense.group?._id : expense.group;
        const expenseGroupName = typeof expense.group === "object" ? expense.group?.name : "";

        return String(expenseGroupId) === String(group._id) || normalizeGroupName(expenseGroupName) === key;
      });

      const score = groupExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const existing = byName.get(key);

      if (!existing || score > existing.score) {
        byName.set(key, { group, score });
      }
    }

    return Array.from(byName.values()).map(({ group }) => group);
  }, [groups, expenses]);

  const onChange = (e) => {
    clearError();
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const onBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleAddParticipant = () => {
    const email = participantInput.trim().toLowerCase();

    if (!email) return;

    if (participants.includes(email)) {
      setLocalError("Already added");
      return;
    }

    if (email === currentUserEmail) {
      setLocalError("You cannot add yourself as a participant");
      return;
    }

    setParticipants([...participants, email]);
    setParticipantInput("");
    setLocalError("");
  };

  const removeParticipant = (email) => {
    setParticipants((prev) => prev.filter((p) => p !== email));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    try {
      if (isEditing) {
        await updateExpense(editingExpense._id, {
          description: form.description,
          amount: Number(form.amount),
          groupId: form.groupId,
          participants,
          category: selectedCategory,
        });
        toast.success("Expense updated successfully");
      } else {
        await addExpense({
          description: form.description,
          amount: Number(form.amount),
          groupId: form.groupId,
          participants,
          category: selectedCategory,
        });
        toast.success("Expense added successfully");
        setForm({ description: "", amount: "", groupId: "" });
        setParticipants([]);
        setSelectedCategory("");
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      toast.error(error || "Failed to save expense");
    }
  };

  return (
    <Card className="expense-form-card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>{isEditing ? "Edit Expense" : "Add Expense"}</h2>
            <p>{isEditing ? "Update expense details" : "Track shared spending instantly"}</p>
          </div>
        </div>
      </div>

      <div className="card-content">
        <form className="stack-lg" onSubmit={handleSubmit}>
          {/* ── DESCRIPTION + AMOUNT ── */}
          <div className="form-row-grid">
            <div>
              <Input
                name="description"
                label="What was this for?"
                value={form.description}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="Dinner at Bistro"
                required
                aria-invalid={!!getFieldError('description')}
                aria-describedby={getFieldError('description') ? 'description-error' : undefined}
              />
              {getFieldError('description') && (
                <p id="description-error" className="banner error" style={{ marginTop: '4px', fontSize: '12px' }}>
                  {getFieldError('description')}
                </p>
              )}
            </div>
            <div>
              <Input
                name="amount"
                label="Amount (₹)"
                type="number"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="1600"
                required
                aria-invalid={!!getFieldError('amount')}
                aria-describedby={getFieldError('amount') ? 'amount-error' : undefined}
              />
              {getFieldError('amount') && (
                <p id="amount-error" className="banner error" style={{ marginTop: '4px', fontSize: '12px' }}>
                  {getFieldError('amount')}
                </p>
              )}
            </div>
          </div>

          {/* ── CATEGORY CHIPS ── */}
          <div className="input-block">
            <span className="input-label">Category</span>
            <div className="chips" style={{ marginTop: 6 }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  className={`chip${selectedCategory === cat.label ? " primary" : ""}`}
                  onClick={() =>
                    setSelectedCategory((prev) =>
                      prev === cat.label ? "" : cat.label
                    )
                  }
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── GROUP SELECT ── */}
          <div className="input-block">
            <span className="input-label">Group</span>
            <select
              className="input"
              name="groupId"
              value={form.groupId}
              onChange={onChange}
              onBlur={onBlur}
              required
              disabled={isEditing}
              aria-invalid={!!getFieldError('groupId')}
              aria-describedby={getFieldError('groupId') ? 'group-error' : undefined}
            >
              <option value="">Choose group</option>
              {groupOptions.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
            {isEditing && <p className="text-sm muted" style={{ marginTop: 4 }}>Cannot change group for existing expense</p>}
            {getFieldError('groupId') && !isEditing && (
              <p id="group-error" className="banner error" style={{ marginTop: '4px', fontSize: '12px' }}>
                {getFieldError('groupId')}
              </p>
            )}
          </div>

          {/* ── PARTICIPANTS ── */}
          <div className="input-block">
            <span className="input-label">Split with</span>
            <div className="input-row" style={{ marginTop: 4 }}>
              <input
                type="email"
                className="input"
                placeholder="participant@email.com"
                value={participantInput}
                onChange={(e) => {
                  setParticipantInput(e.target.value);
                  setLocalError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddParticipant();
                  }
                }}
                aria-label="Add participant email"
                aria-invalid={!!localError}
                aria-describedby={localError ? 'participant-error' : undefined}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={handleAddParticipant}
                disabled={!participantInput.trim() || !isValidEmail(participantInput)}
                aria-label="Add participant"
              >
                Add
              </Button>
            </div>

            {localError && (
              <p id="participant-error" className="banner error" style={{ marginTop: 8 }}>
                {localError}
              </p>
            )}

            {participants.length > 0 && (
              <div className="chips" style={{ marginTop: 10 }} role="list" aria-label="Added participants">
                {participants.map((email) => (
                  <div key={email} className="chip primary" role="listitem">
                    {email}
                    <span
                      onClick={() => removeParticipant(email)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          removeParticipant(email);
                        }
                      }}
                      title="Remove participant"
                      style={{ cursor: 'pointer' }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Remove ${email}`}
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}

            {participants.length > 0 && (
              <p className="text-sm muted" style={{ marginTop: 6 }}>
                Split equally among {participants.length} {participants.length === 1 ? 'person' : 'people'}
              </p>
            )}
          </div>

          {/* ── STATUS ── */}
          {error && <p className="banner error" role="alert">{error}</p>}

          {/* ── SUBMIT ── */}
          <Button
            type="submit"
            disabled={loading || !canSubmit}
            style={{ width: "100%", opacity: !canSubmit ? 0.45 : 1 }}
            aria-busy={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                {isEditing ? "Updating…" : "Saving…"}
              </span>
            ) : (
              isEditing ? "Update Expense" : "Save Expense"
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
