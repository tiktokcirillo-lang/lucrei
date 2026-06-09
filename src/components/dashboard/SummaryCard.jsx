export default function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div
      className="rounded-xl border transition-all duration-200 cursor-default"
      style={{ backgroundColor: '#0F1623', borderColor: '#1E293B', padding: '24px' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E293B')}
    >
      <div className="flex items-center justify-between mb-4">
        <Icon size={20} style={{ color }} />
        <span
          className="text-xs uppercase tracking-wide"
          style={{ color: '#64748B' }}
        >
          {label}
        </span>
      </div>
      <p className="font-bold leading-none" style={{ color: '#F1F5F9', fontSize: '32px' }}>
        {value}
      </p>
    </div>
  );
}
