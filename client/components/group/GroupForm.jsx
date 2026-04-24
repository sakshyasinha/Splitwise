import { useState } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

// simple email validator
const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

export default function GroupForm() {
  const { createGroup, loading, error, clearError } = useExpenses();

  const currentUserEmail = localStorage.getItem("email"); // ⚠️ replace with auth store later

  const [name, setName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [success, setSuccess] = useState("");
  const [localError, setLocalError] = useState("");

  // ➕ Add member
  const handleAddMember = () => {
    const email = memberInput.trim().toLowerCase();

    setLocalError("");

    if (!email) return;

    if (!isValidEmail(email)) {
      setLocalError("Enter a valid email");
      return;
    }

    if (email === currentUserEmail) {
      setLocalError("You are already part of the group");
      setMemberInput("");
      return;
    }

    if (members.includes(email)) {
      setLocalError("Member already added");
      setMemberInput("");
      return;
    }

    setMembers((prev) => [...prev, email]);
    setMemberInput("");
  };

  // ❌ Remove member
  const handleRemoveMember = (email) => {
    setMembers((prev) => prev.filter((m) => m !== email));
  };

  // 🚀 Submit
  const handleSubmit = async (event) => {
    event.preventDefault();

    setSuccess("");
    setLocalError("");
    clearError();

    try {
      await createGroup({
        name,
        members,
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
          <p className="muted">✔ You ({currentUserEmail})</p>
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