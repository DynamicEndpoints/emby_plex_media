import { InviteForm } from "@/components/invite-form";

interface InvitePageProps {
  params: {
    code: string;
  };
}

export default function InvitePage({ params }: InvitePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <InviteForm code={params.code} />
    </div>
  );
}

export function generateMetadata({ params }: InvitePageProps) {
  return {
    title: `Invite ${params.code} | Media Invite`,
    description: "You've been invited to join our media server.",
  };
}
