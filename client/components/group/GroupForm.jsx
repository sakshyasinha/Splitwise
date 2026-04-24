import { useMemo, useState } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

const normalizeEmail = (value) => value.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function GroupForm() {
  const { createGroup, loading, error, clearError } = useExpenses();

  const currentUserEmail = normalizeEmail(sessionStorage.getItem("email") || "");

  const [name, setName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [success, setSuccess] = useState("");
  const [localError, setLocalError] = useState("");

  const allMembersPreview = useMemo(() => {
    const others = [...new Set(members.map(normalizeEmail).filter(Boolean))];
    return currentUserEmail ? [currentUserEmail, ...others] : others;
  }, [currentUserEmail, members]);

  // ➕ Add member
  const handleAddMember = () => {
    const email = normalizeEmail(memberInput);

    setLocalError("");
    setSuccess("");

    if (!email) {
      setLocalError("Enter an email to add a member");
      return;
    }

    if (!isValidEmail(email)) {
      setLocalError("Enter a valid email");
      return;
    }

    if (currentUserEmail && email === currentUserEmail) {
      setLocalError("You are already part of the group");
      setMemberInput("");
      return;
    }

    if (members.map(normalizeEmail).includes(email)) {
      setLocalError("Member already added");
      setMemberInput("");
      return;
    }

    setMembers((prev) => [...prev, email]);
    setMemberInput("");
    setSuccess(`Added ${email}`);
  };

  // ❌ Remove member
  const handleRemoveMember = (email) => {
    setLocalError("");
    setMembers((prev) => prev.filter((m) => m !== email));
  };

  // 🚀 Submit
  const handleSubmit = async (event) => {
    event.preventDefault();

    setSuccess("");
    setLocalError("");
    clearError();

    if (!name.trim()) {
      setLocalError("Group name is required");
      return;
    }

    if (members.length === 0) {
      setLocalError("Add at least one member before creating the group");
      return;
    }

    try {
      await createGroup({
        name: name.trim(),
        members: members.map(normalizeEmail),
      });

      setSuccess("Group created successfully.");
      setName("");
      setMembers([]);
    } catch (err) {
      // handled globally
    }
  };

  return (
    <Card title="Create Group" subtitle="Start splitting with your crew">
      <form className="stack" onSubmit={handleSubmit}>
        
        {/* Group Name */}
        <Input
          id="group-name"
          label="Group Name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Flatmates April"
          required
        />

        {/* Show current user */}
        <div>
          <label className="label">Members</label>
          <p className="muted">
            ✔ You ({currentUserEmail || "current account"})
          </p>
        </div>

        {/* Add Members */}
        <div>
          <label className="label">Add Members (email)</label>

          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="email"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="friend@example.com"
              className="input"
            />
            <Button type="button" onClick={handleAddMember}>
              Add
            </Button>
          </div>

          {/* Local errors */}
          {localError && <p className="banner error">{localError}</p>}

          {/* Member preview including current user */}
          {allMembersPreview.length > 0 && (
            <ul style={{ marginTop: "10px", paddingLeft: "18px" }}>
              {allMembersPreview.map((email) => (
                <li key={`preview-${email}`} className="muted">
                  {email === currentUserEmail ? `You (${email})` : email}
                </li>
              ))}
            </ul>
          )}

          {/* Member List */}
          {members.length > 0 && (
            <ul style={{ marginTop: "10px" }}>
              {members.map((email) => (
                <li key={email} className="flex-between">
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(email)}
                    className="danger"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Backend messages */}
        {error && <p className="banner error">{error}</p>}
        {success && <p className="banner success">{success}</p>}

        {/* Submit */}
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Creating..." : "Create Group"}
        </Button>
      </form>
    </Card>
  );
}