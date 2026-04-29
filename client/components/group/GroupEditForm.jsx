import { useState, useEffect } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import useAuth from "../../hooks/useAuth.js";
import useToast from "../../hooks/useToast.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

const GROUP_TYPES = ["trip", "home", "couple", "office", "friends", "other"];

const normalizeEmail = (value) => value.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function GroupEditForm({ group, onSuccess, onDelete, onMemberChange }) {
  const { updateGroup, deleteGroup, addGroupMember, removeGroupMember, loading, error, clearError } = useExpenses();
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    type: "other",
    description: "",
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [memberInput, setMemberInput] = useState("");
  const [localError, setLocalError] = useState("");

  const currentUserEmail = normalizeEmail(user?.email || "");

  const currentMembers = group?.members || [];

  useEffect(() => {
    if (group) {
      setForm({
        name: group.name || "",
        type: group.type || "other",
        description: group.description || "",
      });
    }
  }, [group]);

  const handleChange = (e) => {
    clearError();
    setLocalError("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateGroup(group._id, form);
      toast.success("Group updated successfully");
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.message || "Failed to update group");
    }
  };

  const handleDelete = async () => {
    try {
      console.log("Deleting group:", group._id);
      const result = await deleteGroup(group._id);
      console.log("Delete result:", result);
      toast.success("Group deleted successfully");
      if (onDelete) onDelete();
    } catch (err) {
      console.error("Error deleting group:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to delete group";
      console.error("Error message:", errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleAddMember = async () => {
    const email = normalizeEmail(memberInput);

    setLocalError("");
    clearError();

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

    // Check if member already exists
    const memberExists = currentMembers.some(
      member => String(member.email || "").toLowerCase() === email
    );

    if (memberExists) {
      setLocalError("Member already exists");
      setMemberInput("");
      return;
    }

    try {
      // For now, we'll use the email as memberId - the backend will resolve it
      await addGroupMember(group._id, email);
      toast.success("Member added successfully");
      setMemberInput("");
      // Refresh group data without closing modal
      if (onMemberChange) onMemberChange();
    } catch (err) {
      console.error("Error adding member:", err);
      setLocalError(err.response?.data?.message || err.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await removeGroupMember(group._id, memberId);
      toast.success("Member removed successfully");
      // Refresh group data without closing modal
      if (onMemberChange) onMemberChange();
    } catch (err) {
      console.error("Error removing member:", err);
      setLocalError(err.response?.data?.message || err.message || "Failed to remove member");
    }
  };

  return (
    <Card>
      <div className="card-header">
        <h2>Edit Group</h2>
        <p>Update group details</p>
      </div>

      <div className="card-content">
        <form className="stack-lg" onSubmit={handleUpdate}>
          <Input
            name="name"
            label="Group Name"
            value={form.name}
            onChange={handleChange}
            placeholder="Friends Trip"
            required
          />

          <Input
            name="description"
            label="Description (optional)"
            value={form.description}
            onChange={handleChange}
            placeholder="Monthly rent and utilities"
            multiline
          />

          <div className="input-block">
            <label className="input-label">Type</label>
            <select
              className="input"
              name="type"
              value={form.type}
              onChange={handleChange}
            >
              {GROUP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Members Section */}
          <div className="section">
            <label className="label">Members</label>

            {/* Current Members */}
            <div className="chips">
              {currentUserEmail && (
                <div className="chip primary">
                  You
                  <span className="chip-sub">{currentUserEmail}</span>
                </div>
              )}

              {currentMembers
                .filter(member => String(member.email || "").toLowerCase() !== currentUserEmail)
                .map((member) => (
                  <div key={member._id} className="chip">
                    {member.name || member.email}
                    <span
                      onClick={() => handleRemoveMember(member._id)}
                      style={{ cursor: 'pointer', marginLeft: '8px' }}
                    >
                      ×
                    </span>
                  </div>
                ))}
            </div>

            {/* Add Member Input */}
            <div className="row" style={{ marginTop: '12px' }}>
              <input
                type="email"
                className="input"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                placeholder="Enter email to add member"
              />
              <Button
                type="button"
                onClick={handleAddMember}
                disabled={loading}
              >
                Add
              </Button>
            </div>

            {localError && <p className="banner error">{localError}</p>}
          </div>

          {error && <p className="banner error">{error}</p>}

          <Button
            type="submit"
            disabled={loading || !form.name.trim()}
            style={{ width: "100%" }}
          >
            {loading ? "Updating..." : "Update Group"}
          </Button>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Danger Zone</h3>
            {!confirmDelete ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                style={{ width: "100%", color: "var(--danger)", borderColor: "var(--danger-dim)" }}
              >
                Delete Group
              </Button>
            ) : (
              <div className="stack">
                <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>
                  This action cannot be undone. Are you sure?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    style={{
                      flex: 1,
                      background: "var(--danger)",
                      color: "white",
                      border: "none",
                    }}
                  >
                    {loading ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}
