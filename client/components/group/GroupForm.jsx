import { useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth.js";
import useExpenses from "../../hooks/useExpenses.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

const normalizeEmail = (value) => value.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
    clearError();

    if (!name.trim()) {
      setLocalError("Group name is required");
      return;
    }

    if (members.length === 0) {
      setLocalError("Add at least one member");
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
    } catch (_) {}
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
              Preview: {allMembers.join(' · ')}
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