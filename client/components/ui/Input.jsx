export default function Input({ label, id, multiline = false, ...props }) {
  return (
    <label className="input-block" htmlFor={id}>
      <span className="input-label">
        {label}
        {props.required ? <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span> : null}
      </span>
      {multiline ? (
        <textarea id={id} className="input" {...props} />
      ) : (
        <input id={id} className="input" {...props} />
      )}
    </label>
  );
}