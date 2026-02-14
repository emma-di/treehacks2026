import { useSearchParams } from 'react-router';
import { PatientView } from '../components/PatientView';

export function Patient() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('id');

  return (
    <div className="h-full">
      <PatientView initialPatientId={patientId} />
    </div>
  );
}