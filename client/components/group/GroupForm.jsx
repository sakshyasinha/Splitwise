import { useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth.js";
import useExpenses from "../../hooks/useExpenses.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import { normalizeEmail, isValidEmail } from "../../utils/validation.js";

const GROUP_TYPES = [
  { value: "trip", label: "🚞Trip" },
  { value: "home", label: "🏠Home" },
  { value: "couple", label: "💓Couple" },
  { value: "office", label: "💼Office" },
  { value: "friends", label: "🫂Friends" },
  { value: "other", label: "Other" }
];

export default function GroupForm({ onSuccess }) {
  const { user } = useAuth();
  const { createGroup, loading, error, clearError } = useExpenses();

  const currentUserEmail = normalizeEmail(user?.email || sessionStorage.getItem("email") || "");

  const [name, setName] = useState("");
  const [type, setType] = useState("other");
  const [description, setDescription] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [success, setSuccess] = useState("");
  const [localError, setLocalError] = useState("");
  const [warning, setWarning] = useState("");

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

    try {
      const result = await createGroup({
        name: name.trim(),
        type,
        description: description.trim(),
        members,
      });

      // Check if backend returned a warning about existing group
      if (result?.warning) {
        setWarning(result.warning);
        setSuccess("Group created successfully");
      } else {
        setSuccess("Group created successfully");
        setName("");
        setType("other");
        setDescription("");
        setMembers([]);
        if (onSuccess) {
          onSuccess();
        }
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

        {error && <p className="banner error">{error}</p>}
        {warning && <p className="banner warning">{warning}</p>}
        {success && <p className="banner success">{success}</p>}

        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Creating..." : "Create Group"}
        </Button>
      </form>
    </Card>
  );
}