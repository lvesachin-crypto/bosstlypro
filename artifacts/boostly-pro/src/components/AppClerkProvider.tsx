import { ClerkProvider, SignIn, SignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  if (!clerkPubKey) {
    return <div>Missing Clerk Publishable Key</div>;
  }
  
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
    >
      {children}
    </ClerkProvider>
  );
}
