import { useMemo, useState } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

const CATEGORIES = [
  {  label: "Food" },
  {  label: "Travel" },
  {  label: "Events" },
  {  label: "Utilities" },
  {  label: "Shopping" },
];

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

export default function ExpenseForm() {
  const { addExpense, groups, expenses, loading, error, clearError } = useExpenses();

  const [form, setForm] = useState({
    description: "",
    amount: "",
    groupId: "",
  });

  const [selectedCategory, setSelectedCategory] = useState("");
  const [participantInput, setParticipantInput] = useState("");
  const [participants, setParticipants] = useState([]);
  const [success, setSuccess] = useState("");
  const [localError, setLocalError] = useState("");

  const canSubmit = useMemo(() => {
    return (
      form.description.trim() &&
      Number(form.amount) > 0 &&
      form.groupId &&
      participants.length > 0
    );
  }, [form, participants]);

  const normalizeGroupName = (value) => String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]+/g, "");

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
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddParticipant = () => {
    const email = participantInput.trim().toLowerCase();
    setLocalError("");
    if (!email) return;
    if (!isValidEmail(email)) { setLocalError("Enter a valid email"); return; }
    if (participants.includes(email)) { setLocalError("Already added"); setParticipantInput(""); return; }
    setParticipants((prev) => [...prev, email]);
    setParticipantInput("");
  };

  const removeParticipant = (email) => {
    setParticipants((prev) => prev.filter((p) => p !== email));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");
    setLocalError("");
    try {
      await addExpense({
        description: form.description,
        amount: Number(form.amount),
        groupId: form.groupId,
        participants,
        category: selectedCategory,
      });
      setSuccess("Expense added successfully.");
      setForm({ description: "", amount: "", groupId: "" });
      setParticipants([]);
      setSelectedCategory("");
    } catch (_) {}
  };

  return (
    <Card className="expense-form-card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Add Expense</h2>
            <p>Track shared spending instantly</p>
          </div>
         
        </div>
      </div>

      <div className="card-content">
        <form className="stack-lg" onSubmit={handleSubmit}>

          {/* ── DESCRIPTION + AMOUNT ── */}
          <div className="form-row-grid">
            <Input
              name="description"
              label="What was this for?"
              value={form.description}
              onChange={onChange}
              placeholder="Dinner at Bistro"
              required
            />
            <Input
              name="amount"
              label="Amount (₹)"
              type="number"
              min="1"
              value={form.amount}
              onChange={onChange}
              placeholder="1600"
              required
            />
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
              required
            >
              <option value="">Choose group</option>
              {groupOptions.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
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
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddParticipant())}
              />
              <Button type="button" variant="ghost" onClick={handleAddParticipant}>
                Add
              </Button>
            </div>

            {localError && (
              <p className="banner error" style={{ marginTop: 8 }}>{localError}</p>
            )}

            {participants.length > 0 && (
              <div className="chips" style={{ marginTop: 10 }}>
                {participants.map((email) => (
                  <div key={email} className="chip primary">
                    {email}
                    <span
                      onClick={() => removeParticipant(email)}
                      title="Remove"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}

            {participants.length > 0 && (
              <p className="text-sm muted" style={{ marginTop: 6 }}>
                Split equally among {participants.length + 1} people
              </p>
            )}
          </div>

          {/* ── STATUS ── */}
          {error && <p className="banner error">{error}</p>}
          {success && <p className="banner success">{success}</p>}

          {/* ── SUBMIT ── */}
          <Button
            type="submit"
            disabled={loading || !canSubmit}
            style={{ width: "100%", opacity: !canSubmit ? 0.45 : 1 }}
          >
            {loading ? "Saving…" : "Save Expense"}
          </Button>

        </form>
      </div>
    </Card>
  );
}
