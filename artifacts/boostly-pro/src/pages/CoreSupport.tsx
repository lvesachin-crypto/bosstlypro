import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageMeta } from "@/components/seo/PageMeta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function CoreSupport() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { data: tickets = [], refetch } = useQuery({ queryKey: ["support", user?.id], queryFn: api.getSupportTickets, enabled: Boolean(user) });
  async function submit() {
    if (!subject.trim() || !message.trim()) return;
    try {
      await api.createSupportTicket({ subject, message });
      setSubject(""); setMessage(""); await refetch();
      toast.success("Support request created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create request");
    }
  }
  return (
    <DashboardLayout>
      <PageMeta title="Support" description="Contact Boostly Pro support." noIndex />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
          <div><h1 className="text-2xl font-bold">Support</h1><p className="text-sm text-muted-foreground">Send a request to the support team.</p></div>
          <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
          <div className="space-y-2"><Label>Message</Label><textarea className="min-h-32 w-full rounded-md border p-3 text-sm" value={message} onChange={(event) => setMessage(event.target.value)} /></div>
          <Button onClick={submit}>Create request</Button>
        </div>
        <div className="rounded-2xl border bg-white shadow-sm">
          <h2 className="border-b p-5 font-semibold">Your requests</h2>
          <div className="divide-y">
            {tickets.map((ticket: any) => <div key={ticket.id} className="p-5"><p className="font-medium">{ticket.subject}</p><p className="text-xs capitalize text-muted-foreground">{ticket.status}</p></div>)}
            {!tickets.length && <p className="p-10 text-center text-sm text-muted-foreground">No support requests yet.</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}