"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { createGroupAction } from "@/app/(main)/communities/actions";
import { cn } from "@/lib/utils";

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export function CreateGroupModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const slug = slugify(name);

  function handleSubmit() {
    if (!name.trim() || name.trim().length < 3) { toast.error("Name must be at least 3 characters"); return; }
    startTransition(async () => {
      const { group, error } = await createGroupAction({ name: name.trim(), description, is_private: isPrivate });
      if (error || !group) { toast.error(error ?? "Failed to create community"); return; }
      toast.success(`c/${group.slug} created!`);
      setOpen(false);
      setName(""); setDescription(""); setIsPrivate(false);
      router.push(`/communities/c/${group.slug}`);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" />
          Create community
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle>Create a community</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              placeholder="e.g. MIT Class of 2029"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
            {slug && (
              <p className="text-xs text-muted-foreground">
                URL: <span className="font-mono">c/{slug}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="group-desc"
              placeholder="What is this community about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none min-h-[80px] text-sm"
              maxLength={280}
            />
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  !isPrivate ? "border-foreground bg-muted/40" : "hover:bg-muted/30"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Globe className="size-3.5" />
                  <span className="text-sm font-medium">Public</span>
                </div>
                <span className="text-[11px] text-muted-foreground">Anyone can view and join</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  isPrivate ? "border-foreground bg-muted/40" : "hover:bg-muted/30"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Lock className="size-3.5" />
                  <span className="text-sm font-medium">Private</span>
                </div>
                <span className="text-[11px] text-muted-foreground">Only members can see posts</span>
              </button>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={isPending || name.trim().length < 3} className="w-full">
            {isPending ? "Creating…" : "Create community"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
