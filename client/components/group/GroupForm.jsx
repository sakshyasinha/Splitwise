import { useState } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

export default function GroupForm() {
  const { createGroup, loading, error, clearError } = useExpenses();

  const [name, setName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [success, setSuccess] = useState("");

  // ➕ Add member
  const handleAddMember = () => {
    const email = memberInput.trim().toLowerCase();

    if (!email) return;

    if (members.includes(email)) {
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
    clearError();

    try {
      await createGroup({
        name,
        members, // 🔥 important
      });

      setSuccess("Group created successfully.");
      setName("");
      setMembers([]);
    } catch (err) {
      // handled in store
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

        {/* Messages */}
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