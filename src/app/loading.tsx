export default function Loading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 w-48 rounded bg-panel-2" />
      <div className="h-4 w-96 max-w-full rounded bg-panel-2" />
      <div className="h-64 rounded-xl bg-panel" />
    </div>
  );
}
