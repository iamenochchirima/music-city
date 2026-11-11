import { AccountOverview } from "@/features/account/components/account-overview";

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-white">Your account</h1>
      <AccountOverview />
    </main>
  );
}
