"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";


import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  birth_date: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
};

function toISODateString(d: Date) {
  // local date -> YYYY-MM-DD (no timezone shifting)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISODateString(s: string) {
  // "YYYY-MM-DD" -> Date (local)
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isAuthed, setIsAuthed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");

  const [dobOpen, setDobOpen] = useState(false);

  // load logged in user's profile
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        setIsAuthed(false);
        setFirstName("");
        setLastName("");
        setEmail("");
        setBirthDate(undefined);
        setPhone("");
        setLinkedin("");
        setGithub("");
        setLoading(false);
        return;
      }

      setIsAuthed(true);

      // fetch profile row if it exists
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, birth_date, phone, linkedin, github")
        .eq("id", user.id)
        .maybeSingle();
      
      if (profileErr) {
        setError(profileErr.message);
        setLoading(false);
        return;
      }

      // create profile row if missing
      if (!profile) {
        const initial: ProfileRow = {
          id: user.id,
          first_name: null,
          last_name: null,
          email: user.email ?? null,
          birth_date: null,
          phone: null,
          linkedin: null,
          github: null,
        };

        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert(initial, { onConflict: "id" });

        if (upsertErr) {
          setError(upsertErr.message);
          setLoading(false);
          return;
        }

        setFirstName("");
        setLastName("");
        setEmail(user.email ?? "");
        setBirthDate(undefined);
        setPhone("");
        setLinkedin("");
        setGithub("");
        setLoading(false);
        return;
      }

      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setEmail(profile.email ?? user.email ?? "");
      setBirthDate(profile.birth_date ? fromISODateString(profile.birth_date) : undefined);
      setPhone(profile.phone ?? "");
      setLinkedin(profile.linkedin ?? "");
      setGithub(profile.github ?? "");


      setLoading(false);
    };

    load();
  }, []);

  // save only if logged in
  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!isAuthed) {
      setError("Log in to save your profile.");
      return;
    }

    setSaving(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      setError("Session expired. Please log in again.");
      setSaving(false);
      setIsAuthed(false);
      return;
    }

    const payload: ProfileRow = {
      id: user.id,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim() || null,
      birth_date: birthDate ? toISODateString(birthDate) : null,
      phone: phone.trim() || null,
      linkedin: linkedin.trim() || null,
      github: github.trim() || null,
    };

    const { error: saveErr } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (saveErr) {
      setError(saveErr.message);
      setSaving(false);
      return;
    }

    setSuccess("Saved!");
    setSaving(false);
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink>My Profile</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col items-center p-4">
        <div className="w-full max-w-3xl p-4">
          <FieldSet>
            {/* Friendly note if not logged in */}
            {!isAuthed && !loading && (
              <p className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                You’re viewing Profile in guest mode. Log in to save your details.
              </p>
            )}

            {error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {success && (
              <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {success}
              </p>
            )}

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="firstName">Name</FieldLabel>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    id="firstName"
                    placeholder={isAuthed ? "First Name" : "First Name (guest)"}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading || saving}
                  />
                  <Input
                    id="lastName"
                    placeholder={isAuthed ? "Last Name" : "Last Name (guest)"}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading || saving}
                  />
                </div>
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  placeholder={isAuthed ? "you@email.com" : "Email (guest)"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || saving}
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Date of birth</FieldLabel>

                <Popover open={dobOpen} onOpenChange={setDobOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-60 justify-between font-normal"
                      disabled={loading || saving}
                    >
                      {birthDate ? birthDate.toLocaleDateString() : "Select date"}
                      <ChevronDownIcon className="h-4 w-4 opacity-70" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={birthDate}
                      captionLayout="dropdown"
                      onSelect={(d) => {
                        setBirthDate(d);
                        setDobOpen(false);
                      }}
                      disabled={(d) => d > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input
                  id="phone"
                  placeholder=""
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading || saving}
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="linkedin">LinkedIn</FieldLabel>
                <Input
                  id="linkedin"
                  placeholder="https://linkedin.com/in/..."
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  disabled={loading || saving}
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="github">GitHub</FieldLabel>
                <Input
                  id="github"
                  placeholder="https://github.com/..."
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  disabled={loading || saving}
                />
              </Field>
            </FieldGroup>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || saving || !isAuthed}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </FieldSet>
        </div>
      </div>
    </>
  );
}
