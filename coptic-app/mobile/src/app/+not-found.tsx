import { Redirect } from 'expo-router';

// Unknown links (and the web preview, which can start at any path) land on today's page.
export default function NotFound() {
  return <Redirect href="/" />;
}
