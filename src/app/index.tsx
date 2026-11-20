import { Redirect } from 'expo-router';

// Session restoration is owned by the root layout.
export default function Index() {
  return <Redirect href="/dashboard" />;
}
