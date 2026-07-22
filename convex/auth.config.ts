export default {
  providers: [
    {
      // Clerk Frontend API URL / issuer domain. Set on the Convex deployment:
      //   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>.clerk.accounts.dev
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
