export default function SummaryCard({ label, value, icon }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <p className="text-xl mb-2">{icon}</p>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-gray-400 leading-snug">{label}</p>
    </div>
  );
}
