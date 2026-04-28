import { useState, useEffect } from "react";
import useExpenses from "../../hooks/useExpenses.js";
import useToast from "../../hooks/useToast.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";

const GROUP_TYPES = ["trip", "home", "couple", "office", "friends", "other"];

export default function GroupEditForm({ group, onSuccess }) {
  const { updateGroup, deleteGroup, loading, error, clearError } = useExpenses();
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    type: "other",
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (group) {
      setForm({
        name: group.name || "",
        type: group.type || "other",
      });
    }
  }, [group]);

  const handleChange = (e) => {
    clearError();
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateGroup(group._id, form);
      toast.success("Group updated successfully");
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(error || "Failed to update group");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGroup(group._id);
      toast.success("Group deleted successfully");
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(error || "Failed to delete group");
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
