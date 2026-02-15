import { ProviderView } from '../components/ProviderView';
import { useSearchParams } from 'react-router';

export function Provider() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProviderId = searchParams.get('provider');

  return <ProviderView initialProviderId={initialProviderId} />;
}