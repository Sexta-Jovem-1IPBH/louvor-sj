export function BadgeStatus({ ativo, label }: { ativo: boolean; label: string }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-medium " +
        (ativo
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600")
      }
    >
      {label}
    </span>
  );
}
