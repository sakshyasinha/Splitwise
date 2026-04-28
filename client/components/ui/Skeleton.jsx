import React from 'react';

const Skeleton = ({ variant = 'text', width, height, className = '', count = 1 }) => {
  const baseClass = 'skeleton';

  const variantStyles = {
    text: 'skeleton-text',
    'text-sm': 'skeleton-text-sm',
    avatar: 'skeleton-avatar',
    card: 'skeleton-card',
    button: 'skeleton-button',
  };

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  const renderSkeleton = (index) => (
    <div
      key={index}
      className={`${baseClass} ${variantStyles[variant] || ''} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  );

  if (count > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: count }).map((_, index) => renderSkeleton(index))}
      </div>
    );
  }

  return renderSkeleton(0);
};

// Pre-configured skeleton components for common use cases
const SkeletonText = ({ lines = 3, ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        variant={index === lines - 1 ? 'text-sm' : 'text'}
        {...props}
      />
    ))}
  </div>
);

const SkeletonCard = () => (
  <div className="card" style={{ padding: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <Skeleton variant="avatar" />
      <div style={{ flex: 1 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text-sm" width="40%" />
      </div>
    </div>
    <Skeleton variant="text" width="80%" />
    <Skeleton variant="text-sm" width="50%" />
  </div>
);

const SkeletonStats = () => (
  <div className="card stat-violet" style={{ padding: '16px' }}>
    <Skeleton variant="avatar" style={{ marginBottom: '12px' }} />
    <Skeleton variant="text-sm" width="40%" style={{ marginBottom: '8px' }} />
    <Skeleton variant="text" width="60%" style={{ marginBottom: '4px' }} />
    <Skeleton variant="text-sm" width="50%" />
  </div>
);

const SkeletonExpenseItem = () => (
  <div className="expense-item">
    <Skeleton variant="avatar" />
    <div style={{ flex: 1 }}>
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="text-sm" width="50%" />
    </div>
    <div style={{ textAlign: 'right' }}>
      <Skeleton variant="text" width="80px" />
      <Skeleton variant="text-sm" width="60px" />
    </div>
  </div>
);

const SkeletonGroupCard = () => (
  <div className="group-card">
    <Skeleton variant="avatar" />
    <div style={{ flex: 1 }}>
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text-sm" width="40%" />
    </div>
  </div>
);

const SkeletonButton = ({ width = 120 }) => (
  <Skeleton variant="button" width={width} />
);

export default Skeleton;
export {
  SkeletonText,
  SkeletonCard,
  SkeletonStats,
  SkeletonExpenseItem,
  SkeletonGroupCard,
  SkeletonButton,
};
