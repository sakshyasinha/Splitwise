import { useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth.js";
import useExpenses from "../../hooks/useExpenses.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

// Constants for error messages
const ERROR_MESSAGES = {
  EMPTY_EMAIL: "Enter an email",
  INVALID_EMAIL: "Invalid email format",
  SELF_EMAIL: "You are already included",
  DUPLICATE_EMAIL: "Already added",
  EMPTY_GROUP_NAME: "Group name is required",
  NO_MEMBERS: "Add at least one member",
};

const normalizeEmail = (value) => value.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Chip Component
const Chip = ({ email, onRemove, isPrimary }) => (
  <div className={`chip ${isPrimary ? "primary" : ""}`}>
    {isPrimary ? "You" : email}
    <span className="chip-sub">{isPrimary ? email : "×"}</span>
    {!isPrimary && <span onClick={() => onRemove(email)}>×</span>}
  </div>
);

export default function GroupForm() {
  const { user } = useAuth();
  const { createGroup, loading, error, clearError } = useExpenses();

  const currentUserEmail = normalizeEmail(user?.email || sessionStorage.getItem("email") || "");

  const [name, setName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [success, setSuccess] = useState("");
  const [localError, setLocalError] = useState("");

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
      setLocalError(ERROR_MESSAGES.EMPTY_EMAIL);
      return;
    }

    if (!isValidEmail(email)) {
      setLocalError(ERROR_MESSAGES.INVALID_EMAIL);
      return;
    }

    if (email === currentUserEmail) {
      setLocalError(ERROR_MESSAGES.SELF_EMAIL);
      setMemberInput("");
      return;
    }

    if (members.includes(email)) {
      setLocalError(ERROR_MESSAGES.DUPLICATE_EMAIL);
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
    clearError();

    if (!name.trim()) {
      setLocalError(ERROR_MESSAGES.EMPTY_GROUP_NAME);
      return;
    }

    if (members.length === 0) {
      setLocalError(ERROR_MESSAGES.NO_MEMBERS);
      return;
    }

    try {
      await createGroup({
        name: name.trim(),
        members,
      });

      setSuccess("Group created successfully");
      setName("");
      setMembers([]);
    } catch (err) {
      setLocalError(err.message || "Failed to create group");
    }
  };

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
              aria-label="Add member email"
            />
            <Button type="button" onClick={handleAddMember} disabled={!memberInput.trim()}>
              Add
            </Button>
          </div>

          {localError && <p className="banner error">{localError}</p>}

          <div className="chips">
            {currentUserEmail && <Chip email={currentUserEmail} isPrimary />}
            {members.map((email) => (
              <Chip key={email} email={email} onRemove={removeMember} />
            ))}
          </div>

          {allMembers.length > 0 && (
            <p className="text-sm muted" style={{ marginTop: 8 }}>
              Preview: {allMembers.join(" · ")}
            </p>
          )}
        </div>

        {error && <p className="banner error">{error}</p>}
        {success && <p className="banner success">{success}</p>}

        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Creating..." : "Create Group"}
        </Button>
      </form>
    </Card>
  );
}