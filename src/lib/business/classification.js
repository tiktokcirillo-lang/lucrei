export function getMarginClass(mr) {
  if (mr >= 40) return "A";
  if (mr >= 20) return "B";
  return "C";
}

export const CLASS_COLORS = { A: "#22c55e", B: "#eab308", C: "#ef4444" };

export const CLASS_BADGE = {
  A: "bg-green-500/20 text-green-400",
  B: "bg-yellow-500/20 text-yellow-400",
  C: "bg-red-500/20 text-red-400",
};
