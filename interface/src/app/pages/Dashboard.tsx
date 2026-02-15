export function Dashboard() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-semibold text-gray-900 mb-6">Dashboard</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Welcome to the Hospital Multi-Agent Patient/Room Allocator & Scheduler
          </p>
          <p className="text-sm text-gray-500 mt-4">
            This is where the 3D hospital floor plan (Smplrspace integration) will be displayed.
          </p>
        </div>
      </div>
    </div>
  );
}
