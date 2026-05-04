import { getCategoryColors, getCategoryEmoji } from '../../utils/categoryUtils.js';

/**
 * Category icon component
 * @param {object} props - Component props
 * @param {string} props.category - Category name
 */
export default function CategoryIcon({ category }) {
  const style = getCategoryColors(category);
  return (
    <div
      className="expense-icon"
      style={{ background: style.bg, color: style.color, fontSize: 17 }}
    >
      {getCategoryEmoji(category)}
    </div>
  );
}