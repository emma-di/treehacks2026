import { FloorPlanGrid } from '../components/FloorPlanGrid';

export default function Hospital() {
    return (
        <div className="h-full p-6">
            <FloorPlanGrid rows={5} cols={6} />
        </div>
    );
}
